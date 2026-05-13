## Plan

1. **Make meal detection use the same visible time source as the health engine**
   - Update `classifyMealSlot` so it checks `startTime`, `start_time`, `time`, `displayStartTime`, `adjustedStartTime`, and `metadata.displayStart` instead of only `startTime`.
   - This addresses meal cards that render correctly but are invisible to the health classifier because their time is stored under a legacy/display field.

2. **Harden dining classification for real meal cards**
   - Preserve the existing exclusions for sights/transit/drinks-only.
   - Add support for common fields already present in itinerary data, such as `meal_slot`, `mealType`, `metadata.meal_slot`, `timeBlockType`, and dining tags.
   - Add a same-day fallback: if a day has exactly one plausible dining card in the breakfast/lunch/dinner window, count it for that slot even if category drifted.

3. **Stop thin-schedule false positives on departure days**
   - Make the thin-day skip use an inferred departure mode when persisted `dayMode` is missing/stale.
   - Also treat a last day with a flight/airport-transfer/check-out terminal card as a departure day and skip “only 1 activity” warnings.

4. **Add regression coverage**
   - Add tests for:
     - meals stored with `time`/`start_time` rather than `startTime`;
     - persisted full-day meal policy with visible meals detected correctly;
     - last-day afternoon departure skipping lunch/dinner and thin-day warnings;
     - departure-day terminal card fallback when flight metadata is missing.

## Technical notes

- Primary files: `src/components/trip/TripHealthPanel.tsx` and its test files.
- No backend schema changes needed.
- The fix will keep the existing rule that drinks-only/nightcaps do not satisfy dinner.