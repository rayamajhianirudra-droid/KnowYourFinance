import { useEffect, useState } from "react";
import { changePassword, deleteAccount, getProfile, listGoals, listRules, listTransactions, newRecoveryCode } from "../api";
import RecoveryCode from "./RecoveryCode";
import { downloadTransactionsCsv } from "../utils/csvExport";
import { buildExport, downloadJson } from "../utils/exportData";

/**
 * Where the person's data lives, how to take a copy of it, and how to
 * delete the whole account. Deleting asks for the password again.
 */
export default function YourData({ email, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [section, setSection] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [freshCode, setFreshCode] = useState(null);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function downloadEverything() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const [transactions, goals, rules, profile] = await Promise.all([
        listTransactions(),
        listGoals().catch(() => []),
        listRules().catch(() => []),
        getProfile().catch(() => null),
      ]);
      const day = new Date().toLocaleDateString("en-CA");
      downloadJson(`know-your-finance-${day}.json`, buildExport({ email, transactions, goals, rules, profile }));
      setMessage("Your data was downloaded as a JSON file.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadSpreadsheet() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      downloadTransactionsCsv(await listTransactions());
      setMessage("Your transactions were downloaded as a spreadsheet file.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setSection(null);
      setMessage("Your password was changed.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleNewCode(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await newRecoveryCode(currentPassword);
      setCurrentPassword("");
      setFreshCode(result.recoveryCode);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog your-data" role="dialog" aria-modal="true" aria-labelledby="your-data-title">
        <h2 id="your-data-title">Your data</h2>
        <p>
          Everything you add is stored in the database on the computer that runs this app. It is not sent to your
          bank or to any other service. Receipt photos are read on this device and are never uploaded, and only the
          lines you confirm are saved.
        </p>

        <div className="your-data__actions">
          <button type="button" className="btn btn--secondary" onClick={downloadEverything} disabled={busy}>
            Download all my data
          </button>
          <button type="button" className="btn btn--secondary" onClick={downloadSpreadsheet} disabled={busy}>
            Download transactions as a spreadsheet
          </button>
        </div>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}

        <hr />
        <h3>Password and recovery</h3>
        {freshCode ? (
          <RecoveryCode email={email} code={freshCode} doneLabel="Done"
            onDone={() => { setFreshCode(null); setSection(null); setMessage("Your new recovery code is active. The old one no longer works."); }} />
        ) : section === "password" ? (
          <form onSubmit={handleChangePassword} className="your-data__delete">
            <label htmlFor="current-password">Current password</label>
            <input id="current-password" type="password" autoComplete="current-password" maxLength={72} required
              value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required
              value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <small>Use at least 12 characters, up to 72 bytes.</small>
            <div className="your-data__actions">
              <button type="submit" className="btn btn--primary" disabled={busy}>Change password</button>
              <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => setSection(null)}>Cancel</button>
            </div>
          </form>
        ) : section === "code" ? (
          <form onSubmit={handleNewCode} className="your-data__delete">
            <p>A new code replaces the old one, which will stop working. Enter your password to continue.</p>
            <label htmlFor="code-password">Password</label>
            <input id="code-password" type="password" autoComplete="current-password" maxLength={72} required
              value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <div className="your-data__actions">
              <button type="submit" className="btn btn--primary" disabled={busy}>Make a new recovery code</button>
              <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => setSection(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="your-data__actions">
            <button type="button" className="btn btn--secondary" onClick={() => { setError(null); setMessage(null); setSection("password"); }}>
              Change my password
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => { setError(null); setMessage(null); setSection("code"); }}>
              Get a new recovery code
            </button>
          </div>
        )}

        <hr />
        {!confirming ? (
          <>
            <h3>Delete my account</h3>
            <p>This removes your login and every transaction, budget, goal and rule. It cannot be undone.</p>
            <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)} disabled={busy}>
              Delete my account
            </button>
          </>
        ) : (
          <form onSubmit={handleDelete} className="your-data__delete">
            <label htmlFor="delete-account-password">Enter your password to confirm</label>
            <input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <div className="your-data__actions">
              <button type="submit" className="btn btn--danger" disabled={busy || password.length === 0}>
                {busy ? "Deleting..." : "Permanently delete my account"}
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Keep my account
              </button>
            </div>
          </form>
        )}

        <div className="your-data__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>Close</button>
        </div>
      </div>
    </div>
  );
}
