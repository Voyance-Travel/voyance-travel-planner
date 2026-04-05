

## Phantom Pricing v8 — Airport Arrival/Departure Fix

### Root Cause

"Arrival at Lisbon Airport" has "airport" in the title, which matches `PAID_OVERRIDE_PATTERNS` in `src/lib/cost-estimation.ts` (line 553: `/\b(?:airport|taxi|uber|...)\b/i`). This causes `isLikelyFreePublicVenue` to return `false`, so the frontend never zeroes the price.

The backend `sanitization.ts` also doesn't catch it because "airport" isn't in the `tier1FreePatterns` regex, and arrival/departure activities aren't handled at all.

### Fix (2 files)

**File 1: `src/lib/cost-estimation.ts`**

Add an "always-free activity" check at the top of `isLikelyFreePublicVenue` (before the paid override check). If the title matches arrival/departure/check-in/check-out/freshen-up patterns, return `true` immediately — these activities never cost money regardless of keywords like "airport":

```ts
const ALWAYS_FREE_ACTIVITY = /\b(?:arrival|departure|check[\s-]?in|check[\s-]?out|return\s+to|freshen\s+up|settle\s+in)\b/i;
if (ALWAYS_FREE_ACTIVITY.test(fields.title || '')) return true;
```

This goes right after the `if (!combined) return false;` check and before the paid override check.

**File 2: `supabase/functions/generate-itinerary/sanitization.ts`**

Add a check before the tier1/tier2 free venue logic (around line 304). If the activity title matches arrival/departure patterns, zero out its cost:

```ts
const alwaysFreeActivity = /\b(?:arrival|departure|check[\s-]?in|check[\s-]?out|return\s+to|freshen\s+up|settle\s+in)\b/i;
if (alwaysFreeActivity.test(act.title || '') && act.cost?.amount > 0) {
  console.log(`[sanitize] Zeroed cost on always-free activity: ${act.title}`);
  act.cost = { amount: 0, currency: act.cost.currency || 'USD' };
}
```

### Files to edit
- `src/lib/cost-estimation.ts` — add always-free activity bypass before paid override check
- `supabase/functions/generate-itinerary/sanitization.ts` — zero cost on arrival/departure activities

### Verification
Open trip `3263251a`. "Arrival at Lisbon Airport" should show Free. All other free venues should remain Free. Dining and ticketed items should keep their prices.

