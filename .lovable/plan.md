

# Fix: Location-Aware Buffer Enforcement

## The Problem

You're right — the system currently detects insufficient buffers but uses a **flat 15-minute minimum** regardless of how far apart two activities are. A restaurant in Montmartre followed by a museum across Paris still gets the same 15-minute buffer as two places on the same street. The system literally has coordinates for both venues (from Google Places verification in Stage 4) but doesn't use them to calculate actual transit time.

**Current flow:**
1. AI generates activities with coordinates
2. Stage 2.7 enforces a flat 15-min buffer (before enrichment even adds coordinates)
3. Stage 4 enriches activities with verified coordinates, ratings, hours
4. Stage 4.5 validates opening hours
5. **No stage uses coordinates to check if buffers are realistic for the actual distance**
6. Frontend `TransitGapIndicator` shows warnings about tight gaps — after the fact

The `haversineDistanceKm` function already exists in `index.ts`. Coordinates are available after Stage 4 enrichment. The infrastructure is there; nobody wired it up.

## The Fix

### 1. Add a new Stage 4.6: Distance-Aware Buffer Enforcement (index.ts)

After Stage 4 enriches activities with coordinates, run a new pass that:

- For each consecutive activity pair, calculates the haversine distance using their coordinates
- Estimates minimum transit time based on distance:
  - Under 500m → 10 min (walking)
  - 500m–2km → 15 min (walking)
  - 2km–5km → 20 min (taxi/transit pickup + ride)
  - 5km–15km → 30 min (taxi ride)
  - Over 15km → 45 min (significant transit)
- Compares this estimated transit time against the actual gap between activities
- If the gap is less than the estimated transit time: shifts the next activity forward (same cascade logic as Stage 2.7)
- Logs every fix with distance and estimated transit time

### 2. Move Stage 2.7 to a lighter "overlap fix only" role

Stage 2.7 currently runs before coordinates exist. Keep it as a basic overlap/zero-gap fixer (< 5 min), but remove the 15-min flat buffer logic since Stage 4.6 will handle it properly with real distances.

### 3. Apply the same logic in single-day regeneration (generateSingleDayWithRetry)

After the single-day flow enriches activities, run the same distance-aware buffer check so rewrites don't reintroduce unrealistic gaps.

### 4. Update the prompt contract (personalization-enforcer.ts)

Update the `buildScheduleConstraintsPrompt` transition rules to tell the AI:
- "Post-processing will verify buffers using actual GPS distances. If two venues are far apart, the system will automatically expand the gap. Plan conservatively."

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add Stage 4.6 distance-aware buffer enforcement after enrichment. Reduce Stage 2.7 to overlap-only. Apply same logic in single-day path. |
| `supabase/functions/generate-itinerary/personalization-enforcer.ts` | Update prompt to mention post-processing will verify with GPS distances |

## Distance-to-Transit Estimation

```text
Distance (haversine)   →   Min buffer (minutes)
─────────────────────────────────────────────────
< 500m                 →   10 min  (easy walk)
500m – 2km             →   15 min  (brisk walk)
2km – 5km              →   20 min  (short taxi)
5km – 15km             →   30 min  (taxi ride)
> 15km                 →   45 min  (cross-city)
```

This uses the coordinates already enriched in Stage 4, requires no API calls, and catches the most common problem: AI scheduling activities across town with a 5-minute gap.

