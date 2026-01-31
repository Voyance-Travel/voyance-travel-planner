

# Simplifying the Itinerary Generation System

## The Problem: 14 Modules, 8,000+ Lines, Multiple Failure Points

The current system has grown organically into an overly complex architecture with:

| Module | Lines | Purpose | Status |
|--------|-------|---------|--------|
| `index.ts` | 8,220 | Main orchestrator + duplicate logic | BLOATED |
| `archetype-constraints.ts` | 1,984 | 27 archetype definitions + avoid lists | OK |
| `experience-affinity.ts` | 501 | What to prioritize per archetype | OK |
| `destination-guides.ts` | 463 | City × archetype recommendations | OK |
| `personalization-enforcer.ts` | 957 | Forced slots, schedule math | REDUNDANT |
| `prompt-library.ts` | 1,466 | Another prompt builder | REDUNDANT |
| `truth-anchors.ts` | ??? | Venue verification | RARELY USED |
| `explainability.ts` | ??? | Why explanations | OPTIONAL |
| `cold-start.ts` | ??? | Fallback handling | REDUNDANT |
| `feedback-instrumentation.ts` | ??? | Learning from swaps | UNUSED |
| `geographic-coherence.ts` | ??? | Zone optimization | OPTIONAL |
| `destination-essentials.ts` | ??? | Must-see landmarks | PARTIAL |
| `destination-enrichment.ts` | ??? | DB enrichment | UNUSED |
| `golden-personas.ts` | ??? | Test personas | DEV ONLY |

**Root causes of failure:**
1. **Two code paths** (generate-day vs generateSingleDayWithRetry) that drifted apart
2. **14 imports** that create a fragile chain - one broken link = generic output
3. **4 different places** to look for archetype (all with different priorities)
4. **3 different trait score formats** (trait_scores, travel_dna.trait_scores, travel_dna_v2.trait_scores)
5. **Validation happening too late** (after generation, not during prompt building)

---

## Proposed Solution: "Single Source of Truth" Architecture

### Core Principle
**One unified prompt builder. One data fetcher. One archetype resolver. Zero redundancy.**

### New Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    generate-itinerary/index.ts                  │
├─────────────────────────────────────────────────────────────────┤
│  1. loadTravelerProfile()  ← SINGLE function, returns unified   │
│                               object or fails with clear error  │
│                                                                 │
│  2. buildPrompt()          ← SINGLE function, takes profile +   │
│                               trip, returns system + user       │
│                                                                 │
│  3. generateDay()          ← SINGLE AI call, no retries needed  │
│                               if prompt is correctly built      │
└─────────────────────────────────────────────────────────────────┘

                              ↓ imports only

┌─────────────────────────────────────────────────────────────────┐
│              archetype-data.ts (MERGED MODULE)                  │
├─────────────────────────────────────────────────────────────────┤
│  - ARCHETYPE_DEFINITIONS (identity, meaning, avoid, dayStructure)
│  - EXPERIENCE_AFFINITY (high/medium/low/never per archetype)    │
│  - TIME_PREFERENCES (start/end times)                           │
│  - ENVIRONMENT_PREFERENCES (indoor/outdoor, crowds)             │
│  - PHYSICAL_INTENSITY (walking hours)                           │
│  - DESTINATION_GUIDES (city × archetype, lazily loaded)         │
│                                                                 │
│  One function: getFullArchetypeContext(archetype, destination)  │
│  Returns: EVERYTHING needed for prompt in one object            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Plan

### Phase 1: Create Unified Traveler Profile Loader

Create a single function that resolves all data sources into one canonical object:

```typescript
// profile-loader.ts (NEW - ~150 lines)

interface TravelerProfile {
  // Canonical fields - ONE source of truth
  archetype: string;              // NEVER null, always resolved
  archetypeDefinition: {...};     // Full definition, pre-fetched
  traitScores: {
    pace: number;
    budget: number;
    // ... all traits with defaults of 0
  };
  budgetTier: 'budget' | 'moderate' | 'premium' | 'luxury';
  interests: string[];
  dietaryRestrictions: string[];
  avoidList: string[];
  mobilityNeeds: string;
  
  // Resolution metadata
  dataCompleteness: number;       // 0-100, for logging
  resolvedFrom: string;           // For debugging
}

async function loadTravelerProfile(userId: string, tripId: string): Promise<TravelerProfile> {
  // 1. Load travel_dna_profiles row
  // 2. Load trip row for budget tier
  // 3. Resolve archetype with CLEAR priority:
  //    a. profile.primary_archetype_name (canonical)
  //    b. profile.travel_dna.primary_archetype_name
  //    c. 'balanced_story_collector' + log warning
  // 4. Resolve traits with defaults
  // 5. Return unified object
  // 
  // NO FALLBACKS IN THE REST OF THE CODE - this function handles ALL resolution
}
```

