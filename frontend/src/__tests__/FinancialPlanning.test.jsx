import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import FinancialPlanning from "../components/FinancialPlanning";
import MonthlyReportExport from "../components/MonthlyReportExport";
import { getBudgets } from "../api";
import { downloadCsv } from "../utils/csvExport";

vi.mock("../api", () => ({ getBudgets: vi.fn() }));
vi.mock("../utils/csvExport", async (importOriginal) => ({
  ...await importOriginal(), downloadCsv: vi.fn(),
}));

const rows = [
  { date: "2026-09-01", type: "INCOME", category: "INCOME", amount: 800 },
  { date: "2026-11-26", type: "EXPENSE", category: "SUBSCRIPTIONS", amount: 20, description: "Music" },
];

it("calculates weekly and daily spending when a balance is provided and goals load", async () => {
  getBudgets.mockResolvedValue([{ category: "DINING", remaining: 50, status: "ON_TRACK" }]);
  render(<FinancialPlanning rows={rows} bills={[]} today="2026-11-27" refreshKey={0} goals={[]} />);
  expect(screen.getByText(/Yesterday’s recorded spending/)).toHaveTextContent("$20.00");

  fireEvent.change(screen.getByLabelText("Current available cash"), { target: { value: "750" } });
  fireEvent.change(screen.getByLabelText("Additional savings to reserve"), { target: { value: "0" } });

  await screen.findByText("$700.00");
  expect(screen.getByText("Today ·")).toHaveTextContent("$100.00");
  expect(screen.getByText(/90 days ·/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Monthly change"), { target: { value: "125" } });
  fireEvent.change(screen.getByLabelText("Upfront cost"), { target: { value: "1000" } });
  expect(screen.getByText(/12-month available cash impact/)).toHaveTextContent("-$2,500.00");
});

it("downloads the selected month's recorded subscriptions, budgets and current goals", async () => {
  getBudgets.mockResolvedValue([{ category: "SUBSCRIPTIONS", limitAmount: 10, spent: 20, remaining: -10 }]);
  render(<MonthlyReportExport month="2026-11" rows={rows} goals={[
    { name: "=test", targetAmount: 500, savedAmount: 100, deadline: "2027-01-01" },
  ]} report={{
    totalIncome: 0, totalExpenses: 20, netSavings: -20, previousPeriodHasData: false,
    categoryBreakdown: [{ category: "SUBSCRIPTIONS", total: 20 }],
  }} />);

  fireEvent.click(screen.getByRole("button", { name: "Download monthly report (CSV)" }));
  await waitFor(() => expect(downloadCsv).toHaveBeenCalledWith(
    "kyf-monthly-report-2026-11.csv", expect.stringContaining('"Recorded subscription expenses",20'),
  ));
  const [, csv] = downloadCsv.mock.lastCall;
  expect(csv).toContain('"Subscriptions",10,20,-10');
  expect(csv).toContain('"\'=test",100,500,"2027-01-01"');
});
