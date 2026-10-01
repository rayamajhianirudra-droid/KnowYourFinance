import { useState } from "react";
import { addTransaction } from "../api";

const CATEGORIES = [
  "GROCERIES", "DINING", "RENT_MORTGAGE", "UTILITIES", "SUBSCRIPTIONS",
  "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION",
  "TRAVEL", "INCOME", "TRANSFER", "OTHER",
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Manual transaction entry - this is how someone who pays with cash
 * (or just wants to log one thing by hand) still gets to use the
 * app's dashboard and reporting, even though there's no statement to
 * upload for a cash purchase. A bank statement only ever shows what
 * went THROUGH the bank; cash spending never appears on one, so if
 * this form didn't exist, cash users would have no way to get an
 * accurate "what did I actually spend this month" number.
 *
 * This hits the exact same Transaction table and the exact same
 * dashboard math as statement-uploaded transactions - there's no
 * separate "cash mode." A manually entered coffee and a
 * statement-parsed coffee are indistinguishable once saved, which is
 * what makes the month/year report accurate regardless of how someone
 * pays.
 */
function ManualEntry({ onAdded }) {
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("EXPENSE");
  const [category, setCategory] = useState("OTHER");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await addTransaction({ date, description, amount, type, category });
      setStatus("done");
      setDescription("");
      setAmount("");
      onAdded?.();
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <section className="card">
      <h2>Add a transaction by hand</h2>
      <p className="muted">
        Paid cash? Cash purchases never show up on a bank statement, so this
        is how they still count toward your totals and category breakdown.
      </p>

      <form className="manual-form" onSubmit={handleSubmit}>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        <label>
          What was it?
          <input
            type="text"
            placeholder="e.g. Farmers market produce"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>

        <label>
          Amount
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>

        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="EXPENSE">Expense (money out)</option>
            <option value="INCOME">Income (money in)</option>
          </select>
        </label>

        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Add transaction"}
        </button>
      </form>

      {status === "error" && <p className="error">{error}</p>}
      {status === "done" && <p className="result">Added.</p>}
    </section>
  );
}

export default ManualEntry;
