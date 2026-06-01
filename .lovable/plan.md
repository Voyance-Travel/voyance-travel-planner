You’re right. The actual issue is a schema drift class of failures: the new v2 `resolveTripFacts` path is selecting fields that do not exist on the live `trips` table, causing the chain to die before Day 1 generation. The latest blocker is `trips.dietary_restrictions`, after the earlier `destination_iata` blocker.

Plan:
1. Audit the full v2 generation read path against the live `trips` schema.
   - Use the actual live column list as the source of truth.
   - Check `supabase/functions/_shared/trip-facts.ts` and the v2 generation files it feeds.
   - Identify every selected or dereferenced `trips.*` field that is not present.

2. Patch `resolveTripFacts` as the main fix.
   - Remove all missing columns from the `trips.select(...)` call.
   - Keep existing behavior by using already-loaded profile data and metadata fallbacks for dietary restrictions, interests, and any other missing trip-level preferences.
   - Do not add schema columns just to satisfy stale code unless the product genuinely needs them.

3. Add a defensive helper inside `trip-facts.ts` for trip preferences.
   - Normalize dietary restrictions and interests from safe sources only: profile fields and metadata if present.
   - Avoid direct reads from optional/non-existent trip columns.

4. Do a second pass for similar schema drift references in the v2 day-chain.
   - Scan `generate-itinerary/v2/*`, `_shared/trip-facts.ts`, and immediate dependencies for risky `trips.select(...)` strings.
   - Patch any remaining missing-column references found in this generation-critical path.

5. Deploy `generate-itinerary`.
   - This is needed because the shared helper is bundled into that edge function.

6. Verify with logs.
   - Confirm `resolveTripFacts` no longer fails with `column trips.* does not exist`.
   - Confirm Day 1 reaches the next pipeline stage instead of returning `Initial chain failed (status=500)`.

Out of scope for this pass:
- The Day 4 transfer duration/window cosmetic issue.
- Any database schema migration.
- Frontend UI changes.