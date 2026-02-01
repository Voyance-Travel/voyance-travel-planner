
# Plan: Fix Hotel Display in Airport Game Plan

## Problem Summary

You selected a hotel during planning (Rome Times Hotel) and it's correctly stored in the database, but it's not appearing in the "Your Airport Game Plan" landing strip. The user expects to see the hotel details displayed between the flights section and the transfer times/prices.

## Root Cause Analysis

The issue has **two parts**:

### Part 1: Field Name Mismatch
The database stores hotel data with fields like:
- `checkIn: "2026-02-25"` (date string)
- `checkOut: "2026-03-04"`
- `location: "Via Milano, 42, 00184 Roma RM, Italy"`

But `normalizeLegacyHotelSelection()` expects:
- `checkInDate` / `checkInTime`
- `checkOutDate` / `checkOutTime`
- `address`

When the data is already an array, the function returns it as-is without normalizing field names:
```typescript
if (Array.isArray(selection)) {
  return selection as HotelBooking[];  // No field normalization!
}
```

### Part 2: Missing Hotel Display Block
Even when `hasHotel` is true, the AirportGamePlan only shows:
1. Flight info
2. Transfer options (Taxi/Train times and costs)

It does NOT show a dedicated hotel block with:
- Hotel name
- Hotel address/location
- Check-in date

The user wants to SEE the hotel listed, not just the transfer options.

## Solution

### Step 1: Fix Field Normalization in `hotelValidation.ts`

Update `normalizeLegacyHotelSelection()` to normalize array items too:

```typescript
export function normalizeLegacyHotelSelection(
  selection: unknown,
  tripStartDate: string,
  tripEndDate: string
): HotelBooking[] {
  if (!selection) return [];
  
  // Helper to normalize a single hotel object
  const normalizeHotel = (hotel: Record<string, unknown>): HotelBooking | null => {
    if (!hotel.name) return null;
    
    return {
      id: (hotel.id as string) || `migrated-${Date.now()}`,
      name: hotel.name as string,
      // Support both 'address' and 'location' fields
      address: (hotel.address as string) || (hotel.location as string) || undefined,
      neighborhood: hotel.neighborhood as string | undefined,
      // Support multiple date field formats
      checkInDate: (hotel.checkInDate as string) || (hotel.checkIn as string) || tripStartDate,
      checkOutDate: (hotel.checkOutDate as string) || (hotel.checkOut as string) || tripEndDate,
      checkInTime: hotel.checkInTime as string | undefined,
      checkOutTime: hotel.checkOutTime as string | undefined,
      website: hotel.website as string | undefined,
      googleMapsUrl: hotel.googleMapsUrl as string | undefined,
      images: hotel.images as string[] | undefined,
      imageUrl: hotel.imageUrl as string | undefined,
      placeId: hotel.placeId as string | undefined,
      rating: hotel.rating as number | undefined,
      isManualEntry: hotel.isManualEntry as boolean | undefined,
      isEnriched: hotel.isEnriched as boolean | undefined,
    };
  };
  
  // If already an array, normalize each item
  if (Array.isArray(selection)) {
    return selection
      .map(item => normalizeHotel(item as Record<string, unknown>))
      .filter((h): h is HotelBooking => h !== null);
  }
  
  // Legacy single object format
  const normalized = normalizeHotel(selection as Record<string, unknown>);
  return normalized ? [normalized] : [];
}
```

### Step 2: Add Hotel Display Block to AirportGamePlan

Update the `AirportGamePlan` component to show the hotel information between flights and transfers:

**Location**: `src/components/itinerary/EditorialItinerary.tsx` (lines 3847-3884)

**New structure** (after flight section, before transfer section):

```typescript
{/* Hotel Section - Show hotel details */}
{hasHotel && (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <Hotel className="h-4 w-4 text-primary" />
    </div>
    <div className="flex-1">
      <p className="font-medium text-sm">{hotelSelection?.name}</p>
      {hotelSelection?.address && (
        <p className="text-xs text-muted-foreground mt-0.5">{hotelSelection.address}</p>
      )}
      {(hotelSelection?.checkInDate || hotelSelection?.checkIn) && (
        <p className="text-xs text-muted-foreground mt-1">
          Check-in: {format(parseISO(hotelSelection.checkInDate || hotelSelection.checkIn!), 'MMM d')}
          {hotelSelection?.checkInTime && ` at ${hotelSelection.checkInTime}`}
        </p>
      )}
    </div>
  </div>
)}

{/* Transfer Section - Travel times (existing code, slightly modified header) */}
{hasHotel && (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
      <Car className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">Getting There</p>
        {/* Live badge, etc. */}
      </div>
      {/* Transfer grid - existing code */}
    </div>
  </div>
)}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/hotelValidation.ts` | Fix `normalizeLegacyHotelSelection()` to normalize array items and support `location`/`checkIn` field names |
| `src/components/itinerary/EditorialItinerary.tsx` | Add dedicated hotel display block in `AirportGamePlan` between flights and transfers |

## Expected Outcome

After implementation, the Airport Game Plan will show:

```text
╔═══════════════════════════════════════════════════════════════╗
║  ✈️  Your Airport Game Plan                                   ║
╠═══════════════════════════════════════════════════════════════╣
║  🕐  Arrive at airport by 5:30 AM                             ║
║      We recommend 2.5 hours before your 8:00 AM departure     ║
╠───────────────────────────────────────────────────────────────╣
║  📍  Landing at 2:00 PM (FCO)                                 ║
║      Afternoon arrival - grab lunch and explore               ║
╠═══════════════════════════════════════════════════════════════╣
║  🏨  Rome Times Hotel                     ← NEW SECTION       ║
║      Via Milano, 42, 00184 Roma RM, Italy                     ║
║      Check-in: Feb 25                                         ║
╠═══════════════════════════════════════════════════════════════╣
║  🚗  Getting There                                            ║
║      ┌─────────────────┬─────────────────┐                   ║
║      │ 🚕 Taxi/Uber    │ 🚆 Train/Metro  │                   ║
║      │ 45-60 min       │ 32 min          │                   ║
║      │ €48 fixed       │ €14             │                   ║
║      └─────────────────┴─────────────────┘                   ║
╠═══════════════════════════════════════════════════════════════╣
║  ✨  Recommended: Check in, then lunch & explore              ║
║      Afternoon arrival - grab lunch and explore the area      ║
╚═══════════════════════════════════════════════════════════════╝
```

## Implementation Notes

1. The `HotelSelection` interface in `EditorialItinerary.tsx` already supports both `checkIn` and `checkInDate` fields, so no interface changes needed
2. The `normalizeLegacyHotelSelection` fix ensures consistent field names regardless of how data was stored
3. Adding `Car` icon import for the transfer section header (already imported in the file)
4. The format function from date-fns is already imported

## Verification

After implementation:
1. Navigate to `/trip/264370bf-0d21-4399-b16c-f8431daa6788`
2. Check the Airport Game Plan shows:
   - ✓ Flight information
   - ✓ **Rome Times Hotel** with address
   - ✓ Check-in date (Feb 25)
   - ✓ Transfer options (Taxi and Train)
   - ✓ Post-landing recommendation
