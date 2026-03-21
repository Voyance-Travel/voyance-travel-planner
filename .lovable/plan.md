

## Audit: Rule Contradictions and Over-Strict Constraints

After reviewing the departure day prompts, Stage 2.57 (check-in-first enforcement), Stage 4.5 (venue hours auto-fix), Stage 4.6 (distance-aware cascade), and hard-stop logic, here are the contradictions and risks.

---

### Contradiction 1: Hard-Stop Treats Checkout as Immovable, but Farewell Prompts Schedule Activities AFTER Checkout

**The conflict:** Stage 4.5 (line 6875-6880) and Stage 4.6 (line 6989-6994) both identify `accommodation` activities with "check" in the title as **hard stops** — meaning no activity can be shifted past them, and any activity that would squeeze against checkout gets **removed**.

But the no-flight departure prompts (lines 8388-8431 and 8442-8481) **deliberately schedule farewell meals and departure transfers AFTER checkout** (11:15-12:15 farewell meal, 12:30 departure transfer). These are the activities we just added to fix the "abrupt ending" bug.

**What will break:** If a venue hours conflict occurs on a departure day without flight data, Stage 4.5 will try to shift an activity and check it against checkout as a hard stop. If an activity before checkout gets shifted to after checkout, it gets removed. Worse, Stage 4.6's cascade guard will **remove any activity** whose buffer deficit would push it past checkout — even the farewell meal that's supposed to be there.

**Severity: HIGH** — the fix we just deployed for farewell content will be undone by the hard-stop logic in many cases.

**Fix:** The hard-stop detection needs to distinguish between **checkout on departure days WITH flights** (where checkout is a genuine hard stop because of airport transfer timing) and **checkout on departure days WITHOUT flights** (where checkout is just a milestone and post-checkout activities are expected). Add a flag to each day like `hasFlightDeparture` and only treat checkout as a hard stop when the flag is true.

---

### Contradiction 2: `latestSightseeing` = checkout - 60 minutes, Applied Even When Evening Flight

**The conflict:** Line 8128 calculates `latestSightseeing = hotelCheckout - 60`. For an evening flight at 8 PM with checkout at 3:30 PM, this means `latestSightseeing = 2:30 PM`. The prompt then says "Last activity must END by 2:30 PM" — killing 3+ hours of usable time.

The evening flight path (line 8300-8363) correctly allows activities until `${latestSightseeing}` but also explicitly says "2-3 maximum, but CONDENSED" and shows afternoon activities in the structure. The variable `latestSightseeing` is computed ONCE before the branch and used in all 4 branches, but its logic ("1 hour to return to hotel") only makes sense for the midday/early flight cases where the traveler needs to rush back.

**Severity: MEDIUM** — evening flights lose afternoon time unnecessarily.

**Fix:** Move `latestSightseeing` computation inside each branch, or recalculate it per branch. For evening flights, set it to `leaveHotelBy - 30` (just enough to return and collect bags).

---

### Contradiction 3: Stage 2.57 Check-In-First Shifts Activities Into Overlap

**The conflict:** Stage 2.57 (line 6412-6425) shifts pre-check-in activities to after check-in with a fixed 15-minute gap. But it doesn't check whether the shifted activities overlap with **existing** post-check-in activities. If check-in is at noon and there are already afternoon activities at 1:00 PM, but two morning activities get shifted to 12:45 PM and 1:45 PM, they'll overlap.

Stage 2.7 (overlap fix) runs before 2.57, so it won't catch these new overlaps. Stage 4.6 runs later and might fix them, but only if coordinates are available — and at Stage 2.57, enrichment hasn't happened yet.

**Severity: MEDIUM** — overlaps on arrival days when AI places activities before check-in.

**Fix:** After shifting, run a mini overlap-resolution pass within Stage 2.57 that checks shifted activities against existing post-check-in activities and pushes them later if needed.

---

### Contradiction 4: "VIOLATION = REGENERATION" Threats Are Empty

**The issue:** Four prompt blocks include "VIOLATION = REGENERATION" warnings (lines 8239, 8296, 8362, 8429). But there is **no code** that actually regenerates when these violations occur. Stage 2.56 injects missing check-ins, Stage 2.57 reorders, but nothing detects "checkout after transfer" and triggers a regeneration. These are bluffs to the AI.

**Severity: LOW** — not a functional contradiction, but the AI model may learn to ignore them, weakening other prompt instructions. Either implement actual regeneration-on-violation (expensive) or replace the threats with post-processing guarantees ("we will fix this automatically").

---

### Contradiction 5: Stage 4.6 Hard-Stop Removes the WRONG Activity

**The conflict:** Line 6996-6998 shows that when a cascade shift would hit a hard stop, Stage 4.6 removes `current` (the activity causing the buffer deficit). But `current` might be a key activity (like a must-do attraction) while the hard stop is checkout. The user's must-do gets silently deleted because the buffer between it and the next activity was 5 minutes short.

**Severity: MEDIUM** — must-do or high-value activities can be silently removed.

**Fix:** Before removing, check if `current` is a must-do or has `isMustDo: true`. If so, instead of removing it, truncate its duration to fit, or remove a less important adjacent activity.

---

### Contradiction 6: Multi-City Farewell Constraint Appends Instead of Overriding

**The issue:** Line 8530-8535 appends city departure constraints to `dayConstraints` with `+=`. But for the FINAL city, the base `dayConstraints` has already been set by the no-flight path (lines 8388-8431) with its own farewell instructions. The AI gets TWO sets of farewell instructions — one generic ("farewell meal 11:15-12:15") and one city-specific ("farewell meal or café stop AFTER checkout"). They may conflict on timing.

**Severity: LOW** — redundant rather than contradictory, but adds confusion to the prompt.

---

### Summary of Recommended Fixes

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Hard-stop treats checkout as immovable on no-flight days | HIGH | Add `hasFlightDeparture` flag; only hard-stop checkout when flight exists |
| 2 | `latestSightseeing` too conservative for evening flights | MEDIUM | Compute per-branch instead of globally |
| 3 | Stage 2.57 can create overlaps with existing activities | MEDIUM | Add mini overlap pass after shifting |
| 4 | "VIOLATION = REGENERATION" threats are not enforced | LOW | Replace with "auto-fixed" language |
| 5 | Stage 4.6 removes must-do activities on hard-stop cascade | MEDIUM | Check must-do status before removing |
| 6 | Multi-city farewell appends duplicate instructions | LOW | Use override instead of append for final city |

### Recommendation
Fix #1 first — it directly undermines the farewell content we just deployed. Fix #2 and #3 next. The rest are quality improvements that won't cause visible breakage.

