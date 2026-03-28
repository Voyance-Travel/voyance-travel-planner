

## Fix Final Departure Card — Dedup + Design

### Problem 1: Dedup patterns miss city names

"Transfer to Narita Airport (NRT)" is not caught by `"transfer to airport"` because "Narita" sits between the words. Same for "Transfer to Tokyo Station" vs `"transfer to station"`.

**Fix**: Replace substring matching with smarter keyword detection that checks for the presence of key tokens regardless of what's between them:

```js
// Instead of: t.includes('transfer to airport')
// Use: t.includes('transfer to') && (t.includes('airport') || t.includes('station') || ...)
const isTransferActivity = t.includes('transfer to') && 
  (t.includes('airport') || t.includes('station') || t.includes('port') || t.includes('terminal'));
const isDepartureActivity = t.includes('departure from') || t.includes('depart from');
const isHeadingTo = (t.includes('head to') || t.includes('travel to')) && 
  (t.includes('airport') || t.includes('station') || t.includes('port'));
```

This catches "Transfer to Narita Airport (NRT)", "Departure from Narita Airport", "Head to Tokyo Station", etc.

**File**: `EditorialItinerary.tsx` lines 1816-1832

### Problem 2: Card looks bad

Current card shows:
- "HEADING HOME" small label
- "TRAIN" bold uppercase label (from `transportName`)
- "Train home" as title — redundant with the label above

**Fixes in `InterCityTransportCard.tsx`**:

1. **Remove redundant transport type label** when variant is `final` — the "HEADING HOME" header already signals what this is. Instead show the carrier/route info where the label currently sits.

2. **Better title generation** in `EditorialItinerary.tsx`: Instead of `"Train home"`, generate something like `"Train to [home city]"` or just use the carrier name + route. When no home city is known, use the route (`Tokyo → Home`) rather than the generic "Train home".

3. **Clean up the card layout for final variant**: Merge the transport type into the heading line so it reads `"Heading Home · Train"` instead of stacking three separate text elements.

### Files changed

| File | Change |
|------|--------|
| `EditorialItinerary.tsx` (~line 1816) | Replace substring dedup with token-based matching |
| `EditorialItinerary.tsx` (~line 1746) | Generate better title using route info |
| `InterCityTransportCard.tsx` (~line 80) | For final variant, merge transport type into heading, remove redundant label |

