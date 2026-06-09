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

<!-- ROUND 4 — Lisbon regen #2 (92/100) + restaurant-swap -->
## Round 4 — Lisbon regen #2 = 92/100 (53→66→84→92)
- C3 non-meal dedup VERIFIED LIVE: Fado + Heim repeats gone, market collapsed. C7 holds; C1 Day-4 perfectly clean (the "Travel to Your Hotel" mislabel auto-resolved to "Transfer to Airport").
- Only remaining flag: Taberna Sal Grosso lunch on Days 2+3 (restaurant repeat).
- **C3 restaurant-swap ADDED:** when a meal venue repeats, swap the later one to a different city-matched venue from the curated INLINE_FALLBACK_RESTAURANTS catalog (covers Paris/Rome/Barcelona/London/Berlin/Lisbon/Venice) instead of dropping it. Verified locally on Lisbon: D3 "Taberna Sal Grosso" → "Cervejaria Ramiro". Graceful no-op if the city isn't in the catalog. **C3 now complete (non-meal drop + meal swap), pending deploy + verify.**

<!-- ROUND 5 — Lisbon regen #3 REGRESSED to 34/100 (variance) -->
## Round 5 — Lisbon regen #3 = 34/100 (REGRESSION; departure-day variance)
Same trip/code, different roll of the dice: this generation produced an inconsistent departure day — a hallucinated 15:25 departure flight with a 07:35 airport transfer (mis-timed), the 8g meal-coverage gate then injected a VAGUE "Breakfast — find a local spot" at 08:30 AFTER the transfer, plus 3 duplicate "Departure" rows. C3 swap also didn't fire live (Sal Grosso still 2×).
ROOT CAUSE: my 6c terminalCleanup + 6b2 vague-title run MID-pipeline; 8g (meal-coverage) + departure-transport injection run AFTER and re-introduce post-departure / vague cards that cleanup never sees.
FIX (8h): final departure-day cleanup AFTER 8g, just before the write — re-run vague-title sanitize + terminalCleanup on the last day. Verified locally on the broken Day 4: vague breakfast → real venue (nuclear sweep), 3 departures → 1, post-barrier strip applied.
STILL OPEN: (a) departure-logistics MIS-TIMING (07:35 transfer for a 15:25 flight) — a generation-time bug, not cleanup; (b) C3 swap firing inconsistently live (worked locally, not on this regen) — needs edge-log debugging; (c) overall HIGH VARIANCE — good ~92 most rolls, can drop to ~34 on a bad departure-day roll.
