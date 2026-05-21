## Fix #1 — Scheduling Engine: kill fake "5 min" transit cards & bogus conflicts

### Root causes (verified in code)
1. `estimateTransit` (`supabase/functions/_shared/timing-cascade.ts:340`) returns `null` the moment either endpoint is missing `location.lat/lng`. Upstream callers then fall back to a flat default buffer, and **transit/walk cards themselves are never re-evaluated** — their AI-emitted `durationMinutes` (often a fabricated 5 min) survives unchanged.
2. When coords *do* exist but are wrong/poisoned, Haversine yields nonsense distances and walk/taxi minutes propagate as-is.
3. The cascade only shifts the *next* card forward; it never rewrites a transit card's own `durationMinutes` / `endTime` to match the geographic reality between its neighbors.
4. Health panel surfaces the resulting "X min conflict" as a real warning even when the next save would silently dissolve it.

### Scope
- Backend: `supabase/functions/_shared/timing-cascade.ts` only.
- Frontend: `src/lib/itinerary/healthCascadePreview.ts` (read-only preview parity).
- No DB migration, no new edge function, no UI redesign, no matcher/cost-table changes.

### Plan

**A. `estimateTransit` — named-venue fallback + sanity floor**
- When coords are missing on either side, fall back to deriving a synthetic distance from the prior/next venue name pair via the existing `INLINE_FALLBACK` venue tables already imported elsewhere in `_shared/`. If still unresolved, return a *typed* `unverified` estimate (method `walking`, `durationMinutes = 15`, `distance = 'unknown'`, `recommended: false`) instead of `null`. This kills the silent 15-min default path that lets 5-min cards survive.
- Add a hard floor: walking < 80 m → drop to 0/merge candidate (already `isSamePlace`); 80–400 m → min 4 min; > 400 m → never less than `Math.ceil(distMeters/80)`.
- Keep existing thresholds (`isWalkable ≤ 15 min`, transit < 10 km, else taxi).

**B. New pass: `recomputeTransitCards` inside `enforceTimingAndBuffers`**
- Runs right after the pre-walks (line ~436), before the chronological sort.
- For every card whose `category` matches `TRANSIT_CATS` *or* whose title starts with `walk|stroll|transit|transfer|taxi`, find its immediate non-transit neighbors (`prev`, `next`) in the day array.
- Compute `est = estimateTransit(prev, next)`. If `est.method !== 'unknown'`:
  - Overwrite `durationMinutes`, `endTime = startTime + durationMinutes`, and append `[CASCADE_TRANSIT_FIX]` repair note (`before`/`after` minutes).
  - Respect lock: `lockedIds.has(card.id)` → skip.
  - Respect user/booked/manual basis (mirror `isActivityLocked` check used in `healthCascadePreview`).
- If `est` is unverified, mark the card `metadata.transit_unverified = true` so the FE preview can suppress its conflict warning (see step D).
- Cap per-card adjustment at the same `MAX_CUMULATIVE_SHIFT = 120` already used by `cascadeShift`.

**C. Telemetry**
- Per-day summary log `[CASCADE] day=N transit_recomputed=K transit_unverified=M` and per-repair `[CASCADE_TRANSIT_FIX]` entries pushed onto the existing `repairs[]` array (already surfaced through `metadata.quality.cascade_repairs`).

**D. Health preview parity (`src/lib/itinerary/healthCascadePreview.ts`)**
- After the dry-run cascade clone, also run the new `recomputeTransitCards` step against the clone so the preview-time durations match what save-time will write.
- In `TripHealthPanel` filtering (already cascade-aware), suppress `overlap`/`buffer` warnings whose blamed card carries `metadata.transit_unverified === true` — these are best-effort estimates and shouldn't surface as red conflicts.

### Out of scope
- Real Google Directions calls (no new paid API surface).
- Touching the FE editor's "Fix timing" CTA (already routes through `enforceTimingAndBuffers` — gets the fix for free).
- Restyling transit cards.

### Ship order
1. Land A + B + C behind no flag (deterministic, idempotent). Watch `[CASCADE]` logs for one regen cycle.
2. Land D (preview parity + warning suppression) the same PR — without it the user still sees the stale red "5 min conflict" until the next save.

### Acceptance
- Regenerate a São Paulo / Madrid trip with transit-heavy days. `metadata.quality.cascade_repairs` shows `[CASCADE_TRANSIT_FIX]` entries for any AI-emitted 5-min walk between non-adjacent venues. Card duration matches the Haversine distance. Health panel shows zero "X min conflict" warnings for transit cards. Locked / user / booked transit rows untouched.