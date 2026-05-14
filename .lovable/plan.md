# Health engine: timestamps, false positives, flicker

The engine produces three classes of complaints:

1. **Stale timestamps in warning text** — Copenhagen dinner card renders 20:50–22:50, the warning quotes 21:50–23:50. Different times, same card.
2. **Cross-day venue leakage** — Budapest Day 1 surfaces venues that belong to another day.
3. **Score flicker on page load** — Budapest 77 → 74, "2 issues" → "3 issues" within the same render.

All three live entirely in `src/components/trip/TripHealthPanel.tsx` + tiny support file `src/lib/itinerary/healthCascadePreview.ts`. No backend, no schema, no save-path changes.

---

## 1. Warning text must mirror the rendered card

### What's happening today

`analyzeHealth` builds `timed[]` using `getDisplayStartTime(a, cascadePreview, idx)`. That helper returns the **post-cascade** preview time when the dry-run cascade reshuffled the day. The warning template then echoes those preview times:

```
"Dinner at Høst" (21:50–23:50) runs into "Nightcap …" (…). Auto-resolves on save.
```

But the user's card still shows the **pre-cascade** time (20:50–22:50) because nothing has been saved yet. Two different times for the same card → user thinks the engine is hallucinating.

### Fix

Build two parallel views inside the per-pair loop:

- `cascadeStart/End` — used for overlap detection + suppression (unchanged)
- `displayStart/End` — read directly from the activity record (`displayStartTime || startTime || start_time || time`) bypassing the cascade map; used **only** in the user-facing message

Then the warning echoes the same times the card shows, while the suppression branch still trusts the cascade.

### Bonus rule

If `cascadeStart/End` differs from `displayStart/End` by ≥1 minute on either side AND the cascade-recheck says the conflict is **resolved**, drop the warning entirely — it's purely an artifact of the dry-run cascade reshuffling. The "Auto-resolves on save." suffix becomes unreachable in normal use.

---

## 2. Day-boundary guard on the conflict pass

`detectGapsForDay` already filters strictly on `dayNumber` (good). The conflict pass at line 287 currently does:

```ts
.filter(({ a }) => (a.dayNumber ?? a.day_number ?? dayNum) === dayNum)
```

The `?? dayNum` fallback admits **any** row sitting in `day.activities` whose `dayNumber` field is missing — even if the row is a stray from another day's parse leak. That is the Budapest #1 leak path.

### Fix

Tighten to:

```ts
.filter(({ a }) => {
  const tagged = a.dayNumber ?? a.day_number;
  if (tagged !== undefined && tagged !== null) return tagged === dayNum;
  return true; // truly untagged → keep, parser invariant says it belongs here
})
```

PLUS add a dev-only `console.warn('[HEALTH_CROSS_DAY_LEAK]', …)` whenever an activity tagged with another day was filtered out — gives us telemetry to trace the parser leak without blocking the user.

---

## 3. Stop the 77 → 74 flicker on first paint

Today `stableIssues` initialises with **errors only**, then the 600 ms soak commits warnings — score drops on second tick.

### Fix

Treat the very first commit as a free pass: when `lastSignatureRef.current === ''` (initial mount) commit errors **and** warnings synchronously. The soak only kicks in for *subsequent* signature changes. That preserves the original purpose (suppress phantom warnings from optimistic edits + partial hydration mid-session) while removing the visible "score recalculating" jump on page load.

Also add a small pre-commit dedupe: `Array.from(new Map(rawHealthIssues.map(i => [i.id, i])).values())` so an upstream double-emit can't bump the count from 2 → 3 by itself.

---

## Acceptance

- Open Copenhagen trip with the dinner/transit conflict. The warning's quoted times match exactly what the card shows. If the cascade resolves the conflict, no warning appears at all.
- Open Budapest #1. No conflict warning quotes a venue that doesn't appear on that day. If a leak still exists, `[HEALTH_CROSS_DAY_LEAK]` logs to console for repro.
- Hard-refresh either trip. Score and issue count are stable from first paint — no jump from 77 → 74 (or similar) within the same load.
- Existing `[HEALTH_CASCADE_DRIFT]` / `[HEALTH_CASCADE_PREVIEW_MISS]` telemetry still fires on real disagreements.

## Out of scope

- The save-time cascade itself (`enforceTimingAndBuffers`) — already correct, ships 82 fixes per Copenhagen save.
- The parser leak that puts cross-day venues into `day.activities` — telemetry-only here; parser fix tracked separately if `[HEALTH_CROSS_DAY_LEAK]` fires in production.
- The Dublin v1 restoration (separate confirmation still pending).
- Hero image work (already shipped).
