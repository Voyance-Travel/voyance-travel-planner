

## Remaining Hotel/Itinerary Integration Issues

After reviewing all save paths, there are four issues still present:

### Issue 1: Race condition — patch then overwrite in TripDetail booking-changed handler

**File: `src/pages/TripDetail.tsx` (lines 3060-3072)**

`patchItineraryWithMultipleHotels` writes updated titles/addresses to `itinerary_data` in the database (line 3061). Then immediately after, `saveItineraryOptimistic` writes the *injected days* back to the same field (line 3068) — but the injected days were built from the *pre-patch* data. This overwrites the patch.

**Fix:** Remove the separate `patchItineraryWithMultipleHotels` call. Instead, after injection builds the updated days, run the patch logic *in-memory* on `injectedDays` before saving. Alternatively, await the patch before building the save payload — but the simpler fix is: the injection already sets correct hotel names via `buildCheckInActivity`/`buildCheckOutActivity`, so the patch is redundant here. Remove lines 3059-3063.

### Issue 2: Multi-city hotel_selection arrays flattened to first entry only

**File: `src/pages/TripDetail.tsx` (line 3025)**

When building `cityHotels`, each city's `hotel_selection` array is reduced to `hotel_selection[0]`. If a city has a split stay (two hotels in the array), only the first hotel is used for injection. The second hotel's check-in/checkout/drop-bags cards are never created.

**Fix:** Flatmap over all entries in each city's `hotel_selection` array instead of taking only `[0]`.

### Issue 3: Single-city save in PlannerHotelEnhanced ignores existing multi-hotel state

**File: `src/pages/planner/PlannerHotelEnhanced.tsx` (line 586)**

The single-city save path (line 572-593) always calls `patchItineraryWithHotel` with just the newly saved hotel. If the trip's `hotel_selection` already contains multiple hotels (split stay), saving one overwrites the other's cards. The multi-city path (line 554) correctly fetches all city hotels, but the single-city path does not check `trips.hotel_selection` for existing entries.

**Fix:** In the single-city path, after saving, fetch `trips.hotel_selection`. If it contains multiple hotels, use `patchItineraryWithMultipleHotels` with all of them.

### Issue 4: Single-hotel patch never fires from TripDetail booking-changed

**File: `src/pages/TripDetail.tsx` (line 3060)**

The patch only fires when `allHotelsForPatch.length > 1`. For a single-hotel trip, `allHotelsForPatch` has 1 entry, so no patch is called. This means "Freshen up at Your Hotel" and "Return to Your Hotel" cards keep their placeholder names until the page is fully reloaded.

**Fix:** Also call `patchItineraryWithHotel` when `allHotelsForPatch.length === 1`.

---

### Implementation Summary

| File | Change |
|---|---|
| `src/pages/TripDetail.tsx` (line 3025) | Flatmap over all entries in each city's `hotel_selection` array instead of taking `[0]` only. |
| `src/pages/TripDetail.tsx` (lines 3059-3063) | Remove standalone `patchItineraryWithMultipleHotels` call (it races with `saveItineraryOptimistic`). Instead, after building `injectedDays`, apply patch logic in-memory before saving — or simply rely on the injection which already sets correct hotel names. For single-hotel, add a `patchItineraryWithHotel` call. |
| `src/pages/planner/PlannerHotelEnhanced.tsx` (line 586) | In single-city path, fetch `trips.hotel_selection` and use multi-hotel patcher if multiple entries exist. |

### Technical Detail

```text
Race condition in TripDetail:

  T=0  patchItineraryWithMultipleHotels writes DB row  ← sets correct titles
  T=1  saveItineraryOptimistic writes DB row            ← overwrites with pre-patch data
  
  Result: patch is silently lost

Fix: apply title patches to injectedDays in-memory before the single save call
```

