## Goal

Two problems are tangled together in trip `d18b2e8a…`:

1. **Visibility** — the `appendGenerationTrace` writes shipped this morning didn't land in `metadata.generation_trace` for this trip. The new sentinel `[GENTRACE]` doesn't appear in edge logs either; only the older `[GEN_TRACE]` lines do. Either the new code isn't actually deployed, or the trace calls sit too deep in the handler to fire on early-exit paths.
2. **Quality** — AI returned a malformed plan: Day 1 = 15 cards (over-packed), Day 2 = 3 real activities, Day 3 = 4 real activities (both flagged `WRAP_GAP_OVER_3H`), Day 4 = logistics-only (legit departure day, but Persist Gate classed it `EMPTY_DAY` → forced the whole trip to `partial`).

This plan does both.

---

## Part A — Visibility (so the next failure is self-explaining)

### A1. Force-redeploy the generation trace functions
`appendGenerationTrace` is imported and called at 5+ sites in both `action-generate-trip.ts` and `action-generate-trip-day.ts`, but no `[GENTRACE]` appeared in this trip's edge logs. Deploy `generate-itinerary` explicitly and curl it once to confirm the new code is live before doing anything else.

### A2. Add an unconditional "first line" trace at every entry point
Right now the earliest trace call in `action-generate-trip-day.ts` is at line 695, well after several early-return guards (cancel checks, auth, body parsing). Add a single trace write as literally the first line inside each action handler:

- `action-generate-trip.ts` → `phase: 'launcher_received'` before any validation
- `action-generate-trip-day.ts` → `phase: 'day_handler_entered'` with `dayNumber` parsed from the body before any short-circuit
- `action-save-itinerary.ts` → `phase: 'save_entered'` before the persist gate

That way, even if a downstream step throws or returns early, the DB row tells us the entry point ran.

### A3. Wire `writeGenerationHealth` at terminal states
The helper exists but no one calls it. Call it from:
- `action-generate-trip-day.ts` chain-final branch (success)
- `action-generate-trip.ts` launcher catch block (failure)
- `action-save-itinerary.ts` after persist-gate verdict

Stamp `metadata.generation_health` with `{finalStatus, expectedTotalDays, jsonDays, jsonRealDays, tableDays, persistGateCodes, lastGoodPhase}`. One row, one snapshot — instantly answers "what did this trip end up looking like?"

### A4. Persist the persist-gate verdict at the trace level too
We already write `metadata.persist_validation`. Also append a `persist_gate_blocked` trace event with the offending day numbers and codes so the trace timeline is self-contained.

---

## Part B — Quality fix for the Rome-class failure

### B1. Stop `EMPTY_DAY` from collapsing legitimate departure days
This is the headline fix for Rome's trip. Day 4 is a real departure day: checkout → airport transfer → flight. That's correct per the departure-day rules — there's no "missing real activity" here, the AI did the right thing. The persist gate rule is wrong.

In `_shared/validate-itinerary-for-persist.ts::EMPTY_DAY`:
- When the day is the last day AND has a `flight`/`airport-transfer`/`checkout` row AND a derived/persisted `meal_policy.requiredMeals` of `[]` or `['breakfast']` only — downgrade `EMPTY_DAY` from `error` → `warning` (or drop entirely on departure days that have at least one of `flight`+`transfer`+`checkout`).
- Mirror the same exemption for Day 1 when an evening arrival is on the books.
- Effect: legitimate logistics-only days stop forcing the trip into `partial`. They can still surface as a `DEPARTURE_DAY_LIGHT` warning if we want them visible without blocking.

### B2. Add a per-day density floor that triggers a single repair pass (not whole-trip partial)
Day 2 = 3 real activities, Day 3 = 4 real activities on a full city day in Rome is sub-spec. Today's Persist Gate has no `SPARSE_DAY` rule — it only fires `WRAP_GAP_OVER_3H` (which is the symptom, not the cause).

