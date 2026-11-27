import { useState } from "react";
import { saveSubscriptionDecision } from "../api";
import { categoryLabel, formatCurrency } from "../utils/format";
import { daysBetween, dueLabel, monthlyTotal } from "../utils/recurring";

/** Dashboard panel listing the bills that repeat every month. */
export default function RecurringBills({ bills, today, decisions, onDecision }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function review(key, status) {
    setBusy(true);
    setError(false);
    try {
      await saveSubscriptionDecision(key, status);
      onDecision(key, status);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const subscriptions = bills.filter((bill) => bill.category === "SUBSCRIPTIONS" && bill.nextDate >= today && decisions?.[bill.key] !== "CANCELLED");
  return (
    <section className="panel recurring" aria-labelledby="recurring-title">
      <div className="panel-header">
        <h2 className="panel-title" id="recurring-title">Recurring bills</h2>
        {bills.length > 0 && (
          <p className="recurring__total">About {formatCurrency(monthlyTotal(bills.filter((bill) =>
            !(bill.category === "SUBSCRIPTIONS" && decisions?.[bill.key] === "CANCELLED"))))} a month</p>
        )}
      </div>

      {subscriptions.length > 0 && <p className="muted">
        Subscriptions to review · About {formatCurrency(monthlyTotal(subscriptions))} monthly or{" "}
        {formatCurrency(monthlyTotal(subscriptions) * 12)} annually. Review whether you still need these charges.
      </p>}
      {error && <p role="alert">Could not save the subscription review.</p>}
      {bills.length === 0 ? (
        <p className="muted chart-empty">
          No repeating bills found yet. A bill shows up here once the same charge
          appears in three different months.
        </p>
      ) : (
        <ul className="recent-list">
          {bills.map((bill) => {
            const days = daysBetween(today, bill.nextDate);
            const soon = days >= 0 && days <= 7;
            const cancelled = bill.category === "SUBSCRIPTIONS" && decisions?.[bill.key] === "CANCELLED";
            return (
              <li key={bill.key} className="recent-list__item">
                <div className="recent-list__main">
                  <span className="recent-list__desc">{bill.description}</span>
                  <span className="recent-list__meta">
                    {categoryLabel(bill.category)} · seen in {bill.count} months
                    {bill.category === "SUBSCRIPTIONS" && ` · ${formatCurrency(bill.amount * 12)} annualized`}
                  </span>
                  {bill.category === "SUBSCRIPTIONS" && decisions && <label>
                    Review {bill.description}{" "}
                    <select value={decisions[bill.key] || ""} disabled={busy}
                      onChange={(event) => review(bill.key, event.target.value)}>
                      <option value="" disabled>Needs review</option>
                      <option value="ESSENTIAL">Essential</option>
                      <option value="UNNECESSARY">Unnecessary</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </label>}
                </div>
                <div className="recurring__right">
                  <span className="amount amount--expense">{formatCurrency(bill.amount)}</span>
                  <span className={`recurring__due${soon ? " recurring__due--soon" : ""}`}>
                    {cancelled ? "Marked cancelled" : dueLabel(bill.nextDate, today)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
