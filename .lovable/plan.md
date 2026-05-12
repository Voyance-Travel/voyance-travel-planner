# Wire global toast listener for `itinerary-persist-issues`

When `action-save-itinerary` returns 422, `safeUpdateItineraryData` already dispatches a `itinerary-persist-issues` `CustomEvent` on `window`. Today nothing listens, so users never see the gate's findings. This wires a single global listener that surfaces day-grouped sonner toasts.

## Files

**New** `src/components/itinerary/PersistIssuesListener.tsx`
- Renders `null`. `useEffect` adds/removes a `window` listener for `itinerary-persist-issues`.
- Reads `detail = { tripId, errors[], warnings[], persistedDespiteErrors }`.
- Groups issues by `dayNumber` (fallback bucket for trip-level).
- Emits one toast per day: `toast.error` if the day contains any error, else `toast.warning`. Heading "Day N needs regeneration" (or "Trip needs regeneration"). Description = newline-joined human strings. `duration: 10000`.
- Dedupe: keep a short-lived `Set<string>` of `${tripId}:${day}:${codes.sorted().join(',)}` cleared after 5s so reload-driven repeat events don't double-toast.

**Edited** `src/App.tsx`
- Import `PersistIssuesListener` and mount once inside `<TooltipProvider>` near other global listeners (`<GlobalErrorHandler />`, `<OAuthReturnHandler />`). Single mount only.

## Issue code mapping (matches actual codes emitted by `validate-itinerary-for-persist.ts`)

```text
EMPTY_DAY                 → "Day N has no activities"
MISSING_REQUIRED_MEAL     → "Day N: <detail or 'meal missing'>"
EMPTY_DINING_DESCRIPTION  → "Day N: restaurant card missing description"
PHANTOM_PREDAWN_CARD      → "Day N: <detail or 'phantom pre-dawn card'>"
OVERLONG_ACTIVITY         → "Day N: <detail or 'activity > 6h'>"
WRAP_GAP_OVER_3H          → "Day N: 3+ hour unscheduled gap"
MISSING_HOTEL_RETURN      → "Day N: no hotel return at end of day"
CURRENCY_MISMATCH         → "Currency mismatch on Day N"
```
All strings end with " — regenerate this day to fix" (skipped for trip-level CURRENCY_MISMATCH which already reads naturally).

Note: the original Lovable prompt used short codes (`MISSING_MEAL`, `PHANTOM_PREDAWN`, `DEAD_GAP_GT_3H`). I'm using the canonical codes already produced by the gate so the mapping actually fires; the human strings are unchanged in spirit.

## Toast lib

App uses both shadcn `Toaster` and sonner `Toaster`. Use `import { toast } from 'sonner'` per project guidance.

## Verify

1. Manually delete dinner from a day and trigger a save — expect one grouped toast per affected day.
2. `rg -n "itinerary-persist-issues" src/` → 2 hits (dispatcher + listener).
3. Trigger same save twice within 5s — expect single toast (dedupe).
4. Confirm no duplicate listeners after route changes (single mount in App).

## Out of scope

Per-day inline banners with "Regenerate Day N" CTA on the itinerary view — deferred.
