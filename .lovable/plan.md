## Problem

Day 4 in Payments shows `Travel to Airport — $185` even though the itinerary card reads "Transfer to Airport — plan your transport details" (a placeholder, no mode chosen).

Root cause traced from DB row:

```
activity_id … category=transport day=4
cost_per_person_usd=92.39 num_travelers=2 → $184.78 ≈ $185
source=itinerary-sync
notes=[Auto-corrected from $120, exceeded 3x ref high $3.00]
```

The JSON activity is a generic departure stub with no mode (`title: "Travel to Airport"`, `location.name: "Airport"`, `bookingRequired: false`). Two layers of code commit a price for it:

1. `src/components/itinerary/EditorialItinerary.tsx` `syncBudgetFromDays` writes any activity whose JSON has a non-zero `cost` into `activity_costs` (source `itinerary-sync`). The departure stub arrives with a $120 number (carried over from an earlier estimate / repair pass) and gets persisted.
2. `src/lib/cost-estimation.ts` (used by the `usePayableItems` JSON-walk fallback) treats any `category=transport` with no recognized mode keyword as `transportBase = 5` × cost-multiplier — but it never zeroes a placeholder, and once a stale number is in JSON the estimator is bypassed.
3. `supabase/functions/generate-itinerary/action-repair-costs.ts` does *not* recognize the airport-departure stub as a placeholder; it routes it to `transport` with no subcategory (so `cost_reference|paris|transport|` returns metro $3) and the trigger then auto-corrects, but a later sync round-trips $92.39 (`ref.cost_high_usd × 3` artifact from a prior trigger version) back in.

The Paris `cost_reference` already has the right answer:
```
transport / airport_transfer  low $8  mid $15  high $60
transport / taxi              low $10 mid $20  high $45
transport / metro             low $1.80 mid $2 high $3
```

## Fix

Treat unscheduled departure transfers as **placeholders, not committed expenses**, and when we *do* need to surface them in Payments, use the `airport_transfer` reference row (mid = $15/pp, capped at high = $60/pp) — never a $92 random clamp.

### 1. Recognize the placeholder centrally

Add a small helper `isPlaceholderDepartureTransfer(activity)` in `src/lib/cost-estimation.ts`:

- title matches `/^(transfer|travel|head|go)\s+to\s+(the\s+)?(airport|station|terminal|port)\b/i` OR
- title matches `/^collect\s+luggage\s*&\s*transfer\b/i`
- AND `bookingRequired !== true`
- AND no mode keyword (`taxi|uber|lyft|private|car|metro|train|shuttle|bus`) in title/description
- AND no explicit user-set `cost.basis === 'user'` / `source === 'user_override'`

### 2. Stop committing a cost for placeholders

`src/components/itinerary/EditorialItinerary.tsx` `syncBudgetFromDays` (~line 1320):
- Before pushing into `activitiesForCostTable`, skip the row when `isPlaceholderDepartureTransfer(act)` is true. Rationale: the user hasn't chosen a mode, so no committed expense should exist.

`supabase/functions/generate-itinerary/action-repair-costs.ts` (~line 100):
- After `normCat`, if `category === 'transport'` and the title matches the placeholder pattern, write `cost_per_person_usd: 0`, `source: 'placeholder_departure'`, `notes: '[Departure transfer — choose a mode]'` and `continue` (no Michelin/ref pass).

### 3. Surface a clear, bounded estimate in Payments only when needed

`src/hooks/usePayableItems.ts` JSON-walk fallback (~line 396):
- When the activity is a placeholder departure transfer, do NOT call `estimateCostSync`. Instead, emit it under the per-day "Local transit" group with `amountCents = 0` and a `subItems` entry labeled `"Airport transfer (choose mode)"`. Also expose an inline "Estimated $15–$60/pp" hint via a new optional field on `PayableSubItem` (e.g. `estimateRange?: { low: number; high: number; currency: string }`) so the UI can render it without persisting.

`src/lib/cost-estimation.ts` `estimateCostSync` transport branch (~line 405):
- Add a guard: when title matches the airport-transfer placeholder regex AND no mode keyword is present, return `{ amount: 0, isEstimated: true, confidence: 'low', source: 'placeholder', reason: 'No transport mode chosen — see airport transfer options' }`. This prevents the unrelated `transportBase = 5 × 1.x` fallback from ever materializing as a committed price.

### 4. Database cleanup

New migration `cleanup-placeholder-airport-transfers.sql`:
- Zero any existing `activity_costs` rows where the JOINed JSON activity title matches the placeholder regex AND `source` is one of `itinerary-sync`, `auto_corrected`, `repair`, `reference_fallback`. Set `cost_per_person_usd = 0`, `source = 'placeholder_departure'`, append note `[Cleanup: zeroed placeholder departure transfer]`.
- This removes the $185 line for the affected trip and any others.

### 5. UI render of the placeholder row

`src/components/payments/...` (whichever renders `PayableSubItem`):
- When `subItem.estimateRange` is set and `amountCents === 0`, render text `"Airport transfer — est. $15–$60/pp (choose mode)"` instead of `"Free"`. No total impact.

## Out of scope

- Adding an actual mode picker in the itinerary card. (Filed as follow-up; current ask is to stop committing inflated prices.)
- Changing the `cost_reference` numbers themselves.

## Files touched

- `src/lib/cost-estimation.ts` (helper + estimator guard)
- `src/components/itinerary/EditorialItinerary.tsx` (skip in sync)
- `src/hooks/usePayableItems.ts` (placeholder branch in JSON-walk fallback, `PayableSubItem.estimateRange`)
- `src/components/payments/PaymentRow*.tsx` (render hint when `estimateRange` set) — exact file confirmed during implementation
- `supabase/functions/generate-itinerary/action-repair-costs.ts` (placeholder short-circuit)
- new migration `supabase/migrations/<ts>_cleanup-placeholder-airport-transfers.sql`

## Memory note

Add `mem://constraints/itinerary/placeholder-departure-transfer-no-cost` — "Generic 'Travel/Transfer to Airport' activities with no mode keyword and bookingRequired=false are placeholders. Never commit a cost; show est. range from `cost_reference.transport.airport_transfer` only."
