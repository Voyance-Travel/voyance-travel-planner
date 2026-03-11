

## Fix: "Noon" Not Parsed by Time Extractor

### Problem
`extractExplicitTimeRange()` uses a regex that only matches numeric times with am/pm. Natural language words like "noon", "midnight", "midday" aren't recognized, so "US Open Noon-4:30pm" fails to parse. The title cleaning regex (line 405) also doesn't strip "noon"-style time ranges.

### Changes

**File: `supabase/functions/generate-itinerary/must-do-priorities.ts`**

**1. Add `normalizeTimeText()` helper** (before `extractExplicitTimeRange`, ~line 200):

Replaces natural language time words with numeric equivalents before regex parsing:
- `noon` / `midday` → `12:00pm`
- `midnight` → `12:00am`

**2. Call normalizer inside `extractExplicitTimeRange()`** (line 204):

```typescript
const lower = normalizeTimeText(text).toLowerCase();
```

This ensures "Noon-4:30pm" becomes "12:00pm-4:30pm" before the existing regex runs. No changes needed to the regex itself.

**3. Add title cleaning for "noon"-style time ranges** (line 405-406):

The existing `activityName` cleanup already strips numeric time ranges (`9am-5pm`). Add patterns to also strip:
- `noon-4:30pm`, `midnight-6am`, `9am-noon` etc.
- Also strip standalone time words like `noon`, `midnight` when they appear as scheduling metadata (similar to the existing `morning`/`afternoon` stripping on line 411)

Add after line 405:
```typescript
.replace(/\bnoon\s*(?:[-–—]|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi, '')
.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:[-–—]|to)\s*noon/gi, '')
.replace(/\bnoon\b/gi, '')
.replace(/\bmidnight\b/gi, '')
.replace(/\bmidday\b/gi, '')
```

### Summary
- One new helper function (~5 lines)
- One-line change inside `extractExplicitTimeRange`
- ~5 new regex lines in the title cleaner
- Result: "US Open Noon-4:30pm" → title: "US Open", startTime: "12:00", endTime: "16:30"

