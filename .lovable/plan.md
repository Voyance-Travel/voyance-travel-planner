
## Scope

Update secondary UI prose for the 7 rewritten archetypes so they stay aligned with the new identities now in `archetypeNarratives.ts`. Two files, two shapes.

## File A — `src/data/archetypeReveals.ts`

**Schema (existing, will not change):**
```ts
{ id, name, category, revealParagraph: string,
  youProbably: string[], itineraryWillInclude: string[], protectFrom: string[] }
```

**Existing entries (will be rewritten in place):** `cultural_anthropologist` (L27), `community_builder` (L271), `collection_curator` (L365), `retreat_regular` (L459), `beach_therapist` (L489), `sabbatical_scholar` (L737).

**Gap discovered:** `story_seeker` does NOT currently exist in this file (it's in narratives.ts but missing here). Will **add** a new entry under the CONNECTOR section, inserted between `community_builder` (ends L299) and the `// ACHIEVERS` comment (L301). Category: `'CONNECTOR'` to match `archetypeNarratives.ts`.

**Format change for the 7 entries:** the user spec says `revealParagraph` should be a "1-2 sentence shareable summary" matching `hookLine + first sentence of coreDescription`. The current entries use multi-paragraph backtick templates. I'll convert the 7 to short single-string summaries per the user's `community_builder` example. Other 22 archetypes are untouched.

Each of the 7 entries gets:
- `revealParagraph`: 1–2 sentences derived from the new `hookLine` + opening of `coreDescription`
- `youProbably`: 3–5 behavioral bullets aligned to the new identity
- `itineraryWillInclude`: 3–5 bullets about what their trip looks like
- `protectFrom`: 2–3 bullets about what's avoided

The user supplied verbatim copy for `community_builder`. The other 6 will be written to mirror that voice and faithfully reflect the corresponding `archetypeNarratives.ts` text (e.g., Beach Therapist = water every day, Retreat Regular = 70-80% on-property + 1 outside day, Story Seeker = unscripted/wildcard, Passport Collector = breadth/stamps, Cultural Anthropologist = 1–2 cultural anchors per trip not a learning marathon, Sabbatical Scholar = vacation-as-curriculum).

`id`, `name`, `category` preserved on the 6 existing entries (unchanged).

## File B — `src/data/archetypeVoices.ts`

**Schema (existing, will not change):**
```ts
{ descriptionPrefix: Record<string,string>,   // keyed by category: cultural/dining/sightseeing/...
  paceNotes: { morning, afternoon, evening },
  diningNotes: string,
  toneDescriptor: string }
```

**Existing entries (will be rewritten in place):** `cultural_anthropologist` (L72), `beach_therapist` (L180).

**Gap discovered:** 5 of the 7 are missing from this file: `community_builder`, `story_seeker`, `collection_curator`, `retreat_regular`, `sabbatical_scholar`. Without entries here, `getArchetypeVoice()` falls back to `default`, so AI-generated activity copy for these archetypes loses its tonal flavor. Will **add** 5 new entries.

**Schema-fit note for the user spec:** the user's example uses keys like `default` and `excursion` in `descriptionPrefix`. The existing system instead keys by activity category (`cultural`, `dining`, `sightseeing`, `shopping`, `nature`, `wellness`, `entertainment`, `adventure`). Diverging from that breaks `getActivityPrefix(archetypeId, category)`. I will keep the category-keyed schema and pour the user's tonal intent into those category prefixes (e.g., for `retreat_regular`, the `wellness` prefix is the "Sanctuary moment:" line; the rare-outing tone goes into the `cultural`/`sightseeing` prefixes; "excursion" framing lives in `paceNotes.afternoon`).

Per archetype I'll set:
- 5–7 category prefixes appropriate to that identity
- Morning/afternoon/evening pace notes
- One `diningNotes` line
- A short `toneDescriptor` for prompt injection

Tone targets (from spec):
- `beach_therapist` (rewrite): water-anchored, calm, unhurried
- `retreat_regular` (new): quiet, restorative, intentional; one excursion day
- `community_builder` (new): authority-through-coverage, mix of iconic + insider, "you'll be recommending this"
- `story_seeker` (new): unscripted, follow-your-nose, wildcard energy
- `collection_curator` (new): efficient breadth, anchor each city on its iconic landmark
- `sabbatical_scholar` (new): curriculum tone, "every meal is class"
- `cultural_anthropologist` (rewrite): curious-but-balanced (not learning marathon), per the new "vacation but also know where you are" framing

## Out of scope (flagged, not changed)

- The category-mismatch between `archetypeReveals.ts` (community_builder=`CONNECTOR`, escape_artist=`RESTORER`) and the matcher categories shipped earlier remains untouched — same flag as the previous pass.
- 22 other archetypes in `archetypeReveals.ts` and 8 other entries in `archetypeVoices.ts` are not modified.
- Adding the missing `story_seeker` voice entry is in scope (it's one of the 7); adding voice entries for archetypes outside the 7 is not.

## Verification

1. `rg -c "^  (cultural_anthropologist|sabbatical_scholar|story_seeker|community_builder|collection_curator|beach_therapist|retreat_regular):" src/data/archetypeReveals.ts` returns `7` (was `6`).
2. `rg -c "^  (cultural_anthropologist|sabbatical_scholar|story_seeker|community_builder|collection_curator|beach_therapist|retreat_regular):" src/data/archetypeVoices.ts` returns `7` (was `2`).
3. TypeScript build clean — no shape changes.
4. Spot-check that each of the 7 reveals' `revealParagraph` opens with language consistent with the matching `hookLine` in `archetypeNarratives.ts`.
5. Visual: open the DNA reveal page for each archetype; confirm short reveal paragraph + bullets render and feel like the new identity. Generate a Beach Therapist trip — activity copy should be water-anchored.

## Files touched

- `src/data/archetypeReveals.ts` — 6 in-place rewrites + 1 new entry (`story_seeker`)
- `src/data/archetypeVoices.ts` — 2 in-place rewrites + 5 new entries
