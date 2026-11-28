import { useEffect, useState } from "react";
import PageHero from "./PageHero";
import { copyPreviousMonthBudgets, getBudgets, saveBudget, removeBudget } from "../api";
import { categoryLabel, formatCurrency } from "../utils/format";
import { toLocalDateInput } from "../utils/dates";

const CATEGORIES = ["GROCERIES", "DINING", "RENT_MORTGAGE", "UTILITIES", "SUBSCRIPTIONS", "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION", "TRAVEL", "TRANSFER", "OTHER"];
const STATUS_LABELS = { ON_TRACK: "On track", WARNING: "Approaching limit", REACHED: "Limit reached", OVER: "Over budget" };

export default function Budgets({ refreshKey }) {
  const [month, setMonth] = useState(() => toLocalDateInput(new Date()).slice(0, 7));
  return (
    <div className="page">
      <PageHero title="Monthly Budgets" subtitle="Give your spending a plan. Set category limits and see how much room you have left." />
      <BudgetMonth key={month} month={month} onMonth={setMonth} refreshKey={refreshKey} />
    </div>
  );
}

function BudgetMonth({ month, onMonth, refreshKey }) {
  const [budgets, setBudgets] = useState([]);
  const [category, setCategory] = useState("GROCERIES");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getBudgets(month).then(data => {
      if (!cancelled) { setBudgets(data); setError(""); }
    }).catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, refreshKey, reload]);

  function refresh() { setLoading(true); setReload(value => value + 1); }

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError("Enter a positive limit with up to 9 digits and 2 decimal places.");
      return;
    }
    setBusy(true); setError("");
    try {
      await saveBudget(month, category, amount);
      setMessage(`${categoryLabel(category)} budget saved.`);
      setAmount(""); refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function handleCopy() {
    setBusy(true); setError(""); setMessage("");
    try {
      const { copied } = await copyPreviousMonthBudgets(month);
      setMessage(copied === 0 ? "There were no new limits to copy from the previous month."
        : copied === 1 ? "Copied 1 budget limit from the previous month."
        : `Copied ${copied} budget limits from the previous month.`);
      refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function handleRemove(value) {
    setBusy(true); setError(""); setMessage("");
    try {
      await removeBudget(month, value);
      setRemoving(null);
      setMessage(`${categoryLabel(value)} budget removed. Your transactions are unchanged.`);
      refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const totalLimit = budgets.reduce((sum, b) => sum + Number(b.limitAmount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent), 0);
  const alerts = budgets.filter(b => b.status !== "ON_TRACK");
  const editing = budgets.some(b => b.category === category);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return <>
    <div className="panel budget-toolbar">
      <label className="filter-field"><span className="filter-field__label">Budget month</span>
        <input type="month" min="1900-01" max="9999-12" value={month} disabled={busy} onChange={e => {
          if (/^\d{4}-\d{2}$/.test(e.target.value) && e.target.validity.valid) onMonth(e.target.value);
        }} />
      </label>
      <p className="muted">Limits apply to this month only. Spending updates from your transactions.</p>
      {month !== "1900-01" && <div>
        <button type="button" className="btn btn--text" disabled={busy || loading || Boolean(error)} onClick={handleCopy}>
          Copy last month’s limits
        </button>
        <p className="muted">Adds limits for categories without one this month.</p>
      </div>}
    </div>

    {error && <div className="panel" role="alert"><p className="error">{error}</p>
      {!busy && <button className="btn btn--text" onClick={refresh}>Reload budgets</button>}
    </div>}
    {message && <p role="status">{message}</p>}
    {loading && <p className="muted" role="status">Loading budgets...</p>}

    {!loading && !error && <>
      <section className="panel budget-summary" aria-label="Budgeted categories summary">
        <div><span className="muted">Planned limits</span><strong>{formatCurrency(totalLimit)}</strong></div>
        <div><span className="muted">Spent in budgeted categories</span><strong>{formatCurrency(totalSpent)}</strong></div>
        <div><span className="muted">{totalLimit - totalSpent >= 0 ? "Remaining across budgets" : "Over total planned"}</span><strong>{formatCurrency(Math.abs(totalLimit - totalSpent))}</strong></div>
      </section>
      {alerts.length > 0 && <section className="panel budget-notice" aria-label="Budget alerts">
        <h2>Keep an eye on these categories</h2>
        <ul>{alerts.map(b => <li key={b.category}>{categoryLabel(b.category)}: {b.status === "OVER" ? `${formatCurrency(Math.abs(Number(b.remaining)))} over budget` : b.status === "REACHED" ? "limit reached" : `${Number(b.percentUsed).toFixed(2)}% used — approaching your limit`}.</li>)}</ul>
      </section>}
    </>}

    <form className="panel budget-form" onSubmit={handleSave} aria-label="Set a category budget">
      <h2>{editing ? "Update a category limit" : "Set a category limit"}</h2>
      <div className="budget-form__fields">
        <label className="field"><span className="field__label">Spending category</span>
          <select value={category} disabled={busy || loading} onChange={e => {
            setCategory(e.target.value);
            const existing = budgets.find(b => b.category === e.target.value);
            setAmount(existing ? String(existing.limitAmount) : "");
          }}>{CATEGORIES.map(value => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select>
        </label>
        <label className="field"><span className="field__label">Monthly limit ($)</span>
          <input type="number" min="0.01" max="999999999.99" step="0.01" required value={amount} disabled={busy || loading} placeholder="e.g. 300.00" onChange={e => setAmount(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy || loading}>{busy ? "Saving..." : "Save limit"}</button>
      </div>
      <p className="muted">One limit per category for {monthLabel}. Saving an existing category updates its limit.</p>
    </form>

    {!loading && !error && <section aria-label={`Category budgets for ${monthLabel}`}>
      {budgets.length === 0 ? <div className="panel budget-empty"><h2>Start with one category</h2><p className="muted">Set a limit for groceries, dining, or another category above. We’ll show a warning at 80% and tell you when you reach or exceed it.</p></div> :
        <div className="budget-grid">{budgets.map(b => <article key={b.category} className={`panel budget-card budget-card--${b.status.toLowerCase()}`}>
          <div className="budget-card__heading"><h2>{categoryLabel(b.category)}</h2><span className="budget-status">{STATUS_LABELS[b.status]}</span></div>
          <p className="budget-card__amount"><strong>{formatCurrency(b.spent)}</strong><span className="muted"> of {formatCurrency(b.limitAmount)}</span></p>
          <progress max="100" value={Math.min(100, Math.max(0, Number(b.percentUsed)))} aria-label={`${categoryLabel(b.category)} budget used`} aria-valuetext={`${Number(b.percentUsed).toFixed(2)}% used`} />
          <p>{Number(b.remaining) < 0 ? `${formatCurrency(Math.abs(Number(b.remaining)))} over budget` : `${formatCurrency(b.remaining)} remaining`} <span className="muted">· {Number(b.percentUsed).toFixed(2)}% used</span></p>
          <div className="budget-card__actions">
            <button className="btn btn--text" disabled={busy} onClick={() => {
              setCategory(b.category); setAmount(String(b.limitAmount)); setMessage(`Editing ${categoryLabel(b.category)}. Change the monthly limit above.`);
            }} aria-label={`Edit ${categoryLabel(b.category)} budget`}>Edit limit</button>
            {removing === b.category ? <>
              <span>Remove limit?</span><button className="btn btn--text" disabled={busy} onClick={() => handleRemove(b.category)} aria-label={`Confirm remove ${categoryLabel(b.category)} budget`}>Confirm</button>
              <button className="btn btn--text" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button>
            </> : <button className="btn btn--text" disabled={busy} onClick={() => setRemoving(b.category)} aria-label={`Remove ${categoryLabel(b.category)} budget`}>Remove</button>}
          </div>
        </article>)}</div>}
    </section>}
    <p className="muted">Only expense transactions count toward limits. Income is excluded. Totals cover categories with a saved budget; they are not your total monthly spending.</p>
  </>;
}
