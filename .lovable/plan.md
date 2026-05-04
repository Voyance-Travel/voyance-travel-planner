## Root cause

Three things sum into the "Trip Total" header, and they aren't deduped against each other:

1. **`baseTotal`** — canonical sum from `activity_costs` (includes a day-0 logistics-sync hotel row of $2,850 and any flight row).
2. **`manualExtraCents`** — sum of every `trip_payments` row whose `item_id` starts with `manual-` (your $2,400 hotel + $500 L'Arpège).
3. **`payableTotalCents`** — sum from `usePayableItems`, which independently re-derives the hotel/flight from `activity_costs` AND adds the same manual entries via `addManualGroups('hotel'|'flight'|...)`.

Then PaymentsTab does:
```ts
const estimatedTotal = Math.max(baseTotal + manualExtraCents, payableTotalCents);
```

So when you manually add a hotel for $2,400, you get:
- `$2,850` (activity_costs day-0 hotel from logistics-sync)
- `+ $2,400` (manualExtra hotel)
- = **two hotels counted**, even though there's only one stay.

The same shape applies to flights. And because `Math.max` picks whichever stack is bigger, every regeneration / hotel-selection sync that injects a fresh day-0 row makes the number jump again. That's the "growing across sessions" effect — nothing is being added behind your back, the same expense is being counted twice (and on regen, sometimes three times).

For your trip right now:

```text
activity_costs sum     $4,506   (includes $2,850 day-0 hotel)
+ manual extras        $2,900   ($2,400 hotel + $500 L'Arpège)
                       ──────
estimatedTotal         $7,406  ← double-counts the hotel
```

EUR conversion ≈ €6,900, but the visible €3,875 you saw earlier was a midway state before the latest sync — same bug, different snapshot.

## Fix

Single change in `src/components/itinerary/PaymentsTab.tsx`:

1. When computing `manualExtraCents`, **exclude any manual hotel or flight entry whose category already has a day-0 row in `activity_costs`**. The manual entry is treated as a *user override* of the canonical row, not an addition. (For dining / transport / shopping / activity / other there is no day-0 equivalent, so they remain additive.)

2. Stop using `Math.max(baseTotal + manualExtra, payableTotalCents)`. Use `baseTotal + filteredManualExtra` as the single value. Drop the `payableTotalCents` floor — it was the symptom of fearing the snapshot was stale, but it's the thing that magnifies the double-count.

3. Mirror the same filtering inside `usePayableItems` so the **expenses list** below also doesn't show both the canonical hotel row AND the manual hotel row. When a manual hotel/flight exists, it wins; the day-0 ledger row is hidden in the list (still present in the DB so refresh / undo is safe).

### Out of scope (intentional)

- We are NOT mutating `activity_costs` when a manual hotel is added. Keeping the ledger row makes it trivial to delete the manual override and revert to the canonical estimate.
- No DB migration. No backend change. No credit charge.

## Files touched

- `src/components/itinerary/PaymentsTab.tsx` — filter `manualExtraCents`, simplify `estimatedTotal`.
- `src/hooks/usePayableItems.ts` — when a manual hotel/flight payment exists, suppress the corresponding canonical hotel/flight row from the items list.

## Validation after fix (your current trip)

```text
activity_costs sum            $4,506
manual hotel ($2,400)         suppressed — overrides day-0 hotel $2,850
manual L'Arpège ($500)        +$500
                              ──────
estimatedTotal                $4,506 + ($500 - $2,850 + $2,400)
                            = $4,556
```

i.e. the manual hotel replaces the $2,850 estimate with the actual $2,400 paid; L'Arpège is genuinely new on top. Paid so far stays at $2,900. Math reconciles.
