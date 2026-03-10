

## Fix 10: Day 2+ All-Day Event Card — 5-Layer Comprehensive Fix

### Problem
When a user requests the same event (e.g., US Open) across multiple trip days, the event card is missing on intermediate days (Day 2). The AI generates transit but skips the event activity itself.

### Root Causes
1. **Cross-day dedup** (line ~7969 in `index.ts`) tells AI to "avoid repeating" all previous-day activities — including intentionally recurring events
2. **Blocked time wording** (line ~6718 in `index.ts`) says "Do NOT schedule ANY activities" — AI interprets this as including the event itself
3. **NaN:NaN times** (`Start.tsx` line ~2800) — `addMinsToTime` can't parse "9:00 AM" format, producing broken constraints

### Changes

#### Layer 1: Cross-day dedup — exempt recurring events
**File:** `supabase/functions/generate-itinerary/index.ts` (~line 7969)

Replace the single-line dedup injection with logic that splits `previousDayActivities` into recurring vs. non-recurring using the already-imported `isRecurringEvent()`. Recurring events get a "YOU MUST CREATE" instruction instead of "avoid repeating."

#### Layer 2: Blocked time wording — require event card creation
**File:** `supabase/functions/generate-itinerary/index.ts` (~lines 6716-6720)

Update `blockedTimeLines` and `mustDoPrompt` to explicitly instruct: "YOU MUST CREATE AN ACTIVITY ENTRY for this event. Do NOT schedule any OTHER activities in this window." Replace passive "[ALL-DAY EVENT — plan the ENTIRE day around this]" with "[ALL-DAY EVENT — YOU MUST generate an activity card for this event]".

#### Layer 3: Deterministic event backfill safeguard
**File:** `supabase/functions/generate-itinerary/index.ts` (after overlap stripping block, ~line 8446)

New block: after overlap stripping, iterate `mustDoEventItems` and check if each event exists in `generatedDay.activities` (fuzzy title match). If missing, inject a synthetic activity with `crypto.randomUUID()` ID, correct times from `getBlockedTimeRange()`, inserted at the right chronological position. Belt-and-suspenders guarantee.

#### Layer 4: Parse explicit times from user text
**File:** `supabase/functions/generate-itinerary/must-do-priorities.ts`

- Add `extractExplicitTimeRange()` helper that parses "9am-5pm", "9:00 AM to 5:00 PM" patterns into `{startTime, endTime}` in HH:MM format
- Add `explicitStartTime`/`explicitEndTime` fields to `MustDoPriority` interface
- Call extractor in `parseItem()`, populate the new fields and compute accurate `estimatedDuration`
- Update `getBlockedTimeRange()` to prefer explicit times over inferred defaults

#### Layer 5: Fix NaN:NaN in Start.tsx
**File:** `src/pages/Start.tsx` (~lines 2800-2835)

- Add `normalizeTimeTo24h()` helper that converts "8:15 AM" / "9:00 PM" to 24h "HH:MM"
- Update `addMinsToTime` to normalize input first, with NaN fallback to 09:00
- Normalize `c.time` before using it in `blocked_time` rule `from`/`to` fields

### No new files or dependencies required
All changes use existing imports (`isRecurringEvent`, `parseTimeToMinutes`, `getBlockedTimeRange`, `crypto.randomUUID`).

