

## Fix: Activity Title Keyword Stuffing

**Problem**: The AI model sometimes pads activity titles with synonym lists — e.g., "Central Park walk borough town place locale district quarter sector area neighborhood." The existing sanitizer catches duplicate words and system prefixes but not this pattern.

**Root cause**: No prompt rule or post-processing guard against geographic synonym stuffing in titles.

**Fix — three layers of defense:**

### 1. Prompt guardrail (generate-itinerary/index.ts)
Add a new rule to the activity naming block (around line 1564):

```
'14. **NO KEYWORD STUFFING**: Activity titles must be concise (max 8 words). NEVER pad titles with synonym lists of location types (e.g., "borough town place locale district quarter sector area"). Use the specific venue or activity name only.'
```

### 2. Post-generation title truncation (day-validation.ts)
Add a `sanitizeActivityTitles` pass in the validation/post-processing phase that:
- Detects titles exceeding 8 words
- Checks for geographic synonym clusters using a known list: `borough, town, place, locale, district, quarter, sector, area, neighborhood, neighbourhood, zone, region, vicinity, suburb, precinct`
- If 3+ of these appear in a title, truncate to the text before the first synonym match
- Cap all titles at 60 characters

### 3. Frontend sanitizer fallback (activityNameSanitizer.ts)
Add a final cleanup step in `sanitizeActivityName`:
- Same geographic synonym detection
- Strip trailing runs of geographic synonyms from display titles
- This catches any titles that slip past backend validation

### Files to change
- `supabase/functions/generate-itinerary/index.ts` — add prompt rule ~line 1565
- `supabase/functions/generate-itinerary/day-validation.ts` — add title sanitization in post-processing
- `src/utils/activityNameSanitizer.ts` — add geographic synonym stripping

