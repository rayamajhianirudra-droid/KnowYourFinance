# KnowYourFinance: Milestone 4 Test Report

**Course:** COMP 425, Software Engineering, Fall 2026
**Report date:** November 12, 2026
**Branch and pull request:** `milestone-4`, pull request #1
**Builds on:** [Milestone 3 test report](test-report.md)

## 1. What changed in Milestone 4

| Area | Change |
|---|---|
| Statement import | One duplicate lookup and one batch save per file, inside one database transaction. Before: one lookup and one save per row. |
| Trends chart | One grouped query for the whole span. Before: two queries per month (12 for the default 6 months). |
| Database | Index on (user, date), created on Supabase and declared on the entity. |
| Backend settings | SQL logging off by default, connection pool capped at 5, graceful shutdown, gzip responses, port and allowed web addresses set from the environment. |
| Error handling | A missing or malformed request parameter now returns 400 with the parameter name. Before: 500. |
| Frontend | API address configurable (`VITE_API_BASE_URL`, default `/api`), development proxy, charts loaded on demand. |
| Containers | Dockerfile for each service, `docker-compose.yml`, `.env.example`, nginx proxy with caching and compression. |
| Automation | Frontend CI now also lints and tests. New workflow builds both images and publishes them to GitHub Container Registry on main. Frontend image is started and probed on every run. Dependabot opens weekly update pull requests. |

## 2. Test environment

| Item | Detail |
|---|---|
| Automation | GitHub Actions on ubuntu-latest: Backend CI, Frontend CI, Docker images |
| Backend | JDK 21, Maven, JUnit 5, Mockito, Spring MockMvc, Testcontainers with PostgreSQL 16 |
| Frontend | Node 22, Vitest with jsdom |
| Database for integration tests | A throwaway PostgreSQL container started by the test. Supabase is never touched by tests. |
| Final run | Commit `f80302d`. Backend CI run 43325059684, Frontend CI run 43325060292 (interface refresh: run 43563173586), Docker images run 43325059778. All three succeeded. |

## 3. Results

### 3.1 Backend (Maven, 74 tests, 0 failures, 0 errors, 0 skipped)

| Test class | Tests | Result | New in M4 |
|---|---|---|---|
| RedactionUtilTest | 9 | Pass | none |
| AutoCategorizerTest | 8 | Pass | none |
| CsvStatementParserTest | 6 | Pass | none |
| InsightsServiceTest | 6 | Pass | none |
| TransactionControllerTest | 8 | Pass | none |
| StatementImportServiceTest | 12 | Pass | 4 new, 8 rewritten for the batch design |
| DashboardServiceTest | 11 | Pass | 5 new trend tests replace 1 old one |
| TransactionDeleteControllerTest | 2 | Pass | new |
| StatementControllerTest | 5 | Pass | new |
| HealthControllerTest | 1 | Pass | new |
| TransactionRepositoryIntegrationTest | 6 | Pass | new, runs against real PostgreSQL |
| **Total** | **74** | **74 pass** | 22 more than Milestone 3 |

The Milestone 3 total was 52. 52 plus 22 new tests is 74. All 52 earlier tests still pass after the refactor, with the import and trend tests updated to describe the new behavior.

### 3.2 Frontend (Vitest, 18 tests at the time, 31 after the interface refresh, 0 failures)

| Test file | Tests | What it checks |
|---|---|---|
| format.test.js | 7 | Currency and percent formatting, category labels, missing category fallback |
| api.test.js | 11 | Request addresses, user id, multipart upload, preview flag, error messages from the server, field errors for forms, PUT by id |

Lint: no errors, 4 warnings in code that existed before this milestone (TransactionList and TrendsChart). They were reported, not changed.
Build: succeeds. The main script file is 258 kB (78 kB compressed); the recharts library is split into chart files that load on demand. Before the split the build warned that a single file was over 500 kB.

### 3.3 Docker and pipeline checks

| Check | Result |
|---|---|
| Backend image builds from a clean checkout | Pass (CI) |
| Frontend image builds from a clean checkout | Pass (CI) |
| Frontend container starts on its own and serves the page | Pass (CI smoke test) |
| A deep link such as `/some/deep/link` returns the app, not a 404 | Pass (CI smoke test) |
| `docker-compose.yml` is valid and refuses to start without database settings | Pass (checked locally with `docker compose config`) |

## 4. Defects found by the new tests

