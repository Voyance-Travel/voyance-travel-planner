

## Duplicate Description/Tips Detection

### Problem
Activities like "Return to Four Seasons" show identical leaked AI text in both `description` and `tips` fields.

### Change — Single file: `supabase/functions/generate-itinerary/sanitization.ts`

In `sanitizeGeneratedDay`, inside the activity map (after line 188, before `return act` on line 192), add:

```typescript
// Clear tips if it duplicates description (common AI leak pattern)
if (act.description && act.tips && act.description.trim() === act.tips.trim()) {
  act.tips = undefined;
}
```

Also add a **substring containment** check — sometimes the tips field contains the description verbatim plus extra meta-text, or vice versa:

```typescript
// Also clear tips if one fully contains the other (partial duplicate)
if (act.description && act.tips) {
  const descNorm = act.description.trim().toLowerCase();
  const tipsNorm = act.tips.trim().toLowerCase();
  if (descNorm.length > 10 && tipsNorm.includes(descNorm)) {
    act.tips = undefined;
  } else if (tipsNorm.length > 10 && descNorm.includes(tipsNorm)) {
    act.tips = undefined;
  }
}
```

Then redeploy the `generate-itinerary` edge function.

