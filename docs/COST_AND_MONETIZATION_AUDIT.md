# Voyance Platform: Complete Cost & Monetization Audit

> **Last Updated:** January 19, 2026  
> **Prepared For:** Pre-Launch Financial Planning

---

## PART 1: YOUR COST CENTERS (Where You Spend Money)

### 1.1 Platform & Hosting Costs

| Service | Pricing Model | Estimated Cost | When Charged |
|---------|--------------|----------------|--------------|
| **Lovable Cloud Hosting** | Usage-based | Varies by traffic | Monthly |
| **Lovable AI Credits** | Usage-based | Per AI call | Per generation |
| **Supabase (via Cloud)** | Included in Cloud | Database, Auth, Storage | Included |
| **Custom Domain** | Paid plan required | $0 (plan feature) | N/A |

---

### 1.2 External API Costs (Variable - Per Call)

#### ✈️ **AMADEUS APIs** (Travel Data)
| API Endpoint | Cost Trigger | Pricing |
|--------------|--------------|---------|
| **Flight Search** (`/v2/shopping/flight-offers`) | Every flight search | Free tier: 2,000 calls/mo, then ~$0.01-0.05/call |
| **Hotel Search** (`/v2/shopping/hotel-offers`) | Every hotel search | Free tier: 2,000 calls/mo, then ~$0.01-0.05/call |
| **Airport Lookup** (IATA resolution) | Destination resolution | Minimal (cached) |

**Location in Code:** `supabase/functions/flights/index.ts`, `supabase/functions/hotels/index.ts`

**Secrets Used:**
- `AMADEUS_API_KEY`
- `AMADEUS_API_SECRET`

**Current Mode:** Sandbox (test mode per memory `milestones/qa-readiness-state`)

---

#### 🤖 **AI/LLM COSTS** (Lovable AI Gateway)
| Feature | Model Used | When Called | Estimated Cost |
|---------|------------|-------------|----------------|
| **Itinerary Generation** | `openai/gpt-5` | Full trip generation | ~$0.10-0.50/generation |
| **Day Regeneration** | `openai/gpt-5` | Single day refresh | ~$0.02-0.10/call |
| **Preference Analysis** | `openai/gpt-5-mini` | After quiz completion | ~$0.01-0.03/call |
| **Travel DNA Calculation** | `openai/gpt-5-mini` | Quiz submission | ~$0.01-0.03/call |
| **Itinerary Enrichment** | `openai/gpt-5-mini` | Post-generation | ~$0.02-0.05/call |
| **Mystery Trip Suggestions** | `openai/gpt-5-mini` | Surprise trip feature | ~$0.01-0.02/call |

**Location in Code:** 
- `supabase/functions/generate-itinerary/index.ts`
- `supabase/functions/analyze-preferences/index.ts`
- `supabase/functions/calculate-travel-dna/index.ts`
- `supabase/functions/enrich-itinerary/index.ts`
- `supabase/functions/suggest-mystery-trips/index.ts`

**Secrets Used:**
- `LOVABLE_API_KEY` (managed by Lovable Cloud)

---

#### 📍 **GOOGLE APIs** (Maps, Places, Geocoding)
| API | Cost Trigger | Pricing |
|-----|--------------|---------|
| **Places API (New)** | Venue verification, photo fetching | $17/1,000 Place Details calls |
| **Geocoding API** | Address → coordinates | $5/1,000 calls |
| **Maps Static API** | Map image generation | $2/1,000 calls |

**Location in Code:** `supabase/functions/destination-images/index.ts`, `supabase/functions/generate-itinerary/index.ts`

