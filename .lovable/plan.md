## NEW.3 — Departure-day chronology validator (post-checkout coherence signal)

### Context

The post-checkout pruning logic the user describes already runs as a **repair** in two places:

1. `repair-day.ts` §14b "POST-CHECKOUT COHERENCE PRUNE" (lines 3234–3290) — drops non-logistics activities scheduled after the last `checkout` row on departure days, then re-runs `repairDepartureSequence`.
2. `_shared/post-checkout-prune.ts::pruneNonLogisticsAfterCheckout` — save-time twin called from `action-save-itinerary.ts:141`.

What's **missing** is a matching **validator** in `validate-day.ts`. Today no `ValidationResult` is emitted for this condition, so:

- The failure never appears in `repair_log` / health-score / `[VALIDATION_GATE]` telemetry.
- The repair in §14b only fires because `isDepartureDay` is true — not because a validator flagged it. That means cases where §14b is short-circuited (early returns, skipped repair runs, manual edits without save) are caught only at save-time, with no upstream signal.

A dedicated validator closes that observability gap and lets `applyValidationGate` block bad days that somehow slip past §14b.

### Decision: reuse `LOGISTICS_SEQUENCE`, not a new code

The user's spec uses `FAILURE_CODES.DEPARTURE_SEQUENCE`, which **does not exist**. Existing failure code `LOGISTICS_SEQUENCE` already covers departure-day sequencing (`checkLogisticsSequence`, repair-day §11, §14b all tag it). Adding a parallel `DEPARTURE_SEQUENCE` code would fragment telemetry and require new wiring in `validation-gate.ts` for no semantic gain. The validator below emits `LOGISTICS_SEQUENCE` with a `field: 'startTime'` discriminator and a distinct message, so dashboards still distinguish "post-checkout leak" from generic departure-order issues via message string.

### Changes

**1. `supabase/functions/generate-itinerary/pipeline/validate-day.ts`**

Add `checkDepartureChronology(activities, isLastDay, results)` (matches user's spec but emits `LOGISTICS_SEQUENCE`). Detection logic mirrors `pruneNonLogisticsAfterCheckout` so validator and repair agree on what "post-checkout leak" means:

- Find LAST `checkout` row (`category === 'accommodation'` + `/check[\s-]?out|checkout/`).
- For every activity after it that is NOT departure logistics (uses the same "departure logistics" classification as the existing pruner: airport/station/terminal/departure/flight/train/return-home in title, OR `category` in `transport|transit|logistics`), push:
  ```ts
  { code: FAILURE_CODES.LOGISTICS_SEQUENCE, severity: 'critical',
    message: `Activity "${a.title}" is scheduled after final checkout — should be removed or moved before checkout`,
    activityIndex: i, field: 'startTime', autoRepairable: true }
  ```
- Skip locked/userAdded/userEdited/extracted/pinned/isManual rows (universal locking parity with §14b and save-time prune).

Wire into the validator chain right after the existing `checkLogisticsSequence` call (line 145):
```ts
if (isLastDay) {
  checkLogisticsSequence(activities, returnDepartureTime24, results);
  checkDepartureChronology(activities, isLastDay, results);
}
```

**2. `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — no change needed.

§14b already mutates the day in place and pushes `LOGISTICS_SEQUENCE` repair entries with `action: 'pruned_post_checkout_non_logistics'`. The new validator's emitted results will be cleared by §14b on the same pass; if §14b is somehow skipped, the save-time `pruneNonLogisticsAfterCheckout` is the final net (mem://constraints/itinerary/post-checkout-save-time-sweep).

**3. No new failure code, no migration, no edge function deploys** beyond the validate-day rebuild that ships with `generate-itinerary`.

### Verification

```
grep -n "checkDepartureChronology" supabase/functions/generate-itinerary/pipeline/validate-day.ts
```
Expect 2 matches (definition + call site).

Smoke shape: synthetic last-day activities `[{title:'Checkout', category:'accommodation', startTime:'10:00'}, {title:'Visit market', category:'sightseeing', startTime:'11:00'}, {title:'Taxi to Airport', category:'transport', startTime:'13:00'}]` should yield exactly one `LOGISTICS_SEQUENCE` result for the market activity, and §14b should drop it on the next repair pass.

### Files touched

- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — add `checkDepartureChronology` function + 1-line call site under the existing `if (isLastDay)` block.
