# Voyance — Beta-Readiness Test Tracker

**Goal:** measure whether generation is reliable across the *real input space* — not the one corner we hand-tested. Output = a go/no-go number for beta + a **categorized** failure list (fix vs. soft-warn vs. accept).

**Capacity planned:** up to 50 tests. **Running the first 20 now.**

---

## 🚦 Stop-loss rule (READ FIRST)
Run the **Tripwire 5** first, then **HALT and review**.
- If **≥2 HARD failures** OR any **systemic pattern** in the first 5 → **PULL UP.** Stop the campaign, log the fixes, don't burn the rest. *We learn more from 5 + a fix than 20 + a pile of the same red.*
- If Tripwire 5 is clean → continue Set 2, then Set 3.

Re-evaluate again after every 5.

---

## Credits
Cost per trip = `days × 60`. Available ≈ **3,650**.
- Tripwire 5 = **1,560** ✅ fits
- Set 2 (6–12) = **2,040** → ~fits (running total ≈ 3,600 ≈ budget)
- Set 3 (13–20) = **2,640** → **needs a top-up** before running

So: **Tripwire 5 → checkpoint → Set 2** runs within current credits; **top up ~3k for Set 3 (13–20).**

---

## Pass criteria

### HARD invariants — zero tolerance (any breach = NOT beta-ready)
| ID | Invariant |
|----|-----------|
| H1 | Reaches terminal status (`ready`/`partial`/`failed`) in ≤ ~3 min — **never stuck `generating`** |
| H2 | No activity scheduled **after departure / checkout** |
| H3 | **No duplicate venue** across days |
| H4 | **No meal before ~06:30** |
| H5 | Every user **must-do appears exactly once** |
| H6 | No **crash / failed** generation (unless the input is genuinely impossible) |

### SOFT targets — aim ≥ 90%
| ID | Target |
|----|--------|
| S1 | Self-check score ≥ 80 |
| S2 | ≤ 1 "splurge" when the user asked for one |
| S3 | ≤ the stated per-day activity cap |
| S4 | No predawn (<05:00) stray card · no dangling title · no redundant hotel leg |

---

## 🏷️ Disposition (the column that matters)
Not every failure is a code bug. Classify each:
- **FIX** — real defect (crash, stuck status, dup venue). Code fix required.
- **SOFT-WARN** — the MVP genuinely wasn't built for this ask; the right product answer is to **set expectations**, not promise perfection. e.g. *"This is an ambitious request — we'll do our best; it may not be exact."* Surface in the wizard/output; don't pretend.
- **ACCEPT** — within tolerance / cosmetic.

