# Itinerary Data Display Fix

## Problem Summary

The frontend is showing generic placeholder activities instead of real itinerary data from the backend because:

1. **Template Generation Issue**: The `generateTemplateItinerary` function creates activities with incorrect property names:
   - Uses `name` instead of `title`
   - Uses `category` instead of `type`

2. **Data Structure Mismatch**: The FullItinerary component expects:
   - `activity.title` (not `activity.name`)
   - `activity.type` (not `activity.category`)

## The Fix

### 1. Update Template Generation

In `/src/pages/itinerary/index.tsx`, update the `generateTemplateItinerary` function to use correct property names:

```typescript
// Change from:
activities: [
  {
    name: 'Activity Name',     // ❌ Wrong
    category: 'dining',        // ❌ Wrong
    // ...
  }
]

// To:
activities: [
  {
    id: `activity-${dayNumber}-${activityIndex}`,
    title: 'Activity Name',    // ✅ Correct
    type: 'dining',           // ✅ Correct
    description: 'Activity description',
    time: '9:00 AM',
    startTime: '09:00',
    endTime: '11:00',
    duration: '2 hours',
    cost: 50,
    estimatedCost: { amount: 50, currency: 'USD' },
    location: {
      name: 'Venue Name',
      address: 'Venue Address'
    },
    isLocked: false,
    bookingRequired: false,
    tags: []
  }
]
```

### 2. Ensure Backend Data Transformation

If the backend returns data with different property names, add a transformation function:

```typescript
function transformBackendActivity(activity: any): ItineraryActivity {
  return {
    id: activity.id,
    title: activity.title || activity.name,  // Handle both
    type: activity.type || activity.category, // Handle both
    description: activity.description,
    time: formatTime(activity.startTime),
    startTime: activity.startTime,
    endTime: activity.endTime,
    duration: activity.duration,
    cost: activity.price?.amount || activity.cost || 0,
    estimatedCost: activity.price || activity.estimatedCost,
    location: activity.location,
    isLocked: activity.locked || activity.isLocked || false,
    bookingRequired: activity.bookingRequired || false,
    bookingUrl: activity.bookingUrl,
    rating: activity.rating,
    tags: activity.tags || [],
  };
}
```

### 3. Apply Transformation When Setting Data

When receiving itinerary data from the backend:

```typescript
const transformedItinerary = {
  ...freshItinerary,
  days: freshItinerary.days.map(day => ({
    ...day,
    activities: day.activities.map(transformBackendActivity)
  }))
};
setItineraryData(transformedItinerary);
```

## Implementation Steps

1. **Update Template Generation**
   - Find all instances of `name:` in activity objects and change to `title:`
   - Find all instances of `category:` in activity objects and change to `type:`

2. **Add Data Transformation**
   - Create the `transformBackendActivity` function
   - Apply it when setting itinerary data from backend

3. **Add Logging**
   - Log the backend response to see actual structure
   - Log the transformed data to verify correctness

4. **Test**
   - Test with template data (should work immediately after fix)
   - Test with real backend data
   - Verify activities display with correct titles and types

## Verification

To verify the fix is working:

1. Check console logs:
   ```typescript
   console.log('[Backend Activity]', activity);
   console.log('[Transformed Activity]', transformedActivity);
   ```

2. In FullItinerary component, activities should have:
   - `activity.title` defined (not undefined)
   - `activity.type` defined (not undefined)
   - All other fields properly mapped

## Related Files

- `/src/pages/itinerary/index.tsx` - Contains template generation
- `/src/components/itinerary/FullItinerary.tsx` - Expects correct property names
- `/src/types/itinerary.ts` - Type definitions
- `/docs/api/ITINERARY_CONTRACT_v1.0.md` - Backend API contract