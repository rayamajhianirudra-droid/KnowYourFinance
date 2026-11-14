import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { getMonthlyReport, getReportRange, listTransactions } from "../api";
import { categoryLabel, formatCurrency, formatPercent } from "../utils/format";
// The two chart components pull in the whole recharts library, which is
// most of the app's download size. Loading them on demand lets the page
// shell and the numbers appear first and the charts fill in a moment later.
const TrendsChart = lazy(() => import("./TrendsChart"));
const CategoryDonut = lazy(() => import("./CategoryDonut"));
import EmptyState from "./EmptyState";
import PageHero from "./PageHero";
import { toLocalDateInput } from "../utils/dates";
import {
  IncomeIcon, ExpenseIcon, SavingsIcon, RateIcon,
  ArrowUpIcon, ArrowDownIcon, UploadIcon, PlusIcon,
} from "./Icons";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PERIODS = [
  { id: "this", label: "This month" },
  { id: "previous", label: "Previous month" },
  { id: "customMonth", label: "Custom month" },
  { id: "customRange", label: "Custom range" },
];

function startOfMonthInput(date) {
  return toLocalDateInput(date);
}

/**
 * The dashboard: pick a period, see what came in, what went out, and
 * where it went. This is KYF's core differentiator versus apps like
 * Rocket Money - the period isn't locked to "this month," and every
 * number on it (including the trend charts and recent-transactions
 * list) comes from the same Transaction data manual entry and
 * statement import both write to.
 */
