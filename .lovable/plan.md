

## Fix: Always Show Dates on Hotel Cards (Remove Legacy Single-Hotel Path)

### Problem
When adding the first hotel in the trip setup, it uses a legacy `manualHotel` state that doesn't display check-in/check-out dates on the card. Dates only appear after adding a second hotel, which triggers migration to `manualHotelList`. This forces users to add a second hotel, then go back and edit the first one to set dates — a broken UX.

### Solution
Eliminate the legacy `manualHotel` single-hotel path. Always save hotels directly into `manualHotelList`, so every hotel card shows dates from the start.

### Changes

**File: `src/pages/Start.tsx`**

1. **First hotel "I have a hotel" click (around line 1633-1644)**: When opening the modal for the first hotel, set `editingHotelIndex` to `0` (or `null` for "new") so the save path uses `manualHotelList` instead of `manualHotel`. Ensure `isListMode` is true from the start by pushing to `manualHotelList`.

2. **Modal save handler (around lines 2089-2107)**: Remove the `else` branch that saves to `setManualHotel`. Instead, always save to `manualHotelList` with dates included.

3. **Legacy single hotel card display (lines 1679-1711)**: Remove this block entirely. All hotels will render through the `manualHotelList.map()` block (lines 1714-1749), which already shows dates.

4. **"Add another" button migration logic (lines 1760-1763)**: Remove the `manualHotel` → `manualHotelList` migration code since it's no longer needed.

5. **Backward compatibility**: On component mount or when `manualHotel.name` exists but `manualHotelList` is empty, auto-migrate `manualHotel` into `manualHotelList` so existing drafts aren't lost.

### Result
Every hotel card — including the first one — will display check-in and check-out dates. No more disjointed flow requiring a second hotel to unlock date editing on the first.

