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

The backend connects to a shared Supabase (hosted PostgreSQL) database, so first create a file named `.env` in the project root (copy `.env.example`) and put the database password in it. Never commit `.env`; it is a secret, not code.

### Option 1: Docker (nothing else to install)

```bash
docker compose up --build
```

Then open http://localhost:3000. The web page and the API share that one address.

### Option 2: run the pieces directly

Set the three variables from `.env.example` in your shell (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`), then:

```bash
# Terminal 1: backend (http://localhost:8080), needs Java 21 and Maven
cd backend && mvn spring-boot:run

# Terminal 2: frontend (http://localhost:5173)
cd frontend && npm install && npm run dev
```

`./start.sh` starts both in one terminal. The data lives in Supabase, so it survives restarts whether or not the app is running.

### Running the tests

```bash
cd backend  && mvn verify                       # 74 tests; the integration test needs Docker
cd frontend && npm test                         # 31 tests
```

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

## Requirements and design

- [Milestone 2: Software Requirements Specification](docs/requirements/milestone-2-srs.md)
- [Milestone 3: Formal Analysis and Design Document](docs/design/milestone-3-design.md)
- [Mermaid diagram sources](docs/diagrams/) (one file per diagram, kept in sync with the design document)
- [Test reports](docs/testing/): Milestone 3 and Milestone 4

## Course context

This is a COMP 425 (Software Engineering) semester project at SMSU, following a waterfall model across six milestones (Opportunity Study, Requirements Spec, Design Doc, MVP and Docker, Testing and CI/CD, Final Showcase). It's also being used as a personal learning project — every technical decision is documented in plain language, not just implemented.

## Status

Milestone 4 adds Docker, a build and publish pipeline, faster imports and trends, and a larger test suite (see [build log 19](docs/build-log/19-milestone-4-docker-ci-and-efficiency.md) and the [Milestone 4 test report](docs/testing/milestone-4-test-report.md)). There is no authentication yet: accounts are out of scope in the requirements specification. See each build-log entry's "what's intentionally missing" section for the full honest list.
