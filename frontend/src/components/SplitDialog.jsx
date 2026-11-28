import { useEffect, useMemo, useRef, useState } from "react";
import { splitTransaction } from "../api";
import { CATEGORIES, categoryLabel, formatCurrency } from "../utils/format";
import { fromCents, remainingCents, splitIsValid, toCents, toSplitParts } from "../utils/split";
import { PlusIcon, XIcon } from "./Icons";

const MAX_LINES = 20;

function emptyLine(category) {
  return { label: "", category, amount: "" };
}

/**
 * Lets a person divide one charge into several category lines, for a
 * receipt that holds more than one kind of purchase (food and a TV from
 * the same Walmart trip). The lines have to add up to the charge, so the
 * dashboard totals never drift.
 */
function SplitDialog({ transaction, onClose, onSplit }) {
  const totalCents = toCents(String(transaction.amount)) ?? Math.round(Number(transaction.amount) * 100);
  const [lines, setLines] = useState(() => [
    emptyLine(transaction.category ?? "OTHER"),
    emptyLine("SHOPPING"),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const firstRef = useRef(null);

  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const remaining = useMemo(() => remainingCents(totalCents, lines), [totalCents, lines]);
  const valid = splitIsValid(totalCents, lines);

  function change(index, field, value) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function putRestOnLine(index) {
    const others = lines.filter((_, i) => i !== index);
    const rest = remainingCents(totalCents, others);
    if (rest > 0) change(index, "amount", fromCents(rest));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine("OTHER")]);
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await splitTransaction(transaction.id, toSplitParts(lines));
      onSplit(transaction.id, created);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  let status;
  if (remaining === 0) {
    status = "Every dollar is assigned.";
  } else if (remaining > 0) {
    status = `${formatCurrency(remaining / 100)} left to assign.`;
  } else {
    status = `${formatCurrency(-remaining / 100)} too much. Lower an amount.`;
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-labelledby="split-title">
        <h2 className="dialog__title" id="split-title">Split this receipt</h2>
        <p className="split__summary">
          <strong>{transaction.description}</strong> on {transaction.date} for{" "}
          <strong>{formatCurrency(transaction.amount)}</strong>. Give each kind of purchase its own category.
        </p>

        <form onSubmit={handleSave}>
          <ul className="split__lines">
            {lines.map((line, index) => (
              <li className="split__line" key={index}>
                <input
                  ref={index === 0 ? firstRef : null}
                  type="text"
                  className="split__label"
                  placeholder="What was it? (optional)"
                  value={line.label}
                  onChange={(e) => change(index, "label", e.target.value)}
                  aria-label={`Line ${index + 1} label`}
                  maxLength={60}
                />
                <select
                  className="category-select"
                  value={line.category}
                  onChange={(e) => change(index, "category", e.target.value)}
                  aria-label={`Line ${index + 1} category`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{categoryLabel(c)}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  className="split__amount"
                  placeholder="0.00"
                  value={line.amount}
                  onChange={(e) => change(index, "amount", e.target.value)}
                  aria-label={`Line ${index + 1} amount`}
                />
                <button
                  type="button"
                  className="btn btn--text split__rest"
                  onClick={() => putRestOnLine(index)}
                  disabled={remainingCents(totalCents, lines.filter((_, i) => i !== index)) <= 0}
                  aria-label={`Put the rest on line ${index + 1}`}
                  title="Put whatever is left on this line"
                >
                  Rest
                </button>
                {lines.length > 2 ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeLine(index)}
                    aria-label={`Remove line ${index + 1}`}
                    title="Remove line"
                  >
                    <XIcon width={16} height={16} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="split__spacer" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn--text split__add"
            onClick={addLine}
            disabled={lines.length >= MAX_LINES}
          >
            <PlusIcon width={15} height={15} aria-hidden="true" /> Add another line
          </button>

          <p
            className={`split__status${remaining === 0 ? " split__status--ok" : remaining < 0 ? " split__status--over" : ""}`}
            role="status"
          >
            {status}
          </p>

          {error && <p className="error" role="alert">{error}</p>}

          <div className="dialog__actions">
            <button type="submit" className="btn btn--primary" disabled={!valid || busy}>
              {busy ? "Saving..." : "Save split"}
            </button>
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SplitDialog;
