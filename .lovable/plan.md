
## Problem

5 of 8 recent trips (HCMC, Amsterdam, Vienna, Jeju, Shanghai) ship with user must-do chips ("Notre-Dame Basilica", "Van Gogh Museum", "Hofburg Palace", etc.) appearing as:

- **Untimed** — no `startTime`, no `endTime` → renders as a floating bare card, exempt from the cascade so it can never auto-fix.
- **Duplicated across days** — same anchor card shows on Day 1 AND Day 2 (sometimes Day 2 has the same item twice).
- **Description-less** — `needsAnchorEnrichment` is not stamped, so the description/address backfill skips them.

Root cause is in `supabase/functions/generate-itinerary/anchor-guard.ts::applyAnchorsWin`. All 5 cases show ids like `anchor-restore-d{N}-{idx}` — the restore path. Two leaks:

1. **Floating anchors are distributed per-day each chain leg.** The chain calls `applyAnchorsWin` after every day generates. With `userAnchors=[Notre-Dame, Bui Vien]` (floating, `dayNumber=0`), Day 1 distribution paints both onto Day 1; Day 2 chain leg re-runs distribution against the trip-wide `userAnchors` blob and paints them onto Day 2 too — there is no cross-day fingerprint check after distribution.
2. **Soft-wish guard (L164) is bypassed by `venue_name` heuristic.** It allows the card through whenever `anchor.venueName || anchor.location?.name` is truthy — but chip parsing copies the title into `venueName`. So "Notre-Dame Basilica" satisfies the guard even when `startTime` is empty.

## Fix

Single boundary change in `anchor-guard.ts` + a one-shot backfill. Pure data-layer; no UI.

### 1. Tighten the restore predicate (`anchor-guard.ts`)
Stop emitting untimed locked cards entirely. New rule for both floating distribution and pinned restoration:

- If `startTime` is missing → never push a card. Either skip (chip handling) or route to `trip_day_intents` as a USER WISH so the generator picks the slot.
- Same rule applies whether the anchor is pinned or floating.
- Stamp `needsAnchorEnrichment: true` (already done) AND make sure description-fill / enrich-day actually see the row.

### 2. Cross-day fingerprint dedupe (`anchor-guard.ts`)
After `applyAnchorsWin` runs, sweep all days once: for each `lockedSource|titleLower` fingerprint, keep first occurrence (lowest day, earliest startTime), drop the rest. Sentinel `[ANCHOR_GUARD] cross_day_dedupe dropped=N`.

### 3. Persist-boundary safety net (`_shared/persist-itinerary.ts`)
Final sweep before write: drop any `isLocked=true` activity that has no `startTime` AND no `time`. Stamp `[ANCHOR_GUARD] persist_drop_untimed=N`. Closes the leak if any other path (chat executor, manual edit) ever introduces an untimed locked row.

### 4. Mark fulfilled when AI generates the venue itself
When `reconcileFulfillment` runs (already wired post-save), broaden match to also fulfill trip-wide intents (`day_number IS NULL`) on first match — currently `if (intent.day_number == null) continue` blocks them, so they re-inject on every day forever via `compile-prompt`. Add a `firstMatchWinsForTripWide` branch.

### 5. One-shot backfill (5 affected trips)
For the 5 trips identified (HCMC, Amsterdam, Vienna, Jeju, Shanghai + any other where `isLocked=true AND startTime IS NULL`):
- Strip the offending untimed locked rows from `trips.itinerary_data.days[*].activities`.
- Use `safeUpdateItineraryData` with reason `self-heal-anchor-cleanup` (add to allowlist in `frozen-guard.ts`).

Run via SQL `UPDATE` since these rows have no time/cost so removal is safe and budget-neutral.

## Files

- `supabase/functions/generate-itinerary/anchor-guard.ts` — tighten predicate + cross-day dedupe sweep
- `supabase/functions/_shared/persist-itinerary.ts` — untimed-locked drop
- `supabase/functions/_shared/day-intents-store.ts::reconcileFulfillment` — trip-wide fulfillment
- `supabase/functions/_shared/frozen-guard.ts` — add `self-heal-anchor-cleanup` to allowlist
- One-shot SQL migration (legacy backfill of 5 trips, idempotent)
- New memory: `mem://constraints/itinerary/anchor-cards-must-have-time`

## Acceptance

- Re-run the sweep query: `SELECT … FROM jsonb_array_elements(activities) WHERE isLocked AND startTime IS NULL` returns 0 rows across all `ready` trips.
- New trip generation: floating must-do chips no longer materialize as untimed cards — they appear as soft wishes that the AI places in a real slot, OR they don't appear at all (chip didn't survive intent injection).
- No regression in pinned anchors that carry a real `startTime` (e.g. user-pinned 14:00 Eiffel Tower visit) — those still restore as locked cards.

## Out of scope

- The deeper chip-intent UX (why we accept naked chip must-dos at all). Documented as follow-up.
- Surfacing fulfilled intents in the UI.
- Cost / budget / chronology — none of those are affected by this class.
