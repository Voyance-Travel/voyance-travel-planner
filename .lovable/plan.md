

## Feature: Clone/Re-run a Past Trip

### Problem
Testing itineraries requires going through the full 3-step setup (destination, flight/hotel, fine-tune) every time. This is tedious when repeatedly testing the same configuration.

### Solution
Add a **"Re-run"** button on each trip card in the Trip Dashboard that clones the trip's setup data into a new trip and immediately navigates to it with `?generate=true` — skipping the entire Start flow.

This will be available to **admin users only** (checked via `user_roles` table), keeping the UI clean for regular users.

### Changes

| # | File | What |
|---|------|------|
| 1 | `src/pages/TripDashboard.tsx` | Add admin role check (same pattern as `Settings.tsx`). Add a "Re-run" icon button on each trip card, visible only to admins. On click, clone the trip row and navigate to the new trip. |

### How the clone works

When the admin clicks "Re-run" on a trip card:

1. Fetch the full trip row from `trips` table (destination, dates, travelers, trip_type, budget, flight_selection, hotel_selection, metadata, etc.)
2. Insert a new `trips` row with the same data but:
   - New auto-generated `id`
   - `status: 'draft'`
   - `itinerary_data: null` (fresh generation)
   - `created_at/updated_at: now()`
3. Copy matching `trip_cities` rows (if multi-city)
4. Navigate to `/trip/{newTripId}?generate=true`

### UI placement

On the trip card actions row (line ~539-611), add a small icon button with `RotateCcw` or `Copy` icon, only rendered when `isAdmin` is true. Tooltip: "Re-run (clone & regenerate)".

### Admin check pattern (from Settings.tsx)

```typescript
const [isAdmin, setIsAdmin] = useState(false);
// In useEffect:
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .eq('role', 'admin');
setIsAdmin((roles?.length ?? 0) > 0);
```

### No database changes needed
Uses existing tables and RLS policies. The insert into `trips` is done by the authenticated user (trip owner), which existing RLS allows.

