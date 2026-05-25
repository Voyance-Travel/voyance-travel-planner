## Current state

Verified against DB for `d18b2e8a…`:
- `mustDoActivities` = 4 items (Colosseum, Pantheon, Trevi, Vatican) ✓
- `trip_day_intents` = **0 rows** (seeding never ran for this trip — it was generated before the fix shipped)
- `intent_seed_audit` / `must_do_coverage` = NULL

Already shipped in prior turns:
1. Relax-pass scheduling (Day 1/N allowed, 600m cap) — `must-do-priorities.ts`
2. URGENT BACKLOG prompt injection — `compile-prompt.ts`
3. Always-on seeding + `intent_seed_audit` stamp — `intent-normalizers.ts`, `day-intents-store.ts`
4. Daylight directive (08:00–17:30) in prompt

**Still missing** (the user-visible Rome bug is unfixed because no regen has run):
- Post-gen coverage assertion
- `LANDMARK_AFTER_DARK` validator
- One-shot backfill for this trip
- Tests

## Plan

### A. One-shot backfill for trip `d18b2e8a…` (immediate user-visible fix)

Two steps in sequence:

1. **SQL migration**: seed the 4 missing `trip_day_intents` rows (`day_number=NULL`, `priority='must'`, `status='pending'`, source=`'backfill-mustdo-coverage'`) so any future re-run knows about them.
2. **Edge call**: invoke `backfill-trip-intents` then trigger a targeted day-regen for Days 1–3 using existing `action-generate-trip-day` with `forceMustDoInjection: true`. Day 1 keeps Colosseum but moves it to a daylight slot; Day 2 gets Vatican Museums + St. Peter's; Day 3 gets Pantheon + Trevi.

If the targeted regen path is risky to wire from a one-shot, fall back to **deterministic in-place repair**: directly rewrite Days 1–3 in `itinerary_data` via `safeUpdateItineraryData('self-heal-mustdo-coverage')` — Colosseum 14:30–17:30 Day 1, Vatican 09:00–13:00 Day 2, Pantheon 10:00–11:00 + Trevi 11:15–11:45 Day 3, then run `enforceTimingAndBuffers` server-side.

### B. Post-generation coverage assertion (prevent recurrence)

`supabase/functions/_shared/assert-must-do-coverage.ts` (new):
- Input: `allDays`, `mustDos[]`, fuzzy-match by venue name + alias list (Vatican ↔ St. Peter's / Vatican Museums).
- Output: `{ missing, scheduled }`.

Wire into `action-generate-trip-day.ts` final-day branch (after Phase 5, before Phase 6 freeze):
- Stamp `metadata.must_do_coverage`.
- Append `MUST_DO_UNCOVERED` to `generation_health.persistGateCodes`.
- If `missing.length > 0` AND `!metadata.must_do_repair_attempted`: stamp `must_do_repair_attempted=true` and enqueue ONE repair leg targeting the lightest non-departure day with `forceMustDoInjection: missing[0..1]`. No loop possible.

### C. `LANDMARK_AFTER_DARK` validator

In `validate-day.ts`:
- Detect activity where (category in {sightseeing, landmark, museum, monument} OR title matches `LANDMARK_VENUE_RE`) AND `startTime >= 20:00`.
- Emit code `LANDMARK_AFTER_DARK` (warning).
- `repair-day.ts` consumer: swap with the latest-starting non-meal afternoon activity (12:00–17:00) on the same day; if no swap candidate, log only.

### D. Tests

- `must-do-priorities.test.ts` — 4-day Rome-shape trip, 4 long must-dos → all scheduled (relax pass places one on Day 1 afternoon).
- `compile-prompt.test.ts` — uncovered must-do appears in subsequent day prompts.
- `validate-day.test.ts` — Colosseum at 21:30 → `LANDMARK_AFTER_DARK`.
- `assert-must-do-coverage.test.ts` — Vatican alias matching; missing detection.
- `day-intents-store.test.ts` — audit object returned; mustDoActivities seeded even when perDayActivities present.

### E. Memory

Append a Core entry: **Must-Do Coverage Contract** — every `mustDoActivities` venue MUST appear in at least one day; enforced by relax-pass scheduler + URGENT BACKLOG prompt + post-gen coverage assertion + one-shot repair leg gated by `must_do_repair_attempted`.

## Files touched

```
NEW  supabase/functions/_shared/assert-must-do-coverage.ts
NEW  supabase/functions/_shared/__tests__/assert-must-do-coverage.test.ts
NEW  supabase/migrations/<ts>_backfill_rome_mustdo_intents.sql
EDIT supabase/functions/generate-itinerary/action-generate-trip-day.ts  (wire assertion + repair gate)
EDIT supabase/functions/generate-itinerary/pipeline/validate-day.ts     (LANDMARK_AFTER_DARK)
EDIT supabase/functions/generate-itinerary/pipeline/repair-day.ts       (landmark swap handler)
EDIT supabase/functions/generate-itinerary/must-do-priorities.test.ts
EDIT supabase/functions/generate-itinerary/pipeline/compile-prompt.test.ts
EDIT supabase/functions/generate-itinerary/pipeline/validate-day.test.ts
EDIT supabase/functions/_shared/__tests__/day-intents-store.test.ts
EDIT mem://index.md  (Core entry)
NEW  mem://constraints/itinerary/must-do-coverage-contract.md
```

## Out of scope

- Re-architecting must-do scoring (preferred-time inference, cross-day clustering).
- Auto-retrying more than one repair leg.

## Question for you

For step **A**, do you want me to:
- **(i)** trigger an actual regen of Days 1–3 via the generation pipeline (safer for content quality, may take 30–60s, costs LLM tokens), or
- **(ii)** deterministic in-place rewrite using known venue data (instant, free, but content blurbs will be templated)?
