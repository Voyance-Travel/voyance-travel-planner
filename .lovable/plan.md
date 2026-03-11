

## Fix 23E: Departure Timeline Validation

### Problem
The AI schedules boarding after the flight departs (e.g., boarding at 8:30 PM for a 7:00 PM flight). The schema compiler's `constraint-filler.ts` already calculates correct departure timelines, but the AI sometimes ignores these constraints. We need a post-generation validator.

### Approach
Create a `departure-validator` module that runs after AI generation on the last day. It validates all activities against the flight time, fixes boarding/departure times, and removes activities scheduled after the departure cutoff.

The departure time is already available in the generate-day scope as `flightContext.returnDepartureTime24`.

### New Files (2)

**`src/lib/schema-compiler/departure-validator.ts`** and **`supabase/functions/generate-itinerary/schema/departure-validator.ts`** (Deno copy)

Contains:
- `buildDepartureConstraints(flightTime, transportMinutes, isDomestic)` — calculates boarding, airport arrival, leave-for-airport, and last-activity-end times using reverse scheduling
- `validateDepartureTimeline(activities, flightTime, transportMinutes)` — scans activities, fixes boarding time if after flight, removes non-departure activities after cutoff, ensures transport-to-airport exists, returns validated list + warnings

### Integration Point

**`supabase/functions/generate-itinerary/index.ts`** — After the gap filler (line ~8630) and before enrichment (line ~8632), add departure validation for the last day:

```typescript
if (isLastDay && flightContext.returnDepartureTime24) {
  const { validateDepartureTimeline } = await import('./schema/departure-validator.ts');
  const { validated, warnings } = validateDepartureTimeline(
    normalizedActivities,
    flightContext.returnDepartureTime24,
    airportTransferMins || 60
  );
  if (warnings.length > 0) {
    console.warn(`[departure-validator] Fixed ${warnings.length} issues:`, warnings);
  }
  normalizedActivities = validated;
}
```

Note: `airportTransferMins` is already computed at line ~7123 for the last day prompt. We'll need to hoist it or re-derive it from `flightContext` at the validation point.

### Export Updates (2 files)
- `src/lib/schema-compiler/index.ts` — add `validateDepartureTimeline` export
- `supabase/functions/generate-itinerary/schema/index.ts` — same

### Files Changed: 5
1. `src/lib/schema-compiler/departure-validator.ts` — **NEW**
2. `supabase/functions/generate-itinerary/schema/departure-validator.ts` — **NEW** (Deno copy)
3. `src/lib/schema-compiler/index.ts` — add export
4. `supabase/functions/generate-itinerary/schema/index.ts` — add export
5. `supabase/functions/generate-itinerary/index.ts` — call validator after gap filler on last day

