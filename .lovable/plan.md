# M11 — refresh-day repairDay normalization (upstream of validation gate)

## Context

Fix #3 wired `applyValidationGate` into `supabase/functions/refresh-day/index.ts` at lines 606–664. The gate assumes deterministic cleanup (orphan-transit pruning, venue-name normalization, pricing floors, bookend clamping, prompt-leak scrubbing) has already run — but in `refresh-day` it hasn't. This adds the upstream `repairDay` step, mirroring `action-generate-day.ts:1200-1238`.

## Change

In `supabase/functions/refresh-day/index.ts`, **inside the existing `try { … } catch (gateErr)` block at lines 611–664**, insert a `repairDay` call between the `dayMinimal` construction (line 625–630) and the `validateDay` call (line 632) so the gate validates the already-repaired set.

```ts
// ── REPAIR-DAY — runs BEFORE validate + gate, mirroring action-generate-day.ts:1200-1238.
//    Strips orphan transits, normalizes venue names, applies pricing floors,
//    clamps bookends — all the deterministic cleanup the gate expects upstream.
try {
  const { repairDay } = await import('../generate-itinerary/pipeline/repair-day.ts');
  const { day: repairedDay, repairs } = repairDay({
    day: dayMinimal as any,
    validationResults: [],
    dayNumber,
    isFirstDay,
    isLastDay,
    arrivalTime24: undefined,
    returnDepartureTime24: undefined,
    hotelName: body.hotelName,
    hotelAddress: '',
    hasHotel: !!body.hotelName,
    lockedActivities: [],
    isTransitionDay: false,
    isMultiCity: false,
    isLastDayInCity: false,
    resolvedDestination: destination,
  });
  if (repairs.length > 0) {
    console.log(`[refresh-day] repair-day applied ${repairs.length} fixes`);
    dayMinimal.activities = repairedDay.activities;
  }
} catch (repairErr) {
  console.warn('[refresh-day] repair-day failed (non-blocking):', repairErr);
}

// (existing validateDay + applyValidationGate calls follow, now operating on repaired dayMinimal)
```

## Adjustments vs. user spec

- **Writeback target:** spec says `refreshedDay.activities = repairedDay.activities`, but no `refreshedDay` exists in this file. Writing to `dayMinimal.activities` is what makes the change actually flow into `validateDay` + `applyValidationGate` downstream. (The handler's eventual response is built from `sorted` / `proposedChanges`; `dayMinimal` is the gate's input surface, which is the contract being normalized.)
- **`hotelName` / `hasHotel`:** sourced from `body.hotelName` (no `trip` object exists in this scope). Address omitted (`''`) — body doesn't carry it.
- **`isFirstDay` / `isLastDay`:** reuse the locals already declared at lines 616–617 instead of recomputing from `dayNumber === 1` / `dayNumber === totalDays`.
- **Placement:** spec says "just BEFORE that block" (the gate). Putting it inside the same try/catch, above `validateDay`, gives one cohesive normalization-then-gate flow and avoids duplicating the dynamic-import + `dayMinimal` setup.

## Verification

- `grep -c "repairDay" supabase/functions/refresh-day/index.ts` → ≥ 2 (import + call site)
- Deploy `refresh-day`.
- Spot-check log line `[refresh-day] repair-day applied N fixes` appears on a problem day.

## Out of scope

- No prompt/template changes.
- No new repair codes.
- No change to the gate's behavior — it just sees cleaner input.
