

## Fix: Michelin Price Floor overriding Casual Venue Cap

### Problem
"Le Moulin de la Galette" is correctly capped to €50 by `enforceCasualVenuePriceCap`, but then `enforceMichelinPriceFloor` runs immediately after (same loop, line 151) and re-raises the price. This happens because Strategy 2 (keyword detection) matches terms like "tasting menu" or "fine dining" in the AI-generated description, triggering a €120+ floor that overwrites the €50 cap.

### Root Cause
`enforceMichelinPriceFloor` has no guard to skip venues already identified as casual. The casual cap runs first but gets immediately undone.

### Fix
In `enforceMichelinPriceFloor()` (sanitization.ts ~line 390), add an early-exit check: if the venue matches any key in `KNOWN_CASUAL_VENUES`, return false immediately — it's not Michelin, regardless of what the AI wrote in the description.

### File Change

**`supabase/functions/generate-itinerary/sanitization.ts`**

At the top of `enforceMichelinPriceFloor()`, after resolving `title` and `venueName` (around line 417), add:

```typescript
// Guard: skip venues explicitly catalogued as casual
for (const key of Object.keys(KNOWN_CASUAL_VENUES)) {
  if (title.includes(key) || venueName.includes(key)) {
    console.log(`MICHELIN FLOOR SKIP [${logPrefix}]: "${activity.title}" is in KNOWN_CASUAL_VENUES — skipping Michelin floor`);
    return false;
  }
}
```

This ensures the casual cap (€50 for Le Moulin de la Galette) is never overridden by the Michelin floor.

### Additional: Add pattern-based bistro/trattoria guard

Also add a broader pattern guard for generic casual venue types that should never trigger Michelin floors, even if not in the known map:

```typescript
const CASUAL_TYPE_GUARD = /\b(bistro|brasserie|trattoria|osteria|pizzeria|taverna|izakaya|taqueria|crêperie|kebab|deli|ramen)\b/i;
if (CASUAL_TYPE_GUARD.test(title) || CASUAL_TYPE_GUARD.test(venueName)) {
  // Only allow Michelin match if the venue is explicitly in KNOWN_FINE_DINING_STARS
  if (!matchedKey || matchedKey.startsWith('[')) {
    console.log(`MICHELIN FLOOR SKIP [${logPrefix}]: "${activity.title}" matches casual venue type pattern — skipping keyword-based Michelin floor`);
    return false;
  }
}
```

This goes after Strategy 1 matching (line 438) but before Strategy 2, ensuring that a bistro only gets Michelin pricing if it's explicitly listed in the fine dining map.

### Deployment
Redeploy `generate-itinerary` edge function.

