## Plan: MapKit token allowed origins from env

Replace hardcoded `origin` array in `supabase/functions/mapkit-token/index.ts` (L39-43) with an env-driven `ALLOWED_ORIGINS` constant defined at module scope.

### Change

In `supabase/functions/mapkit-token/index.ts`:

1. Add a module-scope constant above `Deno.serve(...)` (after the import on L1):

```ts
const ALLOWED_ORIGINS = (() => {
  const raw = Deno.env.get('MAPKIT_ALLOWED_ORIGINS');
  if (!raw) {
    return [
      'https://travelwithvoyance.com',
      'https://www.travelwithvoyance.com',
      'https://voyance-travel-planner.lovable.app',
    ];
  }
  return raw.split(',').map(s => s.trim()).filter(Boolean);
})();
```

2. Replace L39-43 (the inline `origin: [...]` array) with `origin: ALLOWED_ORIGINS,`.

Token expiry (`exp: now + 3600`) stays unchanged.

### Secret

After the code change, request the user add the runtime secret `MAPKIT_ALLOWED_ORIGINS` via `secrets--add_secret`, with the suggested value:

```
https://travelwithvoyance.com,https://www.travelwithvoyance.com,https://voyance-travel-planner.lovable.app,https://id-preview--bbef7015-a2df-45af-893d-7d36d59f8dcd.lovable.app
```

(Including the existing `id-preview--…lovable.app` origin so previews keep working; user can append staging hosts.)

If the user skips the secret, sane defaults ship in code so prod won't break.

### Verify

- `grep -n "MAPKIT_ALLOWED_ORIGINS" supabase/functions/mapkit-token/index.ts` → 1+ hit.
- Edge function auto-deploys; no other call sites to update.