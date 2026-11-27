import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("../utils/ocr", () => ({ readReceiptText: vi.fn() }));

import App from "../App";
import { readReceiptText } from "../utils/ocr";

const RECEIPT = `WALMART
BANANAS      F  1.24
SAMSUNG TV   X 298.76
TOTAL           300.00
09/03/26`;

const charge = { id: 7, type: "EXPENSE", date: "2026-09-03", description: "WALMART SUPERCENTER", amount: 300, category: "GROCERIES" };

let calls;

beforeEach(() => {
  calls = [];
  window.scrollTo = vi.fn();
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:r"), revokeObjectURL: vi.fn() });
  globalThis.fetch = vi.fn().mockImplementation((url, options = {}) => {
    if (String(url).endsWith("/auth/csrf")) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ token: "t", headerName: "X-CSRF-TOKEN" }) });
    }
    calls.push([String(url), options.method ?? "GET"]);
    let body = [];
    if (String(url).includes("/dashboard/report")) {
      body = { totalIncome: 0, totalExpenses: 0, netSavings: 0, categoryBreakdown: [], insights: [], previousPeriodHasData: false };
    } else if (String(url).startsWith("/api/transactions") && !String(url).includes("/split")) {
      body = [charge];
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete globalThis.fetch;
  vi.clearAllMocks();
});

function pickPhoto() {
  fireEvent.change(screen.getByLabelText("Receipt photo"), {
    target: { files: [new File(["x"], "r.jpg", { type: "image/jpeg" })] },
  });
}

describe("scan receipt entry points", () => {
  it("sits next to Add transaction on the Dashboard", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    expect(screen.getByRole("button", { name: "Add transaction" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scan receipt" }));
    expect(screen.getByRole("dialog", { name: "Scan a receipt" })).toBeTruthy();
  });

  it("is offered on the Add Transaction page too", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Add Transaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Scan a receipt instead" }));
    expect(screen.getByRole("dialog", { name: "Scan a receipt" })).toBeTruthy();
  });

  it("finds the matching charge from any page, saves, and shows the split lines", async () => {
    readReceiptText.mockResolvedValue(RECEIPT);
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.click(screen.getByRole("button", { name: "Scan receipt" }));
    pickPhoto();

    // The charge was loaded by the scanner itself, since the Dashboard has no list.
    const target = await screen.findByLabelText(/WALMART SUPERCENTER charge on 2026-09-03/);
    await waitFor(() => expect(target.checked).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));

    expect(await screen.findByText("Receipt added to WALMART SUPERCENTER.")).toBeTruthy();
    expect(calls).toContainEqual(["/api/transactions/7/split", "POST"]);
    expect(screen.getByRole("heading", { level: 1, name: "Transactions" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears the message when the person moves to another page", async () => {
    readReceiptText.mockResolvedValue(RECEIPT);
    render(<App />);
    await screen.findByRole("navigation", { name: "Main" });
    fireEvent.click(screen.getByRole("button", { name: "Scan receipt" }));
    pickPhoto();
    await screen.findByLabelText("Store");
    fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));
    await screen.findByText("Receipt added to WALMART SUPERCENTER.");

    fireEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Dashboard" }));
    expect(screen.queryByText("Receipt added to WALMART SUPERCENTER.")).toBeNull();
  });
});
