
## Approach: deepening-day only

Plumb `secondaryArchetype` from the DNA row through to `assignDaysToArchetypes`. When the trip has middle-day slack, allocate up to one "Deepening" day per traveler whose secondary differs from their primary. No trait-math changes, no weighted blending. Entirely contained to the day-assignment + prompt path.

## Files & changes

### 1. `supabase/functions/_shared/dna-resolve.ts`
Extend `resolvePrimaryArchetype` (or add a sibling `resolveSecondaryArchetype`) so callers can pull `secondary_archetype_name` with the same fallback chain (canonical column → `travel_dna_v2.secondary_archetype_name` → null). Returns `{ archetype: string | null }` — null is a valid outcome.

### 2. `supabase/functions/generate-itinerary/profile-loader.ts`
- Add `secondaryArchetype: string | null` and `secondaryArchetypeContext: ArchetypeContext | null` to `TravelerProfile` (around the existing `archetype` / `archetypeContext` fields, ~lines 35–40).
- In STEP 3 (lines 209–243), after resolving primary, also resolve secondary via the new helper. If non-null and not equal to primary, build its `getFullArchetypeContext`. Otherwise leave both as null.
- Log: `[profile-loader] ✓ Secondary archetype: <name> (or "none")`.
- No change to interests/avoid extraction in this round (those still derive from primary only — secondary only influences day assignment).

### 3. `supabase/functions/generate-itinerary/group-archetype-blending.ts`
- `TravelerArchetype` (line 18): add `secondaryArchetype?: string | null`.
- `DayArchetypeAssignment` (existing): add a discriminator `kind?: 'group' | 'primary' | 'deepening'` and `travelerId?: string` so the prompt builder can distinguish a deepening day. Keep backwards-compatible defaults (treat missing `kind` as `'group'` or `'primary'` based on `primaryArchetype === 'group'`).
- Rewrite `assignDaysToArchetypes` (lines 283–325):
  1. If `travelers.length <= 1` and no traveler has a secondary, return `[]` (current behavior).
  2. Day 1 → `kind: 'group'`, theme "Arrival & Orientation".
  3. Last day (when `totalDays >= 2`) → `kind: 'group'`, theme "Departure & Last Experiences".
  4. Middle days = `[2 … totalDays - 1]`. Need `totalDays >= 3` for any non-group days.
  5. **Primaries first**: round-robin assign each traveler's primary to middle days in order, until either every traveler has at least one primary day or middle slots run out. (Primaries always win — never starved.)
  6. **Secondaries fill remaining**: any leftover middle days are filled with `kind: 'deepening'` rows, max 1 per traveler, only for travelers whose `secondaryArchetype` is set and ≠ primary. Prefer travelers in primary-traveler order. Prefer the middle of the trip first (use the splice-mid strategy from the user's sketch) so deepening days land between primary days, not adjacent to arrival/departure.
  7. Cap: never assign the same traveler two deepening days; never duplicate a (traveler, kind) pair beyond what the rotation permits.
  8. Each deepening assignment carries: `dayNumber`, `primaryArchetype: <secondary archetype id>`, `kind: 'deepening'`, `travelerId`, `theme: getArchetypeDayTheme(secondaryArchetype)`, `rationale: "Deepening day leaning toward <name>'s secondary identity (<formatted secondary>) — keep within the group's avoid list, but bias activity selection toward this archetype's affinity."`.
- `buildGroupBlendingPrompt` (line 421–): the existing line 438–439 already lists `dayAssignments` in the prompt. Update the formatter to render deepening days as e.g. `- Day 3: <theme> (Deepening — leaning toward <Traveler>'s secondary <Archetype>; primary's day-structure rules still apply)`. Add a short directive paragraph above the day list when any deepening day exists, instructing the model to bias that day's activities toward the secondary archetype's affinity while respecting all group avoid items and the daily structure of the day's traveler.
- Add a single log line: `[GroupBlend] Day assignments: P=<n> primary, D=<n> deepening, G=<n> group`.

### 4. `supabase/functions/generate-itinerary/action-generate-trip.ts`
- Around lines 370–378 where `travelersList` is built: pass `secondaryArchetype` for both owner (read from `tripProfile` once profile-loader exposes it) and each companion (read via the new resolver from the same `dna` row). Owner's secondary is null-safe; companions whose row lacks one stay null.
- No other changes here (trait blending math is untouched per scope).

### 5. (Out of scope, captured as TODO comment in code, not implemented)
- Server-side `blendTraitScores` still uses owner-50/companions-50. Add `// TODO(secondary-blend-v1.1): consider 0.3× secondary trait weighting once deepening-day signal is validated.` near line 513.

## Edge cases (explicit)

- **2-day trip**: only group days; deepening dropped silently. Prompt shows no deepening line.
- **Single traveler with secondary on a 4-day trip**: 1 group + 2 middle primary + 1 deepening day for their own secondary.
- **3 travelers, 5 days, all with secondaries**: middle days = 3. Primaries fill all 3 middle slots; **0 deepening days** (primaries always win). The prompt notes that secondaries were available but no slot remained.
- **2 travelers sharing the same secondary archetype**: only the first traveler in primary order gets the deepening day; the duplicate is skipped. Sentinel log: `[GroupBlend] Skipped duplicate secondary <archetype> for traveler <id>`.
- **Traveler whose secondary == primary**: secondary is ignored (already covered by their primary day).
- **Long trip (e.g. 8 days, 2 travelers each with secondary)**: middle = 6 → 2 primary days × 2 travelers = 4, then up to 2 deepening days fill the rest, then any remaining slots fall back to `kind: 'primary'` rotation (do NOT add second deepening per traveler).

## Verification

1. Snapshot a 5-day, 2-traveler fixture (Cultural Anthropologist + Foodie secondary; Adrenaline Architect + Wellness Devotee secondary):
   - Day 1: group
   - Day 2: primary (Cultural Anthropologist)
   - Day 3: primary (Adrenaline Architect)
   - Day 4: deepening (Foodie OR Wellness Devotee — first traveler's secondary)
   - Day 5: group
   - With 6 days, both deepening days appear.
2. 3-day trip → no deepening days.
3. Single-traveler 4-day trip with secondary → exactly 1 deepening day on day 2 or 3.
4. Two travelers sharing the same secondary → only 1 deepening day; second skipped with the sentinel log.
5. Generated prompt (inspect `enrichmentContext.groupBlendingPrompt`) contains "Deepening" wording + the directive paragraph when applicable; absent otherwise.
6. Existing 1-traveler trips and trips where neither traveler has a secondary produce identical day assignments to today (regression-safe).

No DB migration. No new edge function. All changes server-side in `generate-itinerary/` + one shared resolver helper.
