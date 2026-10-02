import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getTrends } from "../api";
import { formatCompactCurrency, formatCurrency } from "../utils/format";

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-md)",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
};

const axisTick = { fill: "var(--color-text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" };

/**
 * Two related but distinct views of the same trailing-6-month data:
 * income vs. expenses side by side per month (a bar chart - good for
 * comparing two discrete values per period), and net savings as a
 * single line over time (an area chart - good for reading a trend's
 * direction at a glance). Showing both answers two different
 * questions: "how do income and spending compare each month" and "is
 * my overall financial position improving."
 *
 * Deliberately independent of the report's own period selector above -
 * this always shows the trailing 6 months ending today, so switching
 * the report to an old month doesn't also drag this back in time.
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

  const chartData = trend.map((m) => ({
    label: MONTH_ABBR[m.month - 1],
    income: Number(m.totalIncome),
    expenses: Number(m.totalExpenses),
    netSavings: Number(m.netSavings),
  }));

  const hasAnyData = chartData.some((m) => m.income > 0 || m.expenses > 0);

  if (loading) return <p className="muted">Loading trends...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="trends-grid">
      <div className="panel">
        <h3 className="panel-title">Income vs. expenses</h3>
        {!hasAnyData ? (
          <p className="muted chart-empty">Not enough history yet to chart this.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={56}
              />
              <Tooltip
                formatter={(value, name) => [formatCurrency(value), name === "income" ? "Income" : "Expenses"]}
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--color-surface-soft)" }}
              />
              <Bar dataKey="income" fill="var(--color-positive)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expenses" fill="var(--color-negative)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="chart-legend">
          <span><span className="chart-swatch" style={{ background: "var(--color-positive)" }} /> Income</span>
          <span><span className="chart-swatch" style={{ background: "var(--color-negative)" }} /> Expenses</span>
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Financial trend</h3>
        {!hasAnyData ? (
          <p className="muted chart-empty">Not enough history yet to chart this.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="netSavingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-interactive)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-interactive)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={56}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value), "Net savings"]}
                contentStyle={tooltipStyle}
              />
              <Area
                type="monotone"
                dataKey="netSavings"
                stroke="var(--color-interactive)"
                strokeWidth={2}
                fill="url(#netSavingsFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <p className="muted chart-caption">Net savings (income minus expenses) over the last 6 months.</p>
      </div>
    </div>
  );
}

export default TrendsChart;
