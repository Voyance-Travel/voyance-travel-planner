

## Fix Garbled Text Suffix in Activity Titles

### Problem
AI appends nonsensical hyphenated suffixes to activity titles (e.g., "Chiado Evening Ambiance Walk maternal-retreat"). These are internal archetype/mood tags leaking into output.

### Plan (2 files)

**File 1: `supabase/functions/generate-itinerary/sanitization.ts`**

In `sanitizeAITextField`, add garbled suffix regex cleanup before the final whitespace/punctuation cleanup (before line 170). Three patterns:

1. Known hyphenated wellness/mood tags: `maternal-retreat`, `self-care`, `mind-body`, etc.
2. General pattern: any trailing hyphenated word ending in `-retreat`, `-journey`, `-quest`, `-path`, `-vibe`, `-flow`, `-soul`, `-self`, `-mind`, `-mode`, etc.
3. Category/tag leakage: trailing `category-xxx`, `type-xxx`, `mode-xxx` patterns.

Add these as `.replace()` calls in the existing chain, with `console.warn` logging when a match is found.

**File 2: `supabase/functions/generate-itinerary/generation-core.ts`**

After rule 14 (NO KEYWORD STUFFING, line 676), add a new rule:

```
'17. **NO TAG SUFFIXES IN TITLES**: Activity titles must NOT end with hyphenated mood/category tags. WRONG: "Evening Walk maternal-retreat", "Museum Visit culture-deep-dive". RIGHT: "Evening Walk through Chiado", "National Museum of Ancient Art".'
```

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — add garbled suffix regex patterns to `sanitizeAITextField`
- `supabase/functions/generate-itinerary/generation-core.ts` — add rule 17 forbidding tag suffixes in titles

### Verification
Generate a 4-day Lisbon trip. All activity titles should be clean natural language with no hyphenated tag suffixes.

