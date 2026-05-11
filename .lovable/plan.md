# Restaurant & Activity Description Coverage

## Investigation Summary

**Q1 — Where are descriptions generated?**
Single source: the main activity-generation prompt in `supabase/functions/generate-itinerary/prompt-library.ts` (assembled by `pipeline/compile-prompt.ts`). The model returns `activity.description` inline with the rest of the activity object — there is **no separate description-enrichment step or post-gen blurb writer**. `pipeline/enrich-day.ts` only attaches venue metadata (place_id, coords, rating) from `verified_venues`, never copy.

**Q2 — Required vs optional?**
Description is **never explicitly required** in `prompt-library.ts`. It's mentioned only tangentially:
- L1309 "include WHICH line/route for public transit"
- L1326 "Can be optional/skippable — note 'optional' in description if so"
- L1389 "If an activity is FREE, you may mention 'free entry' in the description"

No "every activity MUST have a description" rule, no quality bar for restaurants.

**Q3 — Existing validator?**
None. `rg "MISSING_DESCRIPTION|checkActivityDescription|description.*empty"` returns 0 hits across the whole edge-functions tree. `FAILURE_CODES` (pipeline/types.ts) has no description-quality entries.

**Q4 — Hidden leak path (BIG):**
`scrubPhantomEventRefsFromString` (`_shared/prompt-leak-scrub.ts:404`) and `scrubBodyPromptLeaks` can **blank a description to `''`** when the entire field is a single phantom-only sentence (M2 Madrid fix). Nothing fills it back in. This explains the intermittent "good blurb on Café Comercial, blank on the next restaurant" pattern: when the LLM wrote "Tonight's Michelin dinner has limited seating" as the *only* description, the scrubber dropped it and left empty.

So root causes are (a) prompt doesn't mandate descriptions, (b) phantom-ref scrubber legitimately blanks fields with no replacement.

## Plan

### 1. Prompt mandate — `prompt-library.ts`
Insert a `DESCRIPTION REQUIREMENTS (HARD RULE)` block right after the existing `MEAL DETAILS` section (~line 1295), modelled on the SCHEDULE COHERENCE block:

- Every non-transit, non-bookend activity MUST have a description ≥30 chars.
- Restaurants: ONE actionable recommendation — "Order/Try/Request the [signature dish]" or "Ask for a table in the [specific area]" or "Best window: [time slot]".
- Attractions: ONE insider tip — best entrance, what to focus on, ideal light/crowd timing.
- Experiences: ONE calibration — skill level, dress code, what to bring.
- Banned openings: "This is a great…", "You'll love…", "Amazing…", "Wonderful…" + length <100 chars.
- Note that empty/generic descriptions trigger a regeneration pass.

### 2. Validator — `pipeline/validate-day.ts`
Add `checkActivityDescriptions(activities, results)` and wire it before `checkPlausiblePricing` (~line 186). New failure codes in `pipeline/types.ts`:

```
MISSING_DESCRIPTION:                 'MISSING_DESCRIPTION',         // <30 chars or empty
GENERIC_DESCRIPTION:                 'GENERIC_DESCRIPTION',         // generic opener + <100 chars
RESTAURANT_MISSING_RECOMMENDATION:   'RESTAURANT_MISSING_RECOMMENDATION',
```

Skip rules (mirror `shouldSkipPriceSanity`):
- Skip `category === 'transport'`, transit rows (`isTransitActivity`), bookends (`isBookendCard`).
- Skip locked/user/manual/extracted/pinned (Universal Locking).
- Skip `isGhostActivity` rows.

Restaurant detection: `category === 'dining' || subcategory matches restaurant|dining|food`. Recommendation regex: `/order|try|request|ask for|don'?t miss|signature|known for|best for|book.*table/i`.

### 3. Repair — `pipeline/repair-day.ts`
Add **§10f. DESCRIPTION_FILL** right after §10e price-substitute. Strategy: **single batched LLM call per day** (cost-conscious vs per-activity round-trip).

```
const missing = results.filter(r => 
  r.code === MISSING_DESCRIPTION || 
  r.code === GENERIC_DESCRIPTION || 
  r.code === RESTAURANT_MISSING_RECOMMENDATION
);
if (missing.length === 0) skip;

// Build compact prompt: destination + per-activity {id, title, venue, category, subcategory, isRestaurant}
// Ask Gemini 2.5 flash for {id: string, description: string}[] — strict JSON.
// Apply via id match; never overwrite a non-empty description for GENERIC/RESTAURANT_MISSING (only enrich blanks).
// Stamp `repair.action='filled_missing_description'` + sentinel log `[DESC_FILL] day=N filled=K`.
```

Model: `google/gemini-2.5-flash` (Lovable AI Gateway, no key needed; cheap, fast, JSON-mode reliable). Hard 8-second timeout — on failure leave field empty (no generic placeholder, per Density Protocol "No placeholder responses" core rule).

### 4. Validation gate — `pipeline/validation-gate.ts`
Add cases for the three new codes — non-blocking (warning severity passes through). Repair-day §10f is the actual mutator; the gate just logs `[VALIDATION_GATE] day=N MISSING_DESCRIPTION count=K` for telemetry.

### 5. Tests — `supabase/functions/generate-itinerary/__tests__/description-coverage.test.ts` (new)
- Empty description on restaurant → MISSING_DESCRIPTION.
- 25-char description → MISSING_DESCRIPTION (length floor).
- "This is a great spot" → GENERIC_DESCRIPTION.
- Restaurant with "Order the suckling pig roasted in the 16th-century cellar" → no violation.
- Restaurant with "Authentic Spanish cuisine in Madrid" → RESTAURANT_MISSING_RECOMMENDATION.
- Transit/bookend/locked/ghost rows → skipped.
- After phantom-ref scrub blanks a description, validator catches it (regression coverage for the Madrid M2 leak path).

### 6. Memory
Update existing `mem://constraints/itinerary/schedule-coherent-copy` entry to note that the phantom-scrub blank is now backstopped by §10f description-fill, and add a new core memory `mem://constraints/itinerary/description-coverage`:

> Every non-transit/bookend activity MUST have a description ≥30 chars. Restaurants additionally need an actionable verb ("Order/Try/Request/Ask for/Don't miss/signature"). Validator: `checkActivityDescriptions` (validate-day.ts) → repair §10f batched Gemini-2.5-flash fill. Closes intermittent blank-restaurant-blurb pattern (Madrid: Café Comercial OK, next restaurant blank because phantom-ref scrubber dropped the only sentence).

Add one-line index entry under Per-Category Price Sanity.

## Out of Scope

- Per-activity LLM round-trips (rejected — too expensive). Batched per-day only.
- Rewriting good-but-short descriptions (only fills empty/generic blanks).
- Description quality scoring beyond length + recommendation-verb regex.
- New `verified_venues.signature_dish` column (heavy migration — revisit only if telemetry shows fill-rate <85%).
- Editing the existing `scrubPhantomEventRefs` behavior — it correctly blanks; §10f refills.

## Verification

- New test file passes via direct `deno test` on `description-coverage.test.ts`.
- Existing `m2-departure-day-logistics.test.ts` + phantom-ref tests still pass (no regression on legitimate blanks).
- Manual: 3-day Madrid trip — every restaurant has actionable verb; no <30-char descriptions on non-transit cards.
- Sentinel grep on edge logs after a generation: `[DESC_FILL] day=N filled=K` appears when phantom-scrub blanks fields.
