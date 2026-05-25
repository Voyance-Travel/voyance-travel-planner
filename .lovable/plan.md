# Wrap-up: Memory entries for must-do scheduler + injector

Two memory writes to finish the shipped work, plus one Core line update.

## 1. New memory file: `mem://constraints/itinerary/must-do-coverage-injection`

```
---
name: must-do-coverage-injection
description: Clock-gated scheduler + deterministic injector guarantee every user-selected must-do venue lands on a believable slot before persist
type: constraint
---
Every required must-do (Vatican Museums, Trevi, Colosseum, etc.) MUST be scheduled by `scheduleMustDos` (`_shared/schedule-must-dos.ts`) and injected by `injectMissingMustDos` (`_shared/inject-missing-must-dos.ts`) before final persist. Wired into chain-finalization in `action-generate-trip-day.ts` after repair, before `persistTripItinerary`.

**Scheduler rules:**
- Respects `arrivalBufferMins` (120m) on Day 1 and `departureBufferMins` (180m) on last day.
- Indoor museum venues: 17:00 ceiling.
- After-dark-safe landmarks (Trevi, Colosseum exterior, plaza/fountain/bridge regex): 21:00 ceiling.
- 15-min-aligned greedy fill, prefers day with fewest existing landmarks.
- Never overlaps a locked activity.

**Injector:**
- Creates sightseeing card with `anchorSource: 'must_do'`, `source: 'must-do-injection'`, `locked: true`.
- Coverage matcher (`_shared/assert-must-do-coverage.ts`) uses **whole-word boundary** match (`\b<token>\b`) against identity fields only (title/name/venue/location.name) — description/address dropped (root cause of "Trevi matches Travel to…" false positives).

**Validate-then-stamp pattern:**
- Re-asserts coverage AFTER injection. `metadata.must_do_repair_attempted` only stamps when injection actually ran.
- Unscheduled venues append `MUST_DO_INJECTION_FAILED` to `generation_health.persistGateCodes`.

Tests: `_shared/__tests__/schedule-and-inject-must-dos.test.ts` (7 cases). Sentinel: `[INJECT_MUST_DO] day=N venue=…`.
```

## 2. Core line addition to `mem://index.md`

Add under Core (between Persist Metadata Merge and Credit Policy):

```
- **Must-Do Coverage:** Clock-gated `scheduleMustDos` + deterministic `injectMissingMustDos` run in chain-finalization before persist; injection stamps `must_do_repair_attempted` only when it fires, failures emit `MUST_DO_INJECTION_FAILED` health code. Coverage matcher uses whole-word boundary on identity fields only. See mem://constraints/itinerary/must-do-coverage-injection.
```

## 3. Memories-section reference (also in index)

```
- [Must-Do Coverage & Injection](mem://constraints/itinerary/must-do-coverage-injection) — Clock-gated scheduler (17:00 museum / 21:00 after-dark ceilings) + injector wired pre-persist with validate-then-stamp
```

## Out of scope

- The `LANDMARK_AFTER_DARK` repair pass for Rome Day 1 Colosseum (separate follow-up).
- Pre-existing linter warnings unrelated to this work.
- Any further Rome data edits.

Approve and I'll write the memory file + update the index in one go.
