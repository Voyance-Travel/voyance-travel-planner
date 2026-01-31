

# Deep Audit: Why Itinerary Generation Produces Identical Outputs

## Summary of Findings

After a comprehensive code audit, the situation is **more nuanced than a simple missing import**. The constraint system IS wired correctly, but there are **multiple potential failure points** that could cause the AI to ignore the constraints.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  /start → /trip/:id?generate=true → ItineraryGenerator                      │
│            ↓                                                                │
│  useItineraryGeneration.generateItinerary()                                 │
│            ↓                                                                │
│  generateItineraryProgressive() ←── TRIES FIRST (always)                    │
│            ↓                                                                │
│  supabase.functions.invoke('generate-itinerary', {action: 'generate-day'})  │
└─────────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EDGE FUNCTION FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Load Travel DNA (getTravelDNAV2)                                        │
│  2. Build Travel DNA Context (buildTravelDNAContext)                        │
│  3. Extract archetype (lines 6828-6831)                                     │
│  4. Build constraints:                                                      │
│     - buildAllConstraints()                                                 │
│     - buildExperienceGuidancePrompt()                                       │
│     - buildDestinationGuidancePrompt()                                      │
│  5. Assemble generationHierarchy (lines 6856-6904)                          │
│  6. Build systemPrompt + userPrompt                                         │
│  7. Call Lovable AI Gateway (google/gemini-3-flash-preview)                 │
│  8. Parse and return day                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Issue #1: No Logging Confirms Constraints Are Sent

**Problem**: There is no log statement that confirms the full constraint block is actually being injected into the prompt sent to the AI.

**Evidence**:
- Line 6833 logs: `[generate-day] Building constraints for archetype: ${primaryArchetype}`
- But there's **no log of the actual constraints built** or their length
- We cannot verify from logs if `buildAllConstraints()` returned empty or full content

**Fix**: Add diagnostic logging to confirm the constraint content.

---

## Issue #2: Archetype Extraction May Fail Silently

**Problem**: If Travel DNA is missing or the archetype path fails, it falls back to `'balanced_story_collector'` without explicit warning.

**Code at lines 6828-6830**:
```typescript
const archetypeMatches = travelDNA?.archetype_matches || travelDNA?.travel_dna_v2?.archetype_matches;
const primaryArchetype = Array.isArray(archetypeMatches) ? archetypeMatches[0]?.name : 'balanced_story_collector';
```

**Problem Details**:
- This doesn't check `travelDNA?.travel_dna?.primary_archetype_name` (the canonical column)
- Database shows `primary_archetype_name = 'flexible_wanderer'` directly on the row, but this code looks for `archetype_matches` which is NULL for many users
- Result: Falls back to `balanced_story_collector` which has **no strong constraints**

**Database Evidence**:
```
user_id: 2c87e477-... 
primary_archetype_name: flexible_wanderer    ← CORRECT VALUE
archetype_matches_json: <nil>                 ← NULL!
v2_archetypes: <nil>                          ← NULL!
```

**This is the root cause.** The code looks in the wrong place for the archetype.

---

## Issue #3: `getArchetypeDefinition` Has a Permissive Fallback

**Problem**: If archetype is undefined or not in the dictionary, it returns `DEFAULT_DEFINITION` which is very permissive.

```typescript
// archetype-constraints.ts - DEFAULT_DEFINITION
const DEFAULT_DEFINITION: ArchetypeDefinition = {
  identity: "The Balanced Story Collector",
  category: "Transformer",
  meaning: `A balanced traveler with no strong extremes...`,
  avoid: ['Extreme luxury', 'Extreme budget', 'Extreme pacing'],
  dayStructure: {
    maxScheduledActivities: 5,  // ← High limit
    spaOK: true,                // ← Spa allowed
    michelinOK: false,          // ← But Michelin not blocked
    // ...
  }
};
```

This explains why spa and Michelin keep appearing - if the archetype extraction fails, it falls back to a profile that permits luxury.

---

## Issue #4: `buildTravelDNAContext` Returns Empty Context

**Problem at line 6415**:
```typescript
const dnaResult = await buildTravelDNAContext(travelDNA, null, budgetTier, supabase, userId);
const travelDNAContext = dnaResult.context;
```

