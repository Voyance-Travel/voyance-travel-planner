## Bug
User-facing card descriptions show internal AI prompt scaffolding:
- `This satisfies your 'Deep Context' requirement`
- `(AESTHETIC slot)`
- `(slot)`

These should never appear in saved or rendered itinerary copy.

## Why current sanitizer misses them
`supabase/functions/generate-itinerary/sanitization.ts`:
- Line 1025 catches `satisfies your X interest|requirement` but its `\w+` group is **a single word**, so `'Deep Context'` (quoted, two words) slips through.
- Line 1031 catches parentheticals containing `archetype|slot\s+logic|...`, but **bare `(slot)` and `(AESTHETIC slot)`** (slot as a standalone word, no "logic" suffix) are not in the alternation.
- No rule strips ALL-CAPS slot tags like `(AESTHETIC slot)`, `(NARRATIVE slot)`, `(MOOD slot)`, etc.

`src/utils/textSanitizer.ts` has no equivalent guard, so previously-saved trips keep showing the artifacts.

## Plan

### 1. Server-side: tighten `sanitization.ts` (defense at write time)
Add three new replacements to the `removeBrackets`/text-clean pipeline (around lines 1025–1031):

```ts
// "This satisfies/fulfills/addresses your 'Archetype Name' requirement|slot|moment"
// — quoted (single OR double) multi-word archetype labels.
.replace(/(?:^|\.\s*)This\s+(?:addresses|fulfills|satisfies|aligns with|caters to|speaks to|reflects)\s+(?:the|your|their)\s+['"][^'"]{2,40}['"]\s+(?:interest|preference|request|need|requirement|slot|moment|stop|block)\b[^.]*\.?\s*/gi, '')

// Bare "(slot)" or "(<LABEL> slot)" / "(<LABEL> SLOT)"
.replace(/\s*\(\s*(?:[A-Z][A-Z\s/&-]{1,30}\s+)?slot\s*\)\s*/gi, '')

// "(AESTHETIC|NARRATIVE|MOOD|TONE|... <noun>)" — single ALL-CAPS label tag
.replace(/\s*\(\s*(?:AESTHETIC|NARRATIVE|MOOD|TONE|VIBE|THEME|ARCHETYPE|PERSONA|CONTEXT|FULFILLS?|SLOT)(?:\s+[A-Z][A-Z\s/&-]{0,30})?\s*\)\s*/g, '')
```

These run inside the existing master cleaner so every save path (generate, repair, refresh-day, save-itinerary) inherits the fix.

### 2. Frontend: extend `sanitizeText` in `src/utils/textSanitizer.ts` (defense at render time)
For already-saved trips that bypassed the server fix, add the same three replacements to `sanitizeText` so card descriptions, modal copy, and shared views are clean immediately on next render — no regen required.

### 3. Tests
Extend `src/test/noEmDashes.test.ts` (or add a sibling `src/utils/__tests__/textSanitizer.artifacts.test.ts`) with cases:
- `"This satisfies your 'Deep Context' requirement."` → empty/clean
- `"Visit the Doge's Palace (AESTHETIC slot)"` → `"Visit the Doge's Palace"`
- `"Cicchetti tour (slot)"` → `"Cicchetti tour"`
- Sentences that legitimately contain the word "slot" outside parentheses (e.g. "time slot") are preserved.

### Files touched
- `supabase/functions/generate-itinerary/sanitization.ts` — three added regex lines.
- `src/utils/textSanitizer.ts` — same three regexes mirrored into `sanitizeText`.
- `src/utils/__tests__/textSanitizer.artifacts.test.ts` — new test file.

### Out of scope
- AI prompt rewrites — root cause is the model leaking scaffolding; sanitizer is the durable defense.
- Cost/booking pipeline.
