

# Fix DNA Integration Gaps in Itinerary Generation

## Problems Identified

1. **Blended DNA not used for generation** — Stage 1.2.1 computes `blendedDnaSnapshot` with blended trait scores, but Stage 1.3's `loadTravelerProfile` only loads the **owner's** profile. All downstream personalization (forced slots, schedule constraints, budget intent, prompt building) uses `unifiedProfile.traitScores` — the owner's solo DNA. The blended traits are only saved to the trip record, never fed into the engine.

2. **`transformation` trait dropped** — `personalization-enforcer.ts` defines `transformation` in its `TraitScores` interface and uses it for wellness slots. But `profile-loader.ts` doesn't include `transformation` in its `TraitScores` type, so line 5170 hardcodes `transformation: 0`. Users with high transformation scores never get wellness/spa forced slots.

3. **Three separate blending implementations** — `src/utils/dnaBlending.ts` (client), `group-archetype-blending.ts` (backend), and inline code in `index.ts` lines 4474-4500. They can diverge.

## Plan

### Fix 1: Feed blended traits into the generation pipeline

**File: `supabase/functions/generate-itinerary/index.ts`**

After Stage 1.2.1 computes `blendedDnaSnapshot` and before Stage 1.3's `loadTravelerProfile`, add logic so that when blended traits exist, we override the trait scores used downstream:

- After line ~4530 (where `unifiedProfile` is loaded), add a merge step:
  ```
  if (context.blendedDnaSnapshot?.blendedTraits) {
    // Override owner-only traits with blended group traits
    for (const [key, value] of Object.entries(context.blendedDnaSnapshot.blendedTraits)) {
      if (key in unifiedProfile.traitScores) {
        unifiedProfile.traitScores[key] = value;
      }
    }
    console.log("[Stage 1.3] ✓ Overrode trait scores with blended group DNA");
  }
  ```

This ensures budget intent, forced slots, schedule constraints, and prompt building all use the **blended** traits for group trips, while solo trips remain unchanged.

### Fix 2: Add `transformation` to profile-loader

**File: `supabase/functions/generate-itinerary/profile-loader.ts`**

- Add `transformation: number` to the `TraitScores` interface (line ~23)
- In the trait score resolution logic, read `transformation` from the DB row alongside the other 7 traits (with fallback to 0)

**File: `supabase/functions/generate-itinerary/index.ts`**

- Remove the `transformation: 0` hardcode at line 5170, replace with `transformation: unifiedProfile.traitScores.transformation ?? 0`

### Fix 3: Consolidate blending into one shared implementation

**File: `supabase/functions/generate-itinerary/index.ts`**

- Extract the inline blending logic (lines 4474-4500) into a call to a function in `group-archetype-blending.ts` (which already has `blendGroupArchetypes`). Add a `blendTraitScores(ownerTraits, companionTraitsList)` export there.
- This reduces the 3 implementations to 2 (client-side `dnaBlending.ts` stays separate since it serves a different UI purpose).

### Files Changed

| File | Change |
|------|--------|
| `profile-loader.ts` | Add `transformation` to TraitScores interface + resolution |
| `index.ts` (~line 4535) | Merge blended traits into unifiedProfile after loading |
| `index.ts` (line 5170) | Use `unifiedProfile.traitScores.transformation` instead of `0` |
| `group-archetype-blending.ts` | Add `blendTraitScores()` helper |
| `index.ts` (~lines 4474-4500) | Replace inline blending with `blendTraitScores()` call |

