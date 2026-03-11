

## Fix 20A: Community Guide Editorial Engine — Backend

### Overview
Add database columns to `community_guides` for storing AI-generated editorial content, and create a new edge function `generate-guide-editorial` that transforms builder data into polished editorial travel journalism.

### 1. Database Migration

Add three columns to `community_guides`:

```sql
ALTER TABLE public.community_guides
  ADD COLUMN IF NOT EXISTS editorial_content JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS editorial_version INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS editorial_generated_at TIMESTAMPTZ DEFAULT NULL;
```

No RLS changes needed — existing policies already cover owner CRUD and public SELECT for published guides.

### 2. Edge Function: `generate-guide-editorial`

**File:** `supabase/functions/generate-guide-editorial/index.ts`

**Config:** Add `verify_jwt = false` entry to `supabase/config.toml`.

**Flow:**
1. Auth via `getClaims()` (same pattern as `generate-travel-guide`)
2. Validate `guideId` from POST body
3. Fetch guide from `community_guides` — verify user owns it (403 if not)
4. Fetch `guide_sections` for the guide — filter to sections with `user_experience` (50+ chars), `user_rating`, or `recommended` set
5. Validate at least 3 reviewed activities exist (400 if not)
6. Fetch trip metadata (`trips` table: destination, dates, travelers, trip_type)
7. Fetch author profile (`profiles`: display_name) and travel DNA (`travel_dna_profiles`: primary_archetype_name)
8. Assemble system + user prompts (editorial system prompt from the spec, user prompt with all reviewed activities)
9. Call Lovable AI gateway (`google/gemini-2.5-flash`) with tool calling to extract structured `EditorialContent` JSON
10. Validate response structure; retry once if JSON parsing fails
11. Save to `community_guides`: set `editorial_content`, increment `editorial_version`, set `editorial_generated_at`
12. Return `{ success: true, editorial, version }`

**Key details:**
- Uses `LOVABLE_API_KEY` (already available)
- Uses tool calling (function calling) to get structured JSON output — more reliable than asking the model to return raw JSON
- No credit deduction for this feature (per spec — not mentioned, so omitting; can add later)
- Uses admin client (`SUPABASE_SERVICE_ROLE_KEY`) for the update to bypass RLS cleanly after ownership is verified
- Error handling: 404 (guide not found), 403 (not owner), 400 (insufficient reviews), 429/402 (AI rate limit/payment), 500 (AI failure)

**Tool calling schema** for structured output:
```typescript
tools: [{
  type: "function",
  function: {
    name: "write_editorial",
    description: "Output the editorial travel article as structured JSON",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        lede: { type: "string" },
        sections: { type: "array", items: { ... } },
        signOff: { type: "string" },
        quickReference: { type: "array", items: { ... } }
      },
      required: ["title", "lede", "sections", "signOff", "quickReference"]
    }
  }
}]
```

### Summary of Changes
- 1 database migration (3 new columns on `community_guides`)
- 1 new edge function file (`generate-guide-editorial/index.ts`)
- 1 line added to `supabase/config.toml`
- No UI changes

