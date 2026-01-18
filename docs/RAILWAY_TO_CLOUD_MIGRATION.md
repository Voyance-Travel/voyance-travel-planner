# Railway → Lovable Cloud Migration Plan

## Executive Summary

This document outlines the complete migration from Railway backend to Lovable Cloud (Supabase Edge Functions). The goal is to consolidate all backend functionality into Supabase while handling the timeout constraints of Edge Functions.

**Current State:**
- Railway handles: Flights (Amadeus), Hotels (Amadeus), Payments (Stripe), Weather, Transport, AI Itinerary
- Supabase Edge Functions already exist for: Itinerary generation, Stripe checkout, Billing

**Migration Challenge:**
- Supabase Edge Functions: 10-second timeout (can be extended to 60s with Pro plan)
- Railway: No timeout limit, handles 2-3 minute AI generation

---

## Services to Migrate

### 1. Flight API (Amadeus)
**Current:** `src/services/flightAPI.ts` → Railway `/api/v1/flights/*`

**Migration Strategy:** Create `supabase/functions/flights/index.ts`
- Search flights (typically <5s response)
- Get flight details
- Price locks (if applicable)

**Required Secrets:** `AMADEUS_API_KEY`, `AMADEUS_API_SECRET`

### 2. Hotel API (Amadeus)  
**Current:** `src/services/hotelAPI.ts` → Railway `/api/v1/hotels/*`

**Migration Strategy:** Create `supabase/functions/hotels/index.ts`
- Search hotels (typically <5s response)
- Get hotel details
- Room availability

**Required Secrets:** `AMADEUS_API_KEY`, `AMADEUS_API_SECRET` (shared with flights)

### 3. Weather API
**Current:** `src/services/weatherAPI.ts` → Railway `/api/weather/*`

**Migration Strategy:** Create `supabase/functions/weather/index.ts`
- Fetch weather data from external API (e.g., OpenWeatherMap)
- Cache in database for performance

**Required Secrets:** `OPENWEATHER_API_KEY` or similar

### 4. Transport API
**Current:** `src/services/transportAPI.ts` → Railway `/api/transport/*`

**Migration Strategy:** Create `supabase/functions/transport/index.ts`
- May be static/database-driven
- No external API needed if data is seeded

### 5. Stripe API (Partial - already migrated)
**Current:** `src/services/stripeAPI.ts` → Railway `/stripe/*`
**Existing:** `supabase/functions/create-checkout/`, `create-booking-checkout/`, etc.

**Migration Strategy:** Route remaining endpoints to existing edge functions
- Customer portal ✅ (exists)
- Checkout ✅ (exists)
- Refunds → Create new edge function if needed

### 6. AI Itinerary Generation (Critical)
**Current:** `supabase/functions/generate-itinerary/` (already migrated!)

**Status:** ✅ ALREADY IN CLOUD
- Uses streaming to work within timeout
- Enrichment via `enrich-itinerary/`

---

## Implementation Order

### Phase 1: Quick Wins (No API Keys Needed)
1. ✅ Stripe - Already in Cloud
2. ✅ Itinerary Generation - Already in Cloud
3. Transport API - If database-driven

### Phase 2: External APIs (Need Secrets)
1. Weather API - Simple external call
2. Flights API - Amadeus integration
3. Hotels API - Amadeus integration

### Phase 3: Service Consolidation
1. Update all frontend services to call Edge Functions
2. Remove Railway URL references
3. Update api.config.ts

---

## Edge Function Templates

### Flight Search Edge Function
```typescript
// supabase/functions/flights/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AMADEUS_API_KEY = Deno.env.get('AMADEUS_API_KEY');
    const AMADEUS_API_SECRET = Deno.env.get('AMADEUS_API_SECRET');
    
    // Get Amadeus access token
    const tokenRes = await fetch('https://api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`
    });
    const { access_token } = await tokenRes.json();
    
    const { origin, destination, departureDate, returnDate, passengers } = await req.json();
    
    // Search flights
    const flightsRes = await fetch(
      `https://api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=${passengers}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    
    const data = await flightsRes.json();
    
    return new Response(JSON.stringify({ flights: data.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

---

## Frontend Service Updates

### Before (Railway)
```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

export async function searchFlights(params) {
  const response = await fetch(`${BACKEND_URL}/api/v1/flights/search`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return response.json();
}
```

### After (Cloud)
```typescript
import { supabase } from '@/integrations/supabase/client';

export async function searchFlights(params) {
  const { data, error } = await supabase.functions.invoke('flights', {
    body: { action: 'search', ...params }
  });
  if (error) throw error;
  return data.flights;
}
```

---

## Secrets Configured

| Secret Name | Purpose | Status |
|-------------|---------|--------|
| AMADEUS_API_KEY | Flight/Hotel search | ✅ Configured |
| AMADEUS_API_SECRET | Flight/Hotel search | ✅ Configured |
| GOOGLE_MAPS_API_KEY | Maps & Geocoding | ✅ Configured |
| VIATOR_API_KEY | Activities/Tours | ✅ Configured |
| STRIPE_SECRET_KEY | Payments | ✅ Already configured |
| LOVABLE_API_KEY | AI features | ✅ Auto-configured |

---

## Migration Checklist

### Edge Functions to Create
- [ ] `flights/` - Amadeus flight search
- [ ] `hotels/` - Amadeus hotel search  
- [ ] `weather/` - Weather API proxy
- [ ] `transport/` - Transport options (may be DB-only)

### Frontend Files to Update
- [ ] `src/services/flightAPI.ts` - Switch to supabase.functions.invoke
- [ ] `src/services/hotelAPI.ts` - Switch to supabase.functions.invoke
- [ ] `src/services/weatherAPI.ts` - Switch to supabase.functions.invoke
- [ ] `src/services/transportAPI.ts` - Switch to supabase.functions.invoke
- [ ] `src/services/stripeAPI.ts` - Update to use existing edge functions
- [ ] `src/config/api.config.ts` - Remove Railway references

### Cleanup After Migration
- [ ] Remove VITE_BACKEND_URL from .env
- [ ] Remove Railway URL fallbacks from all services
- [ ] Update documentation
- [ ] Cancel Railway subscription

---

## Risk Mitigation

### Timeout Handling
- Amadeus API typically responds in 2-5 seconds (within limit)
- Add timeout handling in frontend
- Use mock data fallback if needed

### Caching Strategy
- Cache flight/hotel searches in database (4-hour TTL)
- Cache weather data (24-hour TTL)
- Reduces API calls and improves response times

### Gradual Rollout
1. Deploy new edge functions
2. Add feature flag to toggle between Railway/Cloud
3. Test thoroughly in staging
4. Gradually shift traffic to Cloud
5. Deprecate Railway

---

## Success Criteria

1. **Functionality**: All features work with Cloud backend
2. **Performance**: Response times ≤ Railway performance
3. **Reliability**: No increase in error rates
4. **Cost**: Railway costs eliminated
5. **Maintenance**: Single backend to maintain

---

*Document created: January 18, 2026*
*Status: Planning*
