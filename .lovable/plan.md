## Root cause

The `generate-itinerary` edge function is failing to boot:

```
worker boot error: Uncaught SyntaxError: Identifier 'titleLower' has already been declared
  at action-repair-costs.ts:386:13
```

Because the function never starts, every browser request fails the CORS preflight (the OPTIONS response never returns), which is what produces:

- `CORS policy: Response to preflight request doesn't pass access control check`
- `FunctionsFetchError: Failed to send a request to the Edge Function`
- `[EditorialItinerary] Backend save failed`

The `[Itinerary reconcile] Day totals exceed trip total` warning is downstream noise from the failed save.

## Source of the duplicate

In `supabase/functions/generate-itinerary/action-repair-costs.ts`, inside the same activity-loop scope:

- Line 304: `const titleLower = title.toLowerCase();` (used by the bar-cap / drinks check)
- Line 366: `const titleLower = title.toLowerCase();` (re-declared for the Michelin drinks bypass — added in the recent "Repair-Costs Bar Cap & Drinks Bypass Parity" change)

Two `const` declarations of the same identifier in the same block = boot-time `SyntaxError`, so the function never deploys cleanly.

## Fix

Remove the second `const titleLower = title.toLowerCase();` at line 366 and rely on the one already declared at line 304. The drinksFraming line below it keeps working unchanged because `titleLower` is still in scope.

After the edit, redeploy `generate-itinerary` and verify:

1. `supabase--edge_function_logs generate-itinerary` shows a clean boot (no `BootFailure`).
2. A test call via `supabase--curl_edge_functions` returns 200 / proper JSON instead of failing CORS.
3. In the preview, an itinerary save no longer logs `FunctionsFetchError` or the CORS error.

## Files touched

- `supabase/functions/generate-itinerary/action-repair-costs.ts` — delete one line (the duplicate `const titleLower` at ~366).

No other files, no schema changes, no UI changes.
