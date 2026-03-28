

## Fix: Description Text Quality Issues

Three distinct problems in AI-generated activity text.

---

### Issue 1: Empty Parentheses "()" in Descriptions

**Root cause**: After `sanitizeAITextField` strips content inside parentheses (via `AI_QUALIFIER_RE`, `META_DISTANCE_COST_RE`), the empty `()` shell is left behind. No cleanup pass removes empty parens.

**Fix** — Add to `sanitizeAITextField` in `sanitization.ts` (line ~80, before the final whitespace cleanup):
```typescript
.replace(/\(\s*\)/g, '')  // Strip empty parentheses left after content removal
```

Also add the same rule to the client-side `sanitizeAIOutput` in `src/utils/textSanitizer.ts`.

**File**: `supabase/functions/generate-itinerary/sanitization.ts`, `src/utils/textSanitizer.ts`

---

### Issue 2: Hallucinated Forward References ("tomorrow's DisneySea adventure")

**Root cause**: The prompt instructs the AI to add a "NEXT MORNING PREVIEW" in the last activity's tips field (line 9424). The AI sometimes leaks this forward-reference into Return to Hotel *descriptions* instead of tips, and fabricates content that doesn't match the actual next day.

**Fix** — Add a post-generation sanitizer in `sanitization.ts` that strips forward-reference phrases from descriptions:
```typescript
// In sanitizeAITextField, add:
const FORWARD_REF_RE = /\.?\s*(?:rest|recharge|prepare|get ready)\s+for\s+tomorrow'?s?\s+[^.]+(?:adventure|day|exploration|experience|excursion)[^.]*\.?/gi;
```

Also add a dedicated pass in `index.ts` (near the existing category/breakfast normalizers) that specifically targets Return to Hotel descriptions:
- If description mentions "tomorrow" and doesn't match the actual next day's theme, replace with the bookend validator's clean template: `"Time at ${hotelName} to rest and refresh."`

**File**: `supabase/functions/generate-itinerary/sanitization.ts`, `supabase/functions/generate-itinerary/index.ts`

---

### Issue 3: Generic/Placeholder Business Names

**Root cause**: The prompt prohibits generic meal names but doesn't extend this to non-dining activities (wellness, cafés). "Boutique Wellness in Omotesando" and "a kissaten" slip through because validation only checks dining activities for real names.

**Fix** — Add a post-generation validator in `index.ts` (near existing normalizers) that flags generic activity titles:

```typescript
const GENERIC_TITLE_RE = /^(a |an |the |some |boutique |local )/i;
const VAGUE_TITLE_KEYWORDS = /\b(or high.end|or similar|boutique wellness|local spa|nearby café)\b/i;
const INDEFINITE_ARTICLE_START = /^(a|an)\s+[a-z]/i;

for (const day of allDays) {
  for (const act of day.activities || []) {
    const title = (act.title || '').trim();
    // Flag titles starting with indefinite articles ("a kissaten") 
    // or containing search-result language ("or High-End")
    if (INDEFINITE_ARTICLE_START.test(title) || VAGUE_TITLE_KEYWORDS.test(title)) {
      // Capitalize and clean up but can't invent a real name
      // At minimum, strip the vague qualifiers
      act.title = sanitizeAITextField(title);
      console.log(`[Generic title warning] "${title}" may be a placeholder`);
    }
  }
}
```

Also update the prompt (near line 9422) to extend the real-name requirement beyond meals:
```
ALL activities must use REAL, SPECIFIC venue names — not generic descriptions.
"Boutique Wellness in Omotesando" = VIOLATION. Use the actual spa/studio name.
"a kissaten" = VIOLATION. Name the specific kissaten.
```

**File**: `supabase/functions/generate-itinerary/index.ts`

---

### Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Add empty `()` removal + forward-reference stripping to `sanitizeAITextField` |
| `src/utils/textSanitizer.ts` | Add empty `()` removal to client-side `sanitizeAIOutput` |
| `supabase/functions/generate-itinerary/index.ts` | Add Return to Hotel description cleaner, generic title warning, and prompt updates requiring real venue names for all activities |

