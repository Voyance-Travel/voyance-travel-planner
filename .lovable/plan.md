

## Fix: System Notes Leaking in Restaurant Descriptions

### Problem
The text "A local favorite — we recommend confirming hours before visiting" appears in rendered activity tips. It's hardcoded in `day-validation.ts` (line 989) as a fallback tip for meal-guard entries. The backend `sanitizeAITextField` has regexes to strip it (line 152-155), but the frontend `sanitizeActivityText` does NOT — so if the backend sanitization misses it for any reason, it leaks through.

### Changes

**1. Fix at source: `supabase/functions/generate-itinerary/day-validation.ts`** (line 988-990)

Replace the internal-sounding tip with genuinely useful user-facing text:
```typescript
// Before:
tips: venue
  ? `A local favorite — we recommend confirming hours before visiting.`
  : `Ask a local or check recent reviews to find a great spot nearby.`,

// After:
tips: venue
  ? `Popular with locals — check opening hours on the day.`
  : `Ask a local or check recent reviews to find a great spot nearby.`,
```

**2. Safety net on frontend: `src/utils/activityNameSanitizer.ts`**

Add regexes (before `INTERNAL_NOTE_RE`) to catch any residual system notes that survive backend sanitization:
```typescript
// Add a new regex constant for venue database notes
const VENUE_DB_NOTE_RE = /\s*[-–—]\s*(?:we\s+)?recommend\s+confirming\s+hours\s+before\s+visiting\.?/gi;
const LOCAL_FAVORITE_NOTE_RE = /(?:^|[.]\s*)(?:A\s+)?local\s+favorite\s*[-–—]\s*we\s+recommend[^.]*\.?\s*/gi;
const VENUE_SOURCE_RE = /(?:^|[.]\s*)(?:Recommended|Sourced|Verified|Confirmed)\s+(?:by|from|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi;
```

Then apply them in the `sanitizeActivityText` chain.

### Files
- `supabase/functions/generate-itinerary/day-validation.ts` — change hardcoded tip text (1 line)
- `src/utils/activityNameSanitizer.ts` — add 3 regexes + apply in sanitize chain

