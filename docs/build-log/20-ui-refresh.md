# Build Log 20: Interface Refresh, Same Colors

**Date:** Nov 13, 2026
**What exists after this entry:** The same app with a tighter layout, easier navigation on phones, better keyboard and screen reader support, and two small bugs fixed. No color was changed. Every color still comes from the tokens at the top of `index.css`.

## What was wrong (found by screenshotting every screen on a laptop and a phone)

- A tall green banner with a slogan sat on top of every screen, pushing the content down, and then a second strip held the navigation.
- On a phone the navigation was four icons with no labels, and screen readers could not read their names.
- On a phone the transaction table was cut off, so the amount and the edit and delete buttons could only be reached by scrolling sideways. The search box also stretched to a very tall box.
- The four summary cards stacked into a very long column on a phone.
- The dashboard listed the same category data twice (the donut legend and a separate "Top spending categories" bar list).
- A total that had not changed showed "0.0% from last period" with a red up arrow, which reads as bad news.
- The dashboard subtitle wrote the month in lowercase ("november 2026").
- The Add Transaction date and the custom range end date used UTC. In the evening in Minnesota they showed tomorrow's date.
- The upload page had a large empty area and did not say what the file should look like.

## What changed

- One slim bar on top (brand, four views, privacy line) that stays in place while scrolling. On a phone the same navigation moves to the bottom edge with a label under each icon.
- Transactions turn into cards on a phone, each with the date, amount, description, category and buttons visible without scrolling sideways.
- Dashboard order is now summary cards, income and expense charts, then category breakdown beside recent transactions. The duplicate category list was removed.
- Highlights are one labelled card instead of separate grey bars. Unchanged totals say "No change from last period" in neutral gray.
- The upload page explains what to upload, what is removed and what happens next.
- Accessibility: a skip link, a visible focus ring on every control, focus moved to the page when the view changes, status and error messages announced to screen readers, the file input moved out of the drop area button, correct heading order, larger tap targets on phones, and reduced motion respected.
- A new `utils/dates.js` builds dates from the local calendar day.

## Checking the work

Screenshots before and after on a 1366 pixel wide laptop screen and a 390 pixel wide phone, using sample data. An automated accessibility scan (axe-core) of all four screens at both sizes: the first run found three problems on the upload screen (heading order, an unlabeled file input, and a control nested inside a button). All three were fixed and the final run reported none. Frontend tests grew from 18 to 31.

## Not checked

The screenshots used sample data in a headless browser. The new layout has not been viewed on a real phone or in Safari, and the automated scan does not replace trying the app with a screen reader.
