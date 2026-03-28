

## Fix: Wrong Activity Categories (Bars Categorized as Wellness)

### Problem

Cocktail bars and nightcap venues are being categorized as "WELLNESS" or "ACTIVITY" instead of "dining" or a nightlife-equivalent. This happens because:

1. **The JSON schema enum doesn't include "nightlife"** — Line 2228 and 10007 define allowed categories as `["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"]`. No nightlife option exists, so the AI picks the closest match — sometimes "wellness" (from prompt context about wellness slots) or "activity".

2. **The prompt says "EVENING/NIGHTLIFE"** (line 9329) but doesn't specify which category to use for bars/cocktails, leaving the AI to guess.

3. **No post-generation category correction** — even when the AI outputs an invalid category like "wellness" or "nightlife", nothing normalizes it back to a valid value.

### Fix — Two changes in `index.ts`

**Change 1: Update the prompt (line 9329)**

Add explicit category guidance for evening/nightlife activities:

```
8. EVENING/NIGHTLIFE — Bar, jazz club, night market, show, rooftop, dessert spot
   (at least 1 suggestion). Use category: "dining" for bars, lounges, and cocktail
   venues. Use category: "activity" for shows, clubs, and entertainment.
   NEVER use "wellness", "nightlife", or "relaxation" as a category for bars/lounges.
```

**Change 2: Add a post-generation category normalizer**

After AI output is parsed (near the existing normalization passes around Stage 2), add a category correction pass that:

- Maps any invalid/non-enum category to the correct one based on title/description keywords
- Specifically catches bars, lounges, cocktails, nightcaps → "dining"
- Catches wellness used for non-wellness activities → "activity" or "dining"
- Logs corrections for debugging

```typescript
// Post-generation category normalizer
const VALID_CATEGORIES = new Set([
  'sightseeing', 'dining', 'cultural', 'shopping',
  'relaxation', 'transport', 'accommodation', 'activity'
]);

const BAR_KEYWORDS = /\b(bar|lounge|cocktail|nightcap|pub|drinks?|wine bar|rooftop bar|izakaya|sake|whisky|bourbon|speakeasy|taproom)\b/i;
const DINING_KEYWORDS = /\b(restaurant|cafe|coffee|bistro|brasserie|eatery|brunch|breakfast|lunch|dinner|ramen|sushi|food)\b/i;

for (const day of allDays) {
  for (const act of day.activities || []) {
    const cat = (act.category || '').toLowerCase();
    const titleDesc = `${act.title || ''} ${act.description || ''}`;

    if (!VALID_CATEGORIES.has(cat)) {
      // Invalid category — remap based on content
      if (BAR_KEYWORDS.test(titleDesc) || DINING_KEYWORDS.test(titleDesc)) {
        act.category = 'dining';
      } else if (/\b(spa|massage|onsen|bath|meditation|yoga|wellness)\b/i.test(titleDesc)) {
        act.category = 'relaxation';
      } else {
        act.category = 'activity';
      }
      console.log(`[Category fix] "${act.title}": "${cat}" → "${act.category}"`);
    }
    // Also catch valid-but-wrong: "relaxation" used for bars
    else if (cat === 'relaxation' && BAR_KEYWORDS.test(titleDesc)) {
      act.category = 'dining';
      console.log(`[Category fix] "${act.title}": relaxation → dining (bar/lounge)`);
    }
  }
}
```

### Result

| Before | After |
|--------|-------|
| "Nightcap at Virtu Lounge" → WELLNESS | → dining |
| "Skyline Nightcap at The Moon Lounge" → WELLNESS | → dining |
| "Nightcap at Bar High Five" → ACTIVITY | → dining |
| Budget allocations distorted by wrong categories | Correct category totals |

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add category normalizer after AI output parsing |
| `supabase/functions/generate-itinerary/index.ts` | Update line 9329 prompt to specify categories for evening venues |

