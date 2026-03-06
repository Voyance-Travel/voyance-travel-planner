

## Plan: Fix Flight Card Date/Time Inputs on Mobile

### Problem
The Input component uses `h-10` height and `text-base` on mobile (only switching to `md:text-sm`). Combined with `type="date"` and `type="time"` native inputs, this creates oversized fields that crowd together on small screens. The `text-sm` class passed via `className` is overridden by the base `text-base` + `md:text-sm` in the component.

### Fix

Reduce the input height and font size specifically on the flight card date/time inputs by passing `h-8 text-xs` classes instead of just `text-sm`. This applies to all three flight card sections (outbound, additional legs, return).

**File: `src/pages/Start.tsx`**

At lines 1233, 1357, 1472 — the three `grid` containers for Date/Departs/Arrives — reduce gap and input sizing:

- Change all `<Input type="date" ... className="text-sm" />` and `<Input type="time" ... className="text-sm" />` within these grids to `className="text-xs h-8"`
- Reduce the grid gap from `gap-2 sm:gap-3` to `gap-1.5 sm:gap-3`

This affects 9 Input elements total (3 per flight section x 3 sections).

