/**
 * Small helpers for turning a bank description into a merchant name that
 * can be remembered ("STARBUCKS #4521" becomes "starbucks"), and for
 * spotting stores that sell everything (Walmart, Target, Costco).
 */

/** Stores whose receipts often mix several kinds of purchases. */
const MIXED_STORES = [
  "walmart", "target", "costco", "sam's club", "sams club", "amazon",
  "meijer", "kmart", "fred meyer", "walgreens", "cvs",
];

export function isMixedStore(description) {
  const text = String(description ?? "").toLowerCase();
  return MIXED_STORES.some((name) => text.includes(name));
}

/**
 * Picks the part of a description worth remembering: the first words,
 * without store numbers, symbols or card digits. A long first word
 * ("starbucks") is enough on its own; a short one gets a second word
 * ("whole foods"). The person can still edit the result.
 */
export function suggestPattern(description) {
  const words = String(description ?? "")
    .toLowerCase()
    .replace(/[^a-z' ]+/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 1);
  if (words.length === 0) return "";
  if (words[0].length >= 6 || words.length === 1) return words[0];
  return `${words[0]} ${words[1]}`;
}

/** How many other transactions a pattern would cover that are not already in this category. */
export function countOthers(transactions, pattern, category, excludeId) {
  const needle = pattern.trim().toLowerCase();
  if (needle.length < 2) return 0;
  return transactions.filter(
    (t) =>
      t.id !== excludeId &&
      !t.splitGroup &&
      String(t.description ?? "").toLowerCase().includes(needle) &&
      (t.category ?? "OTHER") !== category
  ).length;
}
