
# Audit Report: Why Customization Still Doesn't Work

## Executive Summary

After a deep technical audit of the implemented changes, I found that while the new unified modules (`profile-loader.ts` and `archetype-data.ts`) were created correctly, **the `generate-day` action handler is NOT using the new `loadTravelerProfile()` function**. This means the "Single Source of Truth" architecture is only partially implemented.

---

## What Was Built Correctly

| Module | Status | Notes |
|--------|--------|-------|
| `profile-loader.ts` | ✅ Created | Correct archetype resolution logic, trait normalization, avoid list extraction |
| `archetype-data.ts` | ✅ Created | Merges all archetype data, provides `getFullArchetypeContext()` |
| Imports in `index.ts` | ✅ Added | Both new modules are imported at lines 104-138 |
| `buildAllConstraints()` | ✅ Called | Injected into system prompt at line 6878 |
| `buildExperienceGuidancePrompt()` | ✅ Called | Injected at line 6898 |
| `buildDestinationGuidancePrompt()` | ✅ Called | Injected at line 6901 |

---

## Critical Issue: The New Profile Loader Is NOT Being Used

### The Problem

The `generate-day` handler (lines 6251-7200) still uses the **old manual resolution logic** instead of calling `loadTravelerProfile()`:

```typescript
// Lines 6839-6859 - OLD CODE STILL IN USE
const primaryArchetype = 
  travelDNA?.primary_archetype_name ||
  (travelDNA?.travel_dna as any)?.primary_archetype_name ||
  // ... more manual checks
  'balanced_story_collector';

const traitScores = travelDNA?.trait_scores || 
                    travelDNA?.travel_dna_v2?.trait_scores ||
                    // ... more manual checks
```

### What Should Happen

```typescript
// CORRECT - Using unified profile loader
const profile = await loadTravelerProfile(supabase, userId, tripId, destination);
const primaryArchetype = profile.archetype;        // Guaranteed correct
const traitScores = profile.traitScores;           // Guaranteed normalized
const avoidList = profile.avoidList;               // Includes archetype avoid list
```

---

## Why This Matters

The manual resolution code works differently than the unified loader in subtle but critical ways:

| Behavior | Manual Resolution (Current) | Unified Loader (Correct) |
|----------|---------------------------|------------------------|
| Archetype extraction | Checks 4 sources, may miss canonical column | Clear 4-step priority with logging |
| Trait score normalization | Uses raw values, may miss synonyms | Normalizes `travel_pace` → `pace`, `value_focus` → `budget` |
| Avoid list | Only archetype definition | Merges user avoid list + archetype avoid list + affinity never list |
| Error handling | Silent fallback | Explicit warnings in `profile.warnings[]` |
| Logging | Partial | Full resolution source tracking (`profile.archetypeSource`) |

---

## Secondary Issues Found

### 1. `profile-loader.ts` Has a Circular Dependency Risk

The `profile-loader.ts` imports from `archetype-data.ts`:
```typescript
import { getFullArchetypeContext, type ArchetypeContext } from './archetype-data.ts';
```

And `archetype-data.ts` imports from `archetype-constraints.ts`:
```typescript
import { getArchetypeDefinition, buildAllConstraints, ... } from './archetype-constraints.ts';
```

This works but creates a 3-level import chain. If any module fails to load, the entire chain breaks.

### 2. Trait Score Field Name Mismatch

The database stores `travel_pace` but the constraint builder expects `pace`. The `profile-loader.ts` correctly handles this:
```typescript
pace: Number(rawScores.pace ?? rawScores.travel_pace ?? 0),
```

But the old manual code in `generate-day` does this:
```typescript
pace: traitScores.pace || traitScores.travel_pace || 0,  // Line 6882
```

The difference: `??` handles `0` correctly (falsy but valid), while `||` treats `0` as falsy and falls through. If `pace = 0`, the old code ignores it.

### 3. The Unified Prompt Builder `buildFullPromptGuidance()` Is Not Used

We created `buildFullPromptGuidance()` in `archetype-data.ts` (lines 242-295) which assembles all constraint blocks in the correct order with the generation hierarchy. But the `generate-day` handler manually builds this same structure (lines 6904-6951).

---

## What Needs to Be Fixed

### Phase 2: Complete the Integration (Required)

The `generate-day` action handler needs to be refactored to use the new modules:

**Current flow (600+ lines):**
```
1. Load travelDNA manually
2. Extract archetype manually (with bugs)
3. Extract traitScores manually (with bugs)
4. Build constraints
5. Build prompt
6. Call AI
```

**Target flow (50 lines):**
```
1. loadTravelerProfile() → unified profile object
2. getFullArchetypeContext() → all archetype data
3. buildFullPromptGuidance() → complete constraint block
4. Build prompt with unified data
5. Call AI
```

---

## Verification Needed Before Fixing

To confirm this analysis, we need to check the edge function logs during a real generation. The current logging should show:

1. `[generate-day] ✓ Resolved archetype: flexible_wanderer from DNA sources`
2. `[generate-day] Constraints built: XXXX chars, archetype=flexible_wanderer`

If you're seeing `balanced_story_collector` in the logs, it confirms the archetype extraction is failing.

---

## Estimated Fix Effort

| Task | Effort | Risk |
|------|--------|------|
| Replace manual resolution with `loadTravelerProfile()` | 1-2 hours | Low |
| Replace manual constraint building with `buildFullPromptGuidance()` | 1 hour | Low |
| Remove 500+ lines of redundant code | 30 min | Medium (must be careful) |
| Testing | 1-2 hours | - |
| **Total** | **4-5 hours** | - |

---

## Recommendation

The implementation is 70% complete. The constraint modules are correctly built and integrated, but the data feeding into them is still coming from the buggy manual resolution code. 

**Next Step:** Complete Phase 2 by replacing the manual resolution in `generate-day` with calls to `loadTravelerProfile()`.

