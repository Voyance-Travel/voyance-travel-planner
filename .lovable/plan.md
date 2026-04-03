

## Fix: Morning Hotel Phantom & Missing End-of-Night Return

### Problem
Two bookend bugs on non-arrival days (Day 2+):
1. **Morning phantom**: AI generates "Return to Hotel" or "Freshen Up" as the first activity of the day. The traveler woke up there — this is nonsensical. The repair pipeline has no guard to strip it.
2. **Missing end-of-night return**: The end-of-day "Return to Hotel" injection exists (line 1342) but may be failing because the AI's last activity has category `accommodation` (e.g. a dinner card mislabeled, or a stale hotel card) which triggers the `isAccom(last)` skip.

### Root Cause
- The `isFirstDay` guard on line 576-600 strips pre-check-in accommodation on Day 1, but there is NO equivalent guard for Day 2+ mornings.
- The end-of-day injection checks `!isAccom(last)` — if the AI already placed any accommodation-category card at the end (even a phantom one), the injection is skipped.

### Changes

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

#### 1. Add morning hotel strip for Day 2+ (new step after bookends, ~line 807)

After the bookend repair runs, add a guard: on non-first, non-departure days, if the first non-transport activity is an accommodation card (Return to Hotel, Freshen Up) that appears before breakfast or the first real activity, remove it. The traveler is already at the hotel.

Logic:
```
if (!isFirstDay && !isDepartureDay) {
  // Find first non-transport activity
  // If it's accommodation (Return to Hotel, Freshen Up) and NOT check-in/checkout,
  // remove it — traveler woke up here
}
```

This should NOT strip:
- Check-in activities (legitimate on hotel-change days)
- Checkout activities
- Breakfast at hotel (category = dining, not accommodation)

#### 2. Harden end-of-day injection in `repairBookends` (line 1350-1357)

Change the `last` activity check: instead of just checking `!isAccom(last)`, also check if the last accommodation card is a "Return to Hotel" that was already properly placed. If the last card is a phantom (AI-generated accommodation that isn't a proper return), either strip it or inject after it.

Specifically, refine `isAccom(last)` to also verify the title actually contains "return to" or "hotel" — if the last activity is mislabeled accommodation (e.g. a dinner with wrong category), treat it as non-accommodation and inject the return.

#### 3. Add to repairBookends: strip wake-up phantoms before mid-day logic

Inside `repairBookends`, before the mid-day and end-of-day checks, add a pass that removes "Return to Hotel" / "Freshen Up" activities that appear as the first 1-2 activities of the day on non-first days. This ensures the phantom doesn't interfere with subsequent bookend logic.

### Summary of rules after fix

| Time of day | Day 1 (arrival) | Day 2+ (standard) | Last day (departure) |
|---|---|---|---|
| Morning | No hotel activities before check-in | No "Return to Hotel" — you woke up here | Breakfast → Checkout |
| Mid-day | Freshen Up after check-in (if lunch+dinner exist) | Freshen Up between lunch & dinner | Skip (departing) |
| End-of-night | Return to Hotel (after check-in) | Return to Hotel (always) | Skip (at airport) |

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add morning phantom strip + harden end-of-day injection

