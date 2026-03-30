

## Fix: Strip AI Self-Commentary and Internal Reasoning from Descriptions

### Problem

The existing self-commentary regex in `sanitization.ts` (line 92) only catches one narrow pattern:
```
"This addresses/fulfills/satisfies the X interest/preference..."
```

But the AI leaks many other reasoning patterns:
- **"Since the traveler..."** — explaining why it chose something
- **"providing a necessary bridge between..."** — justifying scheduling
- **"(Note: No spa facilities used as per arche hard block...)"** — parenthetical internal constraint notes
- **"This focuses on..."** / **"This ensures..."** — meta-commentary about its own output

### Fix

**File: `supabase/functions/generate-itinerary/sanitization.ts` (line 91-92)**

Add additional regex rules after the existing self-commentary line to catch these categories:

1. **"Since the traveler/user/guest..."** sentences — AI explaining its reasoning about traveler preferences
2. **Parenthetical internal notes** — `(Note: ...)` blocks referencing archetypes, hard blocks, constraints, slot logic
3. **Bridge/transition justifications** — "providing a necessary bridge/transition/balance between..."
4. **"This focuses on / ensures / provides / creates..."** meta-commentary about the activity's purpose in the itinerary structure
5. **Archetype/constraint references** — any mention of "archetype", "hard block", "soft block", "as per arche", "slot", "post-processing"

New regexes to add (after line 92):

```typescript
// "Since the traveler/user/guest loves/prefers/enjoys..." reasoning sentences
.replace(/(?:^|\.\s*)Since\s+(?:the|this|your)\s+(?:traveler|user|guest|visitor|group)\s+[^.]*\./gi, '')
// Parenthetical internal notes: (Note: ... archetype/hard block/constraint ...)
.replace(/\s*\([^)]*?\b(?:arche(?:type)?|hard\s+block|soft\s+block|constraint|slot|post-process|as per)\b[^)]*?\)/gi, '')
// "providing/offering a necessary bridge/transition/balance between..."
.replace(/,?\s*providing\s+a\s+(?:necessary|needed|important|useful|natural)\s+(?:bridge|transition|balance|buffer|counterpoint)\s+[^.]*\.?/gi, '')
// "This focuses on/ensures/provides/creates..." meta-commentary
.replace(/(?:^|\.\s*)This\s+(?:focuses on|ensures|provides|creates|offers|gives|delivers|serves as)\s+[^.]*\.?/gi, '')
// Any sentence mentioning internal system terms
.replace(/(?:^|\.\s*)[^.]*\b(?:archetype|hard\s+block|soft\s+block|generation\s+rule|as per arche)\b[^.]*\.?/gi, '')
```

### Also apply to frontend sanitizer

**File: `src/utils/activityNameSanitizer.ts`** — The `sanitizeActivityText` function should get matching rules for the parenthetical notes pattern (the most visually jarring leak), since it's applied independently of the backend sanitizer.

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/sanitization.ts` (line 92) | Add 5 new regex rules to strip AI self-commentary patterns |
| `src/utils/activityNameSanitizer.ts` | Add parenthetical internal-note stripping to `sanitizeActivityText` |

