

## Fix: Import Time Parsing — "11:00 AM" Parsed as "1:00 AM"

### Root cause

This is the **same class of AI truncation bug** that was already fixed for dates (the "June 10 → June 1" fix at `parse-trip-input/index.ts` lines 639-706). The AI model in `parse-trip-input` sometimes truncates multi-digit hour values: "11:00 AM" → "1:00 AM" (dropping the leading "1" from "11"). The backend has no post-AI time validation step to catch this.

Evidence:
- The `normalizeTimeTo24h()` function itself is correct — "11:00 AM" → "11:00" works fine
- The `ImportActivitiesModal` client-side parser regex also handles "11:00 AM" correctly
- The AI's extracted `time` field is the only plausible source of "1:00 AM"
- The codebase already has a date-truncation fix ("June 10 → June 1") confirming this AI behavior pattern
- No time-validation step exists in `parse-trip-input` (unlike dates which have 3 correction passes)

### Fix

**File: `supabase/functions/parse-trip-input/index.ts`** — Add a time-validation pass after the AI extraction (after line 486, before the date fixing section)

1. **Extract explicit times from raw text** — scan the user's pasted text for time patterns like "11:00 AM", "2:30 PM", "14:00"
2. **Cross-reference with AI-extracted times** — for each activity with a `time` field, check if a corresponding time exists in the raw text near the activity name
3. **Fix truncated hours** — if the raw text says "11:00 AM" near "Harajuku" but the AI returned "1:00 AM", override with "11:00 AM"

The matching logic:
- For each activity, find its name (or keywords from its name) in the raw text
- Look for a time pattern within ~100 characters of that name match
- If the raw-text time's minutes match but the hour differs, and the raw hour is a multi-digit number where the AI's hour is a suffix (e.g., raw=11, AI=1), replace with the raw time

**File: `src/utils/createTripFromParsed.ts`** — No changes needed (the `normalizeTimeTo24h` call is correct; the bug is upstream)

### Scope
Single backend file: `supabase/functions/parse-trip-input/index.ts`. ~40 lines of post-processing validation added after the sanitization pass. Follows the exact same pattern as the existing day-of-month validation.

