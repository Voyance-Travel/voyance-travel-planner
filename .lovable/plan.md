## Goal

Force-deploy the already-synced `generate-itinerary` edge function so the production bundle matches the current GitHub code. No code changes.

## Steps

1. Call `supabase--deploy_edge_functions` with `["generate-itinerary"]` to push a fresh build of the existing synced source.
2. Smoke-check via `supabase--curl_edge_functions` (`action: 'get-itinerary'` on an existing trip) to confirm the new bundle boots without import errors.
3. Report new deployment timestamp + smoke status.

## Notes

- Zero file edits, zero migrations, zero frontend changes.
- If deploy fails (typically `deno.lock` drift in `_shared/`), I'll surface the error verbatim and ask before touching anything.
