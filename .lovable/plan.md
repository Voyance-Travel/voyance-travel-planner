

## Fix: Center the Trip Total Section

**File:** `src/components/itinerary/EditorialItinerary.tsx` (lines 3954-3988)

**Change:** Center-align the Trip Total row and the Days/Guests/Credits row within their container.

1. **Line 3955** — Change the flex layout from `justify-between` to `justify-center`:
   ```
   <div className="flex items-center justify-center gap-3 flex-wrap">
   ```

2. **Line 3980** — Change the meta line from left-aligned to centered:
   ```
   <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap justify-center">
   ```

The currency toggle button stays inline next to the Trip Total. The action buttons row below (Share, Export PDF, etc.) is already centered — no changes needed there.

