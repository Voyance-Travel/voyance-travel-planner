

## Fix 11: Day Extraction, Backfill Hardening, and NaN Time Cleanup

I've verified every line number and code block against the actual files. The plan from the user's description is accurate and ready to implement.

### Root Cause (confirmed via code inspection)

The must-do parser at `must-do-priorities.ts:283-288` splits comma-separated items but **never reads inline "Day N"** markers. Items like `"US Open 9am-5pm Day 2"` get `preferredDay: undefined`, and the scheduler assigns them to lowest-load days — skipping Day 2.

The backfill at `index.ts:8482-8486` then fails to catch this because transit activities ("Subway to US Open") match the fuzzy title check, so `eventExists` returns `true` even though the actual event card is missing.

### Changes (5 areas, 3 files)

**File 1: `supabase/functions/generate-itinerary/must-do-priorities.ts`**

1. **Lines 283-288** — Add inline "Day N" extraction when splitting sub-items. Parse `/\bday\s+(\d+)\b/i` from each item's text and set `preferredDay` accordingly.

2. **Lines 389-398** — Add 4 new `.replace()` calls to strip "Day N", time ranges ("9am-5pm"), "from noon", and "all day" from activity titles. This normalizes all entries to "US Open" so recurring event matching works across days.

3. **Lines 542-565** — Change `findBestDay` to hard-assign when `preferredDay` is set. For all-day events, also allow assignment if the same event is already on that day (multi-day scenario). For non-all-day events with explicit day, always assign without capacity check.

**File 2: `supabase/functions/generate-itinerary/index.ts`**

4. **Lines 8482-8486** — Replace the backfill `eventExists` check to exclude transport/transit activities. Add category and title-pattern filters so "Subway to US Open" doesn't count as the event.

5. **After line 8529** (end of backfill block) — Add `normalizedActivities = generatedDay.activities;` to sync injected cards into the persistence layer.

6. **Line 6731** — Replace the single log line with detailed per-item logging showing assigned day, preferred day, and a full schedule dump when no items are found for the current day.

**File 3: `supabase/functions/generate-itinerary/budget-constraints.ts`**

7. **Lines 403-406** — Add NaN sanitization for `blocked_time` rules. If `from` or `to` contains "NaN", skip the rule with a warning instead of injecting corrupted text into the prompt.

**File 4: `src/pages/Start.tsx`**

8. **Line 2855** — Replace `const duration = (c as any).duration || 120` with type-safe coercion that handles string/NaN/negative values, falling back to 120.

### Summary

| Change | File | Lines | Purpose |
|--------|------|-------|---------|
| Inline Day N extraction | must-do-priorities.ts | 283-288 | PRIMARY: parser reads "Day 2" from text |
| Strip day/time from titles | must-do-priorities.ts | 389-398 | Stable recurring event matching |
| Hard-assign explicit days | must-do-priorities.ts | 542-565 | No silent reassignment |
| Exclude transport from backfill | index.ts | 8482-8486 | Backfill fires when only transit exists |
| Sync after backfill | index.ts | after 8529 | Injected card persists to DB |
| Better day-assignment logs | index.ts | 6731 | Debug visibility |
| Skip NaN blocked_time | budget-constraints.ts | 403-406 | Clean prompts |
| Coerce duration | Start.tsx | 2855 | Prevent future NaN |

