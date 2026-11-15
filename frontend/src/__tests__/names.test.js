import { describe, expect, it } from "vitest";
import { firstName, initials } from "../utils/names";
import { trimLeadingEmptyMonths } from "../utils/trends";

describe("names", () => {
  it("makes initials from first and last name", () => {
    expect(initials("Anirudra Rayamajhi")).toBe("AR");
    expect(initials("  ada   king lovelace ")).toBe("AL");
    expect(initials("Cher")).toBe("C");
    expect(initials("")).toBe("");
    expect(initials(null)).toBe("");
  });

  it("takes the first name", () => {
    expect(firstName("Anirudra Rayamajhi")).toBe("Anirudra");
    expect(firstName(null)).toBe("");
  });
});

describe("trimLeadingEmptyMonths", () => {
  const m = (month, income, expenses) => ({ year: 2026, month, totalIncome: income, totalExpenses: expenses });

  it("starts the chart at the first month with data", () => {
    const months = [m(1, 0, 0), m(2, 0, 0), m(3, 100, 20), m(4, 0, 0), m(5, 50, 10)];
    expect(trimLeadingEmptyMonths(months).map((x) => x.month)).toEqual([3, 4, 5]);
  });

  it("keeps everything when there is no data at all", () => {
    const months = [m(1, 0, 0), m(2, 0, 0)];
    expect(trimLeadingEmptyMonths(months)).toHaveLength(2);
  });
});
