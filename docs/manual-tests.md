# Manual test checklist

Run these with the app started by `docker compose up --build`, at http://localhost:3000, or the port set by KYF_PORT in your .env file (for example http://localhost:3100). Use the sample file `docs/build-log/sample-statement.csv` or your own CSV, TSV, TXT or XLSX statements. Write Pass or Fail in the Result column and the date and tester's name below the table.

| ID | Scenario | Steps | Expected result | Result |
|---|---|---|---|---|
| M-01 | Import a statement | Open Upload. Choose the sample file and press Upload. | Transactions appear. The summary shows parsed, saved, redacted, skipped and duplicate counts. | |
| M-02 | Account numbers are hidden | After M-01, open Transactions and find a row that had a long digit reference. | The description shows the redaction placeholder and none of the original digits. | |
| M-03 | Duplicate import | Upload the same file again. | No new rows are created. The screen says the file is already imported, lists the repeated rows as already in the account, and Confirm is disabled. | Pass |
| M-04 | One bad row in a file | Make a copy of the sample file, break one amount (for example "abc"), and upload it. | The good rows are saved and one row is reported as skipped. | Pass |
| M-05 | File too large | Upload a file bigger than 10 MB. | A clear error message appears and nothing is saved (requirement NFR-06). | Pass |
| M-06 | Correct a category | Find a row marked as auto guessed and change its category. | The category updates, the badge disappears, and the reports use the new category. | Pass |
| M-07 | Add a cash transaction | Open Add, fill in every field, and save. | The transaction shows in the list and in that month's report. | Pass |
| M-08 | Missing field | Open Add and submit with the amount empty. | The form is rejected and the amount field shows what is missing. | |
| M-09 | Edit a transaction | Edit the date, description and amount of a row and save. | The row shows the new values. | Pass |
| M-10 | Delete a transaction | Delete a row and confirm. | The row disappears and the totals update. | Pass |
| M-11 | Past month and empty month | On the Dashboard, pick a past month, then a month with no data. | The past month shows totals and a category breakdown. The empty month shows zeros. | Pass |
| M-12 | Custom date range | Pick a custom start and end date. | The report covers exactly that range. | Pass |
| M-13 | Spending insights | Compare a month with a large change against one with a small change. | A month whose spending moved 10 percent or more from the month before shows a trend note. A smaller change does not. | |
| M-14 | Data survives a restart | Run `docker compose down`, then `docker compose up`, then reload the page. | All earlier transactions are still there. | |
| M-15 | Keyboard use | Using only the Tab and Enter keys, move through the menu and open each page. | Every page can be reached and a visible outline shows where you are. | |

| M-16 | Several statements at once | Choose 3 or more statement files together (for example a CSV, a TSV and an Excel file) and wait for the preview. | Each file is listed with its own transaction count and date range, and the totals add up across files. | |
| M-17 | Twelve file limit | Choose 13 files at once. | Only the first 12 are used and a message says so. Nothing beyond 12 is uploaded. | |
| M-18 | One unsupported file | Include a PDF among your files. | The PDF is listed as failed with a clear message. The other files still import after you confirm. | |

Tester: ____________________  Date: ____________________
