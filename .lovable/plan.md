

## Fix 23A: Day Persistence Bug — Day 3 Disappears on Page Load

### Analysis

After reviewing both files, the situation is:

1. **`itineraryAPI.ts` (generation save)**: The save logic at lines 418-443 looks correct — it builds an `Itinerary` object with `days` array and saves it as `itinerary_data`. The `days` array is populated in the loop (line 384). This path appears sound IF all days return `data.day`. If Day 3's edge function call fails silently or returns no `data.day`, it would be skipped without error. The `regenerateDay()` function (lines 576-604) already has the day-count guard and wraps in the full itinerary object — this is already correct.

2. **`itineraryParser.ts` (deduplication)**: Lines 560-598 show the real problem. The parser deduplicates by dayNumber (lines 563-570) then by date (lines 573-581), silently dropping days. Since `parseSingleDay` at line 472 uses `calculateDayDate(tripStartDate, dayIndex)` — which computes dates from `tripStartDate + dayIndex` — if the AI returns days with the same dayNumber, only one survives. Worse, the date dedup at line 575 uses the calculated date, and since dates are recalculated from index, they should be unique... unless the data stored in the DB already has duplicate dayNumbers from the AI.

The primary fix is in the parser: re-number duplicates instead of dropping them. The secondary fix is adding a day-count validation + recovery step in the generation save.

### Changes

**File 1: `src/utils/itineraryParser.ts`** (lines 560-598)

Replace the deduplication logic:
- **dayNumber dedup** (lines 563-570): Instead of dropping duplicates, re-assign the duplicate to `maxDayNumber + 1` with a warning log
- **date dedup** (lines 573-581): Instead of dropping duplicates, use a unique key (`dateKey-dup-N`) to keep both, with a warning log
- **Add count mismatch warning** after dedup (line 589): Already exists but only warns — keep as-is since re-numbering should prevent drops

**File 2: `src/services/itineraryAPI.ts`** (lines 374-443)

After the generation loop (line 416), before building the itinerary:
- Add day count validation: if `days.length < totalDays`, attempt recovery from `itinerary_days` table
- Log the count for debugging

### Files Changed: 2
1. `src/utils/itineraryParser.ts` — Fix dedup to re-number instead of drop
2. `src/services/itineraryAPI.ts` — Add day count validation + recovery after generation loop

