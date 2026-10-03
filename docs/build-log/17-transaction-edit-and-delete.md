# Build Log 17: Full Transaction Edit and Delete

**Date:** Oct 3, 2026
**What exists after this entry:** The Transactions page now lets a user edit every field of a transaction (date, description, amount, category) and delete one entirely, closing the two requirements the redesign pass left open: FR-403 and FR-404.

## Where this came from

Auditing the redesigned app against `docs/requirements/milestone-2-srs.md` turned up a real gap: both FR-403 ("edit the date, description, amount, and category") and FR-404 ("delete a transaction record") were already fully supported by the backend - `TransactionController` has had working `PUT` and `DELETE` endpoints since the very first version of the API - but nothing in the redesigned frontend ever called either one. The Transactions page could only fix a miscategorized row through the quick category dropdown; there was no way to fix a typo in the amount, correct the date, or remove a row at all.

## What changed

**`api.js`:** Added `deleteTransaction(id)`, a plain `DELETE` call. Also brought `updateTransaction`'s error handling in line with `addTransaction` - it now parses the backend's `{message, fieldErrors}` response on failure instead of throwing a bare status-code error, so an edit form can point at exactly which field was invalid.

**`TransactionList.jsx`:** Each row now has an Actions column with an edit (pencil) and delete (trash) icon button.

- Clicking edit turns that one row into inline input fields - a date picker, a text input for description, a number input for amount, and the existing category dropdown - with Save/Cancel buttons. Saving calls the same `updateTransaction` the quick-category-fix dropdown already used, so both paths go through identical validation and both clear `lowConfidence` the same way (a human touched this row, so it's no longer an unreviewed AI guess).
- Clicking delete doesn't fire immediately - it swaps the row's actions for a "Delete?" confirm/cancel pair, so a misclick doesn't silently remove a transaction. Confirming calls the new `deleteTransaction` and removes the row from the list on success.

**`Icons.jsx`:** Added three small icons to match - a pencil (edit), a trash can (delete), and an X (cancel) - built the same way as every other icon in the set (20x20 viewbox, 1.5px stroke), so nothing about this feature looks bolted on.

**`App.css`:** Styled the new actions column and inline edit inputs using the same tokens as everything else - no new colors, no new spacing values, no new border-radius.

## Why inline, not a modal

A modal would have meant building a second form component that duplicates the add-transaction form's validation and field layout, for a feature that's fundamentally "fix this one row I'm already looking at." Editing in place keeps the person looking at the same table row the whole time, with the rest of the table still visible for context (what category similar transactions got, what the date range looks like) - a modal would hide that. The delete confirmation follows the same logic: a small, local, two-click confirm instead of a browser `confirm()` dialog that would look and feel like leaving the app for a second.

## Verification

`npm run build` compiles clean. Field-level error keys were checked against `GlobalExceptionHandler.java` to confirm the backend reports validation failures using the same field names (`date`, `description`, `amount`) the entity and the edit form both use, so a failed save will highlight the right input rather than failing silently.
