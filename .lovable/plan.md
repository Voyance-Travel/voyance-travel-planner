## Payments ↔ Itinerary Total Drift — Investigation & Fix Plan

The Payments total going out of sync with the Itinerary/Budget total is a **separate code area** from the four bugs handled in the previous plan. The architecture intends `resolveCanonicalCostRows` as the single source of truth shared by `useTripFinancialSnapshot` (header) and `usePayableItems` (Payments line items). In practice three divergence paths can still produce a drift, and the user has confirmed all three appear at different times.

### Three confirmed divergence paths

```text
            ┌────────────────────────────────────────────┐
 activity_  │     resolveCanonicalCostRows (shared)      │
  costs ───►│  total + hotel + flight + miscLogged       │
            └──────────┬─────────────────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        ▼                              ▼
  useTripFinancial              usePayableItems
  Snapshot                      (Payments line items)
  + manual hotel/flight         + manual hotel/flight as
    OVERRIDE delta                separate "manual-*" rows
  + manual other ADD            + manual other rows
  + miscReserveCents            + reserve as synthetic row
                                  (only when reserveCents>0)

       ▲                                ▲
       │                                │
   Header /                       Bucket sum
   Trip Total      ◄── compared in PaymentsTab ──►   estimatedTotal
   (estimatedTotal)                 (bucketSumCents)
```

| # | Path | Why it drifts |
|---|------|---------------|
| A | Payments header ≠ Itinerary header / Budget total | Snapshot and Payments resolve the same canonical rows, but **manual hotel/flight** is treated as an OVERRIDE delta in `useTripFinancialSnapshot` and as ADD-ON `manual-*` rows in `usePayableItems`. When a manual hotel/flight exists alongside a canonical day-0 row, the two sides arrive at different totals. |
| B | Bucket sum ≠ Trip Total within Payments | `essentialItemsWithReserve = essentialItems` (reserve not folded), but `miscItems` *does* fold reserve when `reserveCents > 0`. Snapshot total includes `miscReserveCents` regardless. Mid-fetch race (snapshot total = 0, reserve > 0, then snapshot lands) flips the bucket→header relationship and can latch a "Totals differ" badge for one render. |
| C | trip_payments paid ≠ activity_costs estimated | Orphan archival is fire-and-forget RPC. Until the next refetch the snapshot has fewer "paid" rows than Payments, producing a transient overpayment / "Reconciling…" banner. Manual payments tagged with non-canonical `item_type` can also slip past the orphan filter on regenerated trips. |

The €2,272 Rome trip in the DB has 12 activity_costs rows summing to ~$681 with no `trip_payments` rows. This confirms the divergence is happening **in the client-side computation pipeline**, not in stored ledger data — exactly the structural seams above.

---

## Plan

### Step 1 — Telemetry first (1 file, no behaviour change)
**File:** `src/components/itinerary/PaymentsTab.tsx`

Replace the dev-only `console.assert` at line ~475 with a structured `console.warn` that always fires (gated to once-per-mount) and includes:
- `snapshotTotal`, `bucketSum`, `payableTotal`, `tripPaymentsPaidSum`
- `manualHotelCents`, `manualFlightCents`, `manualOtherCents`
- `canonicalHotelCents`, `canonicalFlightCents`
- `reserveCents`, `orphanArchiveFingerprint`
- `divergencePath: 'A' | 'B' | 'C' | 'none'` derived from which pair is mismatched

This lets us confirm which of A/B/C is firing on the next live drift report instead of guessing.

### Step 2 — Fix Path A: Single contract for manual hotel/flight
**Files:** `src/services/canonicalCostRows.ts`, `src/hooks/useTripFinancialSnapshot.ts`, `src/hooks/usePayableItems.ts`

Move the manual-payment fold-in **into the canonical resolver** so both consumers apply identical rules:
- Add a new optional `manualPayments: Array<{ item_type, item_id, amount_cents, quantity }>` arg to `resolveCanonicalCostRows`.
- Inside the resolver, derive `manualHotelDelta`, `manualFlightDelta`, `manualOtherCents` exactly once, applying the override-vs-add rule that `useTripFinancialSnapshot` already has.
- Return `manualHotelCents`, `manualFlightCents`, `manualOtherCents` on `ResolveResult`.
- `useTripFinancialSnapshot` stops doing the manual delta math itself and reads the resolver output.
- `usePayableItems`:
  - When a canonical hotel/flight day-0 row + manual hotel/flight both exist, render **one** row using the resolver's effective price (manual override wins), not two rows.
  - Manual "other" rows still surface as their own line items but their cents come from the same resolver pass so the per-row sum can never exceed `manualOtherCents`.

