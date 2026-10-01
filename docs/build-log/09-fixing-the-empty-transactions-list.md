# Build Log 09 — Fixing the Empty Transactions List Bug

**Date:** Oct 1, 2026
**What exists after this entry:** `TransactionRepository.findByUserId` — a real "give me every transaction for this user" query, replacing a broken MIN/MAX trick.

## The bug, as it actually showed up

After uploading the sample statement and adding a manual transaction, the Dashboard correctly showed real numbers for both September and October — but the Transactions tab said "Nothing here yet," even though 9 real rows existed in the database.

## Why it happened

`GET /api/transactions?userId=1` (no date range) used to be implemented as:

```java
return transactionRepository.findByUserIdAndDateBetween(userId, LocalDate.MIN, LocalDate.MAX);
```

The idea was: reuse the existing range query, and just pass "from the dawn of time to the end of time" as the range, instead of writing a second near-identical query. It looked reasonable, and it even *compiled and ran without errors*.

The problem: `LocalDate.MIN` is the year `-999999999`, and `LocalDate.MAX` is `+999999999`. A database's `DATE` column can't actually store years that extreme — the SQL standard's usual range is roughly year 1 to year 9999. So when that `BETWEEN` comparison hit the real database, it silently matched nothing at all. No exception, no error in the logs — just an empty result for a query that looked syntactically correct.

This is a good example of a bug that **unit tests didn't catch**, and it's worth understanding why: the existing test for this endpoint mocked the repository method directly —

```java
when(transactionRepository.findByUserIdAndDateBetween(any(), any(), any())).thenReturn(List.of(t));
```

Mocking with `any()` for every argument means the test never actually exercises what value gets passed in, or what a real database does with `LocalDate.MIN`/`MAX`. The test proved "if this repository method returns a transaction, the controller returns it as JSON" — which was never the broken part. The actual bug only showed up against a real database, which is exactly the kind of thing manual testing (like this very click-through session) catches and a mocked unit test, by its nature, cannot.

## The fix

Added a dedicated repository method instead of reusing the range query with fake bounds:

```java
List<Transaction> findByUserId(Long userId);
```

and switched the controller's "no range given" branch to call it directly. The test for this endpoint was also rewritten to stub `findByUserId` specifically — so if a future change ever swaps it back to the MIN/MAX trick, the test will actually catch it (stubbing the right-named method and getting "no match" back, unlike the old `any()`-everywhere version).

## The broader lesson

A unit test that mocks every argument of the method under test can give false confidence — it proves the wiring around a method works, not that the method's actual arguments are correct. The gap between "compiles and passes tests" and "works against a real database" is exactly why end-to-end manual testing (clicking through the actual running app) still matters, even with decent test coverage.
