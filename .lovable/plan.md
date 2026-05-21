# Output consistency validator: new shared file + 2 wire-ins

## Step 1 — Create `supabase/functions/_shared/output-consistency.ts`

Verbatim from spec. Exports `validateActivityTitleTime`, `validateDayThemes`, `validateDayConsistency`, plus `ConsistencyIssue` interface and `TEMPORAL_WORD_WINDOWS` table (morning/midday/afternoon/evening/night). Title-time mismatch handles late-night wrap by normalizing `start < 6:00` to `+24h`.

## Step 2 — Wire into `supabase/functions/generate-itinerary/pipeline/repair-day.ts`

- Add import (near line 39, next to `validateClosingHours`):
  `import { validateDayConsistency } from '../../_shared/output-consistency.ts';`
- Insert the per-day check **after** the venue-hours block (~line 3885+) and **before** `return { activities, repairs };` at line 4178. Logs `[consistency] Day N type: detail. suggestion` per issue and stamps `day.metadata.quality.consistency_issues`.

## Step 3 — Wire into `supabase/functions/generate-itinerary/action-save-itinerary.ts`

- Add import near other `_shared` imports (~line 13-22):
  `import { validateDayThemes } from '../_shared/output-consistency.ts';`
- Insert the trip-level theme check **just before** the `persistTripItinerary` call at line 1401. Logs `[consistency] type: detail. suggestion` per issue. Non-blocking — warnings only.

## Out of scope

No changes to repair pipeline behavior, persist gates, prompt templates, or LLM calls. Validators are observe-only: emit warnings + stamp metadata. No new auto-rewrites.

## Acceptance

5 greps from spec pass (file exists; ≥6 hits in new file; ≥2 hits each in repair-day + action-save-itinerary; ≥1 `consistency_issues`). Post-deploy Rome regen surfaces `[consistency] Day 1 title_time_mismatch` and `[consistency] duplicate_day_theme` in edge logs.
