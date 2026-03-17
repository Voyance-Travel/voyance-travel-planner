

## Investigation: Why a $2,500 Budget Shows $12,000 in Trip Expenses

### What's Happening

The $12,000 figure is **not a bug** — it's the **estimated total cost of all planned activities** for all travelers, separate from your $2,500 budget. Here's why the gap exists:

**1. Budget ≠ Trip Expenses**: The "Trip Expenses" card shows what the itinerary *would cost* based on AI-estimated prices. The "Budget" card shows what you *set as your target*. These are intentionally independent numbers — the budget is your spending goal, the expenses are the estimated reality.

**2. The num_travelers multiplier**: Every activity cost is stored as `cost_per_person_usd × num_travelers`. If you have 4 travelers, a $30/person dinner becomes $120 in the total. Over many days and activities, this adds up fast.

**3. AI doesn't hard-cap totals**: The generation engine passes your budget as a "HARD BUDGET CAP" hint to the AI (e.g., "$104/day/person for activities"), but the AI model doesn't always respect it — especially for premium destinations like Florence and Venice where realistic costs are higher. There's a per-activity safety cap of $2,000 but **no post-generation validation** that sums all activities and checks against the budget.

### The Real Problem

There is **no post-generation budget enforcement step**. The AI is *told* the budget, but after it generates activities with estimated costs, nothing validates that the total stays within budget. This means:
- The prompt says "$104/day/person"  
- The AI plans a $200 museum + $80 dinner + $60 transport = $340/day/person  
- Nobody catches this before it's saved

### Proposed Fix: Add Post-Generation Budget Validation

**File: `supabase/functions/generate-itinerary/index.ts`**

After the AI generates a day's activities and before saving to `activity_costs`, add a validation step:

1. Sum all `cost_per_person_usd` values for the generated day
2. Compare against `actualDailyBudgetPerPerson`
3. If over budget by >20%, scale down all activity costs proportionally to fit within 110% of the daily budget cap
4. Log a warning when scaling occurs so we can tune the prompt

This ensures the stored costs are realistic relative to the user's budget, even when the AI overshoots.

**File: `src/components/planner/budget/BudgetTab.tsx`**

Add a clear visual indicator when Trip Expenses exceed the budget — currently the number turns red, but adding a banner like "Your planned activities exceed your budget by $X. Use Budget Coach to find savings." would help the user understand what they're seeing.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-itinerary/index.ts` | Add post-generation cost validation — scale down activity costs if day total exceeds daily budget cap by >20% |
| 2 | `src/components/planner/budget/BudgetTab.tsx` | Add over-budget banner with actionable guidance when Trip Expenses > Budget |

