// Plain-language answers to "why was this month different?", worked out
// from the transactions already on the page. Money that only moves between
// the person's own accounts (category TRANSFER) is not spending, so it is
// left out everywhere here.

import { categoryLabel } from "./format";
import { normalizeDescription } from "./recurring";

const FEE_WORDS = [
  "overdraft", "service fee", "nsf fee", "insufficient funds", "late fee", "service charge", "monthly fee",
  "maintenance fee", "atm fee", "foreign transaction fee", "interest charge", "finance charge",
  "annual fee", "wire fee",
];

function cents(value) {
  return Math.round(Number(value) * 100);
}

function monthKey(date) {
  return date.slice(0, 7);
}

export function previousMonthKey(year, month) {
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isFee(row) {
  const text = String(row.description ?? "").toLowerCase();
  return FEE_WORDS.some((word) => text.includes(word));
}

function spending(rows, key) {
  return rows.filter((row) => row.type === "EXPENSE" && row.category !== "TRANSFER" &&
    Number(row.amount) > 0 && monthKey(row.date) === key);
}

function totalsByCategory(rows) {
  const totals = new Map();
  for (const row of rows) {
    const category = row.category ?? "OTHER";
    totals.set(category, (totals.get(category) ?? 0) + cents(row.amount));
  }
  return totals;
}

/**
 * Compares one month with the one before it. Returns null when there is
 * nothing to say (no spending that month). Amounts are in cents.
 */
export function explainMonth(rows, year, month) {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const current = spending(rows, key);
  if (current.length === 0) return null;
  const previous = spending(rows, previousMonthKey(year, month));

  const total = current.reduce((sum, row) => sum + cents(row.amount), 0);
  const previousTotal = previous.reduce((sum, row) => sum + cents(row.amount), 0);

  const now = totalsByCategory(current);
  const before = totalsByCategory(previous);
  const drivers = [...new Set([...now.keys(), ...before.keys()])]
    .map((category) => ({ category, delta: (now.get(category) ?? 0) - (before.get(category) ?? 0) }))
    .filter((item) => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const byMerchant = new Map();
  for (const row of current) {
    const name = normalizeDescription(row.description) || "other";
    const entry = byMerchant.get(name) ?? { name, count: 0, total: 0, label: row.description };
    entry.count += 1;
    entry.total += cents(row.amount);
    byMerchant.set(name, entry);
  }
  const repeated = [...byMerchant.values()].filter((m) => m.count >= 3)
    .sort((a, b) => b.total - a.total)[0] ?? null;

  const fees = current.filter(isFee);
  return {
    total,
    previousTotal,
    hasPrevious: previous.length > 0,
    drivers,
    repeated,
    fees: { count: fees.length, total: fees.reduce((sum, row) => sum + cents(row.amount), 0) },
  };
}

function money(centsValue) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(centsValue) / 100);
}

/** Turns the numbers from explainMonth into a few short sentences. */
export function monthSentences(story) {
  if (!story) return [];
  const lines = [];
  if (story.hasPrevious) {
    const diff = story.total - story.previousTotal;
    if (Math.abs(diff) < 100) {
      lines.push("You spent about the same as the month before.");
    } else {
      lines.push(`You spent ${money(diff)} ${diff > 0 ? "more" : "less"} than the month before.`);
    }
    for (const driver of story.drivers) {
      const word = driver.delta > 0 ? "up" : "down";
      lines.push(`${categoryLabel(driver.category)} was ${word} ${money(driver.delta)}.`);
    }
  } else {
    lines.push("This is your first month with spending, so there is nothing to compare it with yet.");
  }
  if (story.repeated) {
    lines.push(`${story.repeated.count} charges at ${story.repeated.label} added up to ${money(story.repeated.total)}.`);
  }
  if (story.fees.count > 0) {
    lines.push(`${story.fees.count === 1 ? "A bank fee or interest charge" : `${story.fees.count} bank fees or interest charges`} cost you ${money(story.fees.total)}.`);
  }
  return lines;
}
