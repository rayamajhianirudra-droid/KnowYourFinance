# 25. Login activity history and active sessions

## What changed

Two related security features, both reachable from a new "Activity" button in the top bar.

**Recent sign-in activity.** Every sign-in attempt against an account - successful or failed - is now recorded and shown back to the owner, newest first, with the time, the device (from the browser's User-Agent) and the address it came from. A failed attempt is recorded only when the email belongs to a real account, so the owner can see someone trying their account, and arbitrary mistyped addresses are never stored. The record is deliberately spare: it never stores the password tried or anything else typed.

**Your devices.** The same screen lists the devices the account is currently signed in on, marks the current one, and lets the person sign any other one out - or sign out all other devices at once - from the server. Because the web app keeps its login in the HTTP session, ending a session immediately drops that device's login: its next request comes back as signed out. Each device is referred to by a random opaque handle; the real session id (effectively that session's password) is never sent to the browser, so the device list cannot be turned into a way to take over a session.

New endpoints under /api/auth: `login-history`, `sessions` (GET), `sessions/{handle}` (DELETE), and `sessions/revoke-others` (POST). All require a signed-in account and are scoped to that account, so one account can never see or end another's sessions. New table `login_events` (owner, outcome, time, user agent, address), with row-level security like the other sensitive tables; active sessions are tracked in memory (`SessionTracker`), matching the lifetime of the HTTP sessions themselves.

## How it was checked

Unit tests pin down the session tracker: listing with the current session flagged and no real ids leaked, ending one session by handle without touching the others, refusing another account's handle, "sign out others" keeping the current session, and cleanup when a session is destroyed. An integration test against a real PostgreSQL drives the endpoints: it signs in on two devices, checks the history shows a success and a failure, lists the sessions with exactly one current, signs one device out by handle (and confirms that session is invalidated), signs in a third device and uses "revoke others" (confirming only the current one survives), and checks that one account cannot sign out another's device. Frontend tests cover the device/activity lists, the per-device and bulk sign-out, and the User-Agent summariser. The backend suite (230 tests) and frontend suite (228 tests) pass and the frontend builds.

The flow was also run end to end against a live Docker Compose stack: signing in on two devices (different browsers), listing the sessions, signing the second device out by its handle, and confirming the second device's next request came back 401 while the first stayed signed in, plus the login history listing the success and the failure.

## Limits

Active sessions live in this one backend's memory, so "your devices" and "sign out other devices" are correct for the single backend the app runs as today; running several backends behind a load balancer would need a shared session store. The history keeps the most recent 20 sign-in attempts per account.
