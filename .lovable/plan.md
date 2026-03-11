

## Fix 23I: Must-Do Intent Parsing — Split Compound Activities

### Problem
"Dinner and comedy show" is treated as one locked event titled "Dinner And Comedy Show" instead of being split into two separate generic activity requests where the AI suggests specific venues.

### Changes

**File 1: `supabase/functions/generate-itinerary/must-do-priorities.ts`**

1. **Add compound splitting constants** (before `parseMustDoInput` ~line 241):
   - `COMPOUND_CONJUNCTIONS` regex: `/\b(?:and\s+then|then|followed\s+by|after\s+that)\b/i` (note: bare "and" only when both sides are generic)
   - `GENERIC_ACTIVITY_KEYWORDS` array: dinner, lunch, breakfast, brunch, comedy, comedy show, stand-up, rooftop, drinks, cocktails, bar, show, broadway, theater, museum, shopping, spa, nightclub, jazz, coffee, dessert, etc.
   - `isGenericActivityDescription(text)` helper: returns true if text contains a generic keyword or starts with "a "/"some "

2. **Add compound splitting step** in `parseMustDoInput()` (~line 355, after `expandedItems` multi-day expansion loop, before the `parseItem()` loop):
   - For each item, test if it contains "and" or other conjunctions
   - Split on conjunction, check if ALL parts are generic via `isGenericActivityDescription()`
   - If yes, expand into separate items (preserving `preferredDay`)
   - If no (e.g., "Hamilton and dinner"), keep as-is

3. **Add `isGenericIntent` field** to `MustDoPriority` interface (line 19-52):
   - `isGenericIntent?: boolean`
   - Set it at end of `parseItem()` (~line 494): `isGenericIntent: isGenericActivityDescription(item)`

**File 2: `supabase/functions/generate-itinerary/index.ts`**

4. **Update must-do prompt injection** (~lines 5422-5431):
   - After `scheduleMustDos()`, partition results into specific venues vs generic intents using `isGenericIntent`
   - For specific venues: keep existing "MANDATORY — include exactly as named" language
   - For generic intents: use new "AI must suggest specific venues" language that tells the AI to suggest a real restaurant/venue name, address, and cost — NOT echo the user's words as the title
   - Also update the raw text fallback at line 5428 to attempt parsing first

5. **Update per-day prompt** (~line 6732-6734):
   - Same split for the per-day generation path's raw text fallback

### Files Changed: 2
1. `supabase/functions/generate-itinerary/must-do-priorities.ts` — Compound splitting, generic detection, new interface field
2. `supabase/functions/generate-itinerary/index.ts` — Split prompt into specific venues vs generic activity requests

