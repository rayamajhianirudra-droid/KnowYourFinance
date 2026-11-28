import { useEffect, useState } from "react";
import { accountCredentials, getAccountSession, requestPasswordReset, signOutAccount } from "../api";
import ResetPasswordScreen from "./ResetPasswordScreen";

// A reset link looks like /reset-password?token=... . Read the token once so
// the screen can be shown whether or not anyone is signed in.
function readResetToken() {
  try {
    const url = new URL(window.location.href);
    if (url.pathname === "/reset-password") return url.searchParams.get("token");
  } catch {
    // window.location may be unavailable in some environments; ignore.
  }
  return null;
}

export default function AccountGate({ children }) {
  const [account, setAccount] = useState(undefined);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [resetToken, setResetToken] = useState(() => readResetToken());

  useEffect(() => {
    let active = true;
    function sessionExpired() {
      setAccount(null);
    }
    window.addEventListener("kyf-session-expired", sessionExpired);
    getAccountSession().then(
      (session) => { if (active) setAccount(session); },
      () => { if (active) setLoadError("Could not check your session."); },
    );
    return () => {
      active = false;
      window.removeEventListener("kyf-session-expired", sessionExpired);
    };
  }, [retry]);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { email, password } = Object.fromEntries(new FormData(form));
    setPending(true);
    setError("");
    try {
      const session = await accountCredentials(creating, email, password);
      form.reset();
      setAccount(session);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  async function submitForgot(event) {
    event.preventDefault();
    const { email } = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setForgotSent(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError("");
    try {
      await signOutAccount();
      setCreating(false);
      setAccount(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  function backToSignIn() {
    setForgot(false);
    setForgotSent(false);
    setError("");
  }

  // Someone arriving from the emailed reset link, signed in or not.
  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          try { window.history.replaceState({}, "", "/"); } catch { /* ignore */ }
          setResetToken(null);
          setAccount(null);
        }}
      />
    );
  }

  if (account) return children({ account, signOut, pending, error });

  const title = forgot ? "Reset your password" : creating ? "Create an account" : "Sign in";

  return (
    <main className="content-container account-screen">
      <section className="account-card" aria-labelledby="account-title">
        <p className="brand__name">KnowYourFinance</p>
        <h1 id="account-title">{title}</h1>
        {account === undefined ? (
          loadError ? (
            <>
              <p role="alert">{loadError}</p>
              <button type="button" onClick={() => { setLoadError(""); setRetry(retry + 1); }}>Try again</button>
            </>
          ) : <p role="status">Checking your session…</p>
        ) : forgot ? (
          forgotSent ? (
            <>
              <p role="status">If that email has an account, a reset link is on its way. Check your inbox.</p>
              <button type="button" className="btn btn--secondary" onClick={backToSignIn}>Back to sign in</button>
            </>
          ) : (
            <form className="account-form" onSubmit={submitForgot}>
              <label htmlFor="forgot-email">Email</label>
              <input id="forgot-email" name="email" type="email" autoComplete="username" maxLength={254} required />
              {error && <p role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary" disabled={pending}>
                {pending ? "Please wait…" : "Send reset link"}
              </button>
              <button type="button" className="btn btn--secondary" onClick={backToSignIn} disabled={pending}>
                Back to sign in
              </button>
            </form>
          )
        ) : (
          <>
            <form className="account-form" onSubmit={submit}>
              <label htmlFor="account-email">Email</label>
              <input id="account-email" name="email" type="email" autoComplete="username" maxLength={254} required />
              <label htmlFor="account-password">Password</label>
              <input id="account-password" name="password" type="password"
                autoComplete={creating ? "new-password" : "current-password"} minLength={creating ? 12 : undefined}
                maxLength={72} required />
              {creating && <small>Use at least 12 characters, up to 72 bytes.</small>}
              {error && <p role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary" disabled={pending}>
                {pending ? "Please wait…" : creating ? "Create account" : "Sign in"}
              </button>
            </form>
            <button type="button" className="btn btn--secondary" disabled={pending} onClick={() => { setError(""); setCreating(!creating); }}>
              {creating ? "Back to sign in" : "Create an account"}
            </button>
            {!creating && (
              <button type="button" className="account-link" disabled={pending}
                onClick={() => { setError(""); setForgot(true); setForgotSent(false); }}>
                Forgot password?
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
