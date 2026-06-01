# Orphaned Transit Node Detection & Repair

## Problem

A transit card titled `Travel to Tasca do Chico` (or `Walk to X`, `Taxi to X`) survives generation even though Tasca do Chico has no scheduled activity block that day. The existing `checkPhantomEventRefs` validator only scans **description body text** for ghost event refs — it never inspects **transit-node titles or `transportation.to` targets** against the day's actual scheduled venues. Result: phantom transit nodes ship into the published itinerary.

## Fix

Add a new structural validator + repair handler that runs after the full day is compiled, matches each transit card's destination against the set of scheduled venue identities on that day, and removes (or flags for removal) any orphan.

### 1. New failure code

`supabase/functions/generate-itinerary/pipeline/types.ts` — add to `FAILURE_CODES`:

```
ORPHANED_TRANSIT_NODE: 'ORPHANED_TRANSIT_NODE',
```

### 2. New validator: `checkOrphanedTransitNodes`

In `pipeline/validate-day.ts`, alongside `checkPhantomEventRefs`:

- Build a `Set<string>` of normalized scheduled venue identities for the day: lowercased + diacritics-stripped name/title/venue/location.name for every **non-transit, non-bookend** activity (use existing `isTransitActivity` to exclude).
- For each activity where `isTransitActivity(act)` is true, extract its destination target:
  - Primary: `transportation.to` (string or `{name}`)
  - Fallback: parse title via `/^\s*(?:travel|walk|walking|stroll|taxi|drive|ride|transfer|head|go)\s+(?:to|toward|over\s+to|back\s+to)\s+(.+?)\s*$/i` capture group
- Normalize the target the same way. Skip when target is empty, generic ("hotel", "airport", "the station", "lunch", "dinner", a neighborhood-only string), or when the transit is a bookend (`source` starts with `bookend-` / `late_nightlife_bookend` / hotel-return).
- If normalized target is NOT in the scheduled set AND not a fuzzy substring match against any scheduled identity (handle "Tasca do Chico" vs "Dinner at Tasca do Chico"), emit:

```ts
results.push({
  code: FAILURE_CODES.ORPHANED_TRANSIT_NODE,
  severity: 'critical',
  message: `Transit "${title}" targets "${target}" which is not scheduled on this day`,
  activityIndex: i,
  field: 'title',
  autoRepairable: true,
});
```

Wire the call inside the existing validator orchestrator (same spot `checkPhantomEventRefs` is invoked).

### 3. Repair handler in `repair-day.ts`

Add a deterministic handler keyed on `FAILURE_CODES.ORPHANED_TRANSIT_NODE` that:

- Splices out flagged orphan transit nodes (locked/user/manual/extracted/pinned exempt — re-use existing `isActivityLocked`).
- Also drops the preceding `Walk to <orphan>` connector if present (mirrors `pruneOrphanTransits` pattern already used elsewhere — import + reuse if it exists, otherwise inline the same logic).
- Stamps `repairs.push({ code: FAILURE_CODES.ORPHANED_TRANSIT_NODE, action: 'removed_orphan_transit', before: <title> })`.
- Re-runs the existing buffer/cascade pass so neighboring times collapse.

### 4. Validation-gate default

`pipeline/validation-gate.ts` — register `ORPHANED_TRANSIT_NODE` with a drop-not-blank handler so any survivor (e.g. repair-day bypassed) is force-removed at the gate before persist. Mirrors the existing logistics-sequence drop branch.

### 5. Tests

New `supabase/functions/generate-itinerary/__tests__/orphaned-transit-node.test.ts`:

- Detects `"Travel to Tasca do Chico"` when Tasca do Chico isn't scheduled.
- Does NOT flag when Tasca do Chico IS scheduled (substring + diacritics).
- Does NOT flag generic targets (`Walk to hotel`, `Transfer to airport`, `Stroll to lunch`).
- Does NOT flag bookend hotel-return / late-nightlife bookend.
- Repair handler removes the orphan + preceding `Walk to X` connector; keeps locked rows.
- Validation gate drops survivors.

### 6. Memory

New `mem/constraints/itinerary/orphaned-transit-node-detection.md` capturing: detection layer, repair layer, gate layer, sentinel `[ORPHAN_TRANSIT_REMOVED]`. Add one-liner reference under "Memories" in `mem/index.md`.

## Files

- `pipeline/types.ts` — add code
- `pipeline/validate-day.ts` — add `checkOrphanedTransitNodes` + wire call
- `pipeline/repair-day.ts` — add handler
- `pipeline/validation-gate.ts` — register drop handler
- `__tests__/orphaned-transit-node.test.ts` — new
- `mem/constraints/itinerary/orphaned-transit-node-detection.md` + `mem/index.md` — memory

## Out of scope

- Re-routing the orphan to a different scheduled venue (delete-only — safer than fabricating intent).
- Cross-day orphans (target IS scheduled but on a different day) — separate bug class; can be a follow-up if telemetry shows it.
