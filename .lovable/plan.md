## What you're hitting

The Splurge-Forward preset for a 4-night Paris trip suggests a ~$1,796 budget. The Four Seasons George V alone runs ~$1,500–2,000/night, which means the *hotel line* exceeds the entire trip budget several times over. The current banner says "Trip expenses exceed your budget by $1,651 (92%) — Use Budget Coach or adjust your budget" but it doesn't:

1. Tell the user **what** is causing the overage (it's the hotel, not the activities)
2. Offer a **one-click fix** (raise the budget to a realistic floor, or toggle Hotel out of the budget)
3. Catch it **at the moment of choice** — picking the Four Seasons silently consumes the entire trip's budget without comment

## Plan

Three small, high-leverage UX changes — no schema work, no regen.

### 1. Diagnostic over-budget banner (`BudgetTab.tsx`)

Replace today's generic "Trip expenses exceed your budget…" explainer with a **diagnostic** version that decomposes the overage:

> Your hotel ($X for 4 nights) is **N×** your trip budget. With hotel included you're $1,651 over.
>
> **Quick fixes:**
> - [ Raise budget to $3,500 ]  ← one-click; rounds to nearest $100
> - [ Hide hotel from budget ] ← toggles `include_hotel_in_budget` off
> - [ Pick a different hotel ]  ← jumps to hotel selector

The "raise budget" button updates `budget_total_cents` directly (no AI, no credits). The "hide hotel" toggle already exists at the bottom of the page — we just surface it inline. The detection rule: `hotelCents > budgetCents * 0.6` ⇒ show hotel-driven variant; otherwise keep current generic copy.

### 2. Pre-selection guard at hotel pick (`UnifiedAccommodationSelector` / hotel picker)

When the user is about to confirm a hotel whose all-nights cost > current `budget_total_cents`, show a small inline note next to the confirm button:

> Heads up: this stay is $X across N nights — about 1.7× your current $1,800 trip budget. We can raise your budget automatically when you continue.

A checkbox "Auto-raise my trip budget to fit" defaults to **on**. On confirm we bump `budget_total_cents` to `ceil((hotelCents + activityFloor) / 100) * 100`. No surprise mismatch later.

### 3. Preset realism note in setup (`BudgetSetupDialog.tsx`)

When a user picks Splurge-Forward and the system already knows the selected hotel cost (it does — `trips.hotel_selection`), show a one-liner under the preset chip:

> Splurge-Forward suggests **$1,800** for this trip. Your selected hotel costs **$6,400** alone — consider **$8,500+** so the preset can fund signature dining and experiences on top.

Pure guidance copy; no automatic action.

## Files touched

- `src/components/planner/budget/BudgetTab.tsx` — diagnostic banner with one-click actions
- `src/components/trips/UnifiedAccommodationSelector.tsx` — pre-confirm budget-fit note + auto-raise checkbox
- `src/components/planner/budget/BudgetSetupDialog.tsx` — preset realism hint when a hotel is already chosen
- New `src/lib/budget-realism.ts` — single helper: `assessBudgetFit({ hotelCents, activityFloorCents, budgetCents })` returning `{ severity, drivers, suggestedFloorCents }` so the three surfaces stay consistent

No DB / edge changes. No effect on the cost ledger or generation pipeline. Approve to apply.