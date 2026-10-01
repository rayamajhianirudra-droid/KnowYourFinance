# Build Log 02 — Statement Upload & Redaction Pipeline

**Date:** Oct 1, 2026
**What exists after this entry:** `POST /api/statements/upload` — upload a CSV bank statement and get back parsed, redacted, auto-categorized transactions, already saved to the database.

This is the feature the whole project's security pitch has been about since Milestone 1: **no bank linking, no stored account/routing numbers — the user uploads a statement, and this pipeline is what makes that safe.**

---

## 1. The pipeline, end to end

```
uploaded CSV bytes
   -> CsvStatementParser   turns CSV text into plain (date, description, amount) rows
   -> RedactionUtil        strips anything that looks like an account/routing number
   -> AutoCategorizer      guesses a spending category from the (now-safe) description
   -> TransactionRepository.save()   persists it
```

Five new classes implement this, each with one job:

| Class | Layer | Job |
|---|---|---|
| `CsvStatementParser` | parsing | CSV text → `ParsedRow` list (date/description/amount only — no DB, no Spring annotations beyond `@Component`) |
| `RedactionUtil` | security | strips 8+ digit runs from a string, reports whether anything was removed |
| `AutoCategorizer` | logic | keyword match → `TransactionCategory`, falls back to `OTHER` |
| `StatementImportService` | orchestration | runs the pipeline in order, builds and saves `Transaction` rows |
| `StatementController` | HTTP | accepts the multipart upload, returns a summary |

## 2. Why the ORDER of steps is the actual security guarantee

This is worth being explicit about, because it's easy to read "we redact sensitive numbers" as a vague promise rather than a concrete code fact: in `StatementImportService.importCsv()`, redaction happens **immediately** after a row is parsed — before categorization even looks at the description, before a `Transaction` object is constructed, before anything is handed to the repository. There is no line of code anywhere in this pipeline that has access to an unredacted description except the few lines inside the loop before `RedactionUtil.redact(...)` is called. By the time a `Transaction` exists in memory, it has already been safe for several lines.

## 3. `RedactionUtil` — the actual redaction logic

The approach: a regular expression looking for runs of **8 or more consecutive digits**, replaced with `[REDACTED]`. This is deliberately simple and deliberately aggressive:

- We don't try to detect "is this specifically a routing number" (9 digits) vs. "is this specifically an account number" (8-17 digits) vs. a card number, because we don't need to know *which* kind of sensitive number it is to decide it shouldn't be stored.
- A legitimate statement description never needs an 8+ digit number to be useful to the user — a store number like "STARBUCKS #4521" is only 4 digits and survives untouched.
- The trade-off is intentionally one-sided: we'd rather occasionally redact a harmless long number than ever risk keeping a real one. Over-redacting costs a slightly less pretty description; under-redacting costs a user's bank account number.

## 4. `CsvStatementParser` — why hand-written instead of a library

Two honest reasons, not one: this sandbox [can't resolve new Maven dependencies anyway](./01-backend-foundations.md#9-honest-limitation-to-flag) so adding a CSV library wasn't actually an option right now, and separately, bank statement CSVs are simple enough (three predictable columns, light quoting) that a ~40-line parser is easier to read end-to-end than pulling in a whole library. The parser handles one real-world wrinkle — a comma inside a quoted field, like `"SMITH, JOHN - TRANSFER"` — but not nested/escaped quotes. If a real statement format needs more than that, that's the signal to swap in a proper CSV library (e.g. Apache Commons CSV) rather than keep growing this by hand.

Expected format (header row required, column order fixed):
```
Date,Description,Amount
2026-09-01,STARBUCKS #4521,-5.75
2026-09-01,PAYROLL DEPOSIT,2450.00
```
Convention: **negative amount = expense, positive = income** — matches how most real bank CSV exports work. The parser stores the signed amount; `StatementImportService` converts it to `(TransactionType, always-positive amount)` because that keeps the dashboard's summation logic simple (no sign-flipping needed when adding up "total expenses").

A malformed row (bad date, non-numeric amount, too few columns) is **skipped, not fatal** — one bad line in a 200-row statement shouldn't block every valid transaction from importing. A follow-up noted in the code: skipped-row counting isn't wired all the way through to the response yet (`StatementImportResponse.rowsSkipped` is currently always 0, since `CsvStatementParser` silently drops bad rows instead of reporting them) — collecting those as explicit warnings is a clear next improvement, not a bug we're unaware of.

## 5. `AutoCategorizer` — rule-based v1, with the AI seam left visible

A `LinkedHashMap<String, TransactionCategory>` of keywords ("uber" → TRANSPORTATION, "netflix" → SUBSCRIPTIONS, etc.), checked in order, first match wins, falls back to `OTHER`. This is intentionally the simplest thing that could work, not a placeholder apologized for — merchant names are predictable enough that keyword matching gets a real chunk of transactions right immediately, with zero cost or external dependency.

The important design point: `categorize(String description)` is the *entire* public surface of this class. When "AI categorization" (talked about since the Milestone 1 deck) gets built, it replaces the body of this one method — nothing in `StatementImportService` or anywhere else needs to change, because they only ever call `autoCategorizer.categorize(...)` and don't know or care how the answer is produced.

## 6. The upload endpoint

```
POST /api/statements/upload?userId=1
Content-Type: multipart/form-data
file: <the .csv>
```

Returns:
```json
{
  "rowsParsed": 12,
  "transactionsSaved": 12,
  "rowsRedacted": 1,
  "rowsSkipped": 0,
  "duplicatesSkipped": 0,
  "transactions": [ ... ]
}
```

The uploaded file is read directly from memory via `MultipartFile.getInputStream()` — it is **never written to disk**. There's no temp file sitting anywhere on the server containing a raw statement, redacted or not.

`spring.servlet.multipart.max-file-size`/`max-request-size` were added to `application.properties` (10MB) — Spring's default is 1MB per file, which a multi-page real statement could plausibly exceed.

## 7. What's intentionally still missing

- **PDF statements.** CSV only, for now. PDF support is a clean follow-up (add a PDF-text-extraction step in front of the same pipeline), not a rewrite — the parser's job is just to produce `ParsedRow`s from somewhere, and a PDF text extractor can do that just as well as the CSV reader does.
- **Exact skipped-row reporting.** Noted above — currently a bad row just silently vanishes rather than being counted and reported.
- **AI categorization.** `AutoCategorizer` is the seam; the method signature won't change when this is built.

## 7a. Duplicate-import protection (added after initial write-up)

Uploading the same statement twice used to silently create duplicate transactions and double the dashboard's totals. Fixed with one new repository method:

```java
boolean existsByUserIdAndDateAndDescriptionAndAmountAndType(
        Long userId, LocalDate date, String description, BigDecimal amount, TransactionType type);
```

Before saving each parsed row, `StatementImportService` now checks whether an identical transaction (same user, date, description, amount, type) already exists, and skips it instead of inserting a second copy. `StatementImportResponse` gained a `duplicatesSkipped` count so the upload screen can tell the user "3 rows skipped as duplicates" instead of silently under-counting what got imported.

**Known limitation this doesn't solve:** if a statement genuinely contains two separate transactions identical in every tracked field (e.g. two $5 coffees on the same day with the same description), the second one is incorrectly treated as a duplicate and skipped. A more robust fix would track a per-row position/hash from the source file rather than relying on field equality — noted here rather than silently accepted.

## 8. Testing it without a real bank statement

A sample CSV is included at `docs/build-log/sample-statement.csv` so this is demonstrable immediately — it includes a normal transaction, an income deposit, and one deliberately fake account-number-looking line, to show redaction actually firing.
