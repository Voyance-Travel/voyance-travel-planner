

## Fix: Negative Gap Display in Transit Preview

### Problem

`computeGapMinutes` can return negative values (e.g., `-660`) when the new activity's start time is before the previous activity's end time. The `TransitPreview` displays this raw value as "(-660 min gap)", which is confusing.

### Fix — 2 changes in `src/components/itinerary/TransitPreview.tsx`

**1. Clamp negative gaps to 0 in the display** (lines 119-121 in `TransitSection`):

Replace the raw gap display with a human-friendly message:
```typescript
{gapMinutes !== null && (
  <span className="text-muted-foreground/60">
    {gapMinutes < 0 ? '(times overlap)' : `(${gapMinutes} min gap)`}
  </span>
)}
```

**2. Update conflict check to handle negative gaps** (lines 107-110 in `TransitSection`):

Negative gaps already imply a conflict. The existing `checkScheduleConflict` handles this correctly (transit minutes > gap minutes when gap is negative), so no change needed there — but we should also surface a conflict message when there's no transit estimate but the gap is negative:

```typescript
const conflict = recommended && gapMinutes !== null
  ? checkScheduleConflict(recommended.durationMinutes, gapMinutes)
  : gapMinutes !== null && gapMinutes < 0
    ? { hasConflict: true, message: `These activities overlap by ${Math.abs(gapMinutes)} minutes. Consider adjusting the timing.` }
    : undefined;
```

This ensures:
- Negative gaps show "times overlap" instead of a confusing negative number
- An overlap warning appears even when transit estimates haven't loaded yet

