## Problem

User sees: **"A sensory retreat at the's historic mosque"** in the Grande Mosquée de Paris hammam description. The AI dropped a noun between `the` and `'s`, producing an orphan possessive.

## Root cause

We already repair this exact pattern in two places:

- `supabase/functions/generate-itinerary/sanitization.ts` (line ~1069)
- `src/utils/activityNameSanitizer.ts` → `sanitizeActivityText()` (line ~190)

Both use the regex `/\bthe'\s?s\b/gi`. Verified with a quick test:

| Input | Repaired? |
|---|---|
| `the's` (ASCII `'`) | yes |
| `the' s` | yes |
| `the’s` (curly U+2019) | **NO** |
| `the’ s` | **NO** |

So whenever the model emits a curly/typographic apostrophe (very common with Gemini/GPT on French content like "Mosquée"), the repair is bypassed and the broken phrase reaches the UI.

## Fix

Broaden the apostrophe character class to match both ASCII and curly apostrophes in both sanitizers, plus the orphan-name title sanitizer added in the previous fix.

### Code changes

1. **`src/utils/activityNameSanitizer.ts`** — replace the two existing `the's` regexes (in `sanitizeActivityName` and `sanitizeActivityText`) with:
   ```ts
   /\bthe['’]\s?s\b/gi
   ```

2. **`supabase/functions/generate-itinerary/sanitization.ts`** — same change at line ~1069 so future generations are repaired server-side too.

### Tests

Extend `src/utils/__tests__/activityNameSanitizer.test.ts` with cases covering both apostrophe variants:

- `"A sensory retreat at the’s historic mosque"` → `"A sensory retreat at the city's historic mosque"`
- `"Walk the’ s old quarter"` → `"Walk the city's old quarter"`

## Out of scope

- No DB rewrite of legacy stored descriptions — the renderer-side repair (`sanitizeActivityText`) covers all surfaces that already use it (EditorialItinerary, FullItinerary, planner cards). A handful of secondary surfaces (LiveActivityCard, ActivityModal, BookableItemCard, CommunityGuideActivityCard) still print `activity.description` raw; that's a broader hygiene cleanup, not part of this targeted bug fix.
