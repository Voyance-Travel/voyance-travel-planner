## The bug

For trip `7ea828ac` (Paris, Splurge-Forward, 4 days, $1,796 budget), `activity_costs` shows:

| Category  | Total |
|-----------|-------|
| dining    | $743  |
| transport | $231  |
| activity  | $48   |
| cultural  | $26   |

That's **$74 in Activities vs a $629 Activities allocation** (35% of $1,796). The Splurge-Forward preset is doing nothing on the generation side — it only changes UI targets in the Budget tab.

### Root causes

1. **Generator ignores `budget_allocations` entirely.** A repo-wide search for `budget_allocations` / `activities_percent` / `spendStyle` inside `supabase/functions/generate-itinerary/` returns **zero hits in the prompt and selection code**. The preset (food 35 / activities 35 / transit 10 / misc 5 / buffer 15) is purely a UI artefact today. The model has no instruction to spend ~$629 on paid experiences over 4 days, so it fills days with free venues (Sacré-Cœur exterior, Trocadéro, Tuileries) and a couple of $13–24 paid items.

2. **Splurge spend is being absorbed by dining caps, not actual experiences.** Two dinner rows exist at exactly $70/pp with notes `[Auto-corrected from $120.00, exceeded 3x ref high $15.00]`. The DB trigger / repair pass clips dinners to `dining|dinner.cost_high_usd × 3 = $65×3 → mid $30/$70` whenever a venue isn't in `KNOWN_FINE_DINING_STARS`. Sacré Fleur (a famous Montmartre bistro) isn't in that map, so the splurge dinner is silently downgraded — but the generator was given no instruction to put that money into a museum/tour instead.

3. **No post-generation "activities floor" check.** `universal-quality-pass` enforces meals, pacing, and Michelin floors but never compares cumulative paid-activity spend against the budget allocation.

## Plan

### 1. Pass budget allocations into the generator
- In `pipeline/compile-prompt.ts`, read `trips.budget_allocations`, `budget_total_cents`, `budget_currency`, `travelers`, and total day count.
- Compute absolute per-trip targets: `activitiesTarget = total × activities_percent`, same for food/transit. Also compute a per-day activities target (`÷ days`).
- Inject a new "Spend allocation targets" section into the prompt with explicit dollar targets and one-line guidance per preset:
  - Splurge-Forward → "≥1 paid signature experience per day ($40–120/pp): museum tickets, guided tours, wine tastings, river cruises, cooking classes, premium attractions."
  - Balanced → "1 paid experience most days; mix free landmarks with at least one ticketed venue."
  - Value-Focused → keep current behavior.

### 2. Activities-floor enforcement in the universal quality pass
- Add an `activitiesSpendFloor` check in `universal-quality-pass.ts` after generation/repair completes:
  - Floor = `min(activitiesTarget × 0.5, $30 × paidDays × travelers)` (so we don't force spend on very small budgets).
  - If `sum(activity_costs where category in ('activity','cultural')) < floor`, request a targeted repair: replace one free venue per under-spent day with a ticketed alternative drawn from `cost_reference` (museum/tour mid-price for the city) plus the existing `KNOWN_TICKETED_ATTRACTIONS` map.
  - Log to `cost_change_log` with reason `activities_floor_upgrade` so the UI can attribute the swap.

### 3. Stop dinner cap from silently absorbing splurge intent
- In `action-repair-costs.ts` and the DB `validate_activity_cost` trigger:
  - When a dining row is about to be capped from a high price (>2× ref high) and `trips.budget_allocations.activities_percent ≥ 30` and the venue is in a known acclaimed-bistro list (extend `KNOWN_FINE_DINING_STARS` with a new `KNOWN_ACCLAIMED_BISTROS` map: Sacré Fleur, Chez l'Ami Jean, Le Chateaubriand, Septime, etc., floor €60–90/pp), keep the original price (or floor) instead of clipping to $70.
  - Otherwise behavior unchanged.

### 4. Surface the mismatch in the Budget Coach
- `BudgetCoach.tsx` already detects food-heavy patterns. Add a sibling check: if `actualActivities < 0.4 × allocatedActivities` and `actualFood > 0.9 × allocatedFood`, show a "Your splurge is going to dinners, not experiences" suggestion with a one-click "Add a signature experience to Day N" CTA that opens the existing add-activity flow pre-filtered to ticketed attractions.

### 5. Tests
- Unit test for new prompt section with sample allocation maps.
- Test that the activities-floor pass converts a $0 free venue into a paid one when the trip is under target.
- Test that Sacré Fleur and Chez l'Ami Jean are no longer capped to $70 under a Splurge-Forward preset.

## Files touched

- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — inject allocation targets
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — activities-floor pass
- `supabase/functions/generate-itinerary/action-repair-costs.ts` — acclaimed-bistro exemption
- `supabase/functions/generate-itinerary/sanitization.ts` — `KNOWN_ACCLAIMED_BISTROS`
- `supabase/migrations/<new>.sql` — extend `validate_activity_cost` trigger to skip the 3× cap when acclaimed-bistro flag is set in a new shared list (or read venue name allow-list)
- `src/components/planner/budget/BudgetCoach.tsx` — splurge-mismatch nudge
- Test files in the corresponding directories

## Out of scope

- Re-pricing already-generated trips automatically. The fix takes effect on next generation or when the user invokes "Repair costs" from the Budget tab.
- Touching hotel / flight numbers — those are separate ledgers.

Approve to implement?