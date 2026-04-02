

## Fix Duplicated Address Components

### Problem
Address strings contain duplicated city/postal code segments, e.g. `"Praça do Império 1400-206 Lisboa, 1400-206 Lisboa, Portugal"`.

### Fix

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

1. **Add `sanitizeAddress` helper** (before `sanitizeGeneratedDay`):
   - Dedup repeated postal+city segments: `(\d{4,5}[-\s]?\d{3}\s+[A-Za-zÀ-ÿ\s]+),\s*\1` → `$1`
   - Dedup repeated city names: `\b([A-Za-zÀ-ÿ]{3,}),\s*\1\b` → `$1`

2. **Call it in `sanitizeGeneratedDay`** activity loop (~line 183-186) on:
   - `act.location.address`
   - `act.location.name` (just in case)
   - `act.venue_address` if present

### Changes

| File | Change |
|---|---|
| `sanitization.ts` | Add `sanitizeAddress()` helper; call it on location fields inside the activity loop in `sanitizeGeneratedDay` |

