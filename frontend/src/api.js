// A thin wrapper around fetch() for talking to the Spring Boot backend.
// Keeping every API call in one file means: (1) the base URL only
// lives in one place, (2) every component imports plain async
// functions instead of repeating fetch() boilerplate, and (3) when
// real authentication arrives, the "attach the logged-in user's
// token" logic only has to be added here, not in every component.

// Where the backend lives. By default we call the relative address /api,
// which works in both setups we use: the Vite dev server forwards /api
// to the backend on port 8080 (see vite.config.js), and in Docker the
// web server forwards /api to the backend container (see nginx.conf).
// To point at a backend somewhere else, set VITE_API_BASE_URL when
// building, for example https://api.example.com/api.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// TEMPORARY: there's no login yet (a deliberate decision - see
// backend build-log 01), so every request pretends to be "user 1".
// Once real accounts exist, this constant goes away and the signed-in
// user's id is used instead.
export const CURRENT_USER_ID = 1;

/**
 * Uploads a statement CSV file. Returns the backend's
 * StatementImportResponse: how many rows were parsed/saved/redacted,
 * plus the actual transactions that got created.
 */
export async function uploadStatement(file, { preview = false } = {}) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE}/statements/upload?userId=${CURRENT_USER_ID}&preview=${preview}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    // The backend explains itself, for example "Uploaded file is too large
    // (10MB limit)". Show that instead of a bare status code.
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Upload failed (${response.status})`);
  }
  return response.json();
}

// The most statements the upload page accepts at once, for example a
// year of monthly statements. The backend enforces the same limit.
export const MAX_UPLOAD_FILES = 12;

// File types the backend can read. Used for the file picker's filter and
// for the text on the upload page.
export const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".txt", ".xlsx"];

/**
 * Uploads up to 12 statements in one request. Returns the backend's
 * BatchImportResponse: one entry per file with either an import summary
 * or a message saying why that file failed, so one bad file does not
 * hide the results of the others.
 */
export async function uploadStatements(files, { preview = false } = {}) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(
    `${API_BASE}/statements/upload-batch?userId=${CURRENT_USER_ID}&preview=${preview}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Upload failed (${response.status})`);
  }
  return response.json();
}

/**
 * Fetches the month/year income-vs-expense report - the app's core
 * differentiator feature.
 */
export async function getMonthlyReport(year, month) {
  const response = await fetch(
    `${API_BASE}/dashboard/report?userId=${CURRENT_USER_ID}&year=${year}&month=${month}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load report (${response.status})`);
  }
  return response.json();
}

/**
 * Fetches a report for an arbitrary date range instead of a whole
 * calendar month - powers the dashboard's "Custom date range" period
 * option. start/end are "YYYY-MM-DD" strings.
 */
export async function getReportRange(start, end) {
  const response = await fetch(
    `${API_BASE}/dashboard/report-range?userId=${CURRENT_USER_ID}&start=${start}&end=${end}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load report (${response.status})`);
  }
  return response.json();
}

/**
 * Fetches several months of income/expense totals in one call - the
 * "spending trends over time" chart. monthsBack defaults to 6 on the
 * backend if not passed.
 */
export async function getTrends(year, month, monthsBack = 6) {
  const response = await fetch(
    `${API_BASE}/dashboard/trends?userId=${CURRENT_USER_ID}&year=${year}&month=${month}&monthsBack=${monthsBack}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load trends (${response.status})`);
  }
  return response.json();
}

/**
 * Adds a single transaction by hand - the path for cash spending (or
 * any income/expense with no statement line to parse). Hits the same
 * Transaction table statement uploads do, so it shows up in the
 * dashboard and category breakdown identically.
 */
export async function addTransaction({ date, description, amount, type, category }) {
  const response = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      description,
      amount,
      type,
      category,
      userId: CURRENT_USER_ID,
    }),
  });
  if (!response.ok) {
    // GlobalExceptionHandler (backend) returns { message, fieldErrors }
    // for a validation failure - surface that detail instead of just a
    // status code, so the form can point at the specific field that's
    // wrong ("amount is required") instead of a generic failure.
    const body = await response.json().catch(() => null);
    const err = new Error(body?.message || `Failed to add transaction (${response.status})`);
    err.fieldErrors = body?.fieldErrors || null;
    throw err;
  }
  return response.json();
}

/**
 * Edits an existing transaction - started out as just the category-fix
 * path (AutoCategorizer guessing wrong), now also the full edit path
 * (FR-403): date, description, amount, and category, without deleting
 * and re-adding the row.
 */
export async function updateTransaction(id, transaction) {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...transaction, userId: CURRENT_USER_ID }),
  });
  if (!response.ok) {
    // Same reasoning as addTransaction: surface which field was invalid
    // instead of just a status code, so an edit form can point at it.
    const body = await response.json().catch(() => null);
    const err = new Error(body?.message || `Failed to update transaction (${response.status})`);
    err.fieldErrors = body?.fieldErrors || null;
    throw err;
  }
  return response.json();
}

/**
 * Deletes a transaction (FR-404) - e.g. the user fixes a duplicate
 * import or removes something added by mistake.
 */
export async function deleteTransaction(id) {
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete transaction (${response.status})`);
  }
}

