import { useCallback, useEffect, useState } from "react";
import { getLoginHistory, getSessions, endSession, revokeOtherSessions } from "../api";
import { deviceName } from "../utils/device";

function when(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

/**
 * Shows the account's active devices (with the ability to sign any of them out
 * from the server) and its recent sign-in attempts. Reuses the shared dialog
 * styling so it fits the rest of the app.
 */
export default function AccountActivityDialog({ onClose }) {
  const [sessions, setSessions] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [s, h] = await Promise.all([getSessions(), getLoginHistory()]);
      setSessions(s);
      setHistory(h);
    } catch (failure) {
      setError(failure.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape" && !busy) onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function signOutDevice(handle) {
    setBusy(true);
    try {
      await endSession(handle);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOutOthers() {
    setBusy(true);
    try {
      await revokeOtherSessions();
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const hasOthers = sessions && sessions.some((s) => !s.current);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="activity-title">
        <h2 className="dialog__title" id="activity-title">Account activity</h2>
        {error && <p className="field__error" role="alert">{error}</p>}

        <h3>Your devices</h3>
        {!sessions && !error && <p className="muted">Loading your devices…</p>}
        {sessions && sessions.length === 0 && <p>No active sessions.</p>}
        {sessions && sessions.length > 0 && (
          <ul className="activity-list">
            {sessions.map((s) => (
              <li key={s.handle} className="activity-list__item">
                <span>
                  {deviceName(s.device)}{s.current && <strong> · this device</strong>}
                  <br />
                  <small className="muted">Signed in {when(s.createdAt)}</small>
                </span>
                {!s.current && (
                  <button type="button" className="btn btn--secondary" disabled={busy}
                    onClick={() => signOutDevice(s.handle)}>Sign out</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {hasOthers && (
          <button type="button" className="btn btn--secondary" disabled={busy} onClick={signOutOthers}>
            Sign out all other devices
          </button>
        )}

        <h3>Recent sign-in activity</h3>
        {!history && !error && <p className="muted">Loading…</p>}
        {history && history.length === 0 && <p>No sign-ins recorded yet.</p>}
        {history && history.length > 0 && (
          <ul className="activity-list">
            {history.map((event, index) => (
              <li key={index} className="activity-list__item">
                <span>
                  {event.outcome === "SUCCESS" ? "Successful sign-in" : "Failed sign-in attempt"}
                  <br />
                  <small className="muted">
                    {when(event.at)} · {deviceName(event.device)}{event.ipAddress ? ` · ${event.ipAddress}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="dialog__actions">
          <button type="button" className="btn btn--primary" onClick={onClose} disabled={busy}>Close</button>
        </div>
      </div>
    </div>
  );
}
