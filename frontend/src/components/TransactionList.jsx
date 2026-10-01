import { useEffect, useState } from "react";
import { listTransactions, updateTransaction } from "../api";

const CATEGORIES = [
  "GROCERIES", "DINING", "RENT_MORTGAGE", "UTILITIES", "SUBSCRIPTIONS",
  "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION",
  "TRAVEL", "INCOME", "TRANSFER", "OTHER",
];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

/**
 * A plain list of every transaction on file for the user - the
 * "receipts" view behind the dashboard's summary numbers. Also where a
 * user fixes a transaction AutoCategorizer guessed wrong: the category
 * cell is an editable dropdown rather than a label, since that's the
 * single most common correction (an unusual merchant name landing in
 * OTHER, or a keyword match that doesn't fit).
 */
function TransactionList({ refreshKey }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    listTransactions()
      .then(setTransactions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  async function handleCategoryChange(transaction, newCategory) {
    setSavingId(transaction.id);
    try {
      const updated = await updateTransaction(transaction.id, {
        ...transaction,
        category: newCategory,
      });
      setTransactions((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  return (
    <section className="card">
      <h2>All transactions</h2>
      <p className="muted">
        Category guessed wrong? Pick the right one from the dropdown — it
        saves immediately and updates your dashboard.
      </p>

      {loading && <p className="muted">Loading...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && sorted.length === 0 && (
        <p className="muted">
          Nothing here yet — upload a statement to see transactions appear.
        </p>
      )}

      {!loading && sorted.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th className="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td>
                  <select
                    value={t.category ?? "OTHER"}
                    disabled={savingId === t.id}
                    onChange={(e) => handleCategoryChange(t, e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`badge ${t.type.toLowerCase()}`}>
                    {t.type}
                  </span>
                </td>
                <td className="amount-col">{formatCurrency(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default TransactionList;
