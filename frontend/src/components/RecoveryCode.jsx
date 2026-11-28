import { useState } from "react";
import { downloadRecoverySheet } from "../utils/recoverySheet";

/**
 * Shows a recovery code once, with a download and a copy button. The person
 * must tick that it is saved before continuing, because it cannot be shown
 * again later.
 */
export default function RecoveryCode({ email, code, onDone, doneLabel = "Continue" }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="recovery">
      <p>
        This is your <strong>recovery code</strong>. If you forget your password, it is the only way back into your
        account, and it is shown only now. Save it somewhere private.
      </p>
      <p className="recovery__code" aria-label="Your recovery code">{code}</p>
      <div className="recovery__actions">
        <button type="button" className="btn btn--secondary" onClick={() => downloadRecoverySheet(email, code)}>
          Download recovery sheet
        </button>
        <button type="button" className="btn btn--secondary" onClick={copy}>
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <label className="recovery__confirm">
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        <span>I have saved my recovery code</span>
      </label>
      <button type="button" className="btn btn--primary" disabled={!saved} onClick={onDone}>{doneLabel}</button>
    </div>
  );
}
