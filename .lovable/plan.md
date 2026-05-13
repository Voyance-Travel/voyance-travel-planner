## Problem

Trip detail hero for Montreal renders an alpine lake with a wooden rowboat. Root cause: `src/utils/destinationImages.ts` contains a hardcoded `'montreal'` array of three `images.unsplash.com/photo-…` IDs labelled "Old Port / skyline / Notre-Dame" — the labels were never verified against the actual photo content, and at least the [0] entry shows generic Alpine scenery. The resolver in `useTripHeroImage` ranks this hardcoded curated list above the Google-Places API result that's actually keyed on the destination, so the wrong photo wins on every visit and gets written back to `trips.metadata.hero_image` and to `destinations.hero_image_url` as the canonical.

This pattern is not Montreal-specific. The hardcoded map in `destinationImages.ts` (~50 cities) is unverified labels on bare Unsplash photo IDs, and `images.unsplash.com` URLs are already flagged `isBrokenSeededUrl=true` for *seeded* values but trusted as *curated*. Same loop is shared by `useDestinationImages` and `DestinationHeroImage`.

## Fix

### 1. Re-rank the resolver chain (city-locality Places photo wins)

In `src/hooks/useTripHeroImage.ts` (and mirrored in `src/hooks/useDestinationImages.ts` + `src/components/common/DestinationHeroImage.tsx` for parity):

New priority:
1. Seeded `trip.metadata.hero_image` (if present and not `isBrokenSeededUrl`)
2. **DB canonical** `destinations.hero_image_url` (single source of truth, admin-vetted or verified-API)
3. **DB curated** `curated_images` table (admin-managed, voted)
4. **API fetch** via `destination-images` edge function (Google Places, locality-scoped)
5. Hardcoded `getCuratedImages(...)` from `destinationImages.ts` — demoted to **after API**, behind a `VERIFIED_CURATED` allowlist gate (empty by default)
6. Gradient

The hardcoded map stays in the file (no churn) but is only consulted when API also fails AND the destination key is in `VERIFIED_CURATED`. Net effect: unverified hardcoded photo IDs stop being served.

### 2. Treat `images.unsplash.com` as broken everywhere

Extend `isBrokenSeededUrl` (rename to `isUntrustedHeroUrl`, export from `src/lib/heroUrlPolicy.ts`) and apply it to:
- Seeded metadata hero (already done)
- `destinations.hero_image_url` reads (new)
- `curated_images.image_url` reads (new)
- API `getHeroImageByName` results (new — Places never returns unsplash but defensive)

Any URL flagged untrusted is skipped at read-time and the chain moves on. The existing write-back already overwrites stored bad values with the freshly-resolved good one, so trips self-heal on next visit.

### 3. One-shot DB purge

Migration: `UPDATE destinations SET hero_image_url = NULL WHERE hero_image_url ILIKE '%images.unsplash.com%';` and matching purge for `curated_images` rows (mark `is_blacklisted=true` rather than delete, so admin history stays). This makes existing trips re-resolve through Places on next view instead of waiting for an in-the-wild error.

### 4. Montreal one-line fix (immediate visual)

Remove the three Montreal entries from `CURATED_DESTINATION_IMAGES` (or leave them but they'll be gated off by step 1). Same for any other city where labels look like nature stock — but no manual audit; the policy in step 1 makes the audit unnecessary.

### 5. Telemetry

Add one `console.info('[hero-resolver] source=X destination=Y')` line at the point the resolved URL is selected, behind a build-time flag, so we can see in production logs which tier is winning for which city. No PII.

## Files

- `src/hooks/useTripHeroImage.ts` — new chain order, untrusted-URL guard at every tier
- `src/hooks/useDestinationImages.ts` — same chain order
- `src/components/common/DestinationHeroImage.tsx` — same
- `src/lib/heroUrlPolicy.ts` — new shared `isUntrustedHeroUrl`
- `src/utils/destinationImages.ts` — add `VERIFIED_CURATED` set (empty)
- `supabase/migrations/<ts>_purge_unsplash_hero_urls.sql` — null/blacklist `images.unsplash.com` rows
- `mem://constraints/visual/hero-image-resolver-policy` — new constraint, plus one-line Core entry

## Out of scope

- Re-curating per-destination photo lists by hand (the policy makes them unnecessary; admin can add to `curated_images` table when desired)
- Hero images on the marketing home page (`CinematicHero`, `heroImages.ts`) — those are intentional editorial choices, not destination-keyed
- Activity card images (`destination-images` for places, not localities) — different code path
- Rotating/multiple-image experiences

## Risk

After purge, first visit to a trip whose hero was previously cached will hit Places once (one paid call). Acceptable — Places is already the resolver's [TIER 3] today and is wrapped by the central Google call tracker. Subsequent visits use the canonical write-back.
