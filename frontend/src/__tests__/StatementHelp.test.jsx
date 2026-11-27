import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import StatementHelp from "../components/StatementHelp";
import UploadStatement from "../components/UploadStatement";
import Dashboard from "../components/Dashboard";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("explains where to find a statement, with steps and a few banks", () => {
  render(<StatementHelp />);
  const summary = screen.getByText("Not sure how to get your statement? Show me how");
  expect(summary.tagName).toBe("SUMMARY");
  expect(screen.getByText(/Find Download, Export or Statements/)).toBeTruthy();
  expect(screen.getByText(/PDF files cannot be read/)).toBeTruthy();
  for (const bank of ["Chase", "Bank of America", "Wells Fargo", "Capital One", "Credit unions and others"]) {
    expect(screen.getByText(bank)).toBeTruthy();
  }
});

it("starts closed so it does not push the upload box down", () => {
  const { container } = render(<StatementHelp />);
  expect(container.querySelector("details").hasAttribute("open")).toBe(false);
});

it("links to a sample file the person can download", () => {
  render(<StatementHelp />);
  const link = screen.getByRole("link", { name: "Download a sample file" });
  expect(link.getAttribute("href")).toBe("/sample-statement.csv");
  expect(link.hasAttribute("download")).toBe(true);
});

it("the sample file has the layout the app reads", () => {
  const lines = readFileSync("public/sample-statement.csv", "utf8").trim().split("\n");
  expect(lines[0]).toBe("Date,Description,Amount");
  expect(lines.length).toBeGreaterThan(10);
  for (const line of lines.slice(1)) {
    expect(line).toMatch(/^2026-\d{2}-\d{2},[^,]+,-?\d+\.\d{2}$/);
  }
  const text = lines.join("\n");
  expect(text).toContain("WALMART SUPERCENTER");
  expect(lines.some((l) => l.startsWith("2026-10-01,PAYROLL"))).toBe(true);
});

it("shows on the Upload page before a file is chosen", () => {
  render(<UploadStatement />);
  expect(screen.getByText("Not sure how to get your statement? Show me how")).toBeTruthy();
});

it("puts the what-if panel at the bottom of the Dashboard, after the main sections", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 25, 12));
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const address = String(url);
    const body = address.includes("/transactions")
      ? [{ id: 1, date: "2026-11-10", amount: 50, description: "SHOP", type: "EXPENSE", category: "SHOPPING" }]
      : address.includes("/dashboard/report")
        ? { totalIncome: 3000, totalExpenses: 50, netSavings: 2950, categoryBreakdown: [], insights: [], previousPeriodHasData: false }
        : [];
    return { ok: true, status: 200, json: async () => body };
  }));
  render(<Dashboard fullName="AJ" refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} onViewTransactions={() => {}} />);

  const panel = await screen.findByRole("region", { name: "What if I hadn’t spent that?" });
  const recent = screen.getByRole("heading", { name: "Recent transactions" });
  // The what-if panel comes after the recent transactions list.
  expect(recent.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
