

## Plan: Connect Admin Curated Images to Destination Hero Display

### The Gap

There are **two separate curated image systems** that don't talk to each other:

1. **Hardcoded map** (`CURATED_DESTINATION_IMAGES` in `destinationImages.ts`) — ~65 destinations with Unsplash URLs baked into the code. Used for destination hero images.
2. **Database table** (`curated_images`) — written by the AddCuratedImage admin tool. Used by the `destination-images` edge function for activity images only.

When you add a destination image via the admin tool, it goes into the DB but the hero image system never checks the DB — it only checks the hardcoded map.

### Solution: Make the hero image system check the `curated_images` DB table

#### Change 1: Add DB-curated lookup to `useDestinationImages` hook

**File**: `src/hooks/useDestinationImages.ts`

Before falling back to the API, query the `curated_images` table for `entity_type = 'destination'` matching the destination name. This means any image you add via the admin tool immediately appears as the hero image.

Priority chain becomes:
1. Hardcoded curated images (instant, no network)
2. **DB curated images** (fast query, admin-managed) ← NEW
3. API fetch (Google Places via edge function)
4. Gradient fallback

#### Change 2: Same DB lookup in `useTripHeroImage` hook

**File**: `src/hooks/useTripHeroImage.ts`

Insert the same DB-curated check between step 2 (curated) and step 3 (API) in the fallback chain.

#### Change 3: Add Casablanca + missing cities to hardcoded list as immediate fix

**File**: `src/utils/destinationImages.ts`

Add entries for: `casablanca`, `istanbul`, `prague`, `budapest`, `zurich`, `munich`, `edinburgh`, `dublin` — these are commonly visited cities currently missing from the curated map.

**File**: `src/services/destinationImagesAPI.ts`

Add the same cities to `CURATED_ONLY_DESTINATIONS`.

### How It Works After This

- You use the existing admin tool to add curated images for any destination
- The hero image hooks check the DB and use those images immediately
- No code deployment needed to add new destination photos — just use the admin tool
- The hardcoded list stays as a fast fallback (no DB query needed for the 65+ already-curated cities)

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useDestinationImages.ts` | Add `curated_images` DB query as Tier 1.5 |
| `src/hooks/useTripHeroImage.ts` | Add `curated_images` DB query between curated and API |
| `src/utils/destinationImages.ts` | Add 8 missing cities to hardcoded map |
| `src/services/destinationImagesAPI.ts` | Add same 8 cities to `CURATED_ONLY_DESTINATIONS` |

