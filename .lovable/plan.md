

## Plan: Transport Mode Editing + Walking Should Be Free

### Summary
Six changes across 3 files: force walking cost to $0 at generation and optimization layers, enforce it in the display layer, expand transport modes, redesign the expanded badge for better discoverability, and make mode changes free (no credit charge).

---

### Part 1: Force walking cost to $0 in generation
**File: `supabase/functions/generate-itinerary/index.ts`** (line ~361-363)

After the existing transportation sanitization block, add a walking cost override:
```typescript
if (act.transportation && typeof act.transportation === 'object') {
  if (act.transportation.instructions) act.transportation.instructions = sanitizeAITextField(act.transportation.instructions) || undefined;
  // Walking is always free
  const method = (act.transportation.method || '').toLowerCase();
  if (method === 'walk' || method === 'walking') {
    act.transportation.estimatedCost = { amount: 0, currency: act.transportation.estimatedCost?.currency || 'USD' };
  }
}
```

### Part 2: Force walking cost to $0 in optimize function
**File: `supabase/functions/optimize-itinerary/index.ts`** (after line ~2156, end of transport calculation loop)

Add a safety check after all transport assignments:
```typescript
const finalMethod = (activities[i].transportation?.method || '').toLowerCase();
if ((finalMethod === 'walk' || finalMethod === 'walking') && activities[i].transportation?.estimatedCost) {
  activities[i] = {
    ...activities[i],
    transportation: { ...activities[i].transportation!, estimatedCost: { amount: 0, currency: activities[i].transportation!.estimatedCost?.currency || 'USD' } },
  };
}
```

### Part 3: Display-layer walking cost fix + expanded modes + redesigned badge
**File: `src/components/itinerary/TransitBadge.tsx`** — full rewrite

Key changes:
- Add `isWalking` check, suppress cost display for walking
- Show "Free" in green for walking in the collapsed pill
- Show cost inline in collapsed pill for non-walking modes
- Expand AVAILABLE_MODES to 5: Walk, Metro, Bus, Rideshare, Taxi
- Redesigned expanded section: instructions first, then mode picker with "Change transport:" label
- Remove redundant method+distance+cost detail row (info already in collapsed pill)

### Part 4: Make transport mode changes free
**File: `src/components/itinerary/EditorialItinerary.tsx`** (lines ~1721-1736)

Replace the credit check + spend block with a comment noting it's free. Replace the success toast with a simple `Updated to {mode}` message without credit info.

---

### Technical Notes
- The `estimateNoCoords` function already sets walk cost to 0 (line 1937), so Part 2 is belt-and-suspenders for the Google Routes API path
- The `handleTransportModeChange` function stays otherwise intact — still calls optimize-itinerary to recalculate the route
- No database changes needed

