

## Arrival & Departure Timing Enforcement — Assessment

### Already Implemented

Every element of the proposed spec is already present in the codebase:

| Spec Requirement | Existing Implementation | Location |
|---|---|---|
| **Post-parse filter: Day 1, remove before arrival + 2h** | `enforceArrivalTiming()` — filters activities before `arrivalMins + 120`, preserves transport/check-in/arrival | `flight-hotel-context.ts:501-525` |
| **Post-parse filter: Last day, remove after departure - 3h** | `enforceDepartureTiming()` — filters activities after `departureMins - 180`, preserves transport/checkout/departure | `flight-hotel-context.ts:532-559` |
| **Called inline after AI parse** | Both called in `universalQualityPass()` (Steps 1 & 2), which runs after AI response parsing | `universal-quality-pass.ts:78-87` |
| **Also called in orchestrator** | Both imported and used in `action-generate-trip-day.ts` and `action-generate-day.ts` | Lines 11, 59-62 respectively |
| **AI prompt for Day 1** | `buildArrivalDayPrompt()` injects flight arrival time, earliest start (arrival + buffer), energy level, required hotel check-in sequence, late arrival guidance | `prompt-library.ts:916-1060` |
| **AI prompt for Last Day** | `buildDepartureDayPrompt()` injects departure time, latest end (departure - 3h), checkout sequence | `prompt-library.ts:1067-1479` |
| `parseTimeToMinutes` helper | Already exists in both `flight-hotel-context.ts` and `src/utils/timeFormat.ts` | Both files |

### Conclusion

**No changes needed.** The existing implementation covers all three parts of the spec:
1. ✅ Post-parse arrival filter (2h buffer)
2. ✅ Post-parse departure filter (3h buffer)
3. ✅ AI system prompt injection for both Day 1 and Last Day

The current version is actually more sophisticated — it includes DNA-aware energy levels, jet lag sensitivity, arrival window categorization (morning/afternoon/evening/night), and hotel check-in time awareness.

