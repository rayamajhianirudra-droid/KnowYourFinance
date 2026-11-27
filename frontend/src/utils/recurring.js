// Finds expenses that repeat about once a month (rent, internet, subscriptions)
// from the transactions the app already holds. No backend work: it only looks at
// descriptions, amounts and dates.
//
// A charge counts as recurring when the same description shows up in at least
// three different months, the amounts stay within 15% of the typical amount, and
// the gaps between payments are roughly a month.

const MIN_MONTHS = 3;
const AMOUNT_TOLERANCE = 0.15;
const MIN_GAP_DAYS = 20;
const MAX_GAP_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Makes "NETFLIX 1234 [REDACTED]" and "Netflix 5678" count as the same bill. */
export function normalizeDescription(description) {
  return String(description || "")
    .toUpperCase()
    .replace(/\[REDACTED\]/g, " ")
    .replace(/[^A-Z]+/g, " ")
    .trim();
}

function parseDay(text) {
  const [y, m, d] = String(text).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The same day next month, or the last day of next month if it is shorter. */
export function addOneMonth(dateText) {
  const [y, m, d] = dateText.split("-").map(Number);
  const daysInNextMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(y, m, Math.min(d, daysInNextMonth)));
  return next.toISOString().slice(0, 10);
}

/** Whole days from one yyyy-mm-dd to another (negative if the second is earlier). */
export function daysBetween(fromText, toText) {
  return Math.round((parseDay(toText) - parseDay(fromText)) / DAY_MS);
}

/**
 * @param {Array<{description:string, amount:number|string, date:string, type:string, category?:string}>} transactions
 * @returns {Array<{key, description, category, amount, count, lastDate, nextDate}>} biggest first
 */
export function detectRecurring(transactions) {
  const groups = new Map();
  for (const t of transactions || []) {
    if (!t || t.type !== "EXPENSE" || t.category === "TRANSFER" || !t.date) continue;
    const key = normalizeDescription(t.description);
    const amount = Number(t.amount);
    if (!key || !Number.isFinite(amount) || amount <= 0) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...t, amount });
  }

  const found = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const months = new Set(list.map((t) => t.date.slice(0, 7)));
    if (months.size < MIN_MONTHS) continue;

    const typical = median(list.map((t) => t.amount));
    if (list.some((t) => Math.abs(t.amount - typical) > typical * AMOUNT_TOLERANCE)) continue;

    const gaps = [];
    for (let i = 1; i < list.length; i += 1) gaps.push(daysBetween(list[i - 1].date, list[i].date));
    // Two payments in one month (a gap under 20 days) means this is not a monthly bill.
    if (gaps.some((g) => g < MIN_GAP_DAYS || g > MAX_GAP_DAYS)) continue;

    const last = list[list.length - 1];
    found.push({
      key,
      description: last.description,
      category: last.category,
      amount: typical,
      count: list.length,
      lastDate: last.date,
      nextDate: addOneMonth(last.date),
    });
  }
  return found.sort((a, b) => b.amount - a.amount);
}

/** What the detected bills add up to in a typical month. */
export function monthlyTotal(bills) {
  return bills.reduce((sum, b) => sum + b.amount, 0);
}

/** "Due tomorrow", "Due in 5 days", or the date once it is further away. */
export function dueLabel(nextDate, today) {
  const days = daysBetween(today, nextDate);
  if (days < 0) return `Expected ${nextDate}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 14) return `Due in ${days} days`;
  return `Next ${nextDate}`;
}
