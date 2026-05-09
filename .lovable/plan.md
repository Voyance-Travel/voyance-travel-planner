## RS.M.I2 — Synthesize a placeholder day instead of failing the response

### Context

`supabase/functions/generate-itinerary/action-generate-day.ts` is an HTTP edge handler. The current parse-fail paths (lines 288, 292, 296) throw, which bubbles to the outer catch (line 1758) and returns a 500 to the caller — the day save fails and the user sees an error.

There is no explicit retry loop; the three throw sites are the equivalent of "all retries exhausted" for parsing the AI output (no tool_call, no embedded JSON, or content not parseable). The intent of RS.M.I2 is to fall through to post-processing with an empty-but-valid day so meal-guard + dead-gap-fill produce something recoverable.

`generatedDay` is consumed by ~1500 lines of post-processing below. All required scope variables (`dayNumber`, `resolvedDestination`, `destination`, `date`) are already in scope.

### Change

**File:** `supabase/functions/generate-itinerary/action-generate-day.ts` (lines 270–297)

Replace the three throw sites in the parse block with a single shared placeholder synthesizer. Track the failure reason for telemetry/UI.

```ts
const message = data.choices?.[0]?.message;
const toolCall = message?.tool_calls?.[0];

let generatedDay: any;
let parseFailureReason: string | null = null;

const buildPlaceholderDay = (reason: string) => {
  console.error('[action-generate-day] All retries exhausted, returning placeholder day', {
    dayNumber,
    destination: resolvedDestination || destination,
    reason,
  });
  parseFailureReason = reason;
  return {
    dayNumber,
    date: date || '',
    title: `Day ${dayNumber} in ${resolvedDestination || destination || 'your destination'}`,
    theme: 'Generation failed — retry recommended',
    description:
      'We had trouble generating this day. Tap regenerate to try again, or browse alternatives.',
    activities: [], // meal-guard + dead-gap-fill will populate basic structure
    metadata: {
      quality: {
        generation_failed: true,
        generation_error: reason.slice(0, 200),
        generated_at: new Date().toISOString(),
        retry_recommended: true,
      },
    },
  };
};

if (toolCall?.function?.arguments) {
  try {
    generatedDay = sanitizeGeneratedDay(
      sanitizeOptionFields(sanitizeDateFields(JSON.parse(toolCall.function.arguments))),
      dayNumber, resolvedDestination, paramUsedRestaurants,
    );
  } catch (parseErr) {
    console.error('[generate-day] tool_call arguments not parseable:', parseErr);
    generatedDay = buildPlaceholderDay(`tool_call parse failed: ${(parseErr as Error)?.message || 'unknown'}`);
  }
} else if (message?.content) {
  console.log('[generate-day] AI returned content instead of tool_call, attempting to parse...');
  try {
    const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generatedDay = sanitizeGeneratedDay(
        sanitizeOptionFields(sanitizeDateFields(JSON.parse(jsonMatch[0]))),
        dayNumber, resolvedDestination, paramUsedRestaurants,
      );
    } else {
      console.error('[generate-day] No JSON found in content:', contentStr.substring(0, 500));
      generatedDay = buildPlaceholderDay('no JSON in content');
    }
  } catch (parseErr) {
    console.error('[generate-day] Failed to parse content as JSON:', parseErr);
    generatedDay = buildPlaceholderDay(`content not parseable: ${(parseErr as Error)?.message || 'unknown'}`);
  }
} else {
  console.error('[generate-day] Invalid AI response - no tool_calls or content:', JSON.stringify(data).substring(0, 1000));
  generatedDay = buildPlaceholderDay('no tool_calls or content in AI response');
}
```

Also wrap the existing `JSON.parse(toolCall.function.arguments)` (currently un-`try`-d at line 276) in the same handler — that's the most common failure mode and it currently bubbles up to the 500.

### Notes

- Post-processing already tolerates `activities: []` — meal-guard injects required meals, dead-gap-fill adds activities, and universalQualityPass handles bookends. Empty days flow through cleanly.
- `metadata.quality.generation_failed` is the sentinel the UI/health panel can read to surface "tap regenerate" hint (no UI change required for this fix).
- `parseFailureReason` stays local; we don't change the success-shape response contract.
- No change to the outer catch — genuine non-parse errors (auth, network) still 500 as before.

### Verify

```bash
grep -c "generation_failed\|All retries exhausted" \
  supabase/functions/generate-itinerary/action-generate-day.ts
```
Expect ≥ 2 (will be 3: the log line, the metadata flag literal, plus reason).
