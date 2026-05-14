## What's actually happening

Trip `667e1456` (Budapest, status=`partial`) has:

| Source | Day 1 | Day 2 | Day 3 |
|---|---|---|---|
| `itinerary_data.days` (JSON, canonical) | 13 acts | 9 acts | 2 acts |
| `itinerary_activities` table | ~46 rows | ~30 rows | ? |

The table is massively bloated with leftovers from prior generation passes:
- Day 1 has the same "Travel to Marriott" / "Return to Your Hotel" rows duplicated 5–10×
- Day 1 has TWO lunches (Mazel Tov 12:30 + Kőleves 14:27) and TWO check-ins to the same hotel
- Day 2 has TWO breakfasts (Gerbeaud 09:10 + Börze 08:30) and TWO dinners
- Day 3 JSON has only 2 cards (almost certainly stale from a `partial` status)

On first paint, `TripDetail` runs the **sparse-JSON resync probe** (line 1369) and rebuilds `itinerary_data.days` from `itinerary_activities` — Day 3 trivially trips the 60% count gate, Days 1–2 trip the `mealDrift` gate (table has more meal rows than JSON). Recovery picks the per-row source, persists with `allowFrozenWrite + allowReduction`, and you see meals + orphans + departure-day artifacts that aren't in the canonical JSON.

On reload, the canonical JSON (now overwritten by the rebuild) should be sticky — but the rebuild source itself is the dirty `itinerary_activities` table, so each rebuild re-shuffles which dup wins. The "lost" meals on reload are the duplicate meals (Mazel Tov vs Kőleves, Gerbeaud vs Börze) that the per-row dedupe key never collapsed because their `start_time` differs.

So the bug isn't "rendering state lost on reload" — it's "the resync path keeps grafting stale duplicates on top of canonical JSON and the result is non-deterministic across loads."

## Why the existing dedupe doesn't catch it

`dedupeKey = start_time|end_time|category|lower(title)` only collapses **exact** duplicates. It cannot:
- Collapse two lunches with different times on the same day → both survive → mealDrift fires forever
- Collapse "Travel to Budapest Marriott Hotel" 09:05 vs 11:10 (those are real distinct legs but pre-fix-timing artifacts)
- Recognize that Day 3 JSON having 2 cards is the **canonical truth** for a `partial` trip, not a bug to heal

## Plan

### 1. Stop healing partial / generating trips from the table

In `src/pages/TripDetail.tsx` around line 1367, gate the entire sparse-JSON probe + rebuild on `itinerary_status === 'ready' || 'generated'`. For `partial`, `generating`, `pending`, `failed` the table is stale-write territory; the JSON is what the user just edited / what the generator will replace. Today the gate fires even on `partial` (this trip's status), surfacing pre-repair garbage.

### 2. Strengthen the meal-drift detector

When deciding per-day mealDrift (line 1429), require **slot-aware** comparison:
- Bucket meal rows by slot (breakfast / brunch / lunch / dinner) using title regex + time window
- Trigger only when the JSON is missing a *slot* the table has, not when the table has **more** meals than JSON in the same slot (two lunches = two duplicates, not "one missing")
- This stops the rebuild from re-injecting Mazel Tov when JSON kept Kőleves (and vice-versa)

### 3. Make rebuild deterministic across loads

In the rebuild path (line 1488 `dedupeRows`), upgrade the dedupe key for transit/return rows to ignore `start_time` when title + category + venue match (i.e. collapse 7 "Return to Your Hotel" with 7 different times into 1). Today every distinct timestamp survives, which is why "orphan cards" appear on first load and vanish on reload after one rebuild has overwritten JSON.

### 4. One-shot table cleanup for this trip (and any like it)

Run a scoped DELETE migration:
- Within `(trip_id, itinerary_day_id)`, for rows with identical `(category, lower(title))`, keep `MIN(sort_order)` and delete the rest
- Specifically targets the 5–10× "Return to Hotel" / "Travel to Marriott" pollution
- Preview rows first; do not touch user-locked rows (`is_locked = true`)

### 5. Tell the user what to expect

After ship: a single reload will rebuild Day 3 from the (now-deduped) table once, then JSON is canonical and stable. Day 1/2 will keep whichever lunch/breakfast was in the JSON; the duplicate "ghost" meal won't reappear.

## Files touched

- `src/pages/TripDetail.tsx` — gate sparse probe on status; slot-aware meal-drift; stronger transit/return dedupe key
- New migration `supabase/migrations/<ts>_dedupe_itinerary_activities.sql` — one-shot cleanup keyed on `(trip_id, itinerary_day_id, category, lower(title))` excluding `is_locked`
- No edge-function changes; no schema changes

## Out of scope

- Refactoring how generation writes to `itinerary_activities` (the table-write path is correct; the pollution is historical)
- The Days/Hotel/Trip-Total header math from the previous turn — independent issue
