// Netlify serverless function — sends a newsletter issue to every subscriber in Firestore.
//
// Brevo's free plan allows up to 300 emails/day and each API call can cover up to 300 recipients
// (via "message versions", each with its own personalized content), so most sends here go out in
// a single call. If the subscriber list ever grows past 300, the first 300 send right away and
// the rest are queued in Firestore (`newsletterQueue`) — a scheduled function
// (send-newsletter-batch.js) sends the next 300 the following day, and so on, automatically.
//
// Security model: this endpoint is publicly reachable (it has to be, to be called from the
// browser), so it does NOT trust the caller just because the request came from newsletter.html.
// Instead it requires a real Firebase ID token for the coach account, and verifies that token
// server-side with the Firebase Admin SDK before doing anything. Anyone else calling this URL
// directly gets rejected.
//
// Required environment variables (set these in Netlify: Site settings → Environment variables):
//   FIREBASE_SERVICE_ACCOUNT   Full JSON contents of a Firebase service account key, as one string.
//   BREVO_API_KEY              API key from your Brevo account.
//   NEWSLETTER_FROM            Optional. e.g. "Holmen Women's Wrestling <newsletter@yourdomain.com>".
//                              The email address must be a verified sender in your Brevo account.
//   SITE_URL                   Optional. Used to build the unsubscribe link, e.g. https://holmenwomenswrestlingsite.netlify.app

const { getAdmin, sendBrevoBatch } = require('./_shared/newsletter-helpers');

const COACH_EMAIL = 'coach@holmenwrestling.app';
const BATCH_SIZE = 300; // Brevo's free-plan daily cap, and comfortably under its per-call limits

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { subject, body, testEmail } = payload;
  if (!subject || !body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Subject and body are required' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing authorization token' }) };
  }

  let fbAdmin;
  try {
    fbAdmin = getAdmin();
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing Firebase credentials. Check FIREBASE_SERVICE_ACCOUNT.' }) };
  }

  let decoded;
  try {
    decoded = await fbAdmin.auth().verifyIdToken(idToken);
  } catch (e) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired login. Please log in again.' }) };
  }

  if (decoded.email !== COACH_EMAIL) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized to send the newsletter.' }) };
  }

  if (!process.env.BREVO_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing BREVO_API_KEY.' }) };
  }

  const fromAddress = process.env.NEWSLETTER_FROM || "Holmen Women's Wrestling <newsletter@holmenwrestling.app>";
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  const db = fbAdmin.firestore();

  // Test sends always go to just the one address, right now, no queueing involved.
  if (testEmail) {
    const { sent, failed, errors } = await sendBrevoBatch(
      [String(testEmail).trim().toLowerCase()],
      fromAddress,
      subject,
      body,
      siteUrl
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ success: failed === 0, sent, failed, errors: errors.slice(0, 3) }),
    };
  }

  const snap = await db.collection('newsletterSubscribers').get();
  const recipients = snap.docs
    .map((d) => (d.data().email || '').trim().toLowerCase())
    .filter(Boolean);

  if (!recipients.length) {
    return { statusCode: 200, body: JSON.stringify({ success: true, sent: 0, failed: 0, queued: 0, message: 'No recipients found.' }) };
  }

  const firstBatch = recipients.slice(0, BATCH_SIZE);
  const remaining = recipients.slice(BATCH_SIZE);

  const { sent, failed, errors } = await sendBrevoBatch(firstBatch, fromAddress, subject, body, siteUrl);

  const sendRef = db.collection('newsletterSends').doc();
  try {
    await sendRef.set({
      subject,
      body,
      totalRecipients: recipients.length,
      sentSoFar: sent,
      failed,
      status: remaining.length ? 'sending' : 'complete',
      createdAt: fbAdmin.firestore.FieldValue.serverTimestamp(),
      lastBatchAt: fbAdmin.firestore.FieldValue.serverTimestamp(),
    });

    if (remaining.length) {
      await db.collection('newsletterQueue').doc(sendRef.id).set({
        subject,
        body,
        remaining,
        createdAt: fbAdmin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    // Logging/queueing failure shouldn't hide that the first batch already went out.
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: failed === 0,
      sent,
      failed,
      queued: remaining.length,
      errors: errors.slice(0, 3),
    }),
  };
};
