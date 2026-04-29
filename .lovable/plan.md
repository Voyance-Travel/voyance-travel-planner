# Patch 3 Product Gaps Surfaced by Tests

Three real behaviors in the generation pipeline are too permissive or incomplete. Tests currently pin them to the wrong behavior — we'll fix the logic, then tighten the tests.

---

## 1. Budget Conflict Detection (`budget-constraints.ts`)

**Gap:** `deriveBudgetIntent` flags `(highTier + frugal)` and `(lowTier + luxurySeeker)` but misses two symmetrical cases:
- `lowTier + splurge` (budget tier traveler with strong splurge appetite)
- `highTier + budgetConscious` (already partially covered, keep it)

**Why it matters:** A budget-tier user with a splurge trait gets categorized as plain `splurge_forward` with no conflict warning — the AI then generates expensive activities that bust the tier ceiling.

**Fix (lines 119–131):** Add a 4th branch:
```ts
} else if (isLowTier && isSplurge) {
  conflict = true;
  conflictDetails = `Budget tier with strong splurge trait (${budget}) - aspirational budget traveler, prioritize 1-2 high-ROI splurges`;
}
```

**Test update** (`budget-constraints.test.ts`): Flip the "low tier + splurge" assertion from `conflict === false` to `conflict === true` with the expected detail string.

---

## 2. Dietary Fuzzy Matching (`dietary-rules.ts`)

**Gap:** `matchDietaryRule` strips `"allergic to "` only as an exact prefix. Inputs like `"I'm allergic to peanuts"` or `"peanut allergy"` fall through:
- `"peanut allergy"` → strips trailing `"allergy"` → `"peanut "` (trailing space) → no match
- `"allergic to peanuts"` → prefix match works, becomes `"peanuts"` → but `"peanuts"` ≠ `"peanut-free"` key, and substring loop misses it (no key contains `"peanuts"`)

**Fix (lines 152–162):** Strengthen the normalization pipeline:
```ts
const normalized = restriction.toLowerCase().trim()
  .replace(/^i'?m /, '')           // "i'm allergic to..."
  .replace(/^i (have|am) /, '')    // "i have a peanut allergy"
  .replace(/^a /, '')               // "a peanut allergy"
  .replace(/allergic to /g, '')    // anywhere, not just prefix
  .replace(/intolerant to /g, '')
  .replace(/ allergy$/, '')        // "peanut allergy" (with space)
  .replace(/allergy$/, '')
  .replace(/ intolerance$/, '')
  .replace(/intolerance$/, '')
  .replace(/-free$/, '')
  .replace(/_free$/, '')
  .replace(/ free$/, '')
  .replace(/^no /, '')
  .replace(/^no-/, '')
  .replace(/s$/, '')                // singularize: "peanuts" → "peanut"
  .trim();
```

Also add a singular→canonical alias map for common allergens so `"peanut"` resolves to the `peanut-free` rule, `"shellfish"` → `shellfish-free`, etc.:
```ts
const allergenAliases: Record<string, string> = {
  'peanut': 'peanut-free',
  'tree nut': 'nut-free',
  'nut': 'nut-free',
  'shellfish': 'shellfish-free',
  'fish': 'fish-free',
  'egg': 'egg-free',
  'soy': 'soy-free',
  'wheat': 'gluten-free',
  'gluten': 'gluten-free',
  'dairy': 'dairy-free',
  'milk': 'dairy-free',
};
if (allergenAliases[normalized]) return DIETARY_RULES[allergenAliases[normalized]];
```

Insert this lookup **before** the substring fuzzy loop so canonical matches win over loose substring hits.

**Test update** (`dietary-rules.test.ts`): Convert the documented-gap tests to positive assertions:
- `matchDietaryRule("allergic to peanuts")` → `peanut-free` rule
- `matchDietaryRule("peanut allergy")` → `peanut-free` rule
- `matchDietaryRule("I'm lactose intolerant")` → `dairy-free` rule

---

## 3. Timezone Strict Matching (`jet-lag-calculator.ts`)

**Gap:** `resolveTimezone` falls back to `normalized.includes(city) || city.includes(normalized)` against every key. Short keys like `"la"`, `"dc"`, `"nyc"` substring-match unrelated input (`"unmappedcityname"` contains `"dc"` → returns `America/New_York`).

**Fix (lines 184–189):** Replace permissive substring with **whole-word** matching, plus require a minimum key length for the reverse direction:
```ts
// Whole-word match only (e.g., "New York City" → matches "new york",
// but "unmappedcityname" does NOT match "dc")
const tokens = normalized.split(/[\s,.\-_/]+/).filter(Boolean);
const tokenSet = new Set(tokens);

for (const [city, tz] of Object.entries(CITY_TIMEZONE_MAP)) {
  // Forward: every token of city key appears as a whole token in input
  const cityTokens = city.split(/\s+/);
  if (cityTokens.every(t => tokenSet.has(t))) return tz;
  // Reverse: input is a strict substring of multi-word city key (e.g. "york" → "new york")
  // but only allow this for keys with ≥2 words AND input length ≥ 4 chars
  if (cityTokens.length >= 2 && normalized.length >= 4 && city.includes(normalized)) {
    return tz;
  }
}
return null;
```

**Test update** (`jet-lag-calculator.test.ts`): Restore the original strict assertion:
```ts
assertEquals(resolveTimezone("qqqxxxzzzunmappedcityname"), null);
```
Also add a positive coverage test: `resolveTimezone("New York City")` still returns `America/New_York`.

---

## Verification

1. Run edge-function suite: `deno test --allow-env --allow-net --allow-read supabase/functions/generate-itinerary/`
2. Run frontend suite: `bunx vitest run`
3. Confirm 373+ tests still pass with the updated assertions reflecting the corrected behavior.

## Files Changed

- `supabase/functions/generate-itinerary/budget-constraints.ts` (add 4th conflict branch)
- `supabase/functions/generate-itinerary/budget-constraints.test.ts` (flip assertion)
- `supabase/functions/generate-itinerary/dietary-rules.ts` (normalization + allergen aliases)
- `supabase/functions/generate-itinerary/dietary-rules.test.ts` (positive fuzzy assertions)
- `supabase/functions/generate-itinerary/jet-lag-calculator.ts` (whole-word matching)
- `supabase/functions/generate-itinerary/jet-lag-calculator.test.ts` (strict null + new positive test)

## Out of Scope

- Production-grade NLP for dietary input (use a real allergen taxonomy library)
- Full IANA timezone database (current static map is fine for top destinations)
- AI-prompt changes to surface the new `lowTier + splurge` conflict in user-facing copy — handled by existing `conflictDetails` plumbing
