// Public Netlify function — removes one email address from the newsletter subscriber list.
// Linked from the footer of every newsletter email as: /.netlify/functions/unsubscribe?email=...
//
// Note on security: this is intentionally a simple, no-login link (that's how unsubscribe links
// work everywhere — nobody wants to log in just to opt out). The trade-off is that anyone who
// knows a specific email address could unsubscribe it on that person's behalf. For a small team
// newsletter that's a low, acceptable risk; if it's ever a concern, a per-subscriber token could
// be added later.
//
// Requires the same FIREBASE_SERVICE_ACCOUNT environment variable as send-newsletter.js.

const { getAdmin } = require('./_shared/newsletter-helpers');

function page(message) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe | Holmen Women's Wrestling</title>
<style>
body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:#f5f5f7;color:#19191d;display:grid;place-items:center;min-height:100vh;padding:24px}
.card{background:#fff;border-radius:18px;padding:36px;max-width:440px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.15)}
h1{color:#6d1730;font-size:1.5rem;margin:0 0 12px}
p{line-height:1.6;color:#454549}
a{color:#6d1730}
</style>
</head>
<body>
<div class="card">
<h1>Holmen Women's Wrestling</h1>
<p>${message}</p>
<p><a href="/">Return to the site</a></p>
</div>
</body>
</html>`;
}

exports.handler = async (event) => {
  const email = (event.queryStringParameters && event.queryStringParameters.email || '').trim().toLowerCase();

  if (!email) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: page('No email address was provided.') };
  }

  let fbAdmin;
  try {
    fbAdmin = getAdmin();
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: page('Something went wrong on our end. Please contact Coach Carl directly to be removed.') };
  }

  try {
    const db = fbAdmin.firestore();
    const snap = await db.collection('newsletterSubscribers').where('email', '==', email).get();
    const batch = db.batch();
    snap.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: page('Something went wrong removing you. Please contact Coach Carl directly to be removed.') };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: page(`${email} has been unsubscribed from the newsletter. You won't receive future emails.`),
  };
};
