

## Add Restaurant & Activity Rules to AI Generation Prompt

### Analysis

After reviewing the 1,225-line `compile-prompt.ts`, most of the requested rules **already exist** in the prompt. Here's the gap analysis:

| Rule | Status | Notes |
|------|--------|-------|
| 1. Real restaurants only | ✅ Already present | Lines 796-806, 879-912 — extensive banned-pattern enforcement |
| 2. Destination cuisine | ⚠️ Partially | City-specific restaurant lists exist, but no explicit "must serve local cuisine" rule |
| 3. Real addresses | ✅ Already present | Lines 799, 806, 877 |
| 4. No repeats | ✅ Already present | Lines 1085-1092, 1134-1156, 1185-1186 — triple-enforced blocklist |
| 5. No same activity type on consecutive days | ❌ Missing | Not mentioned anywhere |
| 6. Price reality | ✅ Already present | Lines 846-868, 1036-1043 — detailed price tiers with Michelin minimums |
| 7. Arrival day timing | ✅ Already present | Lines 778-784 — 2h buffer after landing |
| 8. Departure day timing | ✅ Already present | Lines 786-793 — 3h buffer before departure, no lunch if flight before 13:30 |

### What to add

Two new rule blocks in the **system prompt** section of `compile-prompt.ts`, inserted after the existing dining rules (~line 877):

**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

1. **Destination cuisine rule** (~5 lines): Explicit instruction that restaurants must primarily serve the destination city's local/regional cuisine, with at most one international-cuisine exception per trip if it's a renowned destination restaurant.

2. **Activity type variety rule** (~5 lines): If the previous day's activities are available, do not repeat the same experience *type* on consecutive days (e.g., spa on Day 3 → no spa on Day 4; cooking class on Day 5 → no cooking class on Day 6). This will reference `previousDayActivities` which is already passed to the prompt context.

Then redeploy the `generate-itinerary` edge function.

### Files changed
1. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add 2 rule blocks

