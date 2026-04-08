

# Fix: Cap Sacré Fleur Price via Existing Casual Venue Map

## Problem
"Sacré Fleur" (a casual Montmartre restaurant) gets priced at ~€216/pp. Realistic price is €40-60/pp.

## Solution
The codebase already has a `KNOWN_CASUAL_VENUES` map in `sanitization.ts` (line 716) that caps overpriced casual restaurants. It already includes other Montmartre venues like "Le Consulat" (€40) and "La Maison Rose" (€45). Simply add Sacré Fleur to this map — no inline filter needed.

## Implementation

**File: `supabase/functions/generate-itinerary/sanitization.ts`** (after line 761, in the "Montmartre casual restaurants" section)

Add two entries:
```typescript
'sacré fleur': 50,
'sacre fleur': 50,
```

This uses the existing `enforceCasualVenuePriceCap()` function which already runs in both `action-generate-day.ts` and `universal-quality-pass.ts`, so the cap will be enforced automatically. No new code paths needed.

