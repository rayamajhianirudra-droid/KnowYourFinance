# Build Log 05 — First Unit Tests

**Date:** Oct 1, 2026
**What exists after this entry:** `RedactionUtilTest`, `AutoCategorizerTest`, `DashboardServiceTest` — the first automated tests in the project.

## Why these three classes first

Each one was picked because it's cheap to test in isolation, which is itself a sign the layered architecture is paying off:

- **`RedactionUtil`** has zero Spring dependencies — it's a pure function, String in, String out. No database, no mocking needed at all. Given this is the single most security-critical class in the app, having a fast, dependency-free test suite for it means it can be run constantly with no setup cost.
- **`AutoCategorizer`** is similarly dependency-free — `new AutoCategorizer()` and go.
- **`DashboardService`** is the first test using **Mockito** to fake `TransactionRepository` (`@Mock` + `when(...).thenReturn(...)`), so the report math (`income - expenses = net savings`, mapping category totals into the response) gets verified without touching a real database at all. This is the direct payoff of keeping the service layer separate from the repository layer, discussed in the learning notes doc: the math can be tested completely independently of whether the SQL queries themselves are correct.

## What's covered

- Redaction: long digit runs get masked, short store numbers don't, plain text passes through, the exact 8-digit threshold is verified on both sides, null input doesn't throw.
- Categorization: known merchant keywords match, case-insensitivity, fallback to OTHER for no-match/blank/null, income keywords.
- Dashboard: net savings calculation (both positive and negative), category breakdown mapping into the response DTO.

## Running them

```
cd backend && mvn test
```
(Same caveat as every build-log entry so far: this sandbox can't resolve Maven Central, so these haven't actually been executed yet in this environment — they're written to compile and pass by inspection against JUnit 5/Mockito's standard APIs, and the real first run happens on your machine or in CI.)

## What's still untested

- The controllers themselves (`@WebMvcTest` / `MockMvc` would be the next layer)
- `CsvStatementParser` and `StatementImportService` end-to-end (the whole upload pipeline, including the new duplicate-detection logic)
- `TransactionRepository`'s derived queries against a real (even if in-memory H2) database — an `@DataJpaTest` would cover this
