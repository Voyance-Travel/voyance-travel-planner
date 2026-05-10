## Goal

Add **Unsplash API** as a Tier 2b fallback in `destination-images` so destinations not in the hardcoded curated list (e.g. Tbilisi, Tashkent, La Paz) get professionally curated hero photos instead of Google Places' random user uploads. Unsplash is free (50 req/hr) and licensed for free use with attribution.

## Scope

**Backend (1 file):** `supabase/functions/destination-images/index.ts`
**Frontend (1–2 files):** the destination hero renderer (`src/hooks/useTripHeroImage.ts` + its consumer) — surface attribution
**Secret:** `UNSPLASH_ACCESS_KEY` (will be requested via `add_secret` once user confirms)

## Backend changes (`destination-images/index.ts`)

### 1. Extend `DestinationImage` shape (line 14–27)

Add `'unsplash'` to the `source` union, plus optional attribution fields:

```ts
source: "curated" | "google_places" | "tripadvisor" | "wikimedia" | "lovable_ai" | "fallback" | "unsplash";
photographer?: string;
photographer_url?: string;
source_url?: string;
```

### 2. New helper `tryUnsplashFallback(destination)` (added near other tier helpers)

- `GET https://api.unsplash.com/search/photos?query={destination}+landmark&per_page=5&orientation=landscape&order_by=relevant`
- Header: `Authorization: Client-ID ${UNSPLASH_ACCESS_KEY}`
- Filter: `width >= 1920 AND likes >= 50`
- Pick highest-liked result; return `{ url: raw + &w=1920&q=80&fit=crop, photographer, photographer_url, source: 'unsplash', source_url, attribution: 'Photo by X on Unsplash' }`
- Returns `null` on missing key, network error, no quality matches

### 3. Insert tier in `fetchImageTiered` between TIER 1.5 (line ~1460) and TIER 2 Google Places (line 1462)

**Scope to `entityType === 'destination'` only** — Google Places is still preferred for real venue photos (restaurants, museums). Unsplash is for destination heroes where "iconic landmark" is the goal.

```ts
// TIER 2A: Unsplash (destination heroes only, free, professionally curated)
if (entityType === 'destination') {
  const unsplashImage = await tryUnsplashFallback(destination);
  if (unsplashImage) {
    candidates.push(unsplashImage);
    // Short-circuit further tiers — Unsplash quality is high enough for heroes
    await cacheImage(supabase, entityType, cleanName, destination, unsplashImage, 0.85);
    return unsplashImage;
  }
}

// TIER 2B: Google Places (existing) — runs only if Unsplash returned nothing
```

### 4. Caching

Use the **existing `cacheImage` helper** (not raw insert) so TTL, normalization, and the alt-key alias stay consistent with all other tiers. Quality score `0.85` (above Google's typical, below curated DB).

### 5. Cost tracker

No tracker call needed — Unsplash is free. Add a structured log line `[unsplash] hit dest="${destination}" likes=${best.likes}` for observability.

## Frontend changes

### `src/hooks/useTripHeroImage.ts`

Extend the hook's return type to surface attribution:
```ts
{ imageUrl, source, attribution?, photographer?, photographer_url?, source_url? }
```
The fields are populated only when `source === 'unsplash'`. All other paths return `undefined`, so existing consumers are unaffected.

### Hero attribution UI

Locate the component rendering the destination hero (most likely a small section in `EditorialItinerary.tsx` or a dedicated `DestinationHero` block — confirmed during implementation via grep on `useTripHeroImage`). Add a small caption overlay in the bottom-right corner of the hero:

> Photo by [Photographer](photographer_url) on [Unsplash](source_url)

- Tailwind: `text-xs text-white/80 absolute bottom-2 right-3 hover:text-white`
- Renders only when `attribution` is present
- Rel: `noopener noreferrer` on both links (Unsplash API ToS requires UTM params on links — will append `?utm_source=voyance&utm_medium=referral`)

## Technical details

- **Unsplash ToS compliance:** must hotlink to the photographer profile and include `utm_source` / `utm_medium` query params. Built into the helper's URL construction.
- **Rate limit:** 50 requests/hour for the dev tier. With 90-day caching via `cacheImage`, real-world hit count stays well under the limit even at scale.
- **No Tier reordering for activities.** Venue/activity images still go Google → TripAdvisor → Wikimedia → AI — Unsplash isn't useful for "Hotel Métropole Tbilisi" but is great for "Tbilisi" itself.
- **Negative path:** if `UNSPLASH_ACCESS_KEY` isn't set, helper returns `null` immediately and the chain falls through unchanged. Safe to deploy before user adds the secret.

## Verification

1. Pre-deploy: confirm key set via `fetch_secrets`. If not, request via `add_secret` (only after user confirms in chat).
2. Hit `destination-images` with `destination=Tbilisi` (not in curated hardcoded list, not in DB). Expect `source: "unsplash"`, photographer field populated, image >1920px.
3. Second call within 90 days → `source: "curated"` (cache hit), no Unsplash request.
4. Hit with `destination=Paris` → `source: "curated"` (hardcoded), Unsplash never called.
5. Hit with a deliberately misspelled destination → falls through Unsplash (no quality results) into Google Places. Logs show `[unsplash] no quality results`.
6. Frontend: visit a Tbilisi trip, hero shows attribution caption with working links to photographer + Unsplash.

## Out of scope

- No changes to activity/venue image resolution.
- No changes to admin-curated DB workflow.
- No backfill of existing destinations already cached from Google Places (will refresh as 90-day TTLs expire).
- No new admin UI to vote/curate Unsplash results (existing curation tools work as-is once a row lands in `curated_images`).
