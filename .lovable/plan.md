
# Fix: Hotel Check-In/Check-Out Time Not Updating

## The Bug

When you edit a hotel and change the check-in time (e.g., from 3:00 PM to 9:00 AM), clicking "Update Hotel" saves the new time to the database but the Edit Hotel dialog is initialized with the **wrong fields**.

In `EditorialItinerary.tsx` line 5246-5247, the existing hotel data is passed like this:

```
checkInTime: hotelSelection.checkIn || '15:00',
checkOutTime: hotelSelection.checkOut || '11:00',
```

But `hotelSelection.checkIn` and `hotelSelection.checkOut` are **date strings** (like `2026-04-15`), not time strings. The correct fields are `hotelSelection.checkInTime` and `hotelSelection.checkOutTime`.

This means:
- The edit form always shows `15:00` / `11:00` (the fallback defaults) since the date string gets treated as truthy but isn't a valid time
- When you save, even though the time is correct in the form, the next time you open the dialog it reverts to defaults

## Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`** (lines 5246-5247)

Change:
```
checkInTime: hotelSelection.checkIn || '15:00',
checkOutTime: hotelSelection.checkOut || '11:00',
```

To:
```
checkInTime: hotelSelection.checkInTime || '15:00',
checkOutTime: hotelSelection.checkOutTime || '11:00',
```

This is a two-character fix (adding `Time` to each field name) that correctly reads the saved check-in and check-out times.
