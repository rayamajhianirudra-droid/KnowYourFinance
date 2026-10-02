import { useRef, useState } from "react";
import { uploadStatement } from "../api";
import { formatCurrency } from "../utils/format";
import { UploadIcon, FileIcon, LockIcon, CheckCircleIcon, AlertIcon } from "./Icons";

// STAGES this component moves through:
//   idle        - waiting for a file
//   previewing  - the preview (dry-run) request is in flight
//   preview     - showing what an import would do, waiting for confirm
//   saving      - the real (persisting) request is in flight
//   done        - imported, summary shown
//   error       - something failed at any stage
function summarize(response) {
  const transactions = response.transactions || [];
  const dates = transactions.map((t) => t.date).sort();
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    count: response.transactionsSaved,
    dateRange: dates.length > 0 ? `${dates[0]} – ${dates[dates.length - 1]}` : "—",
    totalIncome,
    totalExpenses,
    rowsRedacted: response.rowsRedacted,
    duplicatesSkipped: response.duplicatesSkipped,
    rowsSkipped: response.rowsSkipped,
  };
}

/**
 * This component IS the alternative to "link your bank account" -
 * instead of OAuth-ing into a bank's login, the user drops a CSV
 * export here and we parse it ourselves. Nothing is saved until the
 * user reviews a preview and confirms it: the backend's upload
 * endpoint supports a `preview` mode that runs the full parse/redact/
 * categorize pipeline without persisting, so what's shown here is
 * exactly what would be saved, not a guess.
 */
function UploadStatement({ onImported }) {
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(selected) {
    if (!selected) return;
    setFile(selected);
    setError(null);
    setStage("previewing");
    try {
      const response = await uploadStatement(selected, { preview: true });
      setPreview(summarize(response));
      setStage("preview");
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  }

  async function handleConfirm() {
    setStage("saving");
    setError(null);
    try {
      const response = await uploadStatement(file, { preview: false });
      setPreview(summarize(response));
      setStage("done");
      onImported?.();
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  }

  function handleCancel() {
    setFile(null);
    setPreview(null);
    setStage("idle");
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    handleFile(dropped);
  }

  const busy = stage === "previewing" || stage === "saving";

  return (
    <div className="page">
      <h1 className="page-title">Upload Statement</h1>
      <p className="page-subtitle">
        Export a CSV from your bank's website and drop it here - we read it,
        remove anything that looks like an account or routing number, and
        turn the rest into categorized transactions.
      </p>

      <p className="trust-note">
        <LockIcon width={15} height={15} aria-hidden="true" />
        You don't need to connect your bank account. We only ever read the
        file you choose to upload.
      </p>

      {(stage === "idle" || stage === "error") && (
        <>
          <div
            className={`dropzone${isDragging ? " dropzone--active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
          >
            <div className="dropzone__icon" aria-hidden="true">
              <UploadIcon width={26} height={26} />
            </div>
            <p className="dropzone__title">Upload bank statement</p>
            <p className="dropzone__hint">Drop your statement here, or browse files.</p>
            <p className="dropzone__formats">Supported format: CSV</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {stage === "error" && (
            <p className="error">
              <AlertIcon width={16} height={16} aria-hidden="true" /> {error}
            </p>
          )}
        </>
      )}

      {busy && (
        <div className="panel upload-status">
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
          <p className="muted">
            {stage === "previewing" ? "Reading your statement..." : "Saving your transactions..."}
          </p>
        </div>
      )}

      {stage === "preview" && preview && (
        <div className="panel upload-result">
          <div className="upload-result__file">
            <FileIcon width={18} height={18} aria-hidden="true" />
            <span>{file?.name}</span>
          </div>

          <h2 className="panel-title">Review before saving</h2>
          <p className="muted">Nothing has been saved yet - check this looks right first.</p>

          <dl className="summary-grid">
            <div>
              <dt>Transactions detected</dt>
              <dd>{preview.count}</dd>
            </div>
            <div>
              <dt>Date range detected</dt>
              <dd>{preview.dateRange}</dd>
            </div>
            <div>
              <dt>Total income detected</dt>
              <dd className="amount amount--income">{formatCurrency(preview.totalIncome)}</dd>
            </div>
            <div>
              <dt>Total expenses detected</dt>
              <dd className="amount amount--expense">{formatCurrency(preview.totalExpenses)}</dd>
            </div>
          </dl>

          <ul className="upload-notes">
            {preview.rowsRedacted > 0 && (
              <li>{preview.rowsRedacted} line{preview.rowsRedacted === 1 ? "" : "s"} had sensitive numbers automatically redacted.</li>
            )}
            {preview.duplicatesSkipped > 0 && (
              <li>{preview.duplicatesSkipped} row{preview.duplicatesSkipped === 1 ? "" : "s"} already in your account will be skipped.</li>
            )}
            {preview.rowsSkipped > 0 && (
              <li>{preview.rowsSkipped} row{preview.rowsSkipped === 1 ? "" : "s"} couldn't be read and will be skipped.</li>
            )}
          </ul>

          <div className="upload-result__actions">
            <button type="button" className="btn btn--primary" onClick={handleConfirm}>
              Confirm &amp; save
            </button>
            <button type="button" className="btn btn--secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === "done" && preview && (
        <div className="panel upload-result upload-result--done">
          <div className="success-badge">
            <CheckCircleIcon width={18} height={18} aria-hidden="true" />
            Statement imported
          </div>
          <p>
            <strong>{preview.count}</strong> transaction{preview.count === 1 ? "" : "s"} added,
            covering {preview.dateRange}.
          </p>
          <button type="button" className="btn btn--secondary" onClick={handleCancel}>
            Upload another statement
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadStatement;
