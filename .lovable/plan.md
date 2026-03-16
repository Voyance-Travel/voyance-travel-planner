

## Combined Plan: Fix Photo Persistence + Cross-Share Photos + Photo-Free Manual Mode

### Problem Summary
1. Photos resolve per-day but writeback is only wired for the selected day tab
2. 9,670 curated images exist but are keyed by itinerary-specific activity titles (e.g., "dinner at kushikatsu daruma") — not shared across users/trips
3. The `attractions` (6,999) and `activities` (15,885) tables have no `image_url` column — wasted opportunity to share photos platform-wide
4. Manual/free "Build It Myself" trips still trigger Google API calls unnecessarily

### Changes

#### 1. Add `image_url` to `attractions` and `activities` tables
**Migration**: Add nullable `image_url TEXT` column to both tables. This becomes the platform-wide photo registry — when any user's trip resolves a photo for "Eiffel Tower" in Paris, it gets written here once and shared with every future trip.

#### 2. Cross-share photo lookup in `useActivityImage`
**File: `src/hooks/useActivityImage.ts`**

Add a new tier between localStorage cache and `curated_images`:
- Query `attractions` table by fuzzy name match + destination
- If no match, query `activities` table the same way
- If found with `image_url`, return it immediately (zero cost)

New priority chain: `existingPhoto` → memory cache → localStorage → **attractions/activities tables** → `curated_images` → edge function (Google API)

#### 3. Write-back resolved photos to `attractions`/`activities` tables
**File: `src/hooks/useActivityImage.ts`** or **edge function `destination-images`**

When a photo is resolved from Google/TripAdvisor for a venue that matches an `attractions` or `activities` row, update that row's `image_url`. This is a one-time write per venue — every future user gets it for free.

Simple matching logic: normalize the activity title, search `attractions.name` by destination + fuzzy match. If confidence is high (exact or near-exact name), update.

#### 4. Photo-free manual mode
**File: `src/components/itinerary/EditorialItinerary.tsx`** (~line 9130)

Update `shouldFetchRealPhoto` to include `!isManualMode`:
```
const shouldFetchRealPhoto = canViewPremium && !isManualMode && showThumbnail && !isAirport && ...
```

The `isManualMode` flag already exists at line 1924 and is derived from both the zustand store and `creation_source`. Pass it down through `DayCard` → `ActivityRow` as a prop.

**File: `src/pages/ActiveTrip.tsx`**
Check `trip.creation_source` — if `manual` or `manual_paste`, pass empty destination to `useActivityImage` so it short-circuits to category fallback.

#### 5. Fix per-day writeback limitation
**File: `src/components/itinerary/EditorialItinerary.tsx`**

Currently `onPhotoResolved` is only passed to the active day's `DayCard`. This is acceptable as-is (each day resolves on first view, then free forever), but add a comment documenting this behavior so it's not accidentally "fixed" later in a way that renders all days simultaneously.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | **DB Migration** | `ALTER TABLE attractions ADD COLUMN image_url TEXT;` and same for `activities` |
| 2 | `src/hooks/useActivityImage.ts` | Add attractions/activities table lookup tier; write-back resolved photos to matching rows |
| 3 | `src/components/itinerary/EditorialItinerary.tsx` | Add `!isManualMode` to `shouldFetchRealPhoto`; pass `isManualMode` prop through DayCard → ActivityRow |
| 4 | `src/pages/ActiveTrip.tsx` | Skip photo fetching for manual/paste trips |

### Expected Impact
- **Cross-sharing**: Once "Eiffel Tower" is resolved for one user, every future Paris trip gets it free from the `attractions` table
- **Manual mode**: Zero API cost for "Build It Myself" trips
- **Platform scale**: 22,884 attractions+activities become a shared photo registry, growing with every trip generated

