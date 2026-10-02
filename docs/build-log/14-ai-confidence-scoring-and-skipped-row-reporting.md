# Build Log 14: AI Confidence Scoring and Skipped-Row Reporting

**Date:** Oct 2, 2026
**What exists after this entry:** AutoCategorizer now reports a numeric confidence alongside every category guess, transactions carry a `lowConfidence` flag the frontend displays, and a statement import accurately reports how many rows failed to parse instead of always reporting zero.

## Where this came from

Writing the Milestone 2 requirements document (build log before this one) meant writing down, precisely, what the AI categorization feature and the statement import feature were supposed to do - including a 0.70 confidence threshold and an accurate skipped-row count. Going back through the actual code against that document turned up two real gaps between what was documented and what was built.

## Gap 1: no real confidence score

AutoCategorizer matched keywords and returned a category - full stop. A transaction that matched "netflix" and a transaction that matched nothing and fell back to OTHER were indistinguishable once saved; there was no signal anywhere that one was a confident match and the other a guess.

The fix: `categorizeWithConfidence()` now returns both the category and a 0.0-1.0 confidence score. A keyword match scores 0.85 (comfortably above the new `CONFIDENCE_THRESHOLD` of 0.70); no match scores 0.0 and falls back to OTHER, same as before. The plain `categorize()` method still exists and still returns just the category, so nothing that only needed the category had to change.

That confidence score needed somewhere to live, so `Transaction` gained a `lowConfidence` field. It is a `Boolean`, not a primitive `boolean`, on purpose: the database already has rows saved before this field existed, and a primitive would throw a null-pointer exception unboxing a column that doesn't exist yet on those older rows. `isLowConfidence()` treats null and false the same way, so nothing else in the codebase has to think about the distinction.

One more piece: if a transaction was flagged low-confidence and a user then edits it (even just to confirm the category is right), that edit should clear the flag. Once a person has looked at it, it is a reviewed transaction, not an unreviewed AI guess - so `TransactionController.update()` now clears `lowConfidence` on every save.

On the frontend, `TransactionList` shows a small "auto-guessed" badge next to the category dropdown whenever `lowConfidence` is true, so the distinction is actually visible, not just sitting in the database.

## Gap 2: skipped rows were always reported as zero

`StatementImportResponse` had a `rowsSkipped` field, and the upload summary sentence in the UI was already designed to use it - but `CsvStatementParser` silently dropped malformed rows without counting them, so the field was hardcoded to `0` with a comment admitting it as a known gap.

The fix: `parse()` now returns a `ParseResult` (the parsed rows plus how many were skipped) instead of a bare row list. A row is only counted as skipped when it actually fails to parse - too few columns, a bad date, a non-numeric amount - not when it's a blank line at the end of the file, which is normal and not something the user needs to hear about. `StatementImportService` passes that count straight through to the response, and the upload screen now shows it ("2 rows couldn't be read and were skipped") instead of staying silent about it.

## Why this matters more than it looks

Neither of these was a crash or a visible bug - the app worked fine either way, which is exactly why they were easy to miss. They mattered because the requirements document now makes specific, checkable claims ("0.70 threshold," "the import summary reports N rows skipped"), and a requirements document that doesn't match the actual software isn't really documentation, it's fiction. Worth treating "does the code still match what we wrote down" as its own ongoing check, not a one-time exercise that ends when the document is turned in.
