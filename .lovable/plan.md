

# Fix: Regenerated last day has airport transfer before hotel checkout

## Problem
When regenerating the last day via `generate-day`/`regenerate-day`, the AI produces checkout AFTER airport transfer. The full-generation path has a post-processing swap fix (line 2479-2549) that reorders checkout before airport, but the `generate-day` handler has **no equivalent swap logic**. It only has a checkout *injection* guarantee (line 9868) which fires when checkout is missing entirely — it does nothing when checkout exists but is in the wrong position.

## Root Cause
**File: `supabase/functions/generate-itinerary/index.ts`**

The full-gen path (`generateSingleDayWithRetry`, line 2483) includes:
```
if checkout exists AND comes AFTER airport → swap them, re-anchor times
```

The `generate-day` handler (line 6559) has no such swap. The AI prompt says "CHECKOUT MUST HAPPEN BEFORE AIRPORT TRANSFER" but the AI ignores it, and there's no safety net in this code path.

## Fix
Add the same departure-day sequence fix to the `generate-day` handler, after the checkout guarantee injection (line ~9963) and before the airport-strip logic (line ~9966).

### Change in `supabase/functions/generate-itinerary/index.ts`

After line 9963 (end of checkout guarantee block), before the airport-strip block at line 9966, insert the checkout/airport sequence fix:

```typescript
// ====================================================================
// DEPARTURE DAY SEQUENCE FIX (generate-day path):
// If checkout exists AFTER airport transfer, swap them
// ====================================================================
if (isLastDay && generatedDay.activities.length > 1) {
  const checkoutIdx = generatedDay.activities.findIndex((a: any) => {
    const t = (a.title || '').toLowerCase();
    return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
  });
  const airportIdx = generatedDay.activities.findIndex((a: any) => {
    const t = (a.title || '').toLowerCase();
    return (t.includes('airport') || t.includes('departure transfer')) &&
           ((a.category || '').toLowerCase() === 'transport' || t.includes('transfer'));
  });

  if (checkoutIdx !== -1 && airportIdx !== -1 && checkoutIdx > airportIdx) {
    console.log(`[generate-day] Fixing departure sequence: checkout@${checkoutIdx} → before airport@${airportIdx}`);
    const checkoutAct = generatedDay.activities[checkoutIdx];
    const airportAct = generatedDay.activities[airportIdx];

    // Re-anchor: checkout takes airport's start time, airport follows after
    const checkoutDur = Math.max(5, (parseTimeToMinutes(checkoutAct.endTime) ?? 0) - (parseTimeToMinutes(checkoutAct.startTime) ?? 0)) || 15;
    const transferDur = Math.max(10, (parseTimeToMinutes(airportAct.endTime) ?? 0) - (parseTimeToMinutes(airportAct.startTime) ?? 0)) || 60;

    checkoutAct.startTime = airportAct.startTime;
    checkoutAct.endTime = addMinutesToHHMM(checkoutAct.startTime, checkoutDur);
    airportAct.startTime = checkoutAct.endTime;
    airportAct.endTime = addMinutesToHHMM(airportAct.startTime, transferDur);

    // Swap in array then re-sort
    generatedDay.activities[airportIdx] = checkoutAct;
    generatedDay.activities[checkoutIdx] = airportAct;
    generatedDay.activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });
  }
}
```

This mirrors the existing full-gen fix at lines 2479-2549 identically.

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add checkout/airport sequence swap to generate-day path (after line ~9963) |

