

## Fix: Console errors — 500 Travel DNA, 400 achievements query, Unsplash 404

### Three issues from console logs

**1. `calculate-travel-dna` 500 error — `archetype.fineGrained is not iterable`**

The `matchArchetypesV2` function at line 1728-1729 has:
```typescript
if (archetype.fineGrained && fineGrainedTraits) {
  for (const fg of archetype.fineGrained) {
```
Several archetypes (e.g., `luxury_luminary`, `gap_year_graduate`, `escape_artist`) omit `fineGrained` entirely. In the compiled Deno bundle, the property may resolve to a truthy non-iterable value in certain edge cases. 

**Fix**: Change guard to `if (Array.isArray(archetype.fineGrained) && fineGrainedTraits)` — one line in `supabase/functions/calculate-travel-dna/index.ts` at line 1728.

---

**2. 400 Bad Request on trips query — wrong column name**

`src/services/achievementsAPI.ts` line 399:
```typescript
.not('itinerary', 'is', null)
```
The `trips` table has no `itinerary` column — it's `itinerary_data`.

**Fix**: Change `'itinerary'` to `'itinerary_data'` on line 399.

---

**3. Unsplash 404 — `photo-1596422846543-75c6fc197f11`**

This photo ID is already in the `BLOCKED_IMAGE_IDS` set in `useDestinationImages.ts`, so it's blocked for destination hero images. But it may still be referenced in hardcoded curated image lists or in stored itinerary data. No code change needed beyond confirming the block list is effective — this is likely a cached/stored reference in existing trip data. No action required.

---

### Files to edit

| File | Change |
|------|--------|
| `supabase/functions/calculate-travel-dna/index.ts` (line 1728) | `Array.isArray(archetype.fineGrained)` guard |
| `src/services/achievementsAPI.ts` (line 399) | `'itinerary'` → `'itinerary_data'` |

Two single-line fixes.

