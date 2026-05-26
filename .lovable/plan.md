## Why this has been hard

There are multiple “must-do” paths, and they do not all enforce the same contract:

1. **Prompt-time scheduler** (`generate-itinerary/must-do-priorities.ts`) assigns selected attractions to days for the AI prompt using a load-based day picker. This can say “include 4 things,” but it does not guarantee they survive in the final saved schedule.
2. **Final deterministic injector** (`_shared/schedule-must-dos.ts` + `inject-missing-must-dos.ts`) runs near the end and is stricter about real time windows, overlap, arrival/departure clocks, and daylight ceilings.
3. **Coverage checker** (`assert-must-do-coverage.ts`) now honestly detects missing attractions, but the generation flow still treats that as **warn/non-blocking**, so a trip can finish “ready” with `MUST_DO_UNCOVERED` or `MUST_DO_INJECTION_FAILED` buried in metadata.

So yes: the system can now *find* the issue, but it still doesn’t *block or repair hard enough*. The recurring “2–3 of 4 appear” pattern is usually the 3rd/4th item failing the stricter final slot search after meals, logistics, arrival/departure buffers, and committed activity windows are already on the calendar.

## Root cause to fix

The prompt scheduler and final injector are split-brain:

- Prompt scheduler may distribute 4 selected attractions across the trip.
- AI may omit one or convert it into neighborhood/transport prose.
- Final injector tries to add missing ones, but if it can’t find a clean non-overlapping window, it marks them unscheduled.
- The trip still becomes ready because these failures are metadata warnings, not a presentation-blocking repair path.

## Implementation plan

### 1. Normalize selected attractions into one authoritative list

Add a shared helper that extracts `metadata.mustDoActivities` into clean venue names for both string and array inputs.

Use it in:

- `action-generate-trip-day.ts` pre-persist injection
- final DB-sourced coverage assertion
- `action-save-itinerary.ts` coverage restamp

This prevents array-vs-string drift and makes Rome / Mexico City / Buenos Aires / Istanbul use the same selected-attractions list everywhere.

### 2. Replace prompt-time day assignment with the deterministic scheduler contract

In `compile-prompt.ts`, stop relying only on the legacy `must-do-priorities.ts` load scheduler for selected landmarks.

Use the shared deterministic scheduler’s day/time output when building the “MANDATORY” prompt block, so the model sees the same feasible slots that the final injector will later enforce.

Keep the existing event parser for true all-day / half-day events, but landmark chips should follow the shared scheduler.

### 3. Make final uncovered must-dos presentation-blocking

In `action-generate-trip-day.ts`, if final DB-sourced `must_do_coverage.missing.length > 0` after retry:

- keep the trip persisted, but do **not** silently present it as clean
- stamp `generation_health.persistGateCodes` with `MUST_DO_UNCOVERED` / `MUST_DO_INJECTION_FAILED`
- expose this as a repair-needed state rather than “ready with missing selected attractions”

This changes the failure from “user discovers missing attractions manually” to “system knows the selected attractions didn’t fit and flags it.”

### 4. Add a last-chance displacement repair for selected attractions

If the deterministic injector cannot place a selected attraction:

- try displacing a non-locked, non-meal, AI-generated filler activity from the least disruptive day
- preserve locked/manual/extracted/pinned activities
- never violate departure logistics, meal rules, or hotel/freshen-up rules
- re-run coverage after displacement

This is the key practical fix for “we selected 4, only 2 fit”: selected attractions outrank generic filler, so a filler card should be removed before a user-selected attraction is dropped.

### 5. Add regression tests for the recurring cities

Add tests covering:

- **Rome:** Pantheon, Trevi, Vatican, Colosseum all survive or missing is blocking
- **Mexico City:** Teotihuacan long-haul does not land on arrival/departure day; Zócalo/Bellas Artes/Casa Azul still fit
- **Buenos Aires:** neighborhood/transport cards do not satisfy venue selections; final scheduler does not double-book
- **Istanbul:** mosque/bazaar/palace-style selections preserve daylight windows and do not get treated as vague neighborhood coverage

Also add one test where the 3rd/4th selected attraction only fits after displacing a generic filler activity.

### 6. Update memory

Update `mem://constraints/itinerary/must-do-coverage-injection` with:

- single authoritative selected-attractions extraction
- prompt scheduler must mirror final injector
- uncovered selected attractions are not allowed to be silent “ready” success
- user-selected attractions outrank AI filler activities