# Backend Integration Guide for Voyance Frontend

> ## ⚠️ UPDATED: January 2026
> 
> This guide has been updated to reflect the **Lovable Cloud (Supabase)** architecture.
> The old Railway backend has been decommissioned.

**Date**: 2026-01-19  
**Contract Version**: v2 (Lovable Cloud)  
**Backend**: Supabase Edge Functions + Direct Database Queries

---

## Quick Reference

### Authentication
```typescript
// Supabase handles authentication automatically
import { supabase } from '@/integrations/supabase/client';

// All authenticated requests use the session automatically
const { data } = await supabase.from('trips').select('*');
```

### Core Services

| Feature | Implementation | Location |
|---------|---------------|----------|
| Trips | Direct Supabase queries | `src/services/supabase/trips.ts` |
| Profiles | Direct Supabase queries | `src/services/supabase/profiles.ts` |
| Friends | Direct Supabase queries | `src/services/supabase/friends.ts` |
| Flights | Edge Function | `supabase/functions/flights/` |
| Hotels | Edge Function | `supabase/functions/hotels/` |
| Itinerary | Edge Function | `supabase/functions/generate-itinerary/` |
| Payments | Edge Function | `supabase/functions/create-checkout/` |

---

## 1. User Preferences (Database)

```typescript
// Read preferences
const { data } = await supabase
  .from('user_preferences')
  .select('*')
  .eq('user_id', userId)
  .single();

// Update preferences
await supabase
  .from('user_preferences')
  .upsert({ user_id: userId, budget_tier: 'moderate', travel_pace: 'balanced' });
```

---

## 2. Trip Management (Database)

### Create Trip
```typescript
const { data, error } = await supabase
  .from('trips')
  .insert({
    user_id: userId,
    name: 'London Adventure',
    destination: 'London',
    destination_country: 'United Kingdom',
    start_date: '2026-06-01',
    end_date: '2026-06-15',
    travelers: 2,
    status: 'draft'
  })
  .select()
  .single();
```

### Get User Trips
```typescript
const { data } = await supabase
  .from('trips')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

---

## 3. Edge Functions

### Flight Search
```typescript
const { data, error } = await supabase.functions.invoke('flights', {
  body: {
    action: 'search',
    origin: 'JFK',
    destination: 'LHR',
    departureDate: '2026-06-01',
    passengers: 2
  }
});
```

### Hotel Search
```typescript
const { data, error } = await supabase.functions.invoke('hotels', {
  body: {
    action: 'search',
    cityCode: 'LON',
    checkIn: '2026-06-01',
    checkOut: '2026-06-15',
    guests: 2
  }
});
```

### Itinerary Generation
```typescript
const { data, error } = await supabase.functions.invoke('generate-itinerary', {
  body: {
    tripId: 'uuid',
    destination: 'London',
    startDate: '2026-06-01',
    endDate: '2026-06-15',
    preferences: userPreferences
  }
});
```

---

## 4. Stripe Payments

### Create Checkout Session
```typescript
const { data, error } = await supabase.functions.invoke('create-booking-checkout', {
  body: {
    tripId: 'uuid',
    items: [
      { type: 'flight', id: 'flight-id', amount: 50000 },
      { type: 'hotel', id: 'hotel-id', amount: 150000 }
    ],
    successUrl: `${window.location.origin}/trip/confirmation`,
    cancelUrl: `${window.location.origin}/trip/checkout`
  }
});

// Redirect to Stripe
window.location.href = data.url;
```

---

## 5. Frontend Service Files

### Database Services (Direct Queries)
- `src/services/supabase/trips.ts` - Trip CRUD
- `src/services/supabase/profiles.ts` - User profiles
- `src/services/supabase/friends.ts` - Friend system
- `src/services/supabase/destinations.ts` - Destination lookup
- `src/services/supabase/airports.ts` - Airport search
- `src/services/supabase/guides.ts` - Travel guides

### API Services (Edge Functions)
- `src/services/flightAPI.ts` - Flight search & holds
- `src/services/hotelAPI.ts` - Hotel search & holds
- `src/services/tripPaymentsAPI.ts` - Payment verification
- `src/services/tripNotificationsAPI.ts` - Notifications

---

## 6. Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Unauthorized | Redirect to login |
| 404 | Not found | Show not found message |
| 400 | Validation error | Show field errors |
| 500 | Server error | Show retry button |

---

## 7. Important Notes

1. **No External Backend**: All backend is Lovable Cloud (Supabase)
2. **Auth Automatic**: Supabase client handles authentication
3. **RLS Enabled**: All tables have Row Level Security
4. **Edge Function Timeout**: 60 seconds max
5. **Real-time**: Use Supabase Realtime for live updates

---

## 8. Legacy Services (Archived)

The following services have been archived to `src/services/_legacy/`:
- `mealPlanningAPI.ts`
- `destinationsCanonicalAPI.ts`
- `bdqAPI.ts`
- See `src/services/_legacy/README.md` for full list

Do not use legacy services - they reference the decommissioned Railway backend.