**Secrets Used:**
- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_GEOCODE_API_KEY`
- `GOOGLE_MAPS_STATIC_API_KEY`

---

#### 🌤️ **WEATHER APIs**
| API | Cost Trigger | Pricing |
|-----|--------------|---------|
| **WeatherStack** | Weather fetch per destination | Free: 250 calls/mo, then $9.99/mo for 50,000 |

**Location in Code:** `supabase/functions/weather/index.ts`

**Secrets Used:**
- `WEATHERSTACK_API_KEY`

---

#### 📷 **IMAGE/CONTENT APIs**
| API | Cost Trigger | Pricing |
|-----|--------------|---------|
| **Pexels** | Stock photo fetch | **FREE** |
| **TripAdvisor Content API** | Venue photos, reviews | Free tier exists, then paid |
| **Wikimedia Commons** | Landmark photos | **FREE** |
| **Foursquare Places** | Venue data | Free: 99,500 regular calls/day |

**Location in Code:** `supabase/functions/destination-images/index.ts`

**Secrets Used:**
- `PEXELS_API_KEY`
- `TRIPADVISOR_API_KEY`
- `FOURSQUARE_API_KEY`, `FOURSQUARE_CLIENT_ID`, `FOURSQUARE_API_SECRET`
- `OPENTRIPMAP_API_KEY`
- `VIATOR_API_KEY`

---

#### 📧 **EMAIL/COMMUNICATIONS**
| Service | Cost Trigger | Pricing |
|---------|--------------|---------|
| **SendGrid** | Contact forms, booking confirmations, trip reminders | Free: 100 emails/day, then $14.95/mo for 40,000 |

**Location in Code:** 
- `supabase/functions/send-contact-email/index.ts`
- `supabase/functions/send-price-alerts/index.ts`
- `supabase/functions/send-trip-reminders/index.ts`
- `supabase/functions/trip-notifications/index.ts`

**Secrets Used:**
- `SENDGRID_API_KEY`

---

#### 💳 **STRIPE** (Payment Processing)
| Service | Cost Trigger | Pricing |
|---------|--------------|---------|
| **Stripe Checkout** | Every successful payment | 2.9% + $0.30 per transaction |
| **Stripe Customer Portal** | Subscription management | No additional cost |
| **Stripe Webhooks** | Payment events | No additional cost |

**Location in Code:**
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/create-booking-checkout/index.ts`
- `supabase/functions/verify-payment/index.ts`
- `supabase/functions/customer-portal/index.ts`
- `supabase/functions/check-subscription/index.ts`

**Secrets Used:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

### 1.3 Cost Summary Matrix

| Category | Fixed Monthly | Variable Cost | Primary Driver |
|----------|--------------|---------------|----------------|
| Lovable Cloud | Base tier | Scales with users | Page views, function calls |
| Amadeus | $0 (sandbox) | Per search | Flight/hotel searches |
| AI Generation | $0 (Lovable AI) | Per generation | Itinerary builds |
| Google APIs | $0 (free tier) | Per venue lookup | Venue verification |
| Weather | $0 (free tier) | Per destination | Weather forecasts |
| Images | $0 (mostly free) | Minimal | Photo enrichment |
| Email | $0 (free tier) | Per email | Notifications |
| Stripe | 0 | 2.9% + $0.30 | Successful payments |

---

## PART 2: YOUR REVENUE SOURCES (Where You Earn Money)

### 2.1 Current Stripe Products & Prices

| Product | Price ID | Amount | Type |
|---------|----------|--------|------|
| **Voyage (Monthly)** | `price_1RpYVWFYxIg9jcJU4t3JVCy0` | $15.99/month | Subscription |
| **Wanderlust (Premium)** | `price_1RpYWpFYxIg9jcJUPrSLmFsu` | $119.99/month | Subscription |
| **Single Trip Unlock** | `price_1RpYXMFYxIg9jcJUxDiyEFp5` | $29.99 | One-time |

---

### 2.2 Plan Entitlements (Feature Gates)

Based on `supabase/functions/get-entitlements/index.ts` and database structure:

