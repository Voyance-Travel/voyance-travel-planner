

## The $200 in Photos Are NOT Lost — They're Stored But Never Read

### What We Have

**Good news**: All 4,290 photos downloaded from Google are safely stored in the `trip-photos` storage bucket. Every single one is a valid image (all >10KB, proper JPEG files). The `curated_images` table has 8,598 entries pointing to these storage URLs. The previous fix also successfully cleaned the poisoned raw-Google-URL entries — zero remain.

**The money was not wasted.** The photos exist. The problem is the UI never reads them back.

### Why Photos Still Show "Image Unavailable"

The writeback fix from the last round has **two bugs** preventing it from working:

1. **No save trigger**: `mergePhotosIntoDays` calls `setRawDays()` to update React state with photo URLs, but it never calls `setHasChanges(true)`. The auto-save system (line 2937) only fires when `hasChanges` is true. So photos merge into memory but never persist to the database. The DB still has `image_url: null` for every activity across all trips — confirmed: **0 out of 3,335 activities have photos** in `itinerary_data`.

2. **Hook ordering issue**: `mergePhotosIntoDays` (line 1272) references `setRawDays`, but `useState` for `rawDays` is declared at line 1292 — 20 lines later. While this technically works in JavaScript (closures capture the binding, not the value), it's fragile and confusing. More importantly, the `setDays` wrapper (line 1296) is what all other code uses, and it includes sanitization logic that `setRawDays` skips.

### The Fix

#### 1. Make `mergePhotosIntoDays` trigger a save
**File: `src/components/itinerary/EditorialItinerary.tsx` (~line 1272)**
- After updating state, call `setHasChanges(true)` so the auto-save fires
- Use `setDays` (the sanitizing wrapper) instead of `setRawDays` directly
- Move the callback below the `useState` and `setDays` declarations for clarity

#### 2. Backfill existing trips with their already-cached photos
**File: `src/components/itinerary/EditorialItinerary.tsx`**
- On mount, check if any activities in `days` are missing `image_url` but have a matching entry in `curated_images` (via the edge function's localStorage cache or a lightweight DB lookup)
- This ensures the 4,290 photos we already paid for get written into `itinerary_data` without re-fetching from Google

#### 3. Short-circuit `useActivityImage` when `image_url` is already set
**File: `src/hooks/useActivityImage.ts`**
- The hook already accepts `existingPhoto` as a parameter, but the caller may not be passing the `image_url` from `itinerary_data`. Verify the chain from `EditorialItinerary → DayCard → ActivityRow → useActivityImage` passes `activity.image_url` as `existingPhoto`
- If `existingPhoto` is a valid storage URL, return it immediately — zero API calls

### Files to change

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Fix `mergePhotosIntoDays`: add `setHasChanges(true)`, use `setDays`, move below declarations |
| `src/hooks/useActivityImage.ts` | Verify `existingPhoto` short-circuit works for storage URLs |

### Expected Impact
- All 4,290 cached photos become usable on next page view
- First view triggers image resolution + auto-save → all subsequent views are free
- "Image unavailable" errors eliminated for any venue with a cached photo

