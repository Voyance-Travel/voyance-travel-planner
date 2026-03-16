

# Fix: Flight Details Rendering in PDF

## Problems Identified

From the exported PDF screenshot:
1. **Missing airline name** — line 1 of the flight card shows `!' LGA` instead of airline + route
2. **Unicode arrow `→` not supported** in Helvetica — renders as `!'`
3. **Empty departure time** — shows `Departs · Arrives 8:15 AM` with no departure value
4. **Only first flight leg passed** — return flight is completely missing from the PDF
5. **Fixed card height** doesn't adapt to content

## Root Cause

In `EditorialItinerary.tsx` (~line 4449), only `allFlightLegs[0]` is passed. The data mapping pulls `departure.time` and `arrival.time` which may be empty strings depending on the flight selection shape.

In `consumerPdfGenerator.ts` (~line 214), the `→` character fails in Helvetica, and empty strings produce garbled output like `!' LGA` and `Departs ·`.

## Fix

### 1. Redesign the flight card in `consumerPdfGenerator.ts`

- Replace the generic `drawInfoCard` with a dedicated `drawFlightCard` that renders a proper flight layout:
  - Support **multiple flight legs** (outbound + return)
  - Each leg gets: departure airport → arrival airport with times, airline, date
  - Replace `→` with a drawn line + plane icon or simple `to` text
  - Skip empty fields gracefully instead of rendering blanks
  - Dynamic card height based on number of legs

### 2. Update PDF data interface to support multiple legs

Change the `flight` field from a single object to an array of legs:

```typescript
flights?: Array<{
  airline: string;
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
  date?: string;
  label?: string; // "Outbound" / "Return"
}>;
```

### 3. Update `EditorialItinerary.tsx` to pass all flight legs

Map all `allFlightLegs` (not just index 0) into the PDF data, with proper fallback handling for empty fields.

## Files to Change

| File | Change |
|------|--------|
| `src/utils/consumerPdfGenerator.ts` | Add dedicated `drawFlightCard` supporting multiple legs; replace Unicode `→` with safe alternative; handle empty fields; update interface |
| `src/components/itinerary/EditorialItinerary.tsx` | Pass all flight legs to PDF generator instead of just `allFlightLegs[0]` |