Net effect: bucket sum literally cannot diverge from snapshot total because they're computed from the same arithmetic.

### Step 3 — Fix Path B: Reserve handling parity
**Files:** `src/components/itinerary/PaymentsTab.tsx`, `src/hooks/useTripFinancialSnapshot.ts`

- Stop conditionally folding reserve into `miscItems`. Instead, always render reserve as a synthetic Misc row (or always exclude it from buckets and show as a separate banner row). Decision: keep it inside Misc but **also fold it into `essentialItemsWithReserve`-or-not consistently** — pick one home for reserve and keep it there.
- Snapshot: only set `miscReserveCents > 0` once `data.loading === false`. Currently `tripTotalCents > 0` is a proxy for "ready" and fails for hotel-only trips with $0 itinerary.
- Add a `reserveStable` boolean to the snapshot output; PaymentsTab only counts reserve when `reserveStable && snapshotReady`. Removes the mid-fetch race.

### Step 4 — Fix Path C: Synchronous orphan reconciliation
**File:** `src/hooks/useTripFinancialSnapshot.ts` + `archive_orphan_trip_payments` RPC

- Today the orphan archival is a fire-and-forget RPC that requires a second refetch to settle. Change to:
  1. Identify orphan payment ids in the snapshot pass.
  2. **Subtract** their amounts from `paidFromTripPayments` *immediately* in the same render (don't wait for the RPC to complete).
  3. Continue dispatching the archive RPC in the background for cleanup.
- Result: the moment the snapshot lands, "paid so far" already reflects what the canonical view will show, and the booking-changed coalesce timer can't latch a stale overpayment.

### Step 5 — Lock the contract with tests
**File:** `src/services/__tests__/canonicalCostRows.test.ts` (extend)

Add three regression fixtures:
1. Trip with canonical day-0 hotel ($1500) + manual hotel ($1800) → expect total uses $1800 once, no double-count.
2. Trip with reserve $200 + 3 activity rows → snapshot total == bucket sum == sum of resolver rows + reserve, in both `loading` and `loaded` states.
3. Trip with paid trip_payment whose `item_id` was regenerated → snapshot's `paidCents` excludes it on the same pass that surfaces the orphan, no second refetch needed.

### Step 6 — Memory entry
Add `mem://constraints/payments/single-resolver-manual-fold` documenting that **manual hotel/flight/other math lives only in `resolveCanonicalCostRows`**, that orphan trip_payments are subtracted synchronously, and that reserve has exactly one bucket home.

Update `mem://index.md` Core entry on Payments to reference the consolidated rule.

---

## Out of scope
- Re-architecting `trip_payments` schema (the contract is fine; the leak is in client math).
- Touching the four bugs from the previous plan (sentence fragments, post-checkout sweep, health score ghost, telemetry counters) — they're already deployed.
- Server-side recomputation of payment intent amounts at checkout — already done via `book-activity` / `verify-payment`; the drift here is a *display* problem, not a Stripe pricing problem.

---

## Files touched
- `src/services/canonicalCostRows.ts` (extend with manual-fold)
- `src/services/__tests__/canonicalCostRows.test.ts` (3 new fixtures)
- `src/hooks/useTripFinancialSnapshot.ts` (delegate manual + synchronous orphan subtract)
- `src/hooks/usePayableItems.ts` (use resolver manual output, dedupe canonical+manual hotel/flight)
- `src/components/itinerary/PaymentsTab.tsx` (telemetry + reserve consistency)
- `mem://constraints/payments/single-resolver-manual-fold.md` (new)
- `mem://index.md` (one-line core update)

## Validation
1. Open the €2,272 Rome trip in preview → confirm `[PaymentsTab] divergence` warn is now `none`.
2. Add a manual hotel expense larger than the canonical day-0 hotel → bucket sum and header still match.
3. Run repair-day / Fix Timing → no "Reconciling…" loop, no transient "Totals differ".
4. Regenerate the trip with a stale paid trip_payment → "Paid so far" drops to the canonical figure on the first snapshot, not the second.
