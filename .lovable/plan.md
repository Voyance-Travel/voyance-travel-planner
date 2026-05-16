# Why Mallorca shows the purple block (root cause confirmed)

The `destinations` table is a red herring on this one. The real cause is in `curated_images`:

```
entity_type=destination  entity_key="alcudia old town"  destination=Mallorca
source=no_result         image_url=NULL                 expires_at=2026-06-11
```

A previous lookup for "Alcudia Old Town" hit Google Places, got 0 results, and the edge function persisted a **`no_result` sentinel with a 30-day TTL**. Every subsequent visit reads that cached null and short-circuits — never calls Google, never falls back to the city ("Mallorca"), so `useTripHeroImage` exhausts every tier and the gradient placeholder paints.

There is no city-level `entity_key="mallorca"` hero row. The 2026-05-14 destinations-table backfill memory entry is misleading: only 94/2,246 rows ever had a canonical hero. The cache *was* the source of truth and a single bad POI poisoned it.

# Goal

Restore the original "Google pull → cache → serve" model and guarantee no destination ever renders a colored block or generic static.

# Plan

## 1. Stop letting a `no_result` cache entry block real photos

In `supabase/functions/destination-images/index.ts`:

- **Read path** — when a `curated_images` row is found with `source='no_result'`, treat it as a miss for `entity_type='destination'` after 24 hours (not 30 days). For `entity_type='activity'` keep the longer TTL (those are genuinely obscure venues).
- **Write path** — never cache `no_result` for `entity_type='destination'` until we've also tried (a) the bare destination string, (b) Unsplash with the destination name, and (c) Google Places with `destination + " landmark"`. Only cache null after all three miss; even then cap TTL at 24h.

## 2. Always fall back from POI to city

The current code passes `entityKey="alcudia old town"` and never tries `entityKey="mallorca"` when the POI misses. Add a deterministic fallback inside the destination branch of the resolver: if POI lookup yields no real image, recurse once with `cleanName = destination`. Cache the success under both keys so the next "Alcudia Old Town" hit serves the Mallorca city photo instead of repaying.

## 3. Make the client cascade actually reach the API on first paint

`useTripHeroImage` waits on `canonicalFetched && dbCuratedFetched` before calling the API. For destinations whose canonical is null AND whose DB-curated row is `no_result`, the API tier still has to fire. Confirm by passing `?force=1` when the DB-curated tier returned a `no_result` sentinel (we'll surface that flag from the new helper) so the edge function re-runs Google instead of replaying the cached null.

## 4. Trip-level fallback for the hero strip itself

`DestinationHeroImage.tsx` and the trip-detail purple band currently render a solid gradient when `imageUrl` is null. Replace that branch with a **shared bucket fallback**: pick from a small set of pre-uploaded country/region heroes in the existing `destination-images` storage bucket (Spain, France, Italy, Japan, USA, generic-coast, generic-city). Match by `destinations.country`. Worst case the user sees a real Spanish coastal photo for Mallorca, never a flat color. Only one storage read, no Google spend.

## 5. Backfill / unstick existing trips

One `UPDATE` to clear the `source='no_result'` rows for `entity_type='destination'` so the next page-load triggers a real Google fetch under the new logic. Also nullify the bad sentinels for the recurring offenders we've seen (Mallorca, Casablanca, La Palma, anything matching the pattern).

## 6. Update memory

Rewrite `mem://constraints/visual/destination-canonical-stock-fallback` to reflect the actual architecture:

> Hero images flow Google Places → `curated_images` cache → UI. `destinations.hero_image_url` is an opportunistic write-back, never a source of truth. `no_result` rows for `entity_type='destination'` are capped at 24h TTL and skipped on read once the POI fallback to the city name is exhausted. UI must always render a real image — gradient placeholders are forbidden.

## Technical notes

Files touched:

- `supabase/functions/destination-images/index.ts` — TTL cap, POI→city fallback, `force` flag.
- `src/services/destinationImagesAPI.ts` — return `wasNoResult` from `getDbCuratedUrl`; pass `force=true` on the next API call.
- `src/hooks/useTripHeroImage.ts` — wire `force=true` and add a final "country bucket" tier.
- `src/components/common/DestinationHeroImage.tsx` (and the purple band in trip-detail header) — replace gradient with bucket fallback.
- One Supabase migration: `DELETE FROM curated_images WHERE entity_type='destination' AND source='no_result'`.

Out of scope:
- Re-introducing a static `CURATED_DESTINATION_IMAGES` map.
- Mass pre-warming Google Places for all 2,246 destinations (we let usage drive the cache, as before).
- Changing itinerary generation.
