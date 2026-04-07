

## Replace Hardcoded Restaurant Fallbacks with Universal AI Re-Generation

### Problem
The current placeholder detection works for any city, but the **replacement** step only works for Paris, Rome, Berlin, London, and Lisbon (hardcoded `INLINE_FALLBACK_RESTAURANTS`). For any other city (Tokyo, Barcelona, Marrakech, etc.), `getRandomFallbackRestaurant` returns `null` and the placeholder survives into the final itinerary.

### Solution
When a placeholder is detected and no hardcoded fallback exists, make a targeted AI micro-call to generate a real restaurant for that specific slot. Keep the hardcoded database as a fast path (no AI cost) for covered cities.

### Architecture

```text
Placeholder detected
  ├─ Hardcoded fallback exists? → Use it (fast, free) ← unchanged
  └─ No fallback? → AI micro-call to generate 1 real restaurant
       ├─ Prompt includes: city, meal type, budget tier, time, used venues blocklist
       └─ Returns: name, address, price, description
```

### Changes

**File: `supabase/functions/generate-itinerary/action-generate-day.ts`**

1. **Expand `PLACEHOLDER_TITLE_PATTERNS`** with the user's broader patterns:
   - Add patterns for `brunch`, generic venue types in multiple languages (trattoria, osteria, izakaya, tapas bar, etc.)
   - Add trailing action word patterns

2. **Make `PLACEHOLDER_VENUE_PATTERNS` universal** — replace the hardcoded city list with a single dynamic check: if the venue name matches the trip's destination city name (case-insensitive), it's a placeholder. Keep the other generic patterns (empty, "the destination", "downtown", etc.)

3. **Add `generateFallbackRestaurant()` async function** that calls the AI gateway with a focused micro-prompt:
   - Uses `google/gemini-2.5-flash-lite` (cheapest/fastest model) with tool calling
   - Prompt: "You are a restaurant expert for {city}. Suggest ONE real {mealType} restaurant for {budgetTier} travelers at {time}. DO NOT suggest: {usedVenues}. Return a real place with real address."
   - Tool schema returns: `{ name, address, price, description }`
   - Timeout: 10 seconds max
   - On failure: log warning but leave activity as-is (better than crashing)

4. **Update the placeholder replacement block** (lines 507-539):
   - First try `getRandomFallbackRestaurant()` (existing fast path)
   - If null, call `await generateFallbackRestaurant()` 
   - Since this is inside a for-loop over activities, collect all placeholder slots first, then batch the AI calls (or run sequentially to avoid rate limits)

5. **Keep `INLINE_FALLBACK_RESTAURANTS`** as-is — it's a free, instant fallback for the most common cities.

### Technical Details

**AI micro-prompt tool schema:**
```typescript
const RESTAURANT_SUGGESTION_TOOL = {
  type: "function",
  function: {
    name: "suggest_restaurant",
    description: "Suggest a single real restaurant",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Real restaurant name" },
        address: { type: "string", description: "Full street address" },
        price: { type: "number", description: "Average cost per person in USD" },
        description: { type: "string", description: "1-2 sentence description with signature dish" },
      },
      required: ["name", "address", "price", "description"]
    }
  }
};
```

**Cost impact:** Each placeholder fix costs ~200 input + 100 output tokens on flash-lite (~$0.0001). Typical trip has 0-2 placeholders, so negligible.

**Failure handling:** If the AI call fails (timeout, rate limit), log the error and leave the original activity unchanged. The itinerary is still usable — the user just sees a generic dining slot they can manually edit.

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/action-generate-day.ts` | Expand placeholder patterns, add `generateFallbackRestaurant()`, update replacement logic to fall through to AI when no hardcoded fallback exists |

### Deployment
Redeploy `generate-itinerary` edge function.

