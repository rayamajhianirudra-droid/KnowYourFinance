# Build log 21: Performance measurements and batched inserts

Date: November 14, 2026

## Goal
Replace the efficiency claims (counts of database calls) with measured numbers for NFR-01 and NFR-02.

## What I did
1. Wrote `PerformanceTest` (3 tests) that seeds 5,000 transactions and prints timing and statement counts, and fails if a limit is broken.
2. The first run showed the import of 1,000 rows prepared 1,001 SQL statements. Cause: the id column was an identity column, which stops Hibernate from batching inserts.
3. Switched `Transaction.id` to a sequence (`transactions_seq`, increment 50) and turned on JDBC batching in `application.properties`. Created the matching sequence on Supabase first, so the old and new code both work during the switch.
4. A duplicate `@Id` annotation broke the first push. CI caught it, and the fix was one line.
5. Re-ran in CI: 22 statements for the same import, all 77 backend tests green.

## Honest limits
CI timings are from a local database. Remote latency to Supabase was not measured.
