

## Remove Dead Code: `useProgressiveItinerary.ts`

### Problem
`useProgressiveItinerary.ts` is dead code. It calls the `generate-itinerary` edge function without an `action` field, which always returns a 400 "Unknown action" error. No component imports or uses this hook — all real generation goes through `TripDetail.tsx` with `action: 'generate-trip'`.

### Changes

**1. Delete `src/hooks/useProgressiveItinerary.ts`**
- Remove the entire file. It has zero runtime imports across the codebase.

**2. Update documentation references (optional cleanup)**
- `docs/ITINERARY_LOVABLE.md` — remove the line referencing this file
- `docs/SOT_PROGRESSIVE_ITINERARY_GENERATION.md` — this doc describes the intended design but references the now-deleted hook; add a note that generation is handled via `useGenerationPoller` + `action: 'generate-trip'`
- `docs/ITINERARY_GENERATION_SOURCE_OF_TRUTH_v2.1_ACTUAL.md` — update the code evidence reference

| File | Change |
|---|---|
| `src/hooks/useProgressiveItinerary.ts` | **Delete** |
| `docs/ITINERARY_LOVABLE.md` | Remove reference |
| `docs/SOT_PROGRESSIVE_ITINERARY_GENERATION.md` | Update to reflect current architecture |
| `docs/ITINERARY_GENERATION_SOURCE_OF_TRUTH_v2.1_ACTUAL.md` | Update code evidence |

