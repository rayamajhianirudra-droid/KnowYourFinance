import { firstName } from "../utils/names";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { getMonthlyReport, getReportRange, listTransactions, listGoals, listSubscriptionDecisions } from "../api";
import RecurringBills from "./RecurringBills";
import SavingsGoals from "./SavingsGoals";
import { summarizeHistory } from "../utils/financialPlanning";
import MonthlyReportExport from "./MonthlyReportExport";
import FinancialPlanning from "./FinancialPlanning";
import { detectRecurring } from "../utils/recurring";
import { categoryLabel, formatCurrency, formatDayCellCurrency, formatPercent } from "../utils/format";
// The two chart components pull in the whole recharts library, which is
// most of the app's download size. Loading them on demand lets the page
// shell and the numbers appear first and the charts fill in a moment later.
const TrendsChart = lazy(() => import("./TrendsChart"));
const CategoryDonut = lazy(() => import("./CategoryDonut"));
import EmptyState from "./EmptyState";
import PageHero from "./PageHero";
import { toLocalDateInput, todayInput } from "../utils/dates";
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
function Dashboard({ fullName, refreshKey, onUploadClick, onAddClick, onViewTransactions }) {
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
  const [allTransactions, setAllTransactions] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [goals, setGoals] = useState(null);
  const [subscriptions, setSubscriptions] = useState(null);
  const [planningLoadFailed, setPlanningLoadFailed] = useState(false);
  const today = todayInput();

  useEffect(() => {
    let active = true;
    async function loadPlanning() {
      try {
        const [savedGoals, savedDecisions] = await Promise.all([listGoals(), listSubscriptionDecisions()]);
        if (active) {
          setGoals(savedGoals);
          setSubscriptions(Object.fromEntries(savedDecisions.map((item) => [item.merchantKey, item.status])));
          setPlanningLoadFailed(false);
        }
      } catch {
        if (active) setPlanningLoadFailed(true);
      }
    }
    loadPlanning();
    return () => { active = false; };
  }, [refreshKey]);

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
        setAllTransactions(all);
      })
      .catch(() => {
        if (!cancelled) {
          setRecent([]);
          setAllTransactions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const recurringBills = useMemo(() => detectRecurring(allTransactions.filter((row) => row.date <= today)),
    [allTransactions, today]);
  const billForecast = useMemo(() => recurringBills.filter((bill) =>
    !(subscriptions?.[bill.key] === "CANCELLED" && bill.category === "SUBSCRIPTIONS")),
  [recurringBills, subscriptions]);
  const history = useMemo(() => summarizeHistory(allTransactions, today), [allTransactions, today]);
  const monthlyCashFlow = history.observedDays >= 30
    ? Math.round((history.recentIncome - history.recentExpenses) * 30 / history.observedDays) : null;

  const scenarioStart = resolved.kind === "month"
    ? toLocalDateInput(new Date(resolved.year, resolved.month - 1, 1))
    : resolved.start;
  const scenarioEnd = resolved.kind === "month"
    ? toLocalDateInput(new Date(resolved.year, resolved.month, 0))
    : resolved.end;

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
        subtitle={
          fullName
            ? `Welcome back, ${firstName(fullName)}. Here is your financial overview for ${periodLabel}.`
            : `Your financial overview for ${periodLabel}.`
        }
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

      {!recentLoading && allTransactions.length > 0 && <FinancialPlanning
        rows={allTransactions}
        bills={billForecast}
        today={today}
        goals={goals}
        refreshKey={refreshKey}
        comparison={resolved.kind === "month" && !loading && !error ? report : null}
      />}

      {planningLoadFailed && <p role="status">Saved goals or subscription reviews could not be loaded.</p>}

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

          {!recentLoading && !error && (
            <SpendingScenario
              key={`${scenarioStart}/${scenarioEnd}/${refreshKey}`}
              transactions={allTransactions}
              start={scenarioStart}
              end={scenarioEnd}
              expenses={Number(report.totalExpenses)}
              savings={Number(report.netSavings)}
            />
          )}

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

          {resolved.kind === "month" && !recentLoading && !error && (
            <SpendingCalendar
              key={`${resolved.year}-${resolved.month}-${refreshKey}`}
              transactions={allTransactions}
              year={resolved.year}
              month={resolved.month}
            />
          )}
          <RecurringBills bills={recurringBills} today={today} decisions={subscriptions}
            onDecision={(key, status) => setSubscriptions((previous) => ({ ...previous, [key]: status }))} />
          {resolved.kind === "month" && !recentLoading && allTransactions.length > 0 && !error &&
            report.year === resolved.year && report.month === resolved.month && <MonthlyReportExport
              month={scenarioStart.slice(0, 7)}
              report={report}
              rows={allTransactions}
              goals={goals}
            />}

        </>
      )}
      {goals !== null && <SavingsGoals goals={goals} today={today}
        monthlyCashFlow={monthlyCashFlow} onChange={setGoals} />}
    </div>
  );
}

