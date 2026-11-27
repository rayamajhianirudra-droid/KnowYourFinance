/**
 * Builds a small, made-up bank statement so someone can try the app
 * without using their own data. It covers the current month and the two
 * before it, so the trends, recurring bills and category charts all have
 * something to show, and it includes a Walmart charge to try splitting.
 * Nothing in it is real.
 */

const MONTHS_OF_DATA = 3;

// [day of month, description, amount, whether the amount changes a little each month]
const ROWS = [
  [1, "PAYROLL DEPOSIT ACME CORP", 1650.0, false],
  [15, "PAYROLL DEPOSIT ACME CORP", 1650.0, false],
  [1, "APARTMENT RENT", -1150.0, false],
  [3, "WALMART SUPERCENTER #1842", -96.4, true],
  [4, "STARBUCKS #4521", -5.75, false],
  [5, "SHELL OIL 57444", -42.18, true],
  [6, "NETFLIX.COM", -15.49, false],
  [7, "SPOTIFY USA", -10.99, false],
  [7, "KROGER #0312", -68.22, true],
  [9, "XCEL ENERGY AUTOPAY", -74.6, true],
  [10, "CHIPOTLE 1021", -13.85, true],
  [11, "STARBUCKS #4521", -6.25, false],
  [12, "TARGET 00012345", -54.3, true],
  [14, "UBER *TRIP", -18.4, true],
  [16, "COSTCO WHSE #118", -132.77, true],
  [18, "CVS PHARMACY #4410", -23.15, true],
  [19, "KROGER #0312", -54.1, true],
  [20, "STARBUCKS #4521", -5.75, false],
  [21, "AMAZON.COM*2K4TY", -39.99, true],
  [22, "SHELL OIL 57444", -38.9, true],
  [24, "MCDONALDS F4812", -9.42, true],
  [27, "CITY WATER UTILITY", -38.0, false],
];

// Each older month nudges the changing amounts a little, so charts are not flat.
const DRIFT = [1, 1.08, 0.93];

function pad(n) {
  return String(n).padStart(2, "0");
}

/** The statement as CSV text. `now` is a Date, so tests can pin it. */
export function buildSampleCsv(now = new Date()) {
  const lines = ["Date,Description,Amount"];
  for (let back = MONTHS_OF_DATA - 1; back >= 0; back--) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const isCurrent = back === 0;
    for (const [day, description, base, drifts] of ROWS) {
      // Nothing is dated in the future, so early in the month the later
      // charges are pulled back to today.
      const used = isCurrent ? Math.min(day, now.getDate()) : day;
      const amount = drifts ? Math.round(base * DRIFT[back] * 100) / 100 : base;
      const date = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(used)}`;
      lines.push(`${date},${description},${amount.toFixed(2)}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function buildSampleFile(now = new Date()) {
  return new File([buildSampleCsv(now)], "sample-data.csv", { type: "text/csv" });
}
