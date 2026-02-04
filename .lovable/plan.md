

# Fix: Duplicate Trip Creation Bug (Graham's 800 Trips)

## Problem Analysis

**Root Cause**: The Trip Planner form lacks double-submission protection. When `saveTrip()` is called, it creates a new trip via `.insert()` every time if `formData.tripId` is null. On Feb 3rd, 2026 at 13:22:48, something triggered 787 rapid-fire calls to `saveTrip()` within ~2 seconds, all for the same Rome trip.

**Evidence**:
- 787 "Trip to Rome" entries created in a 2-second window (timestamps: 13:22:48.002 to 13:22:49.653)
- All trips have `status: draft` and `itinerary_status: not_started`
- Creation rate: ~395 trips per second

**Missing Safeguards**:
1. No `isSubmitting` state to disable buttons during save
2. No debouncing on button clicks
3. No check for existing in-flight requests
4. `formData.tripId` not set immediately (only after insert completes)

---

## Solution

### 1. Add Submission Guard to Planner.tsx

Add `isSaving` state and prevent concurrent `saveTrip()` calls:

```text
┌─────────────────────────────────────────────────┐
│  Button Click                                   │
│       ↓                                         │
│  isSaving === true?  ──Yes──→  Return early     │
│       ↓ No                                      │
│  Set isSaving = true                            │
│       ↓                                         │
│  Call saveTrip()                                │
│       ↓                                         │
│  Set tripId immediately                         │
│       ↓                                         │
│  Set isSaving = false                           │
└─────────────────────────────────────────────────┘
```

### 2. Pass Loading State to Child Components

Update `TripContext` and other step components to receive and use `isSubmitting` prop to disable buttons.

### 3. Clean Up Graham's Duplicate Trips

Run a data cleanup migration to:
- Keep the most recent trip with an itinerary (or oldest if none have itineraries)
- Delete the 791 duplicate Rome trips

---

## Files to Change

| File | Changes |
|------|---------|
| `src/pages/planner/Planner.tsx` | Add `isSaving` state, wrap `saveTrip()` with guard, pass loading state to children |
| `src/components/planner/steps/TripContext.tsx` | Accept `isSubmitting` prop, disable action buttons when true |
| `src/components/planner/steps/HotelSelection.tsx` | Accept and use `isSubmitting` prop |
| `src/components/planner/steps/BookingOptions.tsx` | Already has `isLoading`, verify it's wired correctly |

---

## Data Cleanup

**SQL Migration to delete duplicate Rome trips:**

```sql
-- Keep only the newest Rome trip for Graham, delete the other 791
WITH keep_trip AS (
  SELECT t.id
  FROM trips t
  JOIN profiles p ON t.user_id = p.id
  WHERE p.display_name = 'Graham Lightfoot'
    AND t.destination = 'Rome'
  ORDER BY 
    CASE WHEN t.itinerary_data IS NOT NULL THEN 0 ELSE 1 END,
    t.created_at DESC
  LIMIT 1
)
DELETE FROM trips
WHERE id IN (
  SELECT t.id 
  FROM trips t
  JOIN profiles p ON t.user_id = p.id
  WHERE p.display_name = 'Graham Lightfoot'
    AND t.destination = 'Rome'
    AND t.id NOT IN (SELECT id FROM keep_trip)
);
```

**Expected result**: Delete ~791 duplicate Rome trips, keeping 1.

---

## Technical Implementation

### Planner.tsx Changes

```typescript
// Add new state
const [isSaving, setIsSaving] = useState(false);

// Wrap saveTrip with guard
const saveTrip = async (): Promise<string | null> => {
  // Prevent double-submission
  if (isSaving) {
    console.warn('[Planner] Save already in progress, ignoring duplicate call');
    return formData.tripId;
  }
  
  setIsSaving(true);
  
  try {
    // ... existing save logic ...
  } finally {
    setIsSaving(false);
  }
};

// Pass to TripContext
<TripContext
  ...
  isSubmitting={isSaving}
  onContinue={() => handleStepComplete('context')}
/>
```

### TripContext.tsx Changes

```typescript
interface TripContextProps {
  // ... existing props ...
  isSubmitting?: boolean;
}

// Disable buttons when saving
<Button
  variant="ghost"
  onClick={onContinue}
  disabled={isSubmitting}
  className="text-slate-500 hover:text-primary gap-2"
>
  {isSubmitting ? 'Saving...' : 'Skip this step'}
</Button>
```

---

## Impact

- **Prevents future duplicates**: Button clicks during save are ignored
- **Improves UX**: Users see loading feedback during save
- **Data cleanup**: Removes Graham's 791 duplicate trips
- **No breaking changes**: Existing functionality preserved

