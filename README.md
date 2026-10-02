# KnowYourFinance (KYF)

A personal finance app that helps you understand what you earn, spend, and save — **without linking your bank account.**

Instead of connecting to your bank (Plaid-style), you upload a CSV export of your statement. KYF parses it, automatically strips out anything that looks like an account/routing number, categorizes the transactions, and gives you a month/year income-vs-expense report. Cash spending is covered too, through manual entry — it lands in the exact same dashboard as everything else.

## Why no bank linking?

Most budgeting apps ask for your bank login and keep a standing connection to your account. KYF never does. The tradeoff is explicit: you lose automatic real-time syncing, and in exchange the app is structurally incapable of leaking your bank credentials — because it never has them in the first place. See [`docs/build-log/02-statement-upload-pipeline.md`](docs/build-log/02-statement-upload-pipeline.md) for exactly how the redaction works.

## Project structure

```
backend/    Spring Boot 3.3.4 / Java 21 REST API
frontend/   React (Vite) UI
docs/       build-log/ — plain-language documentation of every decision made, in build order
```

## Running it locally

The backend connects to a shared Supabase (hosted PostgreSQL) database, so before running it for the first time, set three environment variables with your database credentials:

```bash
export SPRING_DATASOURCE_URL="jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:5432/postgres"
export SPRING_DATASOURCE_USERNAME="postgres.nmivkmwsxdbszuzbldyp"
export SPRING_DATASOURCE_PASSWORD="<ask a teammate, or get it from Supabase: Project Settings > Database > Reset database password>"
```

Put these in your shell profile (or an `.env` file your terminal loads) so you don't have to retype them every session. **Never commit the password** — it's a secret, not code, which is exactly why it's an environment variable instead of a line in `application.properties`.

Once those are set, one command starts both the backend and the frontend:

```bash
./start.sh
```

Press Ctrl+C once to stop both. The first time you run it, install frontend dependencies first:

```bash
cd frontend && npm install && cd ..
./start.sh
```

If you'd rather run them separately (two terminals):

```bash
# Terminal 1: backend (http://localhost:8080)
cd backend
mvn spring-boot:run

# Terminal 2: frontend (http://localhost:5173)
cd frontend
npm run dev
```

Note that neither of these runs as a background service. Shutting down or restarting your computer stops both processes, same as closing any other program, so you'll need to run `./start.sh` again next time. That's expected, and it has nothing to do with data persistence — the data now lives in Supabase, not on your machine, so it survives whether or not the backend is running.

## Core features

- **Statement upload** (`POST /api/statements/upload`) — CSV in, redacted + categorized transactions out
- **Manual entry** (`POST /api/transactions`) — for cash spending, which never appears on a bank statement
- **Monthly report** (`GET /api/dashboard/report`) — income, expenses, net savings, and a category breakdown for any month/year you pick
- **Transaction list** — every transaction on file, statement-imported or manual, in one place

## Documentation

Everything is documented as it was built, in order, in [`docs/build-log/`](docs/build-log/):

1. [Backend foundations](docs/build-log/01-backend-foundations.md) — project scaffold, the `Transaction` model, why `BigDecimal`/enums
2. [Statement upload pipeline](docs/build-log/02-statement-upload-pipeline.md) — the redaction mechanism, in full
3. [Minimal frontend](docs/build-log/03-minimal-frontend.md) — the React UI
4. [Error handling](docs/build-log/04-error-handling.md) — clean API error responses
5. [First tests](docs/build-log/05-first-tests.md) — unit and controller-level tests

## Course context

This is a COMP 425 (Software Engineering) semester project at SMSU, following a waterfall model across six milestones (Opportunity Study → Requirements Spec → Design Doc → MVP/Docker → Testing/CI-CD → Final Showcase). It's also being used as a personal learning project — every technical decision is documented in plain language, not just implemented.

## Status

No authentication yet (deliberate — dashboard and core features came first). No PostgreSQL/Docker/CI-CD yet (later milestones). See each build-log entry's "what's intentionally missing" section for the full honest list.
