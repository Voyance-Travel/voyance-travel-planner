## Diagnosis

The issue keeps recurring because “things the user told us” are not treated as a single canonical source of truth.

Right now they are split across several soft paths:

- `metadata.mustDoActivities` is mostly used as prompt text, so the AI can satisfy it, move it, partially include it, or miss it.
- `metadata.perDayActivities` is converted to locked cards in `generate-day`, but the server-side chained `generate-trip-day` path only passes it through to `generate-day`; it does not itself maintain a canonical lock set across all later cleanup/save phases.
- Manual/Build It Myself parsed activities are saved as normal activities, not universally marked locked.
- The normalized table sync currently preserves `isLocked`, but not `locked`, so some pipeline-created locked items can lose their locked status when synced.
- Fresh generation can clear existing itinerary rows before re-seeding the user’s core inputs, so the system has no durable “user anchors must win” layer to restore from.

So the real fix is not another prompt tweak. We need an architectural lock layer: every user-provided concrete item becomes a durable locked anchor before generation starts, and every generator/save path must re-apply those anchors as the final authority.

## Plan

### 1. Create a canonical “user anchors” builder
Add a shared utility used by both frontend and backend generation paths to normalize user input into structured locked anchors.

It will convert these into anchor records:

- Just Tell Us `perDayActivities`
- Just Tell Us `mustDoActivities`
- Single-city “must do” free text
- Multi-city must-dos and selected landmarks
- Build It Myself / pasted parsed itinerary activities
- Existing locked/manual itinerary activities

Each anchor will include, where available:

- `dayNumber`
- `title`
- `startTime`
- `endTime`
- `category`
- `venueName/location`
- `source` (`chat`, `manual_paste`, `single_city`, `multi_city`, `edited`, `pinned`)
- `locked: true`
- `isLocked: true`
- stable `lockedSource` / fingerprint

This gives the system one representation of “the user explicitly asked for this.”

### 2. Persist anchors at trip creation, not only during generation
When a trip is created from any entry flow, store the computed anchors immediately in trip metadata, for example:

```text
metadata.userAnchors = [ ...canonical locked anchors... ]
metadata.mustDoActivities = existing text/list fallback
metadata.perDayActivities = existing day-level fallback
```

Update these creation paths:

- `src/pages/Start.tsx` chat path
- `src/pages/Start.tsx` single-city/multi-city form path
- `src/utils/createTripFromParsed.ts` Build It Myself/manual paste path

For manual paste, the actual itinerary activities should also be marked `locked: true` and `isLocked: true` from the start.

### 3. Make backend generation load anchors from the trip before doing anything else
Update backend generation so anchors are loaded from `metadata.userAnchors` at the start of each day.

Affected paths:

- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

Behavior:

- The prompt still sees the anchors as locked context.
- The generator injects the anchors directly into the itinerary output.
- Any AI-created item overlapping an anchor is removed or shifted.
- The anchor wins over AI recommendations, restaurant deduping, filler removal, wellness limits, departure cleanup, meal repair, and final save cleanup.

### 4. Add a final “anchors overwrite everything” pass
Add a reusable final pass that runs immediately before persistence in both generation paths.

It will:

- Reinsert any missing anchor for that day.
- Restore title/time/category if any cleanup changed it.
- Remove duplicate generated activities that conflict with anchors.
- Sort the final day after anchor restoration.
- Mark restored items with both `locked: true` and `isLocked: true`.

This pass should run after meal guards, repair, terminal cleanup, deduping, and departure-buffer cleanup, because those are the places that currently undo user intent.

### 5. Fix persistence and sync so locks do not get stripped
Update persistence/sync code so any lock flag survives all storage formats.

Specifically:

- `pipeline/persist-day.ts` should continue writing `is_locked` from `act.isLocked || act.locked`.
- `action-sync-tables.ts` should write `is_locked` from `a.isLocked || a.locked`, not just `a.isLocked`.
- JSON itinerary data should preserve both `locked` and `isLocked` for user anchors.
- Version history should save anchor-restored activities after final restoration, not before.

### 6. Protect anchors during full-trip fresh generation and resume
Update `generate-trip` / `generate-trip-day` so a fresh generation can clear AI-generated days, but cannot lose the canonical anchors.

Behavior:

- Before clearing itinerary rows, read and preserve `metadata.userAnchors`.
- Each day in the self-chained generator gets its day-specific anchors.
- Resume generation reloads anchors from metadata, not from partially generated itinerary state.
- Failed/partial regeneration can still recreate missing anchor cards from metadata.

### 7. Make Build It Myself content non-negotiable
For Build It Myself/manual paste:

- Parsed activities become locked by default.
- Smart Finish/enrichment can enhance around them, but not replace/delete/rename them.
- Option groups can still be curated, but the selected/kept item becomes locked after import.
- Any later “regenerate day” must treat those imported items like manually pinned cards.

### 8. Add user-visible confirmation of captured locked anchors
Update confirmation UI so users can see what was captured as protected before generation.

Existing `TripConfirmCard` already shows some captured per-day activities; expand this so all flows can show:

```text
Locked into your trip:
- Day 1: Panda visit, 10:00
- Day 2: Train to Beijing, 16:00
- Day 4: Dinner at TRB Hutong, 19:30
```

This makes expectations explicit and helps users catch extraction mistakes before credits/actions are used.

### 9. Add targeted regression checks
Add focused tests or lightweight validation fixtures for the cases that keep breaking:

- Just Tell Us single-city with specific restaurant/time.
- Just Tell Us multi-city with city-specific anchors and transport.
- Must-do from the form path.
- Build It Myself pasted day-by-day itinerary.
- Regenerate day preserves anchors.
- Resume generation preserves anchors.
- Table sync preserves `locked`/`isLocked`.

## Expected result

After this change, user-provided concrete itinerary details become the source of truth from step one.

The AI can still improve the itinerary, fill gaps, add meals, repair timing, and enrich details, but it cannot silently throw away, rename, move, or overwrite the user’s stated core items. If there is a conflict, the user anchor wins and everything else adapts around it.