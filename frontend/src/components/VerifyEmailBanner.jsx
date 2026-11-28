import { useState } from "react";
import { resendVerification } from "../api";

/**
 * A quiet reminder shown at the top of the app while the signed-in account's
 * email is not yet verified. It never blocks anything - the app works fine
 * unverified - it just offers to resend the confirmation link.
 */
export default function VerifyEmailBanner({ email }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setBusy(true);
    setError("");
    try {
      await resendVerification();
      setSent(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verify-banner" role="status">
      <span className="verify-banner__text">
        {sent
          ? "Verification email sent. Open the link in your inbox to confirm your email."
          : `Please confirm your email${email ? ` (${email})` : ""} to secure your account.`}
      </span>
      {!sent && (
        <button type="button" className="btn btn--secondary" onClick={resend} disabled={busy}>
          {busy ? "Sending…" : "Resend email"}
        </button>
      )}
      {error && <span className="field__error" role="alert">{error}</span>}
    </div>
  );
}
