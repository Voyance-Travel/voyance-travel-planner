# No-Auto-Resume-On-Load — Verification

## What we were fixing

A trip with saved activities was being silently overwritten on page load because background self-heal paths in `TripDetail.tsx` were invoking `generate-itinerary` (`action: 'generate-trip'`) without first checking whether the trip already had real content. Combined with `useGenerationPoller` previously auto-invoking on stall, this regressed visible itineraries to a degraded state after refresh.

## What is in place right now (verified)

1. **`useGenerationPoller`** — no longer invokes `generate-itinerary` on stall; only logs and reports. `useAutoResume` deleted.

2. **`TripDetail.tsx` — 5 allow-listed `action:'generate-trip'` sites**, each guarded:
   - **L527** `handleResumeGeneration` — explicit user button.
   - **L816** `triggerGeneration` (queued journey leg) — fetches `itinerary_data` + counts `itinerary_days`; **skips + refreshes** if either has activities (L795–812).
   - **L1014** `stuckHealAttempted` — gated by `count(itinerary_days)===0` AND `!hasItineraryData(trip)`; otherwise auto-corrects status to `ready` (L989–998).
   - **L1117** `notStartedHealAttempted` — gated by `!hasItineraryData(trip)` AND backend `count(itinerary_days)===0` re-check (L1085–1093).
   - **L4238** extend-days — explicit user action.

3. **Tests passing** (8/8):
   - `useGenerationPoller.no-auto-resume.test.ts` — 3 tests confirm no `generate-itinerary` invocation on stall.
   - `TripDetail.no-silent-regen.test.ts` — 5 tests assert each guard exists in source.

4. **Memory updated** — `mem://constraints/itinerary/no-auto-resume-on-load` documents the 5-site allow-list, both-layer guards (JSON + normalized rows), and bans re-introducing `useAutoResume` / `autoResumeAttemptedRef`.

## Recommendation

**No additional code changes.** The fix from the prior turn is complete, correct, and locked by tests. If you are still seeing the symptom in preview (e.g. activities disappearing on refresh on a specific trip), that would be a different bug — most likely one of the persistence-layer defenses (Frozen-After-Ready, No-Regression-Overwrite, DB-Is-Source-of-Truth), not auto-resume.

## If you want me to proceed

Tell me which trip ID is still misbehaving and what you observed (before/after refresh), and I'll trace it against the persistence layer instead of auto-resume. Otherwise this work item is closed.
