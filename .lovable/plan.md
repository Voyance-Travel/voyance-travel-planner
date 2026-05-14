## No-Op as written — but a real (smaller) fix is available

### Finding 1 — request shape doesn't match current code
The fix instructions assume two `<TripHealthPanel days={editorDays}` JSX call sites at lines 3129 and 3417. Neither exists.

The actual current state of `src/pages/TripDetail.tsx`:

- **One** `<TripHealthPanel>` call site, at line 3667.
- It is rendered inside a render-prop callback supplied to `EditorialItinerary`:
  ```tsx
  renderTripHealthPanel={(activeDays) => (
    <TripHealthPanel
      days={activeDays}
      ...
    />
  )}
  ```
- `editorDays` is **never** passed directly to `TripHealthPanel`. The panel always receives `activeDays`, which is the days view EditorialItinerary is currently displaying (so the panel already sees post-edit shape, not the original `editorDays` reference).
- A `useMemo` named `healthCheckDays` against `editorDays` would therefore wire to nothing.

### Finding 2 — `recomputeDayModes` is already wired, just for persistence
Lines 184–200 already run `recomputeDayModes(days, flightSel)` once per trip on mount and **persist** the corrected dayModes back to `itinerary_data` (gated by `metadata.dayMode_backfilled_at` so it's idempotent).

So the cached `dayMode` IS being healed on load. What's missing is recomputation on **subsequent** flight edits within the same session — the backfill flag suppresses re-runs.

### Finding 3 — the real, minimal fix
If the symptoms (Day 1 missing-breakfast on 10:15 arrival, departure-day "light activity", 77↔74 flicker) are still reproducing, the leak is that `activeDays` passed to the panel still carries stale `metadata.quality.dayMode` between (a) the one-shot backfill and (b) the next save. Two surgical options:

**Option A (preferred — matches request intent, scoped to one site):**
Wrap `activeDays` inside the existing render prop with a fresh `recomputeDayModes`-derived view, so the panel always reads a current `dayMode`:

```tsx
// At top of file (sync import — recomputeDayModes has no async deps):
import { recomputeDayModes } from '@/lib/itinerary/recomputeDayModes';

// Inside renderTripHealthPanel callback (line 3666):
renderTripHealthPanel={(activeDays) => {
  let healthDays = activeDays;
  try {
    const result = recomputeDayModes(activeDays, (trip as any)?.flight_selection);
    healthDays = result?.updatedDays ?? activeDays;
  } catch (e) {
    console.warn('[TripDetail] health-panel dayMode recompute failed:', e);
  }
  return (
    <TripHealthPanel
      days={healthDays}
      ...all existing props unchanged...
    />
  );
}}
```

This is a **read-only derivation** — does not persist, does not setState, runs each render of the panel section. `recomputeDayModes` is pure and cheap (only touches Day 1 + last day metadata when stale).

**Option B (broader — drop the one-shot guard):**
Remove the `dayMode_backfilled_at` early-return at lines 179–182 so the backfill effect re-runs whenever `trip.flight_selection` changes. Higher blast radius (extra writes, ledger-check considerations per memory `[LedgerCheck Mutation-Only]`), so I'd skip unless Option A doesn't move the needle.

### Acceptance grep adaptation
The original greps don't fit this codebase. If you approve Option A, the verifying greps become:

1. `grep -nE "<TripHealthPanel\b" src/pages/TripDetail.tsx` → 1 hit (unchanged — there's only one).
2. `grep -n "recomputeDayModes" src/pages/TripDetail.tsx` → ≥3 hits (top-level import + existing line 187 in backfill effect + new call inside render prop).
3. `grep -n "days={healthDays}" src/pages/TripDetail.tsx` → 1 hit at the panel.
4. `grep -n "days={activeDays}" src/pages/TripDetail.tsx` → 0 hits inside the `<TripHealthPanel>` element.

### Action
Awaiting approval. Reply with **"Option A"** to apply the read-only render-prop wrap, **"Option B"** for the backfill-guard removal, or **"close as no-op"** if the symptoms aren't actually reproducing post-load.