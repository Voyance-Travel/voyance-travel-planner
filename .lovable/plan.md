# Root Cause (one sentence)

**There is no single deterministic compiler that owns the transition from "draft itinerary" to "paid deliverable."** Generation, repair, meal guard, must-do injection, executioner, cost sync, and title coherence each run as independent passes, each can mark the trip persisted, and none of them can *block* a trip from being marked `ready` when canonical truths disagree. So contradictions ship.

Every Lisbon failure is the same shape:
- Flight arrival 21:00 → Day 1 shows 19:00 arrival block (anchor truth ignored at commit).
- Must-do "Tram 28" appears in Day 4 title but on no day (title generator ran on different `days` than injector).
- Alfama wander pinned to Av. da Liberdade (semantic guard exists but doesn't block commit).
- Hotel $250×3 priced but Payments says "Free" (financial truth has two sources, neither authoritative at commit).
- Post-checkin → Airport → Hotel loop on arrival night (no invariant says "non-departure day can't contain a return-airport leg").

These are not five bugs. They are one missing boundary, observed five times.

---

# The Fix: `finalizeTripForCommit` — Single Commit Gate

One module. One call site per write path. The **only** code allowed to set `itinerary_status='ready'`, `metadata.fully_persisted=true`, `metadata.itinerary_frozen_at`.

```text
generate/repair/enrich/meal-guard/executioner/cost-sync/title-coherence
                            │
                            ▼
              finalizeTripForCommit(days, truth)
                            │
              ┌─────────────┴─────────────┐
              │  runs invariants in order │
              │  each returns ok | block  │
              └─────────────┬─────────────┘
                            ▼
            ┌──────────────────────────────┐
            │ ok:true  → persist as ready  │
            │ ok:false → persist as partial│
            │           + healthCodes      │
            └──────────────────────────────┘
```

If any invariant blocks, the trip persists as `partial` with explicit codes. No silent ship.

---

# Invariants (the contract)

Each is a pure function `(days, truth) → { ok, days, codes }`. Order matters; later invariants see the output of earlier ones.

1. **Flight anchor truth** — system-locked arrival/departure cards repaired to match `truth.flights[].arrival/departure`. Stale 2h arrival blocks collapsed to 15-min landing anchors. User/manual locks untouched.
   Block: `FINAL_FLIGHT_ANCHOR_MISMATCH`.

2. **Impossible logistics** — non-departure day cannot contain `transfer-to-airport`; departure-day transfer requires flight/train clock; unverified transit >180m clamped or dropped; arrival-night cannot contain a post-checkin airport loop.
   Block: `FINAL_AIRPORT_LOOP_DROPPED`, `FINAL_TRANSFER_DURATION_CLAMPED`, `FINAL_DEPARTURE_TRANSFER_WITHOUT_CLOCK`.

3. **Must-do presence** — every required must-do from `trip_day_intents` (priority=must) is visibly scheduled. Injection runs *inside* the gate, after meals, before title regen. Zero overlap with meal windows.
   Block: `FINAL_MUST_DO_MISSING`, `FINAL_MUST_DO_OVERLAP_REJECTED`.

4. **Day title coherence** — titles regenerated *after* injections/drops so titles can only reference scheduled content. If a title references a venue not on its day → rewrite.
   Block (non-fatal, auto-repair): `FINAL_DAY_TITLE_REWRITTEN`.

5. **Neighborhood/address coherence** — title/description neighborhood must match pinned address neighborhood (existing `neighborhood-coherence-guard.ts` becomes a blocker, not advisory).
   Block: `FINAL_NEIGHBORHOOD_ADDRESS_CONFLICT`.

6. **Financial truth** — if `truth.hotel.totalPrice > 0`, Payments must surface it; `budget_include_hotel` defaults true when a priced hotel is selected; UI copy "Excluded from budget" never "Free" for priced items.
   Block: `FINAL_HOTEL_COST_EXCLUDED_FROM_OUT_OF_POCKET`.

7. **Status transition** — only this gate writes `ready` / `fully_persisted=true` / `itinerary_frozen_at`. All other writers must pass `status='partial'` or call the gate.

---

# Wiring (minimal surface)

- **New**: `supabase/functions/_shared/finalize-trip-for-commit.ts` — the gate. Composes existing pieces; doesn't reimplement them.
- **New**: `supabase/functions/_shared/truth-snapshot.ts` — assembles `{flights, hotel, intents, dayDates}` from trip row + intents table. One source of truth per commit.
- **Edit**: `action-generate-trip-day.ts` (chain final pass) and `action-generate-day.ts` — replace ad-hoc "set ready" writes with `finalizeTripForCommit(...)` → `persistTripItinerary` with returned status.
- **Edit**: `action-save-itinerary.ts` — user-edit path also routes through the gate (passes `editedByUser=true` so locks tighten).
- **Edit**: `persistTripItinerary` — refuses to write `ready`/`fully_persisted=true` unless caller passes `commitToken` from gate. Hard guardrail.
- **Edit**: `src/hooks/useTripFinancialSnapshot.ts` + `PaymentsTab.tsx` — read `truth.hotel.totalPrice` directly; "Excluded" vs "Free" copy.
- **Existing passes stay**: executioner, meal guard, must-do injector, neighborhood guard — all become *steps invoked by the gate* rather than independent finishers. We delete their right to mark `ready`.

---

# What this changes vs the last 50 attempts

| Past approach | Why it failed |
|---|---|
| Add another validator | Ran in parallel, couldn't block commit |
| Add another repair pass | Mutated `days` after another pass had already persisted `ready` |
| Tighten one anchor rule | Other writers still bypassed it |
| Add another health code | Surfaced post-ship, didn't prevent ship |

This change moves the boundary, not the rules. The rules we already have become *enforceable* because there is finally one place that can refuse to ship.

---

# Verification

- One Lisbon regression fixture covering all five failures in one trip → asserts `status='partial'` with the exact 5 codes before fix, `status='ready'` after.
- Unit tests per invariant (8–10 tests).
- Grep guard test: no code outside `finalize-trip-for-commit.ts` writes `itinerary_status='ready'` or `metadata.fully_persisted=true`.
- Read-time audit (`useReadTimeAudit`) gains a `FINAL_GATE_BYPASSED` code for any legacy trip persisted ready without `metadata.quality.final_gate_trace`.

---

# Out of scope (intentionally)

- New AI prompts, new model upgrades, new venue databases — the gate uses existing data.
- UI redesign of Payments — only the "Free vs Excluded" string and the priced-hotel default.
- Backfilling legacy trips — they self-heal on next save once they route through the gate.

---

# Deliverable

After this lands, the answer to "did we fix the root issue?" is verifiable in one query:

```sql
select count(*) from trips
where itinerary_status = 'ready'
  and metadata->'quality'->>'final_gate_trace' is null;
-- must be 0 for trips created after deploy
```

If that count is 0 and the Lisbon fixture passes, the loop is closed.
