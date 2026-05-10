
## Goal
Update 9 archetype definitions used during itinerary generation: 2 category moves, 7 identity/meaning rewrites, plus full Mindful Voyager constraints.

## Where edits land
The user named `archetype-data.ts`, but that file is a thin re-export aggregator. The actual archetype records live in **`supabase/functions/generate-itinerary/archetype-constraints.ts`** (definitions are imported and re-exported via `archetype-data.ts`). All edits go to `archetype-constraints.ts`. No change needed to `archetype-data.ts`.

## Schema reconciliation (existing code vs. user spec)

| Spec key | Existing field | Resolution |
|---|---|---|
| `identity` (paragraph) | `identity: string` is a short title; long form lives in `meaning` | Keep `identity` short titles unchanged; write the new paragraphs into `meaning`. The user's "identity rewrite" lands in `meaning` (this is what shapes prompt behavior). |
| `category: 'achiever' / 'explorer'` (lowercase) | TS union is `'Explorer' \| 'Connector' \| 'Achiever' \| 'Restorer' \| 'Curator' \| 'Transformer'` (capitalized) | Use capitalized form to satisfy TS. Verification grep adjusted to `category: "Achiever"`. |
| `dayStructure.cultural_activity_ratio`, `educational_activity_ratio`, `unscripted_activity_minimum`, `activity_density`, `mix`, `retreat_property_time_ratio`, `outside_retreat_days`, `required_amenities`, `pace` | Not on interface | Extend `ArchetypeDefinition['dayStructure']` with these as optional fields (additive, non-breaking). The prompt builder (`buildIdentityBlock`) ignores unknown keys, but downstream `archetype-constraints.ts:buildArchetypeConstraintsBlock` already serializes day-structure facts; we'll surface the new ratios via the `meaning` text so they reach the model immediately. |
| Beach Therapist `HARD CONSTRAINT: water access required every day` + `hotel: must be waterfront` | Not on interface | Add optional `dayStructure.requiresWaterDaily?: boolean` and top-level `hotelRequirement?: 'waterfront' \| 'walkable_to_water' \| ...`. Inject as bullet line in `meaning` so the LLM sees it on day-1. |
| Mindful Voyager `affinity`/`timePreferences`/`diningPolicy` | These live in sibling `experience-affinity.ts`; not on `ArchetypeDefinition` | Add optional top-level fields on `ArchetypeDefinition` (`affinity?`, `timePreferences?`, `diningPolicy?`) so the spec is captured at the definition level. Existing affinity logic in `experience-affinity.ts` remains the runtime read-path; we mirror the policy on the definition for the TODO at line 1304 ("when ArchetypeDefinition adds affinity/timePreferences/diningPolicy fields, expand per the Mindful Voyager v2 spec") and so the prompt builder can surface `michelinAllowed: false` + `minLocalShare: 0.8`. |

## Edits

### A. Interface extension (lines 8–31 of archetype-constraints.ts)
Add optional fields:
```ts
dayStructure: {
  // ... existing
  pace?: 'slow' | 'moderate' | 'fast';
  cultural_activity_ratio?: [number, number];
  educational_activity_ratio?: number;
  unscripted_activity_minimum?: number;
  activity_density?: 'low' | 'moderate' | 'high';
  mix?: { iconic: number; hidden: number };
  retreat_property_time_ratio?: [number, number];
  outside_retreat_days?: number;
  required_amenities?: string[];
  requiresWaterDaily?: boolean;
};
hotelRequirement?: 'waterfront' | 'walkable_to_water' | 'eco_certified' | 'retreat_property';
affinity?: { high: string[]; medium: string[]; low: string[]; never: string[] };
timePreferences?: { startTime: string; peakEnergy: string; preference: string };
diningPolicy?: { michelinAllowed: boolean; preferLocal: boolean; minLocalShare: number };
```

### B. Category moves (1 line each)
1. `community_builder` (Purpose Voyager) — line 460: `category: "Connector"` → `"Achiever"`.
2. `escape_artist` — line 1041: `category: "Restorer"` → `"Explorer"`.

