# Audit: Missing user must-haves — Milan trip `44a68e13`

## What the user asked for (from start form)

`metadata.mustDoActivities`:
1. **Duomo di Milano**
2. **Brera Art Gallery**
3. **pasta night**

## What's actually in the itinerary

| Must-do | Status | Evidence |
|---|---|---|
| Duomo di Milano | **MISSING** | Not present on any of the 3 days. Closest reference is Day 1 dinner "Cracco in Galleria" (adjacent to Duomo but not the cathedral visit). |
| Brera Art Gallery | Present | Day 2 09:30 "Explore Brera Art Gallery Masterpieces" |
| Pasta night | **Ambiguous / not honored** | Day 1 dinner = Cracco (fine-dining tasting, not pasta-forward). Day 2 dinner = Ristorante Berton (modern Italian, 2-star). No card titled or themed as a pasta night. Day 2 lunch at Trattoria Milanese is the only traditional Italian slot but it's lunch, not dinner. |

Score: **1 of 3 must-dos honored.**

## Root cause

`trip_day_intents` is **empty** for this trip (0 rows). The 3 must-dos from the start form never made it into the intents table, so:

- `compile-prompt.ts` had no USER WISHES injection on any day brief
- `ledger-check` could not flag `missing_user_intent_soft`
- The generator was free to pick any landmark / dinner theme

This is the exact leak that the `Trip-Wide Intents Injected` core memory documents — `action-generate-trip-day` was patched on 2026-05-?? to call `seedDayIntentsFromMetadata`, but this trip was generated **before** that fix (or the chain-finalization path didn't run it). Both `mustDoActivities` and `userAnchors` are present in metadata but were never seeded.

## Plan

### A. One-shot data heal for this trip

1. Seed `trip_day_intents` rows for the 3 must-dos (trip-wide, `day_number=NULL`, priority `should`):
   - "Duomo di Milano" (landmark)
   - "Brera Art Gallery" (landmark — mark `fulfilled` immediately, points to Day 2 activity)
   - "Pasta night" (dining intent)
2. Bypass the freeze gate (use `self-heal-seed-intents` save reason — add to `INTEGRITY_HEAL_SAVE_REASONS` allowlist).
3. Trigger a single targeted repair pass that:
   - **Day 1**: inserts a 60-min Duomo di Milano visit (afternoon, before Navigli bike) — Duomo is 5 min walk from Cracco/Galleria anyway, fits the existing geography.
   - **Day 2 dinner**: swap Berton → a pasta-forward dinner venue (e.g. Trattoria Trippa, Ratanà, or Da Giacomo). Mark as the "pasta night."
4. Re-mark Brera intent as `fulfilled`.

### B. Systemic guard so this trip class self-heals on next load

Add `TripDetail` mount-time check: if `trips.metadata.mustDoActivities.length > 0` AND `trip_day_intents` count = 0, call a new `backfill-trip-intents` edge endpoint once (gated by a `metadata.intents_backfilled_at` stamp to prevent loops). This catches every legacy trip silently — not just Milan.

### C. Optional: UI surface

In the itinerary header, render a small "Must-do coverage: 1/3" pill that expands to show which intents were honored, partially honored, or missed. Reads from `trip_day_intents.status`. Out of scope for this heal but worth queueing as a follow-up.

## Out of scope

- The 6h Day 2 afternoon gap (separate cosmetic issue)
- Day 3 brevity (departure day, expected)
- Cost / budget surfaces

## Acceptance

- `trip_day_intents` has 3 rows for `44a68e13`
- Day 1 contains a Duomo di Milano activity
- Day 2 dinner is pasta-forward
- All 3 intents show `status = fulfilled`
- A freshly generated trip on `main` with `mustDoActivities` set still seeds intents correctly (regression check on the systemic guard)