function Dashboard({ refreshKey, onUploadClick, onAddClick, onViewTransactions }) {
  const now = useMemo(() => new Date(), []);
  const [periodType, setPeriodType] = useState("this");
  const [customYear, setCustomYear] = useState(now.getFullYear());
  const [customMonth, setCustomMonth] = useState(now.getMonth() + 1);
  const [rangeStart, setRangeStart] = useState(
    startOfMonthInput(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [rangeEnd, setRangeEnd] = useState(startOfMonthInput(now));

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // Which concrete year/month (or start/end) this periodType resolves to.
  const resolved = useMemo(() => {
    if (periodType === "this") {
      return { kind: "month", year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    if (periodType === "previous") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { kind: "month", year: prev.getFullYear(), month: prev.getMonth() + 1 };
    }
    if (periodType === "customMonth") {
      return { kind: "month", year: customYear, month: customMonth };
    }
    return { kind: "range", start: rangeStart, end: rangeEnd };
  }, [periodType, now, customYear, customMonth, rangeStart, rangeEnd]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const request =
      resolved.kind === "month"
        ? getMonthlyReport(resolved.year, resolved.month)
        : getReportRange(resolved.start, resolved.end);

    request
      .then((data) => {
        if (!cancelled) setReport(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setRecentLoading(true);
    listTransactions()
      .then((all) => {
        if (cancelled) return;
        const sorted = [...all].sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecent(sorted.slice(0, 5));
      })
      .catch(() => {
        /* the dashboard still works without this panel; the stat cards
           already surface a real error if the API is actually down */
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const periodLabel =
    resolved.kind === "month"
      ? `${MONTH_NAMES[resolved.month - 1]} ${resolved.year}`
      : `${resolved.start} – ${resolved.end}`;

  const savingsRate = report && Number(report.totalIncome) > 0
    ? (Number(report.netSavings) / Number(report.totalIncome)) * 100
    : 0;
  const previousSavingsRate =
    report && report.previousPeriodHasData && Number(report.previousTotalIncome) > 0
      ? (Number(report.previousNetSavings) / Number(report.previousTotalIncome)) * 100
      : null;

  const hasAnyTransactions = report && (
    Number(report.totalIncome) > 0 ||
    Number(report.totalExpenses) > 0 ||
    (report.categoryBreakdown && report.categoryBreakdown.length > 0)
  );


  return (
    <div className="page">
      <PageHero
        title="Dashboard"
        subtitle={`Your financial overview for ${periodLabel}.`}
        art
      >
        {/* The two things people do most, one click from the top of the page. */}
        {(onUploadClick || onAddClick) && (
          <div className="page-hero__actions">
            {onUploadClick && (
              <button type="button" className="btn btn--primary" onClick={onUploadClick}>
                <UploadIcon width={16} height={16} aria-hidden="true" />
                Upload statement
              </button>
            )}
            {onAddClick && (
              <button type="button" className="btn btn--secondary" onClick={onAddClick}>
                <PlusIcon width={16} height={16} aria-hidden="true" />
                Add transaction
              </button>
            )}
          </div>
        )}
      </PageHero>

      <PeriodSelector
        periodType={periodType}
        onChange={setPeriodType}
        customYear={customYear}
        customMonth={customMonth}
        onCustomYear={setCustomYear}
        onCustomMonth={setCustomMonth}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onRangeStart={setRangeStart}
        onRangeEnd={setRangeEnd}
      />

      {loading && <p className="muted" role="status">Loading your overview...</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {report && !loading && !hasAnyTransactions && (
        <EmptyState
          title="No transactions yet"
          message="Upload a statement or add your first transaction to start understanding your finances."
          onUploadClick={onUploadClick}
          onAddClick={onAddClick}
        />
      )}

      {report && !loading && hasAnyTransactions && (
        <>
          {report.insights && report.insights.length > 0 && (
            <section className="highlights" aria-label="Highlights">
              <h2 className="highlights__title">Highlights</h2>
              <ul className="highlights__list">
                {report.insights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="stat-cards">
            <StatCard
              icon={IncomeIcon}
              label="Total Income"
              value={report.totalIncome}
              previousValue={report.previousTotalIncome}
              hasComparison={report.previousPeriodHasData}
              tone="positive"
            />
            <StatCard
              icon={ExpenseIcon}
              label="Total Expenses"
              value={report.totalExpenses}
              previousValue={report.previousTotalExpenses}
              hasComparison={report.previousPeriodHasData}
              tone="negative"
              // for expenses, "up" is the unfavorable direction
              invertComparisonTone
            />
            <StatCard
              icon={SavingsIcon}
              label="Net Savings"
              value={report.netSavings}
              previousValue={report.previousNetSavings}
              hasComparison={report.previousPeriodHasData}
              tone={Number(report.netSavings) >= 0 ? "positive" : "negative"}
            />
            <RateCard rate={savingsRate} previousRate={previousSavingsRate} />
          </div>

          <Suspense fallback={<p className="muted">Loading chart...</p>}>
            <TrendsChart refreshKey={refreshKey} />
          </Suspense>

          <div className="dash-columns">
          <div className="panel">
            <h2 className="panel-title">Spending by category</h2>
            {report.categoryBreakdown.length === 0 ? (
              <p className="muted chart-empty">No expenses recorded for this period.</p>
            ) : (
              <Suspense fallback={<p className="muted">Loading chart...</p>}>
                <CategoryDonut items={report.categoryBreakdown} />
              </Suspense>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Recent transactions</h2>
              {onViewTransactions && recent.length > 0 && (
                <button type="button" className="link-btn" onClick={onViewTransactions}>
                  View all transactions
                </button>
              )}
            </div>
            {recentLoading && <p className="muted">Loading...</p>}
            {!recentLoading && recent.length === 0 && (
              <p className="muted chart-empty">No transactions yet.</p>
            )}
            {!recentLoading && recent.length > 0 && (
              <ul className="recent-list">
                {recent.map((t) => (
                  <li key={t.id} className="recent-list__item">
                    <div className="recent-list__main">
                      <span className="recent-list__desc">{t.description}</span>
                      <span className="recent-list__meta">
                        {categoryLabel(t.category)} · {t.date}
                      </span>
                    </div>
                    <span className={`amount amount--${t.type.toLowerCase()}`}>
                      {t.type === "EXPENSE" ? "−" : "+"}
                      {formatCurrency(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}

function PeriodSelector({
  periodType, onChange,
  customYear, customMonth, onCustomYear, onCustomMonth,
  rangeStart, rangeEnd, onRangeStart, onRangeEnd,
}) {
  return (
    <div className="period-selector">
      <div className="period-selector__tabs" role="group" aria-label="Reporting period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={periodType === p.id}
            className={`period-tab${periodType === p.id ? " period-tab--active" : ""}`}
            onClick={() => onChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodType === "customMonth" && (
        <div className="period-selector__controls">
          <label>
            Month
            <select value={customMonth} onChange={(e) => onCustomMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input type="number" value={customYear} onChange={(e) => onCustomYear(Number(e.target.value))} />
          </label>
        </div>
      )}

      {periodType === "customRange" && (
        <div className="period-selector__controls">
          <label>
            From
            <input type="date" value={rangeStart} onChange={(e) => onRangeStart(e.target.value)} max={rangeEnd} />
          </label>
          <label>
            To
            <input type="date" value={rangeEnd} onChange={(e) => onRangeEnd(e.target.value)} min={rangeStart} />
          </label>
        </div>
      )}
    </div>
  );
}

// Maps "was this change good?" (true, false or null for no change) to the
// CSS modifier used on the small comparison line.
function changeTone(isGoodChange) {
  if (isGoodChange === null) return "neutral";
  return isGoodChange ? "good" : "bad";
}

function StatCard({ icon: Icon, label, value, previousValue, hasComparison, tone, invertComparisonTone }) {
  const numericValue = Number(value);
  const numericPrevious = Number(previousValue);
  const showComparison = hasComparison && numericPrevious !== 0;
  const change = showComparison ? ((numericValue - numericPrevious) / Math.abs(numericPrevious)) * 100 : null;

  // "Up" is good news for income/savings but bad news for expenses -
  // invertComparisonTone flips which direction counts as positive so
  // the arrow/color always means "this is good" or "this is bad," not
  // just "this went up."
  // Exactly zero is "no change", which is neither good nor bad. It used to
  // fall into the "bad" branch and show a red up arrow for 0.0%.
  const isGoodChange = change === null || change === 0 ? null : invertComparisonTone ? change < 0 : change > 0;

  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden="true">
        <Icon width={18} height={18} />
      </div>
      <span className="stat-card__label">{label}</span>
      <span className={`stat-card__value stat-card__value--${tone}`}>{formatCurrency(numericValue)}</span>
      {showComparison && (
        <span className={`stat-card__change stat-card__change--${changeTone(isGoodChange)}`}>
          {change === 0 ? null : change > 0 ? <ArrowUpIcon width={13} height={13} /> : <ArrowDownIcon width={13} height={13} />}
          {change === 0 ? "No change from last period" : `${formatPercent(Math.abs(change))} from last period`}
        </span>
      )}
    </div>
  );
}

function RateCard({ rate, previousRate }) {
  const showComparison = previousRate !== null;
  const delta = showComparison ? rate - previousRate : null;
  const isGoodChange = delta === null || delta === 0 ? null : delta > 0;

  return (
    <div className="stat-card">
      <div className="stat-card__icon stat-card__icon--info" aria-hidden="true">
        <RateIcon width={18} height={18} />
      </div>
      <span className="stat-card__label">Savings Rate</span>
      <span className="stat-card__value">{rate.toFixed(1)}%</span>
      {showComparison && (
        <span className={`stat-card__change stat-card__change--${changeTone(isGoodChange)}`}>
          {delta === 0 ? null : delta > 0 ? <ArrowUpIcon width={13} height={13} /> : <ArrowDownIcon width={13} height={13} />}
          {delta === 0 ? "No change from last period" : `${formatPercent(Math.abs(delta))} pts from last period`}
        </span>
      )}
    </div>
  );
}

export default Dashboard;
