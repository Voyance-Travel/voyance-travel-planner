# M10 — MapKit token periodic refresh

No `useMapKitToken.ts` exists. The token flow lives in `src/utils/mapkit.ts`, where `loadMapKit()` fetches a JWT once inside the `initMapKit` global callback and closures it into `mapkit.init({ authorizationCallback })`. After ~60 minutes that token expires and tile/annotation requests start failing. Two changes:

## 1. Refactor `src/utils/mapkit.ts` — refresh on demand

MapKit's `authorizationCallback` is invoked by Apple every time auth is needed (initial load + on token expiry). Instead of capturing one token, fetch a fresh one each time MapKit asks, with a small in-memory cache to avoid hammering the edge function.

- Add module-level `cachedToken: string | null` and `cachedAt: number`.
- `TOKEN_TTL_MS = 50 * 60 * 1000` (50 min — 10 min buffer under Apple's 60 min cap).
- New helper `fetchMapKitToken()`: calls `supabase.functions.invoke('mapkit-token')`, returns `data.token`, throws on error.
- New helper `getValidMapKitToken()`: returns cached token if `Date.now() - cachedAt < TOKEN_TTL_MS`, else refetches and updates cache.
- In `initMapKit`:
  - Call `getValidMapKitToken()` once for the initial seed.
  - Pass `authorizationCallback: (done) => getValidMapKitToken().then(done).catch(err => { console.error('[MapKit] Token refresh failed:', err); done(cachedToken ?? ''); })` so each MapKit auth request gets a fresh-or-cached token.
- Keep existing `loadMapKit` / `isMapKitLoaded` exports unchanged.

## 2. Create `src/hooks/useMapKitToken.ts` — exact spec

For future React consumers that want the raw token (e.g. token-aware SwiftUI-bridge components):

```ts
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMapKitToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mapkit-token');
        if (error) throw error;
        if (isMounted) setToken(data?.token || null);
      } catch (err) {
        console.error('[useMapKitToken] Failed to fetch token:', err);
      }
    };

    fetchToken();
    intervalId = setInterval(fetchToken, 50 * 60 * 1000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return token;
}
```

## Verification

- `grep -c "50 \* 60 \* 1000\|setInterval.*fetchToken" src/hooks/useMapKitToken.ts` → ≥ 1
- `grep -c "TOKEN_TTL_MS\|getValidMapKitToken" src/utils/mapkit.ts` → ≥ 2
- Existing call sites of `loadMapKit()` continue to work (signature unchanged).

## Out of scope

- No changes to `mapkit-token` edge function.
- No changes to existing MapKit consumers — they continue to import `loadMapKit` / `isMapKitLoaded`.
