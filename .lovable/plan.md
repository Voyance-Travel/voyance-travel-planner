# Stop AI from overwriting user intent — backend lockdown

## Problem (verified by reading the code, not speculation)

You're right: tests pass, behavior fails. The 406 tests cover `applyAnchorsWin` in isolation but the **full-trip generation chain doesn't call it**. Four concrete leak points found:

1. **`action-generate-trip.ts:181-201`** — On every fresh generation, the chain executes:
   ```
   updatePayload.itinerary_data = { ...existingItData, days: [], status: 'generating' }
   ...
   delete itinerary_activities
   delete itinerary_days
   ```
   Manual-paste items, chat-extracted anchors, and pinned cards in `itinerary_data.days` are wiped before generation runs. They survive only if (a) the user already locked them via `toggle-activity-lock` *and* (b) `metadata.userAnchors` exists.

2. **`action-generate-trip-day.ts:2350` and `:2494`** — Both writes (`itinerary_data: partialItinerary`) bypass `applyAnchorsWin`. Smart Finish, multi-city legs, and resume flows all go through here. The anchor guard runs only in `handleSaveItinerary` (the manual save path).

3. **`enrich-manual-trip/index.ts:526-558`** — Smart Finish writes `mustDoActivities` (a research string) to metadata but **does not write `userAnchors`**. The day generator only treats `metadata.userAnchors` as hard-locked. Without it, manual-paste items become soft prompt context the AI can rename, retime, or drop.

4. **Flag inconsistency** — `compile-day-facts.ts:389` filters JSON locks by `a.isLocked` only; `action-save-itinerary.ts:165` checks `a.locked || a.isLocked`; `sync-tables.ts:137` writes `is_locked: !!(a.isLocked || a.locked)`. Manual-paste items set both, but anchors restored by `applyAnchorsWin` set both — fine. The leak is items that originate with only `locked: true` (some pipeline injections) failing the JSON-fallback locked filter.

## Fix (4 changes, no new tests asked of you)

### 1. Extract `applyAnchorsWin` to a shared module
Move from `action-save-itinerary.ts` into `supabase/functions/generate-itinerary/anchor-guard.ts`. Re-export from save for backwards compat. Single source of truth.

### 2. `action-generate-trip.ts` — preserve anchors before clearing
Before `updatePayload.itinerary_data = { ...existingItData, days: [], status: 'generating' }`:
- Read existing `metadata.userAnchors` (if any).
- Scan `existingItData.days` for any activity with `locked || isLocked || lockedSource` and merge them into `metadata.userAnchors` (deduped by `dayNumber + lockedSource + title`).
- Write the merged anchor list back to metadata in the same update.
This makes the wipe non-destructive — the locked items become invariants for the chain.

### 3. `action-generate-trip-day.ts` — run `applyAnchorsWin` before every write
At both persistence points (line ~2350 final write, line ~2494 progress write), after `partialItinerary` is built:
```
const anchors = (meta.userAnchors as any[]) || [];
const guarded = applyAnchorsWin(partialItinerary.days, anchors);
partialItinerary.days = guarded.days;
```
Logs `restored`/`reaffirmed` counts. This is the canonical guardrail at the boundary where the AI's output meets the database.

### 4. `enrich-manual-trip/index.ts` — emit structured anchors, not just research text
After `buildResearchContext()` (line ~527), also call `buildUserAnchors({ source: 'manual_paste', perDayActivities: derivedFromDays })` using the existing parsed `itinerary.days`, and write the result into `updatedMetadata.userAnchors`. This mirrors what `createTripFromParsed.ts` already does at trip creation, but covers the case where Smart Finish is purchased on a trip whose anchors were never persisted (older trips, edited trips).

## Files touched

- **NEW:** `supabase/functions/generate-itinerary/anchor-guard.ts` (~80 lines, extracted)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — import from new module
- `supabase/functions/generate-itinerary/action-generate-trip.ts` — anchor harvesting before wipe (~30 lines)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — two `applyAnchorsWin` calls (~10 lines each)
- `supabase/functions/enrich-manual-trip/index.ts` — emit `userAnchors` (~20 lines)

## What this does NOT do (intentionally)

- No new tests. You said retesting costs money. The existing `applyAnchorsWin` tests already prove the helper is correct; we just call it at the missing boundaries.
- No flag normalization (`locked` vs `isLocked`). The `applyAnchorsWin` fingerprint matcher already accepts either, so it's a non-issue once the guard runs at every boundary.
- No prompt changes. The AI can keep doing whatever it wants — the post-generation anchor pass is what enforces user intent, and it's deterministic.

## Verification path (no AI calls, no credits)

After implementing, two existing call sites cover the scenarios:
- Manual paste → Smart Finish: enrich-manual-trip writes anchors → generate-trip wipe preserves them via metadata → each day write re-applies them.
- Locked activity → regenerate day: lock survives in normalized table → compile-day-facts loads it → repair pipeline merges it → final write reaffirms it.

Both paths now have the guard applied. Approve and I'll implement.