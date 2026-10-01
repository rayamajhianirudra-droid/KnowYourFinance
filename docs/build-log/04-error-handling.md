# Build Log 04 — Global Error Handling

**Date:** Oct 1, 2026
**What exists after this entry:** every API error (bad input, oversized upload, unexpected bug) now returns a clean, consistent JSON shape instead of a raw Java stack trace.

## Why this matters

Without `GlobalExceptionHandler`, any error anywhere in the app — a missing required field on `POST /api/transactions`, an upload over the 10MB limit, an unanticipated bug — would send the raw exception straight back to the browser. That's unhelpful for the frontend (it gets Java internals instead of a message it can show the user) and, in a real deployment, a security concern (stack traces can leak internal file paths and structure).

## How it works

`@RestControllerAdvice` tells Spring to watch every controller in the app and intercept specific exception types before they turn into a raw error response. Three handlers:

- `MethodArgumentNotValidException` → fires when `@Valid` catches a rule violation (missing `@NotNull`/`@NotBlank` field). Returns exactly which field(s) failed and why, as a `fieldErrors` map — not just a generic "bad request."
- `MaxUploadSizeExceededException` → fires when an uploaded statement exceeds the 10MB cap set in `application.properties`. Returns a clear message instead of a low-level servlet error.
- `Exception` (catch-all) → anything else still becomes a clean 500 response instead of a stack trace reaching the frontend. In a real deployment this is also where server-side logging of the full exception would go, so it stays debuggable without being exposed to the client.

Example response shape now, for a validation failure:
```json
{
  "timestamp": "2026-10-01T20:45:00Z",
  "message": "Validation failed",
  "fieldErrors": { "amount": "must not be null" }
}
```
