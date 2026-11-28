import { useState } from "react";
import { resetPassword } from "../api";

const MIN_LENGTH = 12;

/**
 * The screen shown when someone opens the reset link from their email
 * (/reset-password?token=...). It takes a new password and completes the reset.
 * It works whether or not anyone is signed in, and hands back to the sign-in
 * screen through onDone.
 */
export default function ResetPasswordScreen({ token, onDone }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = !busy && next.length >= MIN_LENGTH && next === confirm;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await resetPassword(token, next);
      setDone(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="content-container account-screen">
      <section className="account-card" aria-labelledby="reset-title">
        <p className="brand__name">KnowYourFinance</p>
        <h1 id="reset-title">Choose a new password</h1>
        {done ? (
          <>
            <p role="status">Your password has been reset. You can sign in now.</p>
            <button type="button" className="btn btn--primary" onClick={onDone}>Go to sign in</button>
          </>
        ) : (
          <form className="account-form" onSubmit={submit}>
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              value={next}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              maxLength={72}
              required
              aria-invalid={tooShort}
              onChange={(e) => setNext(e.target.value)}
            />
            {tooShort && <small role="alert">Use at least {MIN_LENGTH} characters.</small>}

            <label htmlFor="reset-confirm">Confirm new password</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirm}
              autoComplete="new-password"
              maxLength={72}
              required
              aria-invalid={mismatch}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && <small role="alert">The new passwords do not match.</small>}

            {error && <p role="alert">{error}</p>}

            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
              {busy ? "Please wait…" : "Reset password"}
            </button>
            <button type="button" className="btn btn--secondary" onClick={onDone} disabled={busy}>
              Back to sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
