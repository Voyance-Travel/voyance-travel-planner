## Plan

Fix the visible dining-description bug with one targeted frontend change, without touching backend generation, sanitizers, meal-guard logic, or RestaurantLink.

### What I found

- `EditorialItinerary.tsx` already routes dining descriptions through a shared helper: `resolveActivityDisplayDescription(...)`.
- That helper lives in `src/lib/itinerary/diningDescriptionFallback.ts` and is already used in all three relevant render paths:
  - clean preview card
  - mobile expanded card
  - desktop card
- Because this helper is already centralized, the safest one-file fix is to harden that helper rather than duplicate fallback logic inside `EditorialItinerary.tsx`.

### Implementation

1. Update only `src/lib/itinerary/diningDescriptionFallback.ts`.
2. Make dining-card detection include the same categories the UI uses, especially:
   - `cafe`
   - `coffee`
   - `restaurant`
   - `drinks` / `nightcap`
3. Make the deterministic fallback use stable venue data:
   - `activity.location.name`
   - `activity.venue_name`
   - a venue extracted from titles like `Dinner at Marc Fosh`
4. Include address when available and safe:
   - `activity.location.address`
5. Ensure dining cards never render a blank description after sanitization:
   - real clean description wins
   - `personalization.whyThisFits` wins second
   - deterministic dining fallback wins last
6. Add the exact searchable marker requested, e.g. `Dining card NEVER renders blank`, so verification is one grep.

### Why this is better than editing the JSX block directly

The render block in `EditorialItinerary.tsx` no longer matches the snippet from the issue; it has already been refactored to use `resolveActivityDisplayDescription` in multiple places. Patching the helper is still a one-file UI rescue, but it covers every existing render path instead of only one JSX block.

### Verification

Run:

```bash
rg -n "Dining card NEVER renders blank|resolveActivityDisplayDescription" src/lib/itinerary/diningDescriptionFallback.ts src/components/itinerary/EditorialItinerary.tsx
```

Expected result:

- one marker hit in `diningDescriptionFallback.ts`
- existing `EditorialItinerary.tsx` calls still point to `resolveActivityDisplayDescription`

This is separate from the `Loading... Finding restaurant...` issue in `RestaurantLink.tsx`, which I will leave untouched per instruction.