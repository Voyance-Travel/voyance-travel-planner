# SOT: Itinerary Data Display Mapping

**Source of Truth Document**  
**Feature:** Itinerary Data Display  
**Version:** 1.0.0  
**Last Updated:** 2025-01-30  
**Status:** ACTIVE - Critical Documentation  

## Overview

This document defines the correct mapping between backend itinerary data and frontend display components. It addresses the current issue where real itinerary data from the backend is not being displayed properly, and generic placeholders are shown instead.

## The Problem

The frontend is showing generic placeholder activities instead of real itinerary data because of mismatched property names between:
1. Backend API response
2. Frontend template generation
3. FullItinerary component expectations

## Backend Data Structure (From API)

According to the API contract (`docs/api/ITINERARY_CONTRACT_v1.0.md`), the backend returns:

```typescript
interface TripActivity {
  id: string;
  itineraryId: string;
  title: string;                    // ✅ Backend uses 'title'
  type: ActivityType;                // ✅ Backend uses 'type'
  description: string;
  startTime: string;                 // ISO datetime
  endTime: string;                   // ISO datetime
  duration: number;                  // minutes
  location: {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    city?: string;
    country?: string;
  };
  price?: {
    amount: number;
    currency: string;
  };
  imageUrl?: string;
  notes?: string;
  locked: boolean;
  bookingStatus?: 'pending' | 'confirmed' | 'cancelled';
  bookingUrl?: string;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  addedByUser?: boolean;
  blockOrder?: number;
}
```

## Frontend Type System (From types/itinerary.ts)

The frontend types define activities as:

```typescript
interface Activity {
  id?: string;
  name: string;                      // ❌ Frontend expects 'name'
  description: string;
  startTime: string;                 // HH:MM format (24-hour)
  endTime: string;                   // HH:MM format (24-hour)
  duration: string;                  // Human-readable
  category: ActivityCategory;        // ❌ Frontend expects 'category'
  location: string;
  coordinates?: { lat: number; lng: number; };
  estimatedCost: Cost;
  bookingRequired: boolean;
  bookingUrl?: string;
  tips?: string;
  tipsList?: string[];
  locked?: boolean;
  tags?: string[];
  images?: string[];
  rating?: number;
  reviewCount?: number;
}
```

## FullItinerary Component Expectations

The FullItinerary component (`src/components/itinerary/FullItinerary.tsx`) expects:

```typescript
interface ItineraryActivity {
  id: string;
  title: string;                     // ✅ Component expects 'title' (matches backend)
  venueName?: string;
  description: string;
  time: string;                      // Display format
  startTime?: string;
  endTime?: string;
  duration: string;
  type: string;                      // ✅ Component expects 'type' (matches backend)
  cost: number;
  estimatedCost?: { amount: number; currency: string };
  location: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
  };
  // ... other fields
}
```

## The Mapping Solution

### 1. Transform Backend Response to Frontend Format

When receiving data from the backend, transform it to match frontend expectations:

```typescript
function transformBackendActivity(backendActivity: TripActivity): ItineraryActivity {
  return {
    id: backendActivity.id,
    title: backendActivity.title,              // ✅ Direct mapping
    venueName: backendActivity.location.name,
    description: backendActivity.description,
    time: formatTime(backendActivity.startTime), // Convert ISO to display format
    startTime: backendActivity.startTime,
    endTime: backendActivity.endTime,
    duration: `${backendActivity.duration} minutes`,
    type: backendActivity.type,                // ✅ Direct mapping
    cost: backendActivity.price?.amount || 0,
    estimatedCost: backendActivity.price,
    location: backendActivity.location,
    isLocked: backendActivity.locked,
    bookingRequired: !!backendActivity.bookingUrl,
    bookingUrl: backendActivity.bookingUrl,
    rating: backendActivity.rating,
    tags: backendActivity.tags || [],
    // ... map other fields
  };
}
```

### 2. Fix Template Generation

Update the template generation to use correct property names:

```typescript
// In generateTemplateItinerary function
activities: [
  {
    id: `temp-${i}-${j}`,
    title: 'Activity Title',           // ✅ Use 'title' not 'name'
    description: 'Activity description',
    time: '9:00 AM',
    startTime: '09:00',
    endTime: '11:00',
    duration: '2 hours',
    type: 'attraction',                // ✅ Use 'type' not 'category'
    cost: 50,
    estimatedCost: { amount: 50, currency: 'USD' },
    location: {
      name: 'Venue Name',
      address: 'Venue Address',
    },
    isLocked: false,
    bookingRequired: false,
    tags: [],
  }
]
```

### 3. Proper Data Flow

```
Backend API Response
    ↓
Transform to Frontend Format (if needed)
    ↓
Store in State (itineraryData)
    ↓
Pass to FullItinerary Component
    ↓
Display Real Data
```

## Implementation Checklist

- [ ] Update type definitions to align backend and frontend
- [ ] Add transformation function for backend responses
- [ ] Fix template generation to use correct property names
- [ ] Ensure FullItinerary receives properly formatted data
- [ ] Add logging to verify data structure at each step
- [ ] Test with real backend data

## Debugging Steps

1. **Check Backend Response**:
   ```typescript
   console.log('[Backend Response]', response.data);
   ```

2. **Check Transformed Data**:
   ```typescript
   console.log('[Transformed Data]', transformedActivities);
   ```

3. **Check Props Passed to FullItinerary**:
   ```typescript
   console.log('[FullItinerary Props]', { days: itineraryData.days });
   ```

4. **Inside FullItinerary, Check Received Data**:
   ```typescript
   console.log('[FullItinerary Received]', days);
   ```

## Common Issues

### Issue 1: Activities Show as Undefined
- **Cause**: Property name mismatch (e.g., `activity.name` vs `activity.title`)
- **Solution**: Use correct property names or transform data

### Issue 2: Generic Placeholders Shown
- **Cause**: Template data being used instead of real data
- **Solution**: Ensure backend data is properly fetched and passed

### Issue 3: Empty Activities Array
- **Cause**: Backend returns different structure than expected
- **Solution**: Check API response structure and update transformation

## Related Documentation

- [Itinerary Contract v1.0](../api/ITINERARY_CONTRACT_v1.0.md)
- [API to UI Mapping](./SOT_API_TO_UI_MAPPING.md)
- [Itinerary SOT Index](./ITINERARY_SOT_INDEX.md)
- [Progressive Itinerary Generation](./SOT_PROGRESSIVE_ITINERARY_GENERATION.md)

---

**Document Status:** ACTIVE  
**Maintained By:** Frontend Team  
**Review Schedule:** When data display issues occur  