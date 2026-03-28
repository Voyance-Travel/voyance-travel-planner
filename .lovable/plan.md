

## Strip Hallucinated Venue Alternatives & Add Prompt Guardrails

### Problem
The AI generates inline alternative venues like "at The Blue Note Jaffa or a private jazz lounge like the Cotton Club" — where "Blue Note Jaffa" is hallucinated. The existing `AI_QUALIFIER_RE` only catches parenthetical qualifiers like `(or high-end alternative)`, not inline prose alternatives.

Additionally, the prompt at **line 1345-1347** actively instructs the AI to include "Tomorrow: Wake up..." text in tips — which the sanitizer then strips. This is contradictory.

### Changes

**1. `sanitization.ts` — Add inline alternative venue regex (after line 77)**

```typescript
// Matches "… or a/an [description] like/such as the [Venue]" inline alternatives
const INLINE_ALT_VENUE_RE = /\s+or\s+(?:a|an)\s+[^.]*?(?:like|such\s+as)\s+(?:the\s+)?[A-Z][a-zA-Z\s''-]+/gi;
```

Add `.replace(INLINE_ALT_VENUE_RE, '')` to `sanitizeAITextField` chain after `TRAILING_OR_QUALIFIER_RE`.

**2. `src/utils/activityNameSanitizer.ts` — Mirror the same regex**

Add the same `INLINE_ALT_VENUE_RE` pattern and `.replace()` call to both `sanitizeActivityName` and `sanitizeActivityText` for defense-in-depth.

**3. `prompt-library.ts` — Fix contradictory prompt & add output rules**

- **Remove lines 1345-1347** (the "NEXT MORNING PREVIEW" instruction that tells the AI to put "Tomorrow: Wake up..." in tips). This contradicts the sanitizer and leaks planning text.

- **Add a TEXT QUALITY RULES section** after the COSTS block (~line 1355), before ACTIVITY DENSITY:

```typescript
lines.push(`   TEXT QUALITY RULES:`);
lines.push(`   - Never include "or [alternative venue]" in descriptions. Name only the primary venue.`);
lines.push(`   - Never include reservation urgency codes (book_now, book_soon) in any text field.`);
lines.push(`   - Never include "Tomorrow:" or next-day planning text in tips or descriptions.`);
lines.push(`   - The "tips" field is for practical visitor advice ONLY (dress code, best time, queue tips).`);
lines.push(`   - Do not reference internal slot names, option groups, or fulfillment logic.`);
lines.push('');
```

**4. Redeploy** the `generate-itinerary` edge function.

### Why This Works
- The regex catches prose-style alternatives that slip past the existing parenthetical filter
- Removing the contradictory "Tomorrow:" prompt instruction eliminates the source of the leak rather than just sanitizing it after the fact
- The TEXT QUALITY RULES block gives the AI explicit guardrails at generation time, reducing the need for post-hoc sanitization