| Feature Flag | Free | Voyage ($15.99) | Wanderlust ($119.99) |
|--------------|------|-----------------|----------------------|
| `itinerary_generation` | 2/month | Unlimited | Unlimited |
| `saved_trips` | 3 | Unlimited | Unlimited |
| `flight_search` | ❌ | ✅ | ✅ |
| `hotel_search` | ❌ | ✅ | ✅ |
| `price_lock` | ❌ | 48 hours | 48 hours |
| `weather_forecast` | Basic | Full | Full |
| `export_itinerary` | ❌ | ✅ | ✅ |
| `venue_enrichment` | Basic | Standard | Premium (VoyagerMaps) |
| `live_refresh` | ❌ | ❌ | ✅ |
| `priority_support` | ❌ | Email | Dedicated |
| `group_budgeting` | ❌ | ✅ | ✅ |

---

## PART 3: MONETIZABLE FEATURES (Detailed Breakdown)

### 3.1 Core Trip Planning Features

#### 🎯 **Travel DNA Quiz & Profile**
- **What it does:** 10-step quiz that generates a unique "Travel DNA" archetype
- **Cost to you:** ~$0.01-0.03/quiz (AI analysis)
- **Monetization:** Free as acquisition tool → upsell to paid for full benefits
- **Files:** 
  - `src/pages/Quiz.tsx`
  - `supabase/functions/calculate-travel-dna/index.ts`
  - `supabase/functions/analyze-preferences/index.ts`

#### ✨ **AI Itinerary Generation**
- **What it does:** Full day-by-day itinerary with activities, restaurants, timing, costs
- **Cost to you:** ~$0.10-0.50/generation (AI + venue verification)
- **Monetization:** 
  - Free: 2/month
  - Voyage: Unlimited
  - Single Trip: Pay-per-trip
- **Rate Limits:** 3 full generations per 5 min, 10 day regenerations per min
- **Files:** 
  - `supabase/functions/generate-itinerary/index.ts` (2,133 lines!)
  - `src/hooks/useLovableItinerary.ts`
  - `src/components/planner/ItineraryGeneratorStreaming.tsx`

#### 🔄 **Day Regeneration**
- **What it does:** Refresh individual days without regenerating entire trip
- **Cost to you:** ~$0.02-0.10/regeneration
- **Monetization:** Part of paid plans
- **Files:** 
  - `src/components/planner/DayRegenerateButton.tsx`
  - `supabase/functions/generate-itinerary/index.ts`

#### 🔒 **Activity Locking**
- **What it does:** Lock specific activities so regeneration preserves them
- **Cost to you:** None (database only)
- **Monetization:** Part of paid plans
- **Files:** 
  - `src/components/planner/MyLockedActivities.tsx`
  - `src/services/tripActivitiesAPI.ts`

---

### 3.2 Search & Booking Features

#### ✈️ **Flight Search**
- **What it does:** Real-time flight search via Amadeus
- **Cost to you:** ~$0.01-0.05/search (Amadeus API)
- **Monetization:** Paid plans only
- **Files:**
  - `supabase/functions/flights/index.ts`
  - `src/pages/planner/PlannerFlight.tsx`
  - `src/pages/planner/PlannerFlightEnhanced.tsx`

#### 🏨 **Hotel Search**
- **What it does:** Real-time hotel search via Amadeus
- **Cost to you:** ~$0.01-0.05/search (Amadeus API)
- **Monetization:** Paid plans only
- **Files:**
  - `supabase/functions/hotels/index.ts`
  - `src/pages/planner/PlannerHotel.tsx`
  - `src/pages/planner/PlannerHotelEnhanced.tsx`

#### ⏱️ **Price Lock (48-Hour Guarantee)**
- **What it does:** Lock in flight/hotel prices for 48 hours
- **Cost to you:** None (timer only, no actual booking hold)
- **Monetization:** Premium feature
- **Files:**
  - `src/components/PriceLockTimer.tsx`
  - `src/hooks/usePaymentVerification.ts`

