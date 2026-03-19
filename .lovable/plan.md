

## Fix: Walk segment ⋯ menu appears to control the activity below it

### Problem

Walk/transit segments render as slim connector rows (via `TransitModePicker`) between full activity cards. The ⋯ menu on these rows **does** correctly target the walk activity itself — but users perceive it as belonging to the next activity card because:

1. The walk row is visually minimal (icon + label + duration pill), making the ⋯ button look like it's floating near the top of the card below
2. On desktop, the ⋯ only appears on hover (`sm:opacity-0 sm:group-hover/activity:opacity-100`), and the hover zone bleeds into the next card's visual space
3. The menu items ("Edit Details", "Move Up", "Move Down") feel odd for a transit connector — reinforcing the impression it's controlling the wrong thing

### Fix

**File: `src/components/itinerary/TransitModePicker.tsx`**

Two changes to reduce confusion:

1. **Hide the ⋯ menu on walk/transit rows entirely.** These are lightweight connectors, not user-managed activities. Users can already:
   - Tap the row to expand transport options (TransitModePicker's expand feature)
   - Use the `TransitGapIndicator` between activities for mode switching
   - Edit/remove activities via the activity cards themselves

   Remove the DropdownMenu block (lines 360–408) from the transit row. This eliminates the visual ambiguity completely.

2. **If full removal is too aggressive**, alternatively scope the menu to transit-relevant actions only and add a visual label:
   - Replace "Edit Details" → "Change transport mode" (triggers the expand)
   - Remove "Move Up" / "Move Down" (transit segments shouldn't be reordered independently)
   - Keep "Remove" as "Remove transit step"
   - Add a subtle label like `"⋯ Walk"` so it's clear what the menu targets

### Recommended approach

Option 1 (remove the ⋯ entirely) is cleaner. The expand-on-tap already provides all the transport editing UX needed. The ⋯ menu on transit rows adds no unique value and creates confusion.

### Changes

**`src/components/itinerary/TransitModePicker.tsx`** — Remove the `{isEditable && !activity.isLocked && (<DropdownMenu>...</DropdownMenu>)}` block (lines 359–408) from the transit row's flex container.

