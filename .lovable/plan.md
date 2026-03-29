

# Phase 2: Extract Deterministic Compilers

## What this phase does

Pull the fact-gathering and rule-derivation logic out of `action-generate-day.ts` (lines ~250–1700) into two isolated, testable modules. The main file still calls them and builds the same prompt — behavior stays identical.

## Current state in the monolith

Lines ~250–880 of `action-generate-day.ts` do fact extraction:
- Transition day resolution from `trip_cities` (lines 294–430)
- Locked activity loading from DB, JSON fallback, legacy fallback (lines 436–564)
- User preferences, trip intents, must-do parsing (lines 596–728)
- Interest categories, generation rules, pacing, visitor type (lines 730–757)
- Pre-booked commitments, additional notes (lines 758–822)
- Flight/hotel context fetch + overrides + preference fallbacks (lines 824–880)

Lines ~883–1680 do day-mode classification and constraint derivation:
- First day: morning/afternoon/evening arrival decision tree (lines 889–1154)
- Last day: flight vs non-flight departure, early/midday/afternoon/evening (lines 1155–1619)
- Multi-city boundary constraints (lines 1622–1681)

All of this is deterministic — it reads DB rows, does time math, and produces strings. None of it needs AI.

## New files

### 1. `pipeline/compile-day-facts.ts`

Extracts all deterministic truth into a `DayFacts` object. Sources:
- `trip_cities` → transition day, city mapping, per-city hotel
- `itinerary_days` / `itinerary_activities` → locked activities
- `getFlightHotelContext()` → flight/hotel truth (reuse existing module)
- `deriveMealPolicy()` → required meals (reuse existing module)
- Trip metadata → must-dos, pre-booked commitments, pacing, visitor type
- User preferences → arrival/departure time fallbacks

Input: `supabase`, `tripId`, `dayNumber`, `totalDays`, `params` (the existing request params)
Output: `DayFacts` (already defined in `pipeline/types.ts`)

This consolidates lines ~250–880 of the monolith into one function with a typed return.

### 2. `pipeline/compile-day-schema.ts`

Takes `DayFacts` and produces a `DaySchema` with concrete slots and constraints. This is the decision tree that currently lives in lines ~883–1680:
- Classify `dayMode` (morning_arrival, late_departure, transition_day, etc.)
- Compute `earliestStart` / `latestEnd` from flight times + buffers
- Build locked slots (arrival, hotel check-in, checkout, departure transfer)
- Build fillable meal slots with time windows
- Build fillable activity slots (count based on usable hours + pacing)
- Set constraints (max activities, buffer minutes, prior-day dedup list)

Input: `DayFacts`
Output: `DaySchema` (already defined in `pipeline/types.ts`)

Pure function — no DB calls, no side effects, fully testable.

## Changes to existing files

### `action-generate-day.ts`

At the top of `handleGenerateDay()`, after auth checks (~line 290):

```
const dayFacts = await compileDayFacts(supabase, tripId, dayNumber, totalDays, params);
const daySchema = compileDaySchema(dayFacts);
```

Then replace the inline fact-gathering and decision tree code with reads from these objects. The prompt-building code downstream still runs — it just reads `dayFacts.hotelName` instead of `flightContext.hotelName`, and `daySchema.earliestStart` instead of computing it inline.

This is a refactor, not a rewrite. The prompt strings produced should be identical.

### `action-generate-trip-day.ts`

Wire in the `StageLogger` (from Phase 0) to log `dayFacts` and `daySchema` after each day generates:

```
const logger = new StageLogger(supabase, tripId, dayNumber);
// ... after generation ...
logger.logFacts(dayFacts, factsMs);
logger.logSchema(daySchema, schemaMs);
await logger.flush();
```

## What does NOT change

- `flight-hotel-context.ts` — still called by `compileDayFacts`, not modified
- `meal-policy.ts` — still called by `compileDayFacts`, not modified
- `sanitization.ts` — untouched
- `prompt-library.ts` — untouched
- Frontend — no changes
- AI prompt content — identical output, just sourced from compiled objects

## DayFacts additions needed

The existing `DayFacts` type in `pipeline/types.ts` needs a few fields to cover what the monolith currently tracks:
- `transportMode?: string` (train/flight/car/bus/ferry for transition/departure)
- `transportDetails?: object` (carrier, station, departure time)
- `nextLegTransport?: string`
- `nextLegCity?: string`
- `lockedActivities: LockedActivity[]` (the locked slots loaded from DB)
- `pacing?: string` (relaxed/balanced/packed)
- `isFirstTimeVisitor?: boolean`
- `interestCategories?: string[]`
- `additionalNotes?: string`
- `smartFinishMode?: boolean`

## Risk

**Low.** This is a pure extraction refactor. The compiler functions produce the same data that's currently computed inline. If any field is wrong, it surfaces immediately as a prompt difference. The stage logger makes it inspectable.

## Verification

Generate a trip before and after. Compare the `pipeline_logs` output (compiled facts + schema) against the console logs from the current inline code. The day constraints string should be identical.

## Estimated scope

- `compile-day-facts.ts`: ~300-400 lines (extracted from ~600 lines of inline code)
- `compile-day-schema.ts`: ~250-350 lines (extracted from ~800 lines of decision tree)
- `action-generate-day.ts`: net reduction of ~1,000-1,200 lines
- `pipeline/types.ts`: ~15 lines of additions to `DayFacts`

