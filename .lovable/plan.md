

## Fix: Route Details — Wrong Origin, Too Many Steps, Missing Walk Distance

### Bug Analysis

**Bug 1 — Wrong origin**: The `transitOrigin` prop chain looks correct (`prevVisibleActivity?.location?.name`), but in `fetchRouteDetails` (line 258-259), the **destination** is wrong. It uses `activity.location?.name || activity.location?.address` — but transport activities typically don't have a `location` object with meaningful data. The destination should be `transitDestination + ', ' + city` (parsed from the title + city context). The origin looks correct via `transitOrigin`, but falls back to `city` which could be wrong if `transitOrigin` is undefined.

**Bug 2 — Too many steps**: All steps render inline with no cap.

**Bug 3 — Walk "Varies"**: Walk option is hardcoded client-side with no real data.

### Changes

#### File: `src/components/itinerary/TransitModePicker.tsx`

**1. Fix origin/destination in `fetchRouteDetails` (lines 258-259)**

Replace:
```typescript
const origin = transitOrigin || activity.location?.address || city;
const destination = activity.location?.name || activity.location?.address || transitDestination;
```
With:
```typescript
const origin = transitOrigin || city;
const destination = transitDestination + ', ' + city;
```

This ensures:
- Origin = previous activity's venue/address (via `transitOrigin` prop), falling back to city
- Destination = parsed destination from transport title (e.g., "Rockefeller Center Area") + city for geocoding context

**2. Same fix in `fetchOptions` (lines 152-153)** — apply the same destination logic for consistency.

**3. Add step cap with "Show more" toggle (around lines 492-521)**

Add state: `const [showAllStepsFor, setShowAllStepsFor] = useState<string | null>(null);`

Cap inline display at 5 steps. Show a "+ X more steps" button when there are more. Clicking it reveals all steps.

**4. Fetch real walking data after adding Walk option (after line 191)**

After `setOptions(filtered)`, fire-and-forget a call to `route-details` with `mode: 'walking'` to get real duration/distance. On success, update the Walk option in state with `totalDuration` and `totalDistance`.

### No other files change

The `EditorialItinerary.tsx` origin computation (`prevVisibleActivity?.location?.name || ...`) is already correct. The `route-details` edge function is working. Only `TransitModePicker.tsx` needs fixes.

