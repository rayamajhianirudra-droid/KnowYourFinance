import { useEffect, useState } from "react";
import { getMonthlyReport } from "../api";
import { formatCurrency } from "../utils/format";
import TrendsChart from "./TrendsChart";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The month/year income-vs-expense report - KYF's main differentiator
 * versus apps like Rocket Money. The user picks any month and year
 * (not just "the current month"), and sees exactly what came in, what
 * went out, and where the spending went by category - plus a short
 * list of auto-generated "Smart insights" sentences built by comparing
 * this month to last month (see backend InsightsService), and a
 * trailing multi-month trend chart below it.
 */
function Dashboard({ refreshKey }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // JS months are 0-indexed; ours aren't
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getMonthlyReport(year, month)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // cleanup guards against a slow earlier request overwriting a
    // newer one's result if the user changes month/year quickly
    return () => {
      cancelled = true;
    };
  }, [year, month, refreshKey]);

  return (
    <>
      <section className="card">
        <h2>Monthly report</h2>

        <div className="controls">
          <label>
            Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
        </div>

        {loading && <p className="muted">Loading...</p>}
        {error && <p className="error">{error}</p>}

        {report && !loading && (
          <>
            {report.insights.length > 0 && (
              <ul className="insights-list">
                {report.insights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            )}

            <div className="stat-grid">
              <div className="stat">
                <span className="stat-label">Income</span>
                <span className="stat-value income">
                  {formatCurrency(report.totalIncome)}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Expenses</span>
                <span className="stat-value expense">
                  {formatCurrency(report.totalExpenses)}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Net savings</span>
                <span
                  className={`stat-value ${
                    Number(report.netSavings) >= 0 ? "income" : "expense"
                  }`}
                >
                  {formatCurrency(report.netSavings)}
                </span>
              </div>
            </div>

            <h3>Spending by category</h3>
            {report.categoryBreakdown.length === 0 ? (
              <p className="muted">No expenses recorded for this period.</p>
            ) : (
              <ul className="category-list">
                {report.categoryBreakdown
                  .slice()
                  .sort((a, b) => Number(b.total) - Number(a.total))
                  .map((item) => (
                    <li key={item.category}>
                      <span>{item.category.replaceAll("_", " ")}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </section>

      <TrendsChart refreshKey={refreshKey} />
    </>
  );
}

export default Dashboard;
