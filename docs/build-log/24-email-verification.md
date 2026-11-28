# 24. Email verification

## What changed

New accounts are now asked to confirm their email address. Signing up sends a message with a one-time link; opening the link marks the email verified. Until then the app shows a small reminder at the top with a "Resend email" button, but nothing is blocked - an unverified account works exactly as before. This is deliberate: verification is a nudge, not a gate, so no one is ever locked out of their own data.

Accounts that existed before this feature are treated as already verified and never see the reminder. The new `email_verified` column defaults to true, so the rows already in the database are left verified; only new sign-ups start unverified (the entity field starts false), so only they are emailed.

The endpoints are POST /api/auth/verify-email (public, because the person may open the link while signed out) and POST /api/auth/resend-verification (for the signed-in account). The session response now carries `emailVerified` so the web app knows whether to show the reminder.

## The token and the email

The link carries a one-time token: 32 random bytes from a cryptographic generator, stored only as a SHA-256 hash in `email_verification_tokens`, so a database leak yields no usable links. A token lasts 24 hours and can be used once; asking for a new one drops any earlier unused token. The token is never logged or returned by the API.

Email goes through a small, reusable sender. In development it is a local Mailpit container in docker-compose (inbox at http://localhost:8025), so nothing real is sent; production points SPRING_MAIL_* at a real SMTP server. The sender is optional and its failures are swallowed, so sign-up never fails just because email is down or unconfigured - the person can resend. Row-level security is enabled on the new table like the other sensitive tables.

## How it was checked

A unit test fixes when a token may be spent (fresh, expired, used). An integration test against a real PostgreSQL, with a stand-in mail sender that captures the link, follows the whole flow: sign up (the session reports emailVerified false), confirm the unverified account can still use the app (a protected endpoint answers 200, so there is no lockout), open the captured link to verify (the session then reports true), and check that the token is single-use, a nonsense token is refused, resend sends a fresh link while unverified, and resend sends nothing once verified. Frontend tests cover the verification screen, the reminder banner's resend, and the link opening the verification screen. The full backend and frontend suites pass and the frontend builds. The live Mailpit delivery path is the same one exercised end to end in the account-security Docker verification.

## Limits

The 24-hour lifetime is fixed in code. Verification never gates access by design; if a future requirement needs certain actions to require a verified email, that gate would be added on top of the `emailVerified` flag this adds.
