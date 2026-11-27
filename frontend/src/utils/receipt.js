/**
 * Turns the text read from a receipt photo into a store, a date, a total
 * and a list of items. Receipt text from a photo is never perfect, so
 * every result here is only a first guess that the person reviews.
 */

const KNOWN_STORES = [
  "walmart", "target", "costco", "sam's club", "kroger", "safeway", "aldi", "whole foods",
  "trader joe's", "meijer", "publix", "cvs", "walgreens", "best buy", "home depot", "lowe's",
  "amazon", "cub foods", "hy-vee", "dollar general", "starbucks", "mcdonald's", "chipotle",
  "subway", "kwik trip", "holiday",
];

// Lines that carry a price but are not purchases.
const NOT_AN_ITEM =
  /\b(sub\s*-?\s*total|total|tax|change|cash|visa|master\s*card|mastercard|amex|discover|debit|credit|balance|tend(er|ered)?|payment|paid|items?\s+sold|savings|you\s+saved|card|approved|auth|ref|tip|gratuity|due|rounding)\b/i;

const PRICE = /(-?\d{1,6}[.,]\d{2})(?!\d)/g;
const HAS_PRICE = /\d{1,6}[.,]\d{2}(?!\d)/;

export function toNumber(text) {
  const value = Number(String(text).replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function lastPrice(line) {
  const matches = [...line.matchAll(PRICE)];
  if (matches.length === 0) return null;
  return toNumber(matches[matches.length - 1][1]);
}

/** Drops a one letter tax flag ("F", "T", "x") the register prints after an item. */
function dropTaxFlag(text) {
  const match = text.match(/^(.*\S)\s+[A-Za-z]$/);
  if (!match) return text;
  const isCapital = /[A-Z]$/.test(text);
  return isCapital || match[1].split(" ").length >= 2 ? match[1] : text;
}

function cleanLabel(text) {
  return dropTaxFlag(text
    .replace(/\b\d{4,}\b/g, " ") // product codes
    .replace(/\d+\s*@\s*/g, " ") // "2 @"
    .replace(/[^A-Za-z0-9'&%/. -]+/g, " ")
    .replace(/\s\.+\s/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function findStore(lines) {
  const top = lines.slice(0, 10);
  const joined = top.join(" ").toLowerCase();
  const known = KNOWN_STORES.find((name) => joined.includes(name.replace("'", "")) || joined.includes(name));
  if (known) return known.toUpperCase();
  for (const line of top) {
    const cleaned = cleanLabel(line);
    const letters = cleaned.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 3 && !HAS_PRICE.test(line) && !/^\d/.test(cleaned)) {
      return cleaned.toUpperCase();
    }
  }
  return "";
}

function validDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function findDate(text) {
  let match = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) {
    const found = validDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (found) return found;
  }
  match = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    const found = validDate(year, Number(match[1]), Number(match[2]));
    if (found) return found;
  }
  match = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (match) {
    return validDate(Number(match[3]), MONTHS.indexOf(match[1].toLowerCase()) + 1, Number(match[2]));
  }
  return "";
}

/** Reads receipt text into { merchant, date, total, tax, items }. */
export function parseReceipt(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let total = null;
  let tax = null;
  let subtotal = null;
  const items = [];

  for (const line of lines) {
    const price = lastPrice(line);
    const lower = line.toLowerCase();

    if (/sub\s*-?\s*total/.test(lower)) {
      if (price !== null) subtotal = price;
      continue;
    }
    if (/\b(total|amount\s+due|balance\s+due)\b/.test(lower) && !/\btax\b/.test(lower)) {
      if (price !== null) total = price;
      continue;
    }
    if (/\btax\b/.test(lower)) {
      if (price !== null) tax = (tax ?? 0) + price;
      continue;
    }
    if (price === null || price <= 0) continue;
    if (NOT_AN_ITEM.test(line)) continue;

    const priceText = [...line.matchAll(PRICE)].pop();
    const label = cleanLabel(line.slice(0, priceText.index));
    if (label.replace(/[^A-Za-z]/g, "").length < 2) continue;
    items.push({ label, amount: price });
  }

  const itemSum = round2(items.reduce((sum, item) => sum + item.amount, 0));
  if (total === null) {
    if (subtotal !== null) total = round2(subtotal + (tax ?? 0));
    else if (items.length > 0) total = round2(itemSum + (tax ?? 0));
  }

  return {
    merchant: findStore(lines),
    date: findDate(lines.join("\n")),
    total,
    tax,
    items,
  };
}

function titleCase(text) {
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .slice(0, 40);
}

/**
 * Builds the lines shown on the review screen. Whatever the items do not
 * cover (tax, fees) goes on one extra line so the lines still add up to
 * the receipt total.
 */
export function buildLines(parsed, categorize) {
  const lines = parsed.items.map((item) => {
    const { category, guessed } = categorize(item.label);
    return { label: titleCase(item.label), category, guessed, amount: item.amount.toFixed(2) };
  });
  if (parsed.total !== null) {
    const itemSum = round2(parsed.items.reduce((sum, item) => sum + item.amount, 0));
    const rest = round2(parsed.total - itemSum);
    if (rest > 0.004 && lines.length > 0) {
      const looksLikeTax = parsed.tax !== null && Math.abs(parsed.tax - rest) < 0.015;
      lines.push({
        label: looksLikeTax ? "Tax" : "Tax and other",
        category: "OTHER",
        guessed: false,
        amount: rest.toFixed(2),
      });
    }
  }
  return lines;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Finds stored purchases that this receipt probably belongs to: same
 * total, a date within a week, not already split. Best match first.
 */
export function findMatches(transactions, { totalCents, date, merchant }) {
  if (!totalCents) return [];
  const store = String(merchant ?? "").toLowerCase().split(/\s+/)[0] ?? "";
  const scored = [];
  for (const t of transactions) {
    if (t.type !== "EXPENSE" || t.splitGroup) continue;
    if (Math.round(Number(t.amount) * 100) !== totalCents) continue;
    let gap = 0;
    if (date) {
      gap = Math.abs(new Date(`${t.date}T00:00:00`) - new Date(`${date}T00:00:00`)) / DAY;
      if (!(gap <= 7)) continue;
    }
    const sameStore = store.length >= 3 && String(t.description).toLowerCase().includes(store);
    scored.push({ t, score: (sameStore ? 100 : 0) - gap });
  }
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.t);
}
