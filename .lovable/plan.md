

## Fix: System Labels Leaking Into Activity Descriptions (Confirmed Systemic)

### Problem
`SOLO_RETREAT` and `AUTHENTIC_ENCOUNTER` labels appear in activity **descriptions** across multiple trips. Two patterns:
- `"A SOLO_RETREAT moment in one of..."` — no colon, mid-sentence
- `"AUTHENTIC_ENCOUNTER: Indulge in a..."` — with colon, at start

### Root Cause — 2 gaps

**Gap 1: Backend regex requires a colon**
`sanitization.ts` line 61: `SYSTEM_PREFIXES_RE = /\b(?:SOLO_RETREAT|...)\s*[:]\s*/gi`
This catches `AUTHENTIC_ENCOUNTER:` but misses `SOLO_RETREAT` without a colon. The `[:]` is mandatory in the regex.

**Gap 2: Client-side sanitizer only handles titles**
`sanitizeActivityName()` strips prefixes from activity names/titles only. Descriptions are rendered raw — `{activity.description}` — in 17+ components with no sanitization pass.

### Fix — 3 files

**1. `supabase/functions/generate-itinerary/sanitization.ts`** — Make colon optional in regex

```
// Before:
/\b(?:EDGE_ACTIVITY|...)\s*[:]\s*/gi

// After:  
/\b(?:EDGE_ACTIVITY|...)\s*[:]?\s*/gi
```

Adding `?` after `[:]` makes the colon optional, catching both `"SOLO_RETREAT moment"` and `"AUTHENTIC_ENCOUNTER: Indulge"`. The `\b` word boundary prevents false positives on normal words.

**2. `src/utils/activityNameSanitizer.ts`** — Add a `sanitizeActivityText()` export for descriptions

Add a new exported function that applies the same system-prefix regex (colon-optional) to any text field. Simpler than `sanitizeActivityName` — no dedup logic, just prefix stripping:

```typescript
const SYSTEM_LABEL_RE = /\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|WELLNESS_MOMENT|AUTHENTIC_ENCOUNTER|SOCIAL_EXPERIENCE|SOLO_RETREAT|DEEP_CONTEXT|SPLURGE_EXPERIENCE|VIP_EXPERIENCE|COUPLES_MOMENT|CONNECTIVITY_SPOT|FAMILY_ACTIVITY)\s*:?\s*/gi;

export function sanitizeActivityText(text: string | undefined | null): string {
  if (!text) return '';
  return text.replace(SYSTEM_LABEL_RE, '').replace(/\s{2,}/g, ' ').trim();
}
```

**3. `src/components/itinerary/EditorialItinerary.tsx`** — Sanitize descriptions at render

The primary itinerary view renders descriptions in 3 places (~lines 10023, 10169, 10507). Wrap each `activity.description` with `sanitizeActivityText()`. This is the main component; other components (LiveActivityCard, BookableItemCard, etc.) can be updated in a follow-up but EditorialItinerary is where users spend 90%+ of their time.

### Why both backend and client-side
- Backend fix prevents future generations from having labels
- Client-side fix cleans already-generated trip data stored in the DB without requiring regeneration

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — make colon optional in regex
- `src/utils/activityNameSanitizer.ts` — add `sanitizeActivityText()` for description fields
- `src/components/itinerary/EditorialItinerary.tsx` — sanitize descriptions at render time

