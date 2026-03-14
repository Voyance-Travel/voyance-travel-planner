Goal: stop the “Trip Total vs Expected Spend” drift so both numbers mean the same thing and always match.

What’s happening now (root cause):

1. They are calculated from different systems:

- Trip Total (itinerary header) uses local UI math in `EditorialItinerary`.
- Expected Spend (budget tab) uses `trip_budget_summary` via `useTripFinancialSnapshot`.

2. The sync pipeline is losing cost semantics:

- Call sites flatten cost objects to `{ amount }`, dropping `basis` / `total` / `perPerson`.
- `syncItineraryToBudget` then sometimes multiplies by travelers when it shouldn’t, inflating planned totals for some trips.

3. Hotel pricing is dropped in one path:

- `normalizeLegacyHotelSelection` strips `totalPrice` / `pricePerNight`, so itinerary Trip Total can miss hotel cost while Expected Spend includes it from backend JSON fallback.

So: it’s not simply “because 2 people.” It’s a mixed-calculation mismatch + traveler scaling inconsistency.

Implementation plan

1. Unify displayed totals to one canonical source

- Make itinerary header “Trip Total” read from `useTripFinancialSnapshot` (same as Expected Spend), converted from cents to display currency.
- Keep the existing currency toggle behavior, but feed it the canonical USD total.
Files:
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/hooks/useTripFinancialSnapshot.ts` (reuse, no logic split)

2. Fix cost basis handling in budget sync (prevent over/under counting)

- Preserve full cost payload (`amount`, `total`, `perPerson`, `basis`) when building sync data.
- Update `syncItineraryToBudget` rules:
  - if `total` exists → use as group total
  - else if `basis === 'per_person'` or `perPerson` exists → multiply by travelers
  - else if `basis === 'flat'`/`per_room` → use as-is
  - else (`amount` only, unknown basis) → treat as group total (matches visible UI amounts, avoids surprise inflation)
  Files:
- `src/services/tripBudgetService.ts`
- `src/components/itinerary/EditorialItinerary.tsx` (daysForSync builder)
- `src/components/itinerary/ItineraryAssistant.tsx` (daysForSync builder)
- `src/components/planner/budget/BudgetTab.tsx` (daysForSync builder)

3. Align activity cost table sync with same basis math

- Use the same normalization helper when syncing to `activity_costs` so `v_trip_total` and budget ledger don’t diverge.
- Ensure `cost_per_person_usd` + `num_travelers` are written consistently from derived group/per-person values.
Files:
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/components/itinerary/ItineraryAssistant.tsx`
- (optionally shared helper in `src/services/tripBudgetService.ts` or a small new utility)

4. Restore hotel price fields in normalized hotel object

- Carry `totalPrice` and `pricePerNight` through `normalizeLegacyHotelSelection`.
- In itinerary header, compute hotel cost as:
  - `totalPrice` first
  - fallback `pricePerNight * nights`
  Files:
- `src/utils/hotelValidation.ts`
- `src/components/itinerary/EditorialItinerary.tsx`

5. Data consistency refresh

- After logic update, trigger a planned-entry resync for current trip (existing sync flow can do this) so old inflated rows are replaced with corrected amounts.

Validation plan (end-to-end)

- Open one affected trip and verify these three numbers match:
  - Itinerary “Trip Total”
  - Budget “Expected Spend”
  - Payments estimated total
- Test with:
  - 1 traveler
  - 2 travelers
  - per-person activities
  - flat/transfer activities
  - hotel with `totalPrice` only
- Confirm no double count when hotel/flight already exist in ledger.

Expected outcome

- Users will see one consistent total everywhere.
- Traveler count effects will be intentional and explainable.
- The one value will be consistent with all of the prices shown in the itenerary and hotel and flight if selected
- No more “going in circles” between tabs.