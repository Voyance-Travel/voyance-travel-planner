## Problem

Budget Coach surfaces ~$517 in swaps against a $2,784 overrun (~18% coverage), then leaves the user stranded with a passive "Still $2,268 over" line. Two structural reasons:

1. **The coach is swap-only by design.** The prompt says: *"You NEVER suggest removing an activity entirely — always suggest a cheaper replacement."* So even when a $300 private tour or a $150 nightcap would be the obvious cut, the model can only down-shift it, capping savings at the delta between premium and mid-tier.
2. **The "honest restructuring" CTA is gated too narrowly.** The "Bump tier" panel only fires when food share ≥45% AND a luxury anchor is present AND overrun >10%. A trip that's just generally over-scoped (no Michelin, no palace hotel) gets zero structural guidance — only the weak swap list.

## Fix

Three changes; all surgical.

### 1. Allow drop / consolidate suggestions when the gap is large (server)

`supabase/functions/budget-coach/index.ts`

- Add a `swap_type: "swap" | "drop" | "consolidate"` field to the tool schema. Default `"swap"`.
- When `gap_cents > totalDiscretionarySwapCeilingCents` (rough estimate: sum of top-half discretionary items × 0.4) **OR** the gap is >25% of `current_total_cents`, switch the prompt to *"deep cuts mode"*:
  - Permit `swap_type: "drop"` for non-anchor discretionary activities (paid tours, nightcaps, optional experiences). For drops, `new_cost = 0` and `suggested_swap` becomes `"Drop — free time / use saved budget elsewhere"` plus a one-line `reason` explaining trade-off.
  - Permit `swap_type: "consolidate"` (merge two same-day meals into one, or replace a day's three-stop tour-hopping with a single combo ticket).
  - Still forbid drops on protected categories, locked items, hotels, flights, and meals tagged as anchor (Day-1 dinner, Michelin, etc. — detected via `LUXURY_ANCHOR_RE` already in the client; pass `anchor_activity_ids` from the client into the request).
  - Raise the suggestion count from 5–8 to 8–12 in deep-cuts mode.
- In the post-filter: drops are allowed (skip the `newCostCents >= currentCostCents` guard when `swap_type === "drop"` and `new_cost === 0`); enforce the protected/anchor/locked guards as before.

### 2. Pass anchor IDs and request deep-cuts mode from the client

`src/components/planner/budget/BudgetCoach.tsx`

- Compute `anchorActivityIds` using the existing `LUXURY_ANCHOR_RE` plus Day-1 dinner detection (already wired in `feature/itinerary/grand-entrance-dinner`).
- Add `anchor_activity_ids` and a derived `deep_cuts_requested: boolean` (true when `gapCents > currentTotalCents * 0.25` OR `gapCents > 1500_00`) to the edge-function payload.
- Render `swap_type === "drop"` suggestions with a different visual: `Scissors` → `Trash2` icon, "Drop" label, and a confirm-step on Apply (`onApplySuggestion` parent must accept removal — see step 3).

### 3. Honest restructuring panel when swaps fundamentally can't close the gap

`src/components/planner/budget/BudgetCoach.tsx`

- After fetch, compute `coveragePct = totalPotentialSavings / gapCents`.
- When `coveragePct < 0.5` AND `gapCents > currentTotalCents * 0.10`, replace the soft amber "Still over" line with a **prominent restructuring panel** above the suggestion list:
  - Headline: *"Swaps alone won't bridge this gap."*
  - Body: *"Suggested swaps cover only X% of your $Y overrun. To get on target, you'll need to either:"*
  - Three actions side-by-side (always visible, no DNA gating):
    1. **Bump budget to {currentTotalCents rounded to nearest $500}** (uses existing `onBumpBudget`).
    2. **Drop optional activities** — scrolls to / expands the drop suggestions in the list (anchor-link).
    3. **Shorten trip by 1 day** — opens a confirm dialog (callback `onShortenTrip?: () => void`; if not provided, link to itinerary editor).
- Keep the existing narrow Bump-tier CTA as a fallback for the food-luxury pattern; don't show both.

### 4. Wire the parent to accept "drop" applies

`src/components/itinerary/EditorialItinerary.tsx` (or whichever file owns `onApplySuggestion`)

- In the apply handler, branch on `swap_type`:
  - `swap` (default): existing path — replace title/cost/description.
  - `drop`: call the existing `removeActivity(activity_id)` flow + log to `cost_change_log` with `source: 'budget_coach_drop'` so attribution is preserved (per `silent-repair-attribution` memory).
  - `consolidate`: treat as a swap on activity A and a drop on activity B (the model returns both `activity_id` and `consolidate_with_activity_id`).

### 5. Memory update

Update `mem://features/budget/budget-coach-system` to note: drops + consolidations allowed in deep-cuts mode; restructuring panel triggers at <50% coverage of >10% overrun; anchor IDs gate drops.

## Files touched

- `supabase/functions/budget-coach/index.ts` — schema + deep-cuts prompt + drop guard
- `src/components/planner/budget/BudgetCoach.tsx` — anchors, deep-cuts flag, restructuring panel, drop UI
- `src/components/itinerary/EditorialItinerary.tsx` — drop/consolidate apply branch
- `src/components/planner/budget/BudgetTab.tsx` — pass `onShortenTrip` if available
- `mem://features/budget/budget-coach-system` — updated rules

## Out of scope

- Re-running itinerary generation against a tighter budget (already covered by the "Regenerate" flow on the planner — we just link to it from the panel).
- Auto-applying drops without user confirmation.

**Approve to implement?**