// Shared formatting helpers. Pulled out into its own file because
// Dashboard.jsx and TransactionList.jsx both had their own identical
// copy of formatCurrency - any component that needs to show a dollar
// amount imports it from here instead of redefining it.
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

export function formatCompactCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(amount));
}

/**
 * A short amount for a small calendar cell on a phone: "$150", "$1.2K", "$13K".
 * The exact figure stays in the day's label and in the details under the grid.
 */
export function formatDayCellCurrency(amount) {
  const value = Number(amount);
  if (value > 0 && value < 1) return "<$1";
  const dollars = Math.round(value);
  const compact = dollars >= 1000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: 0,
    // "$13K" fits a narrow cell where "$12.5K" would not.
    maximumFractionDigits: compact && !(dollars >= 10000 && dollars < 1000000) ? 1 : 0,
  }).format(compact ? value : dollars);
}

export function formatPercent(value, { signed = false } = {}) {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function categoryLabel(category) {
  if (!category) return "Other";
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// A restrained, coordinated palette for the category donut/legend/top-
// categories bars - greens, teals and sage tones drawn from the brand
// system, with a muted gold and brick for visual variety at the edges.
// Assigned by name (not index) so a given category is always the same
// color everywhere it appears, across every chart.
const CATEGORY_COLORS = {
  GROCERIES: "#236b55",
  DINING: "#c9a227",
  RENT_MORTGAGE: "#3f5f8f",
  UTILITIES: "#397b78",
  SUBSCRIPTIONS: "#6b8f7d",
  TRANSPORTATION: "#5c7a8a",
  SHOPPING: "#94a39c",
  ENTERTAINMENT: "#b5473c",
  HEALTHCARE: "#7d6b8f",
  EDUCATION: "#3f6b7b",
  TRAVEL: "#8a9a3f",
  INCOME: "#16865c",
  TRANSFER: "#64706b",
  OTHER: "#9aa39d",
};

export function categoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER;
}

export const CATEGORIES = [
  "GROCERIES", "DINING", "RENT_MORTGAGE", "UTILITIES", "SUBSCRIPTIONS",
  "TRANSPORTATION", "SHOPPING", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION",
  "TRAVEL", "INCOME", "TRANSFER", "OTHER",
];
