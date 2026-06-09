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

<!-- ROUND 6 — SELF-CHECK GATE (the "only ship the correct one" gate) -->
## Round 6 — generation-time self-check gate
NEW: supabase/functions/_shared/itinerary-self-check.ts — the auditor's checks, run INSIDE generation as the final step (v2 8i) before the DB write. It (1) repairs HIGH-severity fixable issues that would otherwise reach the user (post-departure non-meal activities, prompt-scaffolding cards, duplicate bare "Departure" rows), then (2) stamps a 0–100 quality score into trips.metadata.quality.self_check (+ needs_review flag if <75 or any HIGH) for LIVE observability — we can query the real prod distribution, not just test trips.
Also fixed a false positive in the departure check (mine AND the auditor's): a real departure day legitimately has Transfer + Flight, so only multiple BARE "Departure" rows count; meals before a midday flight are fine. A clean with-flight departure day now scores 100. The broken lisbon3 day repaired 51→76 (collapsed 2 bare departures, 0 HIGH remaining).
This is the architecture answer to variance: nothing broken ships, and every trip carries a quality score.

<!-- ROUND 7 — first WITH-FLIGHT + WITH-HOTEL test (Paris, trip 594a9d78) -->
## Round 7 — with-flight + with-hotel (Paris) — gate confirmed + 1 fix
First variance test with a real return flight (CDG→ATL Jun 25 6pm) + hotel. WINS: the self-check GATE fired live (stamped self_check {score:92,high:0} into metadata ✅); the departure RE-TIMING worked (Taxi to Airport 15:25 = flight 18:25 − 3h ✅); auditor 98. "Take a beat" caught ONE real issue the scorers missed: Dinner at Septime at 19:00 scheduled AFTER the 18:25 flight (also a Day3/Day4 duplicate). Cause: my departure strip excluded meals (to protect a pre-flight breakfast), which wrongly kept a meal AFTER the flight; and the dinner was auto-locked by the meal guard so the repair skipped it.
FIX: strip non-logistics after the EARLIEST barrier (leisure) and ANYTHING — incl meals, even locked — after the LATEST barrier (the flight). A meal before the barrier is still safe. Verified on Paris: dinner-after-flight stripped → Day 4 coherent, score 100. Applied to the gate (check + repair) and the external auditor.

<!-- ROUND 8 — staged campaign tests 1-2 -->
## Round 8 — staged campaign (toward 5-test baseline)
- TEST 1 Paris (with-flight+hotel): gate fired ✅, re-timing ✅; found+fixed dinner-after-flight → 100.
- TEST 2 Vienna (no-flight, NON-catalog): gate fired ✅, departure clean ✅, real venues; found "Lunch — find a local spot in Vienna" (meal-guard placeholder, no catalog to swap). FIX: vague-title clean added to the gate's repair (runs all days, after the meal guard) → "Lunch in Vienna", score 100.
Both fixes live in the self-check gate; pending one deploy, then tests 3-5 on the clean build.

<!-- ROUND 8 cont — TEST 3 London (early 8AM departure) -->
- TEST 3 London (with-flight EARLY 8am + hotel): departure day otherwise PERFECT (no breakfast on early-departure ✅, checkout overrode 11am→07:00 ✅, nothing after departure ✅, gate 100). Human read caught: 07:35 taxi for an 08:00 transatlantic flight = far too tight (would miss it). TWO bugs: (1) re-timing regex never matched "Taxi to London Heathrow Airport" — the airport NAME between "to" and "airport" broke /taxi to (the )?airport/; (2) re-timing only moved TOO-EARLY transfers, not too-late. FIX (8h re-timing): broadened transfer match (any transport card mentioning airport/terminal, or movement verb), anchor transfer at flight−3h in BOTH directions, and cascade checkout to just before the transfer. Verified on London Day 4: → Checkout 04:30, Taxi 05:00, Flight 08:00. Paris (too-early case) still anchors correctly to 15:25.

<!-- ROUND 8 cont — TEST 4 Tokyo + catalog expansion -->
- TEST 4 Tokyo (no-flight, non-European): 76. Excellent venues but model REPEATED famous venues (Kagari dinner, Kayaba Coffee breakfast) on days 1+3 despite the strong "DO NOT USE" prompt list (LLMs ignore negative constraints for famous places). Days are sequential so the data was available — model just ignored it. Deterministic backstop (8f3/8h) swaps via INLINE_FALLBACK_RESTAURANTS, which only covered 7 European cities → no Tokyo alternatives → repeat survived. Also a mistimed "Lunch" at 09:35 (deferred — minor).
  OWNER DECISION: expand the inline catalog. FIX: added 8 high-demand non-European cities to INLINE_FALLBACK_RESTAURANTS (Tokyo, New York, Dubai, Bangkok, Singapore, Sydney, Istanbul, Mexico City) with ~16 vetted real venues each. Verified the swap now returns alternatives for all 8 (Tokyo/Kagari→Ukai-tei, etc.). De-dup now covers 15 cities. Pending deploy + Tokyo regen to confirm live. Global parity (any city) still wants a live venue source (Google Places) as a fast-follow.

<!-- ROUND 9 — ROOT CAUSE: 8f3 C3 dedup silently no-op'd live (dynamic import) -->
## Round 9 — why C3 de-dup never fired live (the deferred "swap consistency" bug)
Tokyo regen (with the 8-city catalog deployed) STILL shipped Kagari days 1,3, Kayaba days 1,3, AND a non-meal repeat (Kappabashi days 1,3). The non-meal DROP needs no catalog, so its survival proved 8f3 wasn't running at all. Verified: mergedDays is fully populated before 8f3 (line 766), 8g only adds MISSING meals (doesn't touch days 1,3), 8h only edits the last day, and persistTripItinerary writes the incoming mergedDays — so nothing downstream undoes 8f3. Replicated 8f3's exact logic locally on the regen data: it swapped Kayaba→Bills, Kagari→Narisawa, dropped Kappabashi cleanly (no throw). ROOT CAUSE: 8f3's first statement was `await import('../fix-placeholders.ts')` — a dynamic import of a local module, which silently fails in the bundled Supabase Edge runtime, so the whole try/catch no-op'd. This is the long-deferred "C3 swap fired locally but not live" bug. FIX: static import of getRandomFallbackRestaurant at the top of generate-trip-day-v2.ts; removed the dynamic import. Pending deploy + Tokyo re-regen to confirm.

## Round 9b — SYSTEMIC: dynamic imports of dual-imported modules all failed live
Auditing the V2 file for the same dynamic-import bug found FOUR `await import('../local.ts')` calls. Pattern confirmed: a local module imported BOTH statically and dynamically has its dynamic path silently fail in the bundled Supabase Edge runtime (fix-placeholders is static-imported elsewhere; universal-quality-pass is static-imported here as runStep8). Casualties:
  • getRandomFallbackRestaurant (fix-placeholders) → C3 de-dup/swap never ran live.
  • terminalCleanup (universal-quality-pass, also imported as runStep8) → per-day AND final departure cleanup never ran live (explains the recurring departure-day issues).
  • reorderDayByProximity + retimeAndComputeLegTimes (geographic-coherence) → leg-time routing never ran → the "15m placeholder" travel times.
  • selfCheckAndRepair (itinerary-self-check, only-dynamic) → this one DID work (only-dynamic, no conflict), consistent with scores stamping.
FIX: converted ALL four to static top-of-file imports; rule going forward = no dynamic local imports in the edge bundle. deno check clean, 0 dynamic local imports remain. Pending deploy + Tokyo re-regen + a fresh departure-day check to confirm the cleanup + de-dup now run live.

## Round 10 — CONFIRMED static-import fix works live + venue-key normalizer
FRESH generate-trip Tokyo (trip 2c789676) proved the static-import fix: self_check re-stamped a FRESH score (100, not the stale 76), and Day-4 breakfast carried source='c3-restaurant-swap' — the C3 de-dup is FIRING LIVE for the first time. Score 76→92. Confirms the regen path (regenerate-day loop) skips the cross-day passes; only fresh generate-trip runs them (separate gap to address: regenerated trips miss de-dup/cleanup).
One wrinkle the fresh build exposed: the swap picked "Centre The Bakery" which Day 3 already had — because Day 3's location.name was "Breakfast at Centre The Bakery" (model stuffed the title in location.name), so its key didn't match the bare catalog name → the used-venue filter missed it. FIX: normalize venue keys by stripping the meal-type prefix (breakfast/lunch/dinner/cocktails… at/in/with) in BOTH the 8f3 swap and the gate's duplicate check. Verified: gate now flags "centre the bakery days 3,4"; keys match so the swap avoids same-trip venues.
OPEN (noted, not yet fixed): no-flight Tokyo Day 4 showed a phantom "Departure Flight 18:25" + "Travel to Your Hotel" after checkout — investigate the no-flight departure scaffolding.

