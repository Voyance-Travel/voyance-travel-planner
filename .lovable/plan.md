## Fix #3 — Wire `applyValidationGate` into `refresh-day`

### Context check (important)
The user's snippet assumes `refresh-day` regenerates a `refreshedDay` and has `trip`, `totalDays`, `refreshedDay.metadata` in scope. **It doesn't.** `supabase/functions/refresh-day/index.ts` is a *diagnostic* endpoint:
- Input: `{ activities, date, destination, dayNumber, … }` (no `tripId`, no `trip`, no `totalDays`).
- Output: `{ issues, proposedChanges, transitEstimates, buffers, totalCost, activitiesValidated, dayNumber }`.
- It never mutates a day; the client applies `proposedChanges`.

So we can't copy the snippet verbatim — the variables don't exist. We adapt the same *intent* to fit this endpoint's shape: run the validation gate against the input activities, surface findings in the response, and (optionally) emit forced downgrades as additional `proposedChanges` the client can apply.

### Plan (single file: `supabase/functions/refresh-day/index.ts`)

**1. Extend body type** (L271–283) with two optional fields:
```ts
totalDays?: number;
hotelName?: string;
```
Destructure them at L284 with sensible fallbacks: `totalDays = dayNumber`, `hotelName = undefined`. (Last-day-specific gate codes only fire when `dayNumber === totalDays`; passing `totalDays` from the client is best, default keeps existing behavior conservative.)

**2. Insert validation-gate block** just before the final `return new Response(...)` at L603, after `buffers` is computed. Cascade is non-blocking; on error we log + skip.

```ts
// VALIDATION GATE — mirrors action-generate-day.ts:1245-1267 (adapted for diagnostic shape).
// Surfaces critical semantic failures (reservationUrgency leak, walk-over-threshold,
// truncated descriptions, punctuation-only fields) as additional issues + proposedChanges.
let gateCounters: any = null;
let gateForcedActivities: any[] | null = null;
try {
  const { validateDay } = await import('../generate-itinerary/pipeline/validate-day.ts');
  const { applyValidationGate } = await import('../generate-itinerary/pipeline/validation-gate.ts');
  const { deriveMealPolicy } = await import('../generate-itinerary/meal-policy.ts');

  const isFirstDay = dayNumber === 1;
  const isLastDay = dayNumber === totalDays;
  const policy = deriveMealPolicy({
    dayNumber, totalDays,
    isFirstDay, isLastDay,
    arrivalTime24: undefined,
    departureTime24: undefined,
  });

  const dayMinimal = {
    dayNumber,
    date: date || '',
    title: '',
    activities: [...sorted],
  };

  const validationResults = validateDay({
    day: dayMinimal as any,
    dayNumber,
    isFirstDay,
    isLastDay,
    totalDays,
    destination,
    hasHotel: true,
    hotelName: body.hotelName,
    requiredMeals: policy.requiredMeals || [],
    previousDays: [],
  });

  const gate = applyValidationGate(
    dayMinimal as any,
    validationResults,
    { dayNumber, destination },
  );

  gateCounters = gate.counters;
  if (gate.verdict === 'persist_forced') {
    gateForcedActivities = gate.day.activities;
    // Surface a single roll-up issue so the client knows to refresh from gate output.
    issues.push({
      type: 'validation_gate',
      activityId: 'day',
      activityTitle: `Day ${dayNumber}`,
      severity: 'error',
      message: `Validation gate forced ${gate.counters.forcedDowngrades} downgrade(s): ${gate.counters.blankedFields} blanked field(s), ${gate.counters.droppedActivities} dropped activity(ies).`,
    } as any);
  }
} catch (gateErr) {
  console.warn('[refresh-day] Validation gate failed (non-blocking):', gateErr);
}
```

**3. Include in response** (L603 payload):
```ts
return new Response(JSON.stringify({
  issues, proposedChanges, transitEstimates, buffers, totalCost,
  activitiesValidated: sorted.length,
  dayNumber,
  gateCounters,
  gateForcedActivities,
}), { ... });
```

Adding new keys is additive; existing clients ignore unknown fields. A follow-up frontend task can teach the consumer to apply `gateForcedActivities` (out of scope for this fix — backend wiring only, matching user's "the gate alone catches the worst symptoms" framing).

### Out of scope
- Calling `repairDay` upstream (user said "if you want full pipeline parity — but the gate alone catches the worst symptoms").
- Frontend consumption of `gateCounters` / `gateForcedActivities` (separate task).
- Threading `tripId`-based `trip` / `hotel_selection.name` into refresh-day (would require an auth+admin lookup; current endpoint is auth-light by design).

### Verify
```bash
grep -n "applyValidationGate" supabase/functions/refresh-day/index.ts
# expected: 2 hits (import + call)
```
