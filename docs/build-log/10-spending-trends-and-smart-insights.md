# Build Log 10 — Spending Trends & Smart Insights

**Date:** Oct 1, 2026
**What exists after this entry:** `GET /api/dashboard/trends` (a multi-month chart feed) and auto-generated "insights" sentences attached to the monthly report, plus the frontend to show both.

## Spending trends over time

The Monthly report has always shown one month at a time. `DashboardService.getTrends(userId, year, month, monthsBack)` builds a lighter summary (just income/expenses/net savings, no category breakdown) for each of the trailing `monthsBack` months (default 6), oldest first, so a chart can read the list left to right. A new `MonthlySummary` DTO carries one month's worth of that data; `GET /api/dashboard/trends?userId=1&year=2026&month=10&monthsBack=6` returns a list of them.

The frontend's `TrendsChart.jsx` renders this as a plain CSS bar chart — no charting library pulled in. Each bar's height is a JavaScript-calculated percentage of the single largest value anywhere in the dataset, so the tallest bar always reaches the top and everything else is sized relative to it. It deliberately ignores the Monthly report's month/year picker and always shows the trailing 6 months ending at today, so flipping the report back to an old month doesn't also rewind this chart.

## Smart insights

`InsightsService` is a new, pure (no repository/database access) class that takes this month's report and last month's report and returns a handful of plain-English sentences:
- Overspending: "You spent $X more than you earned this month."
- No income recorded, if expenses exist but income is zero.
- A spending-trend comparison against last month ("up 18%" / "down 12%"), but only above a 10% threshold — small swings aren't worth a sentence.
- Whichever category jumped the most in dollar terms versus last month, if the jump is more than $20.

`DashboardService.getMonthlyReport` now quietly builds last month's report too (reusing the same internal `buildReport` method, via a private helper), purely to hand to `InsightsService` — the frontend never sees two full reports, just the current one with an added `insights: string[]` field.

## A worthwhile side-effect: duplicated formatting code cleaned up

While wiring the new trend chart, noticed `Dashboard.jsx` and `TransactionList.jsx` each had their own copy-pasted `formatCurrency` function. Pulled it out into `src/utils/format.js` and had both components (plus the new `TrendsChart.jsx`) import the one shared version instead — a small cleanup, but the kind of thing worth doing the moment a second copy of something shows up, before a third and fourth copy make it worse.

## Testing

- `InsightsServiceTest` — six tests directly against the new class, no mocking needed since it's pure logic: the empty-month message, the overspending flag, the missing-income flag, the "up X%" trend flag, confirms small (<10%) swings are correctly ignored, and confirms the single biggest category increase is picked out correctly (and a smaller one isn't).
- `DashboardServiceTest` — updated for the fact that `getMonthlyReport` now also queries the previous month internally (every existing test had to stub that second query too, or it would have failed with a null-handling error), plus a new test for `getTrends` confirming it returns the right number of months, in the right order, with the right math.
