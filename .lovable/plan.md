Root cause found: this keeps recurring because the system still has intentional fallback code paths that emit `Lunch — pick a restaurant` when city context or local fallback coverage is missing.

Specifically:
- The backend fallback resolver in `supabase/functions/generate-itinerary/fix-placeholders.ts` ends in `GLOBAL_EMERGENCY_FALLBACK`, whose lunch value is literally `Lunch — pick a restaurant`.
- The client fallback resolver in `src/lib/fallbackRestaurants.ts` returns `null` for unknown cities, and `src/utils/mealGuard.ts` then emits `Lunch — pick a restaurant`.
- The current saved Venice example confirms the failure mode: Day 3 has no `city`/`destination` on the day object, so later save/cleanup passes can run with weak destination context and fall through to the global sentinel.
- `action-save-itinerary.ts` only runs `terminalCleanup` for first/last days. On a 3-day trip Day 3 is last, but for middle-day placeholders this means cleanup can be skipped if the meal detector thinks lunch already exists. More importantly, a sentinel can satisfy meal detection because `detectMealSlots` counts title keywords without rejecting placeholder/unverified slots.

Plan:
1. Remove the placeholder as a valid backend fallback
   - Replace `GLOBAL_EMERGENCY_FALLBACK` in `fix-placeholders.ts` with real named global emergency venues for breakfast/lunch/dinner, not `needsVenuePick` sentinels.
   - Keep costs conservative and sourced as fallback, but never emit `pick a restaurant` from server-side generation/cleanup.

2. Make meal detection ignore placeholder/unverified slots
   - Update backend `detectMealSlots` so `Lunch — pick a restaurant`, `metadata.needsVenuePick`, `metadata.unverified_venue`, empty-address sentinels, and AI stub venue names do not count as lunch/dinner/breakfast compliance.
   - Mirror this in the client meal guard so placeholders cannot satisfy compliance before save.

3. Run terminal placeholder cleanup for every day before save
   - In `action-save-itinerary.ts`, run `terminalCleanup` on all days, not only first/last days.
   - Preserve arrival/departure constraints only for first/last days as today.
   - Use robust destination resolution: `day.city || day.destination || trip.destination || metadata destination`, not `the destination`.

4. Harden client pre-save fallback
   - Change `src/lib/fallbackRestaurants.ts` so unknown destinations also resolve to real named global emergency venues instead of `null`.
   - Update `preSaveMealStubSweep` so if fallback resolution somehow fails, it uses that real global emergency path rather than setting `needsVenuePick`.

5. Add regression tests
   - Backend test: a day containing `Lunch — pick a restaurant` must be treated as missing lunch and replaced by a real named venue.
   - Backend test: `nuclearPlaceholderSweep` with empty/unknown destination never outputs `pick a restaurant`.
   - Client test: `preSaveMealStubSweep` replaces `Lunch — pick a restaurant` and never leaves `needsVenuePick`.

6. One-time data cleanup migration
   - Repair existing saved itineraries where activity titles or venue names match `pick a restaurant` / `pick a café`, replacing them with destination-aware or real global fallback venues.
   - Do not touch locked/user-added/pinned activities.