## Two related defects, both presentation-layer leaks

The backend has solid guards for both issues — `isPlaceholderWellness` + nuclear wellness sweep in `fix-placeholders.ts` / `repair-day.ts`, and `enforceDayTitleCoherence` in `pipeline/coherence-day-title.ts`. But trips generated/stored before those guards ran (or paths that bypass them — refresh-day, manual edits, stored DB rows) still surface placeholders to users. The "Café Matinal" fix proved we need client-side mirrors of these guards.

---

### Issue 1 — Unnamed wellness venue placeholders

Titles like "Glow & Wellness Facial Ritual", "Private Wellness Refresh", "Personalized Wellness Treatment" appear with no spa name or address. They match `GENERIC_WELLNESS_TITLE_PATTERNS` server-side but slip through on the client when the underlying record is already saved.

**Fix (frontend-only):**

1. Create `src/utils/wellnessPlaceholderDetection.ts` — port the `GENERIC_WELLNESS_TITLE_PATTERNS` regex set from `supabase/functions/generate-itinerary/fix-placeholders.ts`, plus a small `isClientPlaceholderWellness(activity)` checker. Real-venue evidence (numeric address, placeId, `unverified_venue === false`, or a known `INLINE_FALLBACK_WELLNESS` name from a small mirrored allowlist) short-circuits to `false`.
2. Extend `sanitizeActivityName` in `src/utils/activityNameSanitizer.ts`: when the sanitized name matches a wellness placeholder AND the activity has no real venue evidence, return `"Spa Time — find a venue"`. Pass full activity context (location/metadata) via a new optional `opts.activity` field; existing call sites continue to work.
3. Update `sanitizeActivityText` to strip the leading sentence when the title was masked, so descriptions like "A 60-min personalized facial ritual…" don't dangle.
4. Patch the same surfaces already updated for stub venues — `EditorialItinerary.tsx`, `LiveActivityCard.tsx`, `TripActivityCard.tsx`, `CustomerDayCard.tsx`, `ItinerarySummaryCard.tsx`, `MyLockedActivities.tsx`, `BookableItemCard.tsx`, `ItineraryPreview.tsx` — to forward the activity object so the wellness mask can fire.
5. Booking guard: in `BookableItemCard.tsx`, if `isClientPlaceholderWellness` is true, hide the "Book" CTA and show a small "Pick a spa first" hint that opens the activity-concierge chat.

### Issue 2 — Day 4 title / content mismatch

`enforceDayTitleCoherence` already exists but is only invoked at generation time; previously-saved days and post-edit days don't get re-evaluated, so a stale title leaks through.

**Fix (frontend-only):**

1. Create `src/utils/dayTitleCoherence.ts` — a minimal client port of the server's `isCoherent` + `deriveTitle` (no LLM, pure tokens). Reuses the same logistics regex, stopword set, neighborhood/headline derivation, and category vibe labels.
2. Add `getDisplayDayTitle(day, city)` that returns either the original title (if coherent or generic-allowed) or a derived one. Does NOT mutate the stored day — purely a display helper.
3. Patch render paths to use the helper:
   - `src/components/planner/CustomerDayCard.tsx` — line 144 / 147 use `day.theme`
   - `src/components/itinerary/EditorialItinerary.tsx` day-section headers and the concierge `dayTitle`
   - `src/components/itinerary/LiveItineraryView.tsx` day headers
4. Behind the scenes, when the helper detects a mismatch, it logs a `console.warn('[client-day-title] …')` with the old → new title so we can quantify how often this fires (matches the server log format).

### Tests

- `src/utils/__tests__/wellnessPlaceholderDetection.test.ts`
  - Each of the three reported titles flagged when venue empty.
  - Same titles unflagged when `location.address` has a numeric street or `metadata.google_place_id` is set.
  - `sanitizeActivityName` returns `"Spa Time — find a venue"` for the placeholder cases and leaves real venues untouched.
- `src/utils/__tests__/dayTitleCoherence.test.ts`
  - Day with all activities in "Le Marais" but title "Montmartre Mornings" → relabels to a Marais-derived title.
  - Coherent title preserved.
  - Logistics-only day keeps the generic "Arrival in …" / "Day N in …" titles.

### Files

**New**
- `src/utils/wellnessPlaceholderDetection.ts`
- `src/utils/dayTitleCoherence.ts`
- `src/utils/__tests__/wellnessPlaceholderDetection.test.ts`
- `src/utils/__tests__/dayTitleCoherence.test.ts`

**Edited**
- `src/utils/activityNameSanitizer.ts` (wellness mask hook)
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/components/itinerary/LiveActivityCard.tsx`
- `src/components/itinerary/LiveItineraryView.tsx`
- `src/components/planner/CustomerDayCard.tsx`
- `src/components/planner/ItinerarySummaryCard.tsx`
- `src/components/planner/MyLockedActivities.tsx`
- `src/components/planner/TripActivityCard.tsx`
- `src/components/planner/steps/ItineraryPreview.tsx`
- `src/components/booking/BookableItemCard.tsx`

No backend or schema changes; both fixes are pure presentation-layer safety nets that mirror existing server logic.