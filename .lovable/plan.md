## HC.1 — Frontend health checks: meals, density, gaps

Extend `analyzeHealth` in `src/components/trip/TripHealthPanel.tsx` so the panel surfaces missing meals, thin days, and large gaps — matching what the server's meal-policy + density enforcement already requires. Today the panel only flags empty days, timing conflicts, and tiny buffers, so a Day 2 with 1 activity, 0 meals, and a 7-hour gap reads as 100/healthy.

### What ships

Insert three new checks into `analyzeHealth` immediately **after** the empty-day early-return at line 86 and **before** the timing-conflict block at line 88. All three operate on the existing `realActivities` array and the existing `dayNum`.

**1. Required-meal check** (mirrors server `deriveMealPolicy`)
- Detect meals: scan `realActivities`, look at `category` (`dining`/`restaurant`/`food`) + `title` (`breakfast`/`brunch`/`lunch`/`dinner`/`supper`).
- Resolve required meals from `day.metadata?.quality?.dayMode`:

  | dayMode | required |
  |---|---|
  | `late_arrival`, `full_day_event` | `[]` |
  | `early_departure` | `['breakfast']` |
  | `midday_arrival` | `['lunch','dinner']` |
  | `midday_departure`, `afternoon_departure` | `['breakfast','lunch']` |
  | everything else (incl. undefined) | `['breakfast','lunch','dinner']` |

- For each missing meal → push **one** issue per day:  
  `id: missing-meals-${dayNum}`, severity `error`, message `"Day N missing breakfast, lunch, dinner"`, fixAction `refresh_day` (see "Action key" below), label `"Regenerate Day"`.

**2. Thin-day check**
- Skip when `dayMode` ∈ {`late_arrival`, `early_departure`, `full_day_event`, `midday_departure`}.
- If `realActivities.length < 3`:  
  `id: thin-day-${dayNum}`, severity `error` (when 1) / `warning` (when 2), message `"Day N has only X activity/activities (light schedule)"`, fixAction `refresh_day`, label `"Add Activities"`.

**3. Large-gap check**
- Sort `realActivities` by `startTime` (reuse existing `parseTime` — file already exports it at line 185, no need for a new `parseTimeToMinutes`).
- Track `prevEnd`; for each next activity where `start - prevEnd ≥ 180` minutes:  
  `id: gap-${dayNum}-${startMins}`, severity `warning`, message `"Day N has Xh gap before <title>"`, fixAction `refresh_day`, label `"Fill Gap"`.
- Only update `prevEnd` when the new end is strictly greater (guards against zero-duration / inverted entries).

### Action key decision

User spec uses two new fixAction names: `regenerate_day` and `fill_day`. Neither is wired in `TripDetail.tsx`'s two `onAction` handlers (lines 2912 and 3171). The existing `refresh_day` handler already does exactly what we want — calls `setRefreshDayRequest`, which triggers full server-side rebuild including meal policy, density, gap fill, and timing.

**Recommendation:** map all three new issue types to `fixAction: 'refresh_day'` so no parent wiring changes are needed. The button labels (`Regenerate Day`, `Add Activities`, `Fill Gap`) still differ per issue — only the underlying action is shared. If the user wants distinct keys later (e.g. for analytics differentiation), we can split them then.

### Files touched

- `src/components/trip/TripHealthPanel.tsx` — insert the three checks inside `analyzeHealth` after line 86, before line 88. Reuse the existing `parseTime` helper (already in the file).

No changes to `TripDetail.tsx` (mapping to `refresh_day` reuses existing wiring).  
No changes to types — the new issues fit `HealthIssue` as-is.

### Verification

- Existing test file `src/components/trip/__tests__/TripHealthPanel.analyzeHealth.test.ts` filters by `fixAction === 'fix_timing'` → unaffected; should still pass.
- Berlin Day 2 example (1 activity, 7h gap, 0 meals, no `dayMode`) should now produce four issues: missing-meals (3 meals), thin-day (1 activity → error), and one gap warning. Health score drops out of 100 as intended.
- Days with explicit `dayMode: 'late_arrival'` or `'full_day_event'` still produce zero new issues (correctly silent).

### Out of scope

- Server-side health checks (those exist in repair pipeline already).
- Adding new analytics keys for `regenerate_day` / `fill_day`.
- New unit tests — current coverage is minimal; happy to add a follow-up if desired.