## Round 11 — TEST 5 Barcelona (with-flight, midday) + de-dup ordering fix
Barcelona on the fully-live chain: departure cleanup CONFIRMED working live — Day 4 = Checkout 07:55 → Breakfast → Taxi to Barcelona-El Prat Airport 09:35 for the 13:00 flight (re-timing + airport-name match both live). No "15m" placeholder times (routing live). Real venues throughout. self_check re-stamped fresh (92).
TWO issues:
 1) Syra Coffee breakfast on days 2 AND 3 — de-dup didn't swap it. ROOT CAUSE: day-3 Syra's location.name was "Breakfast at Syra Coffee" (the meal-guard injection signature), i.e. 8g (meal-coverage gate) re-injected it AFTER 8f3 already ran — 8f3 de-dups BEFORE 8g injects, so it never sees the dup 8g creates. FIX: extracted the de-dup into runCrossDayDedup() and call it TWICE — once before 8g (model dups) and again after 8g/8h (8h2, catches gate-injected dups). Verified on the Barcelona data: 2nd pass swaps day-3 Syra → Flax & Kale.
 2) OPEN: Day 1 "Late Night Jazz" timed 00:39 (past midnight) sorts BEFORE the 11:00 arrival → auditor HIGH. Predawn-cascade / arrival-day handling doesn't catch a post-midnight late-night activity. Not yet fixed.

## Round 12 — confirming Tokyo (no-flight) + same-day meal dedup
Confirming fresh build VALIDATED the de-dup chain: 0 cross-day duplicate venues (catalog + normalizer + de-dup-after-8g all live). Real venues, clean Day 4 departure. Surfaced a same-day issue: Day 1 had TWO dinners (Tofuro 17:15 + Ichiran 19:00, appended out of order by 8g). The cross-day de-dup catches duplicate VENUES across days, not duplicate meal TYPES on one day. FIX: extended runCrossDayDedup to also drop same-day duplicate meal TYPES, but ONLY for EXPLICIT meal titles (breakfast/lunch/dinner) — not category-inferred — so "Izakaya at X"/"Cocktails at Y" experiences aren't wrongly dropped. Verified: drops only the 2nd Day-1 dinner; Day 1 → one of each meal; Day-3 izakaya/jazz kept.
OPEN (minor, MED): wrong-TIME meals still slip (Day 2 lunch at 09:55) — a separate meal-time-relabel fix, not yet done.

## Round 13 — meal-TIME relabel (open item 1)
A meal whose clock time contradicts its label (e.g. a "Lunch" at 09:55) is now relabeled to the correct meal for that time, inside runCrossDayDedup BEFORE the same-day dedup (so a relabel that collides with an existing meal of that type is dropped). Windows: breakfast 05:00-11:30, lunch 11:00-16:00, dinner 17:00-23:00; ambiguous gaps (e.g. 16:30) are left alone. Verified on Tokyo Day 2: "Lunch at Ramen Yoroiya" 09:55 → "Breakfast at Ramen Yoroiya" (Day 2 had no breakfast, so it fills the gap). No false relabels on correctly-timed meals.

## Round 14 — regen cross-day refactor (open item 2) + auto-lock handling
TWO things:
1) AUTO-LOCK handling: the de-dup skipped ALL locked items, so an AUTO-locked 2nd dinner / duplicate breakfast (the meal guard auto-locks injected meals with no lockedSource) survived. Fixed: skip only logistics + GENUINE user must-dos (lockedSource must_do/user). Auto-locks are now deduped/swapped. Verified: Tokyo drops the auto-locked 2nd dinner (0 dup venues); Barcelona swaps the auto-locked Day-3 Syra → Flax & Kale.
2) REGEN gap: extracted the full cross-day cleanup into _shared/cross-day-dedup.ts (relabel + same-day meal dedup + cross-day swap/drop, auto-lock-aware). The regenerate-day handler (action-generate-day.ts) now, on the LAST day, reads the full trip and runs crossDayDedup + selfCheckAndRepair + persists + stamps self_check{via:'regen'}. So regenerated trips get the SAME cleanup as fresh ones. Static imports (no dynamic-import bug). v2's inline kept (line-1034 lock fix) — equivalent logic; note for future consolidation that v2 inline + shared module duplicate the dedup.