#### 📊 **Flight/Hotel Filters & Ranking**
- **What it does:** Sort/filter by price, duration, stops, airlines, amenities
- **Cost to you:** None (frontend logic)
- **Monetization:** Part of search features
- **Files:**
  - `src/components/planner/flight/FlightFilters.tsx`
  - `src/components/planner/hotel/HotelFilters.tsx`
  - `src/services/flightRankingAPI.ts`
  - `src/services/hotelRankingAPI.ts`

---

### 3.3 Group & Social Features

#### 👥 **Group Trip Planning** (NEW!)
- **What it does:** Invite friends, assign roles (primary/attendee)
- **Cost to you:** None (database + email)
- **Monetization:** Premium feature
- **Tables:**
  - `trip_members` (roles, invitations)
  - `trip_collaborators` (permissions)
- **Files:**
  - `src/components/planner/budget/TripMembersPanel.tsx`
  - `src/services/tripBudgetAPI.ts`

#### 💰 **Group Budget Tracking** (NEW!)
- **What it does:** Track expenses, split costs, settlement tracking
- **Cost to you:** None (database only)
- **Monetization:** Premium feature
- **Tables:**
  - `trip_expenses`
  - `expense_splits`
  - `trip_settlements`
- **Files:**
  - `src/components/planner/budget/TripBudgetTracker.tsx`
  - `src/services/tripBudgetAPI.ts`

#### 🎲 **Expense Split Types**
- **Equal Split:** Divide evenly
- **Manual Assignment:** Assign specific amounts to members
- **Percentage Split:** Custom percentages
- **Hybrid:** Mix of above

#### 👫 **Friends System**
- **What it does:** Friend requests, activity feed, profile viewing
- **Cost to you:** None (database only)
- **Monetization:** Social engagement → retention
- **Files:**
  - `src/components/profile/FriendsSection.tsx`
  - `src/services/friendsAPI.ts`

---

### 3.4 Monitoring & Intelligence Features

#### 🌤️ **Weather Forecasting**
- **What it does:** 7-day weather forecast for destination
- **Cost to you:** ~$0.001/call (WeatherStack)
- **Monetization:** Basic (free) vs Full (paid)
- **Files:**
  - `supabase/functions/weather/index.ts`
  - `src/components/itinerary/WeatherForecast.tsx`
  - `src/services/weatherAPI.ts`

#### 💸 **Price Monitoring & Alerts**
- **What it does:** Track price changes, send alerts
- **Cost to you:** Email costs + re-search costs
- **Monetization:** Premium feature
- **Files:**
  - `supabase/functions/send-price-alerts/index.ts`
  - `src/services/priceDriftAPI.ts`
  - `src/services/priceMonitorAPI.ts`

#### 🔔 **Trip Notifications**
- **What it does:** Reminders, updates, booking confirmations
- **Cost to you:** ~$0.001/email (SendGrid)
- **Monetization:** Part of platform
- **Files:**
  - `supabase/functions/trip-notifications/index.ts`
  - `supabase/functions/send-trip-reminders/index.ts`
  - `src/services/tripNotificationsAPI.ts`

---

### 3.5 Content & Discovery Features

#### 🗺️ **Destination Discovery**
- **What it does:** Browse, filter, explore destinations
- **Cost to you:** None (database queries)
- **Monetization:** Free feature (acquisition)
- **Files:**
  - `src/pages/Destinations.tsx`
  - `src/pages/Explore.tsx`
  - `src/services/destinationsUnifiedAPI.ts`

#### 📖 **Travel Guides**
- **What it does:** Curated editorial content
- **Cost to you:** None (static content)
- **Monetization:** Free (SEO + acquisition)
- **Files:**
  - `src/pages/Guides.tsx`
  - `src/pages/GuideDetail.tsx`
  - `src/data/guides.ts`

#### 🎯 **Personalized Recommendations**
- **What it does:** Destinations matched to Travel DNA
- **Cost to you:** None (algorithm)
- **Monetization:** Part of quiz value prop
- **Files:**
  - `src/services/recommendationEngine.ts`

