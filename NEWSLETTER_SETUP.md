# Newsletter Setup Guide

The newsletter feature is built and pushed to the repo, but it needs a few one-time setup steps from you before it can actually send email. None of these are things I can do on your behalf — they involve creating accounts and handling secret keys, which should stay in your hands.

## What was built

- **`newsletter.html`** — a new coach-only page (linked from Coach Hub) where you import subscribers, write an issue, send a test to yourself, and send to everyone. Logs in the same way as Equipment Tracker and Roster Manager.
- **`netlify/functions/send-newsletter.js`** — a serverless function that does the actual sending. It checks that the request really comes from your logged-in coach account before sending anything, then emails every subscriber through Brevo in one call.
- **`netlify/functions/send-newsletter-batch.js`** — a scheduled function that runs automatically once a day. It only does anything if a single newsletter ever has more than 300 recipients (Brevo's free-plan daily cap) — in that case it sends the next 300 each day until everyone's reached. At your current list size (223), this stays idle since everything goes out in one send.
- **`netlify/functions/unsubscribe.js`** — a public link (included in the footer of every newsletter) that lets someone remove themselves from the list with one click.
- Subscribers and send history are stored in Firestore (the same database the site already uses for the roster and equipment tracker), in collections `newsletterSubscribers`, `newsletterSends`, and `newsletterQueue` (only used if a send ever exceeds 300 people).

## Step 1 — Create a Brevo account

1. Go to [brevo.com](https://www.brevo.com) and sign up (free plan: 300 emails/day, no monthly cap, no credit card required).
2. In the Brevo dashboard, go to **Settings → SMTP & API → API Keys** and generate a new API key. Copy it somewhere safe — you'll paste it into Netlify in Step 3.
3. Go to **Settings → Senders, Domains & Dedicated IPs → Senders** and add the email address you want the newsletter to send from (e.g. `newsletter@holmenwrestling.app` or your own email). Brevo will email that address a verification link — you must click it before Brevo will let you send from it. You don't need a fully verified domain to get started, just a verified sender address.

## Step 2 — Generate a Firebase service account key

The sending function needs its own way to read the subscriber list from Firestore (separate from your coach login).

1. Go to the [Firebase Console](https://console.firebase.google.com/), open the **holmen-women-s-wrestling** project.
2. Click the gear icon → **Project settings** → **Service accounts** tab.
3. Click **Generate new private key**. This downloads a `.json` file — keep it private, don't email it or post it anywhere.
4. Open that file in a text editor. You'll paste its *entire contents* (the whole JSON, starting with `{` and ending with `}`) into Netlify in the next step.

## Step 3 — Add environment variables in Netlify

1. Go to your site in the [Netlify dashboard](https://app.netlify.com/) → **Site configuration** → **Environment variables**.
2. Add these:

| Key | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The entire contents of the JSON file from Step 2, pasted as one value |
| `BREVO_API_KEY` | The API key from Step 1 |
| `NEWSLETTER_FROM` | The verified sender from Step 1, formatted like `Holmen Women's Wrestling <newsletter@holmenwrestling.app>` |
| `SITE_URL` | Your site's URL, e.g. `https://holmenwomenswrestlingsite.netlify.app` (used to build the unsubscribe link) |

3. Trigger a new deploy (Netlify usually redeploys automatically after you push to GitHub, but env var changes need a fresh deploy to take effect — you can click **Trigger deploy** in Netlify if needed).

## Step 4 — Check the deploy

After pushing these files and setting the environment variables:

1. In Netlify, check the **Deploys** tab — the build log should show `npm install` running and installing `firebase-admin`, and the **Functions** tab should list `send-newsletter`, `send-newsletter-batch`, and `unsubscribe`.
2. The **Functions** tab should also show `send-newsletter-batch` as a **scheduled** function running daily — that's expected and normal; it'll just log "No queued newsletters to send" most days.
3. If functions don't show up, double check under **Site configuration → Build & deploy** that the publish directory is set to the repo root (`.`) and nothing there overrides `netlify.toml`.

## Step 5 — Import your list and test

1. Go to **Coach Hub → Newsletter**, log in with the coach passcode.
2. Open your spreadsheet/CSV of 223 emails, copy the email column, and paste it into the **Add subscribers** box (one per line, or comma-separated — either works). Click **Import Emails**.
3. Write a short test subject and message, then click **Send Test to Myself** first — check that it actually arrives (and check your spam folder the first few times).
4. Once a test looks right, use **Send to All Subscribers**. You'll get a confirmation prompt before it actually sends. With 223 subscribers, everyone gets it in that one click — no waiting for follow-up days.

## Notes and limitations (v1)

- Unsubscribe links don't require a token — anyone who knows a specific email address could remove it from the list by visiting that link. For a small team newsletter this is a low risk, but it's worth knowing.
- There's no rich-text/image editor yet — the compose box is plain text, with blank lines becoming paragraph breaks in the email. If you want images or fancier formatting later, that's a reasonable next step.
- Brevo's free plan is 300 emails/day, no monthly cap. If your list ever grows past 300, a single "Send to All" click will send the first 300 immediately and automatically queue the rest to go out over the following day(s) — you'll see that reflected in the Send History as "in progress" until it's fully delivered.
