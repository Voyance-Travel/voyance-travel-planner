
## Budget tab prices don't match itinerary — root cause + fix

### Diagnosis (Istanbul trip `3c2da103-fb9a-47ef-a51e-d26be4680ac7`, 2 travelers)

| Activity | JSON `cost.amount` | Ledger `cost_per_person_usd` | Card shows | Budget line |
|---|---|---|---|---|
| Dinner: Nicole Restaurant | $60 | **$30** (forced to city-mid reference) | $30/pp | $60 |
| Arrival Flight | $20 | **$10** (also miscategorised as `activity`) | $10/pp | $20 |

Two compounding bugs:

1. **Writer drops the AI/JSON price.** `supabase/functions/_shared/write-activity-costs.ts` walks every activity but never reads `act.cost.amount`, `act.price_per_person`, `act.cost.basis`, or `act.cost.source`. It always picks a value from the `cost_reference` table for the city/category/subcategory (or hardcoded $15/$20/$10 fallbacks) and stores that as `cost_per_person_usd`. Whenever the AI emitted a believable price, it's silently replaced by the city-mid reference, so the ledger no longer matches the JSON cost the card was originally meant to show.
2. **Card vs Budget render in different units.** Card path (`getActivityCostInfo` → `getLedgerOverride`) renders ledger value as `"$30/pp"`. Budget tab path (`usePayableItems` → `resolveCanonicalCostRows.rowTotalCents`) renders `cost_per_person_usd × num_travelers = "$60"`. Mathematically consistent, but the labels look like different prices and the user calls it a mismatch.

The combination is what made it confusing in BA and Istanbul: the per-person ledger price is also half the AI-emitted JSON price, so even a unit-aware user reads it as "Budget says $60 but card says $30, twice the discrepancy."

### Fix

#### 1. Honor JSON cost in the writer (root cause)

Edit `supabase/functions/_shared/write-activity-costs.ts`:

- Before the `cost_reference` lookup, read an explicit per-person price from the activity in this order:
  1. `act.cost.amount` when `act.cost.basis === 'per_person'`
  2. `act.cost.amount / max(num_travelers, 1)` when `basis === 'flat'` (group total)
  3. `act.price_per_person`
  4. `act.estimated_price_per_person`
  5. `act.cost.amount` (legacy AI rows without explicit basis — treat as per-person; this is what every other reader assumes)
- When `act.cost.source` ∈ `{user, user_override, imported, booked}`, write that price through unchanged and set `source = act.cost.source`, `confidence = 'high'`, skip the budget-cap scaling (already done elsewhere via `basis=user/booked` exemption).
- Otherwise (AI-emitted): use the JSON price when it's ≥ the existing per-category sanity floor (`category-price-bounds.ts`); if it's below the floor, fall back to the reference value (existing behaviour). Tag `source = 'json'` so the existing daily-cap scaler and floor-repair can still intervene.
- Keep the explicit free/walking/unverified branches above as-is.
- Fix the flight category drift: when `act.category` is `flight` or `arrival/return flight` titles, always store `category = 'flight'` regardless of `categoryMap`.

This single change makes the ledger faithfully record what the AI emitted, which restores the contract assumed by every downstream consumer (`getLedgerOverride`, snapshot, payments, budget coach).

#### 2. Render Budget line items in the same units as the cards

Edit `src/components/planner/budget/BudgetTab.tsx` (line-item list only, totals are correct):

- When `travelers > 1`, show each line as `"$30/pp × 2 = $60"` (or per-person primary + group total muted on a second row, to mirror the card tooltip pattern). Keep the bucket subtotals and grand total in group-total cents — they already match `useTripFinancialSnapshot`.
- Reuse `basisLabel(...)` so wording stays identical to cards.
- Flat-rate categories (hotel, flight, manual entries) stay as totals — they don't carry a per-person basis.

This eliminates the "unit mismatch" reading even for trips that haven't been re-synced.

#### 3. One-shot backfill for already-persisted trips

Add a small server-side helper that, for every trip with `metadata.fully_persisted = true` and at least one `activity_costs` row tagged `source IN ('reference','fallback')`, recomputes from the JSON itinerary using the new writer logic and updates rows where the JSON price exceeds the stored ledger value by ≥ $5. Skip locked/user/booked rows. Run once via a one-off migration trigger (mirrors the `sync-trip-cost-table` lazy backfill in `useTripFinancialSnapshot`).

### Tests

- `supabase/functions/_shared/__tests__/write-activity-costs.honors-json.test.ts`
  - AI emits `cost.amount=60, basis='per_person'` → ledger writes `cost_per_person_usd=60, source='json'`.
  - AI emits `cost.amount=120, basis='flat'`, 2 travelers → ledger writes `cost_per_person_usd=60`.
  - `cost.source='user'` → ledger preserves user value, bypasses cap scaling.
  - AI emits $8 dinner (below floor) → ledger falls back to reference value (existing floor behavior).
  - Flight category preserved as `category='flight'`.
- `src/components/planner/budget/__tests__/budgetLineItemUnits.test.tsx`
  - 2 travelers, `cost_per_person_usd=30` → line renders `$30/pp × 2 = $60` (or visual equivalent).
  - 1 traveler → line renders `$60` (no `/pp` suffix).

### Files

- Edit `supabase/functions/_shared/write-activity-costs.ts`
- Edit `src/components/planner/budget/BudgetTab.tsx`
- Add `supabase/functions/_shared/__tests__/write-activity-costs.honors-json.test.ts`
- Add `src/components/planner/budget/__tests__/budgetLineItemUnits.test.tsx`
- Add `supabase/migrations/<ts>_backfill_activity_costs_from_json.sql` (one-shot edge-fn trigger or RPC)
- Update `mem://constraints/finance/ledger-is-card-source-of-truth` with the writer-honors-JSON sub-rule.

### Out of scope

- The header `Trip Total` already matches via `useDisplayedTripTotal`; no change needed.
- The card-side `getLedgerOverride` keeps its current logic — once the writer is honest, the card and ledger naturally agree.
