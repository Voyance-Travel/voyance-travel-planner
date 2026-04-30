## Diagnose & fix Supabase edge function deploy failures

### Why the previous attempts didn't stick
Every prior pass at "fixing" deploys was guesswork — we patched suspicious files without ever reading the actual deploy error output. In read-only mode I cannot deploy or run the lint/test guard, so I cannot see the real error either. The fix is to switch to build mode and let the deploy itself tell us what's broken.

### What I already verified (read-only)
- All 118 functions are present; recent edits sit in `_shared/` and `generate-itinerary/`.
- The lint guard's allowlist matches the files that legitimately reference `googleapis.com`. No source files outside the allowlist contain that string, so the lint guard is **not** the blocker.
- Every shared symbol imported by the recently-migrated functions (`googlePlacesTextSearch`, `getCachedPlacesPhotoByResource`, `isGoogleBillableUrl`, etc.) is exported from `_shared/google-api.ts`, `_shared/photo-storage.ts`, `_shared/is-google-billable.ts`.
- No `supabase/deno.lock` exists (so the "incompatible lockfile" failure mode doesn't apply).
- `supabase/config.toml` is well-formed; only `verify_jwt = false` overrides.

That means the failure is almost certainly one of: a runtime import error inside `_shared/*` that surfaces on every consumer, a TypeScript-level type error in one of the recently-touched files, or a missing secret referenced at module load.

### Plan (executed in build mode after approval)

1. **Reproduce the failure first.** Deploy a small representative batch:
   - `destination-images`, `fetch-reviews`, `hotels`, `recommend-restaurants`, `generate-full-preview`, `optimize-itinerary` (the ones I migrated last turn)
   - plus one untouched control function (`weather`) to confirm the failure is migration-related and not infrastructure-wide.
   Capture stderr from each deploy.

2. **Read the actual error.** For every failure, fetch edge function logs and the deploy output. Categorize:
   - `import error / module not found` → fix the import path or missing export in `_shared/`.
   - `TypeError at module load` → almost always a `Deno.env.get(...)` being read at top-level when the secret is missing; move into the function body with a guard.
   - `SyntaxError` → fix the file directly.
   - `verify_jwt`/auth issue → reconcile `config.toml`.

3. **Run the lint test** (`no-direct-google.test.ts`) via `supabase--test_edge_functions` to confirm no leak regressed during the fix.

4. **Re-deploy the batch.** Keep iterating until all six come back green. Then deploy the rest in groups of ~20 so any remaining file-specific issue surfaces in isolation rather than as one giant red wall.

5. **Add a guard test** so this is the last time we chase a phantom: a `_shared/module-loads.test.ts` that imports every file in `_shared/` and asserts they evaluate without throwing. That catches the "edits to `_shared` silently break every consumer" class of bug at test time, not deploy time.

6. **Memory update.** Save a memory note recording: "Always reproduce edge function deploy failures by deploying + reading logs before editing — guessing has cost us multiple loops on the Google leak."

### What I will NOT do
- Patch files speculatively without an error message tied to them.
- Add `Deno.env.get` validation everywhere as a shotgun fix — only where logs show it's the cause.
- Touch `_shared/google-api.ts`, `is-google-billable.ts`, or `photo-storage.ts` unless the deploy logs implicate them.

### Files likely to change (depends on what logs show)
- one or more files under `supabase/functions/_shared/`
- the six recently migrated functions
- new: `supabase/functions/_shared/module-loads.test.ts`
- `mem://process/edge-deploy-debugging` (new memory note)

### Acceptance
- `supabase--deploy_edge_functions` returns success for every function we touch in step 1.
- `supabase--test_edge_functions` passes for `_shared/no-direct-google.test.ts` and the new module-load guard.
- A second deploy of the full batch shows no regressions.
