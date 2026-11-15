# Build log 22: Several statements at once, in more formats

Date: November 15, 2026

## Goal
Let a user upload a year of monthly statements in one step (up to 12 files), and accept more than CSV.

## Decisions
1. **Formats.** CSV, TSV, TXT and Excel (.xlsx). Every bank can export these and the columns are structured. PDF was left out on purpose: PDF layouts differ by bank and parsing them is guesswork that could put wrong amounts into someone's budget.
2. **One shape for every format.** `StatementTableReader` turns any supported file into a list of rows of text cells. The parser and everything after it (redaction, categorizing, duplicate check) are unchanged and do not know which format the file was. Redaction is still the first step on every row.
3. **Excel needs a library.** An .xlsx file is zipped XML with date serial numbers, which is not sensible to parse by hand, so Apache POI is used for that one format. Text formats are still read by hand.
4. **Real bank layouts.** The parser now also understands dates like 09/01/2026 and amounts like $1,234.50 or (5.75), because that is what banks actually export.
5. **One file failing does not sink the batch.** The new endpoint `POST /api/statements/upload-batch` imports the files one after another, each in its own database transaction, and returns one result per file. A wrong type, an empty file or a damaged workbook is reported for that file only.
6. **The cap lives on both sides.** The backend refuses more than 12 files with a clear message. The page keeps the first 12 and tells the user about the rest. The request size limit was raised to 120 MB (12 files of 10 MB), and nginx to 125 MB.

## What I did not do
Overlap between files in the same batch is only caught when saving, not in the preview, because a preview saves nothing. The page says so.

## Checking
19 new backend tests and 13 new frontend tests, plus a CI check through the real containers that uploads a CSV and a TSV together and confirms a thirteenth file is refused.
