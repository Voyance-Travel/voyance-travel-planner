
# Plan: Activate Untapped Dynamic Features Without Breaking Current Setup

## Executive Summary

Yes, we can safely activate the untapped potential! The architecture was designed with graceful fallbacks. If dynamic features fail or return empty results, the system automatically continues with static guidance — which is what it's doing now.

---

## Current State vs. Target State

| Feature | Current | After Activation |
|---------|---------|------------------|
| Static archetype rules | ✅ Active | ✅ Unchanged |
| Experience affinity matrix | ✅ Active | ✅ Unchanged |
| Departure day logic | ✅ Active | ✅ Unchanged |
| Database attraction matching | ⏸️ Prepared, not wired | ✅ Active (graceful fallback) |
| AI-generated city guides | ⏸️ Prepared, not wired | ✅ Active (cached 90 days) |
| Attraction enrichment | ⏸️ Schema ready, 0 tagged | 🔄 Progressive enrichment |

---

## Why It's Safe

The `buildFullPromptGuidanceAsync` function is designed with a **layered fallback pattern**:

```text
1. Execute static guidance (ALWAYS works) ← Current behavior
2. TRY dynamic attraction matching
   └─ If fails: log warning, continue with static
3. TRY AI-generated destination guide
   └─ If fails: log warning, continue with static
4. Combine all sections that succeeded
```

**Worst case**: Dynamic features fail → System behaves exactly as it does today.
**Best case**: Dynamic features enhance the prompt with database matches and city-specific recommendations.

---

## Technical Changes Required

### 1. Add `buildFullPromptGuidanceAsync` to Imports (1 line)
Update the import block at line 87 to include the async version.

### 2. Add Destination ID Lookup Helper (15 lines)
Create a simple helper to resolve city name → UUID:

```typescript
async function getDestinationId(supabase: any, destination: string): Promise<string | null> {
  const { data } = await supabase
    .from('destinations')
    .select('id')
    .or(`city.ilike.%${destination}%,country.ilike.%${destination}%`)
    .limit(1);
  return data?.[0]?.id || null;
}
```

### 3. Wire Async Builder into `generate-full` (6 lines changed)
At Stage 1.99 (~line 6081), replace sync call with async:

```typescript
// Before
const generationHierarchy = buildFullPromptGuidance(...);

// After
const destinationId = await getDestinationId(supabase, context.destination);
const generationHierarchy = await buildFullPromptGuidanceAsync(
  supabase,
  unifiedProfile.archetype,
  context.destination,
  destinationId,
  effectiveBudgetTier,
  { pace: unifiedProfile.traitScores.pace, budget: unifiedProfile.traitScores.budget },
  LOVABLE_API_KEY
);
```

### 4. Wire Async Builder into `generate-day` (6 lines changed)
At ~line 7199, apply the same pattern.

---

## What Happens After Activation

### Immediate (No Attractions Tagged Yet)
- **Attraction matching**: Returns empty results (0 of 6,999 tagged) → Falls back to static
- **AI guide generation**: Generates on first request, caches for 90 days
- **Net effect**: Static + AI-generated destination guide (bonus!)

### After Batch Enrichment (Future)
- Once attractions are tagged, matching will return prioritized lists
- System will inject "PERFECT FOR THIS TRAVELER" sections with database-verified venues

---

## Progressive Enrichment Strategy (Optional, Future)

We can add "just-in-time" enrichment that tags attractions as they're needed:

1. When generating for a destination, check if attractions are tagged
2. If <10 are tagged, run enrichment for that destination first (background)
3. Next request benefits from enriched data

This avoids a large upfront batch job while gradually building the tagged corpus.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Async call adds latency | AI guide generation ~1-2s first time, then cached |
| Guide generation costs | ~$0.01 per new archetype × destination combo, amortized to zero |
| Database query errors | Try-catch with console warning, continues with static |
| Destination not in DB | Returns null, skips dynamic features gracefully |

---

## Files to Change

| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/index.ts` | Import async builder, add helper function, update 2 call sites |

**Total code changes**: ~35 lines
**Estimated time**: 15 minutes
**Risk level**: Low (all changes have fallbacks)

---

## Verification After Implementation

1. **Check logs** for new messages:
   - `[buildFullPromptGuidanceAsync] Added X matched attractions`
   - `[ArchetypeGuide] Cache hit for X × Y` or `Generating new guide`

2. **Test with Rome regeneration**:
   - First request: Should generate and cache guide
   - Second request: Should show "Cache hit"

3. **Verify fallback works**: If `destinationId` is null, logs should show static-only behavior

---

## Summary

This activation is **low-risk, high-reward**:
- Static rules continue working exactly as before
- Dynamic features layer on top when available
- AI-generated destination guides become immediately active (cached)
- Attraction matching becomes active as database gets enriched over time

No breaking changes. Same behavior floor, higher ceiling.
