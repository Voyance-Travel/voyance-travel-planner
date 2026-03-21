

## Fix: Swap Activity panel slow/broken — AbortController not connected

### Root cause

The `invokeWithTimeout` function in `ActivityAlternativesDrawer.tsx` creates an `AbortController` but **never passes the signal to the actual request**. `supabase.functions.invoke()` doesn't accept an `AbortSignal` parameter, so:

- The 15-second client timeout is a no-op — it sets a flag but the HTTP request continues indefinitely
- When a user clicks a filter chip, the previous request keeps running (wasting resources, potentially blocking)
- The edge function itself has internal timeouts (12s AI + 3s DNA = up to 15s), but if the Supabase gateway is slow or cold-starting, there's no client-side cancellation

This means the spinner can hang until the edge function's own gateway timeout (which can be 30s+).

### Fix

**File: `src/components/planner/ActivityAlternativesDrawer.tsx` (lines 120-144)**

Replace `supabase.functions.invoke` with a direct `fetch` call to the edge function URL, passing the `AbortController.signal` so the request is genuinely cancelled on timeout or when a new filter is clicked.

```typescript
const invokeWithTimeout = useCallback(async (
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `${supabaseUrl}/functions/v1/get-activity-alternatives`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,  // Actually connected now
      }
    );

    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === 'AbortError') return null;
    throw err;
  }
}, []);
```

Additionally, store the current `AbortController` in a ref so that when a new filter/search request starts, the previous one is explicitly aborted (not just ignored by stale ID check, but actually cancelled at the network level):

```typescript
const activeAbortRef = useRef<AbortController | null>(null);

// At start of each request:
activeAbortRef.current?.abort();
activeAbortRef.current = controller;
```

### Scope
Single file: `src/components/planner/ActivityAlternativesDrawer.tsx`. No edge function changes needed — the issue is entirely client-side request handling.

