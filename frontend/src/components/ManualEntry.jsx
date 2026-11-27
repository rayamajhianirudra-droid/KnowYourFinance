import PageHero from "./PageHero";
import { todayInput } from "../utils/dates";
import { useId, useState } from "react";
import { addTransaction } from "../api";
import { categoryLabel } from "../utils/format";
import { initials } from "../utils/names";
import { IncomeIcon, ExpenseIcon, CheckCircleIcon, AlertIcon, ReceiptIcon } from "./Icons";

const CATEGORIES = [
  "GROCERIES", "DINING", "RENT_MORTGAGE", "UTILITIES", "SUBSCRIPTIONS",
  "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION",
  "TRAVEL", "INCOME", "TRANSFER", "OTHER",
];

const today = todayInput;

/**
 * Manual transaction entry - how someone who pays with cash (or just
 * wants to log one thing by hand) still gets an accurate dashboard. A
 * bank statement only ever shows what went THROUGH the bank; cash
 * spending never appears on one, so without this form, cash users
 * would have no way to get a correct "what did I actually spend this
 * month" number. This hits the exact same Transaction table statement
 * uploads do - no separate "cash mode," no different math downstream.
 */
function ManualEntry({ fullName, onAdded, onScanClick }) {
  const fieldId = useId();
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("EXPENSE");
  const [category, setCategory] = useState("OTHER");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const errors = {};
    const amountInput = e.currentTarget.elements.namedItem("amount");
    if (!amount) {
      errors.amount = "Enter an amount.";
    } else if (!Number.isFinite(Number(amount)) || Number(amount) < 0.01) {
      errors.amount = "Enter an amount of at least $0.01.";
    } else if (amountInput.validity.stepMismatch) {
      errors.amount = "Enter an amount in whole cents (for example, 12.50).";
    }
    if (!description.trim()) errors.description = "Describe what this was.";
    if (!date) errors.date = "Choose a date.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Check the highlighted fields.");
      setStatus("error");
      e.currentTarget.elements.namedItem(Object.keys(errors)[0]).focus();
      return;
    }
    setStatus("saving");
    try {
      await addTransaction({ date, description: description.trim(), amount, type, category });
      setStatus("done");
      setDescription("");
      setAmount("");
      onAdded?.();
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setStatus("error");
    }
  }

  return (
    <div className="page">
      <PageHero
        title="Add Transaction"
        subtitle="Paid cash, or missed something your statement wouldn't catch? Log it here and it counts toward your totals and category breakdown exactly like an imported transaction."
      >
        {onScanClick && (
          <div className="page-hero__actions">
            <button type="button" className="btn btn--secondary" onClick={onScanClick}>
              <ReceiptIcon width={16} height={16} aria-hidden="true" />
              Scan a receipt instead
            </button>
          </div>
        )}
      </PageHero>

      <form className="panel entry-form" onSubmit={handleSubmit} noValidate>
        {fullName && (
          <p className="entry-owner">
            <span className="entry-owner__avatar" aria-hidden="true">{initials(fullName)}</span>
            Adding to <strong>{fullName}</strong>'s account
          </p>
        )}
        <div className="type-toggle" role="radiogroup" aria-label="Transaction type">
          <button
            type="button"
            role="radio"
            aria-checked={type === "EXPENSE"}
            className={`type-toggle__btn${type === "EXPENSE" ? " type-toggle__btn--active-expense" : ""}`}
            onClick={() => setType("EXPENSE")}
          >
            <ExpenseIcon width={16} height={16} aria-hidden="true" />
            Expense
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={type === "INCOME"}
            className={`type-toggle__btn${type === "INCOME" ? " type-toggle__btn--active-income" : ""}`}
            onClick={() => setType("INCOME")}
          >
            <IncomeIcon width={16} height={16} aria-hidden="true" />
            Income
          </button>
        </div>

        <label className="field field--amount">
          <span className="field__label">Amount</span>
          <div className="amount-input">
            <span className="amount-input__prefix">$</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.amount)}
              aria-describedby={fieldErrors.amount ? `${fieldId}-amount-error` : undefined}
            />
          </div>
          {fieldErrors.amount && <span id={`${fieldId}-amount-error`} className="field__error">{fieldErrors.amount}</span>}
        </label>

        <label className="field">
          <span className="field__label">What was it?</span>
          <input
            name="description"
            type="text"
            placeholder="e.g. Farmers market produce"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? `${fieldId}-description-error` : undefined}
          />
          {fieldErrors.description && <span id={`${fieldId}-description-error`} className="field__error">{fieldErrors.description}</span>}
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Date</span>
            <input
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.date)}
              aria-describedby={fieldErrors.date ? `${fieldId}-date-error` : undefined}
            />
            {fieldErrors.date && <span id={`${fieldId}-date-error`} className="field__error">{fieldErrors.date}</span>}
          </label>

          <label className="field">
            <span className="field__label">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </label>
        </div>

        <button type="submit" className="btn btn--primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Add transaction"}
        </button>

        {status === "error" && (
          <p className="error" role="alert">
            <AlertIcon width={16} height={16} aria-hidden="true" /> {error}
          </p>
        )}
        {status === "done" && (
          <p className="success-note">
            <CheckCircleIcon width={16} height={16} aria-hidden="true" /> Transaction added{fullName ? ` to ${fullName}'s account` : ""}.
          </p>
        )}
      </form>
    </div>
  );
}

export default ManualEntry;
