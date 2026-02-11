

# Fix: 4 QA Bugs — unlocked_day_count + Toast + Manual Mode

## Problem Summary

All 4 bugs trace back to a single root cause family: the system charges credits but never records that days are unlocked, and the UI shows inaccurate feedback.

| Bug | Root Cause |
|-----|-----------|
| QA-019: Paid trip stays gated | `TripDetail.tsx` save omits `unlocked_day_count` |
| QA-020: Single-day unlock fails | `useUnlockDay.ts` never increments `unlocked_day_count` |
| QA-015: Swap toast lies | Toast hardcoded to "5 credits used" even when free |
| QA-021: Smart Finish missing | Manual mode only checks localStorage, not DB `creation_source` |

---

## Changes

### 1. TripDetail.tsx — Set `unlocked_day_count` on Paid Generation (QA-019)

In `handleGenerationComplete` (line 651-658), when `isPreview` is false (meaning credits were charged), include `unlocked_day_count` in the database update:

```typescript
.update({
  itinerary_data: ...,
  itinerary_status: 'ready',
  updated_at: ...,
  // Set unlocked_day_count for paid generations
  ...(isPreview === false ? { unlocked_day_count: nonLockedDays.length } : {}),
})
```

`nonLockedDays` is already computed on line 623 — it's the generated days minus locked placeholders. This is the exact count of days the user paid for.

---

### 2. useUnlockDay.ts — Increment `unlocked_day_count` After Single-Day Unlock (QA-020)

After successful enrichment (between line 155 and the toast on line 158), fetch the current count and increment it:

```typescript
// Increment unlocked_day_count in DB
const { data: tripRow } = await supabase
  .from('trips')
  .select('unlocked_day_count')
  .eq('id', params.tripId)
  .single();
const currentCount = tripRow?.unlocked_day_count ?? 0;
await supabase
  .from('trips')
  .update({ unlocked_day_count: currentCount + 1 })
  .eq('id', params.tripId);
```

Also invalidate the trip query so the UI picks up the new count.

---

### 3. EditorialItinerary.tsx — Accurate Swap Toast (QA-015)

Line 1546: Capture the return value from `spendCredits.mutateAsync()`.
Line 1610: Replace hardcoded toast with dynamic one based on actual server response.

```typescript
const result = await spendCredits.mutateAsync({
  action: 'SWAP_ACTIVITY', tripId, ...
});
// ... (existing swap logic unchanged) ...

// Replace line 1610:
if (result?.freeCapUsed) {
  toast.success(`Swapped activity (free - ${result.usageCount}/${result.freeCap} used)`);
} else {
  toast.success(`Swapped activity (${result?.spent ?? CREDIT_COSTS.SWAP_ACTIVITY} credits used)`);
}
```

---

### 4. EditorialItinerary.tsx — Manual Mode Detection from DB (QA-021)

Line 1052: Expand the check to include the `creationSource` prop (already passed from TripDetail):

```typescript
const isManualMode = (tripId ? isManualBuilder(tripId) : false) 
  || creationSource === 'manual_paste' 
  || creationSource === 'manual';
```

This ensures the Smart Finish banner appears even if localStorage was cleared.

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `src/pages/TripDetail.tsx` | ~654 | Add `unlocked_day_count` to paid generation save |
| `src/hooks/useUnlockDay.ts` | ~155 | Increment `unlocked_day_count` after single-day unlock |
| `src/components/itinerary/EditorialItinerary.tsx` | ~1546, 1610 | Capture spend result, show accurate toast |
| `src/components/itinerary/EditorialItinerary.tsx` | ~1052 | Check `creationSource` for manual mode |

## Expected Result After Fix

```text
Paid trip (290 credits, 3-day Paris):
  Credits charged: 180 --> unlocked_day_count: 3 --> all days fully accessible

Single-day unlock (60 credits):
  Credits charged: 60 --> unlocked_day_count: 1 --> 2 --> 3 (increments)

Swap activity:
  Free swap: "Swapped activity (free - 2/3 used)"
  Paid swap: "Swapped activity (5 credits used)"

Manual trip:
  creation_source = 'manual' --> Smart Finish CTA visible
```
