# Build Log 11 — Hardening Redaction for Formatted Numbers

**Date:** Oct 1, 2026
**What exists after this entry:** `RedactionUtil` now catches account/card-number-looking text even when a bank prints it broken up with dashes or spaces, not just as one unbroken digit run.

## The gap

The original redaction pattern (`\d{8,}`) only caught digits written as one continuous run, like `48217536901`. A real bank statement is just as likely to print a number broken into groups — `4821-7536-9012` or `4821 7536 9012` — and the old pattern would have let those straight through untouched, since a dash or space in the middle breaks up what looks like a single "digit run" to a simple regex.

## The fix

```java
private static final Pattern LONG_DIGIT_RUN = Pattern.compile("\\b\\d(?:[ -]?\\d){7,}\\b");
```

This still requires 8+ actual digits total (same deliberately low floor as before — better to over-redact than under-redact), but now allows a single space or dash between any two digits without breaking the match. `\b` (a "word boundary") on both ends keeps it from bleeding into a longer alphanumeric token it shouldn't touch.

Four new tests in `RedactionUtilTest` cover this directly: dash-separated groups, space-separated groups, confirming a *short* dash-separated reference (under 8 total digits, like `12-34-56`) is still correctly left alone, and the existing threshold/multiple-numbers/null-safety tests all still pass unchanged — this was a widening of what counts as "digits," not a change to the 8-digit floor itself.

## Why this came up

Explaining the redaction pipeline to a direct question about "how does this actually protect a real account number" surfaced the gap — formatted numbers are how real statements actually look, and the original pattern was only ever tested against unbroken digit runs. Worth remembering as a general lesson: a security-critical regex needs to be tested against the *messy, real-world* version of what it's supposed to catch, not just the cleanest version of it.
