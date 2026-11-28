import { describe, expect, it } from "vitest";
import { flipStatementSigns, looksInverted, negateAmount } from "../utils/flipSigns";

describe("looksInverted", () => {
  it("is true when nearly everything was read as income", () => {
    expect(looksInverted({ count: 20, totalIncome: 900, totalExpenses: 0 })).toBe(true);
  });
  it("is false for a normal statement or a tiny one", () => {
    expect(looksInverted({ count: 20, totalIncome: 900, totalExpenses: 700 })).toBe(false);
    expect(looksInverted({ count: 3, totalIncome: 900, totalExpenses: 0 })).toBe(false);
    expect(looksInverted(null)).toBe(false);
  });
});

describe("negateAmount", () => {
  it("swaps the sign and keeps two decimals", () => {
    expect(negateAmount("45.10")).toBe("-45.10");
    expect(negateAmount("-12.5")).toBe("12.50");
    expect(negateAmount("$1,234.00")).toBe("-1234.00");
    expect(negateAmount("(8.00)")).toBe("8.00");
    expect(negateAmount("")).toBe("");
    expect(negateAmount("n/a")).toBe("n/a");
  });
});

describe("flipStatementSigns", () => {
  const csv = (text, name = "card.csv") => new File([text], name, { type: "text/csv" });

  it("swaps only the amount column and keeps quoted text", async () => {
    const copy = await flipStatementSigns(csv('Date,Description,Amount\n2026-11-01,"COFFEE, LARGE",4.50\n2026-11-02,REFUND,-9.00\n'));
    expect(await copy.text()).toBe('Date,Description,Amount\n2026-11-01,"COFFEE, LARGE",-4.50\n2026-11-02,REFUND,9.00\n');
  });

  it("handles tab separated files", async () => {
    const copy = await flipStatementSigns(csv("Date\tDescription\tAmount\n2026-11-01\tSHOP\t3.00\n", "card.tsv"));
    expect(await copy.text()).toBe("Date\tDescription\tAmount\n2026-11-01\tSHOP\t-3.00\n");
  });

  it("declines files it cannot flip safely", async () => {
    expect(await flipStatementSigns(csv("Date,Description,Debit,Credit\n2026-11-01,X,5.00,\n"))).toBeNull();
    expect(await flipStatementSigns(csv("x", "card.xlsx"))).toBeNull();
  });
});
