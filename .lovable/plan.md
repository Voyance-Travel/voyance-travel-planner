

## Fix 22E: Must-Do Pre-Fill & Reverse Scheduling

### Overview
Create two new files (`time-parser.ts`, `must-do-filler.ts`) in `src/lib/schema-compiler/`, update `compile-day-schema.ts` to call the must-do filler in Step 5, and update `index.ts` exports. No existing generation files touched. All code remains behind the OFF feature flag.

### Files to Create (2)

**1. `src/lib/schema-compiler/time-parser.ts`** — Pure utility functions
- `normalizeTimeText`: "Noon" → "12:00pm", "midnight" → "12:00am"
- `extractTimeRange`: "US Open Noon-4:30pm" → `{ startTime: "12:00", endTime: "16:30" }`
- `parseToHHMM`: "9am" → "09:00", "5:30pm" → "17:30"
- `cleanActivityTitle`: "US Open Noon-4:30pm" → "US Open"
- Time arithmetic: `parseTimeToMinutes`, `minutesToTime`, `addMinutes`, `subtractMinutes`

**2. `src/lib/schema-compiler/must-do-filler.ts`** — Must-do placement + reverse scheduling
- `fillMustDoSlots(slots, mustDos, hotelLocation)`: Main entry point
- For each must-do: parse time from raw title, clean title, find/insert slot, reverse-calculate transport, handle meal overlaps
- Reverse scheduling: if must-do at 9:00 AM and transfer = 45 min + 15 min buffer → transport departs 8:00 AM → compress earlier slots
- Meal overlap handling: if must-do covers lunch window → mark meal optional with venue-eating note; if partial overlap → shift meal after must-do
- Imports from `time-parser.ts` and `@/config/feature-flags` (for `SCHEMA_GENERATION_CONFIG` timing constants)

### Files to Update (2)

**`src/lib/schema-compiler/compile-day-schema.ts`** (lines 27-28, 102-104)
- Add import for `fillMustDoSlots` and `MustDoInput`
- Replace Step 5 to include must-do filling after flight/hotel constraint filling

**`src/lib/schema-compiler/index.ts`**
- Add exports for `time-parser` utilities and `must-do-filler`

### Isolation
- Zero modifications to existing generation or must-do-priorities code
- Zero runtime impact — behind OFF feature flag
- Completes the 5-part schema-driven generation system

