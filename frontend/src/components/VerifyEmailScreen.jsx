import { useEffect, useState } from "react";
import { verifyEmail } from "../api";

/**
 * The screen shown when someone opens the verification link from their email
 * (/verify-email?token=...). It verifies the token on load - no extra click
 * needed - and then hands back to the app through onDone.
 */
export default function VerifyEmailScreen({ token, onDone }) {
  const [state, setState] = useState("working"); // "working" | "done" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    verifyEmail(token).then(
      () => { if (active) setState("done"); },
      (failure) => { if (active) { setState("error"); setMessage(failure.message); } },
    );
    return () => { active = false; };
  }, [token]);

  return (
    <main className="content-container account-screen">
      <section className="account-card" aria-labelledby="verify-title">
        <p className="brand__name">KnowYourFinance</p>
        <h1 id="verify-title">Email verification</h1>
        {state === "working" && <p role="status">Verifying your email…</p>}
        {state === "done" && <p role="status">Your email is verified. Thank you.</p>}
        {state === "error" && <p role="alert">{message}</p>}
        {state !== "working" && (
          <button type="button" className="btn btn--primary" onClick={onDone}>Continue</button>
        )}
      </section>
    </main>
  );
}
