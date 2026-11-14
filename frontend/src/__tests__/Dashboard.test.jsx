import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Dashboard from "../components/Dashboard";

// Answers the dashboard's requests with a report that we control.
function serve(report) {
  globalThis.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(String(url).includes("/dashboard/report") ? report : []),
    })
  );
}

const base = {
  totalIncome: 4900, totalExpenses: 2000, netSavings: 2900,
  categoryBreakdown: [{ category: "GROCERIES", total: 100 }],
  insights: [], previousPeriodHasData: true,
  previousTotalIncome: 4900, previousTotalExpenses: 2500, previousNetSavings: 2400,
};

afterEach(() => {
  cleanup();
  delete globalThis.fetch;
});

describe("Dashboard", () => {
  it("shows 'No change' instead of a red arrow when a total is exactly the same", async () => {
    serve(base);
    render(<Dashboard refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    // Income is 4900 both periods, so it must read as no change.
    expect(await screen.findByText("No change from last period")).toBeTruthy();
  });

  it("writes the month name with a capital letter", async () => {
    serve(base);
    render(<Dashboard refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    await screen.findByText("Total Income");
    const month = new Date().toLocaleString("en-US", { month: "long" });
    expect(screen.getByText(new RegExp(`overview for ${month} ${new Date().getFullYear()}`))).toBeTruthy();
  });

  it("lists highlights in their own labelled section", async () => {
    serve({ ...base, insights: ["Dining spending fell 18% compared with last month."] });
    render(<Dashboard refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    expect(await screen.findByRole("region", { name: "Highlights" })).toBeTruthy();
    expect(screen.getByText(/Dining spending fell 18%/)).toBeTruthy();
  });

  it("shows the empty state when there is nothing yet", async () => {
    serve({ ...base, totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], previousPeriodHasData: false });
    render(<Dashboard refreshKey={0} onUploadClick={() => {}} onAddClick={() => {}} />);
    expect(await screen.findByText("No transactions yet")).toBeTruthy();
  });
});
