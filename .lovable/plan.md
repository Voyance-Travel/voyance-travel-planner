

## Fix: Strip Remaining Archetype Orphan Fragments

### What's Already Done
The `sanitization.ts` file (lines 85-98) already strips parenthetical labels, ALL-CAPS explanations, colon-suffix labels, description prefixes, "... Stop" suffixes, and "DISTRICT". Activity titles and names already pass through `sanitizeAITextField` (lines 201-204).

### What's Missing
Two patterns confirmed in the bug report are not yet caught:

1. **Truncated orphan fragments** at the start of descriptions: "A moment. Wander away..." / "An interest. Visit the Ritz..." / "A stop. Explore the..."
2. **"This is a stop focusing on..."** prompt template language leaking into descriptions

### Change

**File: `supabase/functions/generate-itinerary/sanitization.ts`** — in `sanitizeAITextField`, add two `.replace()` calls after the existing archetype stripping block (after line 98, before line 99):

```typescript
// Strip truncated orphan archetype fragments at start of descriptions
// "A moment." / "An interest." / "A stop." etc.
.replace(/^(?:A|An)\s+(?:moment|interest|stop|experience|encounter|retreat|highlight)\.\s*/gi, '')
// Strip "This is a stop/moment/experience focusing/centered/based on..." template language
.replace(/(?:^|\.\s*)This\s+is\s+a\s+(?:stop|moment|experience)\s+(?:focusing|centered|based)\s+on\s+/gi, '')
```

No other files need changes. The `sanitizeGeneratedDay` function already applies `sanitizeAITextField` to both `act.title` and `act.name` (line 201-204), so no additional wiring is needed.

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — add 2 regex patterns

