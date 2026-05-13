## The bug

Casablanca trip (`fce9c4ba-…`, 2 travelers, `budget_include_hotel=true`, currency USD, no `trip_payments`):

- `activity_costs` rows sum to **$1,337** total (Hotel $525 + activities $730 + dining $50 + transport $32).
- "Total from itinerary" on the Budget tab shows **$812** = $1,337 − $525 (hotel missing).
- `getBudgetSummary.committedHotelCents` correctly reports $525, so the per-row Hotel chip displays $525.
- That asymmetry is the entire discrepancy the user is calling out: the per-row chips include the hotel, the `Total from itinerary` line does not.

The number originates in `useTripFinancialSnapshot` → `resolveCanonicalCostRows({ includeHotel:true, … }).effectiveTotalCents`. By inspection the resolver should add the day-0 hotel logistics row to `totalCents` (the `isLogistics(row)` branch falls through to `shouldCountRow → true → totalCents += cents`), so something in that path is silently dropping the row in production. The likeliest leak — and the one the existing memory `Canonical Hotel/Flight Cents` warns about — is that the snapshot's first paint runs before `tripData` arrives, so `includeHotel` resolves to its default `true` for the resolver call but the row itself is excluded by an earlier orphan-id filter that uses a different signal. We need to instrument and isolate which branch is dropping the row.

The user's "$1,855" line-item sum can't be reconciled from the data alone (the visible Budget allocation rows show `used / allocated` pairs and the user is summing both columns in one or two of them); the actionable, verified bug is the **$525 hotel missing from `tripTotalCents`**, which is exactly the $1,043 vs. $812 mismatch pattern they describe.

## Fix

Trace the leak with a one-paint diagnostic, then close it inside the canonical resolver so every consumer (snapshot, payable items, Budget tab total) agrees.

### Steps

1. **`src/services/canonicalCostRows.ts` — diagnostic + fix**
   - Add a one-shot dev-only `console.warn('[canonicalCostRows] hotel-row-dropped …')` inside the main loop when `cat === 'hotel'`, `includeHotel === true`, and the row is NOT pushed into `out` (covers every early `continue` branch: walking-leg, `cents <= 0`, orphan drop, etc.).
   - Tighten the orphan-drop branch (lines 227–239) so it never fires for `isLogisticsRow === true` even when `row.activity_id` is set — a Day-0 hotel row whose synthetic `activity_id` doesn't match any live activity must still be counted because logistics rows by definition have no live-activity counterpart. Today the guard `if (!isLogisticsRow && row.activity_id && !lookup)` already protects this, but if the row's `day_number` ever coerces to non-zero (legacy data, or a future writer setting `day_number=1` for a Day-0 hotel), it falls into the orphan branch and disappears. Add a redundant `cat === 'hotel' || cat === 'flight' → never drop` guard.

2. **`src/services/canonicalCostRows.ts` — JSON-rescue category mapping**
   - The JSON-missing-row rescue (lines 288–314) only fires for live activities with `jsonCost > 0`. Confirm via the diagnostic that the hotel is not being silently double-counted there (`mapped` returns null for `hotel` because `normalizeCanonicalCategory` doesn't include hotel). No change unless the diagnostic fires.

3. **`src/services/__tests__/canonicalCostRows.test.ts` — regression test**
   - "Day-0 hotel row with synthetic `activity_id` not in liveActivities is counted into `effectiveTotalCents` when `includeHotel=true`" — fixture mirrors Casablanca's exact shape (hotel `day_number=0`, `source='logistics-sync'`, `activity_id` not in liveActivities, no `trip_payments`).
   - Asserts `effectiveTotalCents === Day-0 hotel cents + Day-1+ activity cents` (i.e., the bug case from the user report).

4. **`src/components/planner/budget/BudgetTab.tsx` — defensive UI label**
   - When `snapshot.tripTotalCents > 0` AND `(snapshot.includeHotel ? snapshot.committedHotelCents : 0) + (snapshot.includeFlight ? snapshot.committedFlightCents : 0) + sum(discretionary used) > snapshot.tripTotalCents + 100¢`, render a small "i" tooltip next to "Total from itinerary" reading: "Some line items above are not included in this total. [Investigating]." Cheap visual safety net; does not paper over the real fix.

5. **`mem://constraints/finance/header-strip-mirrors-snapshot`**
   - Append: "Day-0 hotel/flight logistics rows MUST never be dropped by the canonical resolver's orphan branch — even when their synthetic `activity_id` isn't present in `liveActivities`. The `isLogistics(row)` short-circuit + redundant `cat === 'hotel'/'flight' → never drop` guard close the Casablanca pattern (Hotel chip = $525, Trip Total = $812 missing the hotel)."

### Verification

- New regression test passes.
- Casablanca trip (`fce9c4ba-…`) reads "Total from itinerary $1,337" (Hotel $525 + days $812).
- The diagnostic warn does not fire on a clean trip.

### Out of scope

- Multi-currency conversion. All rows on this trip are USD, so no FX is involved in the discrepancy.
- The user's "$1,855 line-item sum" arithmetic. The verified, reproducible root cause is the $525 hotel missing from `tripTotalCents`; the discretionary `used / allocated` chips already match `getBudgetSummary` and don't need to change.
