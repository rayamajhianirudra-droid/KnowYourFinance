import { useEffect, useState } from "react";
import { listTransactions } from "../api";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

/**
 * A plain list of every transaction on file for the user - the
 * "receipts" view behind the dashboard's summary numbers. Useful both
 * as a sanity check (does this match what I actually uploaded?) and as
 * a place to eventually add manual entry/editing.
 */
function TransactionList({ refreshKey }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    listTransactions()
      .then(setTransactions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  return (
    <section className="card">
      <h2>All transactions</h2>

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
                <td>{t.category ? t.category.replaceAll("_", " ") : "—"}</td>
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
