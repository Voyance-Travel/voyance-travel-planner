## What's broken

In `src/components/booking/InlineBookingActions.tsx` (priority 3 fallback, ~line 553), when an activity has **no Viator product, no website, and no booking URL**, we render a green primary button labeled **"Find official booking link"**. Its `onClick` simply opens the Activity Concierge sheet (`onAskConcierge`) with no seed message or instruction, so the AI replies "Sorry, can't process that request" — it has no idea why the sheet was opened.

The same dead-end pattern exists in `renderHighCostGuidance` (~line 308) for the "Ask concierge" link next to "Find on official site" for high-cost activities without a URL.

We already have the right plumbing for this exact job:

- `src/services/enrichmentService.ts → lookupActivityUrl()`
- Edge function `supabase/functions/lookup-activity-url/index.ts` — Perplexity sonar lookup that returns the best official ticket/booking URL (or `null`), with 90-day cache.
- `src/components/booking/ActivityLink.tsx` — already uses this pattern (click → spinner → open URL on success, hide on miss).

## Fix

Reuse `lookupActivityUrl` directly from the button. Stop opening a blank concierge sheet.

### 1. `InlineBookingActions.tsx` — Priority 3 fallback (no URL, no Viator)

Replace the green "Find official booking link" button behavior with a click handler that:

1. Sets a local `isLookingUp` state, button shows spinner + "Finding link…".
2. Calls `lookupActivityUrl(activity.title, destination, activity.category)`.
3. On success: `window.open(url, '_blank', 'noopener,noreferrer')` and remember the URL in local state so subsequent clicks open it directly.
4. On miss (`url === null`): toast "No official booking page found" and **fall back** to opening the concierge sheet — but only after we've tried the deterministic lookup. Keep the GYG "or browse tours" secondary link as a manual escape hatch.
5. On error: toast a friendly error, leave the button enabled.

The concierge button remains available as the secondary affordance (the `Sparkles` icon next to lock/unlock). We are not removing it — we're just making the green primary CTA do what it claims.

### 2. `renderHighCostGuidance` — high-cost activity with no URL

Same treatment for the "Ask concierge" link: change it to a "Find booking link" button that runs `lookupActivityUrl` first; only open the concierge as a fallback when Perplexity returns null.

### 3. Copy / labels

- Idle: "Find official booking link" (sm: "Find link") — unchanged.
- Loading: "Finding link…" with `Loader2` spinner (match `ActivityLink.tsx` style).
- After URL resolved: relabel to `Reserve on {host}` (mirrors Priority 1 official-site CTA) and switch icon to `ExternalLink`.

### 4. No backend changes

`lookup-activity-url` already exists, is auth-gated, cost-tracked, and Perplexity-cached. No edge-function or schema work.

### 5. Tests

Add a small RTL test in `src/components/booking/__tests__/InlineBookingActions.findBooking.test.tsx`:
- Mocks `lookupActivityUrl` to return a URL → click opens it via `window.open`.
- Mocks it to return `null` → falls back to calling `onAskConcierge`.
- Mocks it to throw → button stays clickable, toast fired.

## Files touched

- `src/components/booking/InlineBookingActions.tsx` (two button sites)
- `src/components/booking/__tests__/InlineBookingActions.findBooking.test.tsx` (new)

No DB migrations, no edge function changes, no schema work, no design system changes.