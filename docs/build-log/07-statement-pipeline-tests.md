# Build Log 07 — Statement Pipeline Tests

**Date:** Oct 1, 2026
**What exists after this entry:** `CsvStatementParserTest` and `StatementImportServiceTest` — the upload pipeline (parse → redact → categorize → save, including duplicate detection) is now covered end to end.

## `CsvStatementParserTest`

Pure, dependency-free tests on the CSV parsing logic alone: a standard three-column file, a comma inside a quoted description (`"SMITH, JOHN - TRANSFER"`), malformed rows (bad amount, bad date) being silently skipped without sinking the rest of the import, blank lines, and an empty statement after the header.

## `StatementImportServiceTest` — the one that proves the security claim, not just documents it

This test wires `StatementImportService` with **real** `CsvStatementParser` and `AutoCategorizer` instances (both are pure/dependency-free, so faking them would test nothing extra) and only mocks `TransactionRepository`. That means this test runs through the *actual* redact-then-categorize-then-save order the real app uses.

The key assertion: given a CSV row containing `ACH TRANSFER REF 48217536901`, the `Transaction` object that actually reaches `repository.save(...)` has the description `"ACH TRANSFER REF [REDACTED]"` — and the test explicitly asserts the original digit string `"48217536901"` is **not** present anywhere in what got saved. This is a test of behavior, not of intent — it would fail immediately if redaction were ever accidentally removed or reordered.

Also covered: sign conversion (negative CSV amount → `EXPENSE` type with a positive stored amount), and the duplicate-detection logic added in build-log 02a — a row matching an existing transaction is skipped and counted, while a genuinely new row in the same statement still saves normally.
