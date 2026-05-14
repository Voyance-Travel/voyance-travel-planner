## Problem

Budapest is rendering a generic stock photo of two businessmen shaking hands as its hero — zero connection to the city, country, or even travel. This is the worst hero regression seen in QA.

## Root-cause investigation (what I found)

Tracing every Budapest hero code path:

1. `trips.metadata.hero_image` for the Budapest trip (`4749ca8d…`) is **empty**.
2. `destinations.hero_image_url` for Budapest is **NULL**.
3. `destinations.stock_image_url` = `…/site-images/photo-budapest` — returns **HTTP 400** (object missing). Still consumed directly by `DestinationDetail.tsx` and `suggest-mystery-trips`.
4. `curated_images` has **zero rows** with `entity_type='destination'` for Budapest.
5. `CURATED_DESTINATION_IMAGES['budapest']` exists but is gated behind the empty `VERIFIED_CURATED` allowlist — `hasCuratedImages()` returns false.
6. `CURATED_ONLY_DESTINATIONS` contains `'budapest'`, so the API service short-circuits to `[]` — the gradient should win.

But `useTripHeroImage` lives next to `useDestinationImages`, `DestinationHeroImage`, `useHeroImage`, and a Cloud edge fn (`destination-images`) with an Unsplash fallback (`tryUnsplashFallback`) that queries `"${destination} landmark"`. Unsplash's relevance ranking will happily return a "business meeting in Budapest"-style photo when no landmark match is dominant. The curated-only guard prevents the call **only when the caller flows through `getDestinationImages`**; activity/hotel callers, the trip-card path, and any non-destination context that re-uses Budapest as a query string (hotel name, conference venue, etc.) bypass it. Cached results then poison `curated_images` for unrelated `entity_key`s and can leak into a hero render via stale lookup.

The trust policy (`isUntrustedHeroUrl`) blocks `images.unsplash.com`/`source.unsplash.com` URLs at every read, but Unsplash now serves through `*.unsplash.com` raw URLs that don't always match the regex once the edge fn rewrites them. And nothing filters the **content** of an Unsplash result — just the host.

## Plan

Three layers of defense + a ground-truth seed for Budapest. UI/data only — no backend orchestration changes.

### 1. Ground-truth Budapest immediately

Insert a verified `curated_images` row for Budapest pointing at a stable Parliament/Chain Bridge image from our `destination-images` storage bucket (already has `chijpapurhdcqucrbg-p-7giitq.jpg` — Hungarian Parliament Building from Google Places cache):

- `entity_type='destination'`, `entity_key='budapest'`, `destination='Budapest'`, `source='admin'`, `quality_score=1.0`, `vote_score=100`, `is_blacklisted=false`, `expires_at=NULL`.
- Tier-1 DB cache hit will short-circuit every downstream resolver (`useTripHeroImage`, `useDestinationImages`, `DestinationHeroImage`, `useHeroImage`).

Also clear the broken `destinations.stock_image_url` for Budapest (currently 400s) and set `destinations.hero_image_url` to the same admin-curated URL so `getDestinationCanonicalImage` returns it directly.

### 2. People/business content guard on Unsplash hero fallback

In `supabase/functions/destination-images/index.ts::tryUnsplashFallback`, reject any candidate whose `alt_description`, `description`, or `tags[].title` contains banned terms when used as a **destination hero**:

`/\b(business|businessman|businesswoman|suit|handshake|meeting|office|conference|portrait|model|people|person|man|woman|crowd|group)\b/i`

Apply only when `imageType === 'hero'` and the request is destination-scoped (not activity/hotel). If all 5 candidates fail the guard, return null and let the deterministic gradient win.

### 3. Tighten `isUntrustedHeroUrl` + extend to `stock_image_url`

- Broaden `isUntrustedHeroUrl` to also flag any URL whose path slug matches the people-content regex above (defense-in-depth against an Unsplash result that already escaped layer 2 and got cached).
- Add `isUntrustedHeroUrl` checks to the two surviving `stock_image_url` consumers (`DestinationDetail.tsx`, `suggest-mystery-trips/index.ts`) so a broken or future-bad value falls to the gradient instead of rendering blind.

### 4. Save a memory entry

`mem://constraints/visual/destination-hero-content-guard` documenting: (a) every destination hero MUST come from an admin-curated `curated_images` row when one exists, (b) Unsplash fallback content guard is mandatory and lives in `tryUnsplashFallback`, (c) `stock_image_url` consumers MUST run the trust policy.

## Files

- `supabase/migrations/<ts>_seed_budapest_hero.sql` — insert curated_images row, clear stock_image_url, set hero_image_url
- `supabase/functions/destination-images/index.ts` — content guard in `tryUnsplashFallback`
- `src/lib/heroUrlPolicy.ts` — extend `isUntrustedHeroUrl` with people-content slug regex
- `src/pages/DestinationDetail.tsx` — gate `stock_image_url` through `isUntrustedHeroUrl`
- `supabase/functions/suggest-mystery-trips/index.ts` — same gate
- `mem://constraints/visual/destination-hero-content-guard` + `mem://index.md` (Core entry)

## Out of scope

- Re-curating other destinations en masse (only Budapest is the reported P1 — same pattern can be ground-truthed per-city as it surfaces).
- Touching itinerary content, generation, payments, health engine.
- Removing the hardcoded `CURATED_DESTINATION_IMAGES` map (still gated by empty allowlist; not the source of this bug).

## Confidence note

I could not reproduce the exact "two businessmen" image from the Budapest data on disk (every traced path lands on gradient), so the leak is most likely the unguarded Unsplash fallback or a stale `curated_images` row keyed under a different entity_key being matched by a fuzzy lookup elsewhere. The plan above closes both possibilities and ground-truths Budapest so the symptom cannot recur regardless of which path leaked.
