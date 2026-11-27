import { useEffect, useMemo, useState } from "react";
import { getBudgets } from "../api";
import { categoryLabel, formatCurrency } from "../utils/format";
import {
  forecast, goalProgress, safeToSpend, spendingAlerts, spendingCuts, summarizeHistory, toCents, upcomingBills,
} from "../utils/financialPlanning";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SCENARIOS = {
  car: ["Buying a car", -1],
  rent: ["Increasing rent", -1],
  subscription: ["Cancelling subscriptions", 1],
  restaurant: ["Reducing restaurant spending", 1],
  savings: ["Increasing savings contributions", -1],
};

const money = (cents) => formatCurrency(cents / 100);
const validAmount = (value) => /^-?\d{1,9}(\.\d{1,2})?$/.test(value);

export default function FinancialPlanning({ rows, bills, today, refreshKey, comparison, goals }) {
  const [budgetResult, setBudgetResult] = useState(null);
  const [balance, setBalance] = useState("");
  const [reserve, setReserve] = useState("");
  const [target, setTarget] = useState("");
  const [targetUnit, setTargetUnit] = useState("amount");
  const [scenario, setScenario] = useState("car");
  const [scenarioAmount, setScenarioAmount] = useState("");
  const [upfront, setUpfront] = useState("");
  const month = today.slice(0, 7);

  const budgetKey = `${month}/${refreshKey}`;
  const budgets = budgetResult?.key === budgetKey ? budgetResult.data : null;
  const budgetError = budgetResult?.key === budgetKey && budgetResult.error;

  useEffect(() => {
    let active = true;
    getBudgets(month).then((data) => {
      if (active) setBudgetResult({ key: budgetKey, data });
    }).catch(() => {
      if (active) setBudgetResult({ key: budgetKey, data: null, error: true });
    });
    return () => { active = false; };
  }, [month, budgetKey]);

  const history = useMemo(() => summarizeHistory(rows, today), [rows, today]);
  const alerts = useMemo(() => spendingAlerts(rows, today), [rows, today]);
  const upcoming = useMemo(() => upcomingBills(bills, today, 7), [bills, today]);
  const [scenarioName, direction] = SCENARIOS[scenario];
  const enteredBalance = validAmount(balance) ? toCents(balance) : null;
  const goalReserve = (goals || []).reduce((sum, goal) => sum +
    (goalProgress(goal, today, null).required || 0), 0);
  const additionalReserve = reserve === "" ? 0 : toCents(reserve);
  const savingsReserve = additionalReserve + goalReserve;
  const reserveValid = reserve === "" || (validAmount(reserve) && additionalReserve >= 0);
  const spend = enteredBalance !== null && reserveValid && budgets && goals ? safeToSpend({
    balance: enteredBalance, reserve: savingsReserve, budgets, month, bills: upcoming,
  }) : null;
  const forecastPoints = enteredBalance === null ? [] : forecast(history, enteredBalance, bills, rows, today);
  const monthlyExpenses = history.observedDays > 0
    ? Math.round(history.recentExpenses * 30 / history.observedDays) : 0;
  const targetValue = Number(target);
  const targetValid = target === "" || (validAmount(target) && targetValue > 0 &&
    (targetUnit === "amount" || targetValue <= 100));
  const targetCents = target === "" ? Infinity : targetUnit === "percent"
    ? Math.round(monthlyExpenses * targetValue / 100) : toCents(target);
  const recommendations = targetValid ? spendingCuts(history, targetCents) : [];
  const suggestedSavings = recommendations.reduce((sum, item) => sum + item.savings, 0);
  const validScenario = validAmount(scenarioAmount) && Number(scenarioAmount) >= 0 &&
    (scenario !== "car" || upfront === "" || (validAmount(upfront) && Number(upfront) >= 0));
  const scenarioChange = direction * toCents(scenarioAmount);
  const scenarioUpfront = scenario === "car" ? toCents(upfront) : 0;

  return (
    <section className="panel spending-scenario" aria-labelledby="planning-title">
      <h2 className="panel-title" id="planning-title">Daily financial briefing</h2>
      <ul>
        <li>Yesterday’s recorded spending · {money(history.yesterdaySpending)}</li>
        <li>Available cash · {enteredBalance === null ? "Enter your balance below" : money(enteredBalance)}</li>
        {budgets?.length > 0 && <li>Monthly budget balance across categories · {
          money(budgets.reduce((sum, budget) => sum + toCents(budget.remaining), 0))}</li>}
        {budgets?.length === 0 && <li>Set category budgets to see your monthly budget balance.</li>}
        <li>Detected bills due in the next seven days · {upcoming.length
          ? upcoming.map((bill) => `${bill.description} (${bill.date})`).join(", ") : "None detected"}</li>
        <li>{alerts.length > 0 ? alerts[0] : "No recent unusual charges or possible duplicates flagged."}</li>
        {recommendations.length > 0 && <li>Start with {categoryLabel(recommendations[0].category)}.
          Try trimming {money(recommendations[0].savings)} per month.</li>}
      </ul>
      {budgetError && <p role="status">Budget information is temporarily unavailable.</p>}
      <details>
        <summary>Safe to spend and balance forecast</summary>
        <fieldset>
          <legend>Cash available across your accounts</legend>
          <label>Current available cash <input type="number" step="0.01" value={balance}
            onChange={(event) => setBalance(event.target.value)} /></label>
          <label>Additional savings to reserve <input type="number" min="0" step="0.01" value={reserve}
            onChange={(event) => setReserve(event.target.value)} /></label>
        </fieldset>
        <p className="muted">Use your actual available cash. The statement ledger contains transaction
          history and can omit opening balances. This calculation reserves {money(goalReserve)} for active goal contributions.
          Use the additional reserve for other savings commitments.</p>
        {spend && <>
          <ul>
            <li>Today · <strong>{money(Math.floor(spend.available / 7))}</strong></li>
            <li>Next seven days · <strong>{money(spend.available)}</strong></li>
          </ul>
          <p>Available cash less {money(spend.billTotal)} in detected bills, {money(spend.budgetTotal)} in
            remaining category budgets and {money(savingsReserve)} reserved for savings.</p>
        </>}
        <p className="muted">The daily estimate spreads available weekly spending over seven days.
          The calculation reserves this month’s remaining budgets and counts bills within the next week once.
          Check pending charges and bills KYF missed.</p>
        {forecastPoints.length ? <>
          <p>Estimated balances use averaged past cash flow and dates inferred from recurring charges.</p>
          <ul>{forecastPoints.map((point) => <li key={point.day}>{point.day} days · {money(point.balance)}
            {point.shortage && " · Possible cash shortage before this date"}</li>)}</ul>
          <p className="muted">These projections spread income evenly. Actual pay dates can move a shortage earlier.</p>
        </> : <p className="muted">Enter your cash balance and provide at least 60 days of transaction history
          to see a forecast.</p>}
      </details>

      <details>
        <summary>Spending reduction advisor</summary>
        <fieldset>
          <legend>Monthly savings target</legend>
          <label>Target type <select value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)}>
            <option value="amount">Dollar amount</option><option value="percent">Percent of expenses</option>
          </select></label>
          <label>Target <input type="number" min="0.01" step="0.01" value={target}
            onChange={(event) => setTarget(event.target.value)} /></label>
        </fieldset>
        {history.observedDays < 30 && <p>At least 30 days of transaction history are needed.</p>}
        {!targetValid && <p>Enter a positive dollar amount or a percentage between 0.01 and 100.</p>}
        {targetValid && history.observedDays >= 30 && <>
          <p>Estimates assume a cut of up to 25% in each discretionary category, starting with the largest.</p>
          {recommendations.length > 0 && <ul>{recommendations.map((item) =>
            <li key={item.category}>{categoryLabel(item.category)} · Cut {money(item.savings)} from an
              estimated {money(item.monthly)} per month.</li>)}</ul>}
          <p>Estimated monthly savings · {money(suggestedSavings)}.</p>
          {Number.isFinite(targetCents) && suggestedSavings < targetCents &&
            <p>These cuts leave {money(targetCents - suggestedSavings)} of your target uncovered.</p>}
        </>}
      </details>

      <details>
        <summary>Simulate a future decision</summary>
        <fieldset>
          <legend>What-if scenario</legend>
          <label>Decision <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
            {Object.entries(SCENARIOS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>Monthly change <input type="number" min="0" step="0.01" value={scenarioAmount}
            onChange={(event) => setScenarioAmount(event.target.value)} /></label>
          {scenario === "car" && <label>Upfront cost <input type="number" min="0" step="0.01" value={upfront}
            onChange={(event) => setUpfront(event.target.value)} /></label>}
        </fieldset>
        {validScenario && <div aria-live="polite">
          <p>{scenarioName} changes monthly available cash by {money(scenarioChange)}.</p>
          <p>12-month available cash impact · {money(scenarioChange * 12 - scenarioUpfront)}.</p>
          {history.observedDays >= 30 && <p>Estimated monthly cash flow after change · {
            money(Math.round(history.recentIncome * 30 / history.observedDays) - monthlyExpenses + scenarioChange)}.</p>}
          {scenario === "savings" && <p>Additional savings after 12 months · {money(-scenarioChange * 12)}.</p>}
        </div>}
      </details>

      <details>
        <summary>Spending habits and alerts</summary>
        {history.observedDays >= 30 && history.recentExpenses > 0 ? <ul>
          <li>{WEEKDAYS[history.costlyDay.index]} has your highest average daily spending at {money(history.costlyDay.amount)}.
            Review what you usually buy that day.</li>
          <li>Average daily spending · {money(history.weekendAverage)} on weekends and {money(history.weekdayAverage)} on weekdays.</li>
          {history.frequentMerchant && <li>Most frequent recorded merchant · {history.frequentMerchant[0]} ({history.frequentMerchant[1]} expenses).</li>}
          {history.growingCategory && <li>{categoryLabel(history.growingCategory)} spending rose at least 20%
            compared with the prior 90 days.</li>}
          {comparison?.previousPeriodHasData && <li>Month-over-month spending change for the selected period · {
            money(toCents(comparison.totalExpenses) - toCents(comparison.previousTotalExpenses))}.</li>}
        </ul> : <p>At least 30 days of spending history are needed for habits.</p>}
        <ul>{alerts.map((alert) => <li key={alert}>{alert}</li>)}
          {budgets?.filter((budget) => budget.status !== "ON_TRACK").map((budget) =>
            <li key={budget.category}>{categoryLabel(budget.category)} · {Number(budget.percentUsed).toFixed(0)}% of budget used.</li>)}
        </ul>
      </details>
    </section>
  );
}