---

### 3.6 Export & Sharing Features

#### 📤 **Itinerary Export**
- **What it does:** PDF/share itineraries
- **Cost to you:** None (client-side)
- **Monetization:** Paid plans only
- **Files:**
  - Uses `jspdf` library

#### 🔗 **Trip Sharing**
- **What it does:** Share trips with non-users
- **Cost to you:** None (public link)
- **Monetization:** Viral acquisition
- **Files:**
  - `src/components/planner/GuestLinkModal.tsx`
  - `src/services/tripSharingAPI.ts`

---

### 3.7 Account & Subscription Features

#### 👤 **User Profiles**
- **What it does:** Avatar, bio, travel stats
- **Cost to you:** Storage (minimal)
- **Monetization:** Engagement feature
- **Files:**
  - `src/pages/Profile.tsx`
  - `src/services/profileAPI.ts`

#### 🎫 **Subscription Management**
- **What it does:** Stripe portal, plan changes
- **Cost to you:** Stripe fees
- **Monetization:** Revenue collection
- **Files:**
  - `supabase/functions/customer-portal/index.ts`
  - `supabase/functions/check-subscription/index.ts`
  - `src/services/stripeAPI.ts`

#### 📊 **Usage Tracking**
- **What it does:** Track feature usage for limits
- **Cost to you:** None (database)
- **Monetization:** Enforce free tier limits
- **Files:**
  - `supabase/functions/consume-usage/index.ts`
  - `supabase/functions/get-entitlements/index.ts`
  - `src/hooks/useEntitlements.ts`

---

## PART 4: EDGE FUNCTION INVENTORY

Complete list of all 31 edge functions:

| Function | Purpose | External APIs | Cost Driver |
|----------|---------|--------------|-------------|
| `activities` | Activity CRUD | None | None |
| `analyze-preferences` | Quiz analysis | Lovable AI | AI tokens |
| `book-activity` | Book external activity | Viator? | TBD |
| `bulk-import` | Admin data import | None | None |
| `calculate-travel-dna` | Archetype generation | Lovable AI | AI tokens |
| `check-subscription` | Stripe status check | Stripe | None |
| `consume-usage` | Track feature usage | None | None |
| `create-booking-checkout` | Trip payment | Stripe | Transaction fee |
| `create-checkout` | Subscription payment | Stripe | Transaction fee |
| `customer-portal` | Subscription management | Stripe | None |
| `delete-my-account` | Account deletion | None | None |
| `delete-users` | Admin user deletion | None | None |
| `destination-images` | Photo fetching | Google, TripAdvisor, Pexels | Google API |
| `enrich-itinerary` | Add venue details | Google Places | Google API |
| `enrich-preferences` | Expand preferences | Lovable AI | AI tokens |
| `flights` | Flight search | Amadeus | Amadeus API |
| `generate-itinerary` | Full itinerary creation | Lovable AI, Google | AI + Google |
| `get-entitlements` | Feature flag check | Stripe | None |
| `hotels` | Hotel search | Amadeus | Amadeus API |
| `import-users` | Admin user import | None | None |
| `optimize-itinerary` | Route optimization | Google? | TBD |
| `send-contact-email` | Contact form | SendGrid | Email |
| `send-price-alerts` | Price drop alerts | SendGrid | Email |
| `send-trip-reminders` | Trip reminders | SendGrid | Email |
| `suggest-mystery-trips` | Surprise destinations | Lovable AI | AI tokens |
| `test-email` | Email testing | SendGrid | Email |
| `trip-notifications` | In-app notifications | SendGrid | Email |
| `verify-booking-payment` | Payment verification | Stripe | None |
| `verify-payment` | Payment verification | Stripe | None |
| `weather` | Weather data | WeatherStack | Weather API |

---

## PART 5: MONETIZATION RECOMMENDATIONS

### 5.1 High-Value Features to Gate

