## Hero Image — Cross-City Geo-Mismatch Guard (Morocco + reuse gates)

### Root cause

`Trips.destination = 'Casablanca'` has no seeded hero, no `destinations.hero_image_url`, no DB curated row. Live edge fetch (`destination-images`) returns:

```
id: reuse-e4571ab4-…    place_id: ChIJz7FTJ4TSpw0ROXEneo0Yctg
alt: "Ancienne Medina"  source: curated   destination: Casablanca
```

So the cache row is *labelled* Casablanca/Ancienne Medina, but its photo content is the recognizable blue alley of Chefchaouen (350 km north of Casablanca). Two compounding holes:

1. **No Morocco entries in `COUNTRY_CITY_TOKENS`** (`src/lib/crossCityFilter.ts` + `supabase/functions/generate-itinerary/cross-city-filter.ts`). Even if alt_text *had* said "Chefchaouen", the cross-city detector wouldn't have fired — Morocco isn't covered.
2. **No cross-city sanity gate on the image-resolution paths.** Three reuse paths in `supabase/functions/destination-images/index.ts` return rows by fuzzy alt_text/entity_key match without checking whether the matched venue actually belongs in the requested destination's city:
   - TIER 1c — 6-month destination reuse (line ~1539)
   - TIER 1.5 — cross-share lookup in `attractions`/`activities` tables (line ~1584)
   - `tryUnsplashFallback` `Casablanca landmark` (Unsplash relevance returns Chefchaouen). This is already neutralised on the *display* side by `isUntrustedHeroUrl`, but the edge function still pays for the call and may write a bad row to disk that later gets reused via place_id by other code paths.

Same bug class as the Montreal "alpine lake" hero — content-misidentified images survive because nothing validates content vs. destination after resolution.

### Fix (4 layers)

**1. Country-token coverage — Morocco (and a few other recurring blanks)**

Add to both `COUNTRY_CITY_TOKENS` mirrors and their `inferCountry` switches:
- morocco: Casablanca, Marrakech, Fez/Fes, Rabat, Tangier/Tanger, Chefchaouen, Essaouira, Agadir, Meknes
- turkey: Istanbul, Ankara, Izmir, Antalya, Cappadocia
- india: Delhi, Mumbai, Jaipur, Agra, Goa, Bengaluru, Kolkata, Chennai
- thailand: Bangkok, Chiang Mai, Phuket, Krabi
- vietnam: Hanoi, Ho Chi Minh / Saigon, Hoi An, Da Nang
- brazil: Rio de Janeiro, São Paulo, Salvador, Brasília
- argentina: Buenos Aires, Mendoza, Bariloche
- mexico (for safety in `client mirror`): Mexico City/CDMX, Cancun, Tulum, Oaxaca, Guadalajara, Mérida

Keep existing entries; this is purely additive.

**2. Cross-city gate inside the edge resolver**

In `supabase/functions/destination-images/index.ts`, when `entityType === 'destination'`:

- TIER 1c reuse loop: before returning a `reusable` row, run `detectCrossCityMention(reusable.alt_text + ' ' + reusable.entity_key, destination)`. If non-null → skip that row, continue scanning, and log `[Images] cross-city reuse blocked: alt="X" dest="Casablanca" → "Chefchaouen"`.
- TIER 1.5 attractions/activities lookups: same guard on `name`.
- `getGooglePlacesPhoto`: after the Places `searchText` resolves, check `result.formattedAddress || result.displayName` against the destination — drop and try the next candidate on mismatch.
- `tryUnsplashFallback`: check `best.alt_description + ' ' + best.description` against destination; reject on cross-city mention so we don't burn an Unsplash request *and* a storage write on a wrong-content photo.

Import `detectCrossCityMention` from the existing shared `cross-city-filter.ts` (it already lives next door in `generate-itinerary/`); promote it to `_shared/` if cleaner.

**3. Read-time gate at every hero consumer**

In `useTripHeroImage` (TIER 4 API branch), `useDestinationImages` (TIER 3 API branch), and `DestinationHeroImage` (TIER 3 API branch): after the API resolves, run `detectCrossCityMention(result.alt || '', destination)` and treat a hit as `apiFailed = true` so the chain falls through to gradient instead of rendering a wrong-city photo. Read-time defense in depth so a stale curated DB row doesn't slip through if the edge gate misses.

**4. One-shot cleanup**

Migration:
- Blacklist the two Casablanca rows in `curated_images` keyed on the offending `place_id ChIJz7FTJ4TSpw0ROXEneo0Yctg` so the `reuse-` lookup stops returning them. (`is_blacklisted = true`, `quality_score = 0`.)
- Sweep `curated_images` where `entity_type='destination'` and `detectCrossCityMention(alt_text, destination)` is non-null → blacklist. Implement as a SQL function or run from a one-shot Deno script invoking the helper, similar to the Montreal alpine-lake one-shot purge.
- Clear `trips.metadata.hero_image` for any trip whose stored URL points at a now-blacklisted row, so the next render re-resolves cleanly.

### Verification

- New unit test in `src/lib/__tests__/crossCityFilter.morocco.test.ts`:
  - `detectCrossCityMention('Chefchaouen blue alley', 'Casablanca')` returns `'Chefchaouen'`
  - `detectCrossCityMention('Hassan II Mosque', 'Casablanca')` returns `null`
  - `detectCrossCityMention('Marrakech medina', 'Fez')` returns `'Marrakech'`
- Edge integration test (or curl after deploy) on `Casablanca` returns a `source: 'gradient'` or a Casablanca-only hit.
- Smoke check on `Mexico City` / `Montreal` / `San Juan` to confirm no regression.

### Files to edit

- `src/lib/crossCityFilter.ts` (+ Morocco/Turkey/India/Thailand/Vietnam/Brazil/Argentina/Mexico tokens, expand `inferCountry`)
- `supabase/functions/generate-itinerary/cross-city-filter.ts` (mirror)
- `supabase/functions/destination-images/index.ts` (TIER 1c / 1.5 / Google Places / Unsplash gates)
- `src/hooks/useTripHeroImage.ts` (read-time API gate)
- `src/hooks/useDestinationImages.ts` (read-time API gate)
- `src/components/common/DestinationHeroImage.tsx` (read-time API gate via `apiData.alt`)
- `supabase/migrations/<ts>_blacklist_cross_city_destination_heroes.sql` (one-shot cleanup)
- `src/lib/__tests__/crossCityFilter.morocco.test.ts` (new)
- `mem://constraints/visual/hero-image-resolver-policy` (add cross-city gate clause)
- `mem://index.md` (update the existing entry's one-liner)
