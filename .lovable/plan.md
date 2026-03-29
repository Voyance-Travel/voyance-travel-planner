

# Audit: Push Notification Pipeline Gaps + End-to-End Testing Strategy

## Current State

The push notification system is **incomplete**:

1. **`pushService.ts`** (client) — Registers device tokens via Capacitor and stores them in the `push_tokens` table. This works for native apps only (`Capacitor.isNativePlatform()`).

2. **`trip-notifications` edge function** — Schedules notifications by writing them into `trips.metadata.scheduledNotifications`. Has actions: `schedule`, `get-due`, `mark-sent`, `get-user-notifications`. But **it never actually delivers push notifications** — it only stores and reads them from trip metadata.

3. **`send-trip-reminders` edge function** — Sends **email** reminders only (via Zoho SMTP). No push delivery.

4. **No push delivery function exists.** There is no edge function that reads `push_tokens` and sends via APNs or FCM. The tokens are collected but never used.

## What Needs to Happen

### Step 1: Create `send-push` edge function
A new edge function that:
- Accepts `userId`, `title`, `body`, and optional `data` (e.g. `{ tripId }`)
- Looks up the user's device tokens from `push_tokens`
- Sends via FCM HTTP v1 API (works for both iOS and Android when configured through Firebase)
- Logs delivery success/failure
- Returns result to caller

Requires: **FCM service account key** stored as a secret. Without this, push delivery is impossible regardless of code.

### Step 2: Wire `trip-notifications` to call `send-push`
Update the `get-due` action (or create a `process-due` action) to:
- Fetch due notifications
- Call `send-push` for each
- Mark as sent

### Step 3: Wire `send-trip-reminders` to also push
After sending email, also call `send-push` so users get both channels.

### Step 4: Add health checks to E2E tests
Add to `e2e/critical-paths.spec.ts`:
- `send-push` responds to OPTIONS (not 404)
- `trip-notifications` with `get-user-notifications` returns valid JSON
- `push_tokens` table exists and is queryable

## Prerequisite Question

Before building the `send-push` function, we need to know: **Do you have Firebase Cloud Messaging (FCM) set up for this app?** Push delivery requires either:
- An FCM server key (for Android + iOS via Firebase)
- An APNs auth key (for iOS-only direct delivery)

Without one of these configured as a secret, the delivery function would have nothing to call. The client-side registration code (`pushService.ts`) already uses Capacitor's push plugin, which typically sits on top of FCM/APNs.

## Files to create/edit

| File | Change |
|------|--------|
| `supabase/functions/send-push/index.ts` | **New** — Push delivery via FCM |
| `supabase/functions/trip-notifications/index.ts` | Add `process-due` action that calls `send-push` |
| `e2e/critical-paths.spec.ts` | Add push function health check |

## Risk
**Low for the wiring.** The main blocker is whether FCM/APNs credentials exist. Without them, we can build the plumbing but delivery will fail silently.

