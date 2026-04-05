

## Hide Empty System Note / Description Containers

### Problem
After sanitization strips stub text like "Popular with locals", the UI still renders empty containers (gray box with pin icon, empty tip sections) because the render guard checks the *raw* field value (`activity.description && ...`) which is truthy, but `sanitizeActivityText()` returns `''`.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

Add a `hasContent` helper (or inline the check) that tests the *sanitized* value, not the raw field. Apply to all description/tips render guards:

1. **Line ~10235** — Full-width activity card description:
   Change `{activity.description && (` → `{sanitizeActivityText(activity.description) && (`

2. **Line ~10379** — Compact card description:
   Change `{activity.description && !compact && (` → `{sanitizeActivityText(activity.description) && !compact && (`

3. **Line ~10731** — Default card description:
   Change `{activity.description && !compact && (` → `{sanitizeActivityText(activity.description) && !compact && (`

4. **Lines ~10250, ~10403, ~10774** — Voyance Tips sections:
   Change `{activity.tips && !isCheckIn && (` and `{activity.tips && !activity.isVoyancePick && ...` → add `sanitizeActivityText(activity.tips) &&` guard

5. **Lines ~10227-10231** — Venue name for dining (MapPin + text):
   Add `.trim()` check: `venueNameForDining && venueNameForDining.trim() !== '' && ...`

6. **Lines ~10242-10246** — Location text:
   Already uses `locationText &&` — add `.trim().length > 0` guard

**File: `src/components/planner/TripActivityCard.tsx`** (line ~82-85)
Change `{activity.description && (` → check after trim

**File: `src/components/itinerary/LiveActivityCard.tsx`** (line ~169-172)
Change `{activity.description && (` → check after trim

**Optional optimization**: To avoid calling `sanitizeActivityText` twice (once for guard, once for render), extract to a local variable at the top of the render block:
```typescript
const sanitizedDesc = sanitizeActivityText(activity.description);
const sanitizedTips = sanitizeActivityText(activity.tips);
```
Then use `{sanitizedDesc && (` for the guard and `{sanitizedDesc}` for the content.

### Files to edit
- `src/components/itinerary/EditorialItinerary.tsx` — ~6 render guards
- `src/components/planner/TripActivityCard.tsx` — 1 render guard
- `src/components/itinerary/LiveActivityCard.tsx` — 1 render guard

### Verification
Generate a Lisbon trip. No empty gray boxes or lone pin icons should appear without text content.

