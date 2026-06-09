# Content QA Tracker — itinerary OUTPUT quality

The other QA tracker covers whether *features work*. This one covers whether the
*generated itinerary is good*. Source of truth: `scripts/itinerary-output-qa.mjs`.

**Run it:**
```bash
SUPABASE_SERVICE_ROLE_KEY=… node scripts/itinerary-output-qa.mjs --limit 50
#   --json  machine output   ·   --llm  adds a "skeptical traveller" LLM pass
# exits non-zero if any trip scores below --min (default 80)
```

## Baseline (first full sweep — 18 prod trips)
**avg 53/100.** Distribution: 3 good (90–100), 3 fair (75–89), 4 poor (50–74), **8 critical (0–49).**
Goal: avg ≥ 90, zero HIGH-severity issues. Re-run after each fix lands and record the new avg below.

| Date | Trips | Avg | Critical | Note |
|------|-------|-----|----------|------|
| baseline | 18 | 53 | 8 | before V2 fixes deployed |

---

## Issues by category (priority order = severity × frequency)

### C1 · DEPARTURE_DAY — real activities scheduled AFTER departure  ·  **HIGH**  ·  8/18 trips
Sightseeing + lunch survive after the airport transfer on the last day, plus duplicate "Departure" rows.
e.g. *D4 "Sagrada Familia" at 09:15 scheduled AFTER departure (barrier 7:35)*.
**Root cause:** the live **V2** generation chain never ran `terminalCleanup` (all fixes had gone into the dead V1 path).
**Status:** ✅ FIX PORTED TO V2 (`d3bfdb316`) — ⏳ **pending deploy + re-verify.**

### C2 · PROMPT_LEAK — prompt scaffolding rendered as activity cards  ·  **HIGH**  ·  1/18
e.g. *"Keep all user-provided anchors, then expand with DNA-matched…"*, *"USER'S RESEARCHED PLACES & ACTIVITIES…"* shown as itinerary items.
**Root cause:** LLM echoes prompt text / parser ingests it; no guard strips instruction-like titles before persist.
**Status:** 🔲 TASKED (`task_46dc7787`) — generation-side guard + backfill scrub.

### C3 · DUPLICATE_VENUE — same restaurant/attraction on multiple days  ·  **MED**  ·  10/18 trips
e.g. *"breakfast at Granja Viader" on days 1, 2, 3*; *"dinner at Quimet & Quimet" on days 1, 2*. Most common issue by trip count.
**Root cause:** cross-day venue dedup (`_harvestDining` / `usedVenues`) is not preventing repeats in the V2 chain.
**Status:** 🔲 NEW — investigate V2 dedup; restaurants and attractions should not repeat within a trip.

### C4 · TRAVEL_TIME — placeholder / missing leg durations  ·  **MED**  ·  7/18 trips
e.g. *all 5 legs are "15m"*; *1/3 legs have no duration*. Travel time doesn't reflect real distance.
**Root cause:** routing retime (`retimeAndComputeLegTimes`) never wired into V2.
**Status:** 🔲 TASKED (`task_0fc90835`) — V2 routing port (must not fight the schedule executioner).

### C5 · VAGUE_TITLE — placeholder venue names  ·  **MED**  ·  7/18 trips
e.g. *"Breakfast — find a local spot in Vienna"*, *"Lunch — find a local spot in Vienna"*. Reads as unfinished.
**Root cause:** LLM emits placeholder meal/venue titles; no sanitize guard replaces or fills them with a real venue.
**Status:** 🔲 NEW — title-sanitize guard (replace "find a local spot" with a real city-matched venue, or drop).

### C6 · SEQUENCE — activities after hotel-return / checkout  ·  **MED**  ·  9/18 trips
Largely the departure-day case (overlaps C1) plus a few non-departure "after Return to Hotel" stragglers.
**Status:** ⏳ mostly covered by C1's `terminalCleanup`; confirm residual count drops after the V2 deploy.

