# Resolve user requests to real venues (no more raw "sushi lunch")

## What's happening today

You're right — we're throwing them in raw.

**Must-do items** (`metadata.mustDoActivities`):
- `parseMustDoInput` (must-do-priorities.ts) only **title-cases** entries: `"sushi lunch"` → `"Sushi Lunch"`. It tries to match `KNOWN_LANDMARKS` (Eiffel Tower, etc.) and event patterns (US Open, weddings). Anything else — cuisines, vibes, generic meal types — is passed to the LLM as a title with no venue, address, or description, and the prompt tells the model "create a card for Sushi Lunch with a proper venue." The LLM then either invents or leaves blank.
- `anchorToActivity` (user-anchors.ts) seeds these as locked anchors with `description: ''`, `venue_name: undefined`, `location: undefined`. Enrichment is *allowed* but only by title — there's no cuisine signal, so backfill regularly misses.

**Additional Notes** (`metadata.additionalNotes`):
- Injected only as a "🎯 TRAVELER'S TRIP PURPOSE" paragraph at compile-prompt.ts L590. The model is explicitly told *not* to schedule from it ("the DAY BRIEF above is the only source of truth"). So sentences like *"I want a sushi lunch on day 2 and a rooftop cocktail on day 3"* become decorative context, not real picks.

Result: blank addresses, blank descriptions, generic titles — exactly the bug you keep seeing.

## What this plan changes

Add a **venue-resolution pre-pass** that runs once, before prompt compile and before `buildUserAnchors`, and turns category/cuisine/vibe phrases into concrete picks. Specific named venues ("Sukiyabashi Jiro", "Le Bernardin") bypass and stay as-is.

### 1. New module: `_shared/resolve-user-intent-venues.ts`

For each must-do entry and each sentence in additionalNotes:

1. **Classify**: is it a *named venue* (proper noun, multi-word capitalized, matches `verified_venues.name`) or a *category intent* (cuisine + meal slot, e.g. `sushi + lunch`, `wine bar + evening`, `rooftop + cocktail`, `omakase + dinner`)?
2. **Skip** named venues — current path already handles them.
3. **For category intents**, extract `{ cuisine, slot, vibe, preferredDay }` via the same regex inventory we already use in `intent-normalizers.ts` + `fix-placeholders.ts` (sushi/ramen/izakaya/trattoria/tapas/rooftop/speakeasy/etc.), then resolve in this order:
   - `verified_venues` table filtered by `(destination, cuisine, meal_slot)` — pick highest-rated unused.
   - Google Places text search `"{cuisine} {slot} {destination}"` via existing `googlePlacesTextSearch` wrapper (already cost-tracked).
   - `INLINE_FALLBACK_MEALS` / `REGIONAL_EMERGENCY_FALLBACK` in `fix-placeholders.ts` (city-keyed, cuisine-aware where present).
4. Return a `ResolvedAnchor` with concrete `title`, `venueName`, `address`, `placeId`, `mapLink`, `priceRange`, `description` template, `cuisine` tag — so enrichment has full data, not just a string.

### 2. Wire into must-do path

In `compile-prompt.ts` around L486–522 and in `user-anchors.ts::buildUserAnchors`:

- Before calling `parseMustDoInput`, run the resolver on the raw must-do list. Replace each category-intent entry with its resolved venue title (`"Sushi Lunch" → "Sushi Lunch at Sushi Saito"`).
- Pass the resolved metadata into `anchorToActivity` so the seeded card carries `venue_name`, `location.address`, `description` (short cuisine cue), `cost` — no more blank scaffolding.
- Keep the lock semantics: title/time/category locked; address/description still eligible for enrichment as a safety net.

### 3. Wire into additionalNotes path

In `compile-prompt.ts` L590–612:

- Run the resolver against split sentences/clauses of `additionalNotes`. Any clause that parses to `{cuisine, slot}` (with optional `Day N` / day-of-week) becomes a **real anchor** via `buildUserAnchors`, not a paragraph.
- Keep the residual prose (non-resolvable purpose statements like "celebrating our anniversary") in the existing TRIP PURPOSE block.
- Promoted anchors flow through the same locked-anchor pipeline as must-dos — so they appear on the correct day with venue + address + description guaranteed.

### 4. Telemetry + safety

- Sentinels: `[INTENT_RESOLVE] mustDo=N resolved=K source=verified|google|fallback` and `[INTENT_RESOLVE_NOTES] sentences=N anchors=K`.
- Cross-city + meal-suffix guards already in place catch any bad fallback.
- If resolution fails on all 3 tiers, fall back to today's behavior (title-only) — never block generation.

## Files touched

- **new** `supabase/functions/_shared/resolve-user-intent-venues.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (must-do + additionalNotes blocks)
- `supabase/functions/_shared/user-anchors.ts` (`anchorToActivity` accepts pre-resolved venue payload)
- `supabase/functions/generate-itinerary/must-do-priorities.ts::parseMustDoInput` (accept optional pre-resolved metadata)
- tests: `resolve-user-intent-venues.test.ts` + extend `user-anchors.test.ts`

## Out of scope

- Changing the locking contract (anchors remain locked for time/title/category).
- Changing the AI prompt structure for non-anchor activities.
- Frontend changes — Step 3 already writes the data correctly; only backend interpretation changes.

Want me to implement?
