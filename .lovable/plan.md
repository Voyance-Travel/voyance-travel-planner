

## Fix: Transit Entry Naming — Pattern-Based Sanitization

### Problem
Transit entries like "Travel to Return to Four Seasons Ritz via Taxi" survive cleanup because the existing fix (lines 265-277) only runs when `act.category === 'transport'` or `'transportation'`. If the category field differs, the cleanup is skipped entirely. It also only handles `Travel to ...` prefixes, missing `Taxi to`, `Walk to`, etc.

### Change

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Replace the existing category-gated transport cleanup block (lines 264-277) with a **title-pattern-based** approach that fires on any activity whose title starts with a travel verb, regardless of category:

```typescript
// Replace lines 264-277 with:

// Safety net: clean transit titles that include embedded action verbs
// Use title pattern instead of category to catch all transit entries
const TRANSIT_TITLE_RE = /^(?:Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+/i;
if (act.title && TRANSIT_TITLE_RE.test(act.title)) {
  act.title = act.title
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Return\s+to\s+/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Freshen\s+[Uu]p\s+at\s+/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Check[\s-]?in\s+at\s+/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Check[\s-]?out\s+(?:from|at)\s+/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+(?:Breakfast|Lunch|Dinner|Brunch|Nightcap|Supper)\s+at\s+/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+End\s+of\s+Day\s+at\s+/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Settle\s+(?:in|into)\s+(?:at\s+)?/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Wind\s+Down\s+at\s+/i, '$1 to ')
    .replace(/^(Travel|Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry)\s+to\s+Rest\s+(?:&|and)\s+Recharge\s+at\s+/i, '$1 to ');
  act.name = act.title;
}
```

This uses capture groups (`$1`) to preserve the original transit verb while stripping the embedded action verb. It matches any title starting with a travel verb, not just `category === 'transport'`.

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — replace lines 264-277 with pattern-based transit cleanup

