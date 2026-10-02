# Build Log 15: Full Visual Redesign

**Date:** Oct 2, 2026
**What exists after this entry:** Every screen in the app (dashboard, upload, add transaction, transactions list) now shares one consistent design system - a deliberate financial color palette, a type and spacing scale, a hand-drawn icon set, and real charts - instead of the plain utilitarian styling the app had while the backend was being built out.

## Where this came from

The backend and the core logic (statement parsing, redaction, categorization, period reporting) were already working end to end, but the UI looked like what it was: a functional first pass with default browser styling, a single accent blue, and plain HTML tables. That was fine while proving the app worked, but it would not hold up as something to show in a portfolio or demo to a recruiter. The goal of this pass was to redesign the look of every page without touching what the app actually does - no feature was removed or changed, only how it is presented.

## Design direction

Rather than the generic AI-SaaS look (bright blue accents, soft drop shadows on everything, oversized rounded corners), the new design uses a calm, deliberate financial palette: deep forest green and evergreen for brand and interactive elements, emerald for income/positive numbers, a muted brick red for expenses, and a warm ivory background instead of stark white or gray. Green is used specifically for financial meaning (income, positive savings), not decoratively everywhere.

Typography is Inter, loaded from Google Fonts, with tabular numbers turned on globally so dollar amounts in tables and cards always line up. Every card, button, input and badge shares one spacing scale (8/12/16/24/32/48px) and one border-radius system, so nothing looks like it came from a different component library.

## What changed on each page

**Dashboard** - the plain stat list became four real cards (Total Income, Total Expenses, Net Savings, Savings Rate), each with an icon and an honest comparison against the previous period - honest meaning the comparison is hidden entirely when there is no previous-period data to compare against, rather than showing a misleading "0% change." Below the cards, the spending breakdown is now an actual donut chart with a legend (name, percent, dollar amount) instead of a bullet list, and a new trends section shows income-vs-expenses as a bar chart and net savings as an area chart over the trailing six months. A top-spending-categories panel uses proportional bars, and a recent-transactions panel links out to the full transactions page.

**Upload Statement** - the upload flow now previews what would be imported (transaction count, date range, income/expense totals detected) before anything is saved, using the backend's new preview mode, so a person can check the file was read correctly before committing to it.

**Add Transaction** - a cleaner form with an Income/Expense toggle and a visually prominent amount field, with field-level error messages instead of one generic error line.

**Transactions** - was a bare table; now has search by description, a category filter, an income/expense filter, a date range filter, and sortable date/amount columns, matching what the upload and dashboard pages already let a person do with their data.

Every page also got a proper empty state (an explanation plus a direct path to Upload Statement or Add Transaction) instead of a plain "nothing here" sentence, since a first-time user's very first impression of the app was, until now, a blank page.

## What did not change

No backend endpoint, data shape, or business logic changed in this pass except what was needed to support it honestly: the dashboard needed real previous-period numbers and a flag for whether that comparison is even meaningful, a new endpoint for arbitrary custom date ranges, and a preview mode for statement uploads that runs the full import pipeline without saving anything. Those three backend additions, and their tests, were built and verified first, specifically so this visual pass would not have to fake or approximate any of the numbers it displays.

## Verification

`npm run build` compiles cleanly. The local sandbox cannot run the backend (Maven Central is not reachable from here) or load a live browser against the dev server, so this pass was verified by building the frontend successfully and reviewing every component's markup and styling for consistency against the single design-token system in `index.css` and `App.css`. A full visual check against a running backend should happen on a machine that can reach Maven Central and open a browser - the structure and logic are in place and build clean, but seeing it rendered live has not happened yet.
