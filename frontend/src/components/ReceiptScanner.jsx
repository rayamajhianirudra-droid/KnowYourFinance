import { useEffect, useMemo, useRef, useState } from "react";
import { addTransaction, splitTransaction, updateTransaction } from "../api";
import { readReceiptText } from "../utils/ocr";
import { buildLines, findMatches, parseReceipt, toNumber } from "../utils/receipt";
import { itemCategorizer } from "../utils/itemCategory";
import { CATEGORIES, categoryLabel, formatCurrency } from "../utils/format";
import { fromCents, remainingCents, toCents, toSplitParts } from "../utils/split";
import { PlusIcon, XIcon } from "./Icons";

/**
 * Reads a photo of a receipt and turns it into category lines. The photo
 * is read on this device and is never uploaded or stored. Because reading
 * text from a photo is never perfect, the person always checks the items
 * on the review screen before anything is saved.
 *
 * If the receipt total matches a charge already on file (the Walmart
 * charge from the bank statement), the items split that charge. Otherwise
 * the receipt is added as a new purchase.
 */
function ReceiptScanner({ transactions, onClose, onSaved }) {
  const [step, setStep] = useState("pick");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [lines, setLines] = useState([]);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const createdId = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy && step !== "reading") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, step, onClose]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setProgress(0);
    setStep("reading");
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const text = await readReceiptText(file, setProgress);
      const parsed = parseReceipt(text);
      setMerchant(parsed.merchant);
      setDate(parsed.date);
      setTotal(parsed.total === null ? "" : parsed.total.toFixed(2));
      setLines(buildLines(parsed, itemCategorizer(parsed.merchant)));
      setStep("review");
    } catch (err) {
      setError(err.message || "The receipt could not be read. Try a clearer photo.");
      setStep("pick");
    }
  }

  const totalCents = toCents(total);
  const remaining = totalCents === null ? null : remainingCents(totalCents, lines);
  const matches = useMemo(
    () => findMatches(transactions, { totalCents, date, merchant }),
    [transactions, totalCents, date, merchant]
  );
  const attachId = choice === "new" ? "new" : matches.find((m) => m.id === choice)?.id ?? matches[0]?.id ?? "new";

  const linesValid =
    lines.length > 0 && lines.every((l) => (toCents(l.amount) ?? 0) > 0 && l.category);
  const canSave =
    step === "review" && !busy && linesValid && totalCents > 0 && remaining === 0 &&
    Boolean(date) && (attachId !== "new" || merchant.trim().length > 0);

  function change(index, field, value) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value, guessed: field === "category" ? false : l.guessed } : l)));
  }

  async function handleSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const parts = toSplitParts(lines);
      let message;
      if (attachId !== "new") {
        const target = matches.find((m) => m.id === attachId);
        if (parts.length > 1) {
          await splitTransaction(target.id, parts);
        } else {
          await updateTransaction(target.id, { ...target, category: parts[0].category });
        }
        message = `Receipt added to ${target.description}.`;
      } else {
        if (createdId.current === null) {
          const created = await addTransaction({
            date,
            description: merchant.trim(),
            amount: fromCents(totalCents),
            type: "EXPENSE",
            category: parts[0].category,
          });
          createdId.current = created.id;
        }
        if (parts.length > 1) {
          await splitTransaction(createdId.current, parts);
        }
        message = `Receipt from ${merchant.trim()} added.`;
      }
      onSaved(message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  let status = "";
  if (remaining !== null) {
    if (remaining === 0) status = "Every dollar is assigned.";
    else if (remaining > 0) status = `${formatCurrency(remaining / 100)} left to assign. Add a line or change the total.`;
    else status = `${formatCurrency(-remaining / 100)} too much. Lower an amount or raise the total.`;
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && step !== "reading" && onClose()}>
      <div className="dialog dialog--wide dialog--receipt" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <h2 className="dialog__title" id="receipt-title">Scan a receipt</h2>

        {step === "pick" && (
          <>
            <p>
              Take or choose a photo of a receipt. It is read on this device and the photo is never uploaded or saved.
              You will check every item before anything is stored.
            </p>
            <p className="muted">Works best on a flat, well lit, straight-on photo of a printed receipt.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="receipt__file"
              onChange={handleFile}
              aria-label="Receipt photo"
            />
            {error && <p className="error" role="alert">{error}</p>}
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={() => fileRef.current?.click()}>
                Choose a photo
              </button>
              <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {step === "reading" && (
          <div role="status" aria-live="polite">
            <p>Reading your receipt... {Math.round(progress * 100)}%</p>
            <div className="receipt__bar" aria-hidden="true">
              <div className="receipt__bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="muted">The first scan takes longer while the reader starts up.</p>
          </div>
        )}

        {step === "review" && (
          <div className="receipt__review">
            {previewUrl && (
              <img className="receipt__preview" src={previewUrl} alt="Your receipt photo" />
            )}
            <div className="receipt__form">
              <p className="muted receipt__hint">
                Check this against your photo. Fix anything that was misread.
              </p>
              <div className="receipt__fields">
                <label>
                  <span className="filter-field__label">Store</span>
                  <input type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} aria-label="Store" />
                </label>
                <label>
                  <span className="filter-field__label">Date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Receipt date" />
                </label>
                <label>
                  <span className="filter-field__label">Total</span>
                  <input
                    type="number" step="0.01" min="0.01" value={total}
                    onChange={(e) => setTotal(e.target.value)} aria-label="Receipt total"
                  />
                </label>
              </div>

              {lines.length === 0 && (
                <p className="muted">No items were found. Add them by hand below, or go back and try a clearer photo.</p>
              )}

              <ul className="split__lines">
                {lines.map((line, index) => (
                  <li className="receipt__line" key={index}>
                    <input
                      type="text" value={line.label} maxLength={60}
                      onChange={(e) => change(index, "label", e.target.value)}
                      aria-label={`Item ${index + 1} name`}
                    />
                    <select
                      className="category-select" value={line.category}
                      onChange={(e) => change(index, "category", e.target.value)}
                      aria-label={`Item ${index + 1} category`}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{categoryLabel(c)}</option>
                      ))}
                    </select>
                    <input
                      type="number" step="0.01" min="0.01" className="split__amount" value={line.amount}
                      onChange={(e) => change(index, "amount", e.target.value)}
                      aria-label={`Item ${index + 1} amount`}
                    />
                    {line.guessed ? <span className="split-badge" title="Not sure about this one">check</span> : <span />}
                    <button
                      type="button" className="icon-btn"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove item ${index + 1}`} title="Remove item"
                    >
                      <XIcon width={16} height={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button" className="btn btn--text split__add"
                onClick={() => setLines((prev) => [...prev, { label: "", category: "OTHER", guessed: false, amount: "" }])}
              >
                <PlusIcon width={15} height={15} aria-hidden="true" /> Add a line
              </button>

              {status && (
                <p className={`split__status${remaining === 0 ? " split__status--ok" : remaining < 0 ? " split__status--over" : ""}`} role="status">
                  {status}
                </p>
              )}

              <fieldset className="receipt__target">
                <legend>Save to</legend>
                {matches.map((m) => (
                  <label key={m.id} className="receipt__option">
                    <input type="radio" name="receipt-target" checked={attachId === m.id} onChange={() => setChoice(m.id)} />
                    Your {m.description} charge on {m.date} for {formatCurrency(m.amount)}
                  </label>
                ))}
                <label className="receipt__option">
                  <input type="radio" name="receipt-target" checked={attachId === "new"} onChange={() => setChoice("new")} />
                  {matches.length > 0 ? "A new purchase instead" : "A new purchase (no matching charge found)"}
                </label>
              </fieldset>

              {error && <p className="error" role="alert">{error}</p>}
              <div className="dialog__actions">
                <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!canSave}>
                  {busy ? "Saving..." : "Save receipt"}
                </button>
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceiptScanner;
