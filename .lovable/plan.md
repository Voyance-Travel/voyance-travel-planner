

## Smart Finish: AI-Powered Quality Enrichment Gaps

Replace the algorithmic gap analysis with AI-powered quality suggestions (hidden gems, better alternatives, timing hacks) and update the banner UI to match.

### Changes

**1. Edge Function: `supabase/functions/analyze-trip-gaps/index.ts`**
- Replace lines 85-206 (algorithmic gap detection) with an AI call to Lovable AI gateway (`google/gemini-2.5-flash-lite`)
- Build itinerary summary + DNA context as prompt, asking for 3-5 quality enrichment gaps across categories: `hidden_gem`, `better_alternative`, `insider_timing`, `experience_upgrade`, `local_favorite`
- Parse AI JSON response with fallback if parsing fails
- Extend cache TTL from 1 hour to 4 hours (line 56: `3600000` → `14400000`)

**2. Frontend: `src/components/itinerary/SmartFinishBanner.tsx`**
- Add category label/icon maps for new gap types (Star for hidden gems, Zap for alternatives, etc.)
- Update gap display in dialog (lines 538-549) to use category-specific icons instead of severity icons
- Update teaser text (line 455): "X gaps found - review details" → "X insider tips found — see what you're missing"
- Update dialog description (lines 519-525): "potential gaps" → quality-focused copy
- Update `ENRICHMENT_FEATURES` pills (lines 55-60) to emphasize quality: "Hidden gems & local favorites", "DNA-matched experiences", etc.

### What stays the same
- Response shape (`gapCount`, `gaps[]`, `dnaArchetype`, `analyzedAt`)
- Auth flow, cache mechanism, purchase flow, banner visibility logic
- All other edge functions unchanged
- No new secrets needed (`LOVABLE_API_KEY` already available)

### Cost
- Before: $0.00/call (algorithmic)
- After: ~$0.005-0.01/call (Gemini Flash Lite, cached 4 hours)

