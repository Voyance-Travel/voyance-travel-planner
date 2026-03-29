

# Phase 4 Cleanup: Remove Dead Imports & Simplify

## What needs to happen

After the prompt extraction in Phase 4, `action-generate-day.ts` has ~15 import blocks that are now completely unused — their functions moved into `compile-prompt.ts`. Cleaning these up removes noise and makes the remaining orchestrator easier to read.

## Dead imports to remove (lines 50–216)

These entire import blocks are unused in the body of `action-generate-day.ts`:

| Import block | From module | Why dead |
|---|---|---|
| `buildSkipListPrompt`, `deriveBudgetIntent`, `buildBudgetConstraintsBlock`, `formatGenerationRules`, `BudgetIntent` | `budget-constraints.ts` | Moved to compile-prompt |
| `deriveForcedSlots`, `deriveScheduleConstraints`, `reconcileGroupPreferences`, `validateDayPersonalization`, `buildForcedSlotsPrompt`, `buildScheduleConstraintsPrompt`, `buildGroupReconciliationPrompt` + types | `personalization-enforcer.ts` | Moved to compile-prompt |
| `calculateTruthAnchorConfidence`, `needsFallback`, `verifyFromGooglePlaces`, `verifyFromCache`, `generateFallback`, `buildTruthAnchorPrompt`, `validateTruthAnchors`, `validateOpeningHours` + types | `truth-anchors.ts` | Moved to compile-prompt |
| `getCuratedZones`, `assignToZone`, `determineDayAnchor`, etc. + types | `geographic-coherence.ts` | Moved to compile-prompt |
| `buildDayPrompt`, `buildPersonaManuscript`, `extractFlightData`, `extractHotelData`, `buildTravelerDNA`, `buildTransitionDayPrompt`, `buildFlightIntelligencePrompt` + types | `prompt-library.ts` | Moved to compile-prompt |
| `deriveMealPolicy`, `buildMealRequirementsPrompt` + types (`MealPolicyInput`, `RequiredMeal`) | `meal-policy.ts` | Moved to compile-prompt (keep `MealPolicy` type if used) |
| `buildDietaryEnforcementPrompt`, `expandDietaryAvoidList`, `checkDietaryViolations`, `getMaxDietarySeverity` + type | `dietary-rules.ts` | Moved to compile-prompt |
| `getTripDurationConfig`, `calculateDayEnergies`, `buildTripDurationPrompt`, `analyzeChildrenAges`, `buildChildrenAgesPrompt` | `trip-duration-rules.ts` | Moved to compile-prompt |
| `buildReservationUrgencyPrompt` | `reservation-urgency.ts` | Moved to compile-prompt |
| `calculateJetLagImpact`, `buildJetLagPrompt`, `resolveTimezone` | `jet-lag-calculator.ts` | Moved to compile-prompt |
| `buildWeatherBackupPrompt`, `determineSeason` | `weather-backup.ts` | Moved to compile-prompt |
| `buildDailyEstimatesPrompt` | `daily-estimates.ts` | Moved to compile-prompt |
| `blendGroupArchetypes`, `blendTraitScores`, `TravelerArchetype` | `group-archetype-blending.ts` | Moved to compile-prompt |
| `analyzePreBookedCommitments`, `PreBookedCommitment` | `pre-booked-commitments.ts` | Moved to compile-prompt |
| `buildTripTypePromptSection`, `getTripTypeModifier`, `getTripTypeInteraction` | `trip-type-modifiers.ts` | Moved to compile-prompt |
| `loadTravelerProfile` | `profile-loader.ts` | Moved to compile-prompt (keep type aliases `UnifiedTravelerProfile` etc. — still used downstream) |
| `buildDestinationEssentialsPrompt`, `buildDestinationEssentialsPromptWithDB`, `getDestinationIntelligence`, `hasCuratedEssentials` | `destination-essentials.ts` | Moved to compile-prompt |
| `getUserPreferences`, `getLearnedPreferences`, `buildPreferenceContext` | `preference-context.ts` | Moved to compile-prompt |
| Most of `archetype-data.ts` exports | `archetype-data.ts` | Moved to compile-prompt |

## Additional cleanup

1. **Simplify `flightContext` variable** — Remove the `flightContext2` intermediary (lines 333-335). Just assign `flightContext = prompt.flightContext` directly.

2. **Check for redundant schema compilation** — The previous summary mentioned a redundant `compileDaySchema` call around lines 552-565 that may have been left behind. Verify and remove if present.

3. **Update `.lovable/plan.md`** — Mark Phase 4 as completed and outline remaining phases.

## Scope

- 1 file modified: `action-generate-day.ts` (remove ~80 lines of dead imports, simplify 3 lines of flightContext)
- 1 file updated: `.lovable/plan.md`
- No behavioral changes — pure dead code removal

