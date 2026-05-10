## MED-1: Server-side memory upload validation

**Problem:** `src/services/tripMemoriesAPI.ts` uploads directly from the client to the `trip-memories` storage bucket. Any file type or size can be pushed via DevTools — frontend checks are cosmetic.

**Approach:** Move uploads through a new edge function `upload-trip-memory` that enforces validation server-side, then lock down the bucket so only the service role can write.

### New edge function `supabase/functions/upload-trip-memory/index.ts`

- Accept `multipart/form-data` with: `file`, `tripId`, optional `activityId`, `activityName`, `caption`, `locationName`, `dayNumber`.
- Auth: validate JWT, resolve `user.id`. Confirm the trip belongs to the user (or they're a collaborator).
- Validation:
  - **Size:** reject `> 10 MB` (configurable constant).
  - **MIME:** allowlist `image/jpeg`, `image/png`, `image/webp`, `image/heic` only.
  - **Magic-byte sniff:** read first 12 bytes and verify against the claimed MIME (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF…WEBP`, HEIC `ftypheic/heix/mif1`). Reject mismatches — this is the real "easy to bypass via DevTools" defense.
  - **Dimensions sanity:** decode header; reject if width or height > 12000px or < 16px.
- **EXIF strip:** re-encode via `Image` decode → `image/jpeg` or `image/webp` re-encode using a Deno-compatible image lib (`https://deno.land/x/imagescript`). This drops GPS/EXIF metadata implicitly. Keep orientation by applying it before strip.
- Upload sanitized buffer with service-role client to `trip-memories/{userId}/{tripId}/{timestamp}.{ext}`.
- Insert `trip_memories` row (same shape as today).
- Return `{ memory, signedUrl }`.

Standard CORS, zod validation on form fields, structured error responses.

### Client change

`tripMemoriesAPI.uploadMemory` switches from direct `supabase.storage.upload` + `from('trip_memories').insert` to a single `supabase.functions.invoke('upload-trip-memory', { body: formData })` call. Keep the existing client-side pre-check as UX (fast feedback) but it is no longer the security boundary.

### Storage policy migration

Migration to revoke client INSERT/UPDATE on `storage.objects` for bucket `trip-memories` (keep SELECT for owner via signed URLs only — current pattern). Service role retains full access. Existing DELETE policy stays so `deleteMemory` still works (or move delete into the edge function too — small follow-up, not required for this fix).

### Verification

- Upload a real JPEG → success.
- Rename `evil.exe` → `evil.jpg` and upload → 400 `INVALID_FILE_TYPE` (magic-byte mismatch).
- 25 MB image → 400 `FILE_TOO_LARGE`.
- JPEG with GPS EXIF → uploaded file has EXIF stripped (verify with `exiftool` on download).
- Direct `supabase.storage.from('trip-memories').upload(...)` from browser console → 403 from RLS.

---

## MED-2: Strip userId from production console logs

Three log lines leak `user.id` to edge logs. Wrap each behind a debug guard rather than `NODE_ENV` (Deno edge functions don't set `NODE_ENV`; use a project convention).

Use a small shared helper `supabase/functions/_shared/debug-log.ts`:

```ts
const DEBUG = Deno.env.get('DEBUG_LOGS') === 'true';
export const debugLog = (...args: unknown[]) => { if (DEBUG) console.log(...args); };
```

Then update:

- `supabase/functions/generate-trip-preview/index.ts:271` — replace `console.log(... User: ${userId || 'anon'})` with either `debugLog(...)` or strip the userId entirely:
  `console.log(\`[generate-trip-preview] ✓ Generated ${cappedDays}-day preview for ${destination}\`);` and move the userId-tagged line behind `debugLog`.
- `supabase/functions/generate-full-preview/index.ts:245` — same treatment, drop `| User: ${userId}` from the always-on log; keep a `debugLog` variant for local debugging.
- `supabase/functions/chat-trip-planner/index.ts:304` — remove `console.log("[chat-trip-planner] Authenticated user:", user.id);` (auth success doesn't need a log line) or replace with `debugLog`.

No behavior change; logs in production stop carrying PII.

### Verification

- Deploy, trigger each function, check edge logs: no UUIDs appear in default output.
- Set `DEBUG_LOGS=true` secret locally → userId-tagged lines reappear.

---

### Files touched

- New: `supabase/functions/upload-trip-memory/index.ts`
- New: `supabase/functions/_shared/debug-log.ts`
- New migration: lock down `trip-memories` bucket write policies
- Edit: `src/services/tripMemoriesAPI.ts` (uploadMemory only)
- Edit: `supabase/functions/generate-trip-preview/index.ts` (line 271)
- Edit: `supabase/functions/generate-full-preview/index.ts` (line 245)
- Edit: `supabase/functions/chat-trip-planner/index.ts` (line 304)
