

## Strip Internal Archetype/Category Labels From Titles & Descriptions

### Problem
AI archetype labels like "Deep Context", "Solo Retreat", "Authentic Encounter" leak into user-visible text in multiple formats: parenthetical `(Deep Context)`, colon-suffix `Jerónimos Monastery: The Deep Context Stop`, ALL-CAPS in descriptions `(DEEP CONTEXT - Historical significance...)`, description prefixes `Solo Retreat: A peaceful...`, and ALL-CAPS words in transit names `DISTRICT`.

### Current State
`sanitization.ts` lines 86-90 already have partial coverage but miss:
- Parenthetical labels: `(Deep Context)`, `(Solo Retreat)`, `(Authentic Encounter)`
- ALL-CAPS with explanations: `(DEEP CONTEXT - Historical significance...)`
- `(SOLO RETREAT moment)` style
- `The Deep Context Stop` (with "The" prefix) in colon-suffix patterns
- `Authentic Encounter` in description prefixes
- ALL-CAPS `DISTRICT` in transit names

### Changes

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Replace lines 86-90 in the `sanitizeAITextField` chain with expanded patterns:

```typescript
// Strip parenthetical archetype labels: "(Deep Context)", "(Solo Retreat)", etc.
.replace(/\s*\((?:Deep\s+Context|Solo\s+Retreat|Authentic\s+Encounter|Cultural\s+Highlight|Group\s+Activity|Hidden\s+Gem|Family\s+Stop|Romance\s+Stop|Luxury\s+Stop|Budget\s+Stop|Adventure\s+Stop|Wellness\s+Stop)\)\s*/gi, '')
// Strip ALL-CAPS archetype labels with explanations: "(DEEP CONTEXT - Historical significance...)"
.replace(/\s*\((?:DEEP\s+CONTEXT|SOLO\s+RETREAT|AUTHENTIC\s+ENCOUNTER|CULTURAL\s+HIGHLIGHT)\s*[-–—]?\s*[^)]*\)\s*/g, '')
// Strip "(SOLO RETREAT moment)" and similar
.replace(/\s*\(\s*(?:SOLO\s+RETREAT|DEEP\s+CONTEXT)\s+\w+\s*\)\s*/gi, '')
// Strip colon-suffix labels: "Name: The Deep Context Stop"
.replace(/\s*[:–—-]\s*(?:The\s+)?(?:Deep\s+Context|Solo\s+Retreat|Cultural\s+Highlight|Group\s+Activity|Wellness|Food|Shopping|Adventure|Family|Romance|Luxury|Budget|Hidden\s+Gem|Authentic\s+Encounter)(?:\s+Stop)?\s*$/gi, '')
// Strip label as description prefix: "Solo Retreat: ..." "The Deep Context Stop: ..."
.replace(/^(?:Solo\s+Retreat|Deep\s+Context|The\s+Deep\s+Context\s+Stop|Cultural\s+Highlight|Group\s+Activity|Authentic\s+Encounter|Wellness|Food\s+Stop|Hidden\s+Gem|Adventure|Shopping|Romance|Luxury|Budget)\s*:\s*/gi, '')
// Catch remaining "... Stop" suffixed labels at end
.replace(/\s*[:–—-]\s*(?:The\s+)?\w+(?:\s+\w+){0,2}\s+Stop\s*$/gi, '')
// Strip ALL-CAPS "DISTRICT" from transit/location names
.replace(/\s+DISTRICT\b/g, '')
```

Key additions vs current code:
1. **New** parenthetical label pattern (line 86 currently doesn't exist)
2. **New** ALL-CAPS with explanation pattern
3. **New** `(SOLO RETREAT moment)` pattern
4. **Updated** colon-suffix pattern adds `Authentic\s+Encounter`
5. **Updated** description prefix adds `The\s+Deep\s+Context\s+Stop` and `Authentic\s+Encounter`
6. **New** `DISTRICT` stripping

No new files. No pipeline changes. No prompt changes. Just regex additions in the sanitization chain + redeploy.

