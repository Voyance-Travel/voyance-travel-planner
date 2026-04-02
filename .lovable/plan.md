

## Standardize Hotel Accommodation Card Titles

### Problem

Accommodation activity titles are inconsistent because they originate from **5 different sources**, each using its own naming convention:

```text
Source                          → Title produced
─────────────────────────────── ─────────────────────────────────
AI generation (Day 1 early)    → "Luggage Drop & Early Exploration"
AI generation (Day 1 on-time)  → "Hotel Check-in & Refresh"
repair-day step 7 (Day 1)      → "Hotel Check-in & Refresh"
repair-day step 7 (transition) → "Hotel Check-in – Paris"
bookend makeAccomCard           → "Freshen up at Your Hotel"
                                  "Return to Your Hotel"
hotelItineraryPatch.ts          → "Check-in at Marriott"
                                  "Settle in at Marriott"
                                  "Freshen up at Marriott"
```

There is no normalization pass that runs **after** all sources (AI + repair + bookend + hotel patch) have contributed, so you get a mix of "Hotel Check-in & Refresh", "Check-in at Marriott", "Settle in at Hotel Name", and "Luggage Drop" across different days of the same trip.

### Solution — Add a Title Normalization Step

Create a new post-repair normalization function that runs after step 9 (bookends) and standardizes all accommodation card titles to a **canonical set of 5 intents**:

```text
Intent              → Canonical Title
──────────────────  ────────────────────────────
early-checkin       → "Luggage Drop at {hotel}"
checkin             → "Check-in at {hotel}"
freshen-up          → "Freshen Up at {hotel}"
return              → "Return to {hotel}"
checkout            → "Checkout from {hotel}"
```

### Changes

**1. `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**
- Add a new step **9b: ACCOMMODATION TITLE NORMALIZATION** after bookend injection
- Scans all `category === 'accommodation'` activities
- Classifies each by intent using keyword matching (same keywords already used in `hotelItineraryPatch.ts` and repair-day)
- Rewrites title to canonical format using the resolved hotel name
- Also normalizes `name` field to match `title`

**2. `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — Update `makeAccomCard`**
- Ensure the bookend helper already produces titles matching the canonical set (it mostly does — "Freshen up at" and "Return to" are fine)

**3. `src/services/hotelItineraryPatch.ts`**
- Align the patch titles to the same canonical set (minor — "Settle in" → "Check-in at", keep "Freshen up at" as-is)
- Remove "Settle in at" variant since it's not in the canonical set

**4. `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts`**
- Update Day 1 prompt text: change "Hotel Check-in & Refresh" to "Check-in at {hotelName}" for consistency
- Change "Luggage Drop & Early Exploration" to "Luggage Drop at {hotelName}"

### Files

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/pipeline/repair-day.ts` | Add step 9b title normalization; update step 7 injected titles to canonical format |
| `supabase/functions/generate-itinerary/pipeline/compile-day-schema.ts` | Update Day 1 prompt titles to canonical format |
| `supabase/functions/generate-itinerary/generation-core.ts` | Update rule 12 prompt text to use canonical titles |
| `src/services/hotelItineraryPatch.ts` | Remove "Settle in" variant; align to canonical set |

