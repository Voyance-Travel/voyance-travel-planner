

## Fix: System Prefixes Leaking Into Activity Descriptions

### Problem
Internal prompt labels like `SOLO_RETREAT:`, `AUTHENTIC_ENCOUNTER:`, etc. intermittently appear in activity **descriptions**, **voyanceInsight**, and **whyThisFits** fields — not just titles. The Venice trip showed "A SOLO_RETREAT moment in one of Lisbon's most peaceful squares…" in a description.

### Root Cause
Two sanitization layers exist, but neither strips system prefixes from non-title fields:

1. **`sanitizeAITextField`** (in `sanitization.ts`) — strips CJK characters and schema-leak patterns, but has **no awareness of system prefixes** like `SOLO_RETREAT:` or `AUTHENTIC_ENCOUNTER:`.
2. **`earlySaveItinerary`** (in `index.ts`, line 3196) — strips system prefixes, but **only from `act.title`**, not from `description`, `voyanceInsight`, `tips`, or `whyThisFits`.

So when the AI leaks a prefix into a description ("AUTHENTIC_ENCOUNTER: Indulge in a signature…"), neither layer catches it.

### Fix — 1 file

**`supabase/functions/generate-itinerary/sanitization.ts`**

Add system prefix stripping to `sanitizeAITextField` so it applies to **all** text fields (descriptions, insights, tips, etc.) — not just titles:

```typescript
const SYSTEM_PREFIXES_RE = /\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|WELLNESS_MOMENT|AUTHENTIC_ENCOUNTER|SOCIAL_EXPERIENCE|SOLO_RETREAT|DEEP_CONTEXT|SPLURGE_EXPERIENCE|VIP_EXPERIENCE|COUPLES_MOMENT|CONNECTIVITY_SPOT|FAMILY_ACTIVITY)\s*[:]\s*/gi;
```

Add `.replace(SYSTEM_PREFIXES_RE, '')` to the `sanitizeAITextField` chain. This catches prefixes anywhere in the string (not just at the start), handles both "A SOLO_RETREAT moment…" and "SOLO_RETREAT: Visit…" patterns, and is case-insensitive.

This single regex addition protects all fields that flow through `sanitizeAITextField`: title, name, description, tips, voyanceInsight, bestTime, whyThisFits, location name/address, and transportation instructions.

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — add system prefix regex to `sanitizeAITextField`

