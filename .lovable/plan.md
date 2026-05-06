# Honor Planning Style -4 (Leaning Spontaneous)

## The Bug

`planning` is collected on the trait DNA (`-10 spontaneous … +10 planner`) and read into `TraitScores` in `profile-loader.ts`, but downstream the generation pipeline ignores it for negative (spontaneous) values:

- `effectiveTraitScores` in `compile-prompt.ts` only carries `pace`, `budget`, `adventure`, (now) `authenticity` — `planning` is dropped.
- `buildAllConstraints` has no "Spontaneous Mode" / "Planner Mode" prompt block.
- `deriveForcedSlots` in `personalization-enforcer.ts` does not relax density or insert flex windows for spontaneous travelers.
- The Density Protocol ("min 3 paid + 2 free", "no dead gaps >90m") is enforced uniformly — so a spontaneous lean is actively overwritten.

Result: -4 Spontaneous ends up as identical minute-packed itineraries.

## What to Build

### 1. Propagate `planning` through the pipeline
- Extend `effectiveTraitScores` in `pipeline/compile-prompt.ts` to include `planning` (mirror `authenticity`).
- Update signatures in `archetype-data.ts` (`getFullArchetypeContext`, `buildFullPromptGuidance(Async)`) and `archetype-constraints.ts` (`buildAllConstraints` traits arg) to accept optional `planning`.
- In `generation-core.ts`, pass `traits.planning` into `buildAllConstraints`.

### 2. Prompt-level "Planning Style Mode"
Add `buildPlanningStyleRules(planning)` in `archetype-constraints.ts`, called from `buildAllConstraints`:

- `planning <= -3` (Leaning Spontaneous):
  - Required: **at least 1 explicit "flex window" per day** of 90–120 minutes labeled with intentionally loose copy: "Wander {neighborhood}", "Free roam — follow your nose", "Open afternoon — café-hop or pivot".
  - Schedule **fewer hard-timed anchors per day** (cap scheduled paid items at 3, not the usual 4–5). Soft cap leaves room.
  - Use language like "around 3pm" / "late afternoon" rather than "3:15pm" in `description` text (timestamps still required for the data model).
  - At least 1 meal per day should be marked as a "neighborhood pick — choose on the day from the suggestions" rather than a hard reservation.
- `planning <= -6` (Fully Spontaneous):
  - Bump to **2 flex windows per day**, only 2 hard anchors max, no advance reservations except hotel + flights/trains.
- `planning >= +4` (Detailed Planner): keep current dense behavior; add explicit "every slot timed and reservation-noted" reminder.
- `planning between -2 and +3`: balanced (no extra rules).

### 3. Relax density rules for spontaneous travelers
In `personalization-enforcer.ts > deriveForcedSlots`:
- When `planning <= -3`, push a `flex_window` slot per day with description "Open / unplanned wander block (90–120m)" and validation tags `['flex', 'wander', 'free-roam', 'unplanned']`.
- When `planning <= -6`, push **two** `flex_window` slots per day.

In the Density Protocol logic (search `Dead gaps >90m` / `Min 3 paid` enforcement — likely in `repair-day.ts` and/or `personalization-enforcer.ts`):
- Skip the "fill morning gap" / "no dead gap >90m" repairs when `planning <= -3`. Spontaneous travelers EXPECT loose space.
- Lower the per-day paid-activities floor to 2 (from 3) when `planning <= -3`; to 1 when `planning <= -6`.

### 4. Validation reminder
Append rule #12 to the "VALIDATION BEFORE FINALIZING" checklist in `buildAllConstraints`:
> 12. Planning trait ≤ -3 — does each day have at least one explicit flex/wander window (90–120m) and no more than 3 hard-timed anchors? → If missing, REPLACE one scheduled item with a flex window.

### 5. UI copy (optional, low risk)
No UI changes required — the flex windows render as normal activity cards. Their titles ("Wander Trastevere", "Open afternoon") communicate the looseness.

## Files to Modify
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (propagate `planning`)
- `supabase/functions/generate-itinerary/archetype-data.ts` (signature updates)
- `supabase/functions/generate-itinerary/archetype-constraints.ts` (new `buildPlanningStyleRules`, wire into `buildAllConstraints`, add validation rule #12)
- `supabase/functions/generate-itinerary/generation-core.ts` (pass `planning` into `buildAllConstraints`)
- `supabase/functions/generate-itinerary/personalization-enforcer.ts` (forced flex_window slots; relax density floors)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (skip dead-gap fills when spontaneous)

## Verification
- A trip with Planning -4 should:
  - Show ≥1 flex/wander block per day with copy like "Wander Testaccio — pivot as you go".
  - Have ≤3 hard-scheduled paid anchors per day; no auto-injected fillers in morning/afternoon gaps.
  - Continue to honor hotel checkout, flights, departures (logistics anchors are unaffected).
- A trip with Planning +5 behaves as today (or slightly tighter).
- Other traits (pace, adventure, authenticity, budget) keep working.

The user should tap "Refresh Day" or regenerate to see the spontaneous lean applied.
