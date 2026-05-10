## Context

You suspect F&D shows ~$1,412 for 6 dining items on a 2-guest Florence trip because `cost_per_person × num_travelers` is being applied twice. I traced the full cost path and want to verify with DB evidence before changing code, because a code-only audit shows **single multiplication everywhere**.

## What I found in the code

### Schema (single source of truth)
`activity_costs.total_cost_usd` is a **stored generated column**:
```sql
total_cost_usd NUMERIC(10,2) GENERATED ALWAYS AS (cost_per_person_usd * num_travelers) STORED
```
(`supabase/migrations/20260301122724_*.sql:43`)

### All writers store per-person
- `generation-core.ts:3341` — `cost_per_person_usd: Math.min(costPerPerson, 2000)` from `cost_reference` table (already per-person)
- `action-repair-costs.ts:486` — `cost_per_person_usd: finalCost` (per-person from same reference)
- `backfill-activity-costs/index.ts:301` — same pattern
- `recordCommittedExpense` (`tripBudgetService.ts:714`) — splits `amountCents/100` into `cost_per_person_usd` with `num_travelers: 1` so the generated col equals the original

### All readers multiply exactly once
- `getBudgetLedger` (`tripBudgetService.ts:512`) — `Math.round(costPerPerson * numTravelers * 100)` — once
- `canonicalCostRows.ts:103` — `(cost_per_person_usd || 0) * (num_travelers || 1) * 100` — once. This is the resolver behind both `usePayableItems` (Payments tab) and `useTripFinancialSnapshot` (trip total).
- DB views (`v_trip_total`, `v_budget_by_category`, `v_payments_summary`) sum the generated `total_cost_usd` — also one multiplication
- Existing regression test (`usePayableItems.test.ts:194-197`) explicitly asserts a 2-guest dining row stored `cost_per_person_usd: 15, num_travelers: 2` produces `$30`, not `$60`

### So $1,412 / 6 items / 2 guests = $117 per person per meal
This is on the high end but **plausible** in three real scenarios that don't involve double-multiplication:
1. **Premium / luxury budget tier** — the cost reference returns `cost_high_usd`, often $90-$150/pp for Florence dining
2. **Michelin / fine-dining floor** in repair (Florence has venues in `KNOWN_FINE_DINING_STARS` per memory) — applies a per-person floor
3. **Bad legacy row** — an old AI write (before the per-person convention was enforced) stored a total in `cost_per_person_usd`. With `num_travelers=2` it would now display 2× too high.

I can't tell which without seeing the actual rows.

## Plan

### Step 1 — Read the suspect Florence trip's rows (read-only)
You provide the trip ID (or I can fetch the most recent Florence trip). Then run:

```sql
SELECT day_number, category, source, confidence,
       cost_per_person_usd, num_travelers, total_cost_usd, notes
FROM activity_costs
WHERE trip_id = '<florence-trip-id>'
  AND category = 'dining'
ORDER BY day_number, created_at;
```

Decision matrix:
- If `cost_per_person_usd` ≈ $50-$120 with `num_travelers = 2` → **no bug**, F&D total is correct for the tier. Fix is to challenge the cost-reference value, the budget tier, or a Michelin-floor mis-application — not the rollup.
- If `cost_per_person_usd` ≈ $200+ with `num_travelers = 2` → **legacy double-store**. Fix below.
- If any `num_travelers > 2` on a 2-guest trip → mis-set traveler count. One-shot UPDATE plus a write-time guard.

### Step 2 — Add a DEV-mode parity assertion in `getBudgetLedger`
Regardless of root cause, add the defensive check you proposed. It's cheap insurance and surfaces drift immediately on any future regression:

```ts
if (import.meta.env.DEV) {
  const sumOfRows = liveCostRows.reduce(
    (acc, r) => acc + Number(r.total_cost_usd || 0), 0
  );
  const sumOfPersonRows = liveCostRows.reduce(
    (acc, r) => acc + (Number(r.cost_per_person_usd || 0) * (Number(r.num_travelers) || 1)),
    0
  );
  if (Math.abs(sumOfRows - sumOfPersonRows) > 1) {
    console.warn('[budget] cost mismatch', { sumOfRows, sumOfPersonRows });
  }
}
```

(Note: this compares the DB generated column against the manual product. If they ever diverge, something is wrong with our data, not our math.)

### Step 3 — Add a one-shot diagnostic toast/log on Payments mount
Same parity check at the canonical resolver level (`canonicalCostRows.ts`), so any user — not just one looking at devtools — surfaces the warning if a future regression slips in.

### Step 4 — Conditional fix
Only after Step 1's data:
- **Case A (correct data, premium tier)**: no code change. Optionally tighten `cost_reference` premium values for Florence dining, or document in memory that $100+/pp Florence dinners are intentional at premium tier.
- **Case B (legacy double-stored rows)**: write a migration that halves `cost_per_person_usd` only on rows where `num_travelers > 1` AND `source IN ('legacy', 'fallback')` AND `created_at < '<cutoff>'`, and add a write-time CHECK trigger to reject any single-row insert where `cost_per_person_usd > 500` without an explicit `[high-confidence override]` notes tag.
- **Case C (mis-set num_travelers)**: one-shot UPDATE setting `num_travelers` to the trip's true traveler count; add a backfill safeguard in `generation-core.ts` to read travelers from `trips.travelers` rather than the `context` object.

## Verify

- `getBudgetLedger` parity check in console must stay silent on a fresh Florence trip.
- Generate a 2-guest Florence trip:
  - Open Payments tab; F&D total should fall in the band justified by the rows in Step 1.
  - Sum of (F&D + Activities + Transit + Hotel + Flight + Misc) must equal trip total within $1.
- Re-run the existing `usePayableItems.test.ts` ($30, not $60) regression to confirm no breakage.

## Open question for you

Do you have the Florence trip ID handy? I need it for Step 1 — without it I'd be patching speculatively, and the wrong fix here will silently halve correct premium-tier prices for everyone.