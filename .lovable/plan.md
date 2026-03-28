

## Fix: Wrong Airport on Arrival Card

### Problem
The arrival card says "Arrival at Narita International Airport" but the flight lands at HND (Haneda). Two separate bugs cause this:

1. **`flight-hotel-context.ts` line 443** only reads `flightRaw.arrivalAirport` (flat top-level field). When flights are stored in the `legs[]` format, the airport code lives at `legs[0].arrival.airport` — which is never checked here. So `arrivalAirport` comes back `undefined`.

2. **`index.ts` lines 8162-8179** tries to recover from the missing value by regex-matching against `metadata.flightDetails`, but the hardcoded map only contains US airports (JFK, LAX, etc.) — no HND, NRT, or any non-US airport. When that also fails, it falls back to generic `"Airport"`, and the AI model fills in "Narita" because it's the more famous Tokyo airport.

### Fix — Two files

**File 1: `supabase/functions/generate-itinerary/flight-hotel-context.ts`** (line 443)

Extract arrival airport from legs data the same way `prompt-library.ts` already does:

```typescript
// Before (line 443):
arrivalAirport: (flightRaw?.arrivalAirport as string) || undefined,

// After:
arrivalAirport: (() => {
  // Prefer legs[].arrival.airport (same logic as prompt-library.ts)
  const legs = Array.isArray(flightRaw?.legs) ? flightRaw.legs as any[] : [];
  if (legs.length > 0) {
    const destLeg = legs.find((l: any) => l.isDestinationArrival)
      || (legs.length === 2 ? legs[0] : legs[0]);
    const legAirport = destLeg?.arrival?.airport;
    if (legAirport) return legAirport as string;
  }
  // Fallback to flat field
  return (flightRaw?.arrivalAirport as string) || undefined;
})(),
```

**File 2: `supabase/functions/generate-itinerary/index.ts`** (lines 8162-8179)

Replace the hardcoded US-only regex+map with a database lookup from the `airports` table. If `flightContext.arrivalAirport` is a 3-letter IATA code, query the airports table for its full name:

```typescript
// Replace lines 8162-8179 with:
let arrivalAirportDisplay = flightContext.arrivalAirport || '';

// If we have a code but no full name, look it up
if (arrivalAirportDisplay && /^[A-Z]{3}$/i.test(arrivalAirportDisplay)) {
  const code = arrivalAirportDisplay.toUpperCase();
  try {
    const { data: apt } = await supabaseClient
      .from('airports')
      .select('name, code')
      .ilike('code', code)
      .maybeSingle();
    if (apt?.name) {
      arrivalAirportDisplay = `${apt.name} (${code})`;
    } else {
      arrivalAirportDisplay = `${code} Airport`;
    }
  } catch {
    arrivalAirportDisplay = `${code} Airport`;
  }
} else if (!arrivalAirportDisplay) {
  // Last resort fallback from metadata (keep existing logic but simplified)
  arrivalAirportDisplay = 'Airport';
}
```

This removes the hardcoded map entirely and uses the airports table that already exists in the database — working for any airport worldwide.

### Result
- Flight arriving at HND → card says "Haneda Airport (HND)" instead of "Narita International Airport"
- Works for all airports globally, not just 14 US airports
- Consistent with the Arrival Game Plan which already correctly shows HND

### Files Changed
| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/flight-hotel-context.ts` | Extract arrivalAirport from legs data |
| `supabase/functions/generate-itinerary/index.ts` | Replace hardcoded airport map with airports table lookup |