| Found by | Defect | Fix |
|---|---|---|
| StatementControllerTest (first CI run) | Calling the upload endpoint without `userId` returned a 500 "Something went wrong" instead of a 400, because the catch all error handler swallowed Spring's own missing parameter error. | Added a handler that returns 400 and names the parameter. The test now asserts the message. |
| First CI run, pipeline | The repository interface lost its `MonthlyTypeTotal` type during an edit, so the backend did not compile. | Restored the interface. CI caught it within minutes, which is what it is for. |
| First CI run, Docker smoke test | The frontend container exited at startup when the backend was not running, because nginx resolved the backend name immediately. | The proxy now looks the backend up per request. |

## 5. Requirement coverage change

| Requirement | Milestone 3 | Milestone 4 |
|---|---|---|
| FR-104 import summary counts | Partly | Covered: redacted, saved, parsed, skipped and duplicate counts are asserted |
| FR-105, NFR-06 10 MB limit | Not covered | Covered at the handler level (the message the page shows). The size limit setting itself is configuration and was not exercised with a real 10 MB file. |
| FR-205 redacted row count | Not covered | Covered |
| FR-404 delete | Not covered | Covered (204 on success, 404 when missing, nothing deleted) |
| FR-504 trend limit | Partly | Covered: 24 month cap, minimum of 1, empty months show zero |
| Repository queries | Not covered | Covered against real PostgreSQL |
| NFR-01, NFR-02 performance | Not covered | Still not measured with timings |

## 6. Efficiency evidence

These are counts of work done, taken from the code and the tests, not stopwatch timings.

| Operation | Database calls before | Database calls after | Verified by |
|---|---|---|---|
| Import a file of N rows | N lookups plus N saves | 1 lookup plus 1 batch save | `checksForDuplicatesWithOneLookupNoMatterHowManyRows`, `saveAll` verified once |
| Trends for M months | 2 times M | 1 | `trendsAsksTheDatabaseOnceNoMatterHowManyMonths` |
| Request holds a database connection | Whole request | Released after the query | `open-in-view=false` (setting, not tested) |

## 7. What has not been tested

1. **Nothing was run against the live Supabase database from the backend container.** Tests use mocks or a throwaway PostgreSQL. The new trends query was run once by hand on Supabase and parsed correctly, but that database had no 2026 data for user 1 at that moment, so it returned no rows.
2. **The full stack with `docker compose up` has not been run.** The Docker engine was not available in the build sandbox, so only the CI image builds and the frontend smoke test cover Docker. The backend image has not been started.
3. **The 15 manual end to end cases in the Milestone 3 report are still unrun.**
4. **No timing measurements.** Efficiency claims are about the number of database calls and file sizes only. NFR-01 and NFR-02 remain unmeasured.
5. **No component tests for screens.** Frontend tests cover the API layer and formatting helpers only.
6. **No security or load testing.** Accounts and authentication are still out of scope (SRS).
7. The index created on Supabase and the pooled connection limit have not been observed under load.

## 8. Reproducing these results

```
cd backend  && mvn verify          # 74 tests; the integration test needs Docker and skips itself without it
cd frontend && npm ci && npm run lint && npm test && npm run build
docker compose up --build          # needs a .env file, see .env.example
```

## 9. Addendum: interface refresh (November 13, 2026)

| Check | Result |
|---|---|
| Frontend tests | 35 pass after the illustration (13 new: date helpers 3, app navigation and upload page 6, dashboard 4) |
| Defects fixed and now covered by tests | Date defaults used UTC and showed tomorrow's date in the evening; unchanged totals showed a red arrow; month name was lowercase |
| Automated accessibility scan (axe-core), 4 screens at laptop and phone size | First run: 3 violations on the upload screen (heading order, unlabeled file input, control nested in a button). Final run: none |
| Lint | No errors, the same 4 warnings as before |
| Build | Succeeds |
| Visual review | Screenshots of every screen at 1366 and 390 pixels wide, before and after |

Not covered: a real phone, Safari, or a screen reader. The scan checks rules a program can check, such as names, labels and contrast, not whether the app is pleasant to use.

## 10. Conclusion

All automated checks pass on the final commit: 74 backend tests, 18 frontend tests, both Docker images, and the frontend container smoke test. The new tests found one real defect (500 instead of 400) and the pipeline caught two of our own mistakes before they reached main. The largest remaining gap is that the full containerized stack has not yet been started end to end against Supabase.
