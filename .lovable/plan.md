## Bug

Day 1 card titled **"Lunch at Sagra Rooftop Restaurant"** but venue label reads **"Sagra Rooftop Restaurant (Breakfast)"**. The `(Breakfast)` suffix contradicts the lunch slot the venue was assigned to.

## Root cause

The `verified_venues` table contains 9 rows whose `name` column has a meal-type suffix baked into the venue name itself:

```
Sagra Rooftop Restaurant (Breakfast)
The Ivy-Market Grill (Breakfast)
Balikçi Sabahattin (Lunch)
Mikla Restaurant (Dinner)
Le Comptoir de la Gastronomie (Breakfast)
Granger & Co. Marylebone (Breakfast)
Mojito Restaurant & Bar (Breakfast)
La Terrazza Rooftop Bar (Breakfast)
Ciao Bella (Breakfast)
```

When the meal-pool picker reuses one of these venues for a different slot (Sagra Rooftop reused for lunch), the activity-title generator correctly emits "Lunch at Sagra Rooftop Restaurant" (it strips the parenthetical for the title), but `activity.location.name` is copied verbatim from the DB row, so the venue card label keeps `(Breakfast)`. No code path strips the suffix on read or render.

## Fix

### 1. Shared sanitizer (`supabase/functions/_shared/venue-name.ts` — new)
Export `stripVenueMealSuffix(name)` matching `/\s*\((breakfast|lunch|dinner|brunch)\)\s*$/i` and returning the trimmed name.

### 2. Strip on every venue read
Apply `stripVenueMealSuffix` to `name` immediately after fetching from `verified_venues` in:
- `supabase/functions/_shared/venue-cache.ts` (3 query sites)
- `supabase/functions/_shared/fill-gap.ts`
- `supabase/functions/_shared/verified-venues-filter.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (lookup at line ~338)
- `supabase/functions/generate-itinerary/action-generate-day.ts` (~1476/1484)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (~1687/1695)
- `src/utils/mealGuard.ts` (client-side fetch at line ~139)

### 3. Strip on save (last server gate)
In `action-save-itinerary.ts`, walk `itinerary_data.days[].activities[]` and clean both `activity.title`/`name` and `activity.location.name` via `stripVenueMealSuffix`.

### 4. Strip on UI render (last client gate)
In `src/utils/activityNameSanitizer.ts` add the same regex to both `sanitizeActivityName` and the lighter `sanitizeActivityText` chain so legacy stored data is cleaned at render time.

### 5. DB migration
- One-shot `UPDATE verified_venues SET name = regexp_replace(name, '\s*\((breakfast|lunch|dinner|brunch)\)\s*$', '', 'i') WHERE name ~* '\((breakfast|lunch|dinner|brunch)\)\s*$';` (9 rows).
- Handle dedup: if stripped name collides with an existing row in same city, keep the older row and delete the suffixed one (none expected for these 9, but include defensive `ON CONFLICT DO NOTHING` pattern).
- Add a `CHECK` constraint or `BEFORE INSERT/UPDATE` trigger that rejects names matching the suffix regex, so seeders can't reintroduce the bug.

### 6. One-shot trip-data backfill
`UPDATE trips SET itinerary_data = itinerary_data WHERE itinerary_data::text ~* '\((breakfast|lunch|dinner|brunch)\)'` to fire the existing `trips_scrub_prompt_artifacts` trigger — but extend that trigger first to also call the meal-suffix strip on all `title`/`name` text fields in the JSONB. Sentinel: `repair.action='stripped_venue_meal_suffix'` count in logs.

### 7. Tests
Add Deno test cases in `supabase/functions/_shared/__tests__/venue-name.test.ts`:
- `stripVenueMealSuffix("Sagra Rooftop Restaurant (Breakfast)") === "Sagra Rooftop Restaurant"`
- preserves `"Bar Canete (closed Sundays)"` and `"Sagrada Família (Exterior)"` (only strips meal labels, not arbitrary parentheticals)
- whitespace, mixed case, brunch variant

## Files touched
- `supabase/functions/_shared/venue-name.ts` (new)
- `supabase/functions/_shared/venue-cache.ts`, `fill-gap.ts`, `verified-venues-filter.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`, `action-generate-day.ts`, `action-generate-trip-day.ts`
- `src/utils/mealGuard.ts`
- `src/utils/activityNameSanitizer.ts`
- new migration: clean 9 rows + insert/update guard trigger + extend `scrub_itinerary_prompt_artifacts` to strip meal suffix from JSONB + one-shot backfill
- `supabase/functions/_shared/__tests__/venue-name.test.ts` (new)
- `mem://constraints/itinerary/venue-meal-suffix-strip` (new memory)
