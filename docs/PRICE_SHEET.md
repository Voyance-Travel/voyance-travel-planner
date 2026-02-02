# Voyance Complete Price Sheet

> **Last Updated:** February 2026  
> **Purpose:** Complete cost breakdown for every API, integration, feature, and infrastructure component

---

## Table of Contents
1. [Infrastructure (Fixed Costs)](#1-infrastructure-fixed-costs)
2. [AI/LLM Costs](#2-aillm-costs)
3. [External API Costs](#3-external-api-costs)
4. [Feature-Level Cost Breakdown](#4-feature-level-cost-breakdown)
5. [User Journey Cost Estimates](#5-user-journey-cost-estimates)
6. [Revenue](#6-revenue)
7. [Break-Even Analysis](#7-break-even-analysis)

---

## 1. Infrastructure (Fixed Costs)

| Component | Provider | Cost | Notes |
|-----------|----------|------|-------|
| **Database + Auth + Edge Functions** | Lovable Cloud (Supabase) | **$0/mo** | Free tier: 500MB DB, 50k MAU, 500k edge invocations |
| **Domain** | Various | **$12-15/yr** | voyance-travel-planner.lovable.app (free) or custom |
| **Frontend Hosting** | Lovable | **$0/mo** | Included |
| **Search Cache Table** | Supabase | **$0/mo** | 4-hour TTL, part of DB storage |
| **Image Cache Table** | Supabase | **$0/mo** | curated_images table |

### Monthly Fixed Total: **$0-50/mo**

---

## 2. AI/LLM Costs

### Lovable AI Gateway (No API Key Required)

| Model | Use Case | Input Cost | Output Cost | Per-Call Estimate |
|-------|----------|------------|-------------|-------------------|
| `openai/gpt-5` | Itinerary generation | ~$0.01/1k tokens | ~$0.03/1k tokens | **$0.15-0.60/trip** |
| `openai/gpt-5-mini` | DNA calculation, quick tasks | ~$0.0004/1k | ~$0.0016/1k | **$0.01-0.03/call** |
| `google/gemini-2.5-flash` | Fast enrichment, summaries | ~$0.0001/1k | ~$0.0004/1k | **$0.005-0.02/call** |
| `google/gemini-2.5-flash-image-preview` | Image generation fallback | Variable | Variable | **$0.01-0.05/image** |

### AI Usage by Feature

| Feature | Model Used | Tokens (est.) | Cost/Call |
|---------|------------|---------------|-----------|
| **Full Itinerary Generation** | gpt-5 | 8k-25k in / 6k-15k out | **$0.15-0.60** |
| **Day Regeneration** | gpt-5-mini | 2k-5k in / 2k-4k out | **$0.02-0.08** |
| **Activity Swap** | gpt-5-mini | 1k-2k in / 500-1k out | **$0.005-0.02** |
| **Travel DNA Calculation** | gpt-5-mini | 500-1.5k in / 300-800 out | **$0.01-0.03** |
| **Restaurant Recommendation** | gpt-5-mini | 1k-3k in / 500-1.5k out | **$0.01-0.04** |
| **Itinerary Chat** | gpt-5-mini | 500-2k in / 200-800 out | **$0.005-0.02** |
| **Quick Preview** | gpt-5-mini | 500-1k in / 200-500 out | **$0.003-0.01** |
| **Parse Travel Story** | gpt-5-mini | 500-2k in / 500-1k out | **$0.005-0.02** |
| **Mystery Trip Suggestion** | gpt-5-mini | 1k-3k in / 1k-2k out | **$0.01-0.04** |

---

## 3. External API Costs

### Flight & Hotel Search (Amadeus)

| Endpoint | Free Tier | Paid Pricing | Our Usage |
|----------|-----------|--------------|-----------|
| Flight Offers | 2,000 calls/mo | $0.01-0.05/call | **$0/mo** (within free) |
| Hotel List | 2,000 calls/mo | $0.01-0.05/call | **$0/mo** (within free) |
| Hotel Offers | 2,000 calls/mo | $0.01-0.05/call | **$0/mo** (within free) |

> **Caching Strategy:** 4-hour TTL in `search_cache` table reduces API calls by ~70%

### Google APIs

| API | Free Tier | Paid Pricing | Our Usage |
|-----|-----------|--------------|-----------|
| **Places API (v1)** | $200/mo credit | $17/1k requests | Venue verification |
| **Text Search** | Included in credit | $17/1k | Activity image lookup |
| **Photo Media** | Included in credit | $7/1k | Photo retrieval |
| **Routes API** | $200/mo credit | $5/1k routes | Route optimization |
| **Geocoding** | $200/mo credit | $5/1k | Address resolution |
| **Static Maps** | $200/mo credit | $2/1k | Map thumbnails |

> **Monthly Google Budget:** $200 free credit covers ~11k Places calls or ~40k Routes calls

### Weather (Open-Meteo)

| Endpoint | Cost | Notes |
|----------|------|-------|
| Forecast API | **$0** | Completely free, no API key |
| Geocoding API | **$0** | Completely free, no API key |

### Images (Tiered Fallback System)

| Tier | Provider | Cost | Usage Priority |
|------|----------|------|----------------|
| 1 | **Curated Cache** | $0 | Check first |
| 2 | **Google Places Photos** | ~$0.017/photo | After cache miss |
| 3 | **TripAdvisor** | $0 (basic) | Free fallback |
| 4 | **Wikimedia Commons** | $0 | Free fallback |
| 5 | **Lovable AI Generation** | ~$0.01-0.05 | Last resort |
| 6 | **Pexels** | $0 | Ultimate fallback |

### Viator (Activities)

| Feature | Cost | Revenue |
|---------|------|---------|
| Product Search | **$0** | Free API |
| Booking Redirect | **$0** | 8-10% affiliate commission |

### Email (SendGrid)

| Tier | Free Tier | Paid Pricing |
|------|-----------|--------------|
| Transactional | 100/day | $0.001/email |

### Foursquare

| Endpoint | Free Tier | Notes |
|----------|-----------|-------|
| Place Search | 950 calls/day | Venue discovery |
| Place Details | Included | Venue enrichment |

### Perplexity (via Connector)

| Use Case | Cost | Notes |
|----------|------|-------|
| Destination Intelligence | ~$0.005/call | Real-time web search |
| Travel Advisories | ~$0.005/call | Current info lookup |

---

## 4. Feature-Level Cost Breakdown

### Homepage & Static Pages

| Page | APIs Used | Cost/Load |
|------|-----------|-----------|
| Homepage | None | **$0** |
| Pricing Page | None | **$0** |
| Archetypes Page | None | **$0** |
| Blog | None | **$0** |

### Travel DNA Quiz

| Step | APIs Used | Cost |
|------|-----------|------|
| Quiz UI | None | **$0** |
| Scoring (Frontend) | None | **$0** |
| DNA Calculation | Lovable AI (gpt-5-mini) | **$0.01-0.03** |
| Retake Quiz | Same as above | **$0.01-0.03** |

### Trip Planning Flow

| Step | APIs Used | Cost |
|------|-----------|------|
| Plan a Trip Form | None | **$0** |
| Destination Search | None (local data) | **$0** |
| Quick Preview | Lovable AI (gpt-5-mini) | **$0.003-0.01** |

### Itinerary Generation

| Action | APIs Used | Cost Breakdown | Total |
|--------|-----------|----------------|-------|
| **Full Itinerary (5 days)** | | | **$0.25-0.75** |
| → AI Generation | gpt-5 | $0.15-0.60 | |
| → Venue Verification | Google Places | $0.05-0.10 (3-6 calls) | |
| → Weather | Open-Meteo | $0 | |
| → Images (cached) | Cache hit | $0 | |
| → Images (miss) | Google Places | $0.05-0.15 | |

### Itinerary Modifications

| Action | APIs Used | Cost |
|--------|-----------|------|
| **Regenerate 1 Day** | gpt-5-mini + Places | **$0.03-0.10** |
| **Swap 1 Activity** | gpt-5-mini + Places | **$0.01-0.05** |
| **Add Restaurant** | gpt-5-mini + Google Places | **$0.02-0.06** |
| **Itinerary Chat** | gpt-5-mini | **$0.005-0.02** |

### Route Optimization

| Action | APIs Used | Cost |
|--------|-----------|------|
| **Optimize Full Day** | Google Routes API | **$0.005-0.015** |
| → Per route segment | $0.005 each | ~3-5 routes/day |

### Search Features

| Feature | APIs Used | Cost |
|---------|-----------|------|
| **Flight Search** | Amadeus | **$0-0.05** (cached/free tier) |
| **Hotel Search** | Amadeus | **$0-0.05** (cached/free tier) |
| **Activity Search** | Viator | **$0** (free API) |
| **Weather Lookup** | Open-Meteo | **$0** (free API) |

### Photo & Media

| Feature | Primary API | Fallback | Cost |
|---------|-------------|----------|------|
| **Destination Hero** | Curated Cache | Google Places | **$0-0.017** |
| **Activity Photo** | Curated Cache | Google → TripAdvisor → Wikimedia | **$0-0.017** |
| **Restaurant Photo** | Google Places | Pexels | **$0-0.017** |
| **Hotel Photo** | Amadeus (included) | Google Places | **$0-0.017** |

### Explore & Discover

| Feature | APIs Used | Cost |
|---------|-----------|------|
| **Destinations Page** | Cache | **$0** |
| **Destination Details** | Perplexity (if fresh) | **$0-0.005** |
| **Nearby Suggestions** | Google Places | **$0.017/call** |

### Booking & Payments

| Feature | APIs Used | Cost |
|---------|-----------|------|
| **Stripe Checkout** | Stripe | 2.9% + $0.30/transaction |
| **Viator Booking Redirect** | None | $0 (affiliate revenue) |
| **Flight Redirect** | None (Kayak affiliate) | $0 |
| **Hotel Redirect** | None (Booking.com affiliate) | $0 |

### Notifications & Email

| Feature | APIs Used | Cost |
|---------|-----------|------|
| **Trip Reminder Email** | SendGrid | **$0** (free tier) |
| **Price Alert Email** | SendGrid | **$0** (free tier) |
| **Contact Form** | SendGrid | **$0** (free tier) |

---

## 5. User Journey Cost Estimates

### Free User (Day 1 Only)

| Step | Cost |
|------|------|
| Visit Homepage | $0 |
| Take DNA Quiz | $0.01-0.03 |
| Plan Trip (Day 1 visible) | $0.20-0.50 |
| View Weather | $0 |
| Search Flights | $0-0.05 |
| **Total per Free User** | **$0.21-0.58** |

### Trip Pass User ($24.99 one-time)

| Step | Cost |
|------|------|
| DNA Quiz | $0.01-0.03 |
| Full Itinerary (5 days) | $0.25-0.75 |
| 2x Day Regenerations | $0.06-0.20 |
| 3x Activity Swaps | $0.03-0.15 |
| Route Optimization | $0.005-0.015 |
| Flight + Hotel Search | $0-0.10 |
| **Total per Trip Pass User** | **$0.35-1.25** |

### Heavy User (10 Credits / $149)

| Usage Pattern | Cost |
|---------------|------|
| 10 Full Trips | $2.50-7.50 |
| 20 Day Regenerations | $0.60-2.00 |
| 30 Activity Swaps | $0.30-1.50 |
| 10 Route Optimizations | $0.05-0.15 |
| **Total for Heavy User** | **$3.45-11.15** |

---

## 6. Revenue

### Pricing Tiers

| Product | Price | Stripe IDs |
|---------|-------|------------|
| **Trip Pass** | $24.99 | prod_TrNlzMhbWMadTG / price_1StezbFYxIg9jcJUpN3X01Ox |
| **5 Credits** | $79.00 | prod_TrNllJjO44rfTT / price_1StezcFYxIg9jcJUJMy5waSO |
| **10 Credits** | $149.00 | prod_TrNlRyHAG5CPaL / price_1StezdFYxIg9jcJUeoYoMEEI |

### Legacy Subscriptions (Deprecated)

| Product | Price | Status |
|---------|-------|--------|
| Monthly | $15.99/mo | Not shown in UI |
| Yearly | $129/yr | Not shown in UI |

### Travel Agent Tiers

| Tier | Price | Status |
|------|-------|--------|
| Starter | $49/mo | Planned |
| Pro | $149/mo | Planned |
| Agency | $499/mo | Planned |

### Affiliate Revenue (Potential)

| Source | Commission | Est. Monthly |
|--------|------------|--------------|
| Viator Bookings | 8-10% | Variable |
| Hotel Redirects | 4-6% | Variable |
| Flight Redirects | CPA | Variable |

---

## 7. Break-Even Analysis

### Monthly Operating Costs (100 Active Users)

| Category | Low Estimate | High Estimate |
|----------|--------------|---------------|
| Infrastructure | $0 | $50 |
| AI (100 trips) | $35 | $125 |
| Google APIs | $0 | $50 |
| Amadeus (cached) | $0 | $20 |
| Email | $0 | $5 |
| **Total** | **$35** | **$250** |

### Revenue Required

| Cost Level | Trip Passes Needed | 5-Credit Packs | 10-Credit Packs |
|------------|-------------------|----------------|-----------------|
| $35/mo | 2 | 1 | 1 |
| $100/mo | 5 | 2 | 1 |
| $250/mo | 11 | 4 | 2 |

### Unit Economics

| Product | Price | Avg Cost/User | Gross Margin |
|---------|-------|---------------|--------------|
| Trip Pass | $24.99 | $0.50-1.25 | **95-98%** |
| 5 Credits | $79.00 | $1.75-6.25 | **92-98%** |
| 10 Credits | $149.00 | $3.45-11.15 | **93-98%** |

---

## API Keys & Secrets Reference

| Secret Name | Provider | Required For |
|-------------|----------|--------------|
| `AMADEUS_API_KEY` | Amadeus | Flights, Hotels |
| `AMADEUS_API_SECRET` | Amadeus | Flights, Hotels |
| `GOOGLE_MAPS_API_KEY` | Google | Maps, Places, Routes |
| `GOOGLE_ROUTES_API_KEY` | Google | Route Optimization |
| `VIATOR_API_KEY` | Viator | Activity Search/Booking |
| `SENDGRID_API_KEY` | SendGrid | Emails |
| `STRIPE_SECRET_KEY` | Stripe | Payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Payment Webhooks |
| `TRIPADVISOR_API_KEY` | TripAdvisor | Photo Fallback |
| `PEXELS_API_KEY` | Pexels | Photo Fallback |
| `FOURSQUARE_API_KEY` | Foursquare | Venue Discovery |
| `PERPLEXITY_API_KEY` | Perplexity | Destination Intel |
| `LOVABLE_API_KEY` | Lovable | AI Gateway |

---

## Edge Functions Inventory (73 Total)

### High-Cost Functions (AI-Intensive)
- `generate-itinerary` - Full trip generation ($0.15-0.60)
- `calculate-travel-dna` - DNA calculation ($0.01-0.03)
- `optimize-itinerary` - Route optimization ($0.005-0.015)
- `suggest-mystery-trips` - Mystery destinations ($0.01-0.04)

### Medium-Cost Functions (External APIs)
- `flights` - Amadeus search ($0-0.05)
- `hotels` - Amadeus search ($0-0.05)
- `destination-images` - Multi-tier images ($0-0.017)
- `activities` - Viator search ($0)
- `viator-search` - Activity matching ($0)

### Low/No-Cost Functions
- `weather` - Open-Meteo ($0)
- `enrich-itinerary` - Haversine calc ($0)
- `check-subscription` - Stripe lookup ($0)
- `create-checkout` - Stripe session ($0)
- `customer-portal` - Stripe portal ($0)
- All webhook handlers ($0)

---

## Summary

| Metric | Value |
|--------|-------|
| **Fixed Monthly Cost** | $0-50 |
| **Variable Cost per Trip** | $0.25-0.75 |
| **Average Cost per Paying User** | $0.50-1.25 |
| **Gross Margin** | 93-98% |
| **Break-Even (Trip Passes)** | 2-11/month |
| **Total Edge Functions** | 73 |
| **Total Secrets/API Keys** | 21 |
