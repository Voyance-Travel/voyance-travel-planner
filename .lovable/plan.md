

## Activity Dedup Across Days + End-of-Day Hotel Return Fix

### Root Cause Analysis

**Problem A (Cross-day venue repeats):** The cross-day dedup logic at `action-generate-trip-day.ts` line 918 ONLY checks dining activities (`isDining` gate). Non-dining activities like parks, museums, and landmarks are completely ignored. The `usedVenues` list IS passed to the AI prompt correctly (compile-prompt.ts line 1144), but the AI sometimes ignores it. There is no post-generation enforcement for non-dining repeats.

**Problem B (Missing hotel return):** The `repairBookends` function in `repair-day.ts` (line 2884-2920) already injects "Return to Hotel" on non-departure days. However, it checks for `hasExistingReturn` by looking for ANY accommodation card with "return to" or "freshen up" ANYWHERE in activities. If the AI generated a mid-day "Freshen Up" card, it counts as `hasExistingReturn = true`, and the end-of-day return is skipped. The logic needs to check specifically for a LATE accommodation card, not any accommodation card.

### Changes

#### 1. `action-generate-trip-day.ts` — Expand cross-day dedup to ALL activity types

At line ~918, after the existing dining-only dedup block, add a new block that checks ALL non-dining, non-transport activities against `usedVenues` using fuzzy normalized matching. When a duplicate is found, mark it for removal. Also expand the `usedVenues` collection (line 409-422) to include `venue_name`, `title`-extracted names, and `location.name` for broader coverage.

#### 2. `pipeline/repair-day.ts` — Fix end-of-day hotel return logic

At line 2895, change `hasExistingReturn` to only count accommodation cards that appear AFTER the last non-accommodation, non-transport activity — i.e., check if the day actually ENDS with a hotel return, not just that one exists somewhere mid-day. Specifically: find the last non-transport, non-accommodation activity index, then check if any "return to" / accommodation card exists after that index.

#### 3. `action-generate-trip-day.ts` — Also collect venue names from newly generated day

After the day is saved, append the current day's venue names to `usedVenues` for the next iteration. This is already partially done for restaurants but not for general venues. Ensure the venue names from `venue_name`, `location.name`, and title-extracted names all get added.

### Files to edit

| File | Change |
|------|--------|
| `action-generate-trip-day.ts` | Expand `usedVenues` collection to include `venue_name` + title; add non-dining cross-day dedup block after line 972 |
| `pipeline/repair-day.ts` | Fix `hasExistingReturn` check to only consider end-of-day position, not mid-day freshen-ups |

### What we're NOT changing
- The AI prompt venue dedup section (already correct in compile-prompt.ts)
- The dining-specific dedup (stays as-is, this adds a second pass for everything else)
- Mid-day freshen-up injection (works correctly)

