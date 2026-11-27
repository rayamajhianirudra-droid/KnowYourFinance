import { useEffect, useMemo, useState } from "react";
import { getBudgets } from "../api";
import { explainMonth, monthSentences } from "../utils/monthStory";
import { categoryLabel, formatCurrency } from "../utils/format";

/**
 * "Why was this month different?" in a few sentences, plus any budget that
 * is close to or past its limit. Shown for a single calendar month only.
 */
export default function MonthStory({ rows, year, month, refreshKey }) {
  const sentences = useMemo(() => monthSentences(explainMonth(rows, year, month)), [rows, year, month]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getBudgets(`${year}-${String(month).padStart(2, "0")}`)
      .then((data) => { if (!cancelled) setBudgets(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setBudgets([]); });
    return () => { cancelled = true; };
  }, [year, month, refreshKey]);

  const attention = budgets.filter((b) => b.status && b.status !== "ON_TRACK");
  if (sentences.length === 0 && attention.length === 0) return null;

  return (
    <section className="panel month-story" aria-labelledby="month-story-title">
      <h2 className="panel-title" id="month-story-title">What changed this month</h2>
      {sentences.length > 0 && (
        <ul className="month-story__list">
          {sentences.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      {attention.length > 0 && (
        <div className="month-story__budgets">
          <h3>Budgets to watch</h3>
          <ul>
            {attention.map((b) => (
              <li key={b.category} className={`month-story__budget month-story__budget--${String(b.status).toLowerCase()}`}>
                <strong>{categoryLabel(b.category)}</strong>{" "}
                {b.status === "OVER"
                  ? `is ${formatCurrency(Math.abs(Number(b.remaining)))} over its ${formatCurrency(b.limitAmount)} limit.`
                  : b.status === "REACHED"
                    ? `has used all of its ${formatCurrency(b.limitAmount)} limit.`
                    : `has used ${Math.round(Number(b.percentUsed))}% of its ${formatCurrency(b.limitAmount)} limit.`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
