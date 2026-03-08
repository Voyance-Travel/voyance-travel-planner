

## Plan: Smart Optimize Button Visibility + Meaningful Feedback

### Overview
Add a `needsOptimization` dirty flag that controls Optimize button visibility. The button is hidden on fresh itineraries and only appears after the user makes route-affecting changes (reorder, add, remove, move between days). After optimization runs, the flag clears and the button disappears again.

### Changes — Single File: `src/components/itinerary/EditorialItinerary.tsx`

**1. Add state** (line ~1460, after `optimizePrefs`):
- Add `const [needsOptimization, setNeedsOptimization] = useState(false);`

**2. Set dirty flag in mutation handlers** — add `setNeedsOptimization(true)` at end of:
- `handleActivityReorder` (line ~3106, after `setHasChanges(true)`)
- `handleMoveToDay` (line ~3157, after `setHasChanges(true)`)
- `handleActivityRemove` (line ~3185, after `setHasChanges(true)`)
- `handleAddActivity` (line ~3487, after `setHasChanges(true)`)

**3. Clear flag + improve feedback in `handleOptimize`** (lines ~2917-2937):
- No-changes branch (line ~2917): add `setNeedsOptimization(false)` before the toast; update toast text to "Your routes are already optimized! Credits refunded."
- Success branch (line ~2934): add `setNeedsOptimization(false)` after `setHasChanges(true)`; replace single toast line with human-friendly summary building parts array (routes reordered, transit updated, costs refreshed)

**4. Conditionally render Optimize button**:
- Desktop (lines ~3988-4020): wrap the `<Tooltip>` block in `{needsOptimization && (...)}`
- Mobile dropdown (lines ~4044-4057): wrap the `<DropdownMenuItem>` in `{needsOptimization && (...)}`

**5. Add pulse indicator on desktop button**:
- After the `<Route>` icon (line ~4003), insert a pulsing dot (`<span>` with `animate-ping` inner span + solid outer span, both `bg-primary`, `h-2 w-2`)

### What won't change
- Lock/unlock handlers — no dirty flag
- Initial load / generation — flag starts `false`
- Credit spending / refund logic — untouched
- `handleImportActivities` — could also set the flag but keeping scope minimal; can add later

### Expected behavior
- Fresh itinerary → no Optimize button
- Drag reorder / add / remove / move activity → Optimize appears with pulse dot
- Run Optimize → meaningful toast → button disappears
- Run Optimize with no changes → "already optimized, credits refunded" → button disappears

