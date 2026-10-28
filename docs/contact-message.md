# Contact Message Flow

This document is the maintenance context for the public contact form. It
describes the backend half of the migration from browser-direct Postmail
delivery to a Turnstile-protected Netlify Function.

## Current status

The backend implementation is complete in
`netlify/functions/contact-message.js` and is published in Git on `main`.
The frontend migration remains a separate task: the React form must render a
Cloudflare Turnstile managed widget, POST the contract below to the backend,
and remove `REACT_APP_ACCESS_TOKEN` from its build configuration.

Do not describe the flow as production-ready until the owner has configured
the Cloudflare widget and Netlify variables, a successful deployment has
activated those variables, and a controlled end-to-end delivery check has
passed. This repository does not create the Cloudflare widget or modify
Netlify account settings.

## Public contract

```text
POST /.netlify/functions/contact-message
Content-Type: application/json
```

The JSON object must contain exactly these four string fields:

```json
{
  "subject": "Research question",
  "email": "visitor@example.com",
  "message": "Hello.",
  "turnstileToken": "token-from-the-managed-widget"
}
```

Validation limits are intentionally explicit:

| Field | Constraint |
| --- | --- |
| `subject` | 1-200 characters; no CR/LF |
| `email` | 3-320 characters; basic address shape |
| `message` | 1-5,000 characters |
| `turnstileToken` | 1-2,048 characters |

Successful delivery returns `200` with `{ "ok": true }`. The function uses
generic errors and never returns submitted subject, email, message, provider
response details, Turnstile tokens, or access tokens.

## Request flow

1. The function rejects unapproved origins, non-JSON bodies, oversized bodies,
   malformed JSON, extra fields and invalid field values.
2. It consumes an IP-only rate-limit key. The default is five attempts per
   fifteen minutes. With the existing Upstash variables configured, the key
   is Redis-backed; otherwise it is limited to the warm function instance.
3. It POSTs the Turnstile token to Cloudflare Siteverify using
   `TURNSTILE_SECRET_KEY`.
4. It requires `success: true`, an exact configured hostname, the exact
   configured action, and no provider error codes. Missing, expired, replayed,
   invalid, mismatched, malformed or unreachable provider results fail closed.
5. Only after successful verification does it POST the legacy-compatible
   URL-encoded payload to Postmail using the backend-only
   `POSTMAIL_ACCESS_TOKEN`.

The rate-limit key contains the client IP only. It must never be changed to
include the subject, email address, message body or Turnstile token.

## CORS and browser boundary

The contact function has a separate allowlist. `CONTACT_ALLOWED_ORIGINS` is a
comma-separated list, and the function also recognizes the known portfolio
origins. It never emits wildcard CORS. Preflight accepts only `POST` and
`Content-Type`; it does not permit credentials, authorization headers or
admin CSRF headers.

The public portfolio GET endpoint and all admin cookie/auth/CSRF contracts are
separate and must remain unchanged. Do not reuse the contact function's CORS
helper for admin endpoints or broaden the admin allowlist while changing the
contact form.

## Required owner configuration

Set these variables on the backend Netlify site only:

```text
TURNSTILE_SECRET_KEY=<Cloudflare Turnstile secret key>
TURNSTILE_EXPECTED_ACTION=contact_message
TURNSTILE_ALLOWED_HOSTNAMES=<comma-separated exact Siteverify hostnames>
POSTMAIL_ACCESS_TOKEN=<Postmail access token>
CONTACT_ALLOWED_ORIGINS=<comma-separated exact frontend origins>
```

In Cloudflare Turnstile:

1. Create a Free managed widget.
2. Add every exact frontend hostname that may render the widget, including
   the production custom domains and the portfolio's Netlify hostname. Add
   `localhost` only for local testing.
3. Configure the widget action as `contact_message`.
4. Copy the secret key only to Netlify. The public site key may be used by the
   frontend widget, but the secret key must never appear in frontend build
   variables, source, logs or the request body sent by the browser.

`TURNSTILE_ALLOWED_HOSTNAMES` must contain the hostnames Cloudflare actually
returns from Siteverify, not arbitrary origins or a wildcard. The hostname
allowlist and `CONTACT_ALLOWED_ORIGINS` are different settings: one validates
Cloudflare's assertion, while the other controls browser CORS.

After the frontend migration, remove `REACT_APP_ACCESS_TOKEN` from the
frontend environment and rebuild. The old browser-direct Postmail request to
`https://postmail.invotes.com/send` must not remain in the deployed frontend.

## Testing and release boundary

`test/contactMessage.test.js` mocks both external providers and covers the
success path, malformed payloads, wrong media type, origin rejection and
narrow preflight, missing configuration, invalid/expired/replayed tokens,
hostname/action mismatch, provider/network failure, Postmail failure and rate
limiting. Tests do not send a real message, call live Siteverify, create a
Cloudflare widget, or change Netlify variables.

Before release:

1. Run `npm test` and `git diff --check`.
2. Review the staged tree for `.env`, provider credentials, tokens and private
   content.
3. Deploy the backend code with the required Netlify variables present.
4. Migrate and deploy the frontend with the public Turnstile site key and no
   `REACT_APP_ACCESS_TOKEN`.
5. Perform one controlled end-to-end test using a real Turnstile token and a
   deliberately non-sensitive message, then confirm the response and delivery.

Do not retry provider or delivery failures blindly. Inspect the deployment
logs only for the fixed, generic messages emitted by the function; submitted
content and credentials must not be added to diagnostics.
