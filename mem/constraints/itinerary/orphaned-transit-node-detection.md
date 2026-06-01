---
name: Orphaned Transit Node Detection
description: Structural transit ghost ("Travel to X" where X isn't scheduled that day) detected by validator + removed by repair-day + dropped by validation-gate
type: constraint
---

Distinct from `DESCRIPTION_GHOST_REFERENCE` (body-text only). Catches transit cards whose own title/`transportation.to` targets a venue absent from the day's scheduled activity blocks.

**3 layers**:
1. `checkOrphanedTransitNodes` in `pipeline/validate-day.ts` — builds normalized scheduled-venue set (non-transit activities only, diacritic-stripped), iterates transit cards, extracts target via `transportation.to` or title regex (`travel|walk|stroll|taxi|drive|ride|transfer|head|go + to|toward|back to`), emits `FAILURE_CODES.ORPHANED_TRANSIT_NODE` (critical, autoRepairable) when target doesn't substring-match any scheduled identity. Exempts generic targets (hotel/airport/station/lunch/dinner/etc.), bookend sources (`bookend-*`, `late_nightlife_bookend`), and departure-kind transits.
2. `repair-day.ts §1b` — splices flagged orphans (locked/user/pinned exempt via `lockedIds` + `isLocked|locked|userPinned` flag), stamps `RepairAction { code: ORPHANED_TRANSIT_NODE, action: 'removed_orphan_transit' }`.
3. `validation-gate.ts` — final safety net: drops any survivor when repair was bypassed.

Sentinels: `[ORPHAN_TRANSIT_REMOVED] day=N idx=K "title"` (repair) / `[VALIDATION_GATE] ORPHANED_TRANSIT_NODE day=N dropped …`.

Tests: `__tests__/orphaned-transit-node.test.ts` (7 cases).

Closes the "Travel to Tasca do Chico on Day 2 → Tasca do Chico never scheduled" leak.
