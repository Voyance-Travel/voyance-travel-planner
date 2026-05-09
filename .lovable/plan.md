## L6 — Distance parsing units guard

**File:** `supabase/functions/route-details/index.ts` (around line 199)

**Change:** Add a defensive sanity check after parsing `leg.distanceMeters` from the Google Routes API. If a single leg's distance exceeds ~2,000,000 meters (2,000 km), log an error — Google's response shape likely changed (e.g. miles instead of meters). Non-fatal: log only, do not throw or alter the response.

### Edit (single insertion at L199)

Replace:
```ts
// Parse total distance
const distanceMeters = leg.distanceMeters || 0;
const distanceMiles = (distanceMeters / 1609.34).toFixed(1);
```

With:
```ts
// Parse total distance
const distanceMeters = Number(leg.distanceMeters) || 0;

// Sanity-check: a single leg distance should never exceed ~2,000,000 meters
// (2000 km). If it does, Google's response shape changed and we're parsing
// the wrong unit. Fail loudly so we catch it in dev rather than silently
// rendering "100 mi" as "160,934 m".
if (Number.isFinite(distanceMeters) && distanceMeters > 2_000_000) {
  console.error('[route-details] Implausible leg distance — possibly wrong unit:', {
    distanceMeters, expected: 'meters',
  });
  // Don't fail the response — just log. Caller decides what to do with the value.
}

const distanceMiles = (distanceMeters / 1609.34).toFixed(1);
```

Note: the loop in this file processes a single `leg` (no `i` index in scope), so the log payload omits `legIndex` from the spec snippet.

### Verify
```
grep -c "Implausible leg distance\|2_000_000" supabase/functions/route-details/index.ts
```
Expect ≥ 1 (will be 2).

### Out of scope
- No frontend changes, no behavior change for callers, no AI/billing impact.
