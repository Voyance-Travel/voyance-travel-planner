

## Fix: Strip Quoted Archetype Labels in Prose

### Problem
Archetype labels like "Solo Retreat" are now appearing wrapped in single/double quotes within prose sentences (e.g., "This is your 'Solo Retreat' moment"), bypassing existing parenthetical/suffix/ALL-CAPS stripping.

### Change

**File: `supabase/functions/generate-itinerary/sanitization.ts`** — in `sanitizeAITextField`, after line 120 (the truncated orphan fragment strip), add two new patterns:

1. **Quoted archetype phrase in context**: Strip `your/a/the 'Label' moment/stop/experience` phrases.
2. **Full "This is your..." sentence**: Strip entire sentences like "This is your 'Solo Retreat' moment (shared with your partner) away from the steep hills."

```typescript
// After line 120, add:

// Strip archetype labels in quotes within prose: "your 'Solo Retreat' moment" → ""
.replace(/\b(?:your|a|an|the|this)\s+['"][A-Za-z\s]+['"]\s+(?:moment|stop|experience|encounter|highlight|retreat)\b\s*/gi, '')
// Strip full "This is your/a 'Archetype' moment..." sentences
.replace(/(?:^|\.\s*)This\s+is\s+(?:your|a|an)\s+['"]?(?:Solo\s+Retreat|Deep\s+Context|Authentic\s+Encounter|Cultural\s+Highlight|Hidden\s+Gem|Wellness|Romance|Adventure|Family|Budget|Luxury)['"]?\s+(?:moment|stop|experience|encounter)\b[^.]*\.?\s*/gi, '')
```

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — 2 regex lines added after line 120