### C. `meaning` rewrites (7 archetypes)
Replace existing `meaning` body for each, mirroring the spec's identity paragraph + day structure cues + (where applicable) HARD CONSTRAINT bullets so the LLM sees them. Set the new optional `dayStructure` fields per spec:

1. **cultural_anthropologist** (line 38) — meaning rewritten ("vacation but ALSO wants to understand…"); `cultural_activity_ratio: [0.2, 0.3]`.
2. **sabbatical_scholar** (line 1465) — meaning rewritten ("Treats vacation as a class…"); `educational_activity_ratio: 0.8`.
3. **story_seeker** (line 507) — meaning rewritten ("Memory-maker…"); `unscripted_activity_minimum: 1`.
4. **community_builder / Purpose Voyager** (line 458) — meaning rewritten ("Compulsive traveler…"); `activity_density: 'high'`, `mix: { iconic: 0.6, hidden: 0.4 }`.
5. **collection_curator / Passport Collector** (line 670) — meaning rewritten ("Collects destinations like trophies…"); `activity_density: 'high'`, plus a meaning bullet "iconic_priority: very high".
6. **beach_therapist** (line 873) — meaning rewritten ("Water is the identity…"); `requiresWaterDaily: true`; top-level `hotelRequirement: 'walkable_to_water'`. HARD CONSTRAINT bullet kept in meaning.
7. **retreat_regular** (line 821) — meaning rewritten ("Travels TO escape…"); `retreat_property_time_ratio: [0.7, 0.8]`, `outside_retreat_days: 1`, `required_amenities: ['spa','meditation','yoga','healthy_dining']` (OR-semantics noted in meaning).

`identity` (short title), `avoid`, and existing `dayStructure` numeric defaults kept untouched unless spec changes them.

### D. eco_ethicist (Mindful Voyager) full constraint (line 1305)
Augment existing record (already has `meaning`/`avoid`/`prefer`/baseline `dayStructure`):
- `dayStructure.pace: 'moderate'`
- `affinity: { high: [...], medium: [...], low: ['luxury experiences','all-inclusive resorts'], never: ['unethical wildlife tourism','sweatshop-sourced shopping'] }` (per spec)
- `timePreferences: { startTime: '08:30', peakEnergy: 'morning', preference: 'thoughtful_pacing' }`
- `diningPolicy: { michelinAllowed: false, preferLocal: true, minLocalShare: 0.8 }`
- Remove the TODO comment at line 1304.

## Out of scope (intentionally not touched)
- Slug rename `community_builder` → `purpose_voyager`. Spec parenthetical "(was community_builder)" matches earlier guidance ("keep slug, change category"). Slug stays; display name stays "The Purpose Voyager" (already the `identity` value).
- Wiring the new dayStructure ratios into `buildArchetypeConstraintsBlock` beyond what shows up via `meaning`. The data is captured; deeper prompt-builder changes are a follow-up.
- `experience-affinity.ts` — Mindful Voyager already has affinity there. We mirror to the definition without removing the runtime source.

## Verify
1. TypeScript compiles (interface additions are all optional).
2. `rg -n 'category: "Achiever"' supabase/functions/generate-itinerary/archetype-constraints.ts` — `community_builder` block now in results.
3. `rg -n 'category: "Explorer"' …` — `escape_artist` block now in results.
4. `rg -n 'requiresWaterDaily: true' …` returns the `beach_therapist` block.
5. `rg -n 'minLocalShare: 0.8' …` returns the `eco_ethicist` block.
6. All 7 `meaning` bodies contain the new opening sentence (spot-check via grep for distinctive phrases like "Compulsive traveler", "Treats vacation as a class", "Memory-maker", "Water is the identity", "Travels TO escape", "Collects destinations like trophies", "vacation but ALSO wants to understand").
7. Manual smoke test on a Mindful Voyager itinerary generation: confirm prompt context now carries `michelinAllowed: false` + chain-restaurant avoid list — by reading `getFullArchetypeContext('eco_ethicist')` output in a one-off Deno script and inspecting `definition.diningPolicy` and `definition.avoid`.
