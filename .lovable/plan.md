## Plan: Route `suggest-hotel-swaps` through Lovable AI Gateway

Replace the broken `lovable-ai.lovable.dev` call (using `SUPABASE_ANON_KEY` as bearer — wrong key + wrong endpoint) with the standard gateway pattern used by `mid-trip-dna` / `dna-feedback-chat`.

### Change in `supabase/functions/suggest-hotel-swaps/index.ts`

1. Drop the dead `apiKey` line (L105) — `GOOGLE_AI_API_KEY` / `GEMINI_API_KEY` aren't used downstream.
2. Replace L107-122 with:

```ts
const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  }),
});
```

Preserves: model (`google/gemini-2.5-flash`), single-user-message shape (the existing prompt is self-contained — no system split needed), and `temperature: 0.3` (intentionally lower than the 0.7 in the user's example because the function returns a strict JSON array; bumping creativity would hurt parse rate).

3. Add 429/402 handling alongside the existing `!aiResponse.ok` branch so credit-exhaustion / rate-limit errors surface cleanly:

```ts
if (aiResponse.status === 429) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again shortly.' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
if (aiResponse.status === 402) {
  return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in Workspace settings.' }),
    { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

Response parsing (`aiData.choices?.[0]?.message?.content`) already matches the gateway's OpenAI-compatible shape — no changes needed below L130.

### Verify

- `grep -n "lovable-ai.lovable.dev\|ai.gateway.lovable.dev" supabase/functions/suggest-hotel-swaps/index.ts` → only `ai.gateway.lovable.dev` remains.
- `grep -n "SUPABASE_ANON_KEY\|SUPABASE_PROJECT_REF\|GOOGLE_AI_API_KEY\|GEMINI_API_KEY" supabase/functions/suggest-hotel-swaps/index.ts` → 0 hits.
- Edge function auto-deploys; no client-side changes.