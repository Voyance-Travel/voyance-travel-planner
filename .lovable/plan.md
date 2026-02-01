
# Plan: Activate Untapped Dynamic Features Without Breaking Current Setup

## ✅ IMPLEMENTED

All changes have been applied and deployed.

---

## What Changed

| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/index.ts` | Added `buildFullPromptGuidanceAsync` import, `getDestinationId` helper, updated 2 call sites |

---

## Current State (Post-Implementation)

| Feature | Status |
|---------|--------|
| Static archetype rules | ✅ Active |
| Experience affinity matrix | ✅ Active |
| Departure day logic | ✅ Active |
| Database attraction matching | ✅ Active (falls back gracefully - 0 attractions tagged yet) |
| AI-generated city guides | ✅ Active (cached 90 days) |
| Attraction enrichment | 🔄 Ready for batch enrichment |

---

## How to Verify

1. **Regenerate an itinerary** (e.g., Rome trip)
2. **Check edge function logs** for:
   - `[getDestinationId] Rome → <uuid>` or `not found`
   - `[buildFullPromptGuidanceAsync] Added X matched attractions`
   - `[ArchetypeGuide] Cache hit for X × Y` or `Generating new guide`
3. **Second request** should show cache hit

---

## Next Steps (Optional)

1. **Batch enrich attractions** with `experience_categories` tags
2. **Monitor logs** for cache hit/miss patterns
3. **Progressive enrichment** - tag attractions as destinations are requested
