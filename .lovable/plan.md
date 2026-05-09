# Plan: Second `applyValidationGate` pass after final pre-save sweeps

## Context correction

The user's bug report says `action-generate-trip-day.ts` "never invokes the gate." That's stale — the gate **is** wired at **lines 1435–1488**, mirroring `action-generate-day.ts`. So this isn't a missing-wire bug.

The real gap is **temporal**: the existing gate runs right after `repair-day` (line 1462), but ~500 lines of additional mutation happen **after** it before save:

- `universalQualityPass` (line 1614)
- Final meal-guard `_fmgPolicy` (line 1714)
- Duplicate hotel-return dedup (lines 1925–1942)
- **Final orphan-transit sweep** (line 1949)

Any of those can re-introduce critical residue the first gate would have caught:
- A drop creates a punctuation-only field on a neighbor.
- Meal-guard re-injects a card with a `TRUNCATED_SENTENCE`.
- Hotel-return dedup leaves a `CHECKOUT_HOTEL_LEAK` arrangement.
- Orphan-transit drop reshuffles indices into a `WALK_OVER_THRESHOLD` adjacency.

The single-day refresh path (`action-generate-day.ts`) doesn't have this gap — it doesn't run those late stages. So the fix isn't "wire the gate" but **add a second gate pass at the very end**, after the final orphan sweep.

## Change

### `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

Insert immediately after the final orphan-transit sweep (after line 1953, before the StageLogger flush at line 1956):

```ts
// === FINAL VALIDATION GATE (post-everything safety net) ===
// First gate runs at line 1462 right after repair-day. Several stages mutate
// the day after that (universalQualityPass, final meal guard, hotel-return
// dedup, orphan-transit sweep). This second pass catches any critical residue
// those late stages could have re-introduced. Mirrors the first gate's signature.
if (Array.isArray(dayResult?.activities) && dayResult.activities.length > 0) {
  try {
    const { applyValidationGate } = await import('./pipeline/validation-gate.ts');
    const finalPolicy = deriveMealPolicy({
      dayNumber, totalDays, isFirstDay: _isFirstDay, isLastDay: _isLastDay,
      arrivalTime24: _isFirstDay ? savedArrTime24Hoisted : undefined,
      departureTime24: _isLastDay ? savedDepTime24Hoisted : undefined,
    });
    const finalDayMinimal = {
      dayNumber,
      date: dayResult.date || '',
      title: dayResult.title || '',
      theme: dayResult.theme,
      activities: (dayResult.activities || []).map((a: any) => ({
        id: a.id || '', title: a.title || a.name || '',
        startTime: a.startTime || a.start_time || '',
        endTime: a.endTime || a.end_time || '',
        category: a.category || 'activity',
        location: a.location || { name: '', address: '' },
        cost: a.cost || { amount: 0, currency: 'USD' },
        description: a.description || '',
        tags: a.tags || [],
        bookingRequired: a.bookingRequired || false,
        transportation: a.transportation || { method: '', duration: '', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' },
      })),
    };
    const finalResults = validateDay({
      day: finalDayMinimal as any,
      dayNumber, isFirstDay: _isFirstDay, isLastDay: _isLastDay, totalDays,
      destination: cityInfo?.cityName || destination,
      hasHotel: true,
      hotelName: cityInfo?.hotelName || tripHotelName || undefined,
      arrivalTime24: _isFirstDay ? savedArrTime24Hoisted : undefined,
      returnDepartureTime24: _isLastDay ? savedDepTime24Hoisted : undefined,
      requiredMeals: finalPolicy.requiredMeals || [],
      previousDays: existingDays.filter((d: any) => d?.dayNumber !== dayNumber) as any,
      isHotelChange: cityInfo?.isHotelChange || tripIsHotelChange,
      previousHotelName: (cityInfo as any)?.previousHotelName || tripPreviousHotelName,
    });
    const finalGate = applyValidationGate(
      finalDayMinimal as any,
      finalResults,
      { dayNumber, destination: cityInfo?.cityName || destination },
    );
    if (finalGate.verdict === 'persist_forced') {
      // Drop-aware merge (mirrors first gate at line 1467–1484).
      const gated = finalGate.day.activities as any[];
      const survivingIds = new Set(gated.map((g: any) => g?.id).filter(Boolean));
      const droppedAny = gated.length !== dayResult.activities.length;
      if (droppedAny && survivingIds.size === gated.length) {
        const filtered = (dayResult.activities as any[]).filter((a: any) => survivingIds.has(a?.id));
        dayResult.activities = filtered.map((orig: any) => {
          const g = gated.find((x: any) => x?.id === orig?.id) || {};
          return { ...orig, ...g };
        });
      } else {
        dayResult.activities = gated.map((g: any, i: number) => ({ ...(dayResult.activities[i] || {}), ...g }));
      }
      dayResult.metadata = dayResult.metadata || {};
      dayResult.metadata.quality = dayResult.metadata.quality || {};
      dayResult.metadata.quality.final_gate_forced_persist = true;
      dayResult.metadata.quality.final_validation_gate = finalGate.counters;

      // A late drop can re-orphan a transit. Re-sweep, idempotent if clean.
      const reOrphans = pruneOrphanTransits(dayResult.activities);
      if (reOrphans > 0) {
        console.warn(`[generate-trip-day] Final-gate re-sweep dropped ${reOrphans} re-orphaned connector(s) on day ${dayNumber}`);
      }
      console.warn(`[FINAL_GATE] day=${dayNumber} forced persist; counters=${JSON.stringify(finalGate.counters)}`);
    }
  } catch (gateErr) {
    console.warn('[generate-trip-day] Final validation gate failed (non-blocking):', gateErr);
  }
}
```

### Notes

- `validateDay`, `deriveMealPolicy`, `pruneOrphanTransits` are already top-level imports (lines 13/15 + dynamic import in scope). No new imports needed at the top — `validateDay` is dynamically imported inside the function (line 1308) so we reuse the same pattern, but we can hoist the dynamic import outside the try by binding it once. Simplest: keep the dynamic import inside the try (consistent with the first gate).
- All required state vars (`_isFirstDay`, `_isLastDay`, `savedArrTime24Hoisted`, `savedDepTime24Hoisted`, `cityInfo`, `destination`, `tripHotelName`, `tripIsHotelChange`, `tripPreviousHotelName`, `existingDays`, `totalDays`) are already in scope at this line.
- Uses **distinct metadata keys** (`final_gate_forced_persist`, `final_validation_gate`) so we can attribute drops to the second pass vs. the first in observability.
- Sentinel: `[FINAL_GATE] day=N forced persist; counters=…` — distinct from the existing `[VALIDATION_GATE]` so dashboards can split them.
- Wrapped in try/catch and gated on non-empty activities — never blocks save.

## Out of scope

- No changes to `validation-gate.ts`, `validate-day.ts`, or `repair-day.ts`. The semantic codes and force-downgrade logic are already correct; we're only adding a second invocation site.
- No changes to `action-generate-day.ts` (single-day refresh) — its mutation surface ends at the existing gate; no late stages, no second pass needed.
- Frontend, orphan-transit exemption, sanitizer wrappers, validator demotion: all shipped in earlier items.

## Verification

- TypeScript compile (no new types).
- Manual trace: regenerate a multi-day luxury trip, grep edge logs for `[FINAL_GATE]` — should be **rare** (most trips clean after first gate). If it fires every day, the late stages are doing more damage than expected and we should investigate that next.
- `metadata.quality.final_gate_forced_persist === true` rows in `trips.itinerary_data` are the QA cohort to inspect.
