## Problem

Worst-case Istanbul: real flight arrives **15:00** (per `flight_selection.departure.arrival.time`), but Day 1 shows **Arrival Flight 03:05–05:05**, `isLocked:false`, and dinner stamped 19:00 on top of an empty afternoon.

## Root cause

`pipeline/repair-day.ts` §3b (lines 964–1052) only injects the arrival-flight + airport-transfer anchors when **no** arrival-flight card already exists:

```ts
const hasArrivalFlight = activities.some((a: any) => {
  const t = (a.title || '').toLowerCase();
  const cat = (a.category || '').toLowerCase();
  return (cat === 'flight' || cat === 'transport') && (
    t.includes('arrival flight') || t.includes('landing') ||
    (t.includes('arrive') && t.includes('flight'))
  );
});
if (!hasArrivalFlight) { /* inject locked anchors at authoritative time */ }
```

When the LLM hallucinates its own "Arrival Flight" card (any bogus time, unlocked), this check short-circuits — repair never overrides the time, never locks it, and never adds the transfer. Downstream cascades happily place real activities (dinner 19:00, must-do museum) without respect for the real landing clock. Affects Rome, Mexico City, Buenos Aires, Istanbul.

## Fix

Add a **reconciliation branch** in repair-day §3b that runs whenever `isFirstDay && arrivalTime24` is known, regardless of whether the LLM already emitted an arrival card. Single source of truth = `arrivalTime24` resolved upstream by `flight-hotel-context.ts` / `action-generate-trip-day.ts`.

### Reconciliation contract

When a matching arrival-flight card exists:
1. Overwrite `startTime = arrivalTime24 - 120m`, `endTime = arrivalTime24`, `durationMinutes = 120`.
2. Stamp `isLocked = true, locked = true, lock_state = 'locked', anchorSource = 'arrival-flight', source = 'repair-arrival-flight-reconciled'`.
3. Normalize `title`/`name` to `'Arrival Flight'`, set `category = 'flight'`, fill `location.name = arrivalAirport`.
4. Push the existing card to **index 0** of the day.
5. If no airport-transfer anchor exists, inject one immediately after (existing transfer block — extracted into a small helper for reuse).
6. Re-run the existing "nudge colliding non-locked, non-anchor activities to start ≥ `transferEnd + 15m`" sweep so dinner/check-in/must-do cards shift forward, not overlap.
7. Push a repair entry: `{ code: MISSING_SLOT, action: 'reconciled_arrival_flight', detail: { wasStart, wasEnd, newStart: arrivalTime24-120m, newEnd: arrivalTime24 } }`.
8. `console.log('[Repair] Reconciled LLM arrival flight: was=… now=… (authoritative)')`.

When no card exists, the current inject branch keeps running unchanged.

### Refactor

Extract a shared helper `applyArrivalFlightAnchor(activities, arrivalTime24, opts)` inside `repair-day.ts` that handles both "inject" and "reconcile" paths so the time math + lockdown + collision sweep live in one place.

### Telemetry

- Add `[Repair §3b]` sentinel logs distinguishing `injected` vs `reconciled` vs `no_arrival_clock`.
- `metadata.quality.arrival_flight_reconciled = { day, wasStart, newStart }` (bounded ring buffer of 3) so we can read-time audit how often LLM cards drift.

## Tests

Add `supabase/functions/_shared/__tests__/arrival-flight-reconcile.test.ts` covering:

1. **Istanbul fixture** — `arrivalTime24='15:00'`, LLM emits `Arrival Flight 03:05–05:05 isLocked:false` → after repair: 13:00–15:00, isLocked:true, anchorSource set; subsequent dinner at 19:00 preserved.
2. **Mexico City** — arrival 10:00, LLM emits flight 22:00–23:00 → reconciled to 08:00–10:00; transfer injected.
3. **Rome** — arrival 14:00, no LLM card → existing inject path still passes (regression).
4. **Buenos Aires** — arrival 06:30, LLM emits flight 10:00; existing dinner 19:00 not shifted (already after transferEnd+15m).
5. **Collision sweep** — LLM emits flight 03:05 + luggage drop 06:15; after reconciliation to 13:00–15:00 with 45m transfer, luggage drop moves to ≥ 16:00.
6. **No `arrivalTime24`** — neither branch runs, repair returns unchanged.

Extend `arrival-flight-anchor.test.ts` with one reconcile case for documentation parity.

## Files

- **Edit**: `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — refactor §3b into helper + add reconcile branch (~80 LOC delta).
- **Create**: `supabase/functions/_shared/__tests__/arrival-flight-reconcile.test.ts`.
- **Edit**: `mem://constraints/itinerary/...` — add new memory `arrival-flight-reconciliation` (single source of truth contract) and update Core index.

## What this does NOT touch

- `flight-hotel-context.ts` / `pickDestinationArrivalLeg` — Istanbul DB confirms upstream returns the correct `15:00`. No parser change.
- LLM prompt — fix is post-hoc reconciliation so the contract survives any future prompt drift.
- Last-day departure logic — separate (existing §15z handles departure-side cap).
