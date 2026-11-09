# KnowYourFinance: Test Report

**Course:** COMP 425, Software Engineering, Fall 2026
**Report date:** November 9, 2026
**Repository:** https://github.com/rayamajhianirudra-droid/KnowYourFinance
**Requirements baseline:** [Milestone 2 SRS](../requirements/milestone-2-srs.md)

---

## 1. Purpose and scope

This report records what was tested in KnowYourFinance, how it was tested, what the results were, and what has not been tested yet. Every number below comes from the project's continuous integration logs or from the test source files in the repository. Nothing in this report is estimated.

The report covers three areas: automated backend unit tests, the automated frontend build check, and the defects found and fixed while the system was built. It ends with a manual end to end test plan whose results are still to be recorded.

## 2. Test environment

| Item | Detail |
|---|---|
| Automation | GitHub Actions, two workflows: Backend CI and Frontend CI |
| Runner | ubuntu-latest |
| Backend toolchain | JDK 21, Maven, Spring Boot 3.3.4 |
| Backend test libraries | JUnit 5, Mockito, Spring MockMvc |
| Frontend toolchain | Node.js, npm, Vite |
| Triggers | Every push to main and every pull request touching the relevant folder |
| Database in tests | None. Backend tests use mocks and never connect to a database. |
| Database in the running system | PostgreSQL hosted on Supabase |

## 3. Test strategy

| Level | What it checks | Status |
|---|---|---|
| Unit tests (backend) | Each service class and the transaction controller in isolation, with the repository mocked | Automated, 52 tests |
| Build check (frontend) | The React app installs and compiles without errors | Automated |
| Integration tests against a real database | Repository queries and the schema | Not written yet |
| End to end manual tests | Upload, edit, delete, reports in the running app | Planned, see section 8 |
| Performance tests | Report and import timing against NFR-01 and NFR-02 | Not run yet |

## 4. Automated test results

Source: Backend CI run 37021138470, commit `4cbef5f`, October 2, 2026. Result: BUILD SUCCESS. The backend code has not changed since that commit (later commits changed only the frontend, documentation and the database security setting), so these results still describe the current backend.

| Test class | Area | Tests | Passed | Failed | Time (s) |
|---|---|---|---|---|---|
| RedactionUtilTest | Account number redaction | 9 | 9 | 0 | 0.021 |
| StatementImportServiceTest | Import pipeline | 8 | 8 | 0 | 0.073 |
| AutoCategorizerTest | Categorization and confidence | 8 | 8 | 0 | 0.014 |
| TransactionControllerTest | Create, update, list, error responses | 8 | 8 | 0 | 2.269 |
| DashboardServiceTest | Reports and trends | 7 | 7 | 0 | 1.200 |
| InsightsServiceTest | Plain language insights | 6 | 6 | 0 | 0.016 |
| CsvStatementParserTest | CSV parsing | 6 | 6 | 0 | 0.009 |
| **Total** | | **52** | **52** | **0** | |

Failures: 0. Errors: 0. Skipped: 0.

Frontend CI (install with `npm ci`, then `npm run build`) passed on every commit to the frontend, including the redesign and the edit and delete feature (latest code run: October 3, 2026). The frontend has no automated unit tests, so this check proves the code compiles and builds, not that each screen behaves correctly.

## 5. Requirement coverage

This table maps each Milestone 2 requirement to the automated tests that exercise it. "Not covered" means no automated test checks it today.

| Requirement | Automated coverage | Tests |
|---|---|---|
| FR-101, FR-102 | Covered | parsesAStandardThreeColumnCsv, handlesACommaInsideAQuotedDescription |
| FR-103, NFR-08 | Covered | skipsMalformedRowsWithoutFailingTheWholeImportAndCountsThem, aRowWithTooFewColumnsCountsAsSkipped, skipsBlankLinesWithoutCountingThemAsSkippedRows |
| FR-104 | Partly | reportsHowManyRowsFailedToParse (skipped count). Parsed, saved and redacted counts are not asserted individually. |
| FR-105, NFR-06 | Not covered | The 10 MB limit is a configuration setting and an error handler with no test |
| FR-106 | Covered | skipsRowsThatAlreadyExistInsteadOfSavingDuplicates |
| FR-201, NFR-05 | Not applicable | Enforced by design, no credential input exists |
| FR-202, FR-203, FR-204, NFR-03 | Covered | Nine RedactionUtilTest tests, redactsSensitiveNumbersBeforeSaving |
| FR-205 | Not covered | No test asserts the redacted row count in the summary |
| FR-301, FR-302 | Covered | matchesKnownMerchantKeywords, isCaseInsensitive, recognizesIncomeKeywords, aKeywordMatchMeetsTheConfidenceThreshold |
| FR-303, FR-304, NFR-11 | Covered | fallsBackToOtherWhenNothingMatches, fallsBackToOtherForBlankOrNullDescription, noMatchFallsBelowTheConfidenceThresholdAndIsFlaggedLowConfidence, blankOrNullDescriptionIsLowConfidence, flagsALowConfidenceCategoryOnTheSavedTransaction, doesNotFlagAConfidentCategoryMatch |
| FR-305 | Partly | redactsSensitiveNumbersBeforeSaving checks the saved text is redacted |
| FR-306, FR-403 | Covered | updatingAnExistingTransactionSavesTheChanges, updatingATransactionClearsTheLowConfidenceFlag, updatingAMissingTransactionReturns404 |
| FR-401, FR-405, NFR-09 | Covered | creatingAValidTransactionReturns200, missingRequiredFieldReturnsCleanValidationError |
| FR-402 | Covered | listWithNoDateRangeReturnsEveryTransactionForUser, listWithDateRangeUsesTheRangeQuery |
| FR-404 | Not covered | The delete endpoint has no automated test |
| FR-501, FR-502, FR-503 | Covered | calculatesNetSavingsAsIncomeMinusExpenses, mapsCategoryTotalsIntoTheResponse, netSavingsIsNegativeWhenSpendingExceedsIncome, reportForRangeComparesAgainstAnEqualLengthPrecedingWindow |
| FR-504 | Partly | trendsReturnsOneSummaryPerMonthOldestFirst. The 1 to 24 month limit is not tested. |
| FR-505, FR-506 | Covered | The six InsightsServiceTest tests, including ignoresSmallSpendingChangesAsNotWorthMentioning |
| NFR-01, NFR-02 | Not covered | Performance has not been measured |
| NFR-07 | Not covered by automation | Persistence depends on Supabase and needs a manual restart test |
| NFR-10 | Not covered | Visual convention in the UI is checked by eye only |

