

## Fix 22A: Schema-Driven Generation — Data Foundation

### Overview
Create the foundational data layer for the new schema-driven generation system: TypeScript interfaces, pattern group configs, archetype-to-group mapping, a new `pattern_group` column on profiles, and wiring it into the DNA save flow.

### Critical Discovery: Archetype Name Format
The prompt's mapping uses **display names** (e.g., "The Bucket List Conqueror"), but the database stores **snake_case IDs** (e.g., `bucket_list_conqueror`) in `primary_archetype_name`. The mapping must use IDs, not display names. Additionally, some display names in the prompt don't match the actual codebase (e.g., `bucket_list_conqueror` displays as "The Milestone Voyager", not "The Bucket List Conqueror"). The mapping will use the canonical IDs from `getArchetypeDisplayName()` in `quizMapping.ts`.

### New Files (3)

**1. `src/types/schema-generation.ts`**
All interfaces as specified: `DaySchema`, `DaySlot`, `PatternGroupConfig`, `DayConstraints`, `SlotTimeWindow`, `SlotFilledData`, `TravelerRef`, `DayGenerationLog`, `SlotValidation`, `SlotOverride`, plus all type unions (`DayType`, `PatternGroup`, `MealWeight`, `SlotType`, `SlotStatus`, `MealType`, `FilledSource`). Zero imports from existing code.

**2. `src/config/pattern-group-configs.ts`**
Five config objects (PACKED, SOCIAL, BALANCED, INDULGENT, GENTLE) exactly as specified, plus `PATTERN_GROUP_CONFIGS` lookup map and `getPatternGroupConfig()` helper. Imports only from `@/types/schema-generation`.

**3. `src/config/archetype-group-mapping.ts`**
Mapping using **snake_case IDs** (matching what's stored in `travel_dna_profiles.primary_archetype_name`):

| Group | Archetype IDs |
|-------|--------------|
| packed | `bucket_list_conqueror`, `adrenaline_architect`, `urban_nomad` |
| social | `social_butterfly`, `gap_year_graduate`, `digital_explorer` |
| balanced | `balanced_story_collector`, `midlife_explorer`, `eco_ethicist`, `history_hunter`, `art_aficionado`, `collection_curator`, `sabbatical_scholar`, `community_builder`, `status_seeker`, `cultural_anthropologist` |
| indulgent | `culinary_cartographer`, `luxury_luminary`, `romantic_curator` |
| gentle | `slow_traveler`, `flexible_wanderer`, `zen_seeker`, `retreat_regular`, `beach_therapist`, `sanctuary_seeker`, `healing_journeyer`, `retirement_ranger`, `family_architect`, `wilderness_pioneer`, `escape_artist`, `story_seeker`, `explorer` |

Includes `getPatternGroupForArchetype()` with case-insensitive fallback and `getArchetypesInGroup()` utility. Default fallback: `'balanced'`.

Note: `escape_artist`, `story_seeker`, and `explorer` were missing from the prompt's mapping. Based on their behavioral profiles (escape_artist = stress relief/low intensity → gentle; story_seeker = local narratives → gentle; explorer = general → gentle), they're assigned to gentle/balanced respectively.

### Database Migration
Single migration adding the `pattern_group` column and backfilling existing profiles:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pattern_group TEXT DEFAULT NULL;
-- Backfill using snake_case IDs (what's actually stored)
UPDATE profiles SET pattern_group = 'packed' WHERE ... AND pattern_group IS NULL;
-- (all 5 groups, then catch-all to 'balanced')
```

### Changes to Existing File

**`src/utils/quizMapping.ts`** — Two minimal additions:

1. **Line ~1046** (quiz completion save): Add `pattern_group` to the existing `profiles.update()` call:
```typescript
import { getPatternGroupForArchetype } from '@/config/archetype-group-mapping';
// ...
.update({
  quiz_completed: true,
  travel_dna: travelDnaJson,
  pattern_group: getPatternGroupForArchetype(dna.primary_archetype_name || ''),
})
```

2. **Line ~1326** (recalculateDNAFromPreferences save): Add `pattern_group` to the existing `profiles.update()` call:
```typescript
.update({
  travel_dna: travelDnaJson,
  pattern_group: getPatternGroupForArchetype(dna.primary_archetype_name || ''),
})
```

### No Other Changes
- No modifications to generate-itinerary or any edge function
- No React component changes
- No new API endpoints or triggers

