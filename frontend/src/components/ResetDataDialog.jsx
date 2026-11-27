import { useEffect, useRef, useState } from "react";
import { getDataSummary, listTransactions, resetData } from "../api";
import { downloadTransactionsCsv } from "../utils/csvExport";

const CONFIRM_WORD = "DELETE";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * A confirmation screen for wiping everything the person has stored so they
 * can start again. It says exactly what will go, offers a CSV backup first,
 * and only enables the delete button once DELETE has been typed.
 */
function ResetDataDialog({ onClose, onDeleted, onUpload, hasName }) {
  const [summary, setSummary] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [typed, setTyped] = useState("");
  const [includeName, setIncludeName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getDataSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (summary && inputRef.current) inputRef.current.focus();
  }, [summary]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const hasData = summary && (summary.transactions > 0 || summary.budgets > 0 || summary.goals > 0 || summary.subscriptionReviews > 0);
  const canDelete = typed === CONFIRM_WORD && !busy && Boolean(hasData);

  async function handleBackup() {
    setError(null);
    try {
      downloadTransactionsCsv(await listTransactions());
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(e) {
    e.preventDefault();
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resetData({ includeName });
      setDone(true);
      onDeleted(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <h2 className="dialog__title" id="reset-title">Delete all my data</h2>

        {done ? (
          <>
            <p>Your data has been removed. You can upload a fresh statement whenever you are ready.</p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={onUpload}>Upload a statement</button>
              <button type="button" className="btn btn--secondary" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleDelete}>
            {loadError && <p className="field__error" role="alert">{loadError}</p>}
            {!summary && !loadError && <p className="muted">Checking what you have saved...</p>}

            {summary && !hasData && (
              <p>You have no transactions or budgets saved, so there is nothing to delete.</p>
            )}

            {hasData && (
              <>
                <p>
                  This permanently removes {plural(summary.transactions, "transaction")} and{" "}
                  {plural(summary.budgets, "budget")}.
                  {summary.goals > 0 && ` It also removes ${plural(summary.goals, "savings goal")}.`}
                  {summary.subscriptionReviews > 0 && ` It also removes ${plural(summary.subscriptionReviews, "subscription review")}.`}
                  {" "}It cannot be undone.
                </p>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleBackup}
                  disabled={summary.transactions === 0}
                >
                  Download a CSV backup first
                </button>

                {hasName && (
                  <label className="dialog__check">
                    <input
                      type="checkbox"
                      checked={includeName}
                      onChange={(e) => setIncludeName(e.target.checked)}
                    />
                    {" "}Also remove my saved name
                  </label>
                )}

                <label className="field">
                  <span className="field__label">Type {CONFIRM_WORD} to confirm</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={typed}
                    autoComplete="off"
                    onChange={(e) => setTyped(e.target.value)}
                  />
                </label>
              </>
            )}

            {error && <p className="field__error" role="alert">{error}</p>}

            <div className="dialog__actions">
              {hasData && (
                <button type="submit" className="btn btn--danger" disabled={!canDelete}>
                  {busy ? "Deleting..." : "Delete everything"}
                </button>
              )}
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

export default ResetDataDialog;
