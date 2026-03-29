

## Fix: Description Text Quality Issues

**Root cause**: The `action-generate-trip-day.ts` file (the primary generation path) has NO post-processing for forward references, generic titles, or phantom hotels. All of those cleanup steps only exist in the Stage 2 handler in `index.ts` (~lines 2554-2594). Days generated via `action-generate-trip-day.ts` skip all of them.

### Changes

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

After `dayResult` is confirmed valid (line 545, after `dayResult!.dayNumber = dayNumber`), add a post-processing block that mirrors the Stage 2 cleanup from index.ts:

```typescript
import { sanitizeGeneratedDay, stripPhantomHotelActivities, sanitizeAITextField } from './sanitization.ts';

// ... after line 545 (dayResult!.dayNumber = dayNumber):

// ── POST-PROCESSING: sanitize, strip phantoms, fix forward refs, clean generic titles ──
{
  const resolvedDest = cityInfo?.cityName || destination;
  sanitizeGeneratedDay(dayResult, dayNumber, resolvedDest);
  
  const hasHotel = !!(cityInfo?.hotelName || flightHotelContext?.hotelName);
  if (!hasHotel) {
    stripPhantomHotelActivities(dayResult, false);
  }

  // Forward-ref fix: strip hallucinated tomorrow references from accommodation descriptions
  const hotelName = cityInfo?.hotelName || flightHotelContext?.hotelName || 'your hotel';
  for (const act of (dayResult.activities || [])) {
    const cat = (act.category || '').toLowerCase();
    const title = (act.title || '').toLowerCase();
    const isReturnAccom = cat === 'accommodation' &&
      (title.includes('return to') || title.includes('freshen up') || title.includes('back to') || title.includes('settle in'));
    if (isReturnAccom && act.description && /tomorrow/i.test(act.description)) {
      act.description = `Time at ${hotelName} to rest and refresh.`;
    }
  }

  // Generic title validator: clean placeholder business names
  const INDEFINITE_ARTICLE_START = /^(a|an)\s+[a-z]/i;
  const VAGUE_TITLE_KEYWORDS = /\b(or high.end|or similar|boutique wellness|local spa|nearby caf[eé])\b/i;
  for (const act of (dayResult.activities || [])) {
    const title = (act.title || '').trim();
    if (INDEFINITE_ARTICLE_START.test(title) || VAGUE_TITLE_KEYWORDS.test(title)) {
      act.title = sanitizeAITextField(title, resolvedDest);
      act.name = act.title;
    }
  }
}
```

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Strengthen the FORWARD_REF_RE to also catch broader "tomorrow" references in descriptions (not just "rest for tomorrow's"):

```typescript
// Add a second forward-ref pattern for broader "tomorrow" hallucinations
const TOMORROW_REF_RE = /\b(?:for |before )?tomorrow'?s?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:adventure|exploration|experience|excursion|day|visit)\b[^.]*/gi;
```

Add this as a `.replace()` call after the existing `FORWARD_REF_RE` replacement in `sanitizeAITextField`.

### Summary

| File | Change |
|---|---|
| `action-generate-trip-day.ts` | Add sanitization, phantom hotel stripping, forward-ref fix, and generic title cleanup after day generation |
| `sanitization.ts` | Add broader tomorrow-reference regex to catch "tomorrow's DisneySea adventure" patterns |

This ensures both generation paths (Stage 2 in index.ts and action-generate-trip-day.ts) apply identical post-processing.

