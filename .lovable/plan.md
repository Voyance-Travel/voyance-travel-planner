

## Fix: Date Parsing Strips Day-of-Month ("June 10–15" → "June 1–5")

### Root Cause

The AI model extracts dates via the `extract_trip_data` tool call, but the `dates.start` and `dates.end` fields are unformatted strings with no enforcement. When users write "June 10–15", the AI sometimes returns `"2026-06-01"` instead of `"2026-06-10"` — it sees "June 1" in "June 10" and truncates.

The extensive post-processing in lines 488–636 of `parse-trip-input/index.ts` only fixes **year** issues (past dates, bare months). There is zero validation that the **day-of-month** in the AI output matches the actual numbers in the user's text.

### Fix

Add a post-processing step in `parse-trip-input/index.ts` (after the existing date fixes, ~line 636) that:

1. **Extracts explicit day numbers from the user's raw text** using regex — patterns like "June 10", "June 10–15", "June 10-15", "June 10 to 15", "10th–15th June", "10-15 June"
2. **Compares them against the AI's parsed `dates.start` / `dates.end`** day-of-month values
3. **If they don't match, overwrites the AI's day values** with the ones from the raw text

This is the same defense-in-depth pattern already used for year correction — trust the raw text over the AI when there's a discrepancy.

### Detailed logic

```
// Regex to find "Month DD" or "DD Month" patterns with optional ranges
// e.g. "June 10–15", "June 10 to June 15", "10-15 June", "June 10th - 15th"
```

- Extract `startDay` and `endDay` from the user's text
- Extract `startMonth` to verify we're comparing the right month
- If `parsed.dates.start` exists and its day-of-month ≠ `startDay`, fix it
- If `parsed.dates.end` exists and its day-of-month ≠ `endDay`, fix it
- Also fix individual `day.date` values by recalculating from the corrected start date

Also strengthen the AI prompt (line 97-103 in `SYSTEM_PROMPT`) to add an explicit rule:

```
- When extracting "June 10–15", the start date is June 10, NOT June 1. 
  Read the FULL number after the month name. "10" is not "1".
```

### Files to change

| File | Change |
|------|--------|
| `supabase/functions/parse-trip-input/index.ts` | Add day-of-month validation post-processing (~line 636); add explicit prompt rule about multi-digit days (~line 97) |

### Expected outcome

"June 10–15" correctly produces `start: 2026-06-10`, `end: 2026-06-15`. The regex-based validation catches any AI truncation of day numbers before the data reaches the frontend.

