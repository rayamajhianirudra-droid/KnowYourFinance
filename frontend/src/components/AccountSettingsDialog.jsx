import { useEffect, useRef, useState } from "react";
import { changePassword } from "../api";

const MIN_LENGTH = 12;

/**
 * Account settings - for now, changing the password. Changing it signs out
 * this account's OTHER devices (the backend ends those sessions server-side);
 * the device making the change stays signed in. The dialog follows the same
 * shape as ResetDataDialog so it fits the existing design, and is built to
 * grow as more account and security settings are added.
 */
function AccountSettingsDialog({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const sameAsCurrent = next.length > 0 && next === current;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    !busy &&
    current.length > 0 &&
    next.length >= MIN_LENGTH &&
    next === confirm &&
    next !== current;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await changePassword(current, next));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 className="dialog__title" id="settings-title">Change password</h2>

        {done ? (
          <>
            <p>
              Your password has been changed.
              {done.signedOutOtherDevices > 0
                ? ` We signed out ${done.signedOutOtherDevices} other ${done.signedOutOtherDevices === 1 ? "device" : "devices"}.`
                : " No other devices were signed in."}
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p>Changing your password signs out your other devices. This one stays signed in.</p>

            <label className="field">
              <span className="field__label">Current password</span>
              <input
                ref={firstRef}
                type="password"
                value={current}
                autoComplete="current-password"
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">New password</span>
              <input
                type="password"
                value={next}
                autoComplete="new-password"
                aria-invalid={tooShort || sameAsCurrent}
                onChange={(e) => setNext(e.target.value)}
              />
              {tooShort && <span className="field__error" role="alert">Use at least {MIN_LENGTH} characters.</span>}
              {sameAsCurrent && !tooShort && (
                <span className="field__error" role="alert">Choose a password different from your current one.</span>
              )}
            </label>

            <label className="field">
              <span className="field__label">Confirm new password</span>
              <input
                type="password"
                value={confirm}
                autoComplete="new-password"
                aria-invalid={mismatch}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {mismatch && <span className="field__error" role="alert">The new passwords do not match.</span>}
            </label>

            {error && <p className="field__error" role="alert">{error}</p>}

            <div className="dialog__actions">
              <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
                {busy ? "Changing..." : "Change password"}
              </button>
              <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AccountSettingsDialog;
