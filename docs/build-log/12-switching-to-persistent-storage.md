# Build Log 12 — Switching to Persistent (File-Based) Storage

**Date:** Oct 1, 2026
**What exists after this entry:** H2 now writes to a real file (`backend/data/kyfdb.mv.db`) instead of living only in RAM — data survives both intentional restarts and the backend just sitting idle.

## What actually happened (a real bug, not a theory)

While testing the redaction hardening (build-log 11), an upload suddenly failed with "Upload failed (500)." The backend's log revealed the real cause had nothing to do with redaction at all:

```
HikariPool-1 - Thread starvation or clock leap detected (housekeeper delta=4h39m...)
...
Table "TRANSACTIONS" not found (this database is empty)
```

The laptop had gone to sleep for a few hours. When it woke up and the connection pool reconnected, the database was simply *gone* — even though the backend process itself never stopped or restarted. This is a sharp, easy-to-miss edge of H2's in-memory mode: `jdbc:h2:mem:kyfdb` lives only as long as *at least one connection to it stays open*. The instant every connection closes - which a sleeping laptop's connection pool cycling through reconnects can absolutely trigger - H2 quietly throws the whole database away and starts fresh the next time something connects. Restarting the app was already a known way to lose data (every build-log since 09 mentions re-uploading the sample statement); this showed that simply *leaving the laptop idle* could do the same thing mid-session, silently, with no restart involved.

## The fix

```properties
spring.datasource.url=jdbc:h2:file:./data/kyfdb
```

One line changed, from `jdbc:h2:mem:kyfdb` to `jdbc:h2:file:./data/kyfdb`. This tells H2 to write the actual database to a file on disk (`backend/data/kyfdb.mv.db`) instead of keeping it only in memory. That file is added to `.gitignore` — it's local data, not code, and every developer running the app gets their own copy, the same reasoning as not committing a `node_modules` folder.

With this change: stopping and restarting the backend (`Ctrl+C` → `mvn spring-boot:run`) no longer wipes anything, and neither does the laptop sleeping. The only way to clear the data now is deleting that file on purpose.

This is still H2, not the production database - the plan to migrate to PostgreSQL before any real deployment (Milestone 4) is unchanged. This fix is specifically about local development no longer being fragile in an ordinary, everyday way (closing a laptop lid).

## Why this is worth understanding, not just fixing

This is a good example of a bug that was *invisible in design and in tests* - nothing about the code was wrong, and no unit test could have caught it, because the bug lived entirely in a single word ("mem" vs "file") in a configuration string, and only showed up under a very specific real-world condition (idle time → connection pool cycling → in-memory DB auto-drop). It's the second time in this project that a gap only surfaced by actually running the app and using it like a real user would (the first was build-log 09's MIN/MAX date bug) - worth remembering as a pattern: some classes of bugs only exist at the intersection of "real time passing" and "a real environment," and no amount of staring at the code or running `mvn test` will surface them.
