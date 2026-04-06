

## Fix Garbled/Truncated Day Titles

### Problem
Day title "Arrival in Lisbon, the of Seven Hills" — the word "City" is missing. The existing `sanitizeAITextField` (line 195) only catches `in the of` but NOT `, the of` (comma-prefixed). The day title passes through `sanitizeAITextField` at line 253, so fixing the regex there will cover day titles too.

### Plan (2 files)

**File 1: `supabase/functions/generate-itinerary/sanitization.ts`**

**Change 1: Broaden the "the of" fix** (line 195)
The current regex only matches `in the of`. Expand to also catch `, the of` and standalone `the of`:
```typescript
// ", the of [Noun]" or "the of [Noun]" → ", the City of [Noun]" (with destination context)
result = result.replace(/,\s*the\s+of\b/gi, ', the City of');
result = result.replace(/\bin the of\b/gi, 'in ' + destination + ', the City of');
```

**Change 2: Add garbled day title detection + logging** (after line 256, after day.title is set)
Add validation and cleanup for common garbled patterns in day titles:
```typescript
// Garbled day title detection
const GARBLED_TITLE_PATTERNS = [
  /\bthe\s+of\b/i,    // missing noun: "the of"
  /\ba\s+of\b/i,       // missing noun: "a of"
  /\ban\s+of\b/i,      // missing noun: "an of"
  /\s{2,}/,            // double spaces (dropped word)
  /,\s*$/,             // trailing comma
  /^,/,                // leading comma
];
const titleToCheck = day.title;
for (const p of GARBLED_TITLE_PATTERNS) {
  if (p.test(titleToCheck)) {
    console.warn(`GARBLED DAY TITLE: "${titleToCheck}" matched ${p}`);
    break;
  }
}
day.title = day.title.replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').replace(/^,\s*/, '').trim();
```

**File 2: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

**Change 3: Add day title quality rule** (after line 856, in the OUTPUT QUALITY section)
```
DAY TITLE RULES:
- Day titles must be complete, grammatically correct phrases under 60 characters.
- Every article (the, a, an) must be followed by a noun, never directly by a preposition.
- BAD: "Arrival in Lisbon, the of Seven Hills" — GOOD: "Arrival in Lisbon, the City of Seven Hills"
```

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — broaden "the of" regex fix, add garbled title detection
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add day title quality rule to prompt

### Verification
Generate a 4-day Lisbon trip. Confirm all day titles are grammatically complete with no "the of" patterns or truncated phrases.

