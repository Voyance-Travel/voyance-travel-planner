

# Fix Itinerary Customization - Complete the Integration

## Problem Summary

The "Single Source of Truth" architecture was created but not fully wired up. Three bugs prevent customization from working:

| Bug | Location | Impact |
|-----|----------|--------|
| Dead column reference | `profile-loader.ts` lines 197, 315, 343, 371, 406 | Priority 2 fallback fails silently |
| Dual path conflict | `generate-day` action | System prompt and user prompt may give AI conflicting archetypes |
| Redundant legacy path | `generate-full` action | Two different resolution systems run in parallel |

---

## Root Cause Analysis

### Bug 1: Column `travel_dna` Does Not Exist

The `profile-loader.ts` references `travelDNA.travel_dna` in multiple places:
- Line 197: `(travelDNA.travel_dna as any)?.primary_archetype_name`
- Line 315: `(travelDNA.travel_dna as any)?.trait_scores`
- Line 343: `(travelDNA?.travel_dna as any)?.interests`
- Line 371: `(travelDNA?.travel_dna as any)?.dietary_restrictions`
- Line 406: `(travelDNA?.travel_dna as any)?.mobility_needs`

But the actual database columns in `travel_dna_profiles` are:
- `primary_archetype_name` (canonical, used by Priority 1)
- `trait_scores` (direct column)
- `travel_dna_v2` (JSON blob, NOT `travel_dna`)

**Fix**: Replace all `travel_dna` references with `travel_dna_v2`.

### Bug 2: Dual Path in generate-day

The `generate-day` handler does this:

```text
1. Line 6400-6421: Call getTravelDNAV2() → buildTravelDNAContext() → preferenceContext
2. Line 6821: Call loadTravelerProfile() → profile object
3. Line 6844: Use profile.archetype for generationHierarchy
4. Line 6889: Use preferenceContext (from step 1) in user prompt
```

The problem: `buildTravelDNAContext()` at line 6408 extracts archetypes using its own priority system which includes `inferArchetypesFromTraits()` fallback that doesn't exist in `loadTravelerProfile()`.

**Fix**: Remove the legacy `getTravelDNAV2()` + `buildTravelDNAContext()` path. Build `preferenceContext` from the unified profile instead.

### Bug 3: Redundant Path in generate-full

Similar pattern: both `loadTravelerProfile()` (line 5308) and `getTravelDNAV2()` (line 5320) are called, creating two parallel data sources.

**Fix**: Remove the legacy path. Use unified profile for all data.

---

## Technical Fix Plan

### Step 1: Fix profile-loader.ts Column Reference

Replace `travel_dna` with `travel_dna_v2` in all fallback paths:

```typescript
// Priority 2: travel_dna_v2 blob (was incorrectly referencing travel_dna)
else if ((travelDNA.travel_dna_v2 as any)?.primary_archetype_name) {
  archetype = (travelDNA.travel_dna_v2 as any).primary_archetype_name;
  archetypeSource = 'travel_dna_blob';
  dataCompleteness += 15;
}
```

Same fix for trait scores, interests, dietary restrictions, and mobility needs.

### Step 2: Remove Dual Path in generate-day

Remove lines 6400-6421 (legacy path) and replace `preferenceContext` usage with profile data:

```typescript
// Before (REMOVE):
const travelDNA = userId ? await getTravelDNAV2(supabase, userId) : null;
const dnaResult = await buildTravelDNAContext(travelDNA, null, budgetTier, ...);
const preferenceContext = dnaResult.context + '\n' + basicPreferenceContext;

// After (USE PROFILE):
// preferenceContext is already handled by generationHierarchy from unified profile
// Just keep basicPreferenceContext for interests/restrictions from userPrefs
```

### Step 3: Remove Redundant Path in generate-full

Remove the legacy `getTravelDNAV2()` + `normalizeUserContext()` path at lines 5320-5340 and use `unifiedProfile` data directly.

---

## Files to Modify

| File | Changes |
|------|---------|
| `profile-loader.ts` | Fix 6 `travel_dna` → `travel_dna_v2` references |
| `index.ts` (generate-day) | Remove ~25 lines of legacy path, use unified profile |
| `index.ts` (generate-full) | Remove ~25 lines of legacy path, use unified profile |

---

## Expected Results

After these fixes:

| Metric | Before | After |
|--------|--------|-------|
| Ways to resolve archetype | 3+ (profile loader, buildTravelDNAContext, inferFromTraits) | 1 (profile loader only) |
| Column reference bugs | 6 | 0 |
| Conflicting prompt data | Possible | Impossible |
| Data completeness score accuracy | Low (fails at Priority 2) | High |

---

## Verification

After implementation, check edge function logs for:
1. `[profile-loader] ✓ Resolved archetype: X (source: canonical)` - confirms Priority 1 works
2. No `balanced_story_collector` fallbacks for users with quiz data
3. Single archetype name appearing in both system and user prompts

