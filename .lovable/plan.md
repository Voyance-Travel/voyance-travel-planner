# Fix: "Highly-rated neighborhood restaurant" placeholder bleeding into the budget

## Root cause (two-layer)

1. **Source of the string.** `supabase/functions/generate-itinerary/fix-placeholders.ts` defines a `GLOBAL_EMERGENCY_FALLBACK` for lunch/dinner with `name: "Highly-rated neighborhood restaurant"` and a real-looking `price` ($25 / $45). It is the last resort inside `resolveAnyMealFallback()` (city pool → city pool recycled → regional country pool → global). Venice IS mapped to Italy in `CITY_COUNTRY_MAP`, so the regional path *should* win — when this stub leaks through it means either the destination string handed to the resolver was empty / malformed, or the resolver was bypassed entirely (e.g. AI emitted that exact title and no guard caught it).

2. **Why the placeholder guards miss it.** `PLACEHOLDER_TITLE_PATTERNS` looks for `"... at a/the ..."` and `"... at a (bistro|brasserie|café ...)"`. `PLACEHOLDER_VENUE_PATTERNS` has `/^neighborhood\s+(restaurant|...)/i` but the venue is `"Highly-rated neighborhood restaurant"` — it starts with `Highly-rated`, not `neighborhood`, so every regex misses it. `isPlaceholderMeal()` returns `false`, `nuclearPlaceholderSweep()` does nothing, and the cost-snapshot pass at `generation-core.ts:3260` happily writes the $25/$45 price into `activity_costs` as a `reference`-source row that the budget treats as real.

So the bug is one bug with two failure modes: the stub itself shouldn't carry a paid venue name, and the placeholder detector should catch any "highly/top/well-rated …" name even if it does.

## Changes

### 1. Kill the paid global stub — emit an explicit "pick a restaurant" slot

In `supabase/functions/generate-itinerary/fix-placeholders.ts`:

- Remove `"Highly-rated neighborhood restaurant"` from `GLOBAL_EMERGENCY_FALLBACK`. Replace lunch/dinner/breakfast with sentinel objects flagged `needsVenuePick: true`, `price: 0`, `name: "Lunch — pick a restaurant"` / `"Dinner — pick a restaurant"` / `"Breakfast — pick a café"`.
- Update `FallbackRestaurant` type to carry an optional `needsVenuePick?: boolean`.
- `applyFallbackToActivity()` already writes `activity.title = "${mealLabel} at ${fallback.name}"`. When the fallback carries `needsVenuePick`, write `activity.title = fallback.name` (no `at`), set `activity.cost = { amount: 0, currency: 'USD' }`, set `activity.metadata.needsVenuePick = true`, set `activity.metadata.unverified_venue = true`. Mirrors the client behavior in `src/utils/mealGuard.ts`.

### 2. Harden the placeholder detector (defense in depth)

Same file, `PLACEHOLDER_VENUE_PATTERNS` and `PLACEHOLDER_TITLE_PATTERNS`:

- Add `/(highly|top|well)[-\s]rated\s+(neighborhood\s+)?(restaurant|café|cafe|bistro|trattoria|spot|eatery|venue|place)/i` to both arrays.
- Add `/^pick a (restaurant|café|cafe)$/i` to venue patterns so any "pick a restaurant" stub is recognized as not-a-real-venue (so cost layer can suppress it).
- Add a unit-test row in `fix-placeholders.test.ts` for `"Lunch at Highly-rated neighborhood restaurant"` and the new `"… — pick a restaurant"` shape.

### 3. Suppress cost for unverified meal slots

In `supabase/functions/generate-itinerary/generation-core.ts` (Stage 6 cost-snapshot pass, near line 3260):

- Before writing each row, if the activity is `category === 'dining'` AND (`metadata.needsVenuePick === true` OR `metadata.unverified_venue === true` OR the title/venue matches `isPlaceholderMeal()` OR matches the new "highly/top-rated …" regex), force `cost_per_person_usd = 0`, `source = 'unverified_meal'`, `confidence = 'low'`. Mirrors the existing wellness-unverified rule from the core memory ("unverified wellness slots always snapshot $0").
- Same activity is excluded from the post-gen budget-validation scaling (it's already $0).

### 4. Mirror the client guard

`src/lib/fallbackRestaurants.ts` already returns `null` from `GLOBAL_EMERGENCY` (no string leak), so the client side is fine. Add the same hardened regex to `src/utils/wellnessPlaceholderDetection.ts`-style meal detector if one exists, OR if the meal coach has its own copy, so editor UI and budget UI both flag this venue as "Pick a restaurant" instead of rendering the stub as a real line item.

### 5. One-shot data repair (optional, safe)

For trips already saved with this stub, add a small idempotent SQL migration:

```sql
UPDATE public.activity_costs ac
SET cost_per_person_usd = 0,
    source = 'unverified_meal',
    notes = COALESCE(ac.notes, '') || ' [auto-zero: highly-rated stub]'
FROM public.trips t
WHERE ac.trip_id = t.id
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(t.itinerary_data->'days', '[]'::jsonb)) AS d(day),
         jsonb_array_elements(COALESCE(d.day->'activities', '[]'::jsonb)) AS a(act)
    WHERE a.act->>'id' = ac.activity_id
      AND (
        a.act->>'title' ILIKE '%highly-rated%'
        OR a.act->'location'->>'name' ILIKE '%highly-rated neighborhood%'
      )
  );
```

This corrects the user's current Venice budget without forcing a regeneration.

## Verification

1. Unit test: `nuclearPlaceholderSweep` must replace `{title: "Lunch at Highly-rated neighborhood restaurant"}` (currently passes through untouched).
2. Unit test: `resolveAnyMealFallback("Atlantis", "lunch", ...)` returns a `needsVenuePick: true` sentinel (no paid venue).
3. Manual: regenerate Venice trip; budget shows the lunch slot at $0 with a "Pick a restaurant" CTA, not "$25 at Highly-rated neighborhood restaurant". The user's existing trip is repaired by the migration in step 5.

## Out of scope

- Changing the AI prompt — already says "no generic names". Defense in depth is the goal here.
- Reworking `mealGuard.ts` client logic, which already emits `needsVenuePick` correctly.