/**
 * Divides one transaction into several category lines (a Walmart receipt
 * with food and a TV, say). parts is [{ amount, category, label }] and the
 * amounts have to add up to the original total. Resolves to the new lines.
 */
export async function splitTransaction(id, parts) {
  const response = await fetch(`${API_BASE}/transactions/${id}/split`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parts }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Failed to split transaction (${response.status})`);
  }
  return response.json();
}

/** Puts a split receipt back together as one transaction. */
export async function joinSplit(id) {
  const response = await fetch(`${API_BASE}/transactions/${id}/split`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Failed to join transaction (${response.status})`);
  }
  return response.json();
}

/**
 * Lists every transaction for the current user, most recent logic
 * left to the backend/display layer (the API itself doesn't sort).
 */
export async function listTransactions() {
  const response = await fetch(
    `${API_BASE}/transactions?userId=${CURRENT_USER_ID}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load transactions (${response.status})`);
  }
  return response.json();
}

/**
 * Loads the saved profile. The backend answers with fullName set to null
 * until the person saves one.
 */
export async function getProfile() {
  const response = await fetch(`${API_BASE}/profile?userId=${CURRENT_USER_ID}`);
  if (!response.ok) {
    throw new Error(`Failed to load profile (${response.status})`);
  }
  return response.json();
}

/**
 * Saves the person's full name. Rejects with the backend's message, for
 * example "Enter your full name.", so the form can show it.
 */
export async function saveProfile(fullName) {
  const response = await fetch(`${API_BASE}/profile?userId=${CURRENT_USER_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.fieldErrors?.fullName || body?.message || `Could not save your name (${response.status})`);
  }
  return response.json();
}

// Budget limits are scoped to the same current user as transactions.
function budgetUrl(month, category) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${API_BASE}/budgets${category ? `/${encodeURIComponent(category)}` : ""}?userId=${CURRENT_USER_ID}&year=${year}&month=${monthNumber}`;
}
async function budgetResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.fieldErrors?.limitAmount || body?.message || `Budget request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}
export async function getBudgets(month) {
  return budgetResponse(await fetch(budgetUrl(month)));
}
export async function saveBudget(month, category, limitAmount) {
  return budgetResponse(await fetch(budgetUrl(month, category), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limitAmount }),
  }));
}
export async function removeBudget(month, category) {
  return budgetResponse(await fetch(budgetUrl(month, category), { method: "DELETE" }));
}

/**
 * How much data this person has stored, so the reset screen can say what
 * it is about to remove. Resolves to { transactions, budgets }.
 */
export async function getDataSummary() {
  const response = await fetch(`${API_BASE}/data/summary?userId=${CURRENT_USER_ID}`);
  if (!response.ok) {
    throw new Error(`Failed to load your data summary (${response.status})`);
  }
  return response.json();
}

/**
 * Permanently removes this person's transactions and budgets, and the saved
 * name too when includeName is true. The backend insists on the confirm
 * word, so a stray call can never wipe anything. Resolves to
 * { deletedTransactions, deletedBudgets, nameRemoved }.
 */
export async function resetData({ includeName = false } = {}) {
  const response = await fetch(
    `${API_BASE}/data?userId=${CURRENT_USER_ID}&confirm=DELETE&includeName=${includeName}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    let message = `Failed to delete your data (${response.status})`;
    try {
      const body = await response.json();
      if (body && body.message) message = body.message;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return response.json();
}
