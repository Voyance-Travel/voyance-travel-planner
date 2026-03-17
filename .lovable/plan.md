

## Fix: Discover Category Filter — No Visual Feedback

### Root Cause

Two issues in `DiscoverDrawer.tsx` and `CategoryBrowse.tsx`:

1. **No deselect toggle**: `handleCategorySelect` always sets the category — clicking "Nightlife" again doesn't deselect it. The `ActivityAlternativesDrawer` handles this correctly (line 198: `if (activeFilter === suggestion.label) { setActiveFilter(null); ... }`), but `DiscoverDrawer` doesn't.

2. **Silent failure on empty results**: When the `nearby-suggestions` edge function returns no results (common if geocoding fails or destination has no indexed nightlife), the only indicator is a tiny muted text line: `"No nightlife spots found nearby."` There's no visual cue that the filter *worked* — no transition, no category label in the results area, nothing to connect the chip click to an outcome.

3. **Chip selected state works in code** (`variant='default'` when `selected === cat.key`) but there may be a timing issue: if the edge function errors, `categoryLoading` stays false and `categoryResults` stays empty from the prior `setCategoryResults([])` call at line 237, making it look like nothing happened.

### Fix

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/DiscoverDrawer.tsx` | Add toggle-off logic to `handleCategorySelect`: if same category clicked, reset `selectedCategory` to `null` and clear results. |
| 2 | `src/components/itinerary/DiscoverDrawer.tsx` | Add a results header when a category is selected: show "Showing: {category}" label above results area so the user sees their filter is active. |
| 3 | `src/components/itinerary/DiscoverDrawer.tsx` | Improve empty state: replace plain text with a styled empty state card that names the category and suggests trying another. |
| 4 | `src/components/itinerary/discover/CategoryBrowse.tsx` | Add a subtle ring/scale animation on the selected chip for immediate tactile feedback: `ring-2 ring-primary/30 scale-[1.02]` when selected. |

### Details

**Toggle-off in `handleCategorySelect`** (line 234):
```
if (selectedCategory === cat) {
  setSelectedCategory(null);
  setCategoryResults([]);
  setCategoryLoading(false);
  return;
}
```

**Results header** (line 387, before the empty/results render):
Show a small pill like `"Nightlife in {destination}"` with a clear (×) button that resets the filter — gives immediate visual confirmation that the chip click registered.

**Better empty state** (line 388):
Replace the plain `<p>` with a card containing the category icon, a message like "No nightlife spots found in {destination}", and a "Try another category" prompt.

**Chip micro-feedback** in `CategoryBrowse.tsx`:
Add `transition-all duration-150` and when selected: `ring-2 ring-primary/20 shadow-sm scale-[1.02]` to make the state change unmissable.

