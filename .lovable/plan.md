

## Fix: "Solo" Activities Generated on Multi-Person Trips

### Problem
The personalization system generates `solo_retreat` slots based purely on introvert trait scores (`social <= -4`), without checking traveler count. On a 2-person trip, this produces activities like "Solo Reflections at Igreja de Sao Roque" — contradicting the group size.

### Root Cause
`deriveForcedSlots()` in `personalization-enforcer.ts` (line 268) pushes a `solo_retreat` slot when the social trait is <= -4, regardless of how many travelers are on the trip. The `SlotDerivationContext` interface doesn't include traveler count, so there's no way to gate this.

The slot description sent to the AI is `"One peaceful solo moment"` with tags like `['quiet', 'solo', 'peaceful']`, which causes the AI to generate activities with "Solo" in the title and description.

### Fix — 1 file

**`supabase/functions/generate-itinerary/personalization-enforcer.ts`**

**Change 1: Add `travelerCount` to `SlotDerivationContext`** (~line 103)

```typescript
export interface SlotDerivationContext {
  tripType?: string;
  travelCompanions?: string[];
  hasChildren?: boolean;
  primaryArchetype?: string;
  secondaryArchetype?: string;
  celebrationDay?: number;
  travelerCount?: number;  // NEW
}
```

**Change 2: Gate `solo_retreat` on single traveler** (~line 267-276)

Replace the introvert slot logic:
```typescript
// Introverts (negative social score) — only for solo travelers
if ((traits.social ?? 0) <= -4) {
  const isSoloTrip = !context?.travelerCount || context.travelerCount <= 1 ||
    context?.tripType === 'solo' ||
    context?.travelCompanions?.includes('solo');
  
  if (isSoloTrip) {
    slots.push({
      type: 'solo_retreat',
      traitSource: 'social',
      traitValue: traits.social || 0,
      description: 'One peaceful solo moment',
      validationTags: ['quiet', 'solo', 'peaceful', 'intimate', 'private', 'secluded', 'serene']
    });
  } else {
    // Multi-person introvert trip: request quiet/peaceful activities without "solo" framing
    slots.push({
      type: 'solo_retreat',
      traitSource: 'social',
      traitValue: traits.social || 0,
      description: 'One quiet, peaceful moment away from crowds (NOT solo — travelers are together)',
      validationTags: ['quiet', 'peaceful', 'intimate', 'secluded', 'serene']
    });
  }
}
```

For multi-person trips, the slot still exists (introvert travelers still want quiet moments) but the description explicitly says "NOT solo" and drops the `'solo'` tag, so the AI won't generate "Solo Reflections" titles.

**Change 3: Pass `travelerCount` at call sites** — 3 locations in `index.ts` and `action-generate-trip.ts` where `deriveForcedSlots` is called. Add `travelerCount` to the context object:

- `index.ts` ~line 5563: add `travelerCount: context.travelers || 1`
- `index.ts` ~line 11485: add `travelerCount: totalTravelers || 1`
- `action-generate-trip.ts` ~line 409: add `travelerCount: travelers || 1`

### Files
- `supabase/functions/generate-itinerary/personalization-enforcer.ts` — add travelerCount to context, gate solo_retreat
- `supabase/functions/generate-itinerary/index.ts` — pass travelerCount at 2 call sites
- `supabase/functions/generate-itinerary/action-generate-trip.ts` — pass travelerCount at 1 call site

