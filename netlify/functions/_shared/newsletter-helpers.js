// Shared helpers for the newsletter functions. Not a function endpoint itself — lives in a
// subfolder so Netlify doesn't treat it as one.

const admin = require('firebase-admin');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function getAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bodyToHtml(text, unsubscribeUrl) {
  const escaped = escapeHtml(text);
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `<!doctype html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f7;padding:24px;margin:0;color:#19191d">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e1e2e5">
    <div style="background:#6d1730;color:#ffffff;padding:20px 24px;font-weight:900;font-size:1.2rem">
      Holmen Women's Wrestling
    </div>
    <div style="padding:24px 24px 8px">${paragraphs}</div>
    <div style="padding:16px 24px 24px;border-top:1px solid #e1e2e5;font-size:.75rem;color:#676b73">
      You're receiving this because you subscribed to Holmen Women's Wrestling updates.
      ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#6d1730">Unsubscribe</a>` : ''}
    </div>
  </div>
</body>
</html>`;
}

// "Name <email@domain.com>" -> { name, email }. Falls back sensibly if the format is off.
function parseFromAddress(raw) {
  const match = /^\s*(.*?)\s*<(.+)>\s*$/.exec(raw || '');
  if (match) {
    return { name: match[1].replace(/^"|"$/g, '') || "Holmen Women's Wrestling", email: match[2].trim() };
  }
  return { name: "Holmen Women's Wrestling", email: (raw || '').trim() || 'no-reply@example.com' };
}

// Sends ONE batch via a single Brevo API call using messageVersions — each recipient gets their
// own personalized htmlContent (with their own unsubscribe link) without seeing anyone else's
// address. Brevo allows up to 1000 message versions and 2000 total recipients per call, and its
// free plan allows up to 300 emails/day, so BATCH_SIZE (set by the caller) should stay at or
// below 300.
async function sendBrevoBatch(emails, fromAddress, subject, body, siteUrl) {
  if (!emails.length) return { sent: 0, failed: 0, errors: [] };

  const { name, email: senderEmail } = parseFromAddress(fromAddress);
  const fallbackHtml = bodyToHtml(body, '');

  const messageVersions = emails.map((email) => {
    const unsubscribeUrl = siteUrl ? `${siteUrl}/.netlify/functions/unsubscribe?email=${encodeURIComponent(email)}` : '';
    return {
      to: [{ email }],
      htmlContent: bodyToHtml(body, unsubscribeUrl),
    };
  });

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name, email: senderEmail },
        subject,
        htmlContent: fallbackHtml,
        messageVersions,
      }),
    });
    if (res.ok) {
      return { sent: emails.length, failed: 0, errors: [] };
    }
    const text = await res.text().catch(() => '');
    return { sent: 0, failed: emails.length, errors: [text || `Brevo returned ${res.status}`] };
  } catch (e) {
    return { sent: 0, failed: emails.length, errors: [e.message] };
  }
}

module.exports = { getAdmin, escapeHtml, bodyToHtml, sendBrevoBatch };
