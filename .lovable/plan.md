## Goal

Eliminate same-venue cross-day duplicates like "Louvre Museum Exploration" (Day 1) and "Louvre Museum Priority Visit" (Day 2). Today's safety net relies on substring containment, which misses pairs where both titles share the venue but differ in qualifier ("Exploration" vs "Priority Visit").

## Root cause

`supabase/functions/generate-itinerary/action-generate-trip-day.ts` lines 1137–1165 implement the cross-day dedup safety net. It compares previous-day venue names against the current day's `venueName`/`title`/`location.name` using a simple `includes()` check. With:

- Day 1 title: "Louvre Museum Exploration" → no prev venue contains it, it doesn't contain any prev venue.
- Day 2 title: "Louvre Museum Priority Visit" → same problem.

Neither name is a substring of the other, so dedup misses the duplicate. The activity-style suffixes ("Exploration", "Priority Visit", "Tour", "Experience") are never stripped before comparison.

`generation-utils.ts` already exports a fuzzy comparator `venueNamesMatch` (alias resolution + word-overlap with adaptive threshold) and a `normalizeVenueName` helper — they're used by `universal-quality-pass.ts` but not by this safety net.

## Changes

### 1. Harden cross-day dedup safety net in `action-generate-trip-day.ts` (~lines 1137–1165)

Replace the substring-only dedup with a canonical-name + fuzzy-match dedup:

- Add a local `canonVenue(s)` helper that:
  - Strips activity-style prefixes already handled at line 487–490 ("Morning at …", "Visit/Explore/Tour …").
  - Strips activity-style **suffixes**: `exploration`, `exploring`, `experience`, `priority visit`, `skip the line`, `guided tour`, `guided visit`, `private tour`, `tour`, `visit`, `stroll`, `walk`, `wander`, `tasting`, `workshop`, `class`. Loop until stable so chained suffixes ("Priority Visit Tour") collapse fully.
  - Returns `normalizeVenueName(...)` of the result.
- Build `prevVenuesCanon` by passing every entry in `usedVenues` through `canonVenue`.
- For each candidate activity, build canonical strings from `title`, `venueName`/`venue_name`, and `location.name`.
- Match using `venueNamesMatch(cand, prev)` (already imported elsewhere) instead of `includes()`. This catches:
  - "louvre museum" ↔ "louvre museum" (exact after stripping)
  - alias pairs ("musée du louvre" / "louvre museum")
  - word-overlap ≥ threshold for multi-word names
- Keep all existing escape hatches: `act.locked`, dining/restaurant/food categories, accommodation/transport/logistics categories.

### 2. Apply the same canonicalization to `usedVenues` collection at lines 480–494

When `usedVenues` is built from previous days, also push the **stripped** title in addition to the raw forms. This means subsequent days' dedup checks have multiple shapes to match against (raw, canon, and any pre-stripped variant). Low risk; just adds entries to the array.

Specifically: alongside the existing `stripped` push (line 492), also push `canonVenue(titleName)` and `canonVenue(locName)` when distinct. Done in the same loop so we don't re-walk `existingDays`.

### 3. (Optional) Mirror the suffix list into `universal-quality-pass.ts` Step 3

The Step 3 dedup at universal-quality-pass.ts lines 94–120 already uses `venueNamesMatch` but compares raw `venue_name`/`location.name`/`title`. If the title is "Louvre Museum Exploration" and the prev-day venue_name is "Louvre Museum", word-overlap (50% threshold for ≤2-word names) should already catch it — so this layer is probably already correct. Verify by computing: words("louvre museum exploration") = 3, words("louvre museum") = 2, overlap = 2, smaller = 2, ratio = 1.0 ≥ 0.5 ✓. Likely no change required here, but add a one-line canon pass on title before matching as a belt-and-suspenders measure.

## Why the safety net misses today

The first dedup line in action-generate-trip-day.ts (line 1138) runs **before** universal-quality-pass and uses substring matching. If the day-1 title was stored as "Louvre Museum Exploration" and the day-2 title is "Louvre Museum Priority Visit", neither is a substring of the other, so the safety net passes both through. By the time universal-quality-pass runs on day 2, day 1 is already saved with that exact title — and the universal-quality-pass dedup compares against `usedVenueNames` which is populated from the venue_name/location.name fields, not the raw title with qualifier. So depending on how venue_name was captured (often empty for attractions where the title IS the venue), the fuzzy match might also miss.

The fix above closes both gaps.

## Files touched

- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — replace the dedup at ~1137–1165, augment `usedVenues` push at ~480–494.
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — small canon pass on candidates before fuzzy match (defensive).

No DB changes, no UI changes.

## Out of scope

- Refactoring the multiple dedup layers into a single pass (large change, separate effort).
- Catching same-venue *same-day* duplicates (different problem; current per-day pipeline handles via different code path).
