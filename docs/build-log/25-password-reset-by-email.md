# 25. Password reset by email

## What changed

Someone who has forgotten their password can now get back in. The sign-in screen has a "Forgot password?" link that asks for an email and then says - the same way whether or not that email has an account - that a reset link is on its way. If the email does belong to an account, a message arrives with a link. The link opens a screen to choose a new password, and after that the person signs in normally.

The endpoints are POST /api/auth/forgot-password and POST /api/auth/reset-password. Both are open to signed-out visitors (the whole point is that you cannot sign in), and both are rate limited per address like sign-in.

## Keeping the tokens safe

The link carries a one-time token: 32 random bytes from a cryptographic generator. The database never stores the token itself, only its SHA-256 hash, so a database leak cannot be turned back into working links. A token expires after 30 minutes and can be used once; asking for a new link drops any earlier unused one. The token is never written to the logs or returned by the API - it only ever exists in the email. Completing a reset also ends every session the account had open, so a reset shuts out anyone who was already signed in.

Account enumeration is avoided on purpose: forgot-password does the same visible thing for a registered and an unregistered email, and sends an email only in the first case, so it cannot be used to find out which emails have accounts.

## The email, in development and in production

Development uses Mailpit, a mail catcher that runs as a container in docker-compose. Reset emails go to it instead of a real inbox and can be read at http://localhost:8025, so no real mail is ever sent while building or testing. Production points SPRING_MAIL_* at a real SMTP server through environment variables; when no mail server is configured at all, the app still starts and simply sends nothing (the sender is optional). The link in the email is built from KYF_APP_URL, so it points at wherever the app is actually served.

## How it was checked

A unit test fixes exactly when a token may be spent (fresh, expired, already used). An integration test against a real PostgreSQL, with a stand-in email sender that captures the link, follows the whole flow: ask for a reset, read the token from the captured link, set a new password, and confirm the old password stops working, the new one works, the token cannot be used twice, a signed-in session is ended by the reset, and an unknown email produces no email at all. Frontend tests cover the forgot form, the reset screen's validation, and the reset link opening the reset screen.

The flow was also run end to end against a real Docker Compose stack with Mailpit: signing up, requesting a reset, reading the actual email out of the Mailpit inbox (subject "Reset your KnowYourFinance password", carrying a 43-character token), resetting, and confirming the old password returned 401, the new one 200, reusing the token returned 400, and a request for an unknown email left the inbox with exactly one message - the one real account's.

## Limits

A real SMTP server is only used in production and only if its environment variables are set; this change does not configure one. The reset link is a query-string token carried over whatever transport KYF_APP_URL names, so a production deployment should serve the app over HTTPS. The 30-minute lifetime and single active token per account are fixed in code rather than configurable.
