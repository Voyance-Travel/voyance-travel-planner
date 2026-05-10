
## Scope

Replace the 6 prose fields (`hookLine`, `coreDescription`, `whatThisMeans`, `superpowers`, `growthEdges`, `perfectTripPreview`) on 7 archetype entries in `src/data/archetypeNarratives.ts`. Preserve `id`, `name`, `category`, `emoji`, and any optional fields (`iconName`, `revealParagraph`, `youProbably`, `itineraryPreview`) untouched.

## Locations (verified)

| Slug | Line | Current `name` |
|---|---|---|
| `cultural_anthropologist` | 129 | The Cultural Anthropologist |
| `community_builder` | 416 | The Purpose Voyager |
| `story_seeker` | 441 | The Story Seeker |
| `collection_curator` | 616 | The Passport Collector |
| `retreat_regular` | 666 | The Wellness Devotee |
| `beach_therapist` | 691 | The Beach Therapist |
| `sabbatical_scholar` | 853 | The Immersion Seeker |

## Edits

For each entry, replace the 6 prose fields with the spec text verbatim. No structural changes (no new fields, no removed fields, no renamed slugs).

## Out of scope (flagged, not changed)

The reveal-narrative file currently has two category labels that disagree with the matcher's archetype categories shipped earlier:

- `community_builder` is `CONNECTOR` here but matcher/constraints place it as `ACHIEVER`.
- `escape_artist` is `RESTORER` here but matcher/constraints place it as `EXPLORER`.

The user's request is explicitly about prose fields only ("Update these 7 archetype entries with new hookLine, coreDescription, whatThisMeans[], superpowers[], growthEdges[], and perfectTripPreview fields"), and `escape_artist` isn't even in the 7. I will **not** touch categories in this pass — flagging it here so it can be a separate decision if the inconsistency matters for category-based UI styling on the reveal page.

## Verification

1. After edits, `grep -c "hookLine" src/data/archetypeNarratives.ts` should be unchanged in count (still one `hookLine:` per archetype) — this only confirms presence, not correctness. Better:
2. `rg -A1 "id: 'cultural_anthropologist'" src/data/archetypeNarratives.ts | head` and similar spot-checks confirm the new `hookLine` opens with "You don't just visit a place — you want to understand it" etc.
3. TypeScript build passes (no shape change to `ArchetypeNarrative`).
4. Visual: open DNA reveal page for each of the 7 archetypes (or unit-render `getArchetypeNarrative('cultural_anthropologist')`) and confirm new copy renders.

## Files touched

- `src/data/archetypeNarratives.ts` — 7 contiguous-block edits
