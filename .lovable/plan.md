# Fix Duration HH:MM:SS Bug at the Data Layer

## Symptom
Day 2 raw text shows duration values like `15:00:00`, `45:00:00`, `1:05:00`, `2:20:00`, `10:00:00`. These are minute integers being formatted as `HH:MM:SS` clock strings somewhere in the pipeline. Even when the UI hides them, they leak into screen-reader text, AI prompts, exports, and the activity JSON.

## What I confirmed during exploration
- The healthy path uses two duration shapes:
  - **`durationMinutes`** — integer (e.g. `45`)
  - **`duration`** — human string built by `formatDuration()` in `src/utils/plannerUtils.ts` → `"45m"` / `"1h 5m"`
- DB schemas use `duration_minutes integer` everywhere (no `interval`/`time` columns for durations). So the bad string is being **constructed in code**, not coming from Postgres.
- Dozens of places build `"${minutes} min"` or `"${h}h ${m}m"`. None of the obvious formatters emit `HH:MM:SS`. The `15:00:00`-style values are very likely **AI-emitted strings** that the model wrote as `"duration": "15:00"` or `"15:00:00"` (interpreting "15 minutes" as a clock duration), and we are passing them through unchanged into `activity.duration`.
- Evidence supporting this:
  - Multiple ingest paths (`itineraryParser.ts:414`, `EditorialItinerary.tsx:3672/3759/4031`, `previewConverter.ts:92`) take `activity.duration` straight from upstream JSON.
  - Nothing currently sanitizes `duration` to ensure it matches `Nh Nm` / `N min` shape.
  - `1:05:00` and `2:20:00` are exactly what the model produces when it thinks "duration → time-of-day clock".

## Fix Plan

### 1. New shared sanitizer: `coerceDurationString(raw, durationMinutes?)`
Add to `src/utils/plannerUtils.ts` (and a Deno-safe twin in `supabase/functions/generate-itinerary/_shared/duration-format.ts`).

Rules:
- If `durationMinutes` is a positive integer, ALWAYS return `formatDuration(durationMinutes)`. Trust the int over the string.
- Else if `raw` matches `^\d{1,2}:\d{2}(:\d{2})?$` → parse as `HH:MM[:SS]`, convert to total minutes, return `formatDuration(total)`. (`"15:00:00"` → `15h`, `"1:05:00"` → `1h 5m`, `"45:00"` → `45m` only when leading number > 23 or trailing `:00`.)
  - Heuristic: if HH ≥ 24 OR (HH ≥ 5 AND MM=00 AND no `:SS`), treat HH as **minutes**, not hours. This recovers `"45:00"` → `45m` instead of `45h`.
- Else if `raw` matches `^\d+\s*(min|m|mins|minutes)$` → pass through normalized.
- Else if `raw` matches `^\d+\s*(h|hr|hour|hours)(\s*\d+\s*(m|min)?)?$` → pass through normalized.
- Else if `raw` is a bare integer string → treat as minutes.
- Else → drop it. Return `formatDuration(durationMinutes ?? 60)` or empty string if no fallback.

Add a unit test file covering each branch with the values from the bug report.

### 2. Apply at the three ingest seams
- **`src/utils/itineraryParser.ts:414`** — wrap the `duration` extraction with `coerceDurationString`.
- **`src/utils/previewConverter.ts:92`** — same.
- **`src/components/itinerary/EditorialItinerary.tsx`** — at every place an activity is constructed/normalized (`3672`, `3759`, `4031`, `4958`, the `recalcDuration` helper near `5291`), pipe `duration` through the sanitizer. The `recalcDuration` already uses good logic; the issue is upstream payloads that bypass it.

### 3. Backend post-generation pass
In `supabase/functions/generate-itinerary/universal-quality-pass.ts` (or a small new helper imported from there + `repair-day.ts`), after activities are built, walk every activity and:
1. If `duration_minutes` is a number, regenerate `duration` from it ("Nh Nm" / "N min").
2. Else if `duration` is `HH:MM[:SS]`-shaped, parse → set both `duration_minutes` and a clean `duration` string.

This guarantees that whatever shape the model emits, what we ship to the client and to `activity_costs.notes`/snapshots is always normalized.

### 4. Defense-in-depth render guard
In the components that render `activity.duration` directly (grep: `FullItinerary.tsx:494`, `TripActivityCard.tsx:136`, transit badges, etc.), call the same `coerceDurationString` at render time. This means any **legacy stored data** in existing trips also displays correctly without a backfill.

### 5. (Optional) DB backfill
A short Node script (`scripts/backfill-duration-strings.ts`) that walks `itinerary_activities` rows where `duration ~ '^\d{1,2}:\d{2}'` and rewrites the string from `duration_minutes`. Only worth doing if production trips already have many polluted rows; otherwise the render guard in step 4 covers it.

## Files to change
- `src/utils/plannerUtils.ts` — add `coerceDurationString` + tests
- `src/utils/itineraryParser.ts`
- `src/utils/previewConverter.ts`
- `src/components/itinerary/EditorialItinerary.tsx` — sanitize at activity build sites
- `src/components/itinerary/FullItinerary.tsx`, `planner/TripActivityCard.tsx` — render-time guard
- `supabase/functions/generate-itinerary/_shared/duration-format.ts` — new shared util
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — call the post-gen normalizer
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — same call

## Verification
- New unit tests assert: `"15:00:00"` → `"15h"`, `"45:00:00"` → `"45m"` (when `durationMinutes=45`), `"1:05:00"` → `"1h 5m"`, `"2:20:00"` → `"2h 20m"`, `"10:00:00"` → `"10h"`.
- Generate a fresh Rome trip; inspect the activity JSON: every `duration` matches `^(\d+h(\s\d+m)?|\d+m|\d+ min)$`. No colons.
- Open an existing trip with the bad strings stored: render guard converts them on display.

## Out of scope
- Touching transport `duration` strings produced by Google Routes (`route-details/index.ts`, `optimize-itinerary/index.ts`) — those are already minute-formatted and unrelated.
- DNA / personalization changes.
