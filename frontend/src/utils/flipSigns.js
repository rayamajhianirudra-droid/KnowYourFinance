// Some credit card statements list purchases as positive numbers, which
// would be read as income. This spots that case from the preview totals and
// can swap every amount's sign in the file before it is uploaded again.
// The file itself is never changed on disk: a corrected copy is made.

const AMOUNT_HEADERS = ["amount", "transaction amount", "signed amount"];

/** True when nearly everything was read as income, which usually means purchases are positive. */
export function looksInverted(preview) {
  return Boolean(preview) && preview.count >= 5 && preview.totalIncome > 0 &&
    preview.totalExpenses <= preview.totalIncome * 0.05;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function writeDelimited(rows, delimiter) {
  const quote = (value) => (/["\r\n]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value);
  return rows.map((row) => row.map(quote).join(delimiter)).join("\n") + "\n";
}

/** Same number with the opposite sign, in the plain style the importer reads. */
export function negateAmount(text) {
  const raw = String(text).trim();
  if (raw === "") return raw;
  const bracketed = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw.replace(/[()$,\s]/g, "");
  const value = Number(cleaned);
  if (Number.isNaN(value)) return raw;
  const signed = bracketed ? -Math.abs(value) : value;
  const flipped = -signed;
  const places = (cleaned.split(".")[1] ?? "").length;
  return (Object.is(flipped, -0) ? 0 : flipped).toFixed(Math.max(places, 2));
}

/**
 * Returns a copy of the statement with the amount column's signs swapped, or
 * null when that cannot be done safely (a spreadsheet file, or a layout with
 * separate debit and credit columns, where the sign is not the problem).
 */
export async function flipStatementSigns(file) {
  const name = file.name.toLowerCase();
  if (!/\.(csv|tsv|txt)$/.test(name)) return null;
  const text = await file.text();
  const delimiter = name.endsWith(".tsv") || (name.endsWith(".txt") && text.split("\n")[0].includes("\t")) ? "\t" : ",";
  const rows = parseDelimited(text, delimiter).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length < 2) return null;
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const column = AMOUNT_HEADERS.map((alias) => header.indexOf(alias)).find((index) => index >= 0);
  if (column === undefined) return null;
  const flipped = rows.map((row, index) =>
    index === 0 || row.length <= column ? row : row.map((cell, i) => (i === column ? negateAmount(cell) : cell)));
  return new File([writeDelimited(flipped, delimiter)], file.name, { type: file.type || "text/csv" });
}
