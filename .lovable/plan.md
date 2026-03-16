

# Close the Featured vs Database Destination Gap

## The Problem — Quantified

The gap between featured (static) and database destinations is massive:

| Aspect | Featured (e.g. Kyoto) | Database (e.g. Yokohama) |
|--------|----------------------|--------------------------|
| Hero image | 3 curated, stable photos | 1 generic storage placeholder |
| Description | Hand-written, evocative | Wikipedia-style auto-generated |
| Local tips | 4 specific, actionable tips | Falls back to "Carry local currency" generic |
| Food scene | Detailed | Empty (0 of 2,246 destinations have it) |
| Activities | Hand-curated list with categories | **Zero** (Yokohama has 0 attractions AND 0 activities) |
| Climate | Descriptive prose | Raw data string |

Scale of the problem: 2,246 database destinations. Zero have `local_tips`, `food_scene`, or `tipping_custom` populated. 138 have no attractions. 2,142 have no activities. Yokohama has neither.

## Root Causes

1. **Empty content columns**: `local_tips`, `safety_tips`, `common_scams`, `food_scene`, `tipping_custom`, `dress_code` are all empty arrays/null for every DB destination
2. **Missing attractions/activities**: Many destinations (including Yokohama) have zero entries in `attractions` and `activities` tables
3. **No enrichment pipeline**: There's no mechanism to fill these gaps — not manually, not via AI
4. **Generic fallback text**: Lines 273-277 in `DestinationDetail.tsx` fall back to painfully generic tips when DB data is empty

## Plan

### Phase 1: AI-Powered Destination Enrichment (Edge Function)

**New edge function: `supabase/functions/enrich-destination/index.ts`**

When a user views a DB destination that has thin content, trigger an AI enrichment call that generates:
- Compelling description (rewrite from Wikipedia-style to Voyance voice)
- 4-6 specific local tips
- Food scene summary
- Safety tips & common scams
- 8-12 top experiences/activities with categories, durations, price tiers
- Best neighborhoods

Uses Lovable AI (gemini-2.5-flash) — no API key needed. Results are written back to the DB so enrichment happens once per destination, then serves all future visitors.

### Phase 2: Auto-Trigger Enrichment from DestinationDetail Page

**`src/pages/DestinationDetail.tsx`** changes:
- After loading a DB destination, check if it has thin content (no local_tips, no activities, generic description)
- If thin, fire a background call to the enrich-destination edge function
- Show a subtle "Enhancing destination info..." shimmer while enriching
- When enrichment completes, refetch and render the richer content
- Never re-enrich an already-enriched destination (flag: `enriched_at` timestamp column on destinations table)

### Phase 3: Populate Activities from Enrichment

**`src/pages/DestinationDetail.tsx`** changes:
- After enrichment returns activities, insert them into the `activities` table linked to the destination
- The existing activities rendering code already handles DB activities — no UI changes needed for the "Top Experiences" section to appear

### Phase 4: Better Fallback UX (Immediate)

**`src/pages/DestinationDetail.tsx`** changes:
- Replace generic fallback tips with smarter context-aware defaults using the destination's country/region (e.g., for Japan: "Tipping is not customary" instead of "Carry local currency")
- Hide the "Local Tips" card entirely when only generic fallbacks exist, rather than showing hollow content
- Show a "Top Experiences" section even when empty, with a CTA: "Start planning to discover curated experiences"

### Database Changes

**Migration**: Add `enriched_at` timestamp column to `destinations` table:
```sql
ALTER TABLE public.destinations ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
```

### Files Changed
- **`supabase/functions/enrich-destination/index.ts`** — New edge function: takes destination ID, calls Lovable AI to generate rich content, writes back to destinations + activities tables
- **`src/pages/DestinationDetail.tsx`** — Detect thin content, trigger enrichment, show shimmer, refetch
- **`src/hooks/useDestinationEnrichment.ts`** — New hook: manages enrichment state, dedup, and refetch logic
- **Migration** — Add `enriched_at` column

### Enrichment Prompt Strategy

The edge function sends a structured prompt to gemini-2.5-flash with:
- City name, country, region, existing description
- Request for: rewritten description (Voyance voice — evocative, specific, not guidebook), 4-6 local tips (specific places/customs, not generic), food scene, safety notes, 8-12 activities with name/category/description/duration/price tier
- JSON response format for reliable parsing

### Cost & Performance
- Gemini Flash is fast (~2-3s) and cheap
- Each destination enriched once, then cached permanently in DB
- No impact on featured destinations (they skip this entirely)
- Background enrichment — page renders immediately with existing data, then upgrades

