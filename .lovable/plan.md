## Problem

Some food cards render with no "why this place" copy. The render path is fine — `EditorialItinerary.tsx:11202` and `LiveActivityCard.tsx:175` both render `sanitizeActivityText(activity.description)` if truthy. The blank cards have an empty/missing `description` upstream.

## Trace

1. **LLM schema (root cause).** `generation-core.ts:1350` declares `required: ["id","title","startTime","endTime","category","location","cost","bookingRequired","personalization","tips","crowdLevel","isHiddenGem","hasTimingHack"]` — `description` is **not required**. The model legitimately omits it on busy generations, especially on meal cards where the venue+address feel "self-explanatory" to it.

2. **Verified-venue enrichment.** `verified_venues` table has no `description` column (only name/address/coords/place_id/etc). When a dining card's venue is swapped to a verified row, no description is filled in — whatever the LLM emitted survives, including empty.

3. **Inline fallback path is healthy.** `applyFallbackToActivity` (fix-placeholders.ts:451) does write `fallback.description`, and the inline DBs have descriptions for every entry. So the gap is narrowly: LLM-generated dining cards (not fallback-replaced) where the model skipped the optional `description` field.

4. **Render fallbacks missing.** `personalization.whyThisFits` (always required by schema, line 1347) is captured in the type at EditorialItinerary line 283 but never rendered. So even when the LLM did write a perfectly good "why this fits" line, the card shows nothing if `description` is blank.

## Fix — defense in depth (4 layers, narrowly scoped)

### 1. Make `description` required in the LLM schema
- `supabase/functions/generate-itinerary/generation-core.ts:1350` — add `"description"` to the `required` array.
- Same file: tighten the `description` schema entry around line 1299 to `{ type: "string", minLength: 40, description: "1–2 sentences explaining why this specific place — what makes it worth the visit. For dining: house specialty / atmosphere / reservation tip. Never generic ('great food', 'nice spot')." }`.

### 2. Backfill on save (server, all dining cards)
- New helper `ensureDiningDescription(act, destinationCity)` in `supabase/functions/_shared/scrub-activity.ts` (or a new sibling file `dining-description-backfill.ts`).
- Behavior, in priority order, for activities whose category is `dining`/`restaurant`/`food` OR whose title starts with `Breakfast|Brunch|Lunch|Dinner|Drinks at`:
  1. If `description` is non-empty after the existing scrubbers, leave it.
  2. Else, if a venue-name match (case-insensitive, after `stripVenueMealSuffix`) exists in the inline fallback DB for the city, copy that entry's `description`.
  3. Else, if `personalization.whyThisFits` is non-empty, copy it into `description`.
  4. Else, leave blank — UI fallback (layer 4) will handle it.
- Wire into the same boundary as `scrubActivity`: `validate-day`, `repair-day` §10b, `action-save-itinerary` `normalizeDays`. One log line `[DINING_DESC_BACKFILL] source=fallback|whyThisFits|noop count=N`.

### 3. Repair-day pass for already-saved trips
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add a small step (after §10b, before timing cascade) that runs `ensureDiningDescription` over all dining rows for the day and patches `itinerary_data` if any descriptions were filled. Sentinel `metadata.repair.dining_desc_backfilled = N`.
- This covers existing trips when the user opens / refreshes the day.

### 4. UI fallback (defense-in-depth, covers trips that never re-save)
- `src/components/itinerary/EditorialItinerary.tsx:11202` and `LiveActivityCard.tsx:175`:
  - Compute `descText = sanitizeActivityText(activity.description) || sanitizeActivityText(activity.personalization?.whyThisFits)`.
  - Render the same `<p>` block when `descText` is truthy.
  - No new copy, no new component — strictly a fallback chain.
- Mirror the same fallback chain in `FullItinerary.tsx`, `FullPreviewItinerary.tsx`, and `LiveItineraryView.tsx` if they have the same render pattern (will verify during implementation; expected to be 1-line edits).

### Tests

- New `supabase/functions/_shared/__tests__/dining-description-backfill.test.ts`:
  - LLM-empty + venue in inline DB → filled from inline DB.
  - LLM-empty + venue NOT in inline DB + whyThisFits present → filled from whyThisFits.
  - LLM-empty + nothing else → left blank (UI handles it).
  - Non-dining activity → untouched even if description empty.
  - Dining card with existing good description → untouched.
- New `src/components/itinerary/__tests__/foodCardDescriptionFallback.test.tsx`:
  - Empty `description`, populated `personalization.whyThisFits` → renders the whyThisFits text.
  - Both empty → no `<p>` rendered (no broken layout).

### Out of scope
- `verified_venues.description` column — bigger refactor; the inline-fallback name match in step 2 covers the common case and is reversible.
- Sightseeing / wellness / shopping description gaps — same root cause but user asked specifically about food cards. The schema change in step 1 helps everywhere; backfill steps 2-4 are intentionally dining-only.
- Tone/quality of LLM descriptions — separate prompt tuning task.

## Files

- edit `supabase/functions/generate-itinerary/generation-core.ts` (schema)
- new  `supabase/functions/_shared/dining-description-backfill.ts`
- new  `supabase/functions/_shared/__tests__/dining-description-backfill.test.ts`
- edit `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (wire pass)
- edit `supabase/functions/generate-itinerary/pipeline/validate-day.ts` (wire pass)
- edit `supabase/functions/generate-itinerary/action-save-itinerary.ts` (wire in `normalizeDays`)
- edit `src/components/itinerary/EditorialItinerary.tsx` (UI fallback)
- edit `src/components/itinerary/LiveActivityCard.tsx` (UI fallback)
- edit `src/components/itinerary/FullItinerary.tsx`, `FullPreviewItinerary.tsx`, `LiveItineraryView.tsx` (verify + UI fallback)
- new  `src/components/itinerary/__tests__/foodCardDescriptionFallback.test.tsx`
- edit `.lovable/plan.md`

Memory candidate (post-implement): `mem://constraints/itinerary/dining-description-backfill` — "Dining cards must always render a 'why this place' line; ensureDiningDescription backfills from inline DB → whyThisFits at validate/repair/save; UI falls back to whyThisFits."