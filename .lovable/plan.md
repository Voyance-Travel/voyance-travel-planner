
## Context corrections

- The `eco_ethicist` entry **already exists** at `supabase/functions/generate-itinerary/archetype-constraints.ts` lines 1304–1350 (identity "The Mindful Voyager", category Transformer). It is not missing — the original premise was wrong. Users assigned this archetype already get its constraints; they are just thinner than desired.
- The file path in the original ask (`archetype-data.ts`) is the wrong file — that module only re-exports types/helpers. All 27 archetype records live in `archetype-constraints.ts`.
- The proposed new fields (`id`, `name`, `affinity`, `timePreferences`, `diningPolicy`, `pace`, `minScheduledActivities`) are not part of `ArchetypeDefinition` and nothing downstream reads them. Verified that `prefer?: string[]` **is** already on the interface (line 13), so we can use it. `michelinOK` and `spaOK` already exist on `dayStructure`. `pace` and `minScheduledActivities` (the latter is on the interface but not used here) we will skip — out of scope for this round.

## Change (single file)

`supabase/functions/generate-itinerary/archetype-constraints.ts`, lines 1304–1350 — replace the existing `eco_ethicist` block with an enriched version using only fields already on `ArchetypeDefinition`:

- Expand `avoid` to merge the original 6 entries with the new ones from the spec, deduplicated:
  - Chain hotels/restaurants and global brands
  - High-carbon / high-emission optional activities (helicopter tours, jet ski, race cars)
  - Over-touristed sites / mass-tourism photo-op venues
  - Single-use plastic venues
  - Exploitative tourism
  - Cruise ship excursions
  - Animal exploitation experiences (elephant riding, tiger temples, captive dolphin shows)
  - Fast fashion shopping districts
- Add a `prefer` list (new, but uses existing optional field — no schema change):
  - Locally-owned restaurants and cafes
  - B-corp certified or family-run hotels
  - Community-based tourism experiences
  - Sustainable food (farm-to-table, foraging, local producers)
  - Cultural immersion with local guides
  - Nature reserves with conservation focus
  - Public transit and walking
- Update `dayStructure`:
  - `minScheduledActivities: 3`
  - `maxScheduledActivities: 4` (unchanged)
  - `startTime: '08:30'` (was '08:00')
  - `michelinOK: false`
  - `spaOK: false` (unchanged)
- Add a TODO comment above the entry: `// TODO: when ArchetypeDefinition adds affinity/timePreferences/diningPolicy fields, expand per the Mindful Voyager v2 spec.`
- Leave `meaning` block as-is (still accurate).

No other archetypes are touched. No type changes. No new files.

## Verification

1. Read the updated entry to confirm it compiles (TypeScript only — `prefer` and `minScheduledActivities` already exist on the interface).
2. Confirm with `rg` that nothing else still references the old `startTime: '08:00'` or shorter avoid list for eco_ethicist.
3. Manual product check (user-driven): assign a test user `eco_ethicist`, generate a trip, confirm:
   - 3–4 scheduled activities/day, day starts ~08:30
   - No chain restaurants, no helicopter/jet ski/race-car activities, no animal-tourism experiences
   - No Michelin recommendations
   - Dining skews local

Enforcement remains soft (prompt-level via `avoid`/`prefer`/`michelinOK`) — no new post-gen validator in this round.
