## Bug
Day-2 cards render leaked AI scaffolding:
- `This satisfies your 'Deep Context' requirement`
- `(AESTHETIC slot)`
- `(slot)`

Reported as new-this-run. The earlier fix added strippers in `supabase/functions/generate-itinerary/sanitization.ts` (write-time) and `src/utils/textSanitizer.ts` (call sites in chat / manual paste). But the **itinerary card render path doesn't go through `sanitizeText`** — it goes through `sanitizeDisplayString` in `src/utils/itineraryParser.ts`, which only strips non-Latin scripts and JSON-schema leaks. So saved trips with the artifacts still display them.

## Plan

### 1. Extend `sanitizeDisplayString` in `src/utils/itineraryParser.ts`
Add the same three artifact regexes to the `.replace()` chain (lines 24–31):

```ts
// Strip leaked AI prompt scaffolding ("This satisfies your 'Deep Context' requirement",
// "(AESTHETIC slot)", "(slot)") that escaped the server-side sanitizer.
.replace(/(?:^|\.\s*)This\s+(?:addresses|fulfills|satisfies|aligns with|caters to|speaks to|reflects)\s+(?:the|your|their)\s+['"\u2018\u2019\u201C\u201D][^'"\u2018\u2019\u201C\u201D]{2,40}['"\u2018\u2019\u201C\u201D]\s+(?:interest|preference|request|need|requirement|slot|moment|stop|block)\b[^.]*\.?\s*/gi, '')
.replace(/\s*\(\s*(?:[A-Z][A-Z\s/&-]{1,30}\s+)?slot\s*\)\s*/gi, ' ')
.replace(/\s*\(\s*(?:AESTHETIC|NARRATIVE|MOOD|TONE|VIBE|THEME|ARCHETYPE|PERSONA|CONTEXT|FULFILLS?|SLOT)(?:\s+[A-Z][A-Z\s/&-]{0,30})?\s*\)\s*/g, ' ')
```

Because `sanitizeDisplayString` runs through `sanitizeUnknownStrings` against the entire activity payload (titles, descriptions, tags, narrative, highlights), this single change scrubs every visible field for both new and previously-saved trips on first render.

### 2. Add a regression test
`src/utils/__tests__/itineraryParser.artifacts.test.ts`:
- description with `"This satisfies your 'Deep Context' requirement."` → stripped
- title `"Doge's Palace (AESTHETIC slot)"` → `"Doge's Palace"`
- description ending in `"(slot)"` → stripped
- legitimate "time slot" prose preserved

### Files touched
- `src/utils/itineraryParser.ts` — three regex lines added inside `sanitizeDisplayString`.
- `src/utils/__tests__/itineraryParser.artifacts.test.ts` — new test file.

### Out of scope
- Server prompt rewrites (already-saved itineraries need a render-time defense).
- Any cost/booking changes.
