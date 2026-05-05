## Problem

Across every test session, total Coach savings cover only **9–24%** of a $2.3k–$3.1k gap. There are three structural causes:

1. **No coverage contract with the model.** `supabase/functions/budget-coach/index.ts` tells the AI "cut $X" but never sets a *target sum* the suggestions must reach. The model returns 5–8 (or 8–12 in deep-cuts) cheap-swap suggestions averaging $40–$80 each. Even at the ceiling that's ~$960 — nowhere near a $2.5k gap.
2. **Drop cap is too tight.** Deep-cuts mode says "at most 1 drop per day" with `8-12` suggestions total. On a 6-day trip that's ≤ 6 drops; combined with small swaps it can't realistically close a 25%+ overrun.
3. **No bulk-apply path.** Even if the user accepts every swap, they have to click each one individually. The restructure panel offers "Raise budget" / "Shorten trip" / "Drop optional activities" (which just scrolls the list) but no "Apply all" button that closes the gap in one move.

The "Swaps alone won't bridge" warning is honest but the path forward it offers is weak.

## Fix

### 1. Coverage contract + adaptive suggestion count (server)

`supabase/functions/budget-coach/index.ts`:

- Compute `discretionaryCents` = sum of all positive-cost, non-anchor, non-protected, non-logistics activities.
- Compute `targetSavingsCents = min(gap_cents, Math.round(discretionaryCents * 0.7))`. (We can't promise more than ~70% of discretionary; nobody wants to drop everything.)
- Compute `targetSuggestionCount`:
  - default: 5–8 (unchanged)
  - deep-cuts with `gap < $1000`: 8–12 (unchanged)
  - deep-cuts with `gap >= $1000`: **12–18**
  - deep-cuts with `gap >= $2500`: **16–24**
- Add a hard clause to the system prompt:
  > **COVERAGE CONTRACT:** The sum of `savings` across your returned suggestions MUST be ≥ `${targetSavingsCents/100}` (currency units). If you cannot reach that with swaps alone, prioritize `drop` suggestions on optional discretionary items (nightcaps, secondary museums, duplicate sightseeing, premium add-ons). Return more suggestions, not fewer — under-delivering on coverage is the worst possible outcome.
- Lift "at most 1 drop per day" → **"at most 2 drops per day; never drop the only meal of a slot"** in deep-cuts mode.
- After post-filter, log `coverageRatio = totalSavings / targetSavings` and include `coverage_ratio`, `target_savings_cents`, and `discretionary_cents` in the response payload so the client can reason about it.

### 2. Auto-retry once if coverage is poor (server)

If `coverageRatio < 0.5` after filtering AND deep-cuts mode is on AND we haven't retried, fire one re-prompt with the model:

> Your previous suggestions only covered ${coveragePct}% of the gap. Return a NEW list (do not repeat any prior `activity_id`) of additional swaps and drops that, combined with the previous list, reach the coverage target. Drops are strongly preferred for high-cost discretionary items.

Merge the two response sets, dedupe by `activity_id`, re-sort by savings. Cap total work at 2 model calls per request to keep cost and latency bounded.

### 3. "Apply all" + better restructure CTA wording (client)

`src/components/planner/budget/BudgetCoach.tsx`:

- In the restructure panel (around line 996), add a primary button **"Apply all suggestions"** that iterates `visibleSuggestions` and calls `onApplySuggestion` for each unapplied, non-locked item (with a `window.confirm` summarising the count + total savings + how many drops are included).
- Update the warning copy when the server returns `coverage_ratio < 0.5`:
  > "The swaps below cover only X% of your $Y overrun, even after accepting drops. To reach your target you'll need to combine the suggestions with one of the structural changes below."
- Re-order the CTAs: **Apply all** → **Raise budget to $Z** (where Z = `currentTotal` rounded up to the nearest $50, telegraphed as "fully closes the gap") → **Shorten trip 1 day**. The current 2% bump under-sells what the budget raise actually does.
- Show a tiny `(closes the gap)` hint next to the raise-budget button when `restructureBumpTargetCents >= currentTotalCents`.

### 4. Telemetry

Log `coverage_ratio`, `target_savings_cents`, `discretionary_cents`, `retry_attempted`, and `final_suggestion_count` on every coach response. This lets us measure whether the change moved coverage from <25% toward >70% in production.

## Files touched

- `supabase/functions/budget-coach/index.ts` — coverage contract, adaptive suggestion count, drop cap lift, optional retry, response payload extension
- `src/components/planner/budget/BudgetCoach.tsx` — Apply-all button, restructure panel copy, CTA ordering, "closes the gap" hint
- `mem://features/budget/budget-coach-system.md` — append the coverage contract + adaptive count + apply-all section so future agents don't regress these guarantees

## What this does NOT change

- Anchor protection, dismissed-id logic, protected categories, placeholder-title guards, generic-name filter, ID-must-exist guard — all kept as-is.
- The "hotel-dominant" panel and its raise-budget CTA — already correct for that distinct failure mode.
- Empty/incomplete-itinerary gating from the prior fix — Coach still hides on those trips.