// How many expenses the what-if panel offers, biggest first.
const SCENARIO_LIMIT = 8;

function SpendingScenario({ transactions, start, end, expenses, savings }) {
  const [excluded, setExcluded] = useState([]);
  const candidates = useMemo(() => transactions
    .filter((row) => row.id != null && row.type === "EXPENSE" &&
      row.date >= start && row.date <= end && Number(row.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount) || b.date.localeCompare(a.date))
    .slice(0, SCENARIO_LIMIT), [transactions, start, end]);

  if (candidates.length === 0) return null;

  const selectedTotal = candidates.reduce((total, row) =>
    excluded.includes(row.id) ? total + Number(row.amount) : total, 0);

  return (
    <section className="panel spending-scenario" aria-labelledby="spending-scenario-title">
      <h2 className="panel-title" id="spending-scenario-title">What if I hadn’t spent that?</h2>
      <p className="muted">Select one-off expenses to see how they affected this period. Your transactions stay as recorded.</p>
      <details>
        <summary>Compare without selected expenses</summary>
        <fieldset>
          <legend>Up to {SCENARIO_LIMIT} largest expenses in this period</legend>
          {candidates.map((row) => (
            <div key={row.id} className="spending-scenario__row">
              <label>
                <input
                  type="checkbox"
                  checked={excluded.includes(row.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setExcluded((previous) => checked
                      ? [...previous, row.id] : previous.filter((id) => id !== row.id));
                  }}
                />
                <span>{row.description} · {row.date} · {formatCurrency(row.amount)}</span>
              </label>
            </div>
          ))}
        </fieldset>
        <div className="spending-scenario__results" aria-live="polite" aria-atomic="true">
          <p>Expenses: {formatCurrency(expenses)} recorded · {formatCurrency(expenses - selectedTotal)} in this scenario</p>
          <p>Net savings: {formatCurrency(savings)} recorded · {formatCurrency(savings + selectedTotal)} in this scenario</p>
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={excluded.length === 0}
          onClick={() => setExcluded([])}
        >
          Clear selections
        </button>
      </details>
    </section>
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function SpendingCalendar({ transactions, year, month }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const expensesByDay = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}-`;
    const days = new Map();
    for (const row of transactions) {
      if (row.type !== "EXPENSE" || !row.date?.startsWith(prefix) || !(Number(row.amount) > 0)) {
        continue;
      }
      const day = Number(row.date.slice(8, 10));
      const entry = days.get(day) ?? { cents: 0, rows: [] };
      // Add whole cents, so many small amounts cannot drift the way decimals do.
      entry.cents += Math.round(Number(row.amount) * 100);
      entry.rows.push(row);
      days.set(day, entry);
    }
    return days;
  }, [transactions, year, month]);

  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, month, 0).getDate();
  const selected = expensesByDay.get(selectedDay);
  const monthLabel = MONTH_NAMES[month - 1];

  return (
    <section className="panel spending-calendar" aria-labelledby="spending-calendar-title">
      <h2 className="panel-title" id="spending-calendar-title">Spending calendar</h2>
      <p className="muted">Select a day to see its recorded expenses.</p>
      <div className="spending-calendar__grid">
        {WEEKDAYS.map((day) => <span key={day} className="muted">{day}</span>)}
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: dayCount }, (_, index) => {
          const day = index + 1;
          const entry = expensesByDay.get(day);
          const label = entry ? formatCurrency(entry.cents / 100) : "no expenses recorded";
          return (
            <button
              key={day}
              type="button"
              className={`btn spending-calendar__day ${selectedDay === day ? "btn--primary" : "btn--secondary"}`}
              aria-label={`${monthLabel} ${day}, ${label}`}
              aria-pressed={selectedDay === day}
              onClick={() => setSelectedDay(day)}
            >
              <span>{day}</span>
              {entry ? (
                <>
                  {/* The stylesheet shows one of these, depending on how wide the calendar is. */}
                  <span className="spending-calendar__amount spending-calendar__amount--full">{label}</span>
                  <span className="spending-calendar__amount spending-calendar__amount--short">
                    {formatDayCellCurrency(entry.cents / 100)}
                  </span>
                </>
              ) : <span className="spending-calendar__amount">—</span>}
            </button>
          );
        })}
      </div>
      {selectedDay !== null && (
        <div className="spending-calendar__detail" aria-live="polite">
          <h3 className="panel-title">{monthLabel} {selectedDay}{selected && ` · ${formatCurrency(selected.cents / 100)}`}</h3>
          {selected ? (
            <ul>
              {selected.rows.map((row, index) => (
                <li key={row.id ?? index}>{row.description} · {formatCurrency(row.amount)}</li>
              ))}
            </ul>
          ) : <p>No expenses recorded for this day.</p>}
        </div>
      )}
    </section>
  );
}
