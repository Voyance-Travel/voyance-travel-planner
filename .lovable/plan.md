## Goal

Stop users from undersizing their budget for the venues the AI then schedules. Two changes:

1. **Cost-band labels on presets** — turn "Splurge-Forward" from a vibe word into a number.
2. **Coach upgrade CTA** — when food blows past 45% *and* the trip contains a luxury anchor, surface a one-click "Bump budget to $X" instead of just flagging overrun.

## Change 1 — Preset labels with $/day bands

File: `src/components/planner/budget/BudgetSetupDialog.tsx` (~lines 423–446)

Replace the three flat preset buttons with stacked labels showing realistic per-person/day spend:

- **Value-Focused** — $80–150/day pp
- **Balanced** — $150–300/day pp
- **Splurge-Forward** — $300–500/day pp

Add a one-line caption above the row: *"Pick a preset that matches your daily spend, not just your vibe."* Keep the existing tooltip on hover (hostels vs. mid-range vs. 4–5★ + splurge dinner). The Luminary tier is not currently a preset — leaving it out of this change to avoid scope creep, but the captions imply it.

No DB or service changes; pure label/UI.

## Change 2 — Budget Coach "bump tier" suggestion

Files:
- `src/components/planner/budget/BudgetCoach.tsx` — add a new "Upgrade budget" banner above the swap list.
- `src/components/planner/budget/BudgetTab.tsx` — pass `onBumpBudget` prop and persist via existing `updateSettings({ budget_total_cents })`.

Trigger conditions (computed in Coach):
- `currentTotalCents > budgetTargetCents * 1.10` (real overrun, not noise), AND
- Food share of total ≥ 45% (computed from itineraryDays' dining/food categories using existing `CATEGORY_GROUPS.Dining` keywords), AND
- At least one activity title or description matches a luxury anchor regex: `/michelin|plaza athénée|ritz|le bristol|four seasons|wine tasting|tasting menu|caviar/i`.

When all three fire, render a lightweight banner inside the Coach card *above* the swap list:

> **Your plan is bigger than your preset.** This trip has Michelin-tier anchors and food is X% of total. Bump budget to $Y to match your actual plan, or apply the swaps below to fit.
> [Bump to $Y] [Keep budget, swap items]

`$Y` is computed as `Math.ceil(currentTotalCents * 1.05 / 50000) * 50000` (round up to nearest $500), so the new budget covers the plan with a small cushion. Clicking "Bump to $Y" calls `onBumpBudget(Y)` which writes `budget_total_cents` via the existing settings update path. No new tables or migrations.

The banner is one-shot per session — once dismissed or applied it disappears until the over-budget condition deepens by ≥10%. Stored in localStorage keyed by tripId, mirroring the existing `dismissedStorageKey` pattern.

## Out of scope

- Re-baselining the preset's underlying $/day allocations (option #3 from the discussion). That's a calibration change with persistence implications and stays a separate ticket.
- Adding a fourth "Luminary" preset — current presets cover the band; tier names already exist in DNA/quiz layer.

## Files

- `src/components/planner/budget/BudgetSetupDialog.tsx` — preset button labels + caption.
- `src/components/planner/budget/BudgetCoach.tsx` — overage banner + bump CTA, dismiss persistence.
- `src/components/planner/budget/BudgetTab.tsx` — wire `onBumpBudget` to `updateSettings`.

## Result

- Setup dialog teaches users what each preset is dimensioned for, before they pick.
- When their plan outgrows the preset anyway, Coach offers a single click to right-size the budget instead of a wall of swap suggestions they don't want.
- No data migrations, no new edge functions.