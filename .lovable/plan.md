

## Root Cause: Frontend "Self-Heal" Logic Prematurely Kills the Generation Chain

### What's actually happening (proven by production logs and data)

The meal guards are working correctly. The **real bug** is that days 3+ are never generated at all. Here's the exact sequence from production logs:

```text
1. Backend: generate-trip starts → sets status='generating'
2. Backend: Early save (Stage 3) writes 4 days including empty placeholders
3. Frontend: TripDetail polls, sees 4 days in itinerary_data 
4. Frontend: Self-heal logic at line 766-776 says:
   "itinerary_data has 4 days but status is 'generating' — correcting to 'ready'"
   → Sets itinerary_status = 'ready'
5. Backend: Chain tries to generate day 3
   → Sees status = 'ready' → "Trip status is ready, stopping chain"
6. Result: Days 3-4 remain as empty placeholders with 0 activities and 0 meals
```

Production evidence from logs:
- `[generate-trip-day] Trip 36238571... status is ready, stopping chain` — chain killed
- All 3 recent trips show `completed_days: 2` but `total_days: 4`
- Day 3 of NYC trip has 7 activities (stale data from a previous iteration) but wrong date `2024-05-20` — not freshly generated
- Day 3 of Tokyo trip has 0 activities — empty placeholder

**The meal guards fire correctly** (logs show `MEAL GUARD FIRED: Day 2 was missing [lunch, dinner] — injected`). But they can't fix days that were never generated.

### Why this has persisted across 5 fix attempts

Every fix has been adding more meal guards (client-side, server-side, pre-save, post-save). But the problem was never about meal detection or injection — it's that the frontend kills the backend chain before it reaches those days.

### Fix Plan

**1. Fix the self-heal logic in `TripDetail.tsx`** (the actual root cause)

The self-heal at lines 766-776 must not count empty/placeholder days as "complete":

```typescript
// BEFORE (broken):
if (Array.isArray(itinData.days) && itinData.days.length > 0) {
  // "correcting to 'ready'" — WRONG: counts empty placeholders
}

// AFTER (fixed):
const realDays = (itinData.days || []).filter(d => 
  Array.isArray(d.activities) && d.activities.length > 0
);
if (realDays.length >= effectiveExpected) {
  // Only heal if ALL days have actual activities
}
```

Same fix for the second self-heal block at lines 1032-1041: count only days with activities, not empty placeholders.

**2. Protect the chain status in `action-generate-trip-day.ts`**

Add a guard: when writing intermediate chain progress, re-verify that status hasn't been externally changed to `ready` before writing. If it has, set it back to `generating`:

```typescript
// Before each chain save, ensure status is still 'generating'
const preWriteStatus = (await supabase.from('trips')
  .select('itinerary_status').eq('id', tripId).single())
  ?.data?.itinerary_status;

if (preWriteStatus === 'ready' && dayNumber < totalDays) {
  console.warn(`[generate-trip-day] Status prematurely set to 'ready' — 
    resetting to 'generating' (day ${dayNumber}/${totalDays})`);
}
```

**3. Mark placeholder days explicitly so they can't be confused with real days**

In the early save (Stage 3) and any padding logic, add a `status: 'placeholder'` field to empty days. The frontend self-heal should ignore these.

### Files to update

| File | Change |
|------|--------|
| `src/pages/TripDetail.tsx` | Fix self-heal: only count days with actual activities (>0) as "complete" |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Add status-recovery guard: reset `ready` → `generating` if chain isn't done |
| `supabase/functions/generate-itinerary/index.ts` | Mark padded/placeholder days with `status: 'placeholder'` in early save |

### Expected outcome

- The frontend will stop killing the generation chain prematurely
- All 4 days will generate, including their meals
- The existing meal guards (which already work) will ensure B/L/D on full exploration days
- Empty placeholder days will be clearly marked and excluded from "completion" checks

