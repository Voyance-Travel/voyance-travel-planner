

## Fix: Consistent, Persistent Destination Header Images Across All Views

### Problem

Three separate issues cause inconsistent/rotating destination photos:

1. **Multiple image arrays for curated destinations**: New York has 3 Unsplash URLs. Different components pick different ones because `DestinationHeroImage` takes `[0]`, while `useDestinationImages` uses `rotateDeterministic()` with varying seeds. Result: different photo on Explore vs Featured vs Itinerary.

2. **No persistence for Explore/Browse cards**: `DestinationHeroImage` (used on card grids) calls `useHeroImage` → edge function every session for non-curated destinations. Unlike trip heroes which write back to `trips.metadata.hero_image`, card images are never cached. Google Places returns different results over time → rotating images, sometimes holiday-themed.

3. **Unsplash instability**: 10+ Unsplash URLs are already blocked as broken. The curated list relies heavily on Unsplash which can return 404s unpredictably.

### Solution: One Canonical Image Per Destination, Persisted in DB

**Principle**: Every destination gets exactly ONE hero image. It's stored in the `destinations` table (or `curated_images` with `entity_type = 'destination'`). All views read from the same source. No rotation, no randomization.

#### 1. Add `hero_image_url` column to `destinations` table
**Migration**: `ALTER TABLE destinations ADD COLUMN IF NOT EXISTS hero_image_url TEXT;`

This is the single source of truth. Once set, every component reads this value.

#### 2. Simplify `DestinationHeroImage` to use canonical image
**File: `src/components/common/DestinationHeroImage.tsx`**
- Check `destinations.hero_image_url` first (single DB read, cached by React Query)
- If not set, resolve via existing chain (curated → edge function), then **write back** to `destinations.hero_image_url`
- All subsequent visits across all users → same image, zero API cost

#### 3. Simplify `useTripHeroImage` to prefer destination canonical image
**File: `src/hooks/useTripHeroImage.ts`**
- After checking `trip.metadata.hero_image`, check `destinations.hero_image_url` for the trip's destination
- This ensures trip cards match explore cards match itinerary headers

#### 4. Lock curated destinations to `[0]` only — no rotation
**File: `src/utils/destinationImages.ts`**
- `getDestinationImage()` already returns `[0]` — correct
- But `getDestinationImages()` returns multiple, and callers like `useDestinationImages` rotate them
- Change: curated destinations always return `[0]` as the hero. The array stays for gallery use, but hero is pinned.

#### 5. Seed canonical images for top destinations
**Migration or edge function**: For the ~60 curated destinations that already have hardcoded images, write `hero_image_url = curated[0]` into the `destinations` table. This pre-populates the canonical image so no API call is ever needed.

#### 6. AI-generated fallback for uncurated destinations (future)
For destinations with no curated or Google Places image, use the Lovable AI image generation (`google/gemini-3.1-flash-image-preview`) to generate a skyline/cityscape. This replaces the gradient fallback and avoids holiday/seasonal images. This can be a follow-up — the persistence fix alone solves the inconsistency.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | **DB Migration** | Add `hero_image_url TEXT` to `destinations` table; seed from curated `[0]` values |
| 2 | `src/components/common/DestinationHeroImage.tsx` | Read `destinations.hero_image_url` first; write-back on first resolve |
| 3 | `src/hooks/useTripHeroImage.ts` | Add `destinations.hero_image_url` as tier between seeded and curated |
| 4 | `src/utils/destinationImages.ts` | No functional change needed — `getDestinationImage()` already returns `[0]` |
| 5 | `src/services/destinationImagesAPI.ts` | Add helper to read/write `destinations.hero_image_url` |

### Expected Result
- Same image for "New York" everywhere: Explore grid, Featured section, trip card, itinerary header
- No holiday/seasonal photos (Google Places rotation eliminated)
- First resolve persists; all future views = zero API cost
- AI generation available as clean fallback (skylines, not Christmas trees)

