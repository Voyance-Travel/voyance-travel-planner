

## Fix: Remove duplicate close button from AI Insights panel

### Problem
When the explanation panel is expanded, the user sees two dismiss controls:
1. The top-right button that now reads "Hide" (toggles visibility)
2. An X button inside the explanation panel itself

### Fix
Remove the X button from inside the explanation panel (lines 95-100). The top-right "Hide" button already handles dismissal and is more discoverable since it's the same button used to open the panel.

### File
`src/components/itinerary/ExplainableActivity.tsx` — Remove the X close button from inside the explanation panel div, and simplify the inner layout since `justify-between` is no longer needed.

