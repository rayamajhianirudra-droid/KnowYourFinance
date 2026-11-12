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
