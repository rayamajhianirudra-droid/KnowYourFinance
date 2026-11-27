import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SampleDataButton from "../components/SampleDataButton";
import UploadStatement from "../components/UploadStatement";
import Dashboard from "../components/Dashboard";
import { buildSampleCsv } from "../utils/sampleData";
import * as api from "../api";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, uploadStatements: vi.fn(), listTransactions: vi.fn() };
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function parse(csv) {
  return csv.trim().split("\n").slice(1).map((line) => {
    const [date, description, amount] = line.split(",");
    return { date, description, amount: Number(amount) };
  });
}

describe("the sample statement", () => {
  const now = new Date(2026, 10, 27, 10); // Nov 27, 2026
  const rows = parse(buildSampleCsv(now));

  it("covers the current month and the two before it", () => {
    const months = new Set(rows.map((r) => r.date.slice(0, 7)));
    expect([...months].sort()).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("never dates anything in the future", () => {
    expect(rows.every((r) => r.date <= "2026-11-27")).toBe(true);
    const early = parse(buildSampleCsv(new Date(2026, 10, 3, 10)));
    expect(early.every((r) => r.date <= "2026-11-03")).toBe(true);
  });

  it("has income and spending, a Walmart charge to split, and bills that repeat", () => {
    expect(rows.some((r) => r.amount > 0)).toBe(true);
    expect(rows.some((r) => r.amount < 0)).toBe(true);
    expect(rows.filter((r) => r.description.startsWith("WALMART")).length).toBe(3);
    expect(rows.filter((r) => r.description === "NETFLIX.COM").map((r) => r.amount)).toEqual([-15.49, -15.49, -15.49]);
  });

  it("is a valid statement: a header, then dated rows with two decimal amounts", () => {
    const csv = buildSampleCsv(now);
    expect(csv.split("\n")[0]).toBe("Date,Description,Amount");
    for (const line of csv.trim().split("\n").slice(1)) {
      expect(line).toMatch(/^\d{4}-\d{2}-\d{2},[^,]+,-?\d+\.\d{2}$/);
    }
  });
});

describe("Try with sample data", () => {
  it("uploads the sample as a real import and tells the app it loaded", async () => {
    api.uploadStatements.mockResolvedValue({ files: [{ success: true, result: { transactionsSaved: 66 } }] });
    const onLoaded = vi.fn();
    render(<SampleDataButton onLoaded={onLoaded} />);

    fireEvent.click(screen.getByRole("button", { name: "Try with sample data" }));

    await waitFor(() => expect(onLoaded).toHaveBeenCalled());
    const [files, options] = api.uploadStatements.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("sample-data.csv");
    expect(options).toEqual({ preview: false });
  });

  it("says so when the sample is already loaded", async () => {
    api.uploadStatements.mockResolvedValue({ files: [{ success: true, result: { transactionsSaved: 0 } }] });
    const onLoaded = vi.fn();
    render(<SampleDataButton onLoaded={onLoaded} />);
    fireEvent.click(screen.getByRole("button", { name: "Try with sample data" }));

    expect((await screen.findByRole("status")).textContent).toContain("already loaded");
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it("shows why it failed and lets the person try again", async () => {
    api.uploadStatements.mockRejectedValue(new Error("Upload failed (500)"));
    render(<SampleDataButton onLoaded={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Try with sample data" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Upload failed (500)");
    expect(screen.getByRole("button", { name: "Try with sample data" }).disabled).toBe(false);
  });

  it("explains that nothing in it is real and how to clear it", () => {
    render(<SampleDataButton onLoaded={() => {}} />);
    expect(screen.getByText(/Nothing in it is real/)).toBeTruthy();
    expect(screen.getByText(/Delete all my data/)).toBeTruthy();
  });
});

describe("where it is offered", () => {
  it("shows on the Upload page only when the person has no transactions", async () => {
    api.listTransactions.mockResolvedValue([]);
    render(<UploadStatement />);
    expect(await screen.findByRole("button", { name: "Try with sample data" })).toBeTruthy();
    cleanup();

    api.listTransactions.mockResolvedValue([{ id: 1 }]);
    render(<UploadStatement />);
    await waitFor(() => expect(api.listTransactions).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Try with sample data" })).toBeNull();
  });

  it("does not offer it when the list cannot be loaded", async () => {
    api.listTransactions.mockRejectedValue(new Error("down"));
    render(<UploadStatement />);
    await waitFor(() => expect(api.listTransactions).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Try with sample data" })).toBeNull();
  });

  it("shows in the empty Dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => ({
      ok: true, status: 200,
      json: async () => (String(url).includes("/dashboard/report")
        ? { totalIncome: 0, totalExpenses: 0, netSavings: 0, categoryBreakdown: [], insights: [], previousPeriodHasData: false }
        : []),
    })));
    render(<Dashboard fullName="AJ" refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} onSampleLoaded={() => {}} />);
    expect(await screen.findByRole("button", { name: "Try with sample data" })).toBeTruthy();
  });
});
