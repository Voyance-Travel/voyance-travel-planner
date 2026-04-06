

## Fix: ReferenceError Bug + CORS Timeout Resilience

### Problem 1: ReferenceError (Critical)
In `action-generate-day.ts`, `resolvedIsHotelChange` and `resolvedPreviousHotelName` are used at **line 815-816** (in `validationInput`) but declared at **line 832-833** (after the validation block). JavaScript's temporal dead zone causes a `ReferenceError: Cannot access 'resolvedIsHotelChange' before initialization`, which silently skips the entire validate/repair pipeline for every generated day.

Logs confirm: `[pipeline] Validate/repair failed (non-blocking): ReferenceError: Cannot access 'resolvedIsHotelChange' before initialization`

**Fix**: Move the variable declarations (lines 832-833) **before** the `validationInput` object construction (line 798). The variables depend on `facts` which is available earlier.

### Problem 2: CORS Timeout
The browser sees a CORS error because the edge function's Deno runtime terminates before it can return headers. The `generate-trip` action already returns immediately and chains via self-invocation — the CORS error happens when the **initial** `generate-trip` call itself takes too long during its setup phase (enrichment context computation), or when a browser-initiated `generate-day` call (for regeneration) exceeds the wall-clock limit.

**Fix**: This is harder to fully solve without architectural changes. However, the ReferenceError fix above will make the pipeline more reliable and faster (no wasted error-handling overhead). No timeout changes needed — the existing 120s/180s adaptive timeouts are reasonable.

### Plan

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**

Move lines 830-833 (the `resolvedRepairHotelName`, `resolvedRepairHotelAddr`, `resolvedIsHotelChange`, `resolvedPreviousHotelName` declarations) to **before** line 798 where `validationInput` is constructed. This ensures the variables are in scope when referenced in the validation input object.

```
// Before (broken order):
// L798: validationInput uses resolvedIsHotelChange  ← ReferenceError
// L832: const resolvedIsHotelChange = facts.resolvedIsHotelChange;

// After (correct order):
// L798: const resolvedIsHotelChange = facts.resolvedIsHotelChange;  
// L810: validationInput uses resolvedIsHotelChange  ← works
```

### Files to edit
- `supabase/functions/generate-itinerary/action-generate-day.ts` — fix variable declaration order

### Verification
After deploying, check edge function logs for:
- No more `ReferenceError: Cannot access 'resolvedIsHotelChange'` warnings
- `[pipeline] Day N validation: all checks passed` or specific issues listed (instead of silent failure)
- Validate/repair pipeline running successfully

