

## Fix 23G: System Text Sanitization

### Problem
Internal constraint annotations (e.g., "User-specified must-do activity. DO NOT modify.") leak into customer-facing titles, descriptions, and PDF exports.

### Approach
1. Create a shared `cleanSystemAnnotations()` utility used by both frontend and edge function
2. Extend the existing backend `sanitizeAITextField()` with the same patterns
3. Apply defensively at all render/export points

### Changes

**File 1: `src/utils/textSanitizer.ts`** — NEW shared utility

Export `cleanSystemAnnotations(text)` with regex patterns for must-do annotations, constraint text, and system tags. This avoids duplicating patterns across multiple components.

**File 2: `supabase/functions/generate-itinerary/sanitization.ts`** (lines 62-72)

Add `SYSTEM_ANNOTATION_PATTERNS` array above `sanitizeAITextField()` and apply them inside the function before the final cleanup. Patterns:
- `user-specified must-do activity`
- `DO NOT modify`
- `user's scheduled event for this day`
- `tickets/advance booking required`
- `MUST END before HH:MM - must-do activity requires departure...`
- `this is your dedicated ... day`
- `[LOCKED]`, `[MUST-DO]`, `[USER-CONSTRAINT]`, `[SYSTEM]`

**File 3: `src/utils/activityNameSanitizer.ts`** (line ~46)

Add two regex replacements after the CJK strip and before the prefix strip:
```
sanitized = sanitized.replace(/user[- ]specified must[- ]do activity\.?\s*/gi, '');
sanitized = sanitized.replace(/DO NOT modify\.?\s*/gi, '');
```

**File 4: `src/components/itinerary/LiveActivityCard.tsx`** (line 176)

Import `cleanSystemAnnotations` from the new utility. Replace `{activity.description}` with `{cleanSystemAnnotations(activity.description)}`.

**File 5: `src/components/itinerary/FullItinerary.tsx`** (line 514)

Same — import and wrap `{cleanSystemAnnotations(activity.description)}`.

**File 6: `src/utils/tripPdfGenerator.ts`** (line 316)

Import `cleanSystemAnnotations`. Change:
```typescript
const descLines = pdf.splitTextToSize(cleanSystemAnnotations(activity.description), contentWidth - 25);
```

**File 7: `src/utils/consumerPdfGenerator.ts`** (line 315)

Same pattern — wrap `act.description` with `cleanSystemAnnotations()`.

### Files: 7
1. `src/utils/textSanitizer.ts` — **NEW** shared sanitizer
2. `supabase/functions/generate-itinerary/sanitization.ts` — Extend `sanitizeAITextField()`
3. `src/utils/activityNameSanitizer.ts` — Strip must-do text from titles
4. `src/components/itinerary/LiveActivityCard.tsx` — Sanitize rendered description
5. `src/components/itinerary/FullItinerary.tsx` — Sanitize rendered description
6. `src/utils/tripPdfGenerator.ts` — Sanitize PDF description output
7. `src/utils/consumerPdfGenerator.ts` — Sanitize PDF description output

