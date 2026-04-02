

## Strip Internal Archetype/Category Labels From Titles & Descriptions

### Problem
AI-generated activities leak internal template labels like "The Deep Context Stop", "Solo Retreat Stop", etc. into user-visible titles and descriptions. Examples:
- "Jerónimos Monastery: The Deep Context Stop"
- "Relaxing at Jardim da Estrela: Solo Retreat Stop"
- Description prefix: "Solo Retreat: A peaceful, lush park..."

### Fix

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Add three new `.replace()` calls to the `sanitizeAITextField` chain (after the existing system prefix stripping around line 76):

1. **Strip archetype/category label suffixes from titles** — matches patterns like `: The Deep Context Stop`, `- Solo Retreat Stop`, `– Cultural Highlight Stop` at end of string
2. **Strip label used as description prefix** — matches `Solo Retreat: ...`, `Deep Context: ...` at start of string
3. **Catch any remaining `... Stop` suffixed labels** — broad pattern for any `: XYZ Stop` at end of string

```typescript
// After line 84 (.replace(TOMORROW_REF_RE, '')):

// Strip archetype/category label suffixes: "Name: The Deep Context Stop"
.replace(/\s*[:–—-]\s*(?:The\s+)?(?:Deep\s+Context|Solo\s+Retreat|Cultural\s+Highlight|Group\s+Activity|Wellness|Food|Shopping|Adventure|Family|Romance|Luxury|Budget|Hidden\s+Gem)(?:\s+Stop)?\s*$/gi, '')
// Strip label as description prefix: "Solo Retreat: A peaceful..."
.replace(/^(?:Solo\s+Retreat|Deep\s+Context|Cultural\s+Highlight|Group\s+Activity|Wellness|Food\s+Stop|Hidden\s+Gem|Adventure|Shopping|Romance|Luxury|Budget)\s*:\s*/gi, '')
// Catch remaining "... Stop" suffixed labels at end
.replace(/\s*[:–—-]\s*(?:The\s+)?\w+(?:\s+\w+){0,2}\s+Stop\s*$/gi, '')
```

No new files. No prompt changes. No pipeline changes. The existing `sanitizeGeneratedDay` already calls `sanitizeAITextField` on `act.title`, `act.name`, and `act.description`, so all fields are covered.

