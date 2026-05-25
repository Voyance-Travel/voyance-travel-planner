## Finish deferred must-do coverage work

Ship the three deferred items from the approved plan so the Rome `d18b2e8a…` class of bug is closed deterministically, not just unfrozen-and-hope.

### 1. Deterministic missing-must-do injection (§5/6)

In `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (final pass) and the chain-finalization step in `action-generate-trip-day.ts`:

- After `assertMustDoCoverage` runs on the full trip, take `missing[]` and run a new `injectMissingMustDos(trip, missing)` helper.
- For each uncovered must-do, pick a target day + slot using the clock-gated scheduler (§7 below), build a real activity card (title from canonical alias, category=sightseeing/landmark, anchorSource='must_do', locked=true, needsAnchorEnrichment=true so `enrich-day` backfills address/description/coords).
- Re-run `assertMustDoCoverage` on the mutated trip. Only then stamp `metadata.must_do_repair_attempted = { at, injected: [...ids], stillMissing: [...] }`. **Validate-then-stamp** — never fire-and-forget.
- If injection fails (no eligible slot), leave `stillMissing` populated and surface a `MUST_DO_INJECTION_FAILED` entry in `metadata.generation_health.persistGateCodes` so the UI/health panel can flag it instead of silently shipping a gap.

### 2. Clock-gated `scheduleMustDos` (§7)

New helper `_shared/schedule-must-dos.ts`:

- Inputs: trip days, arrival flight clock (Day 1), departure flight clock (Day N), per-day existing activities, must-do venue metadata (preferredTime, dawn/dusk eligibility from `LANDMARK_AFTER_DARK` map).
- Output per must-do: `{ dayNumber, startTime, endTime, slotReason }`.
- Rules:
  - Day 1 eligibility: `arrival + buffer + luggage-drop` before any landmark.
  - Day N eligibility: must end ≥ `departure − buffer − transfer − 60min`.
  - Landmark-after-dark venues (Trevi, Colosseum exterior, etc.) may take evening slots; daylight-only (Vatican Museums, Pantheon interior) get 09:00–16:00 windows.
  - Prefer the day with the lowest existing landmark count to avoid clustering.
  - Skip slots that collide with locked/user/manual rows; fall through to next eligible day.

Used by §1 injector and reused by the existing must-do seeding path in `action-generate-trip-day.ts` so generation and repair agree on slot logic.

### 3. Rome `d18b2e8a…` deterministic data rewrite (§8)

One-shot SQL + JSONB patch migration (no waiting for user "Resume"):

- Day 1: keep arrival flight + luggage drop; move Colosseum to 14:30–17:00; drop the 21:30 stub.
- Day 2: insert Vatican block 09:00–13:00 (St. Peter's + Vatican Museums as two adjacent locked anchors).
- Day 3: insert Pantheon 10:30–11:30 and Trevi Fountain 17:30–18:15 (after-dark eligible).
- Mirror writes to `itinerary_activities` so JSON ↔ table parity holds.
- Re-run `assertMustDoCoverage` post-write; stamp fresh `must_do_coverage = { missing: [], at: now() }`, set `fully_persisted = true`, leave `itinerary_frozen_at` null so the next user edit re-validates.

### Files

- new: `supabase/functions/_shared/schedule-must-dos.ts` + `.test.ts`
- new: `supabase/functions/_shared/inject-missing-must-dos.ts` + `.test.ts`
- edit: `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (wire injector as last step before persist)
- edit: `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (wire injector in chain-finalization; use shared scheduler for seeding)
- edit: `supabase/functions/_shared/assert-must-do-coverage.ts` (export `injected` trace shape; emit `MUST_DO_INJECTION_FAILED` health code)
- new memory: `mem://constraints/itinerary/must-do-deterministic-injection`
- new migration: Rome `d18b2e8a…` deterministic rewrite + activity_costs re-sync

### Out of scope

- Re-architecting the must-do scorer / preferred-time inference beyond the simple alias + after-dark map.
- Charging credits for the self-heal injection pass.
- Multi-retry regeneration loops (single injection attempt + health-code surfacing instead).

### Validation

- New tests: scheduler picks Day-1 post-arrival slot; Day-N respects departure buffer; daylight-only venue rejected from evening; injector idempotent on re-run.
- Manual: post-migration query confirms Rome trip has all 4 must-dos with realistic times and `must_do_coverage.missing=[]`.
