

# Itinerary Flow Cleanup — Fix All Inconsistent Paths

## Problems Found

### 1. Round-Up Logic Exists in TWO Places (Both Must Go)
- **`useGenerationGate.ts` (line 135-136):** `canCoverHalf = currentBalance >= tripCost / 2` -- if user has 50%+ of trip cost, it tries to spend and falls through to full generation. This creates an unpredictable partial-payment scenario.
- **`spend-credits/index.ts` (line 79-81):** `canCoverHalf = totalAvailable >= cost / 2` -- the FIFO deduction also has round-up logic, draining balance to 0 if user has 50%+ of cost.

**Fix:** Remove both. Simple rule: `balance >= cost` or BLOCKED.

### 2. Preview Generation Still Calls AI for Zero-Credit Users ($0.10 wasted)
- **`ItineraryGenerator.tsx` (line 184-217):** When gate returns `mode='preview'`, it calls `generateFullPreview()` which hits the AI. Your rule: "No credits = no AI. Do NOT call any APIs."

**Fix:** When gate returns `mode='preview'`, skip AI entirely. Create all days as locked placeholders and immediately show the Out of Credits modal.

### 3. `freeBuildsRemaining` Gate Blocks Users Who Have Credits
- **`ItineraryGenerator.tsx` (line 80, 432-456):** Uses `freeBuildsRemaining` from entitlements to disable the Generate button. This is a separate counter from the generation gate's `checkIsFirstTrip()` logic. They can disagree -- user with 300 credits gets blocked because `freeBuildsRemaining = 0`.

**Fix:** Remove the `freeBuildsRemaining` gate entirely. The generation gate is the single source of truth (first trip check + credit balance).

### 4. Stale Copy References Wrong Pricing Model
- **Line 303-304:** "Free accounts get 1 itinerary build per month" -- incorrect. Should reference 150 free credits/month.
- **Line 447:** "You have used your free itinerary build this month. Upgrade to continue." -- incorrect. Should say "You're out of credits."

### 5. `get-entitlements` Feature Flags Are Partially Stale
- `can_swap_activity` and `can_regenerate_day` check `totalCredits >= cost` but these actions have per-trip free caps. Users should ALWAYS be allowed to click (server checks free cap). Currently a user with 0 credits gets `can_swap_activity: false` even though they have 10 free swaps per trip.

**Fix:** Always return `true` for cap-gated actions. The `spend-credits` function already handles the free cap logic correctly.

### 6. Auto-Start Blocked by `freeBuildsRemaining`
- **Line 227:** `if (autoStart && !autoStartTriggered.current && user && (isPaid || freeBuildsRemaining > 0))` -- same stale gate prevents auto-start for users with credits but `freeBuildsRemaining = 0`.

---

## Implementation Plan

### File 1: `src/hooks/useGenerationGate.ts`
- Remove `canCoverHalf` logic (lines 134-148)
- Replace with simple check: `if (currentBalance < tripCost || !user)` then return `mode: 'preview'`
- Rename `mode: 'preview'` to `mode: 'locked'` for clarity (add `'locked'` to `GenerationMode` type)
- Update `generateDays` to 0 for locked mode (no AI generation at all)

### File 2: `supabase/functions/spend-credits/index.ts`
- Remove round-up logic in `deductFIFO` (lines 79-81, 89)
- Simple check: if `totalAvailable < cost`, throw `INSUFFICIENT_CREDITS`
- Remove `effectiveCost` -- always deduct the full `cost`
- Remove `wasRoundedUp` and `roundedUp` from response

### File 3: `src/components/itinerary/ItineraryGenerator.tsx`
- Remove `freeBuildsRemaining` / `freeBuildsLimit` variables and all their UI (lines 80-81, 431-449, 456)
- Remove `UsageLimitNotice` import and usage
- Update auto-start condition (line 227) to just `autoStart && !autoStartTriggered.current && user`
- Change preview path (lines 183-218): when `gateResult.mode === 'preview'` (or `'locked'`):
  - Do NOT call `generateFullPreview()`
  - Create ALL days as locked placeholders via `createLockedPlaceholderDays(startDate, 0, totalRequestedDays, destination, false)`
  - Show the Out of Credits modal immediately via `showOutOfCredits()`
  - Pass placeholders to `onComplete()`
- Update sign-in prompt copy from "1 itinerary build per month" to "Your first trip includes 2 free days. Get 150 credits every month."
- Remove the "used your free build" warning block entirely
- Add `useOutOfCredits` import and call

### File 4: `supabase/functions/get-entitlements/index.ts`
- Change `can_swap_activity` to always `true` (server checks free cap)
- Change `can_regenerate_day` to always `true` (server checks free cap)
- Add `can_unlock_day: totalCredits >= 60` for explicit day unlock gating
- Add `can_smart_finish: totalCredits >= 50`
- Add `costs` object to response so frontend never hardcodes stale values:
```
costs: {
  unlock_day: 60,
  smart_finish: 50,
  swap_activity: 5,
  regenerate_day: 10,
  ai_message: 5,
  hotel_search: 40,
}
```

### File 5: `src/hooks/useEntitlements.ts`
- Update types to include `costs` and new flags (`can_unlock_day`, `can_smart_finish`)
- Remove `freeBuildsRemaining` from QA mode defaults (or set to -1)

---

## Summary of Behavioral Changes

| Scenario | Before | After |
|----------|--------|-------|
| User with 50% of trip cost | Generates full trip (drains balance) | BLOCKED -- show modal |
| User with 0 credits, not first trip | Calls AI for preview ($0.10) | No AI call. All days locked. Modal shown. |
| User with 300 credits, freeBuilds=0 | Generate button DISABLED | Generate button works (gate handles it) |
| User clicks Swap with 0 credits | Button disabled (entitlements) | Button enabled, server checks free cap first |
| Auto-start with credits but freeBuilds=0 | Does not auto-start | Auto-starts correctly |

