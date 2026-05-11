## Bug
Day 3 Bistro Refter card renders as bare "→ 1:30 PM" with no start time. Confirmed by code read.

## Root Cause

**Frontend (`src/components/itinerary/EditorialItinerary.tsx`):** The activity card desktop time column renders the start and end time independently:

```tsx
// line 11223
const time = activity.startTime || activity.time;
…
// line 11714–11720 — desktop time column
<span>{formatTime(time)}</span>                  // empty string when start missing
{activity.endTime && (
  <p>→ {formatTime(activity.endTime)}</p>        // still renders when start missing
)}
```

`formatTime(undefined)` returns `""`, so the start line collapses to blank but the end line still draws "→ 1:30 PM". The clean-preview branch (line 11380) already short-circuits correctly (`if (start && end) … if (start) … return null`); only the editable/desktop column is broken.

**Data layer (`supabase/functions/generate-itinerary/action-save-itinerary.ts::normalizeDays`):** No normalization gate ensures `startTime` is present when `endTime` is. AI/repair paths can persist `{ startTime: null/undefined, endTime: "13:30", durationMinutes: 60 }` and that lands in `trips.itinerary_data` unchanged.

## Fix Strategy

### (a) Frontend rendering guard — `src/components/itinerary/EditorialItinerary.tsx`

Update the desktop time column (~lines 11713–11732) so the end-time line is only rendered when start exists. Behavior:

- If `time && endTime` → render `formatTime(time)` and below it `→ formatTime(endTime)` (current correct behavior).
- If `time && !endTime` → render only start time + duration (already current behavior).
- If `!time && endTime` → render duration only (suppress the orphan "→ end" line). Also suppress the click-to-edit affordance because the card has no anchor time to edit from.
- If neither → render placeholder dash `—` (today renders an empty span which collapses layout).

Implementation: wrap the existing block in `time ? (…current jsx…) : (<DurationOnly />)`. No business-logic change.

### (b) Save-time normalization — `supabase/functions/generate-itinerary/action-save-itinerary.ts`

Inside `normalizeDays` (line 124), add a per-activity normalization pass BEFORE the sort (line 132) and BEFORE `scrubActivity`/dedup runs. For each activity:

```
const start = a.startTime || a.start_time || a.time;
const end   = a.endTime   || a.end_time;
const dur   = Number(a.durationMinutes || a.duration_minutes) || null;

if (!start && end && dur && dur > 0) {
  const endMin = parseTimeToMinutes(end);
  if (endMin !== null) {
    const startMin = Math.max(0, endMin - dur);
    const computed = minutesToHHMM(startMin);
    a.startTime = computed;
    a.start_time = computed;
    a.time = computed;
    console.log(`[NORMALIZE_START] day=${dayNumber} title="${a.title || a.name || ''}" computed=${computed} from end=${end} dur=${dur}`);
  }
}
```

Locked / userAdded / userEdited / extracted / pinned / isManual cards are exempt (mirror the standard guards) — never recompute a user-anchored time. Only fills when `startTime` is genuinely missing; never overwrites an existing value.

If `!start && end && !dur` (no duration to subtract) we cannot safely compute — leave as-is and let the frontend's (a) guard render duration-less fallback. Log once with sentinel `[NORMALIZE_START_SKIPPED] reason=no_duration`.

### (c) Mirror normalization in `pipeline/repair-day.ts` final timing pass

`enforceTimingAndBuffers` already runs at repair-day §16 + save-itinerary STEP 2.9 (per `mem://technical/itinerary/pre-save-timing-cascade`). Add the same `start = end − dur` fill inside the helper's pre-walk so repair-time doesn't emit `null`-start rows in the first place. Both layers (b) and (c) are needed: (c) catches AI output; (b) catches optimistic patches / chat-executor writes / legacy data.

## Verification

**Static:**
- `rg "NORMALIZE_START\b" supabase/functions/generate-itinerary/action-save-itinerary.ts` → ≥1 hit
- `rg "NORMALIZE_START\b" supabase/functions/_shared/` → ≥1 hit (helper path)
- `rg "→ \{formatTime\(activity.endTime\)\}" src/components/itinerary/EditorialItinerary.tsx` → 0 hits (the unguarded orphan is gone)

**Unit test (new `supabase/functions/generate-itinerary/__tests__/normalize-start-time.test.ts`):**
- Day with `{ startTime: null, endTime: "13:30", durationMinutes: 60 }` → `normalizeDays` yields `startTime === "12:30"`.
- Same shape with `isLocked: true` → start remains `null` (locks exempt).
- `{ startTime: null, endTime: "13:30", durationMinutes: 0 }` → start remains `null`; sentinel `NORMALIZE_START_SKIPPED` logged.

**Visual check:**
- Load Bruges trip Day 3 in preview → Bistro Refter card no longer shows orphan "→ 1:30 PM". Either it now shows correct `12:30 → 1:30 PM` (post-save normalization) or shows duration-only fallback (pre-save legacy data).

**No existing tests touched** beyond the new file.

## Memory

New entry `mem://constraints/itinerary/start-time-normalization`:

> Activity cards MUST never persist with `endTime` set and `startTime` null. `normalizeDays` (action-save-itinerary) + `enforceTimingAndBuffers` (pre-save cascade) compute `startTime = endTime − durationMinutes` when start is missing and duration is positive. Locked/user/manual/extracted/pinned rows exempt. Frontend `EditorialItinerary.tsx` desktop time column also guards: when start is missing, render duration-only and suppress orphan "→ end" line. Sentinels: `[NORMALIZE_START]` (filled), `[NORMALIZE_START_SKIPPED] reason=no_duration` (couldn't fill). Closes Bruges "Bistro Refter shows only → 1:30 PM".

Add a Core line referencing it and add to the index Memories list.

## Files Changed

- `src/components/itinerary/EditorialItinerary.tsx` — desktop time column guard (~line 11714)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — `normalizeDays` start-fill loop
- `supabase/functions/_shared/<timing-cascade file>` — same fill inside `enforceTimingAndBuffers`
- `supabase/functions/generate-itinerary/__tests__/normalize-start-time.test.ts` — new
- `mem://constraints/itinerary/start-time-normalization` — new

No DB, RLS, or prompt changes.