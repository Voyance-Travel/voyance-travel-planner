

## Validate Restaurant Location Matches Trip City

### Problem
Restaurants from wrong cities/regions (e.g., Ocean Restaurant in Algarve) appearing in destination itineraries (e.g., Lisbon).

### Changes

**1. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** — Append to OPERATIONAL NOTES block (line 829):

```
CRITICAL GEOGRAPHIC RULE: Every restaurant and venue MUST be physically located within the trip destination city or its immediate metro area. Do not suggest restaurants from other cities or regions, even if they are famous. For example, for a Lisbon trip, only suggest restaurants actually located in the Lisbon metropolitan area — not restaurants in the Algarve, Porto, or other regions.
```

**2. `supabase/functions/generate-itinerary/sanitization.ts`** — Add city-mismatch detection in `sanitizeGeneratedDay`, before `return day` (line 396). This is a defensive warning log + cost removal for obvious geographic mismatches:

```typescript
// Warn/flag restaurants with addresses clearly outside the destination
if (destination && day.activities) {
  const dest = destination.toLowerCase().trim();
  // Map of country → list of major cities for cross-checking
  const cityGroups: Record<string, string[]> = {
    portugal: ['lisbon', 'lisboa', 'porto', 'faro', 'algarve', 'coimbra', 'braga', 'funchal', 'sintra', 'cascais', 'estoril', 'albufeira', 'alporchinhos', 'portimão', 'portimao'],
    italy: ['rome', 'roma', 'milan', 'milano', 'florence', 'firenze', 'venice', 'venezia', 'naples', 'napoli', 'turin', 'torino', 'bologna', 'palermo'],
    spain: ['madrid', 'barcelona', 'seville', 'sevilla', 'valencia', 'malaga', 'bilbao', 'granada'],
    france: ['paris', 'lyon', 'marseille', 'nice', 'bordeaux', 'toulouse', 'strasbourg'],
    germany: ['berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'düsseldorf'],
    uk: ['london', 'edinburgh', 'manchester', 'birmingham', 'glasgow', 'liverpool'],
    japan: ['tokyo', 'kyoto', 'osaka', 'hiroshima', 'yokohama', 'nara', 'fukuoka', 'sapporo'],
  };

  // Find which group the destination belongs to
  let otherCities: string[] = [];
  for (const cities of Object.values(cityGroups)) {
    if (cities.some(c => dest.includes(c) || c.includes(dest))) {
      otherCities = cities.filter(c => !dest.includes(c) && !c.includes(dest));
      break;
    }
  }

  if (otherCities.length > 0) {
    for (const act of day.activities) {
      const address = ((act.address || act.location?.address || '') as string).toLowerCase();
      if (!address) continue;

      const mentionsOther = otherCities.some(c => address.includes(c));
      const mentionsDest = address.includes(dest) ||
        (dest === 'lisbon' && address.includes('lisboa')) ||
        (dest === 'lisboa' && address.includes('lisbon'));

      if (mentionsOther && !mentionsDest) {
        console.warn(`[sanitize] Restaurant "${act.title}" address mentions another city: ${address}`);
        // Zero out cost to prevent inflating day total
        if (act.cost && typeof act.cost === 'object') {
          act.cost = { amount: 0, currency: act.cost.currency || 'EUR' };
        }
      }
    }
  }
}
```

### Files
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add geographic rule to prompt
- `supabase/functions/generate-itinerary/sanitization.ts` — add city-mismatch detection

