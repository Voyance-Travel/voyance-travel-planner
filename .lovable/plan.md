## Problem

Collapsed `TripHealthPanel` shows **"Health: 97 — 1 issue"**. Expanding the panel triggers a rerender and the score immediately resolves to **100 / 0 issues** with no conflict listed. The issue is a ghost: `analyzeHealth(days)` is firing against a transient/partially‑hydrated `days` prop (e.g. an activity briefly missing a `startTime`/`endTime`, or an in-flight optimistic mutation), flagging a buffer/overlap warning, then re-running clean on the next render. The badge surfaces the false positive.

## Root cause (in `src/components/trip/TripHealthPanel.tsx`)

1. `analyzeHealth` runs eagerly inside the `useMemo` on every render of `days`, with no gating on whether the trip data is settled.
2. The "5-minute buffer" and overlap detectors run on any pair of activities that have *both* `startTime` and `endTime` parseable — during optimistic edits, refresh-day mutations, or first paint, two activities can momentarily appear back-to-back even though the persisted itinerary already has the correct gap (the pre-save timing cascade ran server-side).
3. The collapsed badge has no "soak" period — it surfaces the very first non-zero issue count even though the parent will re-render with corrected props within a tick.
4. `refreshResultsByDay` already exists to suppress server-cleared timing issues, but only helps *after* a refresh-day round trip; first paint isn't covered.

## Fix

Single, surgical change in `src/components/trip/TripHealthPanel.tsx`. Goals: never surface a transient warning, never hide a real one.

### 1. Stabilize the issue list with a 600ms soak

Wrap the `analyzeHealth` result in a `useDeferredValue`-style soak: compute `rawIssues` synchronously in the memo, but expose `healthIssues` to the badge/score only after the **same set of issue IDs** has been observed twice in a row (or for ~600 ms). Implementation:

- Add `const [stableIssues, setStableIssues] = useState<HealthIssue[]>([])`.
- In a `useEffect` keyed on the JSON of `rawIssues.map(i => i.id)`, start a 600 ms timer that commits `rawIssues` to `stableIssues`. Clear the timer on next change. Errors (severity `'error'`, e.g. "Day N has no activities") commit immediately — only warnings get the soak, since errors are user-actionable and shouldn't be hidden.
- Use `stableIssues` everywhere `healthIssues` is currently consumed (badge count, score deduction, expanded list).

### 2. Gate buffer/overlap detection behind "fully timed" data

In `analyzeHealth`, before running the overlap and 5-min-buffer loops, require that **every** non-transit activity in the day has both `startTime` and `endTime` set. If any activity is missing one, skip the timing checks for that day (still run the empty-day check). This prevents the optimistic-edit window where one card has half-applied times from producing a phantom overlap.

### 3. Drop the badge below the activation threshold

Only render the collapsed `{N} issue(s)` badge when `stableIssues.length > 0` **and** `healthScore < 95`. A score ≥ 95 means at most one auto-fixable timing warning — not worth alarming the user when the expanded panel can't even cite a conflict. The expanded `Trip Health` section still lists everything, so nothing is hidden.

### 4. Telemetry

Add a single `console.debug('[HEALTH_GHOST]', { rawCount, stableCount, score, dayIds })` when `rawIssues.length !== stableIssues.length` so we can see in Lovable preview logs how often the soak is suppressing a phantom.

## Out of scope

- No changes to `analyzeHealth`'s rules themselves (overlap/buffer/budget thresholds stay).
- No changes to the server-side pre-save timing cascade.
- No changes to refresh-day, repair-day, or any edge function.
- No memory file (this is UI-only stability glue, not a domain rule).

## Files touched

- `src/components/trip/TripHealthPanel.tsx` — add soak state, gate timing checks on fully-timed data, raise badge threshold to `< 95`, add debug log.

## Acceptance

- Loading a freshly-generated trip with a clean itinerary shows **Health 100, no issue badge** on first paint — no flicker from 97 → 100.
- Manually creating an overlap (drag two cards on top of each other) still surfaces the warning within ~1s and the badge appears.
- Empty-day errors continue to surface immediately (no soak for severity `error`).
