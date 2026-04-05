

## Fix Phantom Pricing — The Real Root Cause

### Discovery

The Tier 1 free venue check in `sanitization.ts` (line 310-341) **works correctly** — it zeros `act.cost`. But this is irrelevant because **the UI reads costs from the `activity_costs` table**, not from `act.cost`.

The `activity_costs` table is populated in `generation-core.ts` Phase 4 (lines 2975-3203) using the `cost_reference` lookup table. This phase:
1. Maps each activity's category (e.g. "activity") to a `cost_reference` row
2. Picks a price based on budget tier (low/mid/high)
3. Writes it to `activity_costs.cost_per_person_usd`

**It never checks whether the venue is a free venue.** A miradouro categorized as "activity" gets the standard activity price (~$15-25 from `cost_reference`), which is the phantom ~€23.

The existing walk detection (line 3078-3092) correctly zeros walks, but there's no equivalent for parks, viewpoints, plazas, churches, etc.

The same issue exists in `action-repair-costs.ts` (line 136-138): when `costPerPerson === 0`, it **overrides** it with `ref.cost_mid_usd`, actively un-zeroing free venues.

### Plan

**1. Add Tier 1 free venue detection in `generation-core.ts` Phase 4** (after the walk check, ~line 3092)

Before doing the `cost_reference` lookup, check if the activity matches the Tier 1 free venue pattern (same regex as sanitization.ts). If it matches, push a $0 cost row and `continue` — just like the walk check already does.

```text
generation-core.ts line ~3092:
  // After walk check, before cost_reference lookup
  // Check Tier 1 free venues (parks, plazas, viewpoints, churches, etc.)
  const tier1FreePatterns = /\b(?:park|garden|jardim|viewpoint|miradouro|...)\b/i;
  const allText = [act.title, act.description, act.venue_name, act.location?.name, ...].join(' ');
  if (tier1FreePatterns.test(allText)) {
    costRows.push({ ..., cost_per_person_usd: 0, source: 'free_venue', confidence: 'high' });
    continue;
  }
```

**2. Fix `action-repair-costs.ts` to not un-zero free venues** (~line 136)

Before the `costPerPerson === 0` fallback that sets `ref.cost_mid_usd`, add the same Tier 1 free venue check. If the activity is a known free venue, keep cost at 0.

**3. Add diagnostic logging in `generation-core.ts` Phase 4**

Log when a Tier 1 free venue is detected and zeroed, plus log all activity cost assignments for debugging.

### Files to edit
- `supabase/functions/generate-itinerary/generation-core.ts` — add Tier 1 free venue check in Phase 4 cost assignment
- `supabase/functions/generate-itinerary/action-repair-costs.ts` — prevent un-zeroing free venues

### Why this fixes it
The €23 phantom price comes from `cost_reference` lookup, not AI generation. The sanitization zeroing was correct but pointless — it zeroed a field the UI doesn't read. By adding the check where costs are actually written (`activity_costs`), free venues will show $0.

### Verification
Generate a Lisbon trip. Any Miradouro or Praça activity should show $0 in the budget display. Check edge function logs for "free_venue" source entries.

