## Recurring bug: selected attractions silently missing

Mexico City `e4217b97`: user selected 4 must-dos. Metadata says Teotihuacan + Zócalo were injected on Day 1 (10:00–11:30 / 11:30–13:00), and the coverage check reports all 4 scheduled. But the persisted `itinerary_data.days[0].activities` contains **neither** card — Day 1 has the arrival flight (08:00–10:00), hotel return (11:30–11:55), and luggage drop (12:15–12:35) right on top of where the injector placed them. The cards got collapsed by `sanitizeSchedule` / cascade between persist and the coverage re-fetch, then never recovered.

Rome `d18b2e8a` had the same class of failure and was patched by a one-shot SQL backfill (`source: 'sql-backfill-d18b2e8a'` in `must_do_repair_attempted`) — confirming the live injector misses this case.

## Root cause

`action-generate-trip-day.ts` lines 1000–1008:

```text
const _arrTime24Raw = _isFirstDay
  ? (_flightSel.arrivalTime24 || _flightSel.outbound?.arrivalTime || …)
  : undefined;                              ←  ONLY populated on day 1
const savedArrTime24Hoisted = …;
```

The must-do injection (line 3568) and the sibling `sanitizeSchedule` (3625) + persist-validation (3638) all run at chain-finalization **on the last day**. When `dayNumber !== 1` the hoisted arrival clock is `undefined`, so:

1. `buildEligibleDays` does NOT push Day 1's `earliestStart` past `arrival + 120m`, so Teotihuacan/Zócalo get slotted *inside* the arrival window.
2. The long-haul Day 1 rejection rule (`hasArrivalClock` gate, schedule-must-dos.ts L247) doesn't engage, so Teotihuacan is allowed on Day 1 — and worse, with no `longHaul=360m` block guard.
3. `sanitizeSchedule` runs without arrival context too, so collisions with the arrival flight collapse the injected cards.
4. The post-persist coverage check happens to re-fetch the DB at a moment the cards are still there, stamps `scheduled: [...all 4]`, and the next deterministic pass (cascade / sync-tables) drops them — leaving the metadata lying about coverage.

Same shape on Rome (Pantheon/Trevi/Vatican landing inside Day-1 arrival or Day-N departure).

## Fix

### 1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

- Compute `savedArrTime24Hoisted` and `savedDepTime24Hoisted` **unconditionally** on every chain leg (drop the `_isFirstDay` / `_isLastDay` gate at L1000 and L1034). The downstream callers already gate on `_isFirstDay`/`_isLastDay` themselves where the time only applies to one end; the must-do injector + sanitizeSchedule + persist-validation need both regardless of which day's prompt this iteration is building.
- Add a one-line fallback when both `_flightSel.arrivalTime24` and `legs[0].arrival.time` are empty: scan `partialItinerary.days[0].activities` for the existing `id='day1-arrival-flight-*'` / `category='arrival-flight'` card and use its `endTime` as the arrival clock. Same idea for departure on the last day. Belt-and-suspenders for chat-planner trips that never seeded `legs`.

### 2. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (must-do post-persist verification)

After the `assertMustDoCoverage` retry block (line 3903), add a **survival check**: for every venue whose `matchedActivityIds[venue]` starts with `must-do-`, confirm that id actually appears in the re-fetched DB days. If not, treat it as missing (it got dropped between inject and freeze) and:

- log `[MUST_DO_DROPPED_POST_COVERAGE] trip=… venue=…`
- push `MUST_DO_INJECTION_FAILED` to `persistGateCodes`
- include in `metadata.must_do_coverage.missing` so the health panel surfaces it instead of silently lying.

### 3. `supabase/functions/_shared/schedule-must-dos.ts`

- `defaultDuration` already returns 360 for `teotihuacan`, but only when `longHaulMinBlock` matches. Extend `AFTER_DARK_OK` ceiling logic so long-haul cards never use `venueCeiling=21*60`; clamp `winEnd` to `Math.min(d.latestEnd, 17*60)` for long-haul venues (they need daylight + the full block).
- Tighten `firstFreeSlot` for long-haul: when the venue is long-haul AND any non-locked busy window overlaps the candidate slot, treat that window as locked too (don't optimistically assume the cascade can move a 6-hour block out of the way).

### 4. Test

Add `supabase/functions/_shared/__tests__/schedule-and-inject-must-dos.test.ts` cases:

- Mexico City: 4 days, arrival 10:00 Day 1, departure 13:00 Day 4, must-dos `['Teotihuacan Pyramids','Zócalo','Palacio de Bellas Artes','Frida Kahlo Museum']`. Assert Teotihuacan lands on Day 2 or 3, not Day 1; Zócalo lands ≥ 12:00 on Day 1 (after arrival buffer) or any later day.
- Coverage post-persist: feed `assertMustDoCoverage` a `days` array that simulates the post-cascade drop (must-do card id absent), confirm the new survival check flips it back to `missing`.

## Out of scope

- The day-title coherence regression on Rome.
- Bangkok 1/4-days stall (separate root cause).
- The cosmetic "system flags it not silent" Day-1 arrival mismatch warning.

## Files touched

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (hoist times unconditionally + add post-coverage survival check)
- `supabase/functions/_shared/schedule-must-dos.ts` (long-haul slot tightening)
- `supabase/functions/_shared/__tests__/schedule-and-inject-must-dos.test.ts` (new cases)
- `mem://constraints/itinerary/must-do-coverage-injection` (note Day-1 arrival-clock dependency + survival check)
