import { useState } from "react";
import { uploadStatement } from "../api";

/**
 * This component IS the alternative to "link your bank account."
 * Instead of OAuth-ing into Plaid or a bank's login, the user picks a
 * CSV export of their statement from their own computer and we parse
 * it ourselves (see backend build-log 02 for the full pipeline this
 * hits: parse -> redact -> categorize -> save).
 */
function UploadStatement({ onImported }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setError(null);
    try {
      const response = await uploadStatement(file);
      setResult(response);
      setStatus("done");
      onImported?.(); // let the parent (App) know new data exists,
      // so e.g. the dashboard can refetch
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <section className="card">
      <h2>Upload a bank statement</h2>
      <p className="muted">
        We never ask for your bank login or account/routing numbers. Export
        a CSV statement from your bank's website and upload it here — we
        read it, automatically strip out anything that looks like an
        account or routing number, and turn the rest into categorized
        transactions.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || status === "uploading"}>
          {status === "uploading" ? "Uploading..." : "Upload statement"}
        </button>
      </form>

      {status === "error" && <p className="error">{error}</p>}

      {status === "done" && result && (
        <div className="result">
          <p>
            Imported <strong>{result.transactionsSaved}</strong> of{" "}
            {result.rowsParsed} rows.
            {result.rowsRedacted > 0 && (
              <>
                {" "}
                <strong>{result.rowsRedacted}</strong> line
                {result.rowsRedacted === 1 ? "" : "s"} had sensitive numbers
                automatically redacted.
              </>
            )}
            {result.duplicatesSkipped > 0 && (
              <>
                {" "}
                <strong>{result.duplicatesSkipped}</strong> row
                {result.duplicatesSkipped === 1 ? "" : "s"} skipped as
                duplicates already in your account.
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

export default UploadStatement;
