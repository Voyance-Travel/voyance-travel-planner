## Plan

You’re right: this is not primarily a compact-card/UI issue. I checked the saved Hong Kong trip data directly and found dining rows with `description` literally empty in `trips.itinerary_data`:

- Day 3 `Breakfast: Maison Eric Kayser` → `desc_len = 0`
- Day 3 `Lunch: Ho Lee Fook` → `desc_len = 0`

So the renderer can’t show cuisine/dish copy because the persisted activity JSON sometimes has no description. Day 2 in the current saved Hong Kong record does have descriptions for Fineprint / Kau Kee / Caprice, which means the bug is intermittent by generation path/day, not just a card-size issue.

### Root cause to fix

The rich description fill exists, but it is not guaranteed at the single final persistence boundary.

Current problem:

```text
Some generation paths/day repairs fill descriptions
        ↓
Other generation-core final-save path can persist blank dining descriptions
        ↓
UI receives activity.description = ""
        ↓
Dining card has no cuisine/dish/ordering copy
```

The existing helper `fillMissingDescriptions` can write rich copy like “Order the…” / “Try the…”, but `generation-core.ts` only calls post-meal-guard fill in one specific branch. If the LLM simply emits a normal dining card with a blank description, and that card wasn’t injected by the meal guard, it can reach `persistTripItinerary` blank.

## Implementation steps

### 1. Add a final rich dining-description fill before final generation save
- In `supabase/functions/generate-itinerary/generation-core.ts`, immediately before the final `persistTripItinerary(..., label: 'final-save')`, run `fillMissingDescriptions` across every day’s activities.
- This catches normal dining cards that were not meal-guard injections.
- Keep the existing 8s/day timeout and non-blocking behavior.

### 2. Add deterministic persistence-boundary protection
- In `supabase/functions/_shared/persist-itinerary.ts`, import/run `ensureDayDiningDescriptions` for every day before writing `trips.itinerary_data`.
- This is the “never persist blank dining description” safety net for all write paths, including future regressions.
- Use each day’s `cityName` / `city` when available, falling back to trip destination.

### 3. Improve the deterministic fallback enough to be useful
- Update `supabase/functions/_shared/dining-description-backfill.ts` and frontend mirror `src/lib/itinerary/diningDescriptionFallback.ts` so the last-resort fallback is not just “book ahead.”
- It should include venue + meal type + safe cuisine cue when inferable from category/title/location, without inventing fake signature dishes.
- Example: “Use this breakfast stop at Maison Eric Kayser for French bakery staples; ask what came out of the oven most recently.”

### 4. Keep the UI fallback as a final display-only guard
- Leave `resolveActivityDisplayDescription` wired in `EditorialItinerary.tsx`.
- Do not rely on UI as the real fix; it remains only a display safety net for legacy/unsaved data.

### 5. Verification
- Add/adjust targeted tests so a generated itinerary with blank dining descriptions is filled before final persistence.
- Verify with a database-shaped sample that `persistTripItinerary` mutates blank dining rows to non-empty descriptions.
- Confirm the specific Hong Kong pattern can no longer save Day 3 breakfast/lunch with `description = ''`.

## Separate issue

The text `Loading... Finding restaurant...` is from `RestaurantLink.tsx` and is URL lookup/loading state, not the meal description. I won’t treat that as the main fix here; the priority is making `activity.description` present before save.