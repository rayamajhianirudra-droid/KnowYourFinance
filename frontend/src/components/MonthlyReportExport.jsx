import { useState } from "react";
import { getBudgets } from "../api";
import { csvRows, downloadCsv } from "../utils/csvExport";
import { toCents } from "../utils/financialPlanning";
import { categoryLabel } from "../utils/format";

export default function MonthlyReportExport({ month, report, rows, goals }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    setBusy(true);
    setError(false);
    try {
      const budgets = await getBudgets(month);
      const subscriptions = rows.filter((row) => row.date.startsWith(month) &&
        row.type === "EXPENSE" && row.category === "SUBSCRIPTIONS");
      const subscriptionCosts = subscriptions.reduce((sum, row) => sum + toCents(row.amount), 0) / 100;
      const categories = [...report.categoryBreakdown].sort((a, b) => Number(b.total) - Number(a.total));
      const nextStep = budgets.some((budget) => Number(budget.remaining) < 0)
        ? "Review categories that exceeded their limits before setting next month's budget."
        : categories.length > 0
          ? `Review transactions in ${categoryLabel(categories[0].category)}, the largest expense category.`
          : "Add regular expenses to build a spending baseline.";
      downloadCsv(`kyf-monthly-report-${month}.csv`, csvRows([
        ["KYF monthly report", month],
        ["Income", Number(report.totalIncome)],
        ["Expenses", Number(report.totalExpenses)],
        ["Net savings", Number(report.netSavings)],
        ["Recorded subscription expenses", subscriptionCosts],
        ...(report.previousPeriodHasData ? [["Expense change from previous month",
          (toCents(report.totalExpenses) - toCents(report.previousTotalExpenses)) / 100]] : []),
        [],
        ["Budget category", "Limit", "Spent", "Remaining"],
        ...budgets.map((budget) => [categoryLabel(budget.category), Number(budget.limitAmount),
          Number(budget.spent), Number(budget.remaining)]),
        [],
        ["Spending category", "Total"],
        ...categories.map((category) => [categoryLabel(category.category), Number(category.total)]),
        [],
        ...((report.insights || []).map((insight) => ["Spending insight", insight])),
        [],
        ["Current goal progress at export", "Saved", "Target", "Deadline"],
        ...(goals || []).map((goal) => [goal.name, Number(goal.savedAmount), Number(goal.targetAmount), goal.deadline]),
        ...(goals === null ? [["Goal progress unavailable"]] : []),
        ["Next month", nextStep],
      ]));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel" aria-labelledby="monthly-report-download">
    <h2 className="panel-title" id="monthly-report-download">Monthly financial report</h2>
    <button className="btn btn--secondary" type="button" onClick={download} disabled={busy}>
      {busy ? "Preparing report…" : "Download monthly report (CSV)"}
    </button>
    {error && <p role="alert">Could not prepare the report. Try again.</p>}
  </section>;
}
