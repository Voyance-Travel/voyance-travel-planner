## Problem

The header strip renders `Days (group) X + Hotel Y = Trip Total Z` from three independent sources:

- `daysGroupUsd` ← `useTripDayBreakdown` (own Supabase fetch over `activity_costs`)
- `hotelChipUsd` / `flightChipUsd` ← `useTripFinancialSnapshot.effectiveHotelCents/effectiveFlightCents` (separate fetch)
- `tripTotalUsd` ← `useTripFinancialSnapshot.tripTotalCents` (same snapshot fetch)

Because the two hooks fetch independently and refetch on different cadences, the three numbers can transiently disagree. The current safety net (`stripDrift`) only fires when `chipSum > tripTotal + 1`. It does not protect the symmetric failure mode the user is reporting — `tripTotal == daysGroup` while `hotelChip > 0` — because that branch evaluates `false` and the chip-sum override is skipped, so the rendered equation reads `X + Y = X`. Confirmed across Casablanca, Kyoto, Osaka, Amsterdam (all with a Day-0 hotel row in `activity_costs` and `budget_include_hotel = true`).

This is a presentation bug. No backend math changes.

## Fix

Make the equation balance every render, regardless of which hook is mid-fetch.

### 1. `src/components/itinerary/EditorialItinerary.tsx` — header strip block (~lines 6109-6198)

- Compute `chipSumUsd = daysGroupUsd + hotelChipUsd + flightChipUsd` first.
- Replace the asymmetric `stripDrift` check with a symmetric one:
  - `displayedTripTotalUsd = max(tripTotalUsd, chipSumUsd)` whenever a hotel or flight chip is visible AND either side has loaded. This is the value rendered as "Trip Total" on the right.
  - The reserve/adjustment chip is then `displayedTripTotalUsd − daysGroup − hotel − flight` — by construction `≥ 0`, and when it's `> 0.5` we render it as "Reserve & adjustments" exactly as today.
- Add a "Reconciling…" hint (small muted text, no spinner) when `tripTotalUsd` and `chipSumUsd` differ by more than `$1` AND neither hook is in `loading` — so users see the equation balance immediately while a brief explanation acknowledges the late refetch. Suppress the hint inside the existing 4 s stabilisation window already used by the snapshot hook.
- Keep the existing dev-only `[STRIP_DRIFT]` warn but extend it to also fire on the symmetric case (`chipSumUsd + 1 < tripTotalUsd`) for telemetry.

### 2. `src/components/itinerary/__tests__/EditorialItinerary.headerStrip.test.tsx` (new)

Three deterministic cases driven directly against the strip's pure render helpers (extract the math into a small `computeHeaderStripValues` helper in the same file or a sibling module so it's testable without rendering the 12K-line component):

- `tripTotal === daysGroup` and `hotel > 0` → displayed Trip Total equals `daysGroup + hotel`, no negative reserve.
- `tripTotal > daysGroup + hotel` (Day-0 reserve genuinely present) → reserve chip surfaces the positive remainder, displayed Trip Total equals `tripTotal`.
- `tripTotal < daysGroup + hotel` (existing drift case) → displayed Trip Total equals `chipSum`, behaviour preserved.

### 3. `mem://constraints/finance/header-strip-mirrors-snapshot` — append note

Document the new invariant: "The visible equation is always `Days + Hotel + Flight + Reserve ≡ Trip Total`, achieved by displaying `max(snapshotTotal, chipSum)` on the RHS and folding any positive remainder into Reserve. Snapshot total is still the source of truth for any other consumer (Budget tab, Payments tab); only this strip's RHS adjusts for visible balance."

## Out of scope

- Canonical resolver, `useTripFinancialSnapshot`, `useTripDayBreakdown`, and the `activity_costs` write paths are not touched.
- Budget tab and Payments tab still read the unmodified `tripTotalCents` from the snapshot.
- No SQL migration.

## Risks

- The "displayed total" can briefly exceed the canonical `tripTotalCents` by the hotel/flight delta when one fetch is stale. Acceptable: the chip values are themselves canonical (Day-0 rows / manual override aware), so the displayed RHS is always a real cost the user owes — never an inflated phantom. The next refetch (≤ ~600 ms via the `booking-changed` follow-up timer) reconciles silently.
- Tests run against an extracted pure helper; no need to mount `EditorialItinerary` in jsdom.