> Candidate SOFT-WARN territory (decide as we see it): 6 must-dos on a 3-day trip (can't physically fit), very obscure / thin-data cities, contradictory constraints ("luxury" + "cheap and local"), 10-day single-city (pacing strain).

---

## The matrix — first 20

### Tripwire 5 (run, then HALT)
| # | City | Days | Must-dos | Budget | Stress tested | Cr | Status | H-fails | S-fails | Disposition / notes |
|---|------|------|----------|--------|---------------|----|--------|---------|---------|---------------------|
| 1 | Barcelona | 5 | 3 | moderate | known-good baseline | 300 | 🟩 | 0 | 0 | PASS — build 32d0b59f: status=ready, score 100, 1 splurge, no dup, no early meal, no predawn |
| 2 | Cairo | 5 | 3 | moderate | **non-catalog** swap path | 300 | 🟩 | 0 | 1 | PASS (dd0ac61a): status=ready, score 92, 0 dup, 0 early-meal, 0 predawn, 0 post-checkout. Non-catalog works. |
| 3 | Rome | 3 | 6 | budget | **short + many must-dos** (overflow / departure cram) | 180 | 🟩 | 0 | 1 | FIXED + re-verified (015d4f19): postCheckout **2→0**, capacity_warning stamped (1 unmet), status=ready, no dup/dangling. Score 84. Soft: splurge-dinner must-do relabeled to 09:15 "Breakfast" under overflow. *(orig da68c608 was 🟥 1-hard.)* |
| 4 | Tokyo | 8 | 6 | luxury | **long + many + luxury** (one-splurge stress, heals) | 480 | 🟩 | 0 | 1 | PASS (db3a51e0): **score 100**, 1 splurge, 0 dup/early/predawn/postCheckout/dangling. **6 must-dos fit in 8 days → no overflow.** Soft: capacity_warning flagged "Izakaya" unmet (likely coverage-matcher miss on a vague dining must-do). |
| 5 | Lisbon | 5 | 0 | moderate | no-constraint baseline (should be cleanest) | 300 | 🟨 | 1 | 0 | (fa6601e2): status=ready score 92, 0 dup/predawn/postCheckout/dangling. **D1 06:20 "Breakfast" (H4, marginal −10min)** — auto-locked meal slipped the breakfast-lift gate (gate skips locked cards). |

**Checkpoint after #5:** **4 clean / 1 marginal.** Hard tier: Rome+Tokyo overflow handled; only Lisbon's 06:20 auto-locked breakfast breaches H4 (by 10 min). → **fix the lift-gate gap, then CONTINUE.**

### Key learning from Tripwire 5
**Tokyo (8d/6must) had NO overflow — 6 must-dos fit cleanly with room.** So the post-checkout cramming is *genuinely short-trip over-capacity* (Rome 3d/6must), not a general 6-must-do bug. The fix + soft-warn target exactly the right case; long trips with many must-dos are fine.

### Set 2 — breadth (6–12)
| # | City | Days | Must-dos | Budget | Stress tested | Cr | Status | H-fails | S-fails | Disposition / notes |
|---|------|------|----------|--------|---------------|----|--------|---------|---------|---------------------|
| 6 | Marrakech | 4 | 3 | moderate | non-catalog mid | 240 | ⬜ | | | |
| 7 | Paris | 5 | 3 | moderate | big catalog city | 300 | ⬜ | | | |
| 8 | New York | 3 | 0 | budget | short + cheap | 180 | ⬜ | | | |
| 9 | Bangkok | 7 | 6 | moderate | long + many, non-Euro | 420 | ⬜ | | | |
| 10 | Amsterdam | 4 | 3 | luxury | luxury one-splurge test | 240 | ⬜ | | | |
| 11 | Seoul | 6 | 3 | moderate | non-catalog | 360 | ⬜ | | | |
| 12 | Mexico City | 5 | 6 | budget | many must-dos + budget | 300 | ⬜ | | | |

### Set 3 — stress / break (13–20) — *needs credit top-up*
| # | City | Days | Must-dos | Budget | Stress tested | Cr | Status | H-fails | S-fails | Disposition / notes |
|---|------|------|----------|--------|---------------|----|--------|---------|---------|---------------------|
| 13 | Barcelona | 10 | 6 | moderate | **very long** (heal-prone) | 600 | ⬜ | | | |
| 14 | Reykjavik | 3 | 0 | moderate | thin-data city | 180 | ⬜ | | | |
| 15 | Rome | 5 | 6 | luxury | many + luxury | 300 | ⬜ | | | |
| 16 | Cairo | 8 | 6 | budget | non-catalog long + many | 480 | ⬜ | | | |
| 17 | Tokyo | 3 | 3 | moderate | short big-city | 180 | ⬜ | | | |
| 18 | Istanbul | 6 | 3 | moderate | non-catalog | 360 | ⬜ | | | |
| 19 | London | 5 | 0 | luxury | luxury, no constraints | 300 | ⬜ | | | |
| 20 | Lagos | 4 | 3 | moderate | **break the catalog** (very non-catalog) | 240 | ⬜ | | | |

Legend: ⬜ not run · 🟩 pass · 🟥 hard fail · 🟨 soft fail only

---

## Per-trip must-do set (keep constant so failures are comparable)
- 3-must-do trips: `Tapas in <local> where locals actually eat` · `<local market> in the morning` · `One memorable splurge dinner, traditional <cuisine>`
- 6-must-do trips: the 3 above **+** 2 first-time landmarks **+** `Slow wander a historic neighborhood`
- Note in row: `"3 to 4 things a day, one splurge, cheap and local otherwise"` in the *anything-else* box (tests the cap + splurge enforcement)

## Results summary (fill at the end)
- Hard-invariant pass rate: ___ / 20
- Soft-target pass rate: ___ / 20
- Disposition counts: FIX ___ · SOFT-WARN ___ · ACCEPT ___
- **Beta verdict:** hard tier clean? ___ · soft ≥ 90%? ___ → **GO / NO-GO**

## Fixes queue (discovered during run)
| Issue | Trips affected | Class | Notes | Status |
|-------|----------------|-------|-------|--------|
| Must-do overflow cramming cards AFTER checkout | Rome (3d/6must) | **FIX** | selfCheckAndRepair strips post-checkout non-logistics + hotel-return. **Re-verified live (015d4f19): postCheckout 2→0.** | ✅ DONE+VERIFIED c7b50b7 |
| Over-capacity must-do request (too many for the days) | Rome | **SOFT-WARN** | Stamps `metadata.quality.capacity_warning`. **Re-verified live: warning fired with the 1 unmet must-do.** Frontend banner to render = follow-up. | ◑ backend done+verified |
| Splurge-DINNER must-do relabeled to morning "Breakfast" under overflow | Rome re-run | FIX (minor) | cross-day meal-relabel turns a 09:15-slotted "dinner" must-do into breakfast. Should preserve intent or drop, not flip dinner→breakfast. | open |
| Auto-locked 06:20 breakfast not lifted (H4) | Lisbon (5d/0must) | **FIX** | breakfast-lift gate skips locked cards (`!isLocked`), so an AUTO-locked early meal survives. Lift gate should treat the first meal even if auto-locked — only skip USER-locked. | open |
| capacity_warning over-reports a vague dining must-do | Tokyo (8d) | FIX (minor) | "Izakaya" flagged unmet despite 8 days of room — coverage matcher likely missed an izakaya-style dinner. Loosen dining keyword match. | open |
| Dangling title persisted ("...Market In") | Rome | RESOLVED | Gate title-strip cleans it on re-run; persisted copy was a pre-status-fix artifact (gate output now persists). | ✅ moot |
| "Rome" autocomplete selects "Frome, UK" | wizard | **FIX** | Bias city search toward major destinations / show country prominently — wrong city silently chosen. | open (frontend) |
