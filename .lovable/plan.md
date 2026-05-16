## Problem

On the itinerary header, the currency toggle reads `{localCurrency} ↔ USD` — the local currency sits on the left (the "first" position), which reads as the default even though USD is actually the active state. Users perceive the left slot as the default value.

## Fix

Swap the visual order of the toggle in `src/components/itinerary/EditorialItinerary.tsx` (lines 6222–6224) so USD renders first (left) and the local currency renders second (right). Active-state highlighting (`text-primary` on the selected side) is preserved, and the toggle's behavior is unchanged.

### Change

```tsx
<span className={!showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>USD</span>
<span className="text-muted-foreground/50">↔</span>
<span className={showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>{localCurrency}</span>
```

## Out of scope

- No change to default state (already USD per memory `Currency Units Canonical`).
- No change to Budget/Payments tabs — they already follow `tripCurrency`.
- No business-logic, FX, or persistence changes.

## Verification

Reload the itinerary page on a non-USD trip: toggle reads `USD ↔ EUR` (or local equivalent), USD highlighted in primary color on initial load. Clicking flips highlight to the right side and converts amounts to local.
