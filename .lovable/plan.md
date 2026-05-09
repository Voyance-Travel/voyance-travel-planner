# Plan: Resolve `itineraryValidator` orphan warnings (Option B)

## Context

`src/utils/itineraryValidator.ts` emits four issue types but `applyItineraryFixes` (line 249) only repairs `sequence_error`. The other three (`skip_list`, `celebration_misplaced`, `pricing_error`) are warnings with no auto-repair.

Current callsite: `EditorialItinerary.tsx:3360-3372` already filters everything except `skip_list` to `console.debug` ("silent (no-UI) issues"). The visible `skip_list` panel (line 6331) is **informational only** — no swap button, no remediation action. So in practice nothing surfaces to a QA dashboard today.

## Recommendation: Option (b) — demote, don't auto-repair

Auto-dropping a card flagged by `skip_list`, or shuffling a celebration card across days with a `needsTimeReview` flag, is a destructive structural mutation we'd be making without user consent. The skip-list keyword table is also fuzzy (substring match like `'hard rock cafe'`) and prone to false positives. Risk > reward.

The cleaner fix is to align severity with reality: these are informational signals, not warnings.

## Changes

### 1. `src/utils/itineraryValidator.ts`

- Extend `ValidationIssue.severity` union from `'warning' | 'error'` → `'info' | 'warning' | 'error'`.
- Line 202 (`skip_list`): `severity: 'warning'` → `'info'`.
- Line 216 (`celebration_misplaced`): `severity: 'warning'` → `'info'`.
- `sequence_error` (line 232) stays `'error'` — it has a working repair branch.
- `getValidationSummary` (line 303-313): include `info` in the count breakdown only if non-zero, or omit info entirely from the user-facing summary.
- `validateItinerary` `isValid` (line 239) already keys off `severity === 'error'`, so info-level issues correctly leave `isValid: true`. No change needed.

### 2. `src/components/itinerary/EditorialItinerary.tsx`

- Lines 3360-3372: keep the existing console.debug filter. The "Heads up" panel (line 6331) continues to render for `skip_list` regardless of severity since it filters by `type`, not severity — so the user-visible behavior is unchanged.
- No other callsites exist (`rg` confirms only this file consumes the validator).

### 3. Out of scope

- No changes to `applyItineraryFixes` — the `sequence_error` swap (line 260-292) is the only auto-repair we want and it already works.
- No changes to keyword tables or detection logic.
- No new repair branches for skip_list / celebration / pricing.

## Why not Option (a)

- **skip_list drop:** silently removing a card the user can see in their itinerary, based on substring matching against a hand-curated keyword list, is a worse UX than a soft "Heads up" badge. The user can drag/delete/swap themselves.
- **celebration move:** cross-day relocation requires picking a target time, handling buffer cascades, and risks colliding with hotel rituals / dining anchors. The shared `enforceTimingAndBuffers` cascade isn't wired into this client-side helper. A `needsTimeReview` flag is a deferred-bug factory.
- **pricing_error:** the cost-repair pipeline (`action-repair-costs.ts`) already owns this on the backend; client-side double-repair would race the snapshot.

If QA later reports false negatives where these issues need to surface, the right fix is to wire the dedicated backend repair into the affected paths — not to grow the client validator.

## Verification

- TS compile (severity union widened — confirm no callsite narrows on `'warning' | 'error'`).
- Manual smoke: load a Paris trip with a "Seine cruise" card → "Heads up" panel still renders; console no longer logs `silent (no-UI) issues` warnings for celebration mismatches on celebration trips.
