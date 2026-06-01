Do I know what the issue is? Yes.

The current Day 1 failure is no longer the missing `trips.*` schema-column issue. The backend now gets past trip facts, profile loading, prompt compilation, and day schema compilation. It fails only when calling the AI service:

```text
[ai-call] AI gateway error (attempt 1): 401
Invalid API key format. Key must start with 'sk_' prefix.
```

That means the deployed `generate-itinerary` function is using an invalid/malformed managed `LOVABLE_API_KEY`. Because Day 1 requires the AI call, every itinerary now dies at the same point and surfaces as `Initial chain failed (status=500)`.

Plan:

1. Rotate the managed Lovable AI gateway key
   - Use the dedicated Lovable AI key rotation tool, not the generic secrets editor.
   - This should replace the malformed key with a valid server-side key.

2. Redeploy `generate-itinerary`
   - Ensure the edge function picks up the refreshed backend environment.
   - No database migration is needed.

3. Add a fail-fast guard around AI calls
   - In `generate-itinerary/pipeline/ai-call.ts`, detect missing or obviously malformed AI gateway keys before attempting generation.
   - Return/log a specific configuration error instead of retrying and collapsing into the generic `AI generation failed` / `Initial chain failed` toaster.
   - This prevents future debugging loops where infrastructure auth problems look like itinerary logic bugs.

4. Keep the earlier schema fixes intact
   - Do not add database columns just to satisfy stale code.
   - Leave `dietary_restrictions`, `interests`, and `destination_iata` sourced from metadata/profile/flight-hotel fallbacks as already patched.

5. Verify against the failing path
   - Trigger or directly call the deployed `generate-itinerary` Day 1 path.
   - Confirm logs no longer contain `Invalid API key format`.
   - Confirm execution proceeds past `callAI` into validation/repair stages, or if it fails later, capture the new downstream error separately.

Out of scope for this recovery:
- The Day 4 airport-transfer cosmetic timing window.
- Any new database schema changes.
- Frontend styling or toaster copy beyond clearer backend error propagation if needed.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
  <presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>