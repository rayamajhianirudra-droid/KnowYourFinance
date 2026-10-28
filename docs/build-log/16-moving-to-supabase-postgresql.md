# Build Log 16: Moving to Supabase (PostgreSQL)

**Date:** Oct 2, 2026
**What exists after this entry:** The backend no longer talks to a local H2 file. It connects to a real hosted PostgreSQL database on Supabase, reachable from any machine, with its credentials read from environment variables instead of being written into the codebase.

## Why this happened now

The H2 file database (build log 12) was always meant to be temporary - it solved one specific problem (data surviving a laptop sleep/restart) for one person developing on one laptop. It was never going to be the real production database, and the comments in `application.properties` said as much from the start ("We'll still switch this to PostgreSQL before any real deployment").

This move happened now, specifically, to get more deployment options going forward - a hosted database means the backend can eventually run somewhere other than a developer's own laptop, both teammates can work against the same data instead of two separate local files, and the project doesn't have to revisit this decision again later under time pressure before a real deployment.

## What changed

**Database:** A Supabase project now hosts the actual `transactions` table, matching `Transaction.java` field for field (date, description, amount, type, category, user_id, low_confidence), with indexes on `user_id` and `date` since those are the columns every dashboard query filters by.

**Backend dependency:** `pom.xml` swapped the H2 driver for the PostgreSQL JDBC driver (`org.postgresql:postgresql`).

**Backend configuration:** `application.properties` now reads the database URL, username, and password from environment variables (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`) instead of hardcoding them. The connection goes through Supabase's Session Pooler (port 5432) rather than a direct connection, because a direct connection to Supabase requires IPv6 and we didn't want "can this even connect" depending on whose network it's running on - the pooler works over ordinary IPv4. The H2 console config (`spring.h2.console.enabled`) was removed since there's no H2 to look at anymore.

**Why environment variables, not a config file:** A database password is a secret. Writing it into `application.properties` would mean committing it to git, where it's visible to anyone with repo access, forever, in the history, even if removed later. Environment variables keep it out of the codebase entirely - each person running the app locally sets their own copy once, and it never touches a file git tracks.

**README:** Added the three environment variables a teammate needs to set before running the backend locally, and a note on where to get the actual password (Supabase dashboard, Project Settings > Database).

## What did not change

No entity, repository query, or business logic changed. The `@Query` methods in `TransactionRepository` are written in JPQL (Hibernate's database-independent query language), not raw SQL, so they didn't need touching - Hibernate translates them to whichever database is actually configured. `spring.jpa.hibernate.ddl-auto=update` is still in place, so if an entity ever gains a new field, Hibernate adds the matching column automatically, same as it did with H2.

All seven backend test classes are plain unit tests using Mockito-mocked repositories - none of them boot a real Spring context or touch an actual database - so none of them needed any change for this migration, and none of them require the environment variables to be set to run.

## A security note worth knowing about

Supabase's security advisor flagged the new `transactions` table for having Row Level Security (RLS) disabled, and this entry first dismissed that as not applicable. That was wrong, and it was corrected on Oct 27, 2026. Every Supabase project exposes a public data API, and a table in the `public` schema with RLS off can be read, changed and deleted by anyone who has the project URL and the public key, no matter how the Spring Boot backend connects. The backend itself was never the problem, because the React frontend only talks to the backend's own API. The exposure was the database's separate public door.

The fix was a migration that enables RLS on `transactions` and revokes the table's privileges from the `anon` and `authenticated` roles. No policies were added on purpose, so the public API gets no access at all. The backend is unaffected because it connects as the `postgres` role, which bypasses RLS by design. The advisor now reports only an informational note that RLS is on with no policies, which is the intended state. If a future version lets the frontend query Supabase directly, real policies will be needed at that point.

## Still open

The sandbox this app is being built in cannot reach Maven Central (same limitation noted since build log 1), so this change is verified the same way every backend change has been verified here: pushed to GitHub and checked against the real `Backend CI` workflow, which runs on GitHub's own servers with full internet access. Actually connecting to the new Supabase database and confirming a real end-to-end save-and-read still needs to happen on a machine that can run Maven and reach the internet normally - the schema and code are in place and compile, but nobody has actually run the app against the new database yet.
