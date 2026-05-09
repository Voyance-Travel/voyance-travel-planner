# Fix #6 — `TRUNCATED_SENTENCE` repair handler + gate handler

Small, surgical change. No new shared modules needed — the trim helper is one-liner regex used in two places.

## Changes

### 1. `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
Line 1005: change `severity: 'error'` → `severity: 'critical'`.

Verified safe: `action-generate-day.ts:1190` groups `error` and `critical` together, and the validation gate already has a `default` branch for unhandled criticals (it would blank the field). The explicit case below is preferable so we trim instead of blanking.

### 2. `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
Add a new step `10c` immediately after the unified scrub block at line 2816, before step 12. Iterate `activities`, skip `lockedIds`. For each, run a local `trimToLastSentence(value)` helper:

```ts
function trimToLastSentence(value: string): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length < 40) return null;
  // Already terminated → no-op (mirror validate-day's SENTENCE_END_RE check)
  if (/[.!?…)"'’”\]]\s*$/.test(v)) return null;
  const m = v.match(/^(.*[.!?…])\s*[^.!?…]*$/s);
  if (m && m[1].length >= 40) return m[1].trim();
  return null; // ship fragment rather than blank
}
```

For each of `description`, `tips`, `notes`, attempt the trim. On change push `repairs.push({ code: FAILURE_CODES.TRUNCATED_SENTENCE, activityIndex: i, field, action: 'trim_to_last_sentence', before, after })`.

### 3. `supabase/functions/generate-itinerary/pipeline/validation-gate.ts`
Add explicit case before the `default` branch (around line 124):

```ts
case FAILURE_CODES.TRUNCATED_SENTENCE: {
  if (r.field && typeof act[r.field] === 'string') {
    const trimmed = trimToLastSentence(act[r.field]);
    if (trimmed != null && trimmed !== act[r.field]) {
      act[r.field] = trimmed;
      counters.blankedFields++;       // re-using existing counter as spec instructs
      counters.forcedDowngrades++;
    }
    // No terminator at all → leave field unchanged (don't fall into default which blanks).
  }
  break;
}
```

Co-locate `trimToLastSentence` at the bottom of `validation-gate.ts` (or export from `repair-day.ts` — gate already imports from `_shared`, so a tiny private duplicate is fine and avoids cross-pipeline import gymnastics). Default branch is left alone per spec.

## Tests

### New: `supabase/functions/generate-itinerary/__tests__/truncated-sentence.test.ts`
- Validator: description ending mid-sentence after one complete sentence emits `TRUNCATED_SENTENCE` with `severity: 'critical'`.
- Validator: properly terminated string → no result.
- Repair: input `"Wander Cannaregio. The light through the"` → trimmed to `"Wander Cannaregio."`.
- Repair: input with no terminator at all → unchanged, no repairs entry.
- Gate: same trim case fires when repair is bypassed; `counters.blankedFields === 1`.
- Gate: no-terminator field is left unchanged and gate does NOT blank it.

### Out of scope (per user spec)
The "walk-over-threshold" / `validation-gate.test.ts` extensions and the seven UI-wiring sites referenced in the message are already in place from Fix #5 and the earlier `sanitizeActivityText` rollout. No-op here.

## Memory
Append a one-liner to `mem://constraints/itinerary/validation-gate-blocking-layer` noting that `TRUNCATED_SENTENCE` is now `critical` with a dedicated trim handler in both repair-day (step 10c) and the gate, and that the gate preserves the field when no sentence boundary exists rather than blanking.

## Deploy
Deploy `generate-itinerary` edge function; run `truncated-sentence.test.ts`.