Summary: of the 21 requirement rows above, 11 are fully covered by automated tests, 3 are partly covered, 6 are not covered by automation, and 1 (FR-201 with NFR-05) is enforced by design.

## 6. Defects found and fixed

| Date | Defect | How it was found | Fix |
|---|---|---|---|
| Oct 1 | Transactions page showed "Nothing here yet" while 9 rows existed | Manual use of the running app | Replaced a broken query with a proper find by user query (build log 09) |
| Oct 1 | Account numbers written with dashes or spaces were not redacted | Code review of the redaction pattern against realistic statement formats | Redaction pattern now allows single separators (build log 11) |
| Oct 2 | The categorizer had no confidence score, so the 0.70 threshold could not be applied | Audit of the code against FR-302 | Added a score and the low confidence flag (build log 14) |
| Oct 2 | The import summary always reported zero skipped rows | Audit of the code against FR-104 | The parser now counts skipped rows (build log 14) |
| Oct 3 | The user interface could not edit most fields or delete a transaction | Audit of the app against FR-403 and FR-404 | Added inline edit and a two click delete (build log 17) |
| Oct 27 | The Supabase table was readable through the public data API because Row Level Security was off | Supabase security advisor email | Enabled Row Level Security and removed public access (build log 16) |

Several of these defects were found by comparing the software to its written requirements, not by a failing test. That is a reason to add tests for them, listed in section 9.

## 7. Known limitations

1. The backend has not been run against the live Supabase database in an automated way. All 52 tests use mocks.
2. The Row Level Security change on October 27 has not yet been confirmed against a running backend.
3. The frontend has no unit or component tests. Its CI step only builds the code.
4. Delete, the 10 MB upload limit, the 24 month trend limit and the redacted row count have no tests.
5. Performance targets NFR-01 and NFR-02 have not been measured.
6. No user based testing has been done, because the system has no accounts and has not been deployed.

## 8. Manual end to end test plan

These cases follow the Milestone 2 user stories. The result column is left blank until each case is run on the running system.

| ID | Story | Steps | Expected result | Result |
|---|---|---|---|---|
| M-01 | US-1 | Upload `docs/build-log/sample-statement.csv` | Transactions appear, summary shows parsed, saved, redacted, skipped and duplicate counts | Not yet run |
| M-02 | US-1 | Check a row that contained a long digit reference | The description shows the redaction placeholder and no original digits | Not yet run |
| M-03 | US-1 | Upload the same file again | No new rows are created and the duplicate count equals the row count | Not yet run |
| M-04 | US-1 | Upload a file with one bad row | Good rows save, one row is reported as skipped | Not yet run |
| M-05 | US-1 | Upload a file larger than 10 MB | A clear error message appears and nothing is saved | Not yet run |
| M-06 | US-2 | Find a row with the auto-guessed badge and change its category | Category updates, badge disappears, reports use the new category | Not yet run |
| M-07 | US-3 | Add a manual transaction with all fields | It appears in the list and in that month's report | Not yet run |
| M-08 | US-3 | Submit the manual form with no amount | Submission is rejected and the amount field is highlighted | Not yet run |
| M-09 | FR-403 | Edit date, description and amount of a row, then save | The row shows the new values after saving | Not yet run |
| M-10 | FR-404 | Delete a row and confirm | The row is removed and totals update | Not yet run |
| M-11 | US-4 | Open a past month and a month with no data | Past month shows totals and a category breakdown, empty month shows zeros | Not yet run |
| M-12 | FR-501 | Choose a custom date range | Report covers exactly that range | Not yet run |
| M-13 | US-5 | Compare a month with a large change against one with a small change | The large change shows a trend note, the small one does not | Not yet run |
| M-14 | NFR-07 | Stop and restart the backend, then reload | All earlier transactions are still present | Not yet run |
| M-15 | Security | After restart, load the Dashboard following the Row Level Security change | Dashboard loads with no server error | Not yet run |

## 9. Recommended next tests

1. Run the manual plan in section 8 and record the results in the table.
2. Add unit tests for delete, the 10 MB limit, the redacted row count and the 24 month trend limit.
3. Add one integration test class that runs the repository queries against a real PostgreSQL instance.
4. Add a basic frontend test setup so CI checks behavior as well as the build.
5. Measure report and import time against NFR-01 and NFR-02 with a generated data set.

## 10. Conclusion

All 52 automated backend tests pass and both CI workflows are green, so the core logic (redaction, parsing, categorization, duplicate skipping, reporting and insights) behaves as specified under test. The main gaps are the absence of tests against a real database, the missing frontend tests, and the manual end to end run, which has not been completed since the move to Supabase.
