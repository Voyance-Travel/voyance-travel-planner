## What's actually happening

The Monaco trip hero is showing a **Gemini-generated AI image labeled "Hércules Port"** — not a real Monaco photo. It's also not the airplane bug from earlier; that's been cleared. Google API is working — but the destination-images pipeline is choosing a bad POI to query, then rejecting all of Google's real results, then falling all the way through to AI image generation.

## Root cause (verified via logs + DB)

1. `destinations.points_of_interest` for Monaco is `["Monte Carlo Casino", "Prince's Palace of Monaco", ..., "Hércules Port"]`.
2. `getDestinationPOI` sorts alphabetically with `localeCompare` and picks **`Hércules Port`** as the canonical POI (the `H` + accented `é` sorts to the top).
3. Hero search is run as `"Hércules Port landmark attraction Monaco"`.
4. Google Places v1 returns the right places — `Prince's Palace of Monaco`, `Monaco Hercules harbour`, etc. — verified in edge logs.
5. `calculateMatchScore(venueTokens, displayName)` does token-overlap matching against `"Hércules Port"`. None of Google's display names contain `Hércules` (accent + `é` token), so they all score `0.00` and are rejected with `[Images] Rejecting (low score 0.00)`.
6. Unsplash returns `no quality results for "Monaco"`. Wikimedia/TripAdvisor return nothing useful.
7. Pipeline falls through to `generateAIImage` (gemini-2.5-flash-image-preview) → returns a giant base64 PNG of a generic harbor/clouds tagged "Made with Google AI". That's the cloud image you see.

## Fix

Three small, scoped changes in `supabase/functions/destination-images/index.ts` (no DB schema changes):

### 1. POI selection: rank by quality, not alphabet
Replace `getDestinationPOI`'s alphabetical sort with a quality preference:
- Prefer POIs that contain a destination/landmark keyword (`palace`, `casino`, `cathedral`, `museum`, `garden`, `beach`, `square`, `tower`, `bridge`).
- Drop accent-only or single-word POIs from first-pick when better candidates exist.
- Keep deterministic ordering (still sorted, just with the keyword-bonus tier first) so cache keys stay stable.

For Monaco this picks `"Monte Carlo Casino"` or `"Prince's Palace of Monaco"` instead of `"Hércules Port"`.

### 2. Match scoring: accent-fold + city-name credit
In the loop at lines 548–600:
- Normalize both `venueTokens` and `displayName` with `.normalize('NFKD').replace(/\p{Diacritic}/gu, '')` before scoring so `Hércules` ↔ `Hercules` matches.
- Award a partial-match credit when `displayName` contains the destination name (e.g. "...of Monaco") even if POI tokens miss — these are the right place by definition for a destination-tier hero.

### 3. Retry with the bare destination name when the POI search yields zero candidates
If the POI-driven Google Places search returns no scored survivors AND we're resolving a destination hero, run one more search using just the destination name (`"Monaco landmark attraction"`) before falling through to AI generation. This is the safety net that guarantees Google Places gets a fair shot for any city we have a place_id-able name for.

## What this does NOT change

- Frontend resolver chain (`useTripHeroImage`) — unchanged
- DB tables, RLS, migrations — unchanged
- AI generation path — still exists as last resort, but won't be hit for cities with real Google Places coverage
- Other endpoints (activity images, hotel images) — unchanged

## Verification after deploy

1. Hard-refresh `/trip/0c8b2a37…` (Monaco) — hero should be a real photo of Monte Carlo Casino or Prince's Palace, served from `googleapis`/Places photo CDN.
2. Edge logs show `[Images] Found 7 POIs for Monaco, using canonical: Monte Carlo Casino` and at least one `Rejecting (low score …)` count drops to 0 for the chosen POI.
3. Spot-check 4 other accented-POI cities (Faro, São Paulo, Curaçao, Düsseldorf) — each gets a real photo, not a base64 AI placeholder.
4. `psql -c "SELECT count(*) FROM image_quality_log WHERE rejected_reason='low_score' AND created_at > now() - interval '1 hour'"` — sharp drop.

## Memory update

Refresh `mem://constraints/visual/destination-canonical-stock-fallback` (or add a sibling `destination-hero-poi-selection`) noting:
- Destination-hero POI selection MUST prefer landmark-keyword candidates over alphabetical first
- Match scoring MUST accent-fold both sides
- POI-driven search MUST fall back to bare-destination Google Places query before AI generation