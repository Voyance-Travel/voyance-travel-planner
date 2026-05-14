## Goal

Once an itinerary reaches `ready`/`generated` and stamps `metadata.itinerary_frozen_at`, the persisted bytes must not change again unless the user explicitly edits, regenerates, or unlocks. Today the frontend `safeUpdateItineraryData` enforces this, but several backend paths still write through and silently re-shape the trip on refresh:

- `action-repair-costs` writes JSONB via `persistTripItinerary` with `skipContract:true` — no FROZEN check.
- `action-save-itinerary`'s FROZEN gate only blocks `saveReason` starting with `self-heal-`. Anything else (chat retries, optimistic, undo, executor save without that prefix) passes.
- `sync-trip-cost-table` and the snapshot's auto-backfill rewrite `activity_costs` rows on every load → totals shift even when JSON is untouched.
- `TripDetail.tsx` page-load `repairTripCosts` invoke fires for any legacy trip without an `activity_costs` row, and never checks `itinerary_frozen_at`.
- No durable snapshot exists, so we can't recover the exact "shown" version if anything still leaks through.

This plan adds a single backend chokepoint, snapshots the presented version, and converts every refresh-time mutator into a strict no-op on frozen trips.

## Plan

### 1. Single backend FROZEN chokepoint

Create `supabase/functions/_shared/frozen-guard.ts`:
- `isTripFrozen(supabase, tripId)` → `{ frozen, frozenAt, status }`
- `assertWriteAllowed({ frozen, allowFrozenWrite, saveReason, label })` returns a structured `{ ok: false, blocked: true, reason }` for blocked writes.

Wire it inside `persistTripItinerary` (`supabase/functions/_shared/persist-itinerary.ts`):
- New option `allowFrozenWrite?: boolean` (default `false`).
- If trip is frozen and `allowFrozenWrite !== true`: skip the `itinerary_data` mutation, still apply non-itinerary `extraUpdate` keys (status flags, metadata stamps) so callers like cost-repair can record `last_cost_repair_at` without touching JSONB.
- Log `[FROZEN_BLOCKED] label=<x> tripId=<y>` and return `{ frozenBlocked: true, error: null }`.

### 2. Whitelist legitimate user writes in `action-save-itinerary`

Replace the current `saveReason.startsWith('self-heal-')` gate with a whitelist:

- Permit only when one of:
  - `params.allowFrozenWrite === true`
  - `saveReason` matches `/^(user-|chat-|lock-|unlock-|regenerate-|undo-|redo-|smart-finish-|fill-gap-|swap-|optimistic-|edit-|delete-|add-|drag-|reorder-)/`
- All other reasons (including default/undefined) silently no-op with `{ skipped: true, reason: 'frozen' }` once frozen.
- Update internal callers to set the right `saveReason` (chat executor, optimistic update, EditorialItinerary save handlers).

### 3. `action-repair-costs` honors frozen

Inside `action-repair-costs.ts`:
- Compute `isFrozen` once at entry.
- Always allowed: insert missing `activity_costs` rows (snapshot table only) — read-only of `itinerary_data`.
- If frozen, skip the JSONB writeback block (lines 683–725) entirely; log `[FROZEN_BLOCKED] label=repair-costs-jsonb`.
- Still stamp `last_cost_repair_at` so we don't re-enter the auto-repair loop.

### 4. Skip TripDetail page-load auto-repair on frozen trips

`src/pages/TripDetail.tsx` (lines ~1997–2022): before invoking `repairTripCosts`, read `trip.metadata?.itinerary_frozen_at` (already in memory via the loaded `trip`). If frozen and `activity_costs` rows already exist for ≥80% of priced JSON activities, skip the invoke entirely. If frozen but rows are missing, call only an INSERT-only path (see step 5) — never the price-mutating repair.

### 5. `sync-trip-cost-table` becomes append-only when frozen

In `supabase/functions/sync-trip-cost-table/index.ts`:
- Use `isTripFrozen`; if frozen, switch to INSERT-only mode for missing `activity_id`s — no `UPDATE`/`UPSERT` of existing rows, no price recomputation for already-present rows.
- Telemetry: `[SYNC_FROZEN_INSERT_ONLY] inserted=N skipped_existing=M`.

### 6. Snapshot the presented itinerary

When the freeze stamp first fires (Stage 6 in `generation-core.ts` and the chain finalization in `action-generate-trip-day.ts`), additionally persist `metadata.frozen_snapshot = { savedAt, days: deepCopy(itinerary_data.days), version: 1 }`.

On read in `TripDetail.tsx`:
- If `metadata.frozen_snapshot.days` exists and `metadata.itinerary_frozen_at` is set, and the live `itinerary_data.days` materially diverges (>20% activity ID change OR >15% trip-total cost change), restore the snapshot in-memory for display AND fire a single canonical write back through `safeUpdateItineraryData(..., { allowFrozenWrite: true, reason: 'restore-frozen-snapshot' })` — telemetry `[FROZEN_SNAPSHOT_RESTORED]`.
- This is the "destroy the other one behind the scenes" guarantee the user asked for: any rogue mutation that slipped past gates 1–5 is overwritten back to the version the user first saw.

### 7. Telemetry & verification

- New sentinels: `[FROZEN_BLOCKED]`, `[FROZEN_SNAPSHOT_WRITTEN]`, `[FROZEN_SNAPSHOT_RESTORED]`, `[SYNC_FROZEN_INSERT_ONLY]`.
- Backfill one-shot migration: for any existing trip with `itinerary_frozen_at` but no `metadata.frozen_snapshot`, copy current `itinerary_data` into the snapshot slot.

### 8. Tests

- `supabase/functions/_shared/__tests__/frozen-guard.test.ts` — gate matrix (frozen × allowFrozenWrite × saveReason).
- `__tests__/persist-itinerary.frozen.test.ts` — verify `persistTripItinerary` no-ops JSONB, still applies `extraUpdate.last_cost_repair_at`.
- `__tests__/action-save-itinerary.frozen-whitelist.test.ts` — whitelisted vs unwhitelisted saveReasons.
- `src/pages/__tests__/TripDetail.frozen-snapshot.test.tsx` — snapshot restore on divergence, no infinite loop.

### 9. Memory

Update `mem://constraints/itinerary/frozen-after-ready` to document the chokepoint, the whitelist, the snapshot, and the append-only sync rule. Update `mem://index.md` Core entry "Frozen After Ready" with the new guarantees.

## Out of scope

- Read-time cosmetic mutators (`itineraryParser` dedupe, `ensureHotelReturnBookend`, `normalizePredawnCascade`) — they don't write to DB; they only normalize display and many tests depend on them.
- New regeneration UX (the "Regenerate" button still uses `allowFrozenWrite:true` and is unchanged).
- `useTripFinancialSnapshot` reader logic — once writes are locked, totals stop drifting; no FE math changes needed.

## Files (technical)

- New: `supabase/functions/_shared/frozen-guard.ts`, `supabase/functions/_shared/__tests__/frozen-guard.test.ts`, `supabase/functions/_shared/__tests__/persist-itinerary.frozen.test.ts`, `supabase/functions/generate-itinerary/__tests__/action-save-itinerary.frozen-whitelist.test.ts`, `src/pages/__tests__/TripDetail.frozen-snapshot.test.tsx`, `mem://constraints/itinerary/frozen-after-ready` (update).
- Edit: `supabase/functions/_shared/persist-itinerary.ts`, `supabase/functions/generate-itinerary/action-save-itinerary.ts`, `supabase/functions/generate-itinerary/action-repair-costs.ts`, `supabase/functions/generate-itinerary/generation-core.ts`, `supabase/functions/generate-itinerary/action-generate-trip-day.ts`, `supabase/functions/sync-trip-cost-table/index.ts`, `src/pages/TripDetail.tsx`, `src/services/itineraryActionExecutor.ts` (saveReason whitelist tags), `src/services/itineraryOptimisticUpdate.ts` (saveReason tag), `src/components/itinerary/EditorialItinerary.tsx` (saveReason tags on chat/edit invokes), `mem://index.md`.
- Migration: one-shot backfill of `metadata.frozen_snapshot` for already-frozen trips.
