

## Fix: Single-Day Generation Doesn't Auto-Fix Hours Conflicts (Only Tags Warnings)

### Problem
When a venue hours conflict is detected (e.g., "Nightcap at Caffè Florian" at 9 PM but venue closes at 8:30 PM), the full-generation path (Stage 4.5) has auto-fix logic that shifts the activity into the venue's open window or removes it. But the **single-day generation path** (line 9630-9665) only removes confirmed-closed-all-day activities and tags time conflicts as `closedRisk` warnings — it never attempts to shift the activity into the venue's open window.

The yellow warning banner is the result: the system knows the conflict but doesn't fix it.

### Root Cause
Two code paths, one fix:
- **Full generation** (Stage 4.5, line 6770-6900): Parses opening hours, calculates venue open/close in minutes, shifts activity start/end to fit, or removes if duration doesn't fit.
- **Single-day generation** (line 9630-9665): Only checks `isVenueOpenOnDay()` → if not open all day, removes; if time conflict only, sets `closedRisk = true` and moves on. **No time-shift logic.**

### Fix (1 file, ~30 lines)

**File: `supabase/functions/generate-itinerary/index.ts` (~line 9652)**

In the single-day generation's "time conflict only" branch, replicate the same time-shift logic from Stage 4.5:

1. Parse the day's opening hours entry to get `venueOpenMins` and `venueCloseMins`
2. Calculate the activity's current start in minutes and its duration
3. If scheduled after close (or overlapping close): shift to `venueCloseMins - duration - 15`
4. If scheduled before open: shift to `venueOpenMins + 10`
5. If the activity duration doesn't fit in the open window at all: remove the activity instead of leaving a warning
6. Only fall through to `closedRisk` tagging if parsing fails (no parseable hours data)

This ensures both generation paths apply identical enforcement. The warning banner becomes a last resort for truly ambiguous cases (e.g., hours data couldn't be parsed), not for clear conflicts with known hours.

### Technical Detail
The parsing logic already exists in Stage 4.5 (lines 6798-6882). Extract the relevant time-parsing and shifting into a shared helper to avoid duplicating ~40 lines. Both Stage 4.5 and the single-day path call the same helper.

### Files
- `supabase/functions/generate-itinerary/index.ts` — add time-shift fix to single-day hours validation; extract shared helper from Stage 4.5

