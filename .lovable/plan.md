Plan to fix the Trip Health false positives:

1. Make Trip Health consume the same live itinerary content the page renders
   - Update `EditorialItinerary`’s parent-sync fingerprint so `onDaysChange` fires when meal-relevant fields change, not only when activity IDs change.
   - Include stable fields such as title/name, category/type, start/end/time aliases, duration, meal slot metadata, and day metadata in that fingerprint.
   - This keeps `TripDetail.trip.itinerary_data.days` current, so the `TripHealthPanel` React node built in `TripDetail` stops scoring stale/pre-render days while the editor displays newer local days.

2. Harden editor resync in the other direction
   - Expand `initialDaysFingerprint` beyond ID + time so parent updates that preserve IDs but change category/title/meal metadata still reach the editor state.
   - Keep the existing “don’t overwrite unsaved local changes” guard intact.

3. Align health meal detection with visible meal cards
   - Add a small shared fingerprint helper or local normalizer that reads the same legacy fields the health classifier already supports (`startTime`, `start_time`, `time`, `mealSlot`, `meal_slot`, `metadata.meal_slot`, etc.).
   - Preserve the existing drinks-only/nightcap exclusion so nightcaps still do not satisfy dinner.

4. Lock it with regression tests
   - Extend `editorialFingerprint.test.ts` to prove the fingerprint changes when only category/title/meal-slot fields change on the same activity IDs.
   - Add/extend a `TripHealthPanel` false-positive test where all three visible meals exist and no `missing-meals` issue is emitted.
   - Add/extend a departure-day test where a short day with checkout/airport-transfer remains free of “light schedule”/“no activities” warnings.

5. Validate
   - Run the focused Vitest files for `TripHealthPanel` and itinerary/editorial fingerprint behavior.
   - Confirm the health score uses live day data and no longer craters to false 40/100 when meals are present.