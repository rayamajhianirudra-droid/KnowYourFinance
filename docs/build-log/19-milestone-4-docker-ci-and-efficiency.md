# Build Log 19: Milestone 4, Docker, CI/CD and Efficiency

**Date:** Nov 12, 2026
**What exists after this entry:** The app can be started with one Docker Compose command, the pipeline builds and publishes images, the slowest code paths make far fewer database calls, and the test suite grew from 52 to 74 backend tests plus 18 frontend tests.

## Why these changes

Milestone 3 listed three things for this milestone: Docker so nobody needs Maven installed, automation after every push, and honest testing against a real database. While reading the code for the Docker work we also found places where work was repeated, so those were fixed in the same pass.

## Efficiency changes

- **Import.** The old code asked the database "does this row already exist?" once for every row, then saved rows one at a time. It now loads the already stored rows for the file's date span in one query, compares in memory, and saves everything with one batch call inside one transaction. A side effect is that a failed import no longer leaves half a file saved.
- **Duplicate comparison.** The database returns an amount as 5.7500 and the file says 5.75. The comparison removes trailing zeros so these count as equal. A test covers this.
- **Trends.** The chart used two queries per month. One grouped query now returns the whole span.
- **Index.** An index on user and date was added on Supabase and declared on the entity, because every list and report filters by those two columns.
- **Settings.** SQL logging off, small connection pool (Supabase limits connections for the whole project), gzip, graceful shutdown, connection released after the query.
- **Frontend.** Charts load on demand, which took the main script from over 500 kB to 258 kB.

## Docker and pipeline

- Each service has a two stage Dockerfile. The backend image builds with Maven and runs on a small Java runtime as a non root user with a health check. The frontend image builds the site and serves it with nginx, which also forwards `/api` to the backend.
- `docker-compose.yml` starts both. The database stays on Supabase, so the only setup is a `.env` file (template in `.env.example`, the real file is ignored by git).
- Workflows: backend and frontend CI cancel superseded runs and keep test reports; frontend CI lints and runs tests; a new workflow builds both images, starts the frontend image and probes it, and pushes images to GitHub Container Registry on main. Dependabot opens weekly update pull requests.

## What the pipeline caught

Three of our own mistakes failed in CI on the first push and were fixed the same hour: a deleted interface, an nginx startup failure when the backend is absent, and a 500 that should be a 400. See the Milestone 4 test report for details.

## Still open

- Run `docker compose up --build` on a machine with Docker and record the result.
- Choose a hosting service (the images are ready to deploy anywhere that runs containers).
- Run the manual end to end cases and measure NFR-01 and NFR-02 with timings.
- Accounts and authentication remain out of scope per the SRS.
