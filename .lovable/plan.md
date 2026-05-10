
## Goal
Update 9 archetype definitions in the registry to use the new traits (`experience_accumulation`, `social_sharing`, `collection_drive`, `escape_need`, `autonomy_preference`) and apply identity changes per spec.

## Where edits land
All archetype profiles live in `src/config/quiz-questions-v3.json` under `archetypeProfiles` (not in `archetype-matcher.ts` — the matcher reads from the JSON). Categories use UPPERCASE in this file (`ACHIEVER`, `EXPLORER`, `RESTORER`, `CONNECTOR`, `TRANSFORMER`) — I'll keep that convention; spec's lowercase is normalized to existing casing.

## Schema notes
- `required` is an AND-gate (every key must pass). For Purpose Voyager's `experience_accumulation OR bucket_list`, I'll add a new `requiredAny: [{trait, min}, ...]` field and extend the matcher's gate-check loop (lines ~247–280 in `archetype-matcher.ts`) to satisfy if any one entry passes. Single, additive change to the matcher; existing `required` AND-logic untouched.
- Penalties use `{ above|below, weight }`. "Apply −X if trait < Y" → `{ below: Y, weight: -X }`.

## Edits

### 1. `community_builder` (Purpose Voyager) — lines 1578–1595
- `category`: `CONNECTOR` → `ACHIEVER`
- `required`: remove `ethics_focus` and `cultural_depth`
- `requiredAny`: `[{experience_accumulation: 0.6}, {bucket_list: 0.6}]` (NEW field)
- `boosters`: drop `ethics_focus`/`cultural_depth` boosters, add `social_sharing: 0.4`, keep `experience_accumulation`/`bucket_list` boosters reasonable (1.0/0.8)

### 2. `collection_curator` (Passport Collector) — lines 1634–1649
- `required`: replace `niche_interest ≥ 0.7` with `collection_drive ≥ 0.6` AND `novelty_seeking ≥ 0.5`
- `boosters`: drop `niche_interest: 2.0`; add `collection_drive: 1.5`, `novelty_seeking: 1.0`, `bucket_list: 0.5`, keep `niche_interest: 0.4` as soft booster, keep `planning: 0.6`

### 3. `escape_artist` — lines 1952–1969
- `category`: `RESTORER` → `EXPLORER`
- `required`: replace `restoration_need ≥ 0.5` + `novelty_seeking ≥ 0.5` with `autonomy_preference ≥ 0.7`
- `boosters`: `autonomy_preference: 1.5`, `pace: 0.6`, `adventure: 0.5`, keep `flexibility: 0.8`

### 4. `retreat_regular` (Wellness Devotee) — lines 1691–1708
- `required`: `escape_need ≥ 0.6` AND `restoration_need ≥ 0.6` (drop `planning ≥ 0.4`)
- `boosters`: `escape_need: 1.2`, `restoration_need: 1.5`, `healing_focus: 0.5`, `food_focus: 0.4`, `spirituality: 0.4`

### 5. `wilderness_pioneer` — lines 1475–1492
- Keep `required`: `nature_orientation ≥ 0.7` AND `adventure ≥ 0.5` (already correct)
- Add penalty: `nature_orientation: { below: 0.5, weight: -1.0 }`

### 6. `adrenaline_architect` — lines 1615–1633
- Keep `required`: `adventure ≥ 0.7` AND `pace ≥ 0.6` (already correct)
- `boosters`: drop `nature_orientation: 0.6` (environment-agnostic per spec); keep adventure/pace/morning_energy

### 7. `healing_journeyer` (Restoration Seeker) — lines 1875–1891
- `required`: `healing_focus ≥ 0.7` → `≥ 0.6`
- `boosters`: ensure `restoration_need: 0.5` (currently 1.0 — spec says 0.5 weight; lowering)

### 8. `cultural_anthropologist` — lines 1435–1453
- `required`: keep `cultural_depth ≥ 0.7`; change `learning_focus { min: 0.5 }` → `{ min: 0.5, max: 0.7 }`
- Add penalty: `learning_focus: { above: 0.8, weight: -1.5 }`

### 9. `sabbatical_scholar` (Immersion Seeker) — lines 1856–1874
- Already matches spec (`learning_focus ≥ 0.7`, `cultural_depth ≥ 0.5`, `planning ≥ 0.4`). No-op, verify only.

## Matcher change (small, additive)
`src/services/engines/travelDNA/archetype-matcher.ts` — extend `ArchetypeProfile` with optional `requiredAny?: Array<Record<string, TraitRequirement>>`. In the gate loop (~line 247), after existing `required` AND-check, if `requiredAny` present, set `requiredMet = requiredMet && requiredAny.some(group => every key meets)`. Add matched entries to `matchedRequirements`. Single ~10-line insert.

## Verify
1. `JSON.parse` succeeds on the file.
2. `grep -c "experience_accumulation\|social_sharing\|collection_drive\|escape_need\|autonomy_preference" src/config/quiz-questions-v3.json` increases.
3. No archetype still references the removed gates: `rg '"ethics_focus".*min.*0\.6' src/config/quiz-questions-v3.json` returns nothing in `community_builder` block; `rg '"niche_interest".*min' …` returns nothing in `collection_curator`.
4. Synthetic matcher tests (run via a one-off `bun` script):
   - `{experience_accumulation: 0.7, social_sharing: 0.5}` → primary = `community_builder`, category `ACHIEVER`
   - `{collection_drive: 0.7, novelty_seeking: 0.6}` → primary = `collection_curator`
   - `{autonomy_preference: 0.8, pace: 0.7}` → primary = `escape_artist`, category `EXPLORER`