If `travelDNA` is null (user not logged in, or DNA not found), `buildTravelDNAContext` returns `{ context: '', budgetIntent: null }` at line 2659.

**Downstream Impact**: The `preferenceContext` at line 6428 becomes just `basicPreferenceContext`, which doesn't include archetype constraints.

---

## Issue #5: `itinerary_activities` Table Has Zero Rows

**Database Query Results**:
```
total: 0, locked_true: 0, locked_false: 0
```

The `itinerary_activities` table is EMPTY. This means:
1. Activities are being saved only to `trips.itinerary_data` (JSON blob)
2. The normalized table isn't being populated
3. Locked activity detection may be broken for regeneration

---

## Issue #6: Budget Trait Score Not Being Normalized Correctly

**Database shows**:
```
user_id: 2c87e477-...
trait_scores_json: {"pace": -5.7, "budget": 0, ...}
```

A budget score of `0` lands in the "moderate" zone per `buildBudgetConstraints`:
```typescript
if (tier === 'budget' || budgetScore >= 3) { // VALUE-FOCUSED
  return `DOES NOT WANT: Michelin, Spa...`
}
```

With `budgetScore: 0`, this condition is FALSE, so the user gets moderate budget constraints (allows splurges).

---

## Technical Solution

### Fix 1: Correct Archetype Extraction in `generate-day`

Update lines 6828-6831 to check the canonical column FIRST:

```typescript
// Current (BROKEN):
const archetypeMatches = travelDNA?.archetype_matches || travelDNA?.travel_dna_v2?.archetype_matches;
const primaryArchetype = Array.isArray(archetypeMatches) ? archetypeMatches[0]?.name : 'balanced_story_collector';

// Fixed:
const primaryArchetype = 
  // 1. Check canonical column directly on profile
  travelDNA?.primary_archetype_name ||
  // 2. Check travel_dna blob (where quiz results are stored)
  (travelDNA?.travel_dna as any)?.primary_archetype_name ||
  // 3. Check v2 structure
  (Array.isArray(travelDNA?.travel_dna_v2?.archetype_matches) 
    ? travelDNA.travel_dna_v2.archetype_matches[0]?.name 
    : null) ||
  // 4. Check legacy archetype_matches
  (Array.isArray(travelDNA?.archetype_matches) 
    ? travelDNA.archetype_matches[0]?.name 
    : null) ||
  // 5. Fallback
  'balanced_story_collector';

console.log(`[generate-day] Resolved archetype: ${primaryArchetype} from DNA sources`);
```

### Fix 2: Add Diagnostic Logging

Add logging after building constraints to verify they're populated:

```typescript
const comprehensiveConstraints = buildAllConstraints(primaryArchetype, budgetTier, {...});
console.log(`[generate-day] Constraints built: ${comprehensiveConstraints.length} chars, archetype=${primaryArchetype}`);
console.log(`[generate-day] Constraint preview: ${comprehensiveConstraints.substring(0, 200)}...`);
```

### Fix 3: Log Full Prompt Length

Before calling the AI, log the total prompt size:

```typescript
console.log(`[generate-day] System prompt: ${systemPrompt.length} chars, User prompt: ${userPrompt.length} chars`);
```

### Fix 4: Use Trip's Budget Tier from DB

The frontend passes `budgetTier` from the trip, but verify it's being read correctly:

```typescript
// After loading trip data
console.log(`[generate-day] Trip budget tier from params: ${budgetTier}`);
```

### Fix 5: Fail-Safe Archetype Validation

If archetype is still balanced_story_collector after all checks, log a warning:

```typescript
if (primaryArchetype === 'balanced_story_collector') {
  console.warn(`[generate-day] ⚠️ Using fallback archetype. Travel DNA may be missing or incomplete for user ${userId}`);
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/index.ts` | Fix archetype extraction at lines 6828-6831, add diagnostic logging |

---

## Verification Steps

After deployment:
1. Create a NEW trip (to avoid cached data)
2. Check edge function logs for:
   - `[generate-day] Resolved archetype: flexible_wanderer from DNA sources`
   - `[generate-day] Constraints built: XXXX chars`
   - `[generate-day] Constraint preview: === ARCHETYPE IDENTITY: The Flexible Wanderer...`
3. Verify generated itinerary has:
   - Max 2-3 activities
   - No spa, no Michelin
   - Unscheduled exploration blocks

