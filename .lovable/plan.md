

## Fix: Curated Images Are Never Found Because Lookup Ignores `alt_text`

### The Problem

You have **9,961 curated photos** with real venue names in the `alt_text` column (e.g., "Crown Shy", "La Sagrada Família"). But `fetchFromCuratedImages` in `useActivityImage.ts` only searches the `entity_key` column — which for all 338 restaurants and 2,884 activities is a Google Place ID like `chijzbio4liipbiryzznzxz-0cc`.

The lookup searches: `entity_key.eq.crown_shy` → **0 matches**
The data stores: `entity_key: chij--9lnbzawokrenkoivx7ydc, alt_text: Crown Shy` → **never queried**

This means the curated photo tier is effectively dead for all Place ID-keyed rows. The system falls through to the edge function (Google Places API call) every time — or worse, to a gradient fallback.

### The Fix

**File: `src/hooks/useActivityImage.ts`** — `fetchFromCuratedImages` function (lines 122-145)

Add `alt_text` to the OR filter so the lookup matches by venue name:

```typescript
async function fetchFromCuratedImages(
  title: string,
  category: string,
  destination: string
): Promise<{ url: string; source: string } | null> {
  try {
    const cleanTitle = title.trim().replace(/[^a-zA-Z0-9 ]/g, '');
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, '_');
    
    const { data, error } = await supabase
      .from('curated_images')
      .select('image_url, source')
      .eq('is_blacklisted', false)
      .or([
        `entity_key.eq.${normalizedTitle}`,
        `entity_key.ilike.%${cleanTitle}%`,
        `alt_text.ilike.%${cleanTitle}%`     // ← NEW: search venue names
      ].join(','))
      .order('vote_score', { ascending: false })
      .limit(1);

    if (error || !data?.length) return null;
    if (!data[0].image_url) return null;
    return { url: data[0].image_url, source: `curated_${data[0].source || 'db'}` };
  } catch {
    return null;
  }
}
```

This single change unlocks ~10,000 cached photos that are already in your CDN. No new API calls, no new tables, no backend changes.

### Impact

| Before | After |
|--------|-------|
| 338 restaurant photos: **never matched** | Matched by alt_text (venue name) |
| 2,884 Place ID-keyed activities: **never matched** | Matched by alt_text |
| Falls through to Google Places API ($0.007/call) | Served from your own CDN ($0) |

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/hooks/useActivityImage.ts` | Add `alt_text.ilike` to the OR filter in `fetchFromCuratedImages` |

Single file, ~3 lines changed.

