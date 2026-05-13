## Problem

Hero image renders correctly in-session (e.g., San Juan colonial photo) but reverts to a green gradient after refresh. Same pattern as Faro.

## Root cause

`useTripHeroImage` (src/hooks/useTripHeroImage.ts) has a write-back effect that persists the resolved image URL to `trips.metadata.hero_image`. It is gated by:

```ts
if (existing.hero_image) return;  // never overwrite
```

When a trip was originally seeded with a known-broken value (typically an `images.unsplash.com` CDN URL — the hook's *display* path explicitly skips these as "broken silently," see lines 193–199), the persistence path still sees a truthy `existing.hero_image` and bails. So:

- **In-session**: display path ignores the bad seeded URL, resolves a fresh canonical/DB/API image, and renders it.
- **Refresh**: seeded value is still the same broken Unsplash URL. Display path skips it again and re-resolves from scratch. If the API call is flaky (rate-limit, transient Google Places miss, network), the chain falls through to the gradient.

The good URL we already had in memory was never written back, so we keep paying the resolution cost — and the failure cost — on every load.

A secondary, related issue: the same skip happens if a previous resolution wrote back a URL that has since gone stale (signed Google Places URL expiring, etc.). There's no path to refresh it.

## Fix

Update the write-back effect in `src/hooks/useTripHeroImage.ts` to overwrite when the existing stored value is unusable or different from the freshly-resolved URL:

1. Compute `existingHero = existing.hero_image` as a string.
2. Treat as "needs replacement" when any of:
   - `existingHero` is empty/non-string
   - `existingHero` matches `images.unsplash.com` (the same broken-CDN check the display path uses)
   - `existingHero !== imageUrl` AND the current `source` is `'canonical'`/`'db_curated'`/`'api'` (i.e., we have something better than what's stored)
3. If none of those, keep current short-circuit (don't churn writes).
4. Keep the existing guards: skip when `source === 'seeded'` or `'gradient'`, skip data: URLs, keep `persistedRef` so we write at most once per mount.

Extract the Unsplash-broken check into a small shared helper at the top of the file (`isBrokenSeededUrl`) so display (line 194) and persist use the exact same predicate — prevents future drift.

## Why this matches the Faro fix pattern

Faro had the same symptom and was fixed by ensuring resolved images get persisted to permanent storage (mem reference: lovable-stack-overflow note about temporary URLs not being saved). This is the trip-metadata equivalent: the resolution succeeded but the write-back was silently suppressed by an over-eager "don't overwrite" guard.

## Files

- `src/hooks/useTripHeroImage.ts` — only file touched.

## Validation

- Refresh a trip whose `metadata.hero_image` is an `images.unsplash.com` URL → expect non-Unsplash URL written to metadata after first successful resolution; subsequent refreshes load instantly from the seeded slot (no API call, no gradient).
- Refresh a trip with no `metadata.hero_image` → unchanged behavior (write on first resolution).
- Refresh a trip already storing a good non-Unsplash URL → no churn write (idempotent).

## Out of scope

- No backend/edge changes.
- No schema changes.
- Not touching `DestinationHeroImage.tsx` or the `destinations.hero_image_url` write-back; those are a separate canonical layer working as intended.