### Phase 2: Merge Archetype Data Modules

Combine `archetype-constraints.ts`, `experience-affinity.ts`, and `destination-guides.ts` into one:

```typescript
// archetype-data.ts (MERGED - ~2500 lines, was 3000 across 3 files)

export function getFullArchetypeContext(
  archetype: string,
  destination?: string
): ArchetypeContext {
  return {
    definition: ARCHETYPE_DEFINITIONS[archetype],
    affinity: EXPERIENCE_AFFINITY[archetype],
    timePrefs: TIME_PREFERENCES[archetype],
    envPrefs: ENVIRONMENT_PREFERENCES[archetype],
    intensity: PHYSICAL_INTENSITY[archetype],
    destinationGuide: destination ? getDestinationGuide(destination, archetype) : null,
    
    // Pre-built prompt blocks (cached)
    promptBlocks: {
      identity: buildIdentityBlock(archetype),
      constraints: buildConstraintsBlock(archetype),
      affinity: buildAffinityBlock(archetype),
      destinationGuide: destination ? buildDestinationBlock(destination, archetype) : ''
    }
  };
}
```

### Phase 3: Simplify the Main Handler

Replace the 500+ line `generate-day` action with:

```typescript
// In index.ts (reduced from 8220 lines to ~3000)

case 'generate-day': {
  // 1. Load profile (ONE function, never fails silently)
  const profile = await loadTravelerProfile(userId, tripId);
  console.log(`[generate-day] Profile loaded: archetype=${profile.archetype}, completeness=${profile.dataCompleteness}%`);
  
  // 2. Get archetype context (ONE function, all data)
  const archetypeContext = getFullArchetypeContext(profile.archetype, destination);
  
  // 3. Build prompt (ONE function, uses profile + context)
  const { systemPrompt, userPrompt } = buildDayPrompt({
    profile,
    archetypeContext,
    dayNumber,
    totalDays,
    date,
    destination,
    previousActivities,
    flightData,
    hotelData
  });
  
  // 4. Generate (ONE AI call)
  const day = await callAI(systemPrompt, userPrompt);
  
  return { day };
}
```

### Phase 4: Delete Redundant Modules

**DELETE entirely:**
- `personalization-enforcer.ts` - Absorbed into profile loader
- `cold-start.ts` - Handled in profile loader
- `feedback-instrumentation.ts` - Unused
- `destination-enrichment.ts` - Unused

**KEEP but simplify:**
- `destination-essentials.ts` - Keep for must-see landmarks
- `geographic-coherence.ts` - Optional, run after generation
- `truth-anchors.ts` - Optional, for venue verification

**MERGE:**
- `archetype-constraints.ts` + `experience-affinity.ts` + `destination-guides.ts` → `archetype-data.ts`
- `prompt-library.ts` - Absorb useful parts into main index.ts

---

## What This Solves

| Problem | Solution |
|---------|----------|
| Archetype extracted from wrong field | ONE resolution function with clear priority |
| Constraints not applied | Prompt built from unified context, never missing |
| Two code paths diverging | ONE generation function for all cases |
| Silent fallbacks | Explicit logging at profile load time |
| 14 imports with fragile chain | 3 imports: profile-loader, archetype-data, AI caller |
| 8000+ lines in main file | ~3000 lines with clear sections |
| Redundant modules | Deleted or merged |

---

## Migration Strategy

1. **Create new modules** alongside old ones (no breaking changes)
2. **Add feature flag** `USE_SIMPLIFIED_PIPELINE=true`
3. **Test with one user** - compare outputs
4. **Gradual rollout** - 10% → 50% → 100%
5. **Delete old code** once new pipeline is proven

---

## Estimated Effort

| Task | Time |
|------|------|
| Create `profile-loader.ts` | 2-3 hours |
| Create merged `archetype-data.ts` | 3-4 hours |
| Refactor `generate-day` action | 3-4 hours |
| Delete redundant modules | 1 hour |
| Testing | 2-3 hours |
| **Total** | **12-15 hours** |

---

## Before/After Comparison

**Before (current):**
```
14 modules → Complex import chain → Multiple resolution paths → Silent failures → Generic output
```

**After (simplified):**
```
3 modules → Single profile loader → Single archetype context → Explicit errors → Personalized output
```

**The key insight:** Customization doesn't require complexity. It requires **a single source of truth** that never fails silently.

