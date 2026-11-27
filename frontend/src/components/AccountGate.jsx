import { useEffect, useState } from "react";
import { accountCredentials, getAccountSession, signOutAccount } from "../api";

export default function AccountGate({ children }) {
  const [account, setAccount] = useState(undefined);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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

  if (account) return children({ account, signOut, pending, error });

  return (
    <main className="content-container account-screen">
      <section className="account-card" aria-labelledby="account-title">
        <p className="brand__name">KnowYourFinance</p>
        <h1 id="account-title">{creating ? "Create an account" : "Sign in"}</h1>
        {account === undefined ? (
          loadError ? (
            <>
              <p role="alert">{loadError}</p>
              <button type="button" onClick={() => { setLoadError(""); setRetry(retry + 1); }}>Try again</button>
            </>
          ) : <p role="status">Checking your session…</p>
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
          </>
        )}
      </section>
    </main>
  );
}
