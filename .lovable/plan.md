

# Phase 3: Validators & Repair

## What exists today (post-generation pipeline in `action-generate-day.ts`)

After the AI returns a day, lines ~1466–3370 run a gauntlet of post-processing steps. These are currently inline, interleaved, and hard to trace:

| Step | Lines | What it does | Target module |
|------|-------|-------------|---------------|
| Parse + sanitize AI response | 1466–1488 | `sanitizeGeneratedDay`, `sanitizeOptionFields`, `sanitizeDateFields` | Keep in sanitization.ts (text cleanup) |
| Strip phantom hotels | 1500–1506 | Remove fabricated hotel activities when no hotel booked | `validate-day.ts` → PHANTOM_HOTEL |
| Filter pre-arrival activities | 1553–1579 | Remove activities before flight arrival on Day 1 | `repair-day.ts` → CHRONOLOGY |
| Locked activity merge + semantic dedup | 1581–1636 | Remove overlaps with locked slots, dedup by title similarity | `repair-day.ts` → DUPLICATE_CONCEPT |
| Activity enrichment (Google Maps) | 1642–1710 | Ratings, photos, coordinates | Stay in action-generate-day (I/O) |
| Trip-wide duplicate validation | 2169–2341 | `validateGeneratedDay()` + strip duplicates + pool swaps for meal repeats | `validate-day.ts` → DUPLICATE_CONCEPT, MEAL_DUPLICATE |
| Personalization validation | 2343–2407 | Avoid-list, dietary violations | `validate-day.ts` → WEAK_PERSONALIZATION |
| Departure day sequence validator | 2409–2650 | 6 rules: breakfast↔checkout order, security↔flight, time windows | `repair-day.ts` → LOGISTICS_SEQUENCE |
| Transport & hotel bookend validator | 2652–2746 | Inject transit gaps, hotel return cards | `repair-day.ts` → MISSING_SLOT |
| Chain restaurant filter | 3343–3351 | `filterChainRestaurants()` | `validate-day.ts` → CHAIN_RESTAURANT |
| Meal guard | 3353–3368 | `enforceRequiredMealsFinalGuard()` | `repair-day.ts` → MEAL_MISSING |

## New files

### 1. `pipeline/validate-day.ts`

Structured validator that classifies every issue by `FailureCode` (from `types.ts`). Returns `ValidationResult[]` — no mutations, pure inspection.

Checks to implement (mapped to failure codes):
- **PHANTOM_HOTEL** — hotel activities when `hasHotel === false`
- **CHAIN_RESTAURANT** — dining activities matching the blocklist
- **MEAL_ORDER** — lunch after 17:00, breakfast after 14:00
- **MEAL_MISSING** — required meals not detected
- **MEAL_DUPLICATE** — same meal type back-to-back
- **CHRONOLOGY** — activities not sorted by startTime
- **TIME_OVERLAP** — overlapping time windows
- **LOGISTICS_SEQUENCE** — checkout after airport, security not before flight
- **DUPLICATE_CONCEPT** — same concept as previous day (trip-wide)
- **GENERIC_VENUE** — placeholder names ("Local Restaurant", "A Nice Café")
- **TITLE_LABEL_LEAK** — "Voyance Pick", "Staff Pick" in title (already caught by sanitization, but now classified)
- **WEAK_PERSONALIZATION** — avoid-list / dietary violations

Input: generated day, compiled facts, previous days, user preferences.
Output: `ValidationResult[]` with codes, severity, activity index, and `autoRepairable` flag.

### 2. `pipeline/repair-day.ts`

Deterministic repairs keyed to failure codes. Each repair function takes the day + the specific `ValidationResult` and returns a mutated day.

Repairs to implement:
- **PHANTOM_HOTEL** → strip phantom hotel activities (extract from `sanitization.ts`)
- **CHAIN_RESTAURANT** → remove chain restaurants (extract from `day-validation.ts`)
- **MEAL_ORDER** → reassign meal times (extract from `sanitization.ts` lines 171–193)
- **MEAL_MISSING** → inject fallback meals via `enforceRequiredMealsFinalGuard` (extract from `day-validation.ts`)
- **CHRONOLOGY** → sort by startTime
- **LOGISTICS_SEQUENCE** → the 6-rule departure validator (extract lines 2409–2650)
- **MISSING_SLOT** → bookend validator: inject transit gaps + hotel returns (extract lines 2652–2746)
- **DUPLICATE_CONCEPT** → strip trip-wide duplicates, swap meals from pool (extract lines 2243–2331)
- **WEAK_PERSONALIZATION** → strip activities with critical avoid-list violations (extract lines 2377–2400)

### 3. Updates to `pipeline/types.ts`

Add `ValidateDayInput` interface to bundle the validator's inputs cleanly:
```
interface ValidateDayInput {
  day: GeneratedDay;
  facts: CompiledFacts;
  previousDays: DayMinimal[];
  userPreferences?: UserPreferences;
  mustDoActivities?: string[];
  restaurantPool?: RestaurantPoolEntry[];
  usedRestaurants?: string[];
}
```

## Changes to existing files

### `action-generate-day.ts`

Replace the scattered post-processing blocks (lines ~1500–3370) with:
```
const validationResults = validateDay(generatedDay, validationInput);
const { day: repairedDay, repairs } = repairDay(generatedDay, validationResults, repairContext);
```

The enrichment step (Google Maps) stays inline since it's async I/O, not rule logic.

Net reduction: ~800-1000 lines from the monolith.

### `action-generate-trip-day.ts`

Log validation results and repairs via `StageLogger`:
```
logger.logValidation(validationResults);
logger.logRepairs(repairs);
```

### `sanitization.ts`

Remove meal time validation (lines 171–193) and phantom hotel stripping (lines 240–299). Keep only text-level cleanup: CJK stripping, schema leak removal, label dedup, em-dash replacement, duration normalization.

### `day-validation.ts`

This file's logic moves into `validate-day.ts` and `repair-day.ts`. It can be kept as a thin re-export layer for any remaining callers, or deprecated.

## Execution order

1. Create `validate-day.ts` with all checks returning `ValidationResult[]`
2. Create `repair-day.ts` with repair functions keyed to codes
3. Wire both into `action-generate-day.ts`, replacing inline blocks
4. Slim down `sanitization.ts` to text cleanup only
5. Wire logging into `action-generate-trip-day.ts`
6. Update `types.ts` with new input interfaces

## Risk

**Medium-low.** The repairs are extracted 1:1 from existing code. The risk is in the ordering — some repairs depend on others having run first (e.g., chain filter before meal guard, departure validator before bookend validator). The repair pipeline must preserve this execution order.

## Verification

Generate trips before and after. The `pipeline_logs` will now show exactly which validation codes fired and which repairs were applied per day. Compare output quality — should be identical.

