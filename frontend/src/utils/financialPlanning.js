import { categoryLabel } from "./format";
import { addOneMonth, daysBetween, normalizeDescription } from "./recurring";

const DAY_MS = 86_400_000;
const DISCRETIONARY = new Set(["DINING", "SHOPPING", "ENTERTAINMENT", "TRAVEL"]);

export function shiftDay(day, offset) {
  return new Date(Date.parse(day) + offset * DAY_MS).toISOString().slice(0, 10);
}

export function toCents(value) {
  return Math.round(Number(value) * 100);
}

export function summarizeHistory(rows, today) {
  const start = shiftDay(today, -90);
  const yesterday = shiftDay(today, -1);
  const previousStart = shiftDay(today, -180);
  const categories = new Map();
  const merchants = new Map();
  const expensesByDay = new Map();
  const previousCategories = new Map();
  let yesterdaySpending = 0;
  let recentExpenses = 0;
  let recentIncome = 0;
  let earliest = today;

  for (const row of rows) {
    const amount = toCents(row.amount);
    if (!row.date || row.date > today || !Number.isSafeInteger(amount) || amount <= 0 ||
        row.category === "TRANSFER") continue;
    if (row.date < earliest) earliest = row.date;

    if (row.date === yesterday && row.type === "EXPENSE") yesterdaySpending += amount;
    if (row.date >= today) continue;
    if (row.date < start) {
      if (row.date >= previousStart && row.type === "EXPENSE") {
        previousCategories.set(row.category, (previousCategories.get(row.category) || 0) + amount);
      }
      continue;
    }
    if (row.type === "INCOME") recentIncome += amount;
    if (row.type !== "EXPENSE") continue;
    recentExpenses += amount;
    categories.set(row.category, (categories.get(row.category) || 0) + amount);
    expensesByDay.set(row.date, (expensesByDay.get(row.date) || 0) + amount);
    const merchant = normalizeDescription(row.description);
    if (merchant) merchants.set(merchant, (merchants.get(merchant) || 0) + 1);
  }

  const observedDays = Math.min(90, daysBetween(earliest, today));
  const days = Array.from({ length: 7 }, () => ({ count: 0, expense: 0 }));
  for (let offset = observedDays; offset > 0; offset -= 1) {
    const date = shiftDay(today, -offset);
    const weekday = new Date(date).getUTCDay();
    days[weekday].count += 1;
    days[weekday].expense += expensesByDay.get(date) || 0;
  }

  const average = (entries) => {
    const count = entries.reduce((sum, day) => sum + day.count, 0);
    return count ? Math.round(entries.reduce((sum, day) => sum + day.expense, 0) / count) : 0;
  };
  const growing = earliest <= previousStart
    ? [...categories].filter(([category, total]) => {
      const before = previousCategories.get(category);
      return before && total >= before * 1.2;
    }).sort((a, b) => b[1] - a[1])
    : [];

  return {
    yesterdaySpending,
    observedDays,
    recentExpenses,
    recentIncome,
    categories,
    costlyDay: days.map((day, index) => ({ index, amount: average([day]) }))
      .sort((a, b) => b.amount - a.amount)[0],
    weekendAverage: average([days[0], days[6]]),
    weekdayAverage: average(days.slice(1, 6)),
    frequentMerchant: [...merchants].sort((a, b) => b[1] - a[1])[0],
    growingCategory: growing[0]?.[0],
  };
}

export function spendingCuts(history, target) {
  if (history.observedDays < 30) return [];
  let remaining = target;
  const recommendations = [];
  for (const [category, spending] of [...history.categories].sort((a, b) => b[1] - a[1])) {
    if (!DISCRETIONARY.has(category)) continue;
    const monthly = Math.round(spending * 30 / history.observedDays);
    const savings = Math.min(remaining, Math.floor(monthly / 4));
    if (savings <= 0) continue;
    recommendations.push({ category, monthly, savings });
    remaining -= savings;
  }
  return recommendations;
}

export function upcomingBills(bills, today, days) {
  const end = shiftDay(today, days - 1);
  const upcoming = [];
  for (const bill of bills) {
    // Old or missed predictions require review before they count as commitments.
    for (let date = bill.nextDate; date >= today && date <= end; date = addOneMonth(date)) {
      upcoming.push({ ...bill, date });
    }
  }
  return upcoming.sort((a, b) => a.date.localeCompare(b.date));
}

export function safeToSpend({ balance, reserve, budgets, bills, month }) {
  const billTotal = bills.reduce((sum, bill) => sum + toCents(bill.amount), 0);
  const budgetTotal = budgets.reduce((sum, budget) => {
    const overlapping = bills.filter((bill) => bill.category === budget.category && bill.date.startsWith(month))
      .reduce((total, bill) => total + toCents(bill.amount), 0);
    return sum + Math.max(0, toCents(budget.remaining) - overlapping);
  }, 0);
  return { billTotal, budgetTotal, available: Math.max(0, balance - reserve - billTotal - budgetTotal) };
}

