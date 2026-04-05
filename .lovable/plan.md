

## Strip "Popular with locals" and Similar Database Descriptor Stubs

### Problem
Restaurant descriptions sometimes consist entirely of short database descriptor phrases like "Popular with locals" instead of actual travel copy. These are distinct from the "check hours" notes already handled.

### Changes

**1. `supabase/functions/generate-itinerary/sanitization.ts`**

**Part A — Stub description detection in `sanitizeGeneratedDay`** (after the hotel name mismatch fix at line 370, before `return day` at line 372):

```typescript
// Detect and clear stub descriptions that are just database descriptor notes
const STUB_DESC_RE = /^(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Well[- ]known (?:locally|spot)|Hidden gem|Must[- ]visit|Highly recommended|A must[- ]try|Local institution|Neighborhood favou?rite|A true gem|Worth (?:a|the) visit)\.?$/i;

if (day.activities) {
  for (const act of day.activities) {
    const desc = (act.description || '').trim();
    if (desc.length > 0 && desc.length < 80 && STUB_DESC_RE.test(desc)) {
      act.description = '';
    }
    if (act.restaurant?.description) {
      const rDesc = act.restaurant.description.trim();
      if (rDesc.length > 0 && rDesc.length < 80 && STUB_DESC_RE.test(rDesc)) {
        act.restaurant.description = '';
      }
    }
  }
}
```

**Part B — Inline stub stripping in `sanitizeAITextField`** (add to the `.replace()` chain, around line 158-160):

```typescript
// Strip "Popular with locals" and similar database stub phrases when embedded inline
.replace(/\s*[-–—]\s*(?:Popular with locals|A local favou?rite|Great for (?:families|groups|couples)|Tourist (?:hotspot|favorite)|Hidden gem|Must[- ]visit|Highly recommended|Local institution)\.?\s*/gi, '')
```

**2. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

Expand the OPERATIONAL NOTES block (line 827-828) to also forbid generic descriptor phrases:

```
OPERATIONAL NOTES — NEVER INCLUDE:
Never include operational notes about checking hours, confirming availability, or verifying opening times in any description text. Never use generic database descriptor phrases like "Popular with locals", "A local favorite", "Hidden gem", "Must-visit", or "Highly recommended" as restaurant or activity descriptions. Every description must be a specific, unique sentence describing what makes this particular venue special. All descriptions should read as confident, polished travel recommendations.
```

**3. `src/utils/activityNameSanitizer.ts`**

Add matching inline stub stripping to the frontend `sanitizeActivityText` function for client-side defense (same regex as Part B).

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — add stub detection + inline stripping
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — expand OPERATIONAL NOTES
- `src/utils/activityNameSanitizer.ts` — add frontend stub stripping

