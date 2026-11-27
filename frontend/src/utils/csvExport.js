import { categoryLabel } from "./format";

const HEADERS = ["Date", "Description", "Category", "Type", "Amount"];

// Escape CSV characters and prevent spreadsheet formula injection.
function escapeCSV(value) {
  // Amounts are generated numbers, so keep negative values numeric in spreadsheets.
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  let text = String(value ?? "");

  if (/^[\s]*[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

/** Turns transactions into CSV text. Expenses are written as negative amounts. */
export function transactionsToCsv(transactions) {
  const rows = transactions.map((transaction) => {
    const amount = Number(transaction.amount);

    return [
      transaction.date,
      transaction.description,
      categoryLabel(transaction.category ?? "OTHER"),
      transaction.type,
      transaction.type === "EXPENSE" ? -amount : amount,
    ];
  });

  return csvRows([HEADERS, ...rows]);
}

export function csvRows(rows) {
  return rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");
}

/** Saves the transactions as a CSV file through the browser's download. */
export function downloadTransactionsCsv(transactions) {
  const today = new Date().toLocaleDateString("en-CA");
  downloadCsv(`know-your-finance-${today}.csv`, transactionsToCsv(transactions));
}

export function downloadCsv(filename, content) {
  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  // Release the temporary download URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
