

## Fix: Transit Entry Naming — Strip Action Verbs from Destination Names

### Root Cause

Transit entries are generated in multiple places in `repair-day.ts` using the pattern:
```
title: `Travel to ${next.location?.name || next.title || 'next venue'}`
```

When `location.name` is missing or identical to the activity title, the fallback uses the full activity title — which includes action verbs like "Return to", "Freshen Up at", "Breakfast at". This produces malformed names like "Travel to Return to Four Seasons Ritz".

### Fix

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

1. Add a new exported helper `sanitizeTransitDestination(name: string): string` that strips action-verb prefixes from transit destination names:
   - "Return to X" → "X"
   - "Freshen Up at X" → "X"
   - "Check-in at X" / "Check-out from X" → "X"
   - "Breakfast/Lunch/Dinner/Brunch/Nightcap at X" → "X"
   - "End of Day at X" → "X"

2. In `sanitizeGeneratedDay`, after the existing activity sanitization loop (~line 204-230), add a pass over transport-category activities to apply this cleanup to their `title` and `name` fields. Specifically, for any activity where `category === 'transport'` and the title starts with "Travel to", extract the destination portion and run it through the sanitizer, then reconstruct.

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

3. Import `sanitizeTransitDestination` and apply it at the key transit-name generation points — the fallback expression `next.location?.name || next.title` should become `next.location?.name || sanitizeTransitDestination(next.title || '')`. This covers:
   - Post-dedup transport injection (~line 1643)
   - Gap transport injection (~line 2317)
   - Transport rewrite (~line 2499)
   - Transport consolidation/merge (~lines 2591, 2669)

### Technical Detail

The `sanitizeTransitDestination` function:
```typescript
export function sanitizeTransitDestination(name: string): string {
  if (!name) return name;
  return name
    .replace(/^Return\s+to\s+/i, '')
    .replace(/^Freshen\s+[Uu]p\s+at\s+/i, '')
    .replace(/^Check[\s-]?in\s+at\s+/i, '')
    .replace(/^Check[\s-]?out\s+(?:from|at)\s+/i, '')
    .replace(/^(?:Breakfast|Lunch|Dinner|Brunch|Nightcap|Supper)\s+at\s+/i, '')
    .replace(/^End\s+of\s+Day\s+at\s+/i, '')
    .replace(/^Settle\s+(?:in|into)\s+(?:at\s+)?/i, '')
    .replace(/^Wind\s+Down\s+at\s+/i, '')
    .replace(/^Rest\s+(?:&|and)\s+Recharge\s+at\s+/i, '')
    .trim();
}
```

Also apply a final safety net in `sanitizeGeneratedDay` for transport titles:
```typescript
// After existing activity loop, clean transport titles
if (act.category === 'transport' || act.category === 'transportation') {
  act.title = act.title
    .replace(/^Travel\s+to\s+Return\s+to\s+/i, 'Travel to ')
    .replace(/^Travel\s+to\s+Freshen\s+[Uu]p\s+at\s+/i, 'Travel to ')
    .replace(/^Travel\s+to\s+Check[\s-]?in\s+at\s+/i, 'Travel to ')
    .replace(/^Travel\s+to\s+Check[\s-]?out\s+(?:from|at)\s+/i, 'Travel to ')
    .replace(/^Travel\s+to\s+(?:Breakfast|Lunch|Dinner|Brunch|Nightcap)\s+at\s+/i, 'Travel to ')
    .replace(/^Travel\s+to\s+End\s+of\s+Day\s+at\s+/i, 'Travel to ')
    .replace(/^Travel\s+to\s+Settle\s+(?:in|into)\s+(?:at\s+)?/i, 'Travel to ')
    .replace(/^Travel\s+to\s+Wind\s+Down\s+at\s+/i, 'Travel to ')
    .replace(/^Travel\s+to\s+Rest\s+(?:&|and)\s+Recharge\s+at\s+/i, 'Travel to ');
  act.name = act.title;
}
```

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — add `sanitizeTransitDestination` helper + transport title cleanup in `sanitizeGeneratedDay`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — apply `sanitizeTransitDestination` at transit name generation points

