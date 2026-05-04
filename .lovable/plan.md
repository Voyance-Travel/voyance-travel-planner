## Problem

Day 2 "Local transit" totals $140 because the cost pipeline auto-prices every transit sub-leg as a taxi at full retail (e.g. $54 for one intra-Paris hop). The user never picked taxi as their mode — the AI inserted "Taxi to …" titles and the cost layer faithfully estimated taxi fares from them.

Two real bugs feed this:

1. **Auto-taxi titling.** Stage-2 itinerary generation labels short intra-city hops as "Taxi to X" by default. In a metro-rich city like Paris this should default to metro/walk, not taxi.
2. **Unconfirmed fares counted as committed spend.** Even when "Taxi" is in the title, those rows go straight into `activity_costs` and the Payments grand total without any "user confirmed this mode" flag. Compare to the placeholder-departure-transfer rule, which already keeps unmoded transfers at $0.

## Fix

### 1. Treat AI-inserted intra-city taxis as unconfirmed (cost = $0 until user picks)

In `supabase/functions/generate-itinerary/action-repair-costs.ts`, extend the placeholder-departure logic to a broader "unconfirmed transit" rule:

- If `category === 'transport'` AND title matches `^(taxi|cab|uber|lyft|rideshare|private car)\b.*\bto\b` AND `activity.cost?.basis` is not `'user' | 'user_override'` AND `booking_required !== true` → write the row as `cost_per_person_usd: 0`, `source: 'unconfirmed_transit'`, `notes: '[Choose a mode — taxi/metro/walk]'`.
- This mirrors the existing `placeholder_departure` branch (lines 112–138) and is consistent with the [Placeholder Departure Transfer memory](mem://constraints/itinerary/placeholder-departure-transfer-no-cost).

The transit row still appears on the day card with a "Choose mode" hint, but it does **not** inflate the Payments total.

### 2. Suppress unconfirmed-transit sub-items from the grouped Payments row

In `src/hooks/usePayableItems.ts` (the transit grouping branch around lines 291–307):

- Skip sub-items whose `activity_costs` row has `source === 'unconfirmed_transit'` OR `cost_per_person_usd === 0`.
- If the day's bucket ends up empty, don't emit the "Local transit — Day N" row at all.

### 3. Lower the taxi base + scale for compact European cities

`src/lib/cost-estimation.ts` line 442 currently sets `transportBase = 20` for any "taxi/cab" title. Combined with the Paris cost multiplier this produces ~$27–$54 per leg. This estimator should only fire when the user *has* confirmed taxi (basis = `user`), so:

- Keep the $20 base for confirmed taxis (it's a defensible Paris average).
- Make sure the estimator is **not** called on rows already classified `unconfirmed_transit` upstream — guard via the same title-without-mode-confirmation check used in repair-costs.

### 4. Stage-2 default-mode bias (small, defensive)

In the itinerary generation prompt section that names transit legs, add a one-liner rule: *"For intra-city hops under ~3 km in cities with strong metro coverage (Paris, London, Tokyo, NYC, Berlin, Madrid), title legs as 'Metro to X' or 'Walk to X', not 'Taxi to X', unless the user has explicitly opted into taxi-heavy travel."* This stops the bug at the source for future generations.

## Files to change

- `supabase/functions/generate-itinerary/action-repair-costs.ts` — add `unconfirmed_transit` branch
- `src/hooks/usePayableItems.ts` — filter zero-cost / unconfirmed transit sub-items
- `src/lib/cost-estimation.ts` — short comment + optional guard
- `supabase/functions/generate-itinerary/` prompt for stage-2 transit naming
- One-time SQL: zero out existing `activity_costs` rows for the affected trip where `category='transport'` and the activity title starts with "Taxi to" / "Travel to" without a user-confirmed `cost.basis`

## Result

- Day 2 "Local transit" drops from $140 → $0 (with a visible "Choose mode" hint on each leg).
- Users explicitly upgrade a leg to Taxi when they want it; only then does it hit the Payments total.
- New trips stop generating "Taxi to …" titles for short central-Paris hops in the first place.
