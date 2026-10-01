# Build Log 03 — Minimal Frontend

**Date:** Oct 1, 2026
**What exists after this entry:** a React (Vite) frontend with three working screens: the monthly dashboard, statement upload, manual (cash) transaction entry, and a full transaction list. It's plain-styled on purpose — this pass exists to prove the backend pipeline end-to-end through a real UI, not to be the final design.

---

## 1. Why Vite + plain React, no router, no state library

`npm create vite@latest . -- --template react` scaffolds a React project with a fast dev server and zero config needed to get `npm run dev` working. For an app this size (four screens, no nested routes, no URL-addressable pages needed yet) a router (React Router) and a state management library (Redux, Zustand, etc.) would be solving problems we don't have yet. Navigation is just `useState("dashboard" | "upload" | "manual" | "transactions")` in `App.jsx`, swapping which component renders. If the app grows real distinct pages worth linking to directly (a URL for "this month's report"), that's the moment to add a router — not before.

## 2. The four screens, and what each proves

- **Dashboard** (`Dashboard.jsx`) — month/year pickers, calls `GET /api/dashboard/report`, renders income/expenses/net savings and a sorted category breakdown. This is the differentiator feature made visible.
- **Upload statement** (`UploadStatement.jsx`) — a file input + `POST /api/statements/upload`, shows how many rows were imported and how many had something redacted. This is the alternative to bank-linking, made visible.
- **Add cash transaction** (`ManualEntry.jsx`) — see section 4 below.
- **All transactions** (`TransactionList.jsx`) — a plain table of everything on file, sorted newest-first. The "receipts" behind the dashboard's summary numbers.

## 3. `api.js` — one file for every backend call

Every fetch call lives in `src/api.js` instead of being scattered inside components. Three reasons this matters in practice, not just in theory: (1) the backend base URL (`http://localhost:8080/api`) only needs to change in one place, (2) when real login exists, "attach the signed-in user's token to every request" is a one-file change instead of a hunt through every component, and (3) components stay focused on rendering instead of mixing in fetch/error-handling boilerplate.

**`CURRENT_USER_ID = 1`** is a clearly-marked temporary stand-in, matching the backend's `userId`-as-a-parameter decision (see build-log 01, section on deferring auth). Every API call hardcodes it for now. This is the single line that changes — and the only one — once real accounts exist.

## 4. Cash transactions — closing the gap a statement can't

A question worth answering directly: **statements only show what went through the bank.** Someone who pays cash for groceries, a coffee, a tip — none of that appears on any bank statement, so a purely upload-driven app would silently under-count their actual spending. That's what `ManualEntry.jsx` is for: a small form (date, description, amount, income/expense, category) that calls `POST /api/transactions` — the exact same endpoint and the exact same `Transaction` table that statement imports write to.

This matters more than it might look: there is **no separate "cash mode."** A manually entered $6 coffee and a statement-parsed $6 coffee become identical rows once saved — same fields, same table, same dashboard math. That's *why* cash and bank spending end up combined correctly in one month/year report instead of requiring two separate totals the user has to add in their head.

## 5. What's still a placeholder, on purpose

- **No login.** `CURRENT_USER_ID = 1` everywhere. This mirrors the backend's explicit decision to build out the dashboard/features first and defer authentication.
- **No routing/URLs per screen.** Tabs are just component state, not addressable routes.
- **No loading skeletons, no optimistic UI, minimal empty-states.** Functional, not polished — this pass is about proving the pipeline, not the final visual design.
- **No duplicate-upload protection** (same caveat as build-log 02) — uploading the same CSV twice will currently create duplicate rows, visible in the transaction list.

## 6. Running it locally

Two processes, two terminals:
```
# terminal 1 - backend
cd backend && mvn spring-boot:run

# terminal 2 - frontend
cd frontend && npm install && npm run dev
```
The frontend expects the backend at `http://localhost:8080` (hardcoded in `api.js` for now — see section 3). Vite's dev server will print its own local URL (typically `http://localhost:5173`).
