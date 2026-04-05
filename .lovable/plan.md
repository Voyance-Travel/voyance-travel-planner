

## Fix: Garbled Text Where City Name Is Missing (Orphaned Articles)

### Problem
The AI generates placeholders for the city name that sometimes resolve to just "the" without a following noun. The existing Prompt 9 fix (line 164-166) replaces "the destination" / "the city" but misses standalone orphaned "the" patterns like "the's", "in the.", "of the,", "of the and".

### Change

**File: `supabase/functions/generate-itinerary/sanitization.ts`** — in `sanitizeAITextField`, after the existing "the destination" replacement block (lines 163-166), add orphaned article fixes:

```typescript
// After line 166, add:
// Fix orphaned articles where city name was dropped
if (destination) {
  // "the's" → "Lisbon's"
  result = result.replace(/\bthe's\b/gi, destination + "'s");
  // "in the." / "over the." etc. — orphaned article before period
  result = result.replace(/\b(in|over|of|around|across|throughout|from)\s+the\.\s*/gi, '$1 ' + destination + '. ');
  // "of the," / "of the;" — orphaned article before comma/semicolon
  result = result.replace(/\b(in|over|of|around|across|throughout|from)\s+the([,;]\s)/gi, '$1 ' + destination + '$2');
  // "of the and" / "of the or" — orphaned article before conjunction
  result = result.replace(/\b(in|over|of|around|across|throughout|from)\s+the\s+(and|or|but)\b/gi, '$1 ' + destination + ' $2');
  // "in the" at end of string
  result = result.replace(/\b(in|over|of|around|across|throughout|from)\s+the$/gi, '$1 ' + destination);
}
```

This goes right after the existing `destination` block so the `if (destination)` guard is already established. Single file, ~8 lines added.

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — add orphaned article replacements after line 166

