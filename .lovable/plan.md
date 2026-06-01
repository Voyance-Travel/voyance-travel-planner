## Finding

The backend itself is healthy, and `LOVABLE_API_KEY` exists in the project secrets list. The deployed `generate-itinerary` function is still failing because its runtime environment is not receiving that secret:

```text
AICallError: LOVABLE_API_KEY missing
Initial chain attempt 3/3 returned 500
```

So this is no longer a schema issue or a Day 4 timing issue. It is an edge-function runtime/secret propagation problem.

## Plan

1. **Re-provision the managed AI key**
   - Run the dedicated Lovable AI key creation/repair tool so the managed `LOVABLE_API_KEY` is definitely attached to the project runtime, not just visible in the secrets list.

2. **Redeploy `generate-itinerary` immediately**
   - Force a fresh deployment so the function runtime receives the repaired secret environment.

3. **Verify with function logs, not assumptions**
   - Re-check `generate-itinerary` logs for the exact error string `LOVABLE_API_KEY missing`.
   - If gone, run a direct function call for the chain entrypoint and confirm it passes the AI-call stage.

4. **Only if the secret still does not propagate**
   - Escalate to a runtime fallback: update the AI-call guard to also read the managed key through the standard Deno runtime secret name variants if this project’s deployment environment is using a different injection alias.
   - Redeploy again and verify logs.

## Not doing

- No new schema changes.
- No Day 4 timing changes.
- No frontend styling or unrelated itinerary logic changes.
- No guessing; each step is validated against deployed function logs.