# Untimed Departure-Day Lunch Card

## Symptom

Recurring across Faro, Bruges, Milan, Mallorca, Hong Kong, Mexico City, San Juan: on the departure day, a lunch card (e.g. "La Casita Blanca") renders with **no timestamp**, sorted to the bottom of the day — **after** the airport-transfer card. Persists across refresh, so it's also persisting in `trips.itinerary_data`.

## Root cause

Two structural holes that compound:

### 1. `time` field bypasses canonicalization

`fillMissingStartTimes` (`supabase/functions/_shared/timing-cascade.ts` line 122) treats a card as "already timed" when **any** of `startTime | start_time | time` is set, but it never copies `a.time` into `a.startTime`. Result: a card emitted by the LLM with only `time: "13:30"` slips through unchanged. Every downstream pass that reads `a.startTime` (and there are many) sees no time.

### 2. `§15z` departure cleanup ignores `time` / `start_time`

`enforceDepartureDayLogistics` (`supabase/functions/generate-itinerary/pipeline/repair-day.ts`):

- Line 4065: `const s = parseTimeToMinutes(a.startTime || '') ?? -1;` — falls back to `-1` for any card missing `startTime`.
- Line 4066: `if (s >= 0 && s >= cutoffMin)` — the cutoff drop is **skipped** when `s === -1`. The lunch card survives.
- Line 4078 dining-near-transfer prune similarly requires both `s` and `e` ≥ 0.

The final sort at line 4093 then uses `?? 99999`, pushing the untimed lunch to the **bottom** of the day, behind the timed `Transfer to Airport` card. Exact symptom match.

`assignFloatingMealTimes` (the obvious save-time safety net) does run in `normalizeDays`, but it also early-exits at line 198 when `a.time` is set. So a card with `time` only never gets `startTime` assigned by either normalizer.

## Fix (single backend change set)

### A. `_shared/timing-cascade.ts` — promote `time` → `startTime`

In `fillMissingStartTimes` (lines 116-145):
- Add a leading promotion step. If `a.startTime` is empty AND (`a.start_time` OR `a.time`) is set, copy that value into `a.startTime` (and mirror into `a.start_time`/`a.time`). Do the same for `endTime` ↔ `end_time`. Telemetry: `[NORMALIZE_START_PROMOTE] day=N from=time|start_time`.
- Then run the existing end−duration computation for cards that genuinely have no start.

In `assignFloatingMealTimes` (lines 192-198), the same promotion step before the "skip if already timed" check, so a timed-only-via-`time` card never reaches the floating-assignment branch with the wrong shape.

This closes the structural source for **every** downstream consumer that reads `a.startTime`, not just §15z.

### B. `pipeline/repair-day.ts` §15z — read all three time fields, then drop untimed dining

In `enforceDepartureDayLogistics`:
- Replace `parseTimeToMinutes(a.startTime || '')` at lines 4065 and 4077 with a small `pickStart(a)` / `pickEnd(a)` helper that reads `a.startTime || a.start_time || a.time` (and `endTime || end_time`). Keeps the existing prune semantics intact for any LLM card that emitted `time` only.
- Add a new explicit branch before the cutoff check: if a non-locked, non-checkout, non-logistics row is `isDiningRow(a)` AND has **no parsable time at all**, drop it with `action: 'final_enforce_dropped_untimed_dining'` and a `[DEPARTURE_UNTIMED_DINING_PRUNED]` log line. (Locked / userAdded / extracted / pinned / `preserveAsManualPick` rows stay — same exemption set the existing prune respects.)

### C. `action-save-itinerary.ts` — order guarantee

`normalizeDays` already calls `fillMissingStartTimes` then `assignFloatingMealTimes`. With change (A), both will see the promoted `startTime`. No code reordering needed; verify by adding the promotion sentinel to the existing log line so we can confirm in production that the promotion fires on the next save of an affected trip.

### D. Targeted self-heal sweep

For trips already persisted with this bug, the next save (any source — chat action, manual edit, refresh-day) will run change (A) and write back the canonical `startTime`. No migration needed; the bug self-heals on first re-write because §15z and the sort then operate on a real time. Document this in the closing note instead of running a one-shot.

## Out of scope

- LLM prompt changes. We treat the `time`-only payload as legitimate input and canonicalize it.
- The `last-day lunch assertion` block (`action-generate-trip-day.ts` lines 2008-2043) — `proposeGapFiller` already returns timed cards; not the leak path.
- Frontend rendering — the UI is correctly sorting by time; an untimed card legitimately falls to the bottom. Fixing data fixes the display.

## Verification

1. **Unit test:** extend `supabase/functions/generate-itinerary/__tests__/normalize-start-time.test.ts` with two cases: (i) `{ time: '13:30' }` only → `fillMissingStartTimes` assigns `startTime: '13:30'`; (ii) lunch dining row with no time fields on a departure day with a 14:30 transfer → `enforceDepartureDayLogistics` drops it with `action: 'final_enforce_dropped_untimed_dining'`.
2. **Sentinel grep:** after deploy, `[NORMALIZE_START_PROMOTE]` should fire on saves of legacy trips, and `[DEPARTURE_UNTIMED_DINING_PRUNED]` should appear when a fresh generation produces an untimed last-day lunch.
3. **Trip re-save:** open the reported San Juan trip, trigger any save (chat or manual). The La Casita Blanca card should either anchor to ~13:00 (if it has lunch slot room before transfer) or be dropped (if it doesn't). Refresh confirms persistence.

## Memory note (post-merge)

Add a memory entry under `mem://constraints/itinerary/canonical-time-field-promotion`:
- `time` and `start_time` are aliases of `startTime`. The promotion in `fillMissingStartTimes` is the single source of truth — never read `time` directly in cleanup code; always read `startTime` after normalization.
- `enforceDepartureDayLogistics` drops dining rows with no parsable time on departure days. Sentinel `[DEPARTURE_UNTIMED_DINING_PRUNED]`.
