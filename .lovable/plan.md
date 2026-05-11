## Root cause (verified on a real trip)

I pulled the most-recent Bruges trip (`ad906ec5-…`) from the database and compared its `metadata.pipeline_logs.day_2.rawAIResponse` against the persisted `itinerary_days.activities`.

**What the AI / meal-guard produced for Day 2 (raw):**
- 08:30 Breakfast: **That's Toast** (`cost.source: meal_guard_fallback`)
- 09:40 Madonna / Church of Our Lady (cultural)
- 11:00 Walk to brewery (transport)
- 12:30 Lunch: **Pomme de Pain** (`cost.source: meal_guard_fallback`)
- 13:05 Brewery (activity)
- 16:35 Taxi to The Notary (transport)
- 17:05 Freshen Up (accommodation)
- … plus a Zet'joe by Hertog Jan dinner (truncated in the log)

**What actually got persisted (both `itinerary_days.activities` and `trips.itinerary_data.days`):**
- 09:40 Madonna (cultural)
- 13:45 Brewery (activity)
- 17:45 Freshen Up (accommodation)

Three activities. **Zero meals.** Day 3 is similarly stripped down to two non-meal cards. Day 1 has only a "Nightcap at L'Estaminet" — no real dinner.

**Why meals are visible right after generation:** the per-day generator returns the post-meal-guard array to the client, which renders it. The destructive scrubs that delete the meals only run inside `save-itinerary` *after* that response has already been streamed to the UI. Hence: visible until refresh, gone after.

### The exact leak path inside `save-itinerary`

1. **Bad meal-guard pool.** "That's Toast" (Singapore/Korea chain) and "Pomme de Pain" (French chain) are not in Bruges. The meal-guard's destination-aware fallback path leaked foreign-city venues — exactly the kind of regression the [Cross-City Fallback Integrity](mem://constraints/itinerary/cross-city-fallback-integrity) memory was created to prevent. The Bruges row (and many small-city rows) in `verified_venues` is sparse, so the guard fell through to whatever pool still had entries.
2. **`normalizeDays` runs `scrubActivity`** → `downgradeCrossCityActivity` detects the foreign address, calls `applyFallbackToActivity` with a `needsVenuePick` sentinel — title becomes "Lunch — find a local option in Bruges", venue/address blanked, `metadata.needsVenuePick = true`.
3. **Save-time meal-guard re-check (`enforceRequiredMealsFinalGuard`)** runs next, but `detectMealSlots` matches the word "Lunch" in the sentinel title and considers lunch *present* → guard does not re-inject.
4. **`terminalCleanup` then runs `nuclearDiningStrip`** which `splice`s every `needsVenuePick` dining sentinel out of the array (plus their preceding transit). Net effect: meals removed, no replacement, day persisted with cultural/activity/accommodation only.

So the bug is the combination: the cross-city downgrade leaves a placeholder that *looks* like a meal to the guard, then the nuclear strip removes the placeholder, and nothing fills the gap. There is no closing "did we end up with the required meals?" assertion before persistence.

## Fix (server-only — no UI work)

All edits in `supabase/functions/`. No frontend changes.

### 1. Make `detectMealSlots` ignore sentinels
File: `supabase/functions/generate-itinerary/day-validation.ts` (or wherever `detectMealSlots` lives — locate by grep).
A sentinel does not satisfy a meal requirement.
```ts
// inside detectMealSlots, before the title/category match:
if (act?.metadata?.needsVenuePick === true) continue;
if (/—\s*find a (local option|restaurant|café|cafe|place)\b/i.test(act.title || '')) continue;
```
This alone restores the meal-guard's authority: after scrub, missing meals will be re-detected and re-injected.

### 2. Re-order `terminalCleanup` vs the meal guard
File: `supabase/functions/generate-itinerary/action-save-itinerary.ts`, the per-day loop around lines 340–489.
Today the order is: `normalizeDays` (scrub) → meal guard → `terminalCleanup` (nuclear strip).
Change to: `normalizeDays` (scrub) → **`terminalCleanup` first** → meal guard → optional second `terminalCleanup` for *non-dining* sweeps only.
Splitting `terminalCleanup` into a "nuke wrong-city / wellness placeholders" pass and a "bookend / hotel-return" pass lets the guard fill the holes the nuclear pass just opened.

### 3. Closing invariant assertion before persist
File: `action-save-itinerary.ts`, after the per-day loop, before the DB write (around line 491).
Walk every day, recompute `policy.requiredMeals` vs `detectMealSlots(activities)` (with the new sentinel filter from step 1), and if any day is still non-compliant **after** all repair attempts, log a single sentinel `[MEAL_PERSIST_FAIL] day=N missing=[…] dest=…` and inject a *visible* "Lunch — pick a restaurant in Bruges" sentinel that is **immune to `nuclearDiningStrip`** (mark it with `metadata.preserveAsManualPick = true`; teach `nuclearDiningStrip` to skip those). A blank slot the user can act on is strictly better than silent deletion.

### 4. Harden the meal-guard fallback pool against city leaks
Files: `supabase/functions/_shared/post-meal-guard-fill.ts`, plus the `INLINE_FALLBACK_*` and `REGIONAL_EMERGENCY_FALLBACK` maps in `fix-placeholders.ts`.
Add a final filter inside `enforceRequiredMealsFinalGuard` (or its fallback resolver): every candidate venue's `address` / `country` is run through `activityCountryMismatch` *before* it is injected. Reject Toast / Pomme-style leaks at the source so step 1–3 don't have to clean them up. This is the "4-layer guard" pattern from the existing [Cross-City Fallback Integrity](mem://constraints/itinerary/cross-city-fallback-integrity) memory — extend it to cover the meal-guard's own injection path.

### 5. Promote `verified_venues` Bruges coverage at runtime (data, not code)
The Bruges, Naples, and similar small-city rows of `verified_venues` are thin. The save-time prefetch (`saveFallbackVenues`, line 362) already pulls from `verified_venues` first; if that returns < 3 dining venues, log `[VENUE_POOL_THIN] dest=Bruges count=2` so we have telemetry and can backfill. No code change beyond the warn.

### 6. Tests
- `supabase/functions/_shared/__tests__/meal-persist-invariant.test.ts` — Bruges Day 2 fixture with foreign-chain meals; assert post-save state has 3 meals (real or `preserveAsManualPick` sentinels), never zero.
- `detect-meal-slots.test.ts` — assert `needsVenuePick` and "find a local option" sentinels return false.
- `nuclear-dining-strip.test.ts` — assert `preserveAsManualPick` sentinels survive the strip.

### 7. One-shot backfill on next save
The persist invariant (step 3) self-heals legacy trips on next save without a migration. No SQL needed.

### 8. Memory
Add `mem://constraints/itinerary/meal-persist-invariant` with the leak path + four-step fix, and add a Core line:
> **Meal Persist Invariant:** `save-itinerary` MUST end with required meals satisfied; cross-city scrub + `nuclearDiningStrip` may not silently delete meals. Sentinels marked `preserveAsManualPick` are skipped by the strip.

## Out of scope
- Day-truth ledger / generation-time prompt changes (already covered by separate constraints)
- UI changes (this fix is end-to-end inside the save pipeline)
- Repair-day §10b changes (single-pass scrub there is fine — the persist-time invariant is the safety net)

## Sentinels for verification after deploy
- `[MEAL_AUDIT]` per-day post-guard log already exists.
- New: `[MEAL_PERSIST_FAIL]`, `[VENUE_POOL_THIN]`, `[NUCLEAR_DINING_STRIP] skipped=K preserveAsManualPick`.
- Re-query the same Bruges trip ID after the next save and confirm Day 2/3 have ≥ 3 meal cards.
