

## FIX 5: Expand "Voyance Pick" Stripping + Add Word Dedup in Backend Sanitizer

### Current State

`sanitization.ts` line 94 already strips `Voyance Pick` and `Hotel Pick`:
```
.replace(/\s*(?:Voyance\s+Pick|Hotel\s+Pick)\s*/gi, '')
```

Activity titles ARE already passed through `sanitizeAITextField` (lines 143-146) — no gap there.

**What's missing:**
1. Variants like "Voyance Recommendation", "Voyance Choice", "Staff Pick" are not caught
2. No consecutive duplicate word dedup (e.g. "Pantheon Pantheon")

### Changes — Single File

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

**Change 1** — Line 94: Expand the pick/label regex to cover all variants:
```typescript
.replace(/\s*(?:Voyance\s+(?:Pick|Recommendation|Choice)|Hotel\s+Pick|Staff\s+Pick)\s*/gi, '')
```

**Change 2** — Add consecutive word dedup after line 94, before the empty-parens cleanup:
```typescript
.replace(/\b(\w{3,})\s+\1\b/gi, '$1')
```

This uses a 3+ character minimum to avoid false positives on short words like "to to" in legitimate text, matching the user's spec.

### What's NOT Changing
- `index.ts` — untouched
- No new files or functions
- Frontend `activityNameSanitizer.ts` already has both patterns (added in prior fix round)
- `sanitizeGeneratedDay` already calls `sanitizeAITextField` on `act.title` (line 143) — confirmed, no gap

### Verification
After deployment, any generated itinerary should have zero "Voyance Pick", "Hotel Pick", "Voyance Recommendation", "Staff Pick", or consecutive duplicate words in titles.

