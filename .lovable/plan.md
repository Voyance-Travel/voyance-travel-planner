

## Broken Edge Functions and Dead-End Code Audit

### 1. Edge Functions Missing from `config.toml` (Will Fail on Deploy)

Three edge functions exist as code directories but are **not registered** in `supabase/config.toml`, meaning they won't be deployed:

| Function | Has Client Code? | Status |
|---|---|---|
| `mapkit-token` | Yes (`src/utils/mapkit.ts`) | **Broken** -- called but never deployed |
| `validate-iap-receipt` | Yes (`src/services/iapService.ts`) | **Broken** -- called but never deployed |
| `send-push` | No client references | Dead code -- no caller exists |

**Fix**: Add these to `config.toml`:
```toml
[functions.mapkit-token]
  verify_jwt = false
[functions.validate-iap-receipt]
  verify_jwt = false
[functions.send-push]
  verify_jwt = false
```
Or delete `send-push` entirely since nothing calls it.

### 2. `send-push` Uses Deprecated Deno API

`send-push/index.ts` line 1 uses `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` -- the old `serve()` pattern instead of the modern `Deno.serve()`. This will likely fail on current edge-runtime. Same issue exists in the function body.

### 3. `src/services/liveAPI/index.ts` -- Complete Dead Code

This file is never imported anywhere in the codebase. It exports mock stubs for `amadeusAPI` and `bookingAPI` with zero consumers. The `ENABLE_MOCK_APIS` flag it references is only mentioned inside this file itself.

**Fix**: Delete `src/services/liveAPI/index.ts` (and the directory).

### 4. Admin/Maintenance Functions -- Not Broken but Worth Noting

These edge functions are only called from admin pages, which is fine:
- `cleanup-activities`, `cleanup-attractions`, `cleanup-destinations` (admin DataCleanup page)
- `delete-users`, `import-users` (admin BulkImport page)

These edge functions exist but have **no client callers** at all (internal/cron/one-off tools):
- `golden-persona-tests`
- `seed-demo-user`
- `migrate-site-images`
- `score-image-quality`
- `backfill-activity-costs`
- `backfill-destination-images`

These aren't broken -- they're maintenance utilities -- but they add deploy overhead.

### Summary of Required Fixes

| Priority | Issue | Fix |
|---|---|---|
| **High** | `mapkit-token` missing from config.toml | Add to config.toml |
| **High** | `validate-iap-receipt` missing from config.toml | Add to config.toml |
| **Medium** | `send-push` missing from config.toml + deprecated API + no callers | Delete the function |
| **Low** | `src/services/liveAPI/` is dead code | Delete the directory |

### Implementation

1. Add `mapkit-token` and `validate-iap-receipt` entries to `supabase/config.toml`
2. Delete `supabase/functions/send-push/` directory (or add to config.toml and modernize to `Deno.serve()` if push notifications are planned)
3. Delete `src/services/liveAPI/` directory

