

## Fix: Broadly Strip Hours/Opening Notes From All Text Fields

### Problem
Venue-database notes like "check opening hours on the day" and "confirm hours before visiting" keep appearing in new variants that bypass existing narrow regex patterns.

### Changes

**1. `supabase/functions/generate-itinerary/sanitization.ts`** — Replace lines 154-158 (the narrow venue-database patterns) with broader catch-all patterns:

```typescript
// Strip ALL variants of "check/confirm/verify hours/opening times" notes
.replace(/\s*[-–—]\s*(?:we\s+)?(?:recommend\s+)?(?:check|confirm|verify|confirming|checking|verifying)\s+(?:the\s+)?(?:opening\s+)?(?:hours|times)\b[^.]*\.?\s*/gi, '')
// Strip "Popular/A local favorite - check/confirm..." combined sentences
.replace(/(?:^|\.\s*)(?:Popular|A local favorite)\s*(?:with locals\s*)?[-–—]\s*(?:check|confirm|we recommend)[^.]*\.?\s*/gi, '')
// Strip any sentence containing both confirm/check/verify AND hours/times AND visit/before
.replace(/\s*[-–—]?\s*[^.]*\b(?:confirm|check|verify)\b[^.]*\b(?:hours|times)\b[^.]*\b(?:visit|before)\b[^.]*\.?\s*/gi, '')
// Keep existing: sourced/verified from venue database
.replace(/(?:^|[.]\s*)(?:Recommended|Sourced|Verified|Confirmed)\s+(?:by|from|via)\s+(?:our|the)\s+(?:venue|restaurant|local)\s+database[^.]*\.?\s*/gi, '')
```

**2. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** — After line 825 (the META-COMMENTARY block), add:

```typescript
OPERATIONAL NOTES — NEVER INCLUDE:
Never include operational notes about checking hours, confirming availability, or verifying opening times in any description text. All descriptions should read as confident, polished travel recommendations.
```

**3. `src/utils/activityNameSanitizer.ts`** — Update the frontend `VENUE_DB_NOTE_RE` and `LOCAL_FAVORITE_NOTE_RE` patterns to match the same broader patterns for client-side defense.

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — replace lines 154-158 with broader patterns
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add 2-line instruction after line 825
- `src/utils/activityNameSanitizer.ts` — broaden `VENUE_DB_NOTE_RE` and `LOCAL_FAVORITE_NOTE_RE`

