

## Spa/Wellness Limiter — 3 Changes

### The Problem
AI generates spa/wellness on 3+ consecutive days, totaling €590. No trip needs that many spa sessions.

### The Fix (2 files)

#### 1. Gather wellness history from previous days (`action-generate-trip-day.ts`, ~line 408)
After `previousActivities` and `usedVenues` are built from `existingDays`, scan `existingDays` for wellness activities and build `previousWellnessDays: number[]`. Construct a `wellnessInstruction` string:
- If 2+ wellness days exist → "Do NOT add any more spa/wellness"
- If yesterday had wellness → "Yesterday had wellness, do NOT add today"  
- Otherwise → "No spa/wellness yet" or list which days had it

Pass `wellnessInstruction` as a new field in the `generate-day` request body (alongside `previousDayActivities`, `usedVenues`, etc.).

#### 2. Inject wellness rule into AI prompt (`pipeline/compile-prompt.ts`, ~line 1060)
Extract `wellnessInstruction` from `params`. Insert a `WELLNESS & SPA RULES` block into the user prompt near the existing dedup/venue rules section:
```
WELLNESS & SPA RULES:
- Maximum 2 spa or wellness activities across the entire trip
- NEVER put spa/wellness on two consecutive days
- [dynamic wellnessInstruction from previous days]
```

#### 3. Post-generation enforcement (`action-generate-trip-day.ts`, ~line 789, after hallucination filter)
After the hallucination filter block, add an inline wellness limiter using the same `existingDays` data:
- Detect wellness via category `'wellness'` or regex `/spa|hammam|wellness|massage|hydrotherapy|rejuvenation|thermal|sauna/i` on title/description
- If `previousWellnessDays.length >= 2` OR yesterday had wellness → filter out all wellness activities from `dayResult.activities`
- Log removed activities

### Files Changed
1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — build wellness history, pass to prompt, post-generation filter
2. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add wellness rules block to AI prompt

