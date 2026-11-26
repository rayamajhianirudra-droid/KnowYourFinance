/**
 * Money maths for the split dialog. Everything is done in whole cents so
 * that 0.1 + 0.2 style rounding never decides whether a receipt balances.
 */

/** Turns what the person typed into cents, or null when it is not a usable amount. */
export function toCents(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

export function fromCents(cents) {
  return (cents / 100).toFixed(2);
}

/** How many cents of the receipt are not given to a line yet. */
export function remainingCents(totalCents, lines) {
  const used = lines.reduce((sum, line) => sum + (toCents(line.amount) ?? 0), 0);
  return totalCents - used;
}

/**
 * Whether the lines can be saved: every amount is a positive number and
 * together they equal the receipt total exactly.
 */
export function splitIsValid(totalCents, lines) {
  if (lines.length < 2) return false;
  if (!lines.every((line) => (toCents(line.amount) ?? 0) > 0)) return false;
  return remainingCents(totalCents, lines) === 0;
}

/** Shapes the dialog lines into the request the API expects. */
export function toSplitParts(lines) {
  return lines.map((line) => ({
    amount: fromCents(toCents(line.amount)),
    category: line.category,
    label: line.label.trim(),
  }));
}
