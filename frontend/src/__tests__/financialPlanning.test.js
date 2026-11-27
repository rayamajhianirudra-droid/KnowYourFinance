import { describe, expect, it } from "vitest";
import {
  forecast, goalProgress, safeToSpend, spendingAlerts, spendingCuts, summarizeHistory, upcomingBills,
} from "../utils/financialPlanning";

const expense = (date, amount, category = "DINING", description = "Cafe") =>
  ({ date, amount, category, description, type: "EXPENSE" });

describe("financial planning", () => {
  it("excludes transfers and future rows, and caps realistic cuts below an oversized target", () => {
    const history = summarizeHistory([
      expense("2026-09-01", "400.00"),
      expense("2026-11-26", "20.25"),
      expense("2026-11-26", "500.00", "TRANSFER"),
      expense("2026-11-28", "900.00"),
      expense("2026-11-26", "800.00", "RENT_MORTGAGE"),
    ], "2026-11-27");
    expect(history.yesterdaySpending).toBe(82025);
    expect(history.recentExpenses).toBe(122025);
    expect(spendingCuts(history, 20000)).toEqual([{ category: "DINING", monthly: 14491, savings: 3622 }]);
    expect(spendingCuts(history, 200)[0].savings).toBe(200);
  });

  it("withholds projections when history is too short", () => {
    const rows = [expense("2026-11-25", "21.00")];
    const history = summarizeHistory(rows, "2026-11-27");
    expect(spendingCuts(history, 1000)).toEqual([]);
    expect(forecast(history, 50000, [], rows, "2026-11-27")).toEqual([]);
  });

  it("reserves same-month bills once and accounts separately for next month's commitments", () => {
    const bills = upcomingBills([
      { nextDate: "2026-11-25", category: "UTILITIES", amount: 99 },
      { nextDate: "2026-11-30", category: "UTILITIES", amount: 60 },
      { nextDate: "2026-12-01", category: "UTILITIES", amount: 50 },
    ], "2026-11-27", 7);
    expect(safeToSpend({
      balance: 50000, reserve: 10000, bills, month: "2026-11",
      budgets: [{ category: "UTILITIES", remaining: 80 }, { category: "DINING", remaining: -50 }],
    })).toEqual({ billTotal: 11000, budgetTotal: 2000, available: 27000 });
  });

  it("does not double count forecast bills and records a cash shortage before a checkpoint", () => {
    const rows = [expense("2026-09-01", 100, "UTILITIES", "Power")];
    const history = summarizeHistory(rows, "2026-11-27");
    const points = forecast(history, 5000, [
      { nextDate: "2026-11-28", category: "UTILITIES", amount: 100, key: "POWER" },
    ], rows, "2026-11-27");
    expect(points).toEqual([
      { day: 30, balance: -5000, shortage: true },
      { day: 60, balance: -15000, shortage: true },
      { day: 90, balance: -25000, shortage: true },
    ]);
  });

  it("flags a recent duplicate and a possible subscription price change once", () => {
    const rows = [
      expense("2026-09-24", 10, "SUBSCRIPTIONS", "Music"),
      expense("2026-10-24", 10, "SUBSCRIPTIONS", "Music"),
      expense("2026-11-24", 13, "SUBSCRIPTIONS", "Music"),
      ...Array.from({ length: 3 }, () => expense("2026-11-26", 15)),
      expense("2026-11-26", 5, "SUBSCRIPTIONS", "Single subscription"),
    ];
    expect(spendingAlerts(rows, "2026-11-27")).toEqual([
      "Possible duplicate: Cafe on 2026-11-26.",
      "Possible subscription price increase: Music on 2026-11-24.",
    ]);
  });
  it("rounds a required contribution up and distinguishes a completed or overdue goal", () => {
    const goal = { savedAmount: 25, targetAmount: 100, deadline: "2026-12-27" };
    expect(goalProgress(goal, "2026-11-27", 10000)).toEqual({
      percentage: 25, remaining: 7500, required: 7500, estimatedDate: "2026-12-20", feasible: true,
    });
    expect(goalProgress(goal, "2026-12-27", 10000).required).toBeNull();
    expect(goalProgress({ ...goal, savedAmount: 100 }, "2026-12-28", null).required).toBe(0);
  });
});
