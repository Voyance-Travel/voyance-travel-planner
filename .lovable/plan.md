

# Fix: "Just Tell Us" Flow Resolving Dates to 2025

## Problem
When users type dates like "March 15-28" without a year, the AI parser sometimes outputs 2025 dates. The month-reference fixer only catches "in March" / "next April" patterns, missing bare date formats. The past-date safety net exists but may not trigger reliably.

## Root Causes
1. The system prompt tells the AI today's date but doesn't strongly enough forbid past years
2. The month-reference regex (line 490) only matches `in|next|this coming` + month -- it misses "March 15", "March 15-28", "Mar 15 to Mar 28"
3. The past-date safety net (line 528) compares against `new Date()` server time, which should work, but the AI is still outputting 2025 before the net runs

## Changes

### 1. Strengthen the AI system prompt (parse-trip-input edge function)

In the `SYSTEM_PROMPT` (line 91-94), add an explicit rule:

```
## CRITICAL DATE RULES
- The current year is [YEAR]. NEVER output dates in [YEAR-1] or earlier.
- When a user provides only month and day (e.g., "March 15"), assume the current year.
  If that date has already passed this year, use next year.
- ALL dates in the output MUST be in the future. Zero exceptions.
```

### 2. Expand the month-reference date fixer

Currently (line 490) the regex only matches:
```
/\b(?:in|next|this coming)\s+(january|february|...)\b/i
```

Add a second pass that catches bare month + day patterns like:
- "March 15"
- "March 15-28"  
- "Mar 15 to Mar 28"
- "March 15 - March 28"

For these, if the AI output a past-year date, override the year to the next upcoming occurrence of that month.

### 3. Harden the past-date safety net

The existing safety net (line 528-562) already bumps past dates forward. Reinforce it by:
- Adding a log when dates are bumped so we can trace this in production
- Ensuring the comparison is done correctly with local date construction (not UTC)
- Adding a secondary check: if the year is less than the current year, always bump -- don't even compare month/day

### File Modified
- `supabase/functions/parse-trip-input/index.ts`
  - Strengthen system prompt with explicit year/future-only rules
  - Add regex pass for bare "Month Day" patterns (e.g., "March 15") to resolve year correctly
  - Harden past-date safety net with explicit year < currentYear check

### No Changes To
- Frontend components
- Other edge functions
- Database schema

