

## Fix: Move All Static Images to Internal Storage

### Problem

There are **~150+ hardcoded `images.unsplash.com` URLs** scattered across components and pages. These are NOT calling Google Places (so they don't add to the $470 bill), but they cause two real issues:

1. **The "thinking for a minute" delay you see on refresh** — each page load fetches images from Unsplash's external CDN. If their CDN is slow or rate-limits you, images appear delayed.
2. **The `normalizeUnsplashUrl` function explicitly passes them through** (line 63 of `unsplash.ts`) — it was written to NOT rewrite `images.unsplash.com` URLs to internal storage, so even components that call `normalizeUnsplashUrl` still hit external Unsplash on every page load.

You already have a `site-images` storage bucket with hero images in it. The fix is to route ALL static/decorative Unsplash URLs through that same bucket so they load from your own CDN instantly.

### Files with hardcoded Unsplash URLs (static images that never change)

| File | # of URLs | Usage |
|---|---|---|
| `src/utils/destinationImages.ts` | ~80 | Curated destination galleries |
| `src/pages/Destinations.tsx` | ~15 | Destination cards |
| `src/pages/About.tsx` | ~4 | "How it works" section |
| `src/pages/Contact.tsx` | ~2 | Hero + inspiration |
| `src/pages/SignIn.tsx` | ~3 | Auth hero |
| `src/pages/ForgotPassword.tsx` | ~2 | Auth hero |
| `src/pages/GuideDetail.tsx` | ~2 | Fallback covers |
| `src/components/home/CinematicHero.tsx` | 1 | Homepage hero |
| `src/components/home/HowItWorksCarousel.tsx` | 4 | Steps carousel |
| `src/components/profile/SurpriseTripCard.tsx` | 1 | Mystery card |
| `src/components/profile/RotatingCoverPhoto.tsx` | ~6 | Profile covers |
| `src/components/explore/SeasonalCollections.tsx` | 4 | Season cards |
| `src/components/explore/ExploreByStyle.tsx` | 6 | Style cards |
| `src/components/demo/DemoHero.tsx` | 3 | Demo cards |

### Plan

#### Step 1: Fix `normalizeUnsplashUrl` to rewrite ALL Unsplash URLs
Remove the pass-through on line 63 of `src/utils/unsplash.ts`. All `images.unsplash.com/photo-*` URLs will be rewritten to `site-images` bucket URLs using the existing `toSiteImageUrlFromPhotoId` function.

#### Step 2: Ensure all static image components use `normalizeUnsplashUrl`
For files that currently hardcode raw URLs without calling `normalizeUnsplashUrl` (most pages), wrap them through the function. This ensures they resolve to internal storage.

#### Step 3: Bulk-upload missing photos to `site-images` bucket
Write a one-time script to extract all unique `photo-*` IDs from the codebase, check which ones are missing from the `site-images` bucket, and download them from Unsplash into storage. This is a one-time operation.

#### Step 4: Verify no external image calls on static pages
After changes, static pages (Home, About, Contact, Sign In, Destinations) should load zero external image requests.

### Result
- All static/decorative images load from your own CDN — instant, no external dependency
- The "thinking for a minute" delay on refresh goes away
- Zero risk of Unsplash rate-limiting or URL changes breaking your site
- No cost impact (Unsplash CDN is free, but internal is faster and more reliable)

