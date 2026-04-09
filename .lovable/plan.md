

# Fix: "Just Tell Us" Chat Stalling

## Investigation Findings

- The `chat-trip-planner` edge function returns 200 when it works, but only one real POST call found in recent logs (2833ms)
- The function uses `supabase.auth.getClaims(token)` (line 240) — this method may not reliably exist in `supabase-js@2.90.1` and could throw a `TypeError`, causing silent 500 errors that appear as "stalling"
- The frontend `fetch` in `TripChatPlanner.tsx` has **no timeout** — if the AI gateway hangs, the UI waits forever
- The system prompt is ~5000+ words, contributing to slow first-token latency

## Fixes

### 1. Replace `getClaims` with `getUser` (edge function)
**File: `supabase/functions/chat-trip-planner/index.ts`**

Replace lines 240-246:
```ts
const { data: { user }, error: userError } = await supabase.auth.getUser(token);
if (userError || !user) {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```
And update the userId reference (line 255) from `claimsData.claims.sub` to `user.id`.

### 2. Add fetch timeout on the frontend
**File: `src/components/planner/TripChatPlanner.tsx`**

Add an `AbortController` with a 60-second timeout around the `fetch` call (line 172) so the UI doesn't hang indefinitely:
```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000);
try {
  const resp = await fetch(CHAT_URL, { ...options, signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeout);
}
```

### 3. Add diagnostic logging (edge function)
Add `console.log` at key points: after auth, before AI call, and on AI response status — so future stalls can be diagnosed from logs.

### 4. Redeploy the function
Deploy the updated `chat-trip-planner` to apply all changes.

## Technical Details
- **Files changed**: `supabase/functions/chat-trip-planner/index.ts`, `src/components/planner/TripChatPlanner.tsx`
- `getUser(token)` is the standard, reliable auth method in supabase-js v2.x
- The 60s timeout prevents the UI from appearing frozen if the AI gateway stalls

