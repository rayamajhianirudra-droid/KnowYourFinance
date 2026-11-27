import { useState } from "react";
import { uploadStatements } from "../api";
import { buildSampleFile } from "../utils/sampleData";

/**
 * "Try with sample data": loads three months of made-up transactions
 * through the normal import, so someone can explore a full dashboard in
 * one click. It is only offered when the person has no data yet, so it
 * can never mix pretend rows in with real ones.
 */
function SampleDataButton({ onLoaded }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await uploadStatements([buildSampleFile()], { preview: false });
      const file = response?.files?.[0];
      if (!file?.success) {
        throw new Error(file?.message || "The sample data could not be loaded.");
      }
      if (!file.result?.transactionsSaved) {
        setMessage("The sample data is already loaded.");
      } else {
        onLoaded?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sample-data">
      <button type="button" className="btn btn--secondary" onClick={handleClick} disabled={busy}>
        {busy ? "Loading sample data..." : "Try with sample data"}
      </button>
      <p className="muted sample-data__hint">
        Loads three months of made-up transactions so you can look around. Nothing in it is real, and you can clear it
        any time from your profile menu with Delete all my data.
      </p>
      {message && <p role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export default SampleDataButton;
