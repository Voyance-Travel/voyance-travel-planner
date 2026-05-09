## L7 — Itinerary chat stream cleanup warning comment

**File:** `supabase/functions/itinerary-chat/index.ts` (L715–L719)

**Change:** Add a warning comment + `console.warn` to the dormant `if (stream)` branch. No behavior change for any current caller (frontend uses `stream: false`).

### Edit

Replace L715–L719:
```ts
    if (stream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
```

With:
```ts
    if (stream) {
      // WARNING: Streaming mode is currently UNUSED in production (frontend
      // calls with stream: false). Re-enabling streaming requires:
      //   - Cost tracking refactor — currently fires post-stream, won't fire
      //     if client disconnects mid-stream
      //   - Mutation extraction (lines 688-905) is bypassed on this branch
      //   - Cleanup handlers (cost save, idempotency record) miss the stream path
      // Until those are addressed, do not flip frontend to stream: true.
      console.warn('[itinerary-chat] Streaming mode invoked — verify cost tracking + mutation paths first');
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
```

### Verify
```
grep -c "Streaming mode is currently UNUSED" supabase/functions/itinerary-chat/index.ts
```
Expect ≥ 1.

### Out of scope
- No refactor of streaming behavior. No frontend change. No billing/cost path change.
