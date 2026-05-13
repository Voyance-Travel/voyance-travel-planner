## What's actually happening

Two generation paths exist in the codebase:

1. **Client-driven loop** — `useLovableItinerary` and `useItineraryGeneration.generateItineraryProgressive` run a `for (dayNum = 1..N)` loop **in the browser tab**, calling `action: 'generate-day'` once per day. Each day takes 30–90s.
2. **Server-driven chain** — `action: 'generate-trip'` returns immediately, then self-chains day-by-day on the edge runtime, writing heartbeats and `generation_started_at` to `trips.metadata`. `useGenerationPoller` is already built for this and even has auto-resume on stall.

Mobile uses path #1. iOS Safari (and to a lesser degree Chrome on Android) aggressively suspends background JavaScript and cancels long fetches when:
- Screen locks
- User switches apps
- Tab loses focus for ~30s
- Phone runs low on memory

When that happens mid–day-1 fetch (~20% on a 5-day trip), the loop dies silently. Because path #1 never flips `itinerary_status` to `generating` server-side and never writes a heartbeat, the server has no idea generation was running. On reload the poller's stall-detection skips the trip (no `generation_started_at` → no stall reference), `useLovableItinerary` checks for partial days, finds none, and restarts the loop from day 1 — Safari suspends it again. Infinite loop.

Verified for the reported user (Clinton Brooks, Madrid trip `358cc606`):
- `itinerary_status = 'not_started'`, 0 saved days
- 0 `generation_logs` rows
- 0 invocations of `generate-itinerary` for that tripId in edge logs
- 0 `pending_credit_charges` rows
- Trip created via chat_planner at 14:59 UTC and never touched the backend generator

## Fix

### 1. Switch mobile generation to the server-driven chain

In `src/components/planner/steps/ItineraryPreview.tsx` and `src/components/planner/ItineraryGeneratorStreaming.tsx` (the two screens that consume `useLovableItinerary`), gate behavior on `useIsMobile()`:

- **Mobile**: invoke `action: 'generate-trip'` once, then mount `useGenerationPoller({ tripId, enabled: true })` to drive the progress UI from `trips.metadata.generation_completed_days` / `generation_total_days` and `itinerary_days` row count. The browser tab can be killed and reopened freely — the chain keeps running on the edge runtime.
- **Desktop**: keep `useLovableItinerary` as-is (per-day fetch is fine when the tab stays alive and gives faster perceived feedback).

The poller already handles ready/failed/stalled transitions, dedupes failures, and auto-resumes up to 3 times — no new orchestration needed.

### 2. Self-heal stuck `not_started` chat-planner trips

Extend the existing stuck-leg self-heal in `src/pages/TripDetail.tsx` (around L897). New trigger: trip has `itinerary_status = 'not_started'`, `metadata.source = 'chat_planner'` (or `?generate=true` was set in the URL within the session), no `itinerary_data.days`, no `pending_credit_charges` row, and `created_at` older than 60s. Kick off `action: 'generate-trip'` server-side and switch the UI to the poller. This rescues users like Clinton who land back on the trip page after the mobile loop died.

### 3. Heartbeat-less stall detection in the poller

`useGenerationPoller` currently only flags a stall when `generation_heartbeat` or `generation_started_at` exists. Add a fallback: if `itinerary_status` is `generating` AND `metadata.generation_started_at` is missing for >90s, treat as stalled and trigger the same auto-resume path. Belt-and-braces for trips where the backend chain was launched but the metadata write race-lost.

### 4. One-shot rescue for the reported user's trip

Server-side, run a one-time `generate-trip` invocation for trip `358cc606-c1af-4e0a-af54-9289fe787bbf` so Clinton's Madrid trip generates without him having to retry. Done via a small admin script (no DB migration needed) — `supabase.functions.invoke('generate-itinerary', { body: { action: 'generate-trip', tripId, ... } })`.

## Files

**Edit**
- `src/components/planner/steps/ItineraryPreview.tsx` — branch on mobile to use server chain + poller
- `src/components/planner/ItineraryGeneratorStreaming.tsx` — same branch
- `src/pages/TripDetail.tsx` — extend stuck-leg self-heal to cover `not_started` chat-planner trips
- `src/hooks/useGenerationPoller.ts` — heartbeat-less stall fallback (90s)

**No changes**
- Backend `action: 'generate-trip'` chain — already correct (waitUntil-style self-chain, returns 200 immediately, refunds credits on failure)
- `useGenerationPoller` auto-resume logic — already correct, just adding one more stall trigger
- Database schema — no migration needed
- Mobile detection — `useIsMobile()` already exists

## Out of scope

- Removing the client-driven `useLovableItinerary` loop entirely on desktop (separate cleanup; current behavior fine when tab stays focused)
- Backend changes to the day-chain itself
- Any UI redesign of the loading screen (existing `PersonalizedLoadingProgress` works with poller progress)
- Web push / service-worker keepalive (would help PWA path but adds complexity; server-chain fix already removes the dependency on the tab staying alive)

## Memory

Add `mem://constraints/itinerary/mobile-uses-server-chain` and a Core line: "Mobile (`useIsMobile()`) generation MUST go through `action: 'generate-trip'` + `useGenerationPoller`, never the client-driven per-day loop. iOS Safari suspends the tab and silently kills the loop, leaving trips stuck at `not_started`/~18%."
