

## Fix: Dates/Budget Not Shown in Confirmation Card After "Fix Something"

### Root Cause

When the user clicks "Fix something", `onEdit` sets `extractedDetails` to `null` (line 482). The user provides corrections, and the AI makes a new `extract_trip_details` tool call. However, the AI often returns **only the changed fields** in the correction round (e.g., dates and budget) while omitting unchanged fields it already extracted (e.g., pace, interests). The card then displays the incomplete new extraction.

The card rendering code is correct — it checks `details.startDate`, `details.budgetAmount`, etc. The data simply isn't there because there's no merge with the previous extraction.

### The Fix

**One change in `TripChatPlanner.tsx`**: Store the previous `extractedDetails` before clearing, and merge new tool call results on top of it.

| # | Change |
|---|--------|
| 1 | Add a `useRef` (`prevExtractedRef`) to hold the last successful extraction before the user clicks "Fix something". |
| 2 | In `onEdit` handler (line 481-488): save `extractedDetails` into `prevExtractedRef.current` before setting it to `null`. |
| 3 | In the tool call parsing block (line 264): after parsing `details`, merge with `prevExtractedRef.current` — previous values serve as defaults, new values override. Then clear the ref. |

```
// Pseudo-code for the merge:
const prev = prevExtractedRef.current;
if (prev) {
  details = { ...prev, ...details };
  // For arrays like cities/interestCategories, prefer new if present
  prevExtractedRef.current = null;
}
```

This ensures that when the AI returns `{ startDate, endDate, budgetAmount }` on a correction, the destination, pace, interests, etc. from the first extraction are preserved. The card will then display all fields.

### File

`src/components/planner/TripChatPlanner.tsx` — add `useRef`, update `onEdit`, update tool call merge logic (~5 lines added).

