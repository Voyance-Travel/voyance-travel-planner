## P0c — Protect real-content meal cards in `assignFloatingMealTimes`

**File:** `supabase/functions/_shared/timing-cascade.ts` (lines 205–211)

**Change:** Replace the unconditional drop branch with a content-preservation guard. If the floating card carries a real venue (`location.name` ≠ "your hotel", `venue_name`, or `restaurant.name`) OR a description ≥30 chars, promote it (assign default meal slot times, keep slotTaken=true) instead of deleting. Only truly empty duplicates fall through to the existing `[FLOATING_MEAL_DROP]` log.

**Out of scope:** every other function, file, and block. P0a + P0b untouched.

**Acceptance greps (all must pass post-apply):**
1. `FLOATING_MEAL_PROMOTE` → 1
2. `hasRealVenue\|hasRealDescription` → ≥4
3. `Content preservation is non-negotiable` → 1
4. `FLOATING_MEAL_DROP` → 1

Ready to implement on approval.