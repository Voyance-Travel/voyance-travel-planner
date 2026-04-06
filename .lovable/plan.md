

## Fix Phantom Pricing — Multi-Field Cost Check

### Problem
"Views at São Pedro de Alcântara" with venue_name "Miradouro de São Pedro de Alcântara" is priced at ~€23/pp despite being a free viewpoint. The `tier1FreePatterns` regex includes `miradouro` and `allTextFields` includes `venue_name` — so the pattern match should work. The real bug is that the **cost entry condition** at line 363 only checks `act.cost.amount`, but the AI sometimes stores pricing in `act.estimatedCost.amount`, `act.estimated_price_per_person`, or `act.price` instead. If `act.cost` is absent, the entire free-venue check is skipped.

### Root Cause
Line 363: `if (act.cost && typeof act.cost === 'object' && act.cost.amount > 0 && act.cost.amount <= 50)`

This gate blocks the check entirely when cost lives in a different field. Additionally, even when `act.cost` is zeroed, other cost fields (`estimatedCost`, `price`, `estimated_price_per_person`) are not cleared.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

**Change 1: Broaden cost detection** (replace lines 363-397)

Add a helper to extract cost from any field the AI might use:
```typescript
// Resolve the effective per-person cost from whichever field the AI populated
const effectiveCost =
  (act.cost?.amount) ||
  (act.estimatedCost?.amount) ||
  (act as any).estimated_price_per_person ||
  (act as any).price ||
  0;
const effectiveCurrency = act.cost?.currency || act.estimatedCost?.currency || 'USD';
```

Change the entry condition from `act.cost && ... act.cost.amount > 0` to `effectiveCost > 0 && effectiveCost <= 50`.

**Change 2: Zero ALL cost fields on free-venue match**

When a tier1 or tier2 free venue is detected, zero every cost representation:
```typescript
act.cost = { amount: 0, currency: effectiveCurrency };
if (act.estimatedCost) act.estimatedCost = { amount: 0, currency: effectiveCurrency };
if ((act as any).estimated_price_per_person !== undefined) (act as any).estimated_price_per_person = 0;
if ((act as any).price !== undefined) (act as any).price = 0;
```

**Change 3: Add diagnostic logging** (before the pattern check)

When any priced activity matches a free venue pattern, log it for debugging:
```typescript
if (effectiveCost > 0) {
  const hasAnyPatternMatch = tier1FreePatterns.test(allTextFields) || tier2FreePatterns.test(allTextFields);
  if (hasAnyPatternMatch) {
    console.log(`FREE VENUE CHECK: title="${act.title}", venue="${(act as any).venue_name}", category="${act.category}", cost=${effectiveCost}, costField=${act.cost ? 'cost' : act.estimatedCost ? 'estimatedCost' : 'other'}`);
  }
}
```

Also apply the same multi-field zeroing to the always-free logistics check at lines 350-355.

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — broaden cost detection to all fields, zero all cost fields on free-venue match, add diagnostic logging

### Verification
Generate a 4-day Lisbon trip. Confirm:
- "Miradouro" in venue_name (but not title) triggers free pricing
- All cost fields (`cost`, `estimatedCost`, `price`, `estimated_price_per_person`) are zeroed
- Museums, tours, and `booking_required` activities retain prices
- Console shows "FREE VENUE CHECK" logs

