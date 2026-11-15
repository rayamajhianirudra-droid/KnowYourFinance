// Turns the backend's batch upload response into the numbers the upload
// page shows. Kept apart from the component so it can be tested alone.

/** Counts and totals for one file's import summary. */
function summarizeOne(result) {
  const transactions = result.transactions || [];
  const dates = transactions.map((t) => t.date).sort();
  return {
    count: result.transactionsSaved,
    // Every readable row was already on record: the same file again.
    alreadyImported:
      result.transactionsSaved === 0 && result.duplicatesSkipped > 0 &&
      result.duplicatesSkipped >= result.rowsParsed,
    dateRange: dates.length > 0 ? `${dates[0]} – ${dates[dates.length - 1]}` : "—",
    totalIncome: transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    totalExpenses: transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    rowsRedacted: result.rowsRedacted,
    duplicatesSkipped: result.duplicatesSkipped,
    rowsSkipped: result.rowsSkipped,
  };
}

/** Turns the batch response into one row per file plus totals across the files that worked. */
export function summarizeBatch(response) {
  const files = (response.files || []).map((f) => ({
    fileName: f.fileName,
    success: f.success,
    message: f.message,
    ...(f.success && f.result ? summarizeOne(f.result) : {}),
  }));
  const ok = files.filter((f) => f.success);
  const sum = (key) => ok.reduce((total, f) => total + (f[key] || 0), 0);
  const allDates = ok.flatMap((f) => (f.dateRange && f.dateRange !== "—" ? f.dateRange.split(" – ") : [])).sort();
  return {
    files,
    okCount: ok.length,
    failedCount: files.length - ok.length,
    count: sum("count"),
    alreadyImportedCount: ok.filter((f) => f.alreadyImported).length,
    totalIncome: sum("totalIncome"),
    totalExpenses: sum("totalExpenses"),
    rowsRedacted: sum("rowsRedacted"),
    duplicatesSkipped: sum("duplicatesSkipped"),
    rowsSkipped: sum("rowsSkipped"),
    dateRange: allDates.length > 0 ? `${allDates[0]} – ${allDates[allDates.length - 1]}` : "—",
  };
}
