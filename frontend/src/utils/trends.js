// Helpers for the trend charts.

/** Removes the empty months at the start. Keeps everything if none has data. */
export function trimLeadingEmptyMonths(months) {
  const first = months.findIndex((m) => Number(m.totalIncome) > 0 || Number(m.totalExpenses) > 0);
  return first <= 0 ? months : months.slice(first);
}
