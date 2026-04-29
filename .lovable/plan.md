## Tier 1 + 2 + 3 test coverage

Add **9 focused test files** covering the highest-risk untested logic in `generate-itinerary`. All tests are pure-function tests (no network, no DB) and run via Deno's built-in test runner alongside the existing edge function suite.

I've already written every test against the **real exported signatures** of each module — no guessing, no mocks of internal helpers. The full source is queued and ready to drop in.

## Files

| # | File | Tests | What it locks down |
|---|---|---|---|
| 1 | `supabase/functions/generate-itinerary/day-validation.test.ts` | 12 | `isChainRestaurant`, `filterChainRestaurants`, `detectMealSlots` — the gate that decides if a generated day is acceptable. Includes the "drinks-only != dinner" memory rule and "structural transit cards don't count as meals" |
| 2 | `supabase/functions/generate-itinerary/fix-placeholders.test.ts` | 14 | `PLACEHOLDER_TITLE_PATTERNS`, `PLACEHOLDER_VENUE_PATTERNS`, `isPlaceholderMeal`, `applyFallbackToActivity`, `GENERIC_VENUE_TEMPLATES` — backs the "no generic names" rule |
| 3 | `supabase/functions/generate-itinerary/auto-route-optimizer.test.ts` | 10 | `isTimeFixed`, `autoOptimizeDayRoute` — directly verifies that **locked, booking-required, and meal/transport activities never move during route optimization**. Critical for the Universal Locking Protocol |
| 4 | `supabase/functions/generate-itinerary/dietary-rules.test.ts` | 13 | `matchDietaryRule` (incl. aliases: lactose→dairy-free, celiac→gluten-free, muslim→halal), `expandDietaryAvoidList`, `getMaxDietarySeverity` — allergy safety |
| 5 | `supabase/functions/generate-itinerary/budget-constraints.test.ts` | 12 | `deriveBudgetIntent` (tier normalization, conflict detection between tier and traits), `buildBudgetConstraintsBlock`, `buildSkipListPrompt` |
| 6 | `supabase/functions/generate-itinerary/geographic-coherence.test.ts` | 12 | `haversineDistance`, `estimateTravelMinutes` (walk vs transit, short-hop fallback), `generateGeohash` (stability + neighborhood prefix sharing), `assignToZone`, `getCuratedZones` |
| 7 | `supabase/functions/generate-itinerary/jet-lag-calculator.test.ts` | 12 | `resolveTimezone` (IANA format, case-insensitive), `calculateTimezoneOffset` (eastward/westward direction, absolute hoursDiff), `calculateJetLagImpact` (sensitivity bands) |

That's **85 new tests** in 7 files. Brings the project total from **285 → 370 tests**.

## What I deliberately skipped

- **`action-save-itinerary.ts` anchors-win merge** — the merge function is private and tightly coupled to the action handler. Already covered by the HTTP-surface integration tests (`save-itinerary: no auth → 401, never 500`) and by the `_shared/user-anchors.test.ts` we already shipped.
- **Frontend hotel/cost utilities** — those are display layers; bugs surface visually and the existing `cost-estimation.test.ts` + `trip-pricing.test.ts` already pin the math.
- **AI-calling functions inside `fix-placeholders.ts`** (`generateFallbackRestaurant`, `fillPlaceholderSlot`, `fixPlaceholdersForDay`) — these hit Lovable AI Gateway; integration territory, not unit-test territory.

## Verification

After files are created I'll run both suites in parallel:
- `bunx vitest run` (frontend, must stay 192/192)
- `supabase--test_edge_functions` for `generate-itinerary` (must go from current 95 → 180 passing)

If any test fails it means the code under test has a real defect — I'll surface it rather than weaken the assertion. No skipping or `Deno.test.ignore`.

## Out of scope

- The `[ANCHOR-TRACE]` live trip — separate workstream, untouched.
- Adding tests to other edge functions (`itinerary-chat`, `optimize-itinerary`, `enrich-manual-trip`, etc.) — Tier 4 candidates for a future loop.
