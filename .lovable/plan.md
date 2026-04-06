

## Fix Day 2+ Pre-Dawn Activity Scheduling (12:15 AM / 1:20 AM / 3:05 AM)

### Root Cause

The AI sometimes returns times in ambiguous format for middle days. While the prompt says "24-hour HH:MM format," the AI occasionally outputs low hour values (`0:15`, `1:20`, `3:05`) that are interpreted as AM times. There is **no normalization step** after AI response parsing that converts 12h→24h, and **no dawn guard** in the repair pipeline that catches activities before 6:00 AM on non-arrival days.

The prompt already says "Do NOT include any activities between 12:00 AM and 6:00 AM" (line 955), and `buildRegularDayPrompt` correctly sets `earliestStart` to 07:30–10:30 based on DNA — but neither the AI nor the repair pipeline enforces this deterministically.

### Changes

#### 1. Add time normalization in `action-generate-day.ts` (~line 302)

In the activity normalization map (where titles, costs, and locations are already normalized), add `startTime` and `endTime` normalization using the existing `normalizeTo24h()` helper:

```typescript
startTime: act.startTime ? (normalizeTo24h(act.startTime) || act.startTime) : undefined,
endTime: act.endTime ? (normalizeTo24h(act.endTime) || act.endTime) : undefined,
```

This catches cases where the AI returns `"1:20 PM"` → `"13:20"`.

#### 2. Add dawn guard in `repair-day.ts` — new step after chronology sort (~line 470)

Add a deterministic guard that shifts all pre-6AM activities forward on **non-arrival days** (or non-arrival activities on arrival days). The logic:

- Parse each activity's `startTime`
- If `startTime` < 06:00 (360 minutes) AND the activity is not a flight/arrival/transport-to-airport:
  - Compute the offset needed to shift the first pre-dawn activity to the day's `earliestStart` (passed as a new parameter, defaulting to `"08:00"`)
  - Shift ALL activities forward by the same offset (preserving relative spacing)
  - Log `DAWN_GUARD: shifted N activities forward by X minutes`

This handles both the "AI meant PM but wrote AM" case and the "AI started from midnight" case by uniformly rebasing the day.

#### 3. Pass `earliestStart` to `repairDay`

The `RepairDayInput` interface already has flight/hotel context. Add an optional `earliestStart?: string` field so the dawn guard knows when the day should begin (from `buildRegularDayPrompt`). The callers in `action-generate-day.ts` and `action-generate-trip-day.ts` already have this value from the prompt builder.

#### 4. Add nightcap-before-dinner swap in `repair-day.ts`

After the meal order step (~step 5a), add a check: if any activity with "nightcap" / "cocktail" / "after-dinner" in the title appears before dinner, move it to after dinner. This is a simple index-based reorder within the existing meal sequencing logic.

### Files to edit

| File | Change |
|------|--------|
| `action-generate-day.ts` | Normalize `startTime`/`endTime` via `normalizeTo24h()` in activity map (~line 302) |
| `pipeline/repair-day.ts` | Add dawn guard (~line 470) that rebases pre-6AM days; add nightcap swap in meal ordering |
| `pipeline/repair-day.ts` | Add `earliestStart?: string` to `RepairDayInput` interface |
| `action-generate-trip-day.ts` | Pass `earliestStart` when calling `repairDay` |

### Verification

- Generate a 3+ day Berlin trip
- Day 2 activities should start at 08:00–10:00 AM, not midnight
- No activities before 6:00 AM on any day
- Nightcap activities appear after dinner
- Check logs for `DAWN_GUARD` entries

