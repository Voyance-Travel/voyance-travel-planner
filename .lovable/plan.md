

# ✅ COMPLETED: Fix Itinerary Customization - Single Source of Truth

## Summary

All three bugs have been fixed. The itinerary generation system now uses a single, unified path for all traveler data.

---

## Changes Made

### Bug 1: Fixed Column Reference in profile-loader.ts ✅

Replaced 5 instances of `travel_dna` with `travel_dna_v2`:
- Line 197: Priority 2 archetype fallback
- Line 315: Trait scores extraction
- Line 343: Interests extraction  
- Line 371: Dietary restrictions extraction
- Line 406: Mobility needs extraction

### Bug 2: Removed Dual Path in generate-day ✅

Removed lines 6399-6421 (legacy `getTravelDNAV2()` + `buildTravelDNAContext()` path).

**Before:**
```typescript
const travelDNA = userId ? await getTravelDNAV2(supabase, userId) : null;
const dnaResult = await buildTravelDNAContext(travelDNA, null, budgetTier, supabase, userId);
const preferenceContext = dnaResult.context + '\n' + basicPreferenceContext;
```

**After:**
```typescript
// All traveler data comes from loadTravelerProfile() at line 6821
const preferenceContext = basicPreferenceContext; // Only basic prefs, archetype/traits in generationHierarchy
```

### Bug 3: Removed Redundant Path in generate-full ✅

Removed lines 5319-5340 (legacy `getTravelDNAV2()` + `normalizeUserContext()` path).

**Before:**
```typescript
const travelDNA = userId ? await getTravelDNAV2(supabase, userId) : null;
const traitOverrides = userId ? await getTraitOverrides(supabase, userId) : null;
const normalizedContext = normalizeUserContext(travelDNA, traitOverrides, prefs, {...});
```

**After:**
```typescript
// All traveler data comes from unifiedProfile at line 5308
const budgetIntent = deriveBudgetIntent(
  context.budgetTier,
  unifiedProfile.traitScores.budget,
  unifiedProfile.traitScores.comfort
);
```

---

## Architecture After Fixes

```
┌─────────────────────────────────────────────────────────────────┐
│                    ITINERARY GENERATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. loadTravelerProfile()                                        │
│     ↓                                                            │
│     Returns: archetype, traitScores, avoidList, interests, etc.  │
│                                                                  │
│  2. buildFullPromptGuidance()                                    │
│     ↓                                                            │
│     Returns: Complete AI prompt with all constraints             │
│                                                                  │
│  3. AI Call (Gemini)                                             │
│     ↓                                                            │
│     Uses: SINGLE source of truth for traveler data               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Verification

Check edge function logs for:
1. `[profile-loader] ✓ Resolved archetype: X (source: canonical)` - Priority 1 works
2. `[generate-day] ✓ Profile loaded via unified loader` - Single path active
3. `[Stage 1.3] ✓ Profile loaded via unified loader` - generate-full uses unified path
4. No `balanced_story_collector` fallbacks for users with quiz data

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Ways to resolve archetype | 3+ | 1 |
| Column reference bugs | 5 | 0 |
| Conflicting prompt data | Possible | Impossible |
| Legacy getTravelDNAV2 calls | 2 | 0 |
| Legacy normalizeUserContext calls | 1 | 0 |
