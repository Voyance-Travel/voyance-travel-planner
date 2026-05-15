## Goal
Suppress provably-false health warnings ("Day N missing meal" when meal is rendered, "timing conflict" when cards no longer overlap) by filtering the panel's output through a deterministic guardrail that uses the same canonical timestamps the cards render from.

## Changes

### 1. Create `src/lib/itinerary/timingTruth.ts`
Pure helpers — single source of truth for "what time does the user actually see":
- `canonicalStart(act)` / `canonicalEnd(act)` — read `adjustedStartTime` / `adjusted_start_time` first, fall back to `startTime` / `start_time`.
- `parseHM(t)` — parse `HH:MM` or `HH:MM AM/PM` to minutes-since-midnight.

### 2. Create `src/lib/itinerary/healthIssueGuardrail.ts`
Exports `guardrailHealthIssues(issues, days)`:
- For any issue whose message matches `/Day N missing X/`, re-check each named meal using `dayHasMealCard()` (dining-category + meal title regex OR canonical start-time window). Drop the issue if all listed meals are present; otherwise rewrite the message to only the truly-missing ones.
- For any issue whose `id` starts with `conflict-|overlap-|timing-` and encodes two activity ids (`type|aId|bId`), re-check overlap using canonical times. Drop if no overlap remains.
- Logs `[HealthGuardrail] Suppressed false-positive …` on every drop.

### 3. Wire into `src/components/trip/TripHealthPanel.tsx`
- Add import: `import { guardrailHealthIssues } from '@/lib/itinerary/healthIssueGuardrail';`
- Wrap the existing `healthIssues` useMemo (line 908) so the filtered set passes through the guardrail before any downstream consumer sees it. `days` is already in scope as a prop.

No changes to `analyzeHealth`, no changes to detection logic, no changes to `rawHealthIssues` or `stableIssues`. Pure output filter.

## Acceptance Criteria
1. Both new files exist.
2. `TripHealthPanel.tsx` contains ≥2 `guardrailHealthIssues` references (import + call).
3. `healthIssueGuardrail.ts` contains ≥2 `Suppressed false-positive` log strings.
4. `timingTruth.ts` contains ≥2 `canonicalStart|canonicalEnd` references.
5. On affected trips, console shows `[HealthGuardrail] Suppressed false-positive` and the false warning disappears from the panel.

## Out of Scope
- Refactoring `analyzeHealth` or any meal-detection / cascade-preview logic.
- Changing health-score math beyond what the natural reduction in `healthIssues.length` produces.
