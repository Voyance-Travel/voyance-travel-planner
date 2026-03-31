

## Fix: Strip Internal Prefixes From Day Titles

### Problem
Day titles contain internal format prefixes like "Short Trip Berlin Day 3: History & High-End Dining". The "Short Trip Berlin Day 3:" part is a generation prompt template label that leaked into user-facing output.

### Fix

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Two changes in the same file:

**1. Add day-title prefix regexes to `sanitizeAITextField`** (insert into the `.replace()` chain around line 85, before the booking-urgency strips):

```typescript
// Strip internal day title prefixes: "Short Trip Berlin Day 3:" etc.
.replace(/^(?:Short\s+Trip|City\s+Trip|Long\s+Trip|Weekend\s+Trip|Extended\s+Trip)\s+\w+(?:\s+\w+)*\s+Day\s+\d+\s*[:–—-]\s*/i, '')
// Strip bare "Day N:" prefix
.replace(/^Day\s+\d+\s*[:–—-]\s*/i, '')
```

**2. Ensure `sanitizeGeneratedDay` sanitizes `day.name`** — currently line 135-138 sanitizes `day.title` and `day.theme` but not `day.name`. Add after line 138:

```typescript
if (day.name) {
  day.name = sanitizeAITextField(day.name, destination);
}
```

`day.title` already goes through `sanitizeAITextField` (line 135), so the new regexes will automatically apply to it. Adding `day.name` ensures both fields are covered.

### Summary

| File | Change |
|---|---|
| `sanitization.ts` | Add 2 regex strips for day-title prefixes in `sanitizeAITextField`; sanitize `day.name` in `sanitizeGeneratedDay` |

