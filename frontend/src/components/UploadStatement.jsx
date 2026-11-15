import PageHero from "./PageHero";
import { useRef, useState } from "react";
import { uploadStatements, MAX_UPLOAD_FILES, ACCEPTED_EXTENSIONS } from "../api";
import { formatCurrency } from "../utils/format";
import { summarizeBatch } from "../utils/uploadSummary";
import { UploadIcon, LockIcon, CheckCircleIcon, AlertIcon } from "./Icons";

// STAGES this component moves through:
//   idle        - waiting for files
//   previewing  - the preview (dry-run) request is in flight
//   preview     - showing what an import would do, waiting for confirm
//   saving      - the real (persisting) request is in flight
//   done        - imported, summary shown
//   error       - the whole request failed (for example too many files)
//
// A single file in the batch can also fail on its own (wrong type, empty,
// damaged). That shows up as a failed row in the list, and the other files
// carry on.

const FORMATS_TEXT = "CSV, TSV, TXT or Excel (.xlsx)";

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The list of files with what happened to each one. */
function FileResults({ files, doneLabel }) {
  return (
    <ul className="file-results" aria-label="Results for each file">
      {files.map((f, i) => (
        <li key={`${f.fileName}-${i}`} className={`file-results__item${f.success ? "" : " file-results__item--failed"}`}>
          <div className="file-results__name">
            {f.success ? (
              <CheckCircleIcon width={16} height={16} aria-hidden="true" />
            ) : (
              <AlertIcon width={16} height={16} aria-hidden="true" />
            )}
            <span>{f.fileName}</span>
          </div>
          {f.success && f.alreadyImported ? (
            <p className="file-results__detail">
              Already imported: this file is already on record, so nothing was added and nothing was duplicated.
            </p>
          ) : f.success ? (
            <p className="file-results__detail">
              {doneLabel}: {plural(f.count, "transaction")}, {f.dateRange}
              {f.duplicatesSkipped > 0 && `, ${plural(f.duplicatesSkipped, "duplicate")} skipped`}
              {f.rowsSkipped > 0 && `, ${plural(f.rowsSkipped, "row")} unreadable`}
            </p>
          ) : (
            <p className="file-results__detail" role="alert">{f.message}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * This component IS the alternative to "link your bank account" -
 * instead of OAuth-ing into a bank's login, the user drops statement
 * files here and we parse them ourselves. Up to 12 files can be chosen at
 * once, so a whole year of monthly statements goes in one step. Nothing
 * is saved until the user reviews a preview and confirms it: the backend's
 * upload endpoint supports a `preview` mode that runs the full parse,
 * redact and categorize pipeline without persisting, so what's shown here
 * is exactly what would be saved, not a guess.
 */
function UploadStatement({ onImported }) {
  const [files, setFiles] = useState([]);
  const [stage, setStage] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  async function handleFiles(fileList) {
    const chosen = Array.from(fileList || []);
    if (chosen.length === 0) return;

    const kept = chosen.slice(0, MAX_UPLOAD_FILES);
    setNotice(
      chosen.length > MAX_UPLOAD_FILES
        ? `You chose ${chosen.length} files. Only the first ${MAX_UPLOAD_FILES} were added. Upload the rest in a second round.`
        : null
    );
    setFiles(kept);
    setError(null);
    setStage("previewing");
    try {
      const response = await uploadStatements(kept, { preview: true });
      setPreview(summarizeBatch(response));
      setStage("preview");
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  }

  async function handleConfirm() {
    setStage("saving");
    setError(null);
    // Only send the files the preview could read.
    const readable = new Set(preview.files.filter((f) => f.success).map((f) => f.fileName));
    const toSave = files.filter((f) => readable.has(f.name));
    try {
      const response = await uploadStatements(toSave, { preview: false });
      setPreview(summarizeBatch(response));
      setStage("done");
      onImported?.();
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  }

  function handleCancel() {
    setFiles([]);
    setPreview(null);
    setNotice(null);
    setStage("idle");
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  const busy = stage === "previewing" || stage === "saving";

  return (
    <div className="page">
      <PageHero
        title="Upload Statements"
        subtitle={`Export statements from your bank's website and drop them here, up to ${MAX_UPLOAD_FILES} files at a time. We read them, remove anything that looks like an account or routing number, and turn the rest into categorized transactions.`}
        art
      />

      <p className="trust-note">
        <LockIcon width={15} height={15} aria-hidden="true" />
        You don't need to connect your bank account. We only ever read the
        files you choose to upload.
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
            <p className="dropzone__title">Upload bank statements</p>
            <p className="dropzone__hint">
              Drop up to {MAX_UPLOAD_FILES} files here, or browse files.
            </p>
            <p className="dropzone__formats">Supported formats: {FORMATS_TEXT}</p>
          </div>
          {/* The real file input sits beside the drop area, not inside it,
              because a control nested inside a button confuses screen
              readers. The drop area opens it on click or Enter. */}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="statement-input"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = ""; // lets the same files be chosen again
            }}
          />
          {stage === "error" && (
            <p className="error" role="alert">
              <AlertIcon width={16} height={16} aria-hidden="true" /> {error}
            </p>
          )}
        </>
      )}

      {(stage === "idle" || stage === "error") && (
        <section className="upload-help" aria-label="How the upload works">
          <div className="upload-help__item">
            <h2>What to upload</h2>
            <p>
              Files in {FORMATS_TEXT} with a date, a description and an amount for each row.
              Choose up to {MAX_UPLOAD_FILES} at once, each up to 10 MB.
            </p>
          </div>
          <div className="upload-help__item">
            <h2>What we remove</h2>
            <p>Long account or routing style numbers are replaced with a placeholder before anything is saved.</p>
          </div>
          <div className="upload-help__item">
            <h2>What happens next</h2>
            <p>You see a preview first. Rows already on file are skipped, so uploading twice never doubles your totals.</p>
          </div>
        </section>
      )}

      {busy && (
        <div className="panel upload-status">
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
          <p className="muted" role="status">
            {stage === "previewing"
              ? `Reading ${plural(files.length, "statement")}...`
              : "Saving your transactions..."}
          </p>
        </div>
      )}

      {stage === "preview" && preview && (
        <div className="panel upload-result">
          <h2 className="panel-title">Review before saving</h2>
          <p className="muted">Nothing has been saved yet. Check this looks right first.</p>
          {notice && <p className="upload-notice" role="status">{notice}</p>}

          <FileResults files={preview.files} doneLabel="Found" />

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
              <li>{plural(preview.rowsRedacted, "line")} had sensitive numbers automatically redacted.</li>
            )}
            {preview.alreadyImportedCount > 0 && (
              <li>
                {preview.alreadyImportedCount === 1
                  ? "1 file has already been imported, so it will add nothing."
                  : `${preview.alreadyImportedCount} files have already been imported, so they will add nothing.`}
              </li>
            )}
            {preview.duplicatesSkipped > 0 && (
              <li>{plural(preview.duplicatesSkipped, "row")} already in your account will be skipped.</li>
            )}
            {preview.rowsSkipped > 0 && (
              <li>{plural(preview.rowsSkipped, "row")} couldn't be read and will be skipped.</li>
            )}
            {preview.failedCount > 0 && (
              <li>{plural(preview.failedCount, "file")} can't be imported and will be left out.</li>
            )}
            {preview.files.length > 1 && (
              <li>Files that overlap each other are checked for repeated transactions when you save.</li>
            )}
          </ul>

          <div className="upload-result__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleConfirm}
              disabled={preview.okCount === 0 || preview.count === 0}
            >
              Confirm &amp; save {preview.okCount > 1 ? `${preview.okCount} files` : ""}
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
            {preview.count === 0
              ? "Already imported"
              : preview.okCount === 1 ? "Statement imported" : "Statements imported"}
          </div>
          {preview.count === 0 ? (
            <p>These statements are already on record. Nothing was added, so your data is unchanged.</p>
          ) : (
            <p>
              <strong>{preview.count}</strong> transaction{preview.count === 1 ? "" : "s"} added
              from {plural(preview.okCount, "file")}, covering {preview.dateRange}.
            </p>
          )}
          <FileResults files={preview.files} doneLabel="Added" />
          <button type="button" className="btn btn--secondary" onClick={handleCancel}>
            Upload more statements
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadStatement;
