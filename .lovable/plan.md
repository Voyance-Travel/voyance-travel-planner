# Audit: Trip `44a68e13` — Milan, Jun 4–6 2026

## What's actually broken (from `trips.metadata.persist_validation`)

The trip is `status=ready`, `itinerary_frozen_at=2026-05-22T11:02:49Z`, `fully_persisted=true`. Save-time validation ran two minutes after the freeze and recorded these defects — but the freeze blocks any repair, so they stay on screen.

### Day 1 (Jun 4) — pre-dawn cascade

Six activities scheduled between **01:44 and 08:10 AM**, then a normal evening:

```text
01:44 Breakfast at Pavé
03:09 Duomo Terraces & Cathedral
04:57 Lunch at Giacomo Caffè
06:02 Metro to 5 Vie
06:19 Free roam 5 Vie
07:54 Travel to ME Milan Il Duca
08:15 Check-in
09:05 Bike rental walk
...   (normal day continues to 20:40 hotel return)
```

`persist_validation.errors`: 3× `PHANTOM_PREDAWN_CARD`.

Root cause chain:
1. `metadata.generation_context.flight` / `arrivalTime` / `departureTime` are **all null**, and `meal_policy_at_generation` is **null**. The generator had no arrival clock for Day 1.
2. With no clock, the Day-1 brief defaulted to "full day, breakfast required" — but seeded breakfast at hotel check-in time minus a meal stack walking backward, producing 01:44 AM.
3. `normalizePredawnCascade` (Core: "Pre-Dawn Cascade Defense Layer") only shifts a **leading consecutive** `[00:00, 05:00)` block on **Day N ≥ 2**. It explicitly skips Day 1 and stops at the first non-exempt gap, so it never fires here.
4. Trip got frozen at 11:02:49 with `fully_persisted=true`; validation at 11:04:57 logged the errors as advisory. The Frozen-After-Ready guard silently no-ops any `self-heal-*` save, so the pre-dawn block is now permanent until a user-initiated edit.

### Day 3 (Jun 6) — departure-day overlap + missing lunch

```text
08:30 Breakfast: Sartoria Gastronomica
10:35 Golden Hour Group Walk through Brera  (ends 12:05)
11:00 Checkout from ME Milan Il Duca         (ends 11:30)
```

- `persist_validation.errors`: 1× `MISSING_REQUIRED_MEAL` (Day 3 missing lunch). This is a false positive — Day 3 is a departure day, lunch should be dropped, not required. No `savedDepartureTime24` in metadata → departure-day classifier didn't fire, so the meal policy still demands lunch.
- The 10:35–12:05 walk straddles the 11:00 checkout (post-checkout leisure leak). §15z `enforceDepartureDayLogistics` should have pruned the walk or moved checkout, but ran without a flight clock and gave up.

### Day 2 — clean except for a 6h gap warning

13:30 lunch → 16:45 freshen-up → 19:00 dinner. Warning is cosmetic (mid-afternoon rest window for a 3-day trip), low priority.

## What to fix

Strictly the data path; no UI redesign.

### A. Drop the freeze bypass for `PHANTOM_PREDAWN_CARD`

In `safeUpdateItineraryData` + `action-save-itinerary`, allow `self-heal-*` writes through the freeze guard **only when** `metadata.persist_validation.errors` contains one of: `PHANTOM_PREDAWN_CARD`, `LOGISTICS_SEQUENCE`, `POST_CHECKOUT_LEISURE`. Same trip stays frozen for everything else.

### B. Extend `normalizePredawnCascade` to Day 1

Today the helper skips Day 1 because arrival-day timing is "user-known". Change to: when **any** activity on **any day** starts in `[00:00, 05:00)` and is not bookend/locked/departure-logistics, shift the entire leading block to start `09:00` (or `arrivalLocalTime + 60min` when known). Preserve relative spacing. Sentinel `[PREDAWN_CASCADE_NORMALIZE day=1]`.

Wire at the same 3 sites already used: `action-save-itinerary`, `itineraryParser` Step 4, lazy heal in `TripDetail` (now allowed through the freeze gate via A).

### C. Backfill departure-day metadata at save time

If `metadata.savedDepartureTime24` / `savedArrivalTime24` are null, infer from `itinerary_data.days[last].activities` last logistics card (checkout / airport-transfer / flight) and persist back to `metadata`. This unblocks `enforceDepartureDayLogistics` §15z and `meal_policy_at_generation` re-derivation for this trip and all legacy peers.

### D. One-shot heal of this trip

After A+B+C ship, dispatch `safeUpdateItineraryData(tripId, days, { reason:'self-heal-predawn-cascade', allowFrozenWrite:true })` once for `44a68e13` to clear the recorded errors and re-render.

## Out of scope

- Day 2 6h afternoon gap warning (cosmetic).
- Frontend "Fix Timing" CTA copy.
- Cost / budget surfaces (untouched by this audit).

## Acceptance

- `persist_validation.errors=[]` for `44a68e13` after one heal cycle.
- Day 1 cards re-cascade to start ≥ 09:00.
- Day 3 lunch requirement drops; 10:35 walk either moves before 11:00 checkout or is pruned.
- A second Milan trip generated without arrival flight metadata reproduces the bug on `main`, passes on this branch.