### C7 · MEALS — wrong time-of-day + duplicate meals  ·  **MED**  ·  5/18 trips
e.g. *"dinner at 23:29"* (outside a sane window); *duplicate dinner on the day*.
**Root cause:** meal guard injects/keeps meals without validating time-of-day or de-duping same-meal cards.
**Status:** 🔲 NEW — meal-guard hardening (time-window clamp + same-meal dedup).

### C8 · THIN_DAY — full day with <2 real (non-meal) activities  ·  **MED**  ·  1/18 trips
A mid-trip day padded with only meals/logistics.
**Status:** 🔲 NEW — completeness gate should backfill thin days.

### C9 · MISSING_LOCATION — venue with no address/coordinates  ·  **LOW**  ·  1/18 trips
e.g. *"QA Test Gelato Stop at Vivoli"* with no coords (can't map or compute travel time).
**Status:** 🔲 NEW — enrichment should resolve or flag.

---

## Notes
- **Everything routes through the V2 chain** (`v2/generate-trip-day-v2.ts`, default-on; V1 deletion is imminent). Every fix above must land in **V2**, not V1.
- Sample is small (18 trips with ≥2 days). Re-run `--limit 50+` as the trip corpus grows.
- A `--llm` "skeptical traveller" pass exists for subjective issues a rule can't catch; needs `OPENROUTER_API_KEY`.

<!-- ROUND 2 — first CLEAN fresh trip (Rome, 4d, no locks/must-dos) -->
## Round 2 — clean Rome generation (trip 9e87e73e)
User read: venue SELECTION is genuinely good (Flavio al Velavevodetto, Da Enzo, Roscioli, SantoPalato — real local spots). SCHEDULING is the slop. Auditor 66/100.
- **C1 DEPARTURE: ✅ VERIFIED FIXED** on clean data — Day 4 = Checkout → Transfer to Airport, nothing after. (Barcelona only "failed" because its must-dos were locked.)
- **C5 VAGUE_TITLE: ✅ VERIFIED** — no placeholder titles. Hero correct (Rome).
- **C7 MEALS: FIX WRITTEN (pending deploy)** — clean trip had TWO dinners on Day 1 (19:30 + 23:29) and a nightcap cascaded to 01:55. Added v2 6b1 guard: keep one of each meal type (locked meals still counted so later unlocked dupes drop), drop non-logistics cards overflowing past midnight. Verified locally on Rome Day 1 (12→10, drops 23:29 dinner + 01:55 nightcap).
- **C3 DUPLICATE_VENUE: prompt-feed INSUFFICIENT.** Da Enzo (Day 2+3 dinner) + Pasticceria Regoli (Day 1 lunch + Day 3 breakfast) still repeated — the model ignores the "don't repeat" instruction. Needs TEETH: a post-generation cross-day dedup that SWAPS a repeated dining venue (needs a real alternative pool, not just a prompt nudge).
- **C10 OVERLAP (new):** two activities at the same start time (Day 2: Colosseum + breakfast both 08:30). Executioner not spacing them.
- **C11 THIN/GAPPY DAY (new, ⊃ C8):** Day 3 had one attraction + 4-hour holes between meals. Completeness/pacing gap.

<!-- ROUND 3 — clean Lisbon (trip 9888bdaf), score 84/100 -->
## Round 3 — clean Lisbon generation (84/100, up from Rome 66 / baseline 53)
- **C7 ✅ VERIFIED FIXED on a 2nd clean trip** — exactly one dinner/day, nothing past midnight. The double-dinner/cascade bug is gone.
- **C3 is now the ceiling.** Lisbon repeated: Mercado de Campo de Ourique 3× (Days 1-3), Tasca do Chico Fado 2×, Taberna Sal Grosso lunch 2×, Heim Café breakfast 2×. Prompt-feed confirmed ignored by the model.
  - **FIX (non-meal): deterministic cross-day venue dedup** added to V2 last-day finalization (8f3) — keeps first occurrence of each non-meal venue, drops repeats (keyed on location.name, prefix-match for suffixed names). Verified locally on Lisbon: Mercado 3×→1×, Fado 2×→1×, days stay full. Meals left (restaurant-swap needs a venue pool — open follow-up).
- **New small bug:** Day 4 transit said "Travel to Your Hotel" *after* checkout (should be "to Airport").
