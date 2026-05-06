---
name: Pre-save Timing Cascade
description: Shared timing-cascade helper enforces same-start, overlap, and transit-buffer fixes during generation and save so refresh-day finds nothing
type: feature
---

`supabase/functions/_shared/timing-cascade.ts` (`enforceTimingAndBuffers`) holds the canonical algorithm for resolving:
- Same-start collisions (`currStart === nextStart`).
- Overlap (`currEnd > nextStart`).
- Insufficient transit buffer (haversine `estimateTransit` + `getEffectiveMinBuffer`).

Locked cards never move; structural cards (accommodation/checkout/departure) are not pushed. Activities cascaded past 23:30 are dropped except end-of-day hotel-return bookends.

Wired in two places:
- `pipeline/repair-day.ts` section 16 — runs after the legacy section 13/13b/13c so the per-day repair already emits clean output.
- `action-save-itinerary.ts` STEP 2.9 — final pre-write sweep covering manual-paste, assistant-tool edits, and any other path that bypasses repair-day.

Result: `refresh-day` returns `issues: []` on first call, so users no longer see "Fix Timing" prompts on freshly generated trips. Health Score lands at 100 absent operating-hours / venue-closure data issues. Tests live at `supabase/functions/_shared/timing-cascade.test.ts`.
