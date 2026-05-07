## What's happening

The card shows venue **AcquaMadre Hammam** with a proper street address ("Via di S. Ambrogio 17, 00186 Rome") — that data is correct and matches the curated `INLINE_FALLBACK_WELLNESS.rome` entry. But the **title** renders as `Spa Time — find a venue`.

Trace:

1. The server stored a generic title (e.g. `"Spa Time"` or `"Wellness Session"`) — likely from an older repair pass that downgraded the title without replacing the venue, or from a path that set the venue from `INLINE_FALLBACK_WELLNESS` but never re-applied the matching `Spa Session at {venue}` title via `applyFallbackWellnessToActivity`.
2. At render time, `sanitizeActivityName` (`src/utils/activityNameSanitizer.ts:200-214`) calls `isClientPlaceholderWellness`. That function (`src/utils/wellnessPlaceholderDetection.ts:65-105`) returns `true` **as soon as the title matches a generic pattern** (line 84) — *before* it checks whether the venue/address are real. So a real venue + generic title gets masked to the `WELLNESS_PLACEHOLDER_FALLBACK` string `"Spa Time — find a venue"`.

That's a label-bleed: the placeholder string is meant for items with no venue at all, but the gate fires on title-only and ignores the verified venue sitting right next to it.

## Plan

Two small, surgical changes — purely client-side, no DB write, no AI call.

### 1. Stop masking when the venue is real

In `src/utils/wellnessPlaceholderDetection.ts`, reorder `isClientPlaceholderWellness` so the "real venue" exit comes **before** the generic-title check:

- A venue is "real" if any of:
  - has a `placeId` (already handled, line 77-81),
  - venue name matches one in `INLINE_FALLBACK_WELLNESS` (new — export the flat name set from the server module's mirror, or hard-code a small client-side allowlist; we already mirror the patterns),
  - venue name length ≥ 4, not in `GENERIC_WELLNESS_VENUE_PATTERNS`, **and** address is numeric (≥ 8 chars + a digit).

When real, return `false`. Don't mask anything.

### 2. Auto-correct the title at render time

When the venue is real but the stored title is generic, `sanitizeActivityName` should return `"Spa Session at {venue.name}"` instead of the placeholder string. This matches what `applyFallbackWellnessToActivity` writes for fresh trips, so old and new look identical.

Implementation: in `src/utils/activityNameSanitizer.ts` (around line 211), change the wellness branch:

```ts
if (isClientPlaceholderWellness(probe)) {
  return WELLNESS_PLACEHOLDER_FALLBACK;
}
// New: real-venue + generic-title path — rewrite, don't mask
if (hasGenericWellnessTitle(sanitized)) {
  const venue = (probe.location?.name || probe.venue_name || '').trim();
  if (venue) return `Spa Session at ${venue}`;
}
```

(`hasGenericWellnessTitle` is already exported from `wellnessPlaceholderDetection.ts`.)

### 3. Tests

Extend `src/utils/__tests__/wellnessPlaceholderDetection.test.ts`:

- Generic title `"Spa Time"` + venue `"AcquaMadre Hammam"` + numeric address → `isClientPlaceholderWellness` returns `false`.
- Same input through `sanitizeActivityName` → `"Spa Session at AcquaMadre Hammam"`.
- Empty venue + generic title → still returns the `WELLNESS_PLACEHOLDER_FALLBACK` (regression guard).

## Out of scope

- Backfilling stored titles. The render-time rewrite is enough; on the next save (any edit, refresh, or auto-cascade) the corrected title will be persisted.
- Touching the server. The server already writes the correct `Spa Session at …` shape via `applyFallbackWellnessToActivity`; this is purely about cleaning up legacy data and any case where another pass overwrote just the title.

## Files touched

- `src/utils/wellnessPlaceholderDetection.ts` — reorder the real-venue exit
- `src/utils/activityNameSanitizer.ts` — rewrite generic title when venue is real
- `src/utils/__tests__/wellnessPlaceholderDetection.test.ts` — new cases
