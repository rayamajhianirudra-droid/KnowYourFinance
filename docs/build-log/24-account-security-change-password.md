# 24. Changing your password and signing out other devices

## What changed

A signed-in person can now change their own password. The profile menu in the top bar has a new "Change password..." entry next to "Delete all my data...". It opens a dialog that asks for the current password, the new password, and the new password again. The new password must be at least 12 characters, must match its confirmation, and must be different from the current one - the same length rule the sign-up form already applies.

The backend endpoint is POST /api/auth/change-password. It requires an authenticated session, re-checks the current password against the stored BCrypt hash, and only then replaces the hash. Requiring the current password is deliberate: a session on its own is not enough to change the password, so a browser left unlocked cannot be used to take the account over, and a hijacked session cannot lock the real owner out without knowing the existing password. The same per-address rate limit that guards sign-in also guards this endpoint.

## Signing out the other devices

Changing a password is usually what a person does when they think someone else may know it, so a successful change now ends that account's other sessions. The device that made the change stays signed in; every other session the account has open is invalidated on the server, and the next request from those devices comes back as "signed out". The dialog reports how many other devices were signed out.

This works without a new database table. The web app keeps its login state inside the HTTP session, so invalidating a session immediately drops its login - there is no separate token to revoke. A new component, SessionTracker, keeps a reference to each account's live sessions and invalidates the others when the password changes. Those sessions live in the one backend's memory, exactly like the login state itself, so a restart ends them all and the tracker starts empty again. This is also the groundwork for a later "see and sign out my devices" screen.

## How it was checked

A plain unit test pins down the tracker: it ends every other session, keeps the current one, leaves other accounts untouched, and copes with a session that is already gone. An integration test against a real PostgreSQL (started by Testcontainers, the same way the account-isolation test runs) drives the whole flow through the HTTP endpoints - sign up, sign in on a second device, then change the password - and checks the three things that matter: the current password is required (a wrong one is refused with 403), the stored hash really changes (the old password stops working and the new one starts), and the other device's session is ended while the current one stays signed in. The full backend suite (226 tests) and the frontend suite (190 tests) pass, and the frontend builds.

## Limits

The "forgot password" flow - resetting a password by email for someone who cannot sign in at all - is a separate piece of work and is not part of this change. Because sessions live in one backend's memory, "sign out my other devices" is correct for the single backend the app runs as today; running several backends behind a load balancer would need a shared session store, which the planned active-session-management work will add.
