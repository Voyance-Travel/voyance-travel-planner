## Goal
Make `summarize-trip-learnings` resilient: if the AI call fails, errors, or returns a too-short result, fall back to the existing `generateBasicSummary()` and record which path produced the summary via a new `summary_source` column.

## Changes

### 1. Migration: `trip_learnings.summary_source`
```sql
ALTER TABLE public.trip_learnings
  ADD COLUMN IF NOT EXISTS summary_source TEXT DEFAULT 'ai';
```
No RLS changes — column piggybacks on existing policies.

### 2. `supabase/functions/summarize-trip-learnings/index.ts`
Refactor the main handler to a single try/catch around the AI call, then a single upsert/update path:

```ts
let lessonsSummary = '';
let summarySource: 'ai' | 'fallback' = 'ai';

try {
  if (!LOVABLE_API_KEY) throw new Error('No LOVABLE_API_KEY configured');

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { /* existing body */ });
  if (!response.ok) throw new Error(`AI request failed: ${response.status}`);

  const aiResult = await response.json();
  lessonsSummary = aiResult.choices?.[0]?.message?.content?.trim() || '';

  if (!lessonsSummary || lessonsSummary.length < 20) {
    throw new Error('AI returned empty/short summary');
  }
} catch (err) {
  console.warn('[summarize] AI failed, using rule-based fallback:', err instanceof Error ? err.message : err);
  lessonsSummary = generateBasicSummary(context);
  summarySource = 'fallback';
}

await supabase
  .from('trip_learnings')
  .update({
    lessons_summary: lessonsSummary,
    summary_source: summarySource,
  })
  .eq('id', learning.id);

return new Response(
  JSON.stringify({ summary: lessonsSummary, summary_source: summarySource }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

Notes:
- Removes the duplicate "no API key" early-return branch (now folded into the try/catch).
- Keeps using `update` (not `upsert`) keyed by `learning.id`, matching current behavior — the row is guaranteed to exist because we fetch it at line 39.
- Outer try/catch (around request parsing / row fetch) stays untouched.
- `summarized_at` column not added — not in current schema; user pseudocode mentioned it but the table doesn't have it. Leaving out unless requested.

## Verification
- `summary_source` column exists.
- With `LOVABLE_API_KEY` unset (or AI returning <20 chars), row gets `summary_source = 'fallback'` and `lessons_summary` populated by `generateBasicSummary`.
- Happy path still writes `summary_source = 'ai'`.
