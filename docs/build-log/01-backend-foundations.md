# Build Log 01 — Backend Foundations

**Date:** Oct 1, 2026
**What exists after this entry:** a working Spring Boot project structure, the `Transaction` data model, the database layer, and the first two real features — adding/listing transactions and the month/year income-vs-expense report.

This log is written for a future teammate (or future me) who opens this repo with zero context. Every "why," not just "what," is explained here on purpose — that's the whole point of this project being a learning exercise, not just a deliverable.

---

## 1. What is Spring Boot, actually?

Spring Boot is a Java framework for building web applications/APIs without writing a ton of boilerplate yourself (a raw web server, routing, JSON conversion, database connection handling, etc.). You write plain Java classes and add **annotations** (the `@Something` lines above classes/methods) that tell Spring "this class is a web controller," "this class is a database table," and so on. Spring reads those annotations at startup and wires everything together for you — this is called **Dependency Injection**, and you'll see it in action below.

## 2. What is Maven, and what is `pom.xml`?

Maven is the tool that manages a Java project's dependencies (external libraries) and knows how to build/run it. `pom.xml` ("Project Object Model") is Maven's configuration file. Ours declares:

- **Parent:** `spring-boot-starter-parent` — a base configuration that picks compatible versions of everything else for us, so we don't have to hunt down version numbers that work together.
- **Dependencies** — each one is a pre-built chunk of functionality we're pulling in instead of writing ourselves:
  - `spring-boot-starter-web` — turns our app into an HTTP server that can receive requests and send JSON back.
  - `spring-boot-starter-data-jpa` — lets Java objects (like `Transaction`) be saved to/read from a SQL database without us writing SQL by hand for basic operations.
  - `h2` (runtime) — a tiny database that lives in memory (resets every restart). Zero setup, perfect for building before we have real infrastructure. **This gets swapped for PostgreSQL before we actually deploy** — noted directly in `application.properties` and again here so it isn't forgotten.
  - `spring-boot-starter-validation` — lets us write rules like `@NotNull` directly on our data fields instead of manually checking `if (x == null)` everywhere.
  - `spring-boot-devtools` (dev-only) — auto-restarts the app when code changes, during development only.
  - `spring-boot-starter-test` (test-only) — JUnit + Mockito + Spring's testing helpers.

**Note on auth:** we initially added `spring-boot-starter-security` here and built a `SecurityConfig`. We then explicitly decided to **defer login/authentication entirely** and focus on the dashboard and core features first — so that dependency and config file were removed. There is currently no login; every endpoint takes a `userId` as a plain request parameter as a stand-in. This is called out again below.

## 3. Project layout

```
backend/
  pom.xml
  src/main/java/com/kyf/knowyourfinance/
    KnowyourfinanceApplication.java   <- entry point
    model/                            <- data (what a "Transaction" IS)
      Transaction.java
      TransactionType.java
      TransactionCategory.java
    repository/                       <- database access (how we FIND/SAVE data)
      TransactionRepository.java
    service/                          <- business logic (what a feature MEANS)
      DashboardService.java
    controller/                       <- HTTP layer (what the frontend CALLS)
      HealthController.java
      TransactionController.java
      DashboardController.java
    dto/                               <- response shapes sent to the frontend
      MonthlyReportResponse.java
  src/main/resources/
    application.properties            <- configuration (DB, port, etc.)
```

This is a deliberate **layered architecture**. Data flows one direction:

```
HTTP request → Controller → Service → Repository → Database
HTTP response ← Controller ← Service ← Repository ← Database
```

Each layer only knows about the layer directly below it. The controller doesn't know *how* a report is calculated, just that it can ask the service for one. The service doesn't know *how* data is stored, just that it can ask the repository for totals. This matters practically, not just academically: when we add PostgreSQL later, only the repository/config layer changes — the controllers and services don't need to know or care.

## 4. The `Transaction` entity — the heart of the app

Every feature in KYF is really just a different way of looking at a list of `Transaction` rows: the dashboard, the category pie chart, the month/year report. `Transaction` has: `id`, `date`, `description`, `amount`, `type` (INCOME/EXPENSE), `category`, and `userId`.

Two decisions worth highlighting because they're easy to get wrong:

- **`BigDecimal`, never `double`/`float`, for money.** Binary floating-point numbers can't represent most decimal fractions exactly (`0.1 + 0.2 != 0.3` in floating point). That tiny error compounding across thousands of transactions is unacceptable for money. `BigDecimal` does exact decimal math instead.
- **Enums stored as `STRING`, not the default number.** `@Enumerated(EnumType.STRING)` stores the word `"INCOME"` in the database instead of a position number (`0`). Slightly more storage, but it means (a) the raw database is human-readable, and (b) if we ever reorder the enum's values in code, old data doesn't silently become wrong — which *would* happen with the default numeric storage.