| Feature | Current State | Recommendation |
|---------|--------------|----------------|
| Itinerary Generation | 2 free/month | ✅ Good limit |
| Flight/Hotel Search | Paid only | ✅ Keep gated |
| Group Budgeting | Not gated | 🔴 Gate to paid |
| Price Monitoring | Not gated | 🔴 Gate to paid |
| Weather Forecast | Not gated | 🟡 Basic free, full paid |
| Venue Enrichment | Not gated | 🔴 Gate VoyagerMaps |
| Export | Not gated | 🔴 Gate to paid |

### 5.2 Potential Add-On Products

| Add-On | Price Point | Features |
|--------|-------------|----------|
| **VoyagerMaps** | $9.99/mo | Deep venue data, aggregated reviews |
| **Price Watch** | $4.99/mo | Unlimited price monitoring, alerts |
| **Group Pro** | $7.99/mo | Unlimited members, settlement tracking |
| **Concierge** | $49.99/trip | Human review of AI itinerary |

### 5.3 API Cost Optimization

| Strategy | Potential Savings |
|----------|-------------------|
| Cache flight/hotel results (4hr TTL) | 40-60% fewer API calls |
| Batch venue verification | 30% fewer Google calls |
| Use free image sources first | 50% fewer paid image calls |
| Compress AI prompts | 20% fewer tokens |

---

## PART 6: FINANCIAL PROJECTIONS

### 6.1 Per-Trip Cost Breakdown

| Stage | API Calls | Estimated Cost |
|-------|-----------|----------------|
| **Quiz Completion** | AI analysis | $0.02 |
| **Destination Browse** | None | $0.00 |
| **Flight Search** | 1-3 Amadeus | $0.03-0.15 |
| **Hotel Search** | 1-3 Amadeus | $0.03-0.15 |
| **Itinerary Generation** | AI + 5-15 venue lookups | $0.20-0.80 |
| **Weather Check** | 1 call | $0.001 |
| **Day Regeneration** (avg 2) | AI | $0.04-0.20 |
| **TOTAL PER TRIP** | | **$0.32-1.35** |

### 6.2 Revenue vs Cost Per Plan

| Plan | Revenue | Estimated Trips/Mo | Cost/Trip | Margin |
|------|---------|-------------------|-----------|--------|
| Free | $0 | 0.5 (limited) | $0.20 | -$0.20 |
| Voyage | $15.99 | 3-5 | $0.50 | ~$13-14 |
| Wanderlust | $119.99 | 10-15 | $0.80 | ~$108-112 |
| Single Trip | $29.99 | 1 | $0.80 | ~$29.19 |

---

## APPENDIX: Quick Reference

### All External API Keys in Use
```
AMADEUS_API_KEY, AMADEUS_API_SECRET
GOOGLE_MAPS_API_KEY, GOOGLE_GEOCODE_API_KEY, GOOGLE_MAPS_STATIC_API_KEY
WEATHERSTACK_API_KEY
PEXELS_API_KEY
TRIPADVISOR_API_KEY
FOURSQUARE_API_KEY, FOURSQUARE_CLIENT_ID, FOURSQUARE_API_SECRET
OPENTRIPMAP_API_KEY
VIATOR_API_KEY
SENDGRID_API_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
LOVABLE_API_KEY (managed)
```

### Cost-Triggering Actions
1. User searches for flights → Amadeus API call
2. User searches for hotels → Amadeus API call
3. User generates itinerary → AI call + venue verification
4. User regenerates a day → AI call
5. User completes quiz → AI analysis call
6. Weather widget loads → WeatherStack call
7. Activity photos load → Google/TripAdvisor call
8. User checks out → Stripe transaction fee
9. Email notifications sent → SendGrid call

### Zero-Cost Actions
- Browsing destinations
- Viewing saved trips
- Managing group members
- Updating preferences
- Reading guides
- Profile updates
- Filtering/sorting results
