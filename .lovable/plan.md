

## Remove "Find Similar" hotel button

The "Find Similar" button on the accommodation card in the Flights & Hotels tab uses `VendorBookingLink` with a TripAdvisor search URL. Rather than debug why clicks aren't working, the user wants it removed.

### Change

**File: `src/components/itinerary/EditorialItinerary.tsx` (lines 6645-6655)**

Remove the `VendorBookingLink` block that renders "Find Similar" inside the hotel card's action row. The Website/Maps link stays. The outer container condition (`hotelCost > 0`) becomes unnecessary as a standalone check — simplify to only show the row when there's a website or maps URL.

