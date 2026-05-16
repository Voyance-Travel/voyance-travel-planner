Yes — based on the actual code paths, this is only partially fixed.

What is fixed:
- `userAnchors` now classify vague items like “sushi lunch” as soft/unlocked.
- Day Brief now tells the model to pick a real venue and schedule the wish naturally.
- `ledger-check` no longer inserts a bare placeholder for soft wishes.

What is still not fixed:
- `perDayActivities` still goes through `parseUserActivities()` and turns almost every non-TBD entry into a locked card, even when it has no time and no real venue.
- `mustDoActivities` fallback from chat/planner still marks vague entries as `priority: 'must'` even when `locked: false`, so they can still be treated too rigidly.
- The venue resolver exists, but it is mostly prompt-side; it does not reliably turn flexible requests into structured, fulfilled day intents before the lock/restore pipeline.

Plan to finish the fix:

1. Update `parseUserActivities()` in `compile-prompt.ts`
   - Only create `LockedCard`s for entries with explicit time or a clearly named venue.
   - Treat vague items like “sushi lunch”, “spa”, “nice dinner”, “rooftop cocktails” as flexible fill requests, not locked cards.
   - Keep true reservations/events locked: “7:30 PM Dinner at Roscioli”, “US Open 9am–6pm”, “Sukiyabashi Jiro”.

2. Feed flexible per-day requests into the Day Brief instead of the locked timeline
   - Add them as `USER WISHES` style guidance for that day.
   - Tell generation to pick a real venue, schedule it in the right slot, add description/address, and route around it.
   - Do not insert them as top-of-day placeholder cards.

3. Normalize chat/planner `mustDoActivities` fallback priority
   - For category-style entries with no time and no named venue, set `priority: 'should'`, `locked: false`.
   - Keep only timed/named commitments as `must`.

4. Wire resolved venues into structured intent metadata
   - When “sushi lunch” resolves to a restaurant, store the venue name/address/description on the intent metadata so downstream generation and validation can verify it.
   - Avoid relying only on raw prompt text.

5. Tighten anchor restoration
   - `anchor-guard` should only restore hard locks.
   - It must never restore soft wishes as visible blank locked activities.

6. Add regression tests
   - “Day 2: sushi lunch” does not become a locked card.
   - “Day 2: 1 PM sushi lunch” is scheduled but resolved to a restaurant, not echoed as “sushi lunch”.
   - “Dinner at Roscioli 7:30 PM” remains locked.
   - Missing soft wishes warn/repair, but do not create placeholder cards.

Files to update:
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/_shared/intent-normalizers.ts`
- `supabase/functions/generate-itinerary/anchor-guard.ts`
- `supabase/functions/_shared/resolve-user-intent-venues.ts`
- relevant tests under `supabase/functions/_shared/` and `supabase/functions/generate-itinerary/`