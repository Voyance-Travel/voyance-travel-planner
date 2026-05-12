## Plan — Day 1 arrival breakfast/brunch coverage

### Root cause (one line)

`supabase/functions/generate-itinerary/meal-policy.ts:144` gates breakfast on `arrivalMins < 630` (10:30 AM). Any flight landing at or after 10:30 AM drops to `['lunch', 'dinner']` and the morning meal is silently skipped — which matches Milan, Mallorca, Faro, and Bruges (all had real-world arrivals between ~10:30 AM and ~12:30 PM).

This is a one-knob policy bug, not a downstream rendering bug. Fix at the source.

### What changes (one file, plus prompt copy)

`supabase/functions/generate-itinerary/meal-policy.ts`

1. **Widen the morning-meal window for arrival days.**
   Replace the single 10:30 AM threshold with two bands:
   - `arrivalMins < 630` (before 10:30 AM) → `['breakfast', 'lunch', 'dinner']` — unchanged.
   - `arrivalMins >= 630 && arrivalMins < 720` (10:30 AM – 12:00 PM) → `['breakfast', 'lunch', 'dinner']` BUT label the morning meal contextually as a *brunch / late café stop*. This is the missing band that closes Milan/Mallorca/Faro/Bruges.
   - `arrivalMins >= 720 && arrivalMins < 780` (12:00 – 1:00 PM) → `['lunch', 'dinner']` — unchanged. Lunch IS the first meal here.
   - `arrivalMins >= 780` and beyond → unchanged.

2. **Pass arrival context into the breakfast prompt line.**
   The existing breakfast directive at line 282 always says "Breakfast at <Hotel Restaurant>". For the 10:30–12:00 brunch band, swap the directive to a brunch / late-morning café prompt so the LLM doesn't try to schedule an 8 AM hotel breakfast on a day the guest is still on a plane.
   - Add `mode: 'breakfast' | 'brunch'` to `MealPolicy` (defaults to `'breakfast'`).
   - Set `'brunch'` on the new 10:30–12:00 arrival band.
   - In the prompt builder, branch the breakfast line: brunch variant tells the model to schedule "a real named café or brunch spot near the hotel between 11:00 AM and 12:30 PM, after luggage drop and before lunch."

3. **Same widening for unknown arrival time (line 150).**
   Already required `breakfast` — no change.

### Why this is the right fix

- The four-city pattern is consistent with arrivals just past the 10:30 AM cutoff. Widening to noon directly catches them.
- We do not weaken the late-arrival cases (≥12:00 PM lunch-first; ≥5:00 PM dinner-only; ≥8:00 PM dinner-optional) — those remain correct.
- All downstream meal-guard, validation-gate, and budget logic already treats brunch as a breakfast slot (see `_shared/meal-detection`, `MEAL_TITLE_RE` in dining helpers). No knock-on schema work.
- One file, one new policy field, one prompt branch. No DB migration. No frontend changes.

### Out of scope

- The "Loading… Finding restaurant…" stuck state (`RestaurantLink.tsx`) — separate URL-lookup bug.
- Departure-day breakfast logic (already correct).
- Mid-trip breakfast variety rules (already enforced by `[ledger-check] meal-recurrence exempted`).

### Verification

After implement, regenerate a Day 1 with arrival between 10:30 AM and 12:00 PM. Day 1 should contain a brunch/café card scheduled 11:00 AM–12:30 PM, then lunch and dinner. Add a unit test in `meal-policy.test.ts` covering 10:45 AM, 11:30 AM, and 12:30 PM arrivals.

### Memory entry

Add `mem://constraints/itinerary/day1-arrival-brunch-band` recording the widened 10:30 AM – 12:00 PM brunch band so this pattern doesn't get re-tightened in a future cleanup pass.