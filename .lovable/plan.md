

# Fix Parser: Time Headers as Activities Bug

## Problem
The `parse-trip-input` edge function's system prompt doesn't instruct the AI to treat time-of-day headers ("Dinner", "Morning", "Evening") as time slots rather than activities. This causes "Dinner" to appear as a separate activity from "Uchi".

## Change

**Single file edit**: `supabase/functions/parse-trip-input/index.ts`

Replace the existing `SYSTEM_PROMPT` constant with the comprehensive prompt you provided above. This adds:

1. **Time headers are NOT activities** -- "Dinner", "Morning", "Evening" etc. become the `time` field on the following activities
2. **Merge time + content** -- "Dinner at Uchi" parses to `name: "Uchi", time: "Dinner"`
3. **Meal words = dining category** -- Breakfast/Lunch/Dinner automatically set `category: "dining"`
4. **Either/or grouping** -- "Uchi or Loro" gets shared `optionGroup` and `isOption: true`
5. **Venue extraction** -- "Live music at The Continental Club" parses to `name: "The Continental Club"`
6. **Parenthetical parsing** -- costs, notes, booking requirements extracted from parentheses
7. **Day structure recognition** -- various "Day 1" formats parsed for dayNumber, date, theme
8. **Table format handling** -- markdown table column headers mapped to fields
9. **Practical tips separation** -- "Tips" sections go to `practicalTips`, not activities
10. **Meta-content filtering** -- AI filler like "Let me know if..." is ignored
11. **Prompt vs output detection** -- extracts preferences from user prompt section

## Technical Details

- Only the `SYSTEM_PROMPT` string constant changes; no structural code changes
- The tool schema (`EXTRACT_TOOL`) remains unchanged -- it already supports all the fields referenced by the new prompt
- The edge function will be redeployed after the update
- The new prompt adds a `timeOfDay` field in examples but this is not in the tool schema -- the AI may include it as extra data which will be harmlessly ignored, or we can add it to the schema if desired

## Post-Update Validation

After deploying, test with the 4 test cases from your message to confirm:
- No time headers appear as activity names
- Either/or options are properly grouped
- Table formats parse correctly
- User prompt sections extract preferences

