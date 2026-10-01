import { useEffect, useState } from "react";
import { getTrends } from "../api";
import { formatCurrency } from "../utils/format";

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * "Spending trends over time" - a second way of looking at the same
 * Transaction data the Monthly report above pulls from, but across
 * several months at once instead of one at a time. Deliberately kept
 * independent of the Monthly report's month/year picker: this always
 * shows the trailing 6 months ending at today, so switching the report
 * to look at an old month doesn't also drag this chart back in time.
 *
 * No charting library involved - each bar is just a plain <div> whose
 * CSS height is set to a percentage of the tallest value in the whole
 * dataset, so the tallest bar always fills the chart and everything
 * else is sized relative to it.
 */
function TrendsChart({ refreshKey }) {
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();

    setLoading(true);
    getTrends(now.getFullYear(), now.getMonth() + 1, 6)
      .then((data) => {
        if (!cancelled) setTrend(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const maxValue = Math.max(
    1, // never divide by zero if every month is $0 so far
    ...trend.flatMap((m) => [Number(m.totalIncome), Number(m.totalExpenses)])
  );

  return (
    <section className="card">
      <h2>Spending trends (last 6 months)</h2>

      {loading && <p className="muted">Loading...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="trend-legend">
            <span><span className="trend-swatch income" /> Income</span>
            <span><span className="trend-swatch expense" /> Expenses</span>
          </div>

          <div className="trend-chart">
            {trend.map((m) => (
              <div className="trend-month" key={`${m.year}-${m.month}`}>
                <div className="trend-bars">
                  <div
                    className="trend-bar income"
                    style={{ height: `${(Number(m.totalIncome) / maxValue) * 100}%` }}
                    title={`Income: ${formatCurrency(m.totalIncome)}`}
                  />
                  <div
                    className="trend-bar expense"
                    style={{ height: `${(Number(m.totalExpenses) / maxValue) * 100}%` }}
                    title={`Expenses: ${formatCurrency(m.totalExpenses)}`}
                  />
                </div>
                <span className="trend-label">{MONTH_ABBR[m.month - 1]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default TrendsChart;
