

## Fix: Departure Transport Card Logic

### Current state (3 paths, each with issues)

```text
Path 1: Transition Day     → reads trip_cities.transport_details    ✅ works
Path 2: Departure Day      → reads next city's transport_details    ✅ works  
Path 3: Final Departure     → reads flightSelection return leg      ⚠️ broken
```

Path 3 problems:
- Transport type detected via fragile heuristic (has flight number → flight, else → train). Ignores `transportMode` field that `buildTransportSelection()` actually saves
- AI-generated "Transfer to Airport" and "Departure from Airport" activities duplicate the synthetic card
- No card at all if `flightSelection` is missing (single-city, no transport entered)

### Fixes

**1. Read `transportMode` from `flightSelection` instead of guessing** (EditorialItinerary.tsx ~line 1737)

Currently:
```js
const hasFlightNum = !!(flightNum || (carrier && !carrier.toLowerCase().includes('train')));
const tType = hasFlightNum ? 'flight' : 'train';
```

Fix: Check `flightSelection.transportMode` first (set by `buildTransportSelection`), then fall back to the heuristic:
```js
const tType = flightSelection.transportMode 
  || (flightNum ? 'flight' : 'train');
```

**2. Deduplicate AI-generated departure activities against synthetic card**

After injecting the synthetic final departure card, filter out AI-generated activities that are clearly transport/departure duplicates (titles matching "Transfer to Airport", "Departure from", etc.). The current trimming logic only removes by time cutoff — it doesn't detect semantic duplicates.

Add a dedup pass (~line 1810):
```js
const DEPARTURE_DUPES = ['transfer to airport', 'departure from', 'head to airport', 'airport transfer'];
updatedActivities = updatedActivities.filter(act => {
  if ((act as any).__syntheticFinalDeparture) return true; // keep the card
  const t = (act.title || '').toLowerCase();
  return !DEPARTURE_DUPES.some(kw => t.includes(kw));
});
```

**3. Handle train/bus/ferry departure — strip airport references**

When `transportMode` is train/bus/ferry, the dedup list should also catch "Transfer to Narita Airport" etc. The synthetic card will show the correct station/terminal instead.

### Files changed

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Read `transportMode`, add dedup filter, strip airport activities for non-flight departures |

### What this does NOT change
- Paths 1 and 2 (transition/departure days) — these work correctly
- The AI prompt (server-side generation already handles transport correctly)
- `buildTransportSelection()` — already saves `transportMode`

