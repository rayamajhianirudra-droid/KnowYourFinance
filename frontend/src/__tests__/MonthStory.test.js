import { describe, expect, it } from "vitest";
import { explainMonth, monthSentences, isFee } from "../utils/monthStory";

const row = (date, description, amount, category, type = "EXPENSE") => ({ date, description, amount, category, type });

describe("explainMonth", () => {
  const rows = [
    row("2026-10-03", "WHOLE FOODS", "100.00", "GROCERIES"),
    row("2026-10-10", "CHIPOTLE", "20.00", "DINING"),
    row("2026-11-02", "WHOLE FOODS", "110.00", "GROCERIES"),
    row("2026-11-05", "CHIPOTLE 1", "15.00", "DINING"),
    row("2026-11-12", "CHIPOTLE 2", "15.00", "DINING"),
    row("2026-11-19", "CHIPOTLE 3", "15.00", "DINING"),
    row("2026-11-20", "MONTHLY SERVICE FEE", "12.00", "OTHER"),
    row("2026-11-21", "ONLINE TRANSFER TO SAVINGS", "500.00", "TRANSFER"),
    row("2026-11-22", "PAYROLL", "900.00", "INCOME", "INCOME"),
  ];

  it("compares with the month before and leaves transfers and income out", () => {
    const story = explainMonth(rows, 2026, 11);
    expect(story.total).toBe(16700);
    expect(story.previousTotal).toBe(12000);
    expect(story.drivers[0].category).toBe("DINING");
  });

  it("finds repeated merchants and fees", () => {
    const story = explainMonth(rows, 2026, 11);
    expect(story.fees).toEqual({ count: 1, total: 1200 });
    expect(story.repeated.count).toBe(3);
  });

  it("writes plain sentences", () => {
    const lines = monthSentences(explainMonth(rows, 2026, 11));
    expect(lines[0]).toBe("You spent $47.00 more than the month before.");
    expect(lines.some((l) => l.startsWith("Dining was up"))).toBe(true);
    expect(lines.some((l) => l.includes("A bank fee or interest charge cost you $12.00."))).toBe(true);
  });

  it("says so when there is no earlier month", () => {
    const lines = monthSentences(explainMonth(rows, 2026, 10));
    expect(lines[0]).toMatch(/first month/);
  });

  it("returns nothing for a month without spending", () => {
    expect(explainMonth(rows, 2026, 5)).toBeNull();
    expect(monthSentences(null)).toEqual([]);
  });

  it("recognizes fee words", () => {
    expect(isFee({ description: "OVERDRAFT FEE" })).toBe(true);
    expect(isFee({ description: "STARBUCKS" })).toBe(false);
  });
});

import { detectRecurring } from "../utils/recurring";

describe("transfers are not bills", () => {
  it("does not treat a monthly move to savings as a recurring bill", () => {
    const rows = ["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"]
      .map((date) => row(date, "ONLINE TRANSFER TO SAVINGS", "200.00", "TRANSFER"));
    expect(detectRecurring(rows)).toEqual([]);
  });
});
