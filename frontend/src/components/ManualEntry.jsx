import { useState } from "react";
import { addTransaction } from "../api";
import { categoryLabel } from "../utils/format";
import { IncomeIcon, ExpenseIcon, CheckCircleIcon, AlertIcon } from "./Icons";

const CATEGORIES = [
  "GROCERIES", "DINING", "RENT_MORTGAGE", "UTILITIES", "SUBSCRIPTIONS",
  "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION",
  "TRAVEL", "INCOME", "TRANSFER", "OTHER",
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Manual transaction entry - how someone who pays with cash (or just
 * wants to log one thing by hand) still gets an accurate dashboard. A
 * bank statement only ever shows what went THROUGH the bank; cash
 * spending never appears on one, so without this form, cash users
 * would have no way to get a correct "what did I actually spend this
 * month" number. This hits the exact same Transaction table statement
 * uploads do - no separate "cash mode," no different math downstream.
 */
function ManualEntry({ onAdded }) {
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
    setStatus("saving");
    setError(null);
    setFieldErrors({});
    try {
      await addTransaction({ date, description, amount, type, category });
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
      <h1 className="page-title">Add Transaction</h1>
      <p className="page-subtitle">
        Paid cash, or missed something your statement wouldn't catch? Log it
        here and it counts toward your totals and category breakdown exactly
        like an imported transaction.
      </p>

      <form className="panel entry-form" onSubmit={handleSubmit} noValidate>
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
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.amount)}
            />
          </div>
          {fieldErrors.amount && <span className="field__error">{fieldErrors.amount}</span>}
        </label>

        <label className="field">
          <span className="field__label">What was it?</span>
          <input
            type="text"
            placeholder="e.g. Farmers market produce"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.description)}
          />
          {fieldErrors.description && <span className="field__error">{fieldErrors.description}</span>}
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              aria-invalid={Boolean(fieldErrors.date)}
            />
            {fieldErrors.date && <span className="field__error">{fieldErrors.date}</span>}
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
          <p className="error">
            <AlertIcon width={16} height={16} aria-hidden="true" /> {error}
          </p>
        )}
        {status === "done" && (
          <p className="success-note">
            <CheckCircleIcon width={16} height={16} aria-hidden="true" /> Transaction added.
          </p>
        )}
      </form>
    </div>
  );
}

export default ManualEntry;
