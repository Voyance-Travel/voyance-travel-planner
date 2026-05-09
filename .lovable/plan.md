## M7 — Activities API broken first call

**File:** `src/services/activitiesAPI.ts` (lines 76–101)

### Problem

`searchActivities` makes two `supabase.functions.invoke('activities', …)` calls:

1. **Line 84–90** — `method: 'GET'` with `body: null` and no query string. The edge function reads from `url.searchParams` (verified at `supabase/functions/activities/index.ts:170-174`), so this call has no `destination`/`destinationId` and returns a 400 (`'Destination or destinationId is required'`). The result is then **discarded** (`data`, `error` are shadowed by the second call's destructure but never read or thrown).
2. **Line 93** — invokes `activities?<query>` and uses its result.

The first call is a wasted network round-trip + a silent server error in logs every time a user searches activities.

### Plan

Replace the dual-invoke block with a single GET that includes the query string. Param names already match the edge function (`destination`, `destinationId`, `category`, `limit`) — verified, no rename needed.

```ts
export async function searchActivities(params: ActivitySearchParams): Promise<ActivitySearchResponse> {
  const queryParams = new URLSearchParams();
  if (params.destination) queryParams.set('destination', params.destination);
  if (params.destinationId) queryParams.set('destinationId', params.destinationId);
  if (params.category) queryParams.set('category', params.category);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  // Single GET with query params (the shape the edge function expects).
  // Removed the buggy body-on-GET first call that always 400'd silently.
  const { data, error } = await supabase.functions.invoke(
    `activities?${queryParams.toString()}`,
    { method: 'GET' },
  );

  if (error) {
    console.error('[Activities] Edge function error:', error);
    throw new Error(error.message || 'Failed to search activities');
  }

  return data as ActivitySearchResponse;
}
```

Notes vs the user's snippet:
- **Keep `throw`, not `return []`.** Existing callers (`useActivitySearch` / React Query) rely on thrown errors to populate `query.error` and trigger retry/error UI. Returning `[]` would silently mask real failures and break the typed `ActivitySearchResponse` return contract.
- **Keep `params.destinationId`** in the query (the user's spec snippet omitted it, but it's a real param the edge function reads and the hook gates `enabled` on).
- **No method override needed** beyond `method: 'GET'`; supabase-js default is POST, so we explicitly set GET to match the edge handler.

### Verification

- `grep -c "supabase.functions.invoke('activities'" src/services/activitiesAPI.ts` → 0 (the bare-name invoke is gone).
- `grep -n "activities?" src/services/activitiesAPI.ts` → 1 hit.
- A search with `destination: 'Venice'` triggers a single network call to `…/functions/v1/activities?destination=Venice`, returns activities, no 400 in logs.
- `useActivitySearch` error path still surfaces failures.

### Out of scope

- The duplicate `Content-Type` header (supabase-js sets it). Not changing other call sites.
