## Add closing-hours awareness

Three small, self-contained changes — no behavior change beyond logging + a UI swap.

### 1. New file: `supabase/functions/_shared/venue-hours-validator.ts`
Pure utility exporting `validateClosingHours(activities)` plus `HoursViolation` type. Detects venue type from title regex (museum / basilica / church / cathedral / cemetery / gallery / market / palace / ruins), compares parsed `startTime`/`endTime` against a per-category typical close, returns violations. No external deps.

### 2. Wire into `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- Add import for `validateClosingHours` near other `_shared` imports.
- Just before the final `return { activities: deduped, repairs }` at line 5027, run the validator against `deduped`, `console.warn` each violation with `[venue-hours] Day {N} violation: …`, and stash the array on `day.metadata.quality.hours_violations`.
- Non-blocking — purely observational + metadata. Generator output is unchanged on this pass.

### 3. UI: `src/components/reviews/ReviewsDrawer.tsx` (~line 218)
Replace the single-line `Open now / Closed` block with:
- If `place.openingHours` has entries: render the live open/closed label on top + the full weekly list below.
- Else fall back to the existing one-liner (now reads "Closed now" instead of "Closed" for symmetry).

### Acceptance
All 6 greps from the spec pass; Rome regen logs `[venue-hours] Day N violation: …` for Basilica San Clemente / Cemetery; ReviewsDrawer renders the weekly hours list when Google returned them.

### Out of scope
Actually rescheduling violating activities (this PR only flags). Hooking the metadata into a user-visible health warning. Per-day-of-week parsing of typical-close (uses single weekday default).