Add a new validation:
- `SPARSE_DAY` (warning, severity bumps to error only if `realCount < 3` on a full mid-trip day).
- In `action-generate-trip-day.ts`, after `repairDay`, if `SPARSE_DAY` fires AND the day isn't first/last, trigger ONE `fill-dead-gaps` pass before persist (the helper already exists for last-day gap-fill — reuse it). This is bounded, no new AI roundtrip beyond the existing dead-gap path.

### B3. Cap Day 1 packing
Day 1 had 15 cards. The arrival-day prompt already carries a "respect arrival buffer" rule but no upper bound on count. Add an explicit cap in the prompt: **Day 1 activity count ≤ `max(6, otherDayMedian + 1)`**. Enforce post-generation in `repair-day` step (new §9e): if Day 1 count exceeds the cap by more than 2, drop the lowest-priority non-meal/non-anchor/non-locked activities until in range (oldest insertion order first, preserving meals + anchors + locked).

### B4. Per-day quarantine instead of whole-trip collapse
Today, any single day failing the gate flips `itinerary_status` to `partial` and stamps `failed_day_numbers`. That's why Rome looks broken on screen even though 3 of 4 days are fine.

Change `action-save-itinerary.ts` save-time gate to:
- Only flip `partial` if **a day has zero real activities AND isn't a departure/arrival logistics day**.
- Otherwise: keep `itinerary_status = ready`, but stamp `metadata.day_quality[dayNumber] = { code, severity, detail }` so the UI can render a per-day "needs review" badge without nuking the whole trip.
- `failed_day_numbers` only includes days that truly failed (zero real activities, non-logistics).

### B5. One-shot backfill for stuck trips
SQL migration to find every trip where:
- `itinerary_status = 'partial'`
- All expected days exist in `itinerary_days`
- Each day has ≥1 real activity OR is a logistics-only departure/arrival day

…and promote to `ready`, clear `failed_day_numbers`, clear `generation_error`. Stamp `metadata.recovery_promoted_at` for auditability. This recovers Rome plus any siblings created since the last backfill.

---

## Files to touch

**Backend (edge)**
- `supabase/functions/_shared/generation-trace.ts` (no change; verify deployed)
- `supabase/functions/_shared/validate-itinerary-for-persist.ts` (departure-day EMPTY_DAY exemption + new SPARSE_DAY rule)
- `supabase/functions/generate-itinerary/action-generate-trip.ts` (first-line trace + writeGenerationHealth on catch)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (first-line trace + writeGenerationHealth on chain-final + sparse-day repair trigger + Day 1 cap)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (per-day quarantine instead of whole-trip partial; persist-gate trace event)
- `supabase/functions/generate-itinerary/repair-day.ts` (new §9e: Day 1 over-pack trim)
- `supabase/functions/_shared/prompt-library.ts` (Day 1 cap rule in prompt)

**Migration**
- `supabase/migrations/<ts>_backfill_partial_to_ready_round2.sql` (one-shot promote of trips like Rome)

**Tests**
- `supabase/functions/_shared/__tests__/validate-itinerary-for-persist.test.ts` — add cases: legit departure day no longer EMPTY_DAY; SPARSE_DAY fires below density floor; Rome-shaped 4-day input passes
- `supabase/functions/_shared/__tests__/generation-trace.test.ts` — already exists; extend to assert `writeGenerationHealth` snapshot fields

---

## Expected outcome

- Rome's trip self-heals to `ready` on the backfill; UI shows all 4 days correctly, with Day 2 & 3 potentially carrying a "Needs more activities" amber badge (not a blocking error).
- Next initial-generation failure leaves a complete `metadata.generation_trace` + `metadata.generation_health` snapshot — diagnosable from one SQL query.
- Departure-only Day N no longer collapses the trip into `partial`.
- Day 1 over-packing on early/overnight arrivals is bounded.
- Sparse middle days trigger a single bounded dead-gap repair pass instead of being silently shipped.

## What this plan does NOT do

- No new AI model, no new credit cost.
- No frontend UI work for the per-day badge yet (just persists the data so a follow-up UI pass can render it).
- No removal of the existing `WRAP_GAP_OVER_3H` warning — that stays as a separate signal.