**What's deliberately missing:** no account number, no routing number, nothing that identifies a real bank account. This isn't an oversight — it's the core security decision of the whole project. The redaction step (built later, as part of statement upload) is what guarantees those fields never make it this far upstream to even be considered for saving.

## 5. The repository layer — letting Spring write our SQL

`TransactionRepository` is an **interface** with no implementation — we declare what we want, Spring Data JPA writes the actual SQL. Two techniques used:

- **Derived queries** — Spring parses the method name itself. `findByUserIdAndDateBetween(...)` becomes `WHERE user_id = ? AND date BETWEEN ? AND ?`. No SQL typed anywhere.
- **`@Query` with JPQL** — once we need real math (`SUM()`, `GROUP BY`), we write it explicitly in JPQL (SQL-like, but it talks about Java fields/objects instead of raw table/column names). We use this for totaling income/expenses and for grouping expenses by category — letting the *database* do the summing is both faster and avoids pulling every row across the network just to add them up in Java.

## 6. The service layer — where "a report" gets defined

`DashboardService` takes a year + month, turns that into a date range, and asks the repository for three numbers: total income, total expenses, and a category breakdown. This logic lives here — not in the controller — because (a) the upcoming statement-upload feature will likely want these same totals, and duplicating this math in two places is exactly how bugs happen, and (b) a plain service method is far easier to unit-test than one wired to a live HTTP server.

## 7. The two live features, right now

- `POST /api/transactions` / `GET /api/transactions?userId=1` / `GET /api/transactions/{id}` / `DELETE /api/transactions/{id}` — manual transaction entry and lookup. (Most transactions will eventually come from the statement-upload pipeline, not this — but we need manual entry regardless, for things a statement wouldn't capture, like cash spending, and it's also how we'll put test data in before upload exists.)
- `GET /api/dashboard/report?userId=1&year=2026&month=9` — **the differentiator feature.** Pick any month/year, get income vs. expenses vs. net savings, plus a spending-by-category breakdown.

## 8. What's intentionally NOT here yet

- **No login/authentication.** Every endpoint takes `userId` as a plain parameter instead of reading it from a session. This was an explicit decision to focus on the dashboard/features first; `userId` is marked in code as a placeholder pending a real `User` entity and login.
- **No real database.** H2 is in-memory and wipes on every restart — fine for building, not for real users. PostgreSQL + managed migrations (Flyway) come before deployment.
- **No statement upload/parsing/redaction yet.** That's the next major feature — it's what actually produces real `Transaction` rows instead of ones we add by hand for testing.
- **No frontend yet.** These are API endpoints only, tested so far by reasoning about the code (this sandbox can't resolve Maven Central to actually compile — that first real compile/run happens on a machine or CI with full network access).

## 9. Honest limitation to flag

This build environment can't reach Maven Central, so none of this has been compiled or run yet in this session. The code is written to compile cleanly by inspection (standard Spring Boot patterns, matching method signatures throughout), but the real first build/run needs to happen either locally (`mvn spring-boot:run` from `backend/`) or via GitHub Actions once this is pushed. That first successful build is worth treating as its own milestone, not an afterthought.

## 10. GitHub access troubleshooting note

While setting this up, pushing to the `knowYourFinance` repo kept failing with a "credential doesn't have access" error, even after the GitHub account itself was connected. The cause: **repo visibility (public/private) and GitHub App repo-permission are two separate settings**, and it's easy to assume fixing one fixes the other.

- **Public vs. private** controls who can *see* the repo on github.com.
- **GitHub App installation → repository access** (at `github.com/settings/installations` → the Claude app → **Configure**) controls which specific repos that app is allowed to read/write, independent of visibility.

A private repo with the app explicitly granted access works fine for pushing. A public repo *without* that grant will usually still allow read-only cloning (often with no setup at all), but **will not** allow pushing commits — the push path always needs the app's permission step, regardless of public/private.

**Fix attempt 1 (didn't apply here):** `github.com/settings/installations` had no "Claude" app installed at all for this account — only Railway and Vercel showed up.

**Fix attempt 2 (partial, misleading):** every repo visible to the session's GitHub connection (`lifeos-fullstack`, `aj-portfolio`, etc.) happened to already be public, and `knowYourFinance` wasn't visible at all while private. Making it public did make it *visible/attachable* — but that turned out to be a coincidence, not the actual fix. Attaching it after going public still came back with push explicitly refused.

**The real root cause:** the Claude GitHub App genuinely was not installed for this GitHub account/org at all. The error, once the repo could be attached, said so directly and gave the exact install link: `https://github.com/apps/claude/installations/select_target`. That's different from `github.com/settings/installations` (which only lists apps already installed) — this link is GitHub's page to install a *new* app and pick which account/repos it can access.

**Actual fix:** open `https://github.com/apps/claude/installations/select_target`, choose the personal account, and grant it access to `knowYourFinance` (or all repos). Visibility (public/private) was not the deciding factor in the end.
