

## Replace Native Date Inputs with Calendar Popover in AgentHotelSearch

### Problem
On iOS Safari with viewport < 768px, the `Input` component converts `type="date"` to `type="text"` with pattern validation, rendering a plain text field instead of a date picker.

### Plan

**File: `src/components/agent/AgentHotelSearch.tsx`**

1. **Update imports** (lines 8-30):
   - Rename `Calendar` from lucide-react to `CalendarIcon` (to avoid conflict with the UI Calendar component)
   - Add imports: `Popover`, `PopoverContent`, `PopoverTrigger` from UI, `Calendar` component from UI, `cn` from utils
   - Remove `Input` import if no longer needed (but it's still used for destination/guests, so keep it)

2. **Replace Check-in field** (lines 180-191): Replace `<Input type="date">` with a `Popover` containing a `Calendar` component in `mode="single"`. The trigger button shows the formatted date or "Pick date". On select, convert the `Date` to YYYY-MM-DD string via local date formatting (not `.toISOString()` which causes timezone bugs — use the same year/month/day extraction pattern from `dateUtils.ts`).

3. **Replace Check-out field** (lines 193-204): Same pattern, with the `disabled` prop preventing dates before the check-in date.

4. **Update other `Calendar` icon references** (line 183, 196 used the lucide Calendar icon — these are replaced by the popover approach; line 13 import renamed to `CalendarIcon`, used inside the popover trigger button).

### Date Formatting Note
Use `parseLocalDate` from `@/utils/dateUtils` for display, and manual `getFullYear/getMonth/getDate` for the `onSelect` callback to avoid timezone off-by-one, consistent with project conventions.

### Files Changed

| File | Change |
|------|--------|
| `src/components/agent/AgentHotelSearch.tsx` | Replace native date inputs with Popover+Calendar pickers; update imports |

