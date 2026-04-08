
Goal

Restore Paris trip quality to the #29I level without throwing away the later crash fixes, hotel dedup fixes, and spillover fixes that were added afterward.

What I found

- The current catastrophic timing bug is not mainly the Dawn Guard anymore. `repair-day.ts` now has the split-shift fix.
- The real regression is that time is being rewritten in too many places:
  - `action-generate-day.ts` — inline 68G minimum-duration block + inline overlap fixer
  - `action-generate-trip-day.ts` — same pair again
  - `universal-quality-pass.ts` — another overlap rewrite
  - `pipeline/repair-day.ts` — final overlap/min-duration cascade
- Those stacked passes can keep pushing activities forward until they wrap into 00:00–06:00.
- The placeholder lunch bug is also real: `day-validation.ts` calls `getRandomFallbackRestaurant()` with an array instead of a `Set`, so the real fallback lookup can fail and the code drops into generic templates like `Local Lunch Restaurant`.
- Paris defaults still explicitly include `Pink Mamma`, so the “Italian in Paris” regression is baked into multiple fallback sources.

Recommended approach

- If the exact #29I snapshot exists in History, restore that version there instead of trying to hand-recreate it in code.
- If we stay on the current codebase, do a targeted rollback of the unstable 68-series timing logic while keeping the later non-timing fixes.

Implementation plan

1. Make `repair-day.ts` the single timing authority
- Remove the inline 68G duration and overlap-fixer blocks from:
  - `supabase/functions/generate-itinerary/action-generate-day.ts`
  - `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- Remove the time-shifting overlap step from `supabase/functions/generate-itinerary/universal-quality-pass.ts` so it stops mutating schedules.
- Keep timing repair in `pipeline/repair-day.ts`, which already has spillover stripping, split-shift dawn handling, overlap cascade, minimum durations, and past-midnight cleanup.

2. Fix meal fallback so placeholders cannot survive
- In `supabase/functions/generate-itinerary/day-validation.ts`, pass a real `Set<string>` to `getRandomFallbackRestaurant`.
- Remove generic dining outputs like `Local Lunch Restaurant` / `Local Dinner Restaurant` as final user-facing fallbacks.
- If no verified or hardcoded venue exists, inject a named emergency fallback and mark it for refinement, but never use `the destination` as the address/name.

3. Remove the Paris venue regressions
- Delete `Pink Mamma` from Paris examples and fallback pools in:
  - `pipeline/compile-prompt.ts`
  - `fix-placeholders.ts`
  - `pipeline/repair-day.ts`
- Replace it with French venues already present elsewhere in the project so destination-cuisine rules match the actual defaults.
- Keep the existing casual-venue price caps so €216-style inflation stays blocked.

4. Tighten duplicate and text cleanup
- In `action-generate-trip-day.ts`, verify the duplicate validator is using the latest generated days, not a stale snapshot, so Louvre-style repeats cannot slip through chain generation.
- Add a small title cleanup pass for orphaned phrases like `The of Light` before save/return.

5. Add regression coverage before shipping
- Extend the Deno tests to cover:
  - overlap + min-duration repairs never creating 00:00–06:00 activity times for normal sightseeing/meals
  - meal guard never emitting `Local Lunch Restaurant` or `the destination`
  - Paris fallback data never selecting `Pink Mamma`
  - a landmark like the Louvre cannot appear on two different days
  - duplicate hotel-return cards collapse to one final card

Files likely to change

- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/universal-quality-pass.ts`
- `supabase/functions/generate-itinerary/day-validation.ts`
- `supabase/functions/generate-itinerary/fix-placeholders.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- existing test files in `supabase/functions/generate-itinerary/*.test.ts`

Verification

- Regenerate the Paris trip again and confirm:
  - no sightseeing/meals appear before 06:00 unless they are real transport/arrival/departure cards
  - no `Local Lunch Restaurant` / `the destination`
  - no `Pink Mamma`
  - no duplicate Louvre
  - no duplicate hotel return or back-to-back transport cards
  - departure-day lunch respects the train/flight buffer

Technical note

- I would not do a blind “code revert of everything tagged 68-series,” because the later 500-error fixes and some structural repairs are already mixed into the current files.
- The safest code path is: preserve the later crash/dedup/spillover fixes, but remove the duplicated timing writers that were layered on top.
