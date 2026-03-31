

## Fix: Strip Internal Venue Database Notes from Descriptions

### Problem
Internal data-freshness and provenance notes leak into user-visible restaurant descriptions:
- "we recommend confirming hours before visiting"
- "Recommended by our venue database"
- "Sourced/Verified/Confirmed from/by our venue/restaurant database"

### Fix

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Add 5 regex replacements to the `.replace()` chain in `sanitizeAITextField` (after line 104, before the dedup line):

```typescript
// Strip internal venue database / data-freshness notes
.replace(/\s*[-–—]\s*(?:we\s+)?recommend\s+confirming\s+hours\s+before\s+visiting\.?/gi, '')
.replace(/\s*[-–—]?\s*confirm\s+hours\s+before\s+visiting\.?/gi, '')
.replace(/(?:^|[.]\s*)Recommended\s+by\s+our\s+venue\s+database[^.]*\.?\s*/gi, '')
.replace(/(?:^|[.]\s*)(?:A\s+)?local\s+favorite\s*[-–—]\s*we\s+recommend[^.]*\.?\s*/gi, '')
.replace(/(?:^|[.]\s*)(?:Sourced|Verified|Confirmed)\s+(?:from|by|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi, '')
```

Single file, single insertion point. No new files, no pipeline changes.

| File | Change |
|---|---|
| `sanitization.ts` | Add 5 regex strips for internal venue/database notes in `sanitizeAITextField` |

