# Why the proposed bridge is a no-op

The spec assumes `metadata.mustHaves` is populated by step-3 and silently ignored by the generator. The codebase says otherwise:

**1. `metadata.mustHaves` is never written by any UI.**
`src/services/mustHavesAPI.ts` exports `createMustHave` / `updateMustHave` / `useCreateMustHave` etc., but `grep -rn "mustHavesAPI\|useCreateMustHave\|createMustHave\|saveTripMustHaves" src/` returns only matches inside the file itself. It is dead code. No step-3 component imports it.

**2. The generator already reads `metadata.mustHaves` — twice.**
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts:559-561` reads `metadata.mustHaves` and feeds it through `buildMustHavesConstraintPrompt(...)`, injected at line 1624 (`${mustHavesConstraintPrompt}`).
- `supabase/functions/generate-itinerary/generation-core.ts:324` passes `trip.metadata.mustHaves` into the generation context.
- `must-do-priorities.ts:1054-1110` is the dedicated builder, explicitly differentiated from `mustDoActivities` (venue names vs schedule items).

**3. The real key step-3 writes is `metadata.mustDoActivities`** (string or string[]). See `src/pages/Start.tsx:2507/2513/3052/3056`, `src/contexts/TripPlannerContext.tsx:297/305`, `src/components/planner/ItineraryContextForm.tsx:122`. This already flows into the generator via `userAnchors.ts` / `buildPerDayActivitiesFromMustDo.ts` / the existing `userIntents` array.

**4. The DB confirms it.** Last 8 trips (Beijing, Stockholm, Paris, Rome, Mexico City, Mallorca, Monaco, Barcelona — all created today/yesterday):

```
mh_count = 0   ui_count = 0   for all 8 trips
```

The Beijing trip the user is debugging has `metadata = { persist_validation, itinerary_frozen_at }` — `mustDoActivities` is also empty. Applying the bridge would iterate an empty array and log nothing. The user would still see ignored must-dos.

## The actual question to answer first

Why does `metadata.mustDoActivities` end up empty on the Beijing trip even though step-3 has a write path for it?

Two known suspects:

- **A. Yesterday's `persistTripItinerary` metadata-merge fix isn't on the affected branch yet** (the persist-merge constraint exists in mem://constraints/itinerary/persist-metadata-merge, edited today). The Beijing trip was created at 14:10 UTC — could pre-date or post-date deploy of that fix. Need to confirm deploy time vs trip creation time.
- **B. The user didn't actually fill in must-dos in step-3 for the Beijing trip.** Easy to falsify by asking, or by reproducing with a fresh trip + must-dos filled in.

## Plan (gated on investigation)

### Phase 1 — investigation only (no code change)

1. Confirm deploy status of `persist-itinerary.ts` (the success-branch metadata merge). If not yet deployed, deploy it and re-test before touching anything else.
2. Create a fresh test trip with 3 must-dos entered in step-3. After save, `SELECT metadata->'mustDoActivities' FROM trips WHERE id = …` and confirm it survives.
3. Pull `[must-do]` / `[user-anchors]` lines from `generate-itinerary` edge logs for that test trip to see whether the prompt actually carries the items.

### Phase 2 — only if Phase 1 proves a real gap

Decide based on what we find:

- If `mustDoActivities` is present in metadata but the generator ignores it → fix is in `userAnchors.ts` / `must-do-priorities.ts` / prompt construction, NOT in a `mustHaves → userIntents` bridge.
- If `mustDoActivities` is wiped → re-confirm the persist-merge constraint actually patched both write paths (`persistTripItinerary` success branch + `action-save-itinerary` callers). The merge already exists in code at `supabase/functions/_shared/persist-itinerary.ts`; verify with `grep -n "priorMeta" supabase/functions/_shared/persist-itinerary.ts`.
- If we discover step-3 has a separate "Must-Have items" UI we missed that uses `mustHavesAPI.ts` → wire that UI's writes into `mustDoActivities` (the canonical key the generator already consumes) rather than introduce a second redundant channel.

### Phase 3 — bridge file (only if Phase 2 proves it's needed)

Even then, the right shape is probably not a `mustHaves → recordedIntents` bridge but a `mustHavesAPI.ts → mustDoActivities` writer alignment, since `mustDoActivities` is the actively-consumed key with established prompt plumbing.

## Recommendation

Do not ship the proposed file + 2 wire-in edits. They are syntactically correct but will silently do nothing because the source array is always empty. Start with Phase 1 — that's a 5-minute test that tells us which of the three real fixes to make.
