import { afterEach, describe, expect, it, vi } from "vitest";
import { todayInput, toLocalDateInput } from "../utils/dates";

afterEach(() => vi.useRealTimers());

describe("toLocalDateInput", () => {
  it("pads single digit months and days", () => {
    expect(toLocalDateInput(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses the local calendar day, not the UTC day", () => {
    // 11:38 pm local time on November 13. In UTC this is already the 14th
    // for anyone west of Greenwich, which was the bug.
    expect(toLocalDateInput(new Date(2026, 10, 13, 23, 38))).toBe("2026-11-13");
  });
});

describe("todayInput", () => {
  it("returns today's local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 23, 59));
    expect(todayInput()).toBe("2026-11-13");
  });
});
