

## Fix: Unplanned Days Not Self-Healing Due to Shared Guard Ref

### Problem
Days 3 and 4 of Florence show "Unplanned" with no activities. The self-heal logic we added should restore them (from version history or via regeneration), but it's being skipped because `autoResumeAttemptedRef.current` is shared between two independent self-heal paths.

### Root Cause
In `TripDetail.tsx`, there are two self-heal paths that share the same `autoResumeAttemptedRef`:

1. **Line 1188** — `actualDays < expectedTotal` → calls `handleResumeGeneration()` and sets `autoResumeAttemptedRef.current = true`
2. **Line 1204** — `actualDays >= expectedTotal` with empty days → version-restore/regeneration, guarded by `!autoResumeAttemptedRef.current`

If path 1 fires first (e.g., during initial load when not all day rows exist yet), it locks out path 2. On subsequent renders when all day rows exist but some have empty activities, the empty-day restore never runs.

Additionally, there's **no on-click generation** for Unplanned day tabs — clicking them just shows empty content with no way to trigger generation.

### Fix (1 file, ~15 lines)

**File: `src/pages/TripDetail.tsx`**

**Change 1: Separate the guard refs**

Add a dedicated ref for the empty-day self-heal so it's independent:
```typescript
const autoResumeAttemptedRef = useRef(false);     // for incomplete day count
const emptyDayHealAttemptedRef = useRef(false);   // for days with empty activities
```

Update line 1204 to use `emptyDayHealAttemptedRef` instead of `autoResumeAttemptedRef`, and set `emptyDayHealAttemptedRef.current = true` inside that block. Also update the reset in the cleanup/re-trigger logic to reset both refs.

**Change 2: Add on-click generation for Unplanned days**

In `EditorialItinerary.tsx`, when a user clicks an Unplanned day tab and the day has no activities, show a "Generate this day" CTA button in the day content area. This calls the existing `onDayRegenerate` handler, giving users a manual escape hatch if auto-heal didn't fire.

### Technical Details

- The ref separation ensures both self-heal paths can fire independently during the same load cycle
- The on-click CTA provides a manual fallback so users aren't stuck with permanently empty days
- No backend changes needed

### Files
- `src/pages/TripDetail.tsx` — separate guard refs
- `src/components/itinerary/EditorialItinerary.tsx` — add "Generate this day" CTA for empty days

