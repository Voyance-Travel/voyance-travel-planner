# Scenario Coverage: Anchor-Merge + Golden-Fixture Tests

We have 376 unit tests proving each rule works in isolation. This plan adds **scenario tests** that prove the rules **compose correctly** — the gap that lets a "luxury Tokyo trip with peanut allergy + locked sushi reservation" silently break.

Two test layers, both pure (no AI calls, no DB, no network):

---

## Layer 1: Anchor-Merge Test Suite

**Target:** `action-save-itinerary.ts` — the "anchors-win final pass" (lines 320-391). The single most critical untested module: it's the last gate before persistence and enforces the **Universal Locking Protocol**.

**Refactor first (small, safe):** Extract the anchor-restore loop into a pure helper exported from the same file:

```ts
export function applyAnchorsWin(
  itineraryDays: any[],
  userAnchors: Array<Record<string, any>>
): { days: any[]; restored: number; reaffirmed: number };
```

The handler keeps calling it; tests call it directly. No DB, no Supabase client.

**New file:** `supabase/functions/generate-itinerary/action-save-itinerary.test.ts`

**Test cases (8):**
1. **No anchors** → days returned unchanged, restored=0
2. **Anchor present + matching activity exists** → existing activity gets `locked=true`, title/time restored if drifted
3. **Anchor present + activity dropped by AI cleanup** → re-injected with correct day, title, time, `lockedSource`
4. **Anchor with `dayNumber` out of range** → silently skipped, no crash
5. **Fingerprint match (lockedSource + title)** → reaffirms lock without duplicating
6. **Fuzzy title match (anchor "Sukiyabashi Jiro" matches activity "Dinner at Sukiyabashi Jiro")** → reaffirms, doesn't duplicate
7. **Multiple anchors across multiple days** → each restored on correct day, activities re-sorted by `startTime` after restoration
8. **Drifted title + drifted time** → both restored to anchor values, lock reaffirmed

---

## Layer 2: Golden-Fixture Scenario Tests

**Target:** Compose the validation + repair stack against realistic full-day inputs to prove rules don't conflict when stacked.

**Approach:** Build 5 hand-crafted day fixtures (each ~10-15 activities, realistic) representing the most common production shapes. Run `validateDay()` from `pipeline/validate-day.ts` against each fixture and assert specific outcomes per Core memory rules.

**New directory:** `supabase/functions/generate-itinerary/__fixtures__/`
- `tokyo-luxury-locked.ts`     — luxury, peanut allergy, 2 locked dinners, full day
- `paris-budget-vegetarian.ts` — budget tier, vegetarian, dense schedule
- `rome-arrival-day.ts`        — flight arrival 14:00, hotel check-in, first-night dinner only
- `lisbon-departure-day.ts`    — flight 19:00 dep → 180m buffer, no late activities
- `barcelona-multicity.ts`     — middle leg, hotel-change day, train transit

**New file:** `supabase/functions/generate-itinerary/scenario.test.ts`

Each fixture exports a typed `ScenarioFixture { input: ValidateDayInput; expectations: { ... } }` so the test runner can iterate uniformly.

**Test cases (5 scenarios × 5-7 assertions = ~30 tests):**

For every fixture, assert against the **Core memory rules**:
- **Meal Rules:** exactly one dinner ≥ 18:00, 3 meals on full days, no chain restaurants
- **Universal Locking:** every `isLocked=true` activity in input survives validation with no `MUTATION_OF_LOCKED` failure code
- **Density Protocol:** no dead gaps > 90m flagged on full days; min 3 paid + 2 free
- **Logistics Protocol:** no activities scheduled within 180m flight / 120m train departure buffer
- **Dietary Enforcement:** no `avoidIngredients`/`avoidCuisines` from active dietary rules appear in titles/venues
- **Cost Integrity:** no activity has AI-estimated price (all have either `cost.amount` from `cost_reference` or `cost.amount=0`)
- **Believable Human Day:** mandatory midday hotel touch-back, explicit "Return to Hotel" after last non-stay activity (where applicable)

Specific per-scenario asserts:
- **Tokyo luxury:** locked sushi dinner survives + no peanut/satay/thai cuisine in any activity + at least 1 Michelin-tier dinner present
- **Paris budget vegetarian:** zero `avoidCuisines` (steakhouse/bbq) + zero `avoidIngredients` (meat/fish) + dense 5+ activity day passes
- **Rome arrival:** no activities before 15:30 (90m post-arrival buffer), exactly 1 dinner, no breakfast required
- **Lisbon departure:** no activity starts after 16:00 (19:00 - 180m), no dinner required, "Return to Hotel" before transfer
- **Barcelona multi-city:** hotel-change handled (old hotel checkout < new hotel check-in), train buffer respected

---

## Technical Details

**Stack:**
- Deno test runner (same as existing edge-function suite)
- Pure imports, no Supabase client, no fetch, no env vars
- Fixtures are TypeScript files (not JSON) so we get type-checking against `ValidateDayInput` and `Activity`
- Helper `assertions.ts` co-located with fixtures for shared predicates: `expectExactlyOneDinner`, `expectNoChainRestaurants`, `expectLockedSurvived`, etc.

**File layout:**
```text
supabase/functions/generate-itinerary/
├── action-save-itinerary.ts         (extract applyAnchorsWin)
├── action-save-itinerary.test.ts    (NEW — 8 tests)
├── scenario.test.ts                  (NEW — ~30 tests)
└── __fixtures__/
    ├── assertions.ts                 (shared assertion helpers)
    ├── tokyo-luxury-locked.ts
    ├── paris-budget-vegetarian.ts
    ├── rome-arrival-day.ts
    ├── lisbon-departure-day.ts
    └── barcelona-multicity.ts
```

**Verification:**
1. `deno test --allow-env --allow-net --allow-read supabase/functions/generate-itinerary/`
2. `bunx vitest run`
3. Target: ~414 total tests passing (376 + 8 anchor + 30 scenario)

## Out of Scope

- Live HTTP smoke tests (would need credits + .env, low ROI vs. fixtures)
- AI prompt-output tests (non-deterministic, separate concern)
- Frontend rendering of itinerary days (covered by component tests in a separate effort)
- Mocking the Supabase client end-to-end through `handleSaveItinerary` (the refactor lets us skip this — we test the pure helper)

## Risks

- **Refactor risk:** Extracting `applyAnchorsWin` from `handleSaveItinerary` must preserve identical behavior. Mitigation: the function is already self-contained inside a try/catch block — extraction is a copy-paste with explicit param threading.
- **Fixture drift:** As rules evolve, fixtures will need updates. Mitigation: each assertion references the exact Core memory rule it enforces, making intentional changes traceable.