export function forecast(history, balance, bills, rows, today) {
  if (history.observedDays < 60) return [];
  const knownBills = new Set(bills.filter((bill) => bill.nextDate >= today).map((bill) => bill.key));
  const start = shiftDay(today, -90);
  const historicalBills = rows.filter((row) => row.type === "EXPENSE" && row.category !== "TRANSFER" &&
      row.date >= start && row.date < today && knownBills.has(normalizeDescription(row.description)))
    .reduce((total, row) => total + toCents(row.amount), 0);
  const dailyNet = (history.recentIncome - Math.max(0, history.recentExpenses - historicalBills)) /
    history.observedDays;
  const scheduled = upcomingBills(bills, today, 90);
  let projected = balance;
  let lowest = balance;
  const points = [];
  for (let day = 1; day <= 90; day += 1) {
    const billDay = shiftDay(today, day - 1);
    const billsDue = scheduled.filter((bill) => bill.date === billDay)
      .reduce((sum, bill) => sum + toCents(bill.amount), 0);
    projected += dailyNet - billsDue;
    lowest = Math.min(lowest, projected);
    if (day % 30 === 0) points.push({ day, balance: Math.round(projected), shortage: lowest < 0 });
  }
  return points;
}

export function spendingAlerts(rows, today) {
  const start = shiftDay(today, -90);
  const recent = shiftDay(today, -6);
  const priorDailyTotals = new Map();
  const recentTotals = new Map();
  const groups = new Map();
  const priorByCategory = new Map();
  const alerts = new Set();
  const expenses = rows.filter((row) => row.type === "EXPENSE" && row.category !== "TRANSFER" &&
    row.date >= start && row.date <= today && Number(row.amount) > 0);
  for (const row of expenses) {
    const amount = toCents(row.amount);
    const name = normalizeDescription(row.description);
    if (name) {
      const fingerprint = JSON.stringify([row.date, name, amount]);
      if (row.date >= recent && groups.has(fingerprint)) {
        alerts.add(`Possible duplicate: ${row.description} on ${row.date}.`);
      }
      groups.set(fingerprint, row.id);
    }
    if (row.date >= recent) {
      recentTotals.set(row.category, (recentTotals.get(row.category) || 0) + amount);
      continue;
    }
    priorDailyTotals.set(row.category, (priorDailyTotals.get(row.category) || 0) + amount);
    const prior = priorByCategory.get(row.category) || [];
    prior.push(amount);
    priorByCategory.set(row.category, prior);
  }
  for (const row of expenses.filter((expense) => expense.date >= recent)) {
    const prior = priorByCategory.get(row.category) || [];
    if (prior.length < 5) continue;
    prior.sort((a, b) => a - b);
    const typical = prior[Math.floor(prior.length / 2)];
    const amount = toCents(row.amount);
    if (amount >= Math.max(typical * 3, typical + 5000)) {
      alerts.add(`Unusually large for this category: ${row.description} on ${row.date}.`);
    }
  }
  const subscriptionGroups = new Map();
  for (const row of expenses) {
    if (row.category !== "SUBSCRIPTIONS") continue;
    const name = normalizeDescription(row.description);
    if (!name) continue;
    const charges = subscriptionGroups.get(name) || [];
    charges.push(row);
    subscriptionGroups.set(name, charges);
  }
  for (const charges of subscriptionGroups.values()) {
    charges.sort((a, b) => a.date.localeCompare(b.date));
    const [earlier, previous, latest] = charges.slice(-3);
    if (!latest || latest.date < recent) continue;
    const firstGap = daysBetween(earlier.date, previous.date);
    const secondGap = daysBetween(previous.date, latest.date);
    const baseline = toCents(previous.amount);
    if (firstGap >= 20 && firstGap <= 45 && secondGap >= 20 && secondGap <= 45 &&
        Math.abs(toCents(earlier.amount) - baseline) <= Math.max(100, baseline * 0.05) &&
        toCents(latest.amount) - baseline >= Math.max(100, baseline * 0.05)) {
      alerts.add(`Possible subscription price increase: ${latest.description} on ${latest.date}.`);
    }
  }
  const hasBaseline = rows.some((row) => row.date <= start && row.category !== "TRANSFER");
  if (hasBaseline) {
    const priorDays = daysBetween(start, recent);
    for (const [category, spending] of recentTotals) {
      if ((priorByCategory.get(category)?.length || 0) < 5) continue;
      const typical = priorDailyTotals.get(category) * 7 / priorDays;
      if (spending >= Math.max(typical * 1.5, typical + 5000)) {
        alerts.add(`Seven-day ${categoryLabel(category)} spending is above your recent weekly average.`);
      }
    }
  }
  return [...alerts].slice(0, 5);
}

export function goalProgress(goal, today, monthlyCashFlow) {
  const saved = toCents(goal.savedAmount);
  const target = toCents(goal.targetAmount);
  const remaining = Math.max(0, target - saved);
  const days = daysBetween(today, goal.deadline);
  const required = remaining === 0 ? 0 : days > 0 ? Math.ceil(remaining * 30 / days) : null;
  const projectedDays = monthlyCashFlow > 0 ? Math.ceil(remaining * 30 / monthlyCashFlow) : Infinity;
  return {
    percentage: Math.min(100, Math.floor(saved * 100 / target)),
    remaining,
    required,
    estimatedDate: remaining > 0 && projectedDays <= daysBetween(today, "9999-12-31")
      ? shiftDay(today, projectedDays) : null,
    feasible: required !== null && required <= monthlyCashFlow,
  };
}
