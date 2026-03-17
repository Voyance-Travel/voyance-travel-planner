

## Fix: Budget Coach Gives Generic Swap Names Instead of Specific Venues

### Problem

The AI model sometimes returns vague `suggested_swap` values like "Lower cost restaurant" instead of concrete venue names (e.g., "Joe's Pizza on Carmine St"). This generic name then gets written into the itinerary as the activity title when applied, which is useless.

Two issues:
1. **The prompt isn't strict enough** about requiring real venue names
2. **No validation** on the frontend/edge function to reject vague suggestions

### Fix

**File: `supabase/functions/budget-coach/index.ts`**

1. **Strengthen the system prompt** — Add an explicit rule: "Every `suggested_swap` MUST be a specific, real venue or experience name (e.g., 'Joe's Pizza on Carmine St', 'Self-guided walk through Montmartre'). NEVER use generic descriptions like 'Lower cost restaurant', 'Cheaper option', or 'Budget alternative'."

2. **Strengthen the tool schema** — Update the `suggested_swap` field description to: "The specific name of a real venue, restaurant, or experience to replace the current one. Must be a concrete, real place — NOT a generic description like 'lower cost restaurant'."

3. **Add a server-side filter** — After parsing suggestions, filter out any where `suggested_swap` matches common generic patterns (contains phrases like "lower cost", "cheaper", "budget", "alternative option", "similar restaurant") and doesn't contain a proper noun / specific name. This is a safety net for when the AI ignores instructions.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/budget-coach/index.ts` | Strengthen prompt + schema description + add generic-name filter |

