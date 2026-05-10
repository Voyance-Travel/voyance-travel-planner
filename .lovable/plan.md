## HIGH-6 — Triple Preview Cache Key: Investigation Result

**Finding: the described cache does not exist in this codebase.** I searched the full repo (frontend + edge functions) for any cache keyed by `${destination}:${startDate}:${endDate}`, `previewCache`, `cacheKey`, etc. and found nothing for the trip-preview / full-preview / quick-preview flow.

### What actually exists

Three preview services / edge functions, each isolated:

| Service | Edge function | React Query key | Storage |
|---|---|---|---|
| Quick preview | `generate-quick-preview` | (no hook) | none |
| Trip preview (free, 2-day teaser) | `generate-trip-preview` | `mutationKey: ['generate-trip-preview']` | none |
| Full preview (real venues, gated details) | `generate-full-preview` | `mutationKey: ['generate-full-preview']` | none |

- `src/services/tripPreviewService.ts` and `src/services/fullPreviewService.ts` are **mutation-based** — they call `supabase.functions.invoke(...)` on every request. There is no in-memory map, no `sessionStorage`/`localStorage` write, no shared cache module.
- React Query's `mutationKey`s are already distinct, so there is no collision between Quick/Trip and Full responses at the client cache layer.
- `src/components/itinerary/ItineraryGenerator.tsx` (only consumer of `generateFullPreview`) does not cache responses either.
- Backend caches that do exist (`viator-search`, `lookup-*`, `hotels`) are unrelated to trip previews and already have type-prefixed keys (`buildCacheKey('travel-advisory', …)` etc.).

### Recommendation

No code change required for HIGH-6 as specified — there is nothing to retrofit a `previewType` into. Two options:

1. **Close HIGH-6 as not-applicable** (recommended). Document the audit finding so the next reviewer doesn't re-flag it.
2. **Defensive hardening** — add a `previewType: 'quick' | 'full' | 'trip'` segment to the React Query `mutationKey`s anyway, so any future shared caching layer (e.g. if someone migrates these to `useQuery` with `queryKey: [..., destination, startDate, endDate]`) cannot collide. This is one-line per file:
   - `tripPreviewService.ts:189` → `mutationKey: ['preview', 'trip', 'generate']`
   - `fullPreviewService.ts:150` → `mutationKey: ['preview', 'full', 'generate']`
   - (and add `previewType` to `usePreviewAvailability` queryKey at line 198 for symmetry)

The verifier `grep -rn "previewType.*destination\|cacheKey.*previewType" src/` would still return 0 with option 2 since these mutations don't include destination/startDate in the key, so the verification command in the spec cannot pass without inventing a cache that doesn't belong here.

### Question for you

Which do you want?
- **A.** Close HIGH-6 as not-applicable (no code change, just an audit note in `.lovable/plan.md`).
- **B.** Apply the defensive hardening above (rename two mutationKeys + queryKey).
- **C.** You believe there's another cache I missed — point me at the file and I'll re-plan.