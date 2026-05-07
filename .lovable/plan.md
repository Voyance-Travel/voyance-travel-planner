# Fix: 7-hour afternoon dead-gap between lunch and dinner on Day 2

## Root cause

The Day 2 plan was lunch 12:20 (Rialto Market) → dinner 19:20, with no afternoon activity. Three layers should have caught this and didn't:

1. **Generator prompt** (`compile-prompt.ts:1779`) tells the AI "no dead gaps over 90 minutes" — soft guidance, the AI ignored it.
2. **Stage-2 validator** (`generation-core.ts:2034`) only triggers a *retry* when `gap > 180`. Retries are bounded; if the AI produces the same shape twice, the bad day persists.
3. **Repair-day §13c GAP CLOSURE** (`repair-day.ts:2904`) only *shifts* later activities earlier — it does not insert new content. With dinner anchored at 19:20 (or it being shifted alone) the user still sees an empty afternoon.

There is on-demand `fill_dead_gap` mode in `refresh-day` and a UI nudge in `TransitGapIndicator`/`useFillDeadGap`, but nothing fills the gap automatically at generation time.

## Changes

### 1. New repair pass: `injectAfternoonGapFiller` in `repair-day.ts`
Add a section right before `// --- 13c. GAP CLOSURE ---` (after wellness/meal repairs, before time shifts) that:

- Walks pairs of consecutive non-transport, non-logistics, non-locked activities.
- When a gap ≥ 180 min overlaps the 12:00–19:00 active afternoon window AND no manually-locked next activity prevents insertion, request a fill candidate.
- Pull the candidate from the **same shared sources already used by `refresh-day`'s `fill_dead_gap` helper** (cost-reference + venue bank + Voyance picks for the destination). Reuse the existing helper to avoid divergence — extract `proposeAfternoonFiller(city, traveler, gap, prevAct, nextAct)` into a shared module if it currently lives only inside `refresh-day/index.ts`.
- Insert as a 60–120-min activity placed after `prevAct.endTime + 15min` buffer; cap end at `nextAct.startTime - 30min` (transit buffer).
- Tag `source: 'gap-filler-auto'`, `metadata.unverified_venue` only if the picked venue lacks a placeId.
- Push a repair entry `{ code: MISSING_SLOT, action: 'injected_afternoon_filler' }`.

If no real candidate is found, fall back to a curated free-time block with a real neighborhood (e.g. "Wander Cannaregio's quiet calli") rather than a generic stub. Generic-name guard already in place will reject any "Afternoon Free Time" placeholder.

### 2. Tighten Stage-2 validator
In `generation-core.ts:2014–2044`, lower the gap threshold to **150 min** for non-arrival/non-departure days and add an explicit error string ("ADD a real afternoon activity — extending lunch or starting dinner earlier is NOT acceptable") so the retry message pushes the AI toward content rather than time-shifting.

### 3. Reuse the fill_dead_gap helper across edge functions
Extract `supabase/functions/refresh-day/index.ts:206+` `proposeFillerActivity` (or equivalent) into `supabase/functions/_shared/fill-gap.ts`. Both `refresh-day` and `repair-day` call it. Single source of truth — keeps the on-demand fill button and the auto-fill consistent.

### 4. Tests
- `repair-day.test.ts` (or equivalent fixture test): given Day 2 with lunch 12:20–13:20 and dinner 19:20–21:00 in Venice, expect repair to inject a `sightseeing` or `culture` activity in the 14:00–18:00 window referencing a real Venice venue.
- Sanity: arrival/departure days with intentional logistics gaps are NOT filled.
- Sanity: gaps that are already < 180 min, or that fall outside 12:00–19:00, are not filled.

## Verification

1. Deploy `generate-itinerary` and `refresh-day`.
2. Re-generate the Venice trip. Check Day 2 afternoon: a real Venice activity (e.g. Scuola Grande di San Rocco, Peggy Guggenheim Collection, gondola/sandalo paddle, Dorsoduro wander) should appear between Rialto and dinner.
3. Confirm no behavior regression on departure days (last-day logistics gaps are still allowed).

## Out of scope

- AI-prompt rewording. Soft prompt rules already exist; this fix is deterministic.
- Manual-mode trips (universal locking still applies — no auto-fill on manually built itineraries).
