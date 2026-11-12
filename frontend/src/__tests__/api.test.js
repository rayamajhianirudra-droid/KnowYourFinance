import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addTransaction,
  getMonthlyReport,
  getReportRange,
  getTrends,
  updateTransaction,
  uploadStatement,
} from "../api";

// Replaces the browser's fetch with a fake so these tests never need a
// running backend. Each test says what the "server" answers.
function respondWith(status, body) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new Error("no body")) : Promise.resolve(body)),
  };
  globalThis.fetch = vi.fn().mockResolvedValue(response);
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => delete globalThis.fetch);

describe("report requests", () => {
  it("asks for the right month and returns the report", async () => {
    respondWith(200, { totalIncome: 100 });
    const report = await getMonthlyReport(2026, 9);
    expect(report.totalIncome).toBe(100);
    expect(globalThis.fetch.mock.calls[0][0]).toBe("/api/dashboard/report?userId=1&year=2026&month=9");
  });

  it("passes a custom date range through unchanged", async () => {
    respondWith(200, {});
    await getReportRange("2026-09-01", "2026-09-15");
    expect(globalThis.fetch.mock.calls[0][0]).toContain("start=2026-09-01&end=2026-09-15");
  });

  it("defaults the trend chart to six months", async () => {
    respondWith(200, []);
    await getTrends(2026, 9);
    expect(globalThis.fetch.mock.calls[0][0]).toContain("monthsBack=6");
  });

  it("throws a readable error when the server fails", async () => {
    respondWith(500);
    await expect(getMonthlyReport(2026, 9)).rejects.toThrow("Failed to load report (500)");
  });
});

describe("uploadStatement", () => {
  it("sends the file as multipart form data to the upload endpoint", async () => {
    respondWith(200, { transactionsSaved: 3 });
    const file = new File(["Date,Description,Amount"], "s.csv", { type: "text/csv" });
    const result = await uploadStatement(file);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe("/api/statements/upload?userId=1&preview=false");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(result.transactionsSaved).toBe(3);
  });

  it("uses preview mode when asked", async () => {
    respondWith(200, {});
    await uploadStatement(new File(["x"], "s.csv"), { preview: true });
    expect(globalThis.fetch.mock.calls[0][0]).toContain("preview=true");
  });

  it("shows the backend's own message, such as the 10MB limit", async () => {
    respondWith(400, { message: "Uploaded file is too large (10MB limit)" });
    await expect(uploadStatement(new File(["x"], "s.csv"))).rejects.toThrow(
      "Uploaded file is too large (10MB limit)"
    );
  });

  it("falls back to the status code when the error has no body", async () => {
    respondWith(502);
    await expect(uploadStatement(new File(["x"], "s.csv"))).rejects.toThrow("Upload failed (502)");
  });
});

describe("addTransaction and updateTransaction", () => {
  const entry = { date: "2026-09-02", description: "Coffee", amount: 4.5, type: "EXPENSE", category: "DINING" };

  it("posts the entry together with the current user id", async () => {
    respondWith(200, { id: 9 });
    await addTransaction(entry);
    const [, options] = globalThis.fetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ ...entry, userId: 1 });
  });

  it("exposes field errors so the form can highlight the bad field", async () => {
    respondWith(400, { message: "Validation failed", fieldErrors: { amount: "must not be null" } });
    const error = await addTransaction({ ...entry, amount: null }).catch((e) => e);
    expect(error.message).toBe("Validation failed");
    expect(error.fieldErrors).toEqual({ amount: "must not be null" });
  });

  it("updates by id with PUT", async () => {
    respondWith(200, { id: 9 });
    await updateTransaction(9, entry);
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe("/api/transactions/9");
    expect(options.method).toBe("PUT");
  });
});
