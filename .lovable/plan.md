

# Overhaul Import Activities + Add Undo Button to Itinerary Editor

## Problem Summary
Two critical issues:
1. **Import is broken for multi-day/multi-city content**: When you paste a ChatGPT itinerary with multiple days and cities, everything gets dumped into a single day. There's no way to assign activities to specific days or cities, no conflict detection, and no approval step.
2. **No undo button**: The `DayUndoButton` component and `useVersionHistory` hook already exist but are only used in `CustomerDayCard` (a different view). The main itinerary editor (`EditorialItinerary`) has no undo capability, so destructive imports require manual cleanup.

---

## Part 1: Add Undo Button to EditorialItinerary

### What changes
**File: `src/components/itinerary/EditorialItinerary.tsx`**

- Import `useVersionHistory` hook and `DayUndoButton` component
- Wire up `useVersionHistory` for the currently selected day, passing `tripId`, `dayNumber`, and an `onRestore` callback that updates the `days` state
- **Save a version snapshot before destructive actions** (import replace, regenerate) by calling `saveDayVersion()` from the version history service
- Add the `DayUndoButton` to the day header toolbar (near the existing day navigation arrows), visible when `canUndoDay` is true
- The undo restores the previous version's activities and metadata into the selected day

### Why this works
The infrastructure is already built -- `itinerary_versions` table, triggers for auto-incrementing version numbers, cleanup of old versions (keeps last 10), and the full undo/restore flow. We just need to connect it to the main editor view.

---

## Part 2: Rebuild Import Modal for Multi-Day + City-Aware Import

### Current flow (broken)
```text
Paste text --> Parse all lines --> Review checkbox list --> Dump into 1 day
```

### New flow
```text
Paste text --> Detect days/cities --> Show grouped preview --> User assigns day/city per group --> Conflict check --> Import with approval
```

### Detailed changes

**File: `src/components/itinerary/ImportActivitiesModal.tsx`** (major rewrite)

1. **Multi-day detection in parser**: Detect "Day 1", "Day 2", city headers ("Rome", "Florence"), and section breaks to group activities by day/city instead of flattening them.

2. **New step: "Assign" step** between parse and review:
   - Show parsed activities grouped by detected day/city
   - Each group has a dropdown: "Import to Day X" or "Import to [City Name]" 
   - For multi-city trips, show city names in the dropdown (derived from days' `city` field)
   - User can drag groups to reorder or reassign

3. **Conflict detection**: Before final import, check each target day for time conflicts:
   - If imported activity overlaps an existing one, show options: "Replace", "Push existing forward", "Push existing back", or "Skip"
   - Show a summary: "Day 1: 3 new activities, 1 conflict. Day 2: 2 new activities, no conflicts."

4. **Per-day import mode**: Instead of a single merge/replace choice, let users choose per-day: some days might merge, others might replace.

5. **Props update**: The modal now receives the full `days` array and city info (not just `existingActivityCount`) so it can render day/city assignment dropdowns.

**File: `src/components/itinerary/EditorialItinerary.tsx`**

- Update `handleImportActivities` to accept multi-day import results (array of `{ dayIndex, activities, mode }`) instead of single-day
- Save version snapshots for each affected day before applying changes
- Update the `ImportActivitiesModal` props to pass `days` array and city metadata

### Parser improvements (in ImportActivitiesModal)

Add detection patterns:
- `Day 1`, `Day 2`, `## Day 3` -- day boundaries
- City names matching trip's city list -- city boundaries  
- `Rome:`, `Florence:`, `**Paris**` -- city headers
- When a day boundary is detected, subsequent activities go into that group until the next boundary

### New ImportActivitiesModal props
```typescript
interface ImportActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (imports: Array<{
    dayIndex: number;
    activities: ParsedActivity[];
    mode: ImportMode;
  }>) => void;
  currency?: string;
  days: Array<{ 
    dayNumber: number; 
    city?: string; 
    activities: { title: string; startTime?: string }[];
  }>;
}
```

---

## Part 3: Auto-save Version Before Import

**File: `src/components/itinerary/EditorialItinerary.tsx`**

Before `handleImportActivities` modifies any day, call `saveDayVersion()` for each affected day. This ensures the undo button works immediately after a bad import.

---

## Files Modified
- `src/components/itinerary/ImportActivitiesModal.tsx` -- Major rewrite for multi-day/city parsing and assignment UI
- `src/components/itinerary/EditorialItinerary.tsx` -- Add undo button, update import handler for multi-day, auto-save versions before imports

## Files NOT Modified
- `src/hooks/useVersionHistory.ts` -- Already works as-is
- `src/services/itineraryVersionHistory.ts` -- Already works as-is
- `src/components/planner/DayUndoButton.tsx` -- Already works as-is
- Database -- `itinerary_versions` table and triggers already exist
