

## Fix Repeated Breakfast Restaurants Across Multi-Day Trips

### Root Cause

The dedup code already tracks breakfast venues in `MEAL_RE` and `MEAL_RE_FAILSAFE`. However, two issues combine to let breakfast repeats through:

1. **Hotel breakfast preference creates repeats at the source.** The prompt says "At the hotel's own restaurant (preferred)" for breakfast. On a 5-day trip at Shangri-La Paris, the AI picks the hotel restaurant for breakfast on multiple days because it's explicitly told to prefer it. The hotel restaurant name then appears in `usedRestaurants`, but on the next day the prompt again says "preferred" — contradicting the blocklist.

2. **No Paris/Berlin/Rome/London failsafe fallbacks.** When the post-assembly dedup detects a duplicate breakfast, it tries `FAILSAFE_FALLBACKS[cityKey]` — but only Lisbon, Porto, and Barcelona have entries. For Paris, `cityKey` resolves to `''`, so `fallbackList` is empty. The duplicate is kept under the "primary meal > uniqueness" rule.

### Changes

#### 1. Limit hotel breakfast preference to specific days only (`compile-prompt.ts` ~line 425)

Change the breakfast instruction so that hotel breakfast is only "preferred" on Day 1 (arrival day) and checkout day. On other days, instruct the AI to pick a local café or bakery — not the hotel. This prevents the AI from generating the same hotel restaurant on 3-5 days.

Specifically: wrap the existing hotel-preference text with a condition:
- If `isFirstDay` or `isLastDay` → keep "At the hotel's own restaurant (preferred)"
- Otherwise → use "At a well-reviewed local café, bakery, or brasserie near your hotel. Do NOT use the hotel restaurant — choose a DIFFERENT breakfast venue each day."

#### 2. Add Paris, Berlin, Rome, and London failsafe fallbacks (`action-generate-trip-day.ts` ~line 1446)

Add fallback breakfast/lunch/dinner entries for Paris, Berlin, Rome, and London to the `FAILSAFE_FALLBACKS` map — at minimum 4-6 breakfast spots per city. This ensures that when dedup fires, there's a replacement available instead of keeping the duplicate.

#### 3. Add city aliases for new cities (`action-generate-trip-day.ts` ~line 1457)

Add aliases: `'paris': ['paris']`, `'berlin': ['berlin']`, `'rome': ['roma']`, `'london': ['londres']`.

### Files to edit

| File | Change |
|------|--------|
| `compile-prompt.ts` | Limit hotel breakfast preference to arrival/departure days; other days say "pick a different local café" |
| `action-generate-trip-day.ts` | Add Paris, Berlin, Rome, London to `FAILSAFE_FALLBACKS` with 4-6 breakfast + 2-3 lunch/dinner each; add city aliases |

