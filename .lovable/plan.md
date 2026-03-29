

# Phase 5: Bug Fixes + Final Extraction

## Part A: Fix 3 Broken Variables (critical, do first)

### 1. `itineraryDayId` (lines 1258, 1263, 1270, 1277)
Used in DB persistence to clean up orphan activities. Never assigned after Phase 4 cleanup. The `dayRow.id` from the upsert at line 1151 is the value — assign `const itineraryDayId = dayRow.id;` inside the `else if (dayRow)` block at line 1156.

### 2. `paramHotelName` (line 1083)
Used as fallback in validation input. Lost from destructuring at line 90. Add it back to the destructure: extract from `params` alongside existing fields. It was likely `hotelName` in the original params — check `compile-prompt.ts` or the caller for the param name.

### 3. `action` (line 1358)
Used to set `created_by_action` in version save. The action string (`'generate-day'` or `'regenerate-day'`) comes from the caller (`index.ts` dispatches both to `handleGenerateDay`). It's not in `params` — it's the top-level `action` field stripped before dispatch. Fix: add `action` to the params destructure at line 90 (it's passed through in `body`), or have the caller pass it explicitly.

## Part B: Deduplicate Post-Generation Guarantees (~280 lines)

Lines 1399–1651 run hotel check-in injection, checkout injection, departure sequence fix, and non-flight airport stripping **after** the pipeline repair already handles `MISSING_SLOT` and `LOGISTICS_SEQUENCE`. This is redundant and risks undoing repairs.

**Approach**: Fold these 4 blocks into `repair-day.ts` as new repair functions, keyed to existing failure codes. Remove the inline blocks from `action-generate-day.ts`.

- **Check-in guarantee** (lines 1399–1486) → `repairMissingCheckIn()` in `repair-day.ts`, needs hotel resolution context passed in `RepairDayInput`
- **Checkout guarantee** (lines 1488–1591) → `repairMissingCheckout()` in `repair-day.ts`
- **Departure sequence fix** (lines 1593–1629) → already partially in `repair-day.ts` as `LOGISTICS_SEQUENCE` repair — extend it
- **Non-flight airport strip** (lines 1631–1651) → new check in `validate-day.ts` + repair in `repair-day.ts`

**Complication**: The check-in/checkout blocks do async DB queries (multi-city hotel lookup). `repair-day.ts` is currently sync. Two options:
1. Make `repairDay()` async and pass `supabase` — cleanest but changes the interface
2. Pre-resolve hotel info in the orchestrator and pass it into `RepairDayInput` — keeps repair pure

Option 2 is safer. Add `multiCityHotelName/Address` fields to `RepairDayInput`, resolve them before calling repair.

**Net removal**: ~250 lines from the monolith.

## Part C: Extract DB Persistence (~190 lines)

Lines 1136–1325 (day upsert, activity insert, UUID mapping) → `pipeline/persist-day.ts`.

```typescript
export async function persistDay(supabase, tripId, dayNumber, generatedDay, date): Promise<PersistResult>
```

Returns the updated activities with DB UUIDs mapped back. Version save (lines 1327–1370) goes in too.

**Net removal**: ~230 lines.

## Part D: Extract Meal Final Guard call site

The meal guard (lines 1675–1749) stays as `enforceRequiredMealsFinalGuard` from `day-validation.ts` but its venue pre-fetch logic (restaurant pool + verified_venues query) can move into a helper. This is lower priority — mark as optional.

## Execution Order

1. Fix the 3 broken variables (Part A) — immediate bug fix
2. Pre-resolve hotel info and fold post-gen guarantees into `repair-day.ts` (Part B)
3. Extract `persist-day.ts` (Part C)
4. Update `plan.md`

## Expected Outcome

Monolith drops from 1,778 → ~1,100 lines. All known bugs fixed. The file becomes a clean orchestrator: facts → prompt → AI call → parse → enrich → validate/repair → persist → respond.

