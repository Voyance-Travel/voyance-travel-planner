
Fix: Make Swap Activity category filters resolve reliably instead of spinning indefinitely

What’s going wrong

I traced the issue to the swap drawer flow in `src/components/planner/ActivityAlternativesDrawer.tsx` and the `get-activity-alternatives` backend function.

Root causes:
1. The drawer creates an `AbortController`, but the signal is never passed into the request. So category clicks do not truly cancel the previous request — they only mark a local flag.
2. There is no hard client-side timeout around `supabase.functions.invoke(...)`, so if a request stalls, `isLoading` can stay `true` forever and the drawer remains stuck on “Searching for options...”.
3. The initial drawer load fetches “similar” results, then starts a background “different” request using the same request helper. That means background preload and user-triggered category clicks compete for the same request lifecycle and can race each other.
4. In `supabase/functions/get-activity-alternatives/index.ts`, the AI call is raced against a timeout, but the underlying fetch itself is not actually aborted. That makes fallback less reliable under slow AI/network conditions.

Implementation plan

1. Stabilize request handling in `src/components/planner/ActivityAlternativesDrawer.tsx`
- Replace the current “single abort controller + local aborted check” approach with explicit request IDs / sequence guards.
- Add a dedicated request wrapper with a hard timeout for foreground actions:
  - initial similar load
  - category chip filters
  - custom search
- Ensure every foreground request always exits loading state in `finally`, even on timeout/stall.

2. Separate background preload from interactive filter requests
- Keep the fast “similar” load first.
- Move the “different” preload into its own background path so it does not share the same active request state as chip clicks.
- Ignore preload responses if the user has already selected a filter or started a search.
- Do not let background preload re-enable or block the main loading spinner.

3. Add a guaranteed fast fallback path
- If a filter/search request exceeds the timeout, immediately fall back to template alternatives instead of leaving the spinner up.
- Show a lightweight toast/message only if needed, e.g. “Showing fast suggestions instead.”

4. Harden `supabase/functions/get-activity-alternatives/index.ts`
- Add a real `AbortController` to the AI gateway `fetch(...)` and pass `signal`.
- Clear timeout properly and abort the fetch when the limit is reached.
- Keep template fallback, but make it deterministic for slow category/search mode requests.
- Add concise logs for:
  - request mode
  - query/filter
  - whether AI succeeded, timed out, or fell back to templates

Files to update
- `src/components/planner/ActivityAlternativesDrawer.tsx`
- `supabase/functions/get-activity-alternatives/index.ts`

Expected result
- Category chip clicks resolve quickly instead of hanging.
- The spinner always stops.
- Slow AI responses degrade gracefully into fallback alternatives.
- Background preload no longer interferes with user-selected filters.

Validation
- Open Swap Activity and confirm initial results load.
- Click multiple category chips in sequence and verify only the latest one wins.
- Confirm no indefinite “Finding the best alternatives...” / “Searching for options...” state.
- Confirm slow backend responses fall back to usable alternatives instead of freezing the panel.
