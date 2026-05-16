## Problem

"Required" activities (user-specified must-dos / anchors that we lock into the itinerary) consistently render with no description and no address. They're correctly placed and locked, but their detail cards are empty.

## Root cause

User anchors are converted to activities by `anchorToActivity` in `supabase/functions/_shared/user-anchors.ts`:

- `location` is set to `{ name: venueName, address: '' }` (empty address)
- `description` is never set at all
- The activity is stamped `locked: true, isLocked: true`

Every downstream enrichment pass then **skips locked rows**, so the gaps are never filled:

1. `pipeline/enrich-day.ts` (venue + address enrichment) — line 42: `activities.filter(a => !a.isLocked && !a.locked)`
2. `pipeline/validate-day.ts::shouldSkipDescriptionCheck` — line 1381: `if (act.isLocked ...) return true` — so `checkActivityDescriptions` never flags missing descriptions on anchors, and `fillMissingDescriptions` (which reuses `shouldSkipDescriptionCheck`) skips them too.

Net effect: anchor rows are immortal "blank cards" no matter how many regenerations run.

## Fix — single-purpose enrichment exemption for anchors

Introduce a narrow exemption: a row that is locked **as a user anchor** AND is missing description or address may still be enriched (description-fill + venue/address lookup), but its title, time, category, and venue identity remain locked.

### Changes

1. **`supabase/functions/_shared/user-anchors.ts` — `anchorToActivity`**
   - Initialize `description: ''` explicitly so downstream code sees the field exists and is empty (not undefined).
   - Tag the row with `needsAnchorEnrichment: true` when `venueName` is present but address is empty, OR when description is empty.

2. **`supabase/functions/generate-itinerary/pipeline/validate-day.ts::shouldSkipDescriptionCheck`**
   - Tighten the locked-skip: keep skipping `userAdded / userEdited / extracted / pinned / isManual` rows, but for `isLocked` rows, only skip when `anchorSource` is not set. Anchor-locked rows with empty descriptions are no longer ignored.

3. **`supabase/functions/_shared/description-fill.ts`**
   - Already calls `shouldSkipDescriptionCheck` — the tightening in (2) is enough to make it fill anchor descriptions. Add a one-line log when filling an anchor row (`[DESC_FILL_ANCHOR] day=N id=…`) so we can confirm in edge logs.

4. **`supabase/functions/generate-itinerary/pipeline/enrich-day.ts`**
   - Replace the blanket `!a.isLocked && !a.locked` filter with: include the row when it's locked AND `anchorSource` is set AND `(location?.address` is empty/missing OR `venue_name` is empty`)`. Pass these into the same venue-enrichment Google Places lookup that runs for unlocked rows.
   - In the merge-back step, preserve the original locked row's `title / startTime / endTime / category / isLocked / anchorSource / lockedSource`, but copy enriched `location` (address, lat/lng), `venue_name` (only if originally empty), and any returned phone / website / map link.

5. **`supabase/functions/_shared/persist-itinerary.ts` (final safety net)**
   - In the per-day dining-description-backfill path that already runs at every write boundary, allow anchor rows through (same `anchorSource`-aware predicate). This guarantees legacy already-persisted anchor rows get backfilled the next time the trip is saved (e.g., the existing `[DINING_DESC_PERSIST_NET]` sweep — extend its predicate, no new pass).

### Out of scope

- No change to cost handling — anchors stay $0 unless the user enters a price.
- No change to scheduling / time / locking semantics. Locked is still locked for everything except address + description backfill.
- No prompt changes — fix is deterministic post-generation enrichment, not LLM coaxing.

### Verification

- Pick a trip with a known anchor (`metadata.userAnchors`), regenerate one day, and confirm in edge logs: `[DESC_FILL_ANCHOR]` fires and `enrich-day` reports an enriched anchor row count.
- Reload the trip in preview and confirm the previously empty "required" card now shows an address line + 1–2 sentence description.
- For an already-persisted legacy trip, trigger any save (e.g., toggle a small edit) and confirm the persist-time backfill populated the empty anchor.

### Sentinels to add

- `[ENRICH_ANCHOR] day=N enriched=K` in `enrich-day.ts`
- `[DESC_FILL_ANCHOR] day=N filled=K` in `description-fill.ts`

### Memory follow-up (after build)

Add a new memory entry under `mem://constraints/itinerary/anchor-enrichment-allowed` documenting that locked anchor rows are the **only** locked class still eligible for address + description enrichment, and listing the four touched files so future "why isn't enrichment skipping locked rows?" audits land on the exemption immediately.
