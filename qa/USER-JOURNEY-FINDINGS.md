# User-Journey QA — Execution Log

Results of running the owner's 10-scenario user QA plan. **Engine + fidelity:**
rows marked **[headless]** were driven through the real *deployed* chat
extractor + generator (no UI) — they certify **intent capture (A)** and
**generation content (C)** but NOT rendering, images, quiz/DNA, navigation, or
"what questions the UI asks." Those need a **live UI pass** (drive
voyancetravel.com as the persona). Headless single-day generation also skips
the full-trip finalize/dedup, so timing/duplication findings need full-flow
confirmation. Prod tested: project `qpwexpjqzsdkjkvgcntx` (live bundle on
travelwithvoyance.com — confirm vs voyancetravel.com).

| # | Scenario | A intent | C generation | Severity | Status |
|---|---|---|---|---|---|
| 1 | Day trip Atlanta | ✅ no flight/hotel must-dos, World-Cup→vibe | ❌ 3 meals + "Checkout from Your Hotel", **0 activities** | **CRITICAL** | fix = `efe9b6fc4` (NOT deployed) → re-test |
| 2 | Birthday Madrid | ✅ (asks dates) | 🟡 real venues (Casa Lucio, Museo Sorolla) ✅, but 5:50 AM museum + dup lunch (likely harness artifact), occasion theme weak | MEDIUM | verify in full flow |
| 3 | Girls' BCN+Madrid | ✅ 2 cities, train, travelers=4 | not run | MEDIUM | ⚠ interests (beach/nightlife/shopping) not in notes/mustDo — verify capture |
| 4 | Paris/Amsterdam/Brussels train | ✅ train both legs + "no fly" noted | not run | MEDIUM | ⚠ **city order zigzag** Paris→Amsterdam→Brussels (geo-optimal = Paris→Brussels→Amsterdam) |
| 10 | No destination (3h from ATL) | ✅✅ discovery + radius-aware suggestions (Miami…) | n/a | — | **PASS** |
| (P4) | Tokyo specific (slow, teamLab+omakase) | ✅ | ✅ both must-dos scheduled + real venues | ~~HIGH~~ → **NOT A BUG** | see correction below |

### CORRECTION — "slow pace ignored" was a TEST ARTIFACT, not a bug
Pacing works end-to-end. The chat extractor maps "slow pace" → `pacing:'relaxed'`
(tool schema: relaxed=2-3 activities/day); `Start.tsx:3104` stores it into
`trips.metadata.pacing`; `compile-prompt.ts:460/697` reads it and injects
"PACING = RELAXED: Fewer activities". Direct A/B generation confirmed:
**`pacing=relaxed` → 3 real activities, `pacing=packed` → 4** on a Tokyo day.
My earlier "7-activity packed day" was because my harness put "slow pace" in
`additionalNotes` instead of the `pacing` field, so it defaulted to `balanced`.
Lesson for the harness: it must populate the SAME structured fields the real
chat flow does, or it produces false negatives.

**Remaining (LOW, optional polish, NOT the reported bug):** the relaxed day
still runs to ~23:40 (the guidance thins activities but doesn't wind the day
down earlier), and `packed` under-delivers (4 vs the 5+ spec). Narrow
relaxed↔packed spread. Defer unless we want the polish.

## Prioritized fixes (from real user impact)
1. **CRITICAL — S1 day-trip thin + phantom checkout.** Fix `efe9b6fc4` exists; **deploy generate-itinerary**, then re-run S1 headless to confirm full day + no hotel cards.
2. ~~HIGH — "slow pace" not honored~~ **WITHDRAWN** — verified working end-to-end (extract→store→reduce density). Was a harness false-negative. LOW polish only (relaxed day end-time; packed density).
3. **MEDIUM — city order not geo-optimized** (S4). Verify whether generation re-routes or follows the zigzag.
4. **MEDIUM — interest/occasion capture** (S2 birthday theme, S3 girls'-trip interests) — confirm beaches/nightlife/celebration land somewhere the generator uses.
5. **VERIFY (full-flow) — timing/dedup** (S2 5:50 AM, dup lunch) — likely finalize-stage artifacts of isolated per-day gen, not real bugs.

## Not yet tested (need live UI — the faithful layer)
- Images loading on itinerary/hero (the recurring blind spot).
- Travel DNA: quiz → archetype → does it visibly change the itinerary?
- The actual question flow ("does it ASK about flights for a day trip").
- Navigation/dead-ends, regenerate/edit, **shareability** (critical for group planners — S3/S9).
- Scenarios 5–9 (family/anniversary/backpacker/work-extension/bachelorette) — group-size, age, budget, partial-trip handling.
