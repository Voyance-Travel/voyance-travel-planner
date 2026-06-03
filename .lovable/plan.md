## Goal

Force a fresh deploy of the `generate-itinerary` edge function so today's seven backend fixes (must-do gate, meal-slot timing, fuzzy coverage matcher, §15z flight-clock recovery + departure card injection, must-do overlap accept, and the two merged GitHub PRs) replace the 2-day-old bundle currently serving production.

## Scope

In scope:
- One deploy action against `generate-itinerary`.
- Confirm the new deployment timestamp + version.
- Verify the function still boots (smoke check: `get-itinerary` action on an existing trip should return 200).

Out of scope (deferred to a follow-up turn per your answer):
- "Day 3 needs regeneration" false-positive toast.
- "11:30 PM vs 11:30 AM" return-flight display bug.
- Generating a fresh test trip and verifying Fix #3/#4 end-to-end (you'll do this manually after redeploy).

## Steps

1. Call `supabase--deploy_edge_functions` with `["generate-itinerary"]`. Lovable-managed edge functions normally auto-deploy on file change, but this forces a clean rebuild regardless of cache state — addresses the "Last updated 2 days ago" symptom directly.

2. Confirm deploy succeeded (tool returns success + new deployment ID).

3. Smoke-test with `supabase--curl_edge_functions` calling `action: 'get-itinerary'` against any existing trip ID — verifies the new bundle boots without import errors. (Pure read action; no mutation, no credits, no risk to existing data.)

4. Report back: new deployment timestamp, smoke-test status, and confirmation that the 7 fixes are now live. You can then create the fresh test trip and verify Bangkok-class behavior.

## Notes

- No code changes. No DB migrations. No frontend changes.
- If the deploy fails, the most common cause is a `deno.lock` drift in `_shared/` — I'll re-read the deploy error and patch only if needed.
- The two remaining bugs (Day 3 regeneration toast, AM/PM display) will be addressed in a separate plan once redeploy is confirmed and we have a fresh test trip to reproduce against.
