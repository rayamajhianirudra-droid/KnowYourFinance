const API_BASE = "/api";

async function apiFetch(url, options = {}, { notifyExpiry = true } = {}) {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== "GET") {
    const response = await fetch(`${API_BASE}/auth/csrf`, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not secure this request. Try again.");
    const { token, headerName } = await response.json();
    headers.set(headerName, token);
  }
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  if (notifyExpiry && response.status === 401) {
    window.dispatchEvent(new Event("kyf-session-expired"));
  }
  return response;
}

export async function getAccountSession() {
  const response = await apiFetch(`${API_BASE}/auth/session`, {}, { notifyExpiry: false });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Could not check your session.");
  return response.json();
}

export async function accountCredentials(creating, email, password) {
  const action = creating ? "signup" : "signin";
  const response = await apiFetch(`${API_BASE}/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, { notifyExpiry: false });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.message || "Could not complete the request. Try again.");
  }
  return response.json();
}

export async function signOutAccount() {
  const response = await apiFetch(`${API_BASE}/auth/signout`, { method: "POST" });
  if (!response.ok && response.status !== 401) throw new Error("Could not sign out. Try again.");
}

/**
 * Uploads a statement CSV file. Returns the backend's
 * StatementImportResponse: how many rows were parsed/saved/redacted,
 * plus the actual transactions that got created.
 */
export async function uploadStatement(file, { preview = false } = {}) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch(
    `${API_BASE}/statements/upload?preview=${preview}`,
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

  const response = await apiFetch(
    `${API_BASE}/statements/upload-batch?preview=${preview}`,
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
  const response = await apiFetch(
    `${API_BASE}/dashboard/report?year=${year}&month=${month}`
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
  const response = await apiFetch(
    `${API_BASE}/dashboard/report-range?start=${start}&end=${end}`
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
  const response = await apiFetch(
    `${API_BASE}/dashboard/trends?year=${year}&month=${month}&monthsBack=${monthsBack}`
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
  const response = await apiFetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      description,
      amount,
      type,
      category,
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
  const response = await apiFetch(`${API_BASE}/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transaction),
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
  const response = await apiFetch(`${API_BASE}/transactions/${id}`, {
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
  const response = await apiFetch(
    `${API_BASE}/transactions`
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
  const response = await apiFetch(`${API_BASE}/profile`);
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
  const response = await apiFetch(`${API_BASE}/profile`, {
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
  return `${API_BASE}/budgets${category ? `/${encodeURIComponent(category)}` : ""}?year=${year}&month=${monthNumber}`;
}
async function budgetResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.fieldErrors?.limitAmount || body?.message || `Budget request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}
export async function getBudgets(month) {
  return budgetResponse(await apiFetch(budgetUrl(month)));
}
export async function saveBudget(month, category, limitAmount) {
  return budgetResponse(await apiFetch(budgetUrl(month, category), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limitAmount }),
  }));
}
export async function removeBudget(month, category) {
  return budgetResponse(await apiFetch(budgetUrl(month, category), { method: "DELETE" }));
}

/**
 * How much data this person has stored, so the reset screen can say what
 * it is about to remove. Resolves to { transactions, budgets }.
 */
export async function getDataSummary() {
  const response = await apiFetch(`${API_BASE}/data/summary`);
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
  const response = await apiFetch(
    `${API_BASE}/data?confirm=DELETE&includeName=${includeName}`,
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

async function planningRequest(path, method = "GET", data) {
  const response = await apiFetch(`${API_BASE}/planning/${path}`, {
    method,
    ...(data && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  });
  if (!response.ok) throw new Error("Could not complete the planning request.");
  if (response.status !== 204) return response.json();
}

export const listGoals = () => planningRequest("goals");
export const saveGoal = (goal, id) => id
  ? planningRequest(`goals/${encodeURIComponent(id)}`, "PUT", goal)
  : planningRequest("goals", "POST", goal);
export const removeGoal = (id) => planningRequest(`goals/${encodeURIComponent(id)}`, "DELETE");
export const listSubscriptionDecisions = () => planningRequest("subscriptions");
export const saveSubscriptionDecision = (merchantKey, status) =>
  planningRequest("subscriptions", "PUT", { merchantKey, status });
