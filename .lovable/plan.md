# L1 — Itinerary chat retry idempotency

Prevent the AI cost from being charged twice (and `record_user_intent` from running twice) when the browser reloads or retries the same chat turn.

## What changes

### 1. New table `chat_idempotency_cache` (migration)

Dedicated cache, separate from `itinerary_customization_requests` (which has no `metadata`/`response_data` columns and is an audit trail, not a cache).

Columns:
- `idempotency_key text primary key` — `chat:{conversationId}:{inputHash}`
- `conversation_id uuid null`
- `user_id uuid null`
- `trip_id uuid null`
- `input_hash text not null`
- `response_data jsonb not null`
- `created_at timestamptz default now()`
- `expires_at timestamptz not null` (5 min from insert)

Index on `expires_at` for cleanup. RLS enabled, no client policies (service-role only — edge function uses service client).

### 2. `supabase/functions/itinerary-chat/index.ts`

Around the existing block (lines 686–691), wrap the AI-call result with cache lookup + write:

**Before the AI fetch (after `apiMessages` is built, before line 640-ish `fetch`):**
- Compute `inputHash` from `JSON.stringify(messages.slice(-3))` using the djb2 hash from the spec.
- Compute `idempotencyKey = chat:{conversationId ?? 'no-conv'}:{inputHash}`.
- Skip cache entirely when `stream === true` (early-returns at line 680, can't cache mid-stream).
- Service-role client `.from('chat_idempotency_cache').select('response_data').eq('idempotency_key', key).gt('expires_at', now()).maybeSingle()`.
- On hit: `console.log('[itinerary-chat] Idempotent retry')` and return cached `response_data` as the JSON response. **No AI call, no cost tracking, no DB writes for intents.**

**After the existing post-AI processing (after `actions` / `capturedPreferences` are built, just before the existing `return new Response(...)`):**
- Build the final response payload (the same object currently passed to `JSON.stringify`).
- Insert into `chat_idempotency_cache` with `{ idempotency_key, conversation_id, user_id, trip_id, input_hash, response_data: payload, expires_at: now + 5min }` using `upsert({ onConflict: 'idempotency_key', ignoreDuplicates: true })` so concurrent duplicate requests don't error.
- Wrap in try/catch — cache write failures must not break the response.

### 3. Verification

- `grep -c "idempotencyKey\|inputHash" supabase/functions/itinerary-chat/index.ts` ≥ 4 (we add `idempotencyKey`, `inputHash` references in compute, lookup, and insert — 4+ occurrences).
- Manual: send the same payload twice within 5 min → second call logs "Idempotent retry" and returns identical body without invoking the AI gateway (verified via edge logs: only one `recordAiUsage` line).

## Out of scope

- Streaming branch (early-returns; spec is non-stream only per user choice).
- Cleanup job for `chat_idempotency_cache` (5-min TTL, table will stay tiny; can add `pg_cron` later if needed).
- Hashing the full message history (spec uses last 3 messages — covers the active turn).

## Technical notes

- `idempotency_key` uses `text` not `uuid` because the format `chat:{uuid}:{hex}` isn't a UUID.
- `maybeSingle()` over `.limit(1)` so a miss returns `null` cleanly.
- The cache is keyed on the input hash, so any user edit produces a different key — only true replays hit.
- When `conversationId` is missing, key becomes `chat:no-conv:{hash}` — still works, still scoped per-input.
