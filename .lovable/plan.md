

## Fix: Split-Stay Hotel Name Validation and Sequence Enforcement

### Problem

On hotel-change days, the repair pipeline checks whether checkout and check-in activities *exist* but not whether they reference the *correct* hotels. When the AI generates "Checkout from Palácio Ludovice" instead of "Checkout from Four Seasons Ritz", the pipeline sees "checkout exists" and skips correction. Title normalization (Step 9b) later fixes the hotel name but can't fix the scrambled sequence.

The result: Breakfast at the wrong hotel, checkout from the wrong hotel, and a logically inverted checkout→check-in sequence.

### Root Cause

Three gaps in `repair-day.ts`:

1. **Steps 7/8 (`hasCheckoutAlready` / `hasCheckInAlready`)** — Only check if any checkout/check-in exists, not whether it names the correct hotel (`previousHotelName` for checkout, `hotelName` for check-in).

2. **No sequence enforcement** — Even after injection/normalization, there's no step that verifies the checkout comes before the transport, which comes before the check-in. The AI can place them in any order.

3. **Pre-checkout activities reference wrong hotel** — Breakfast "at Palácio Ludovice" on a morning when the traveler is still at Four Seasons. No step validates that pre-checkout activities reference `previousHotelName`.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

#### Change 1: Hotel-name-aware existence checks (Steps 7/8, ~lines 722-760)

Replace the generic checkout/check-in existence checks with hotel-name-aware versions:

```typescript
// Step 8-first: CHECKOUT — must be from previousHotelName
const prevHotelLower = (previousHotelName || '').toLowerCase();
const hasCorrectCheckout = activities.some((a: any) => {
  const t = (a.title || a.name || '').toLowerCase();
  const cat = (a.category || '').toLowerCase();
  const isCheckout = cat === 'accommodation' && 
    (t.includes('check-out') || t.includes('check out') || t.includes('checkout'));
  // If we know the previous hotel, require it to match
  return isCheckout && (!prevHotelLower || t.includes(prevHotelLower));
});

// Step 7-second: CHECK-IN — must be at hotelName (new hotel)
const newHotelLower = (hotelName || '').toLowerCase();
const hasCorrectCheckIn = activities.some((a: any) => {
  const t = (a.title || a.name || '').toLowerCase();
  const cat = (a.category || '').toLowerCase();
  const isCheckIn = cat === 'accommodation' && 
    (t.includes('check-in') || t.includes('check in') || t.includes('checkin') || 
     t.includes('settle in') || t.includes('luggage drop'));
  return isCheckIn && (!newHotelLower || t.includes(newHotelLower));
});
```

If a checkout exists but names the wrong hotel, **remove it** and inject the correct one. Same for check-in.

#### Change 2: Remove wrong-hotel checkout/check-in before injecting correct ones

Before the injection logic, strip any checkout that names the wrong hotel, and any check-in that names the wrong hotel:

```typescript
if (!hasCorrectCheckout) {
  // Remove any wrongly-named checkout
  const wrongIdx = activities.findIndex((a: any) => {
    const t = (a.title || a.name || '').toLowerCase();
    const cat = (a.category || '').toLowerCase();
    return cat === 'accommodation' && 
      (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) &&
      prevHotelLower && !t.includes(prevHotelLower);
  });
  if (wrongIdx >= 0) {
    repairs.push({ code: FAILURE_CODES.CHRONOLOGY, action: 'removed_wrong_hotel_checkout', 
      before: activities[wrongIdx].title });
    activities.splice(wrongIdx, 1);
  }
  // ... then inject correct checkout (existing injection code)
}
```

Same pattern for wrong-hotel check-in.

#### Change 3: Post-injection sequence enforcement (new sub-step after Step 8)

After both checkout and check-in are guaranteed with correct hotel names, enforce the sequence: **Checkout → Transport → Check-in**. If they're out of order, reorder them:

```typescript
// --- 8b. SPLIT-STAY SEQUENCE ENFORCEMENT ---
if (isHotelChange) {
  const coIdx = activities.findIndex(a => 
    (a.category||'').toLowerCase() === 'accommodation' && 
    /check.?out/i.test(a.title||''));
  const ciIdx = activities.findIndex(a => 
    (a.category||'').toLowerCase() === 'accommodation' && 
    /check.?in|settle.in|luggage.drop/i.test(a.title||''));
  
  if (coIdx >= 0 && ciIdx >= 0 && coIdx > ciIdx) {
    // Checkout is after check-in — swap them and re-time
    const checkout = activities.splice(coIdx, 1)[0];
    const newCoIdx = activities.indexOf(activities[ciIdx]); // ciIdx shifted
    activities.splice(newCoIdx, 0, checkout);
    
    // Re-time: checkout at 11:00, transport 11:30, check-in 12:15
    checkout.startTime = '11:00';
    checkout.endTime = '11:30';
    // Find/update transport between them
    // Update check-in to 12:15
    repairs.push({ action: 'reordered_split_stay_sequence' });
  }
}
```

#### Change 4: Fix pre-checkout hotel references

In the accommodation title normalization (Step 9b, ~line 1230), when `isHotelChange` is true, any accommodation activity *before* the checkout index should use `previousHotelName`, not `hotelName`:

```typescript
// In Step 9b, when isHotelChange:
const checkoutIdx = activities.findIndex(a => /check.?out/i.test(a.title||''));

for (let i = 0; i < activities.length; i++) {
  const act = activities[i];
  const cat = (act.category || '').toLowerCase();
  if (cat !== 'accommodation') continue;
  
  // Before checkout → use previousHotelName; after → use hotelName
  const resolvedHn = (isHotelChange && checkoutIdx >= 0 && i < checkoutIdx) 
    ? (previousHotelName || 'Your Hotel') 
    : hn;
  
  // ... apply canonical titles using resolvedHn instead of hn
}
```

### Summary

All changes are in `supabase/functions/generate-itinerary/pipeline/repair-day.ts`:
- **Steps 7/8**: Hotel-name-aware existence checks + removal of wrong-hotel activities
- **New Step 8b**: Sequence enforcement (checkout before check-in)
- **Step 9b**: Context-aware title normalization (pre-checkout = old hotel, post-checkout = new hotel)

