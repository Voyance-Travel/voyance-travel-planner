

## Fix: Day Expand in TripOverview

### Problem
Day cards in the Trip tab have `onClick={() => onDaySelect?.(day.dayNumber)}` but `onDaySelect` is never passed from `ActiveTrip.tsx`, so tapping does nothing.

### Fix: Inline expand with local state (Option A)

**File: `src/components/trips/TripOverview.tsx`**

1. Add `expandedDay` state: `const [expandedDay, setExpandedDay] = useState<number | null>(null)`
2. Change day card `onClick` from `onDaySelect?.(day.dayNumber)` to toggle `expandedDay`
3. Swap `ChevronRight` for `ChevronDown` when expanded (rotate animation)
4. After each day `Card`, inside `AnimatePresence`, render expanded activity list when `expandedDay === day.dayNumber`:
   - Each activity as a compact row: colored dot + name + check icon if completed
   - Uses the `days` prop's activities array + `completedActivities` set

No changes needed in `ActiveTrip.tsx`. The `onDaySelect` prop stays optional for future use but the primary interaction is now self-contained.

