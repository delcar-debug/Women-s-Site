// Scheduled Netlify function — runs automatically once a day (see netlify.toml) to work through
// any queued newsletter that had more than 300 recipients (Brevo's free-plan daily cap). This
// sends the next 300 from the queue each time it runs, until the queue for that newsletter is
// empty. For a list under 300, this function normally has nothing to do — the whole send goes
// out immediately from send-newsletter.js.
//
// This never needs to be called directly — Netlify triggers it on the schedule in netlify.toml.
// It only processes one queued newsletter per run (the oldest), so if two large newsletters are
// sent close together, the second one's remaining batches wait until the first one's queue drains.

const { getAdmin, sendBrevoBatch } = require('./_shared/newsletter-helpers');

const BATCH_SIZE = 300;

exports.handler = async () => {
  let fbAdmin;
  try {
    fbAdmin = getAdmin();
  } catch (e) {
    console.error('Missing/invalid FIREBASE_SERVICE_ACCOUNT:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing Firebase credentials.' }) };
  }

  const db = fbAdmin.firestore();
  const snap = await db.collection('newsletterQueue').orderBy('createdAt', 'asc').limit(1).get();

  if (snap.empty) {
    return { statusCode: 200, body: JSON.stringify({ message: 'No queued newsletters to send.' }) };
  }

  const queueDoc = snap.docs[0];
  const { subject, body, remaining } = queueDoc.data();
  const list = remaining || [];
  const chunk = list.slice(0, BATCH_SIZE);
  const stillRemaining = list.slice(BATCH_SIZE);

  const fromAddress = process.env.NEWSLETTER_FROM || "Holmen Women's Wrestling <newsletter@holmenwrestling.app>";
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');

  const { sent, failed, errors } = await sendBrevoBatch(chunk, fromAddress, subject, body, siteUrl);

  const sendRef = db.collection('newsletterSends').doc(queueDoc.id);
  const sendDoc = await sendRef.get();
  const prev = sendDoc.exists ? sendDoc.data() : { sentSoFar: 0, failed: 0 };

  await sendRef.set(
    {
      sentSoFar: (prev.sentSoFar || 0) + sent,
      failed: (prev.failed || 0) + failed,
      status: stillRemaining.length ? 'sending' : 'complete',
      lastBatchAt: fbAdmin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (stillRemaining.length) {
    await queueDoc.ref.set({ remaining: stillRemaining }, { merge: true });
  } else {
    await queueDoc.ref.delete();
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sent, failed, stillRemaining: stillRemaining.length, errors: errors.slice(0, 3) }),
  };
};
