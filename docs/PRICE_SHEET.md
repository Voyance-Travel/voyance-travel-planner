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

### Homepage Entry Points (3 Main CTAs)

| Entry Point | What Happens | APIs Called | Cost |
|-------------|--------------|-------------|------|
| **1. Plan a Trip** | Quick 3-day preview generation | `generate-quick-preview` (gemini-2.5-flash) | **$0.003-0.01** |
| **2. Find My Style** | Travel DNA quiz + calculation | Frontend quiz ($0) + `calculate-travel-dna` (gpt-5-mini) | **$0.01-0.03** |
| **3. Fix My Itinerary** | Paste text → AI "roasts" it | `analyze-itinerary` (gemini-2.5-flash) | **$0.003-0.01** |

#### Detailed Breakdown:

**Plan a Trip (Destination Entry)**
| Step | API | Model | Tokens (est.) | Cost |
|------|-----|-------|---------------|------|
| User enters destination | None | - | - | $0 |
| Quick preview generated | `generate-quick-preview` | gemini-2.5-flash | ~500 in / ~300 out | **$0.003-0.01** |
| User sees 3-day teaser | None | - | - | $0 |
| **Total** | | | | **$0.003-0.01** |

**Find My Style (Travel DNA Quiz)**
| Step | API | Model | Tokens (est.) | Cost |
|------|-----|-------|---------------|------|
| 21 quiz questions | None (frontend) | - | - | $0 |
| Calculate DNA score | `calculate-travel-dna` | gpt-5-mini | ~500-1.5k in / ~300-800 out | **$0.01-0.03** |
| Display archetype reveal | None (frontend) | - | - | $0 |
| **Total** | | | | **$0.01-0.03** |

**Retake Quiz** = Same cost: **$0.01-0.03**

**Fix My Itinerary (Roast)**
| Step | API | Model | Tokens (est.) | Cost |
|------|-----|-------|---------------|------|
| User pastes itinerary text | None | - | - | $0 |
| AI analyzes & roasts | `analyze-itinerary` | gemini-2.5-flash | ~500-1k in / ~500-800 out | **$0.003-0.01** |
| Display issues/suggestions | None (frontend) | - | - | $0 |
| **Total** | | | | **$0.003-0.01** |

---

### Homepage & Static Pages

| Page | APIs Used | Cost/Load |
|------|-----------|-----------|
| Homepage | None | **$0** |
| Pricing Page | None | **$0** |
| Archetypes Page | None | **$0** |
| Blog | None | **$0** |

### Travel DNA Quiz (Full Flow)

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

> **IMPORTANT:** Free users now get Day 1 GENERATED only (not full itinerary blurred).
> This reduces cost by ~80% compared to generating all days and hiding them.

| Step | Cost |
|------|------|
| Visit Homepage | $0 |
| Take DNA Quiz | $0.01-0.03 |
| Plan Trip (Day 1 generated) | $0.03-0.08 |
| View Weather | $0 |
| Search Flights | $0-0.05 |
| **Total per Free User** | **$0.04-0.16** |

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

## 8. Complete Feature Inventory

### Consumer Features (B2C)

#### Homepage & Entry Points
| Feature | Description | Cost |
|---------|-------------|------|
| Plan a Trip | Destination entry → 3-day quick preview | $0.003-0.01 |
| Find My Style | Travel DNA quiz (21 questions) | $0.01-0.03 |
| Fix My Itinerary | Paste & roast existing itinerary | $0.003-0.01 |

#### Travel DNA System
| Feature | Description | Cost |
|---------|-------------|------|
| 21-Question Quiz | Behavioral scenarios mapping personality | $0 (frontend) |
| DNA Calculation | AI scores 8 traits, matches 27 archetypes | $0.01-0.03 |
| Archetype Reveal | Animated reveal with tagline & summary | $0 |
| Retake Quiz | Full recalculation | $0.01-0.03 |
| 27 Archetypes | EXPLORER, CONNECTOR, ACHIEVER, RESTORER, CURATOR, TRANSFORMER categories | $0 |
| Archetype Page | Browse all 27 archetypes with descriptions | $0 |
| Trait Badges | "High Adventure", "Value-Focused" etc. | $0 |

#### Trip Planning Flow
| Feature | Description | Cost |
|---------|-------------|------|
| Start Page | Unified entry with destination + dates + hotel mode | $0 |
| Destination Autocomplete | City search with popular suggestions | $0 |
| Hotel Mode Selection | "Search Hotels" / "I Have a Hotel" / "Add Later" | $0 |
| Companion Selection | Solo, Partner, Family, Friends, Group | $0 |
| Budget Selection | Value, Moderate, Premium, Luxury | $0 |
| Pace Selection | Slow, Balanced, Active, Packed | $0 |

#### Itinerary Generation
| Feature | Description | Cost |
|---------|-------------|------|
| Full Itinerary Build | AI generates multi-day trip (gpt-5) | $0.15-0.60 |
| Day 1 Only (Free) | **Single day generated** for free users (not blurred full trip) | $0.03-0.08 |
| Regenerate Day | Rebuild single day with different activities | $0.03-0.10 |
| Swap Activity | Replace one activity with alternative | $0.01-0.05 |
| Add Restaurant | AI recommends dining for meal slot | $0.02-0.06 |
| Itinerary Chat | Conversational modifications | $0.005-0.02 |

#### Visible Intelligence (7 Layers)
| Feature | Description | Cost |
|---------|-------------|------|
| What to Do | Standard landmarks & attractions | Included |
| What to Skip | Trust-building skip recommendations | Included |
| When to Go | Timing hacks & crowd avoidance | Included |
| How to Do It | Insider tips (table requests, quiet entrances) | Included |
| What You'd Miss | Hidden "Voyance Finds" | Included |
| Why It's for You | Personalization proof with trade-off explanations | Included |
| What Connects | Sequencing logic between activities | Included |
| Intelligence Badges | Visual tags: Voyance Find, Timing Hack, Insider Tip, etc. | Included |

#### Route Optimization
| Feature | Description | Cost |
|---------|-------------|------|
| Optimize Day Route | Reorder activities for efficient travel | $0.005-0.015 |
| Walking Directions | Step-by-step between activities | Included |
| Transit Suggestions | Public transport options | Included |

#### Search & Discovery
| Feature | Description | Cost |
|---------|-------------|------|
| Flight Search | Amadeus-powered with filters | $0-0.05 |
| Hotel Search | Amadeus-powered with amenity filters | $0-0.05 |
| Activity Search | Viator products with booking | $0 |
| Restaurant Discovery | AI-powered recommendations | $0.02-0.06 |
| Weather Forecast | Multi-day forecast for destination | $0 |
| Local Events | Real-time event lookup (Perplexity) | $0.005 |
| Travel Advisories | Safety & visa info | $0.005 |
| Nearby Suggestions | "What's near me" discovery | $0.017 |

#### Destination Exploration
| Feature | Description | Cost |
|---------|-------------|------|
| Destinations Page | Browse all supported destinations | $0 |
| Destination Detail | Deep-dive with neighborhoods, tips, best times | $0 |
| Destination Images | Tiered fallback (Cache → Google → Pexels) | $0-0.017 |
| Explore Page | Curated destination discovery | $0 |

#### Booking & Commerce
| Feature | Description | Cost |
|---------|-------------|------|
| Viator Direct Booking | Tours & activities with instant confirm | $0 (affiliate) |
| Flight Redirect | Kayak affiliate link | $0 |
| Hotel Redirect | Booking.com affiliate link | $0 |
| Restaurant Link | OpenTable / official website lookup | $0.005 |
| Trip Pass Purchase | Stripe embedded checkout | 2.9% + $0.30 |
| Credit Purchase | 5 or 10 credit packs | 2.9% + $0.30 |

#### Collaboration & Sharing
| Feature | Description | Cost |
|---------|-------------|------|
| Share Trip Link | Unique secure token, 7-day expiry | $0 |
| Invite Collaborators | Add trip companions | $0 |
| Accept Invite | Join shared trip | $0 |
| Friendship System | Auto-connect on collaboration | $0 |
| Export PDF | Download formatted itinerary | $0 |

#### User Account
| Feature | Description | Cost |
|---------|-------------|------|
| Email Sign Up | Email/password registration | $0 |
| Google Sign In | OAuth authentication | $0 |
| Profile Page | View DNA, trips, achievements | $0 |
| Profile Edit | Update preferences, photo | $0 |
| Settings Page | Account, notifications, privacy | $0 |
| Trip Dashboard | All trips: drafts, upcoming, past | $0 |
| Trip Detail | Full itinerary view with all features | $0 |
| Active Trip View | Currently traveling mode | $0 |
| Trip Recap | Post-trip summary & learnings | $0 |
| Password Reset | Email-based reset flow | $0 |
| Delete Account | GDPR-compliant deletion | $0 |

#### Companion System
| Feature | Description | Cost |
|---------|-------------|------|
| 8 User States | stranger → loyal progression | $0 |
| Contextual Messaging | State-appropriate copy throughout | $0 |
| Micro-feedback | Archetype-specific encouragement | $0 |

#### Gamification
| Feature | Description | Cost |
|---------|-------------|------|
| Achievements | Unlockable badges for milestones | $0 |
| Progress Tracking | Trips completed, countries visited | $0 |

#### Static Pages
| Page | Description | Cost |
|------|-------------|------|
| Homepage | Value-first hero with 3 CTAs | $0 |
| How It Works | Magazine-style editorial guide | $0 |
| Pricing | Plan comparison with checkout | $0 |
| Archetypes | 27 archetype showcase | $0 |
| About | Company story & mission | $0 |
| Contact | Contact form (SendGrid) | $0 |
| FAQ | Searchable knowledge base | $0 |
| Help Center | Support & documentation | $0 |
| Guides | Travel content library | $0 |
| Travel Tips | Blog-style tips | $0 |
| Careers | Job listings | $0 |
| Press | Press kit & media assets | $0 |
| Privacy Policy | Legal | $0 |
| Terms of Service | Legal | $0 |

---

### Travel Agent Features (B2B)

#### Dashboard & Overview
| Feature | Description | Cost |
|---------|-------------|------|
| Agent Dashboard | Pipeline view, revenue stats, tasks | $0 |
| Quick Stats | Total clients, revenue, pending tasks | $0 |
| Recent Activity | Live feed of trip/client updates | $0 |

#### Client Management
| Feature | Description | Cost |
|---------|-------------|------|
| Accounts List | All client accounts with search/filter | $0 |
| Account Detail | Full client profile with trips, travelers | $0 |
| Account Form | Create/edit client accounts | $0 |
| Client Tags | Custom categorization | $0 |
| Lifetime Value Tracking | Total revenue per client | $0 |
| Intake Form | Public client onboarding form | $0 |
| Intake Link | Shareable intake URL per client | $0 |

#### Traveler Profiles
| Feature | Description | Cost |
|---------|-------------|------|
| Traveler List | All travelers under account | $0 |
| Traveler Detail | Passport, preferences, loyalty programs | $0 |
| Passport Management | Number, expiry, country | $0 |
| Loyalty Programs | Airline & hotel memberships | $0 |
| Dietary & Medical | Allergies, restrictions, needs | $0 |
| Emergency Contacts | Per-traveler contact info | $0 |
| Seating Preferences | Aisle/window, meal preference | $0 |
| TSA/Global Entry | KTN, Redress numbers | $0 |

#### Trip Management
| Feature | Description | Cost |
|---------|-------------|------|
| Trip List | All trips with pipeline stage filter | $0 |
| Trip Workspace | Full trip editing environment | $0 |
| Trip Form | Create/edit trip details | $0 |
| Pipeline Stages | Inquiry → Proposal → Booked → Traveling → Complete | $0 |
| Trip Tags | Custom categorization | $0 |
| Internal Notes | Agent-only notes | $0 |
| Client-Facing Notes | Visible to client | $0 |
| Link to Consumer Trip | Connect to generated itinerary | $0 |
| Trip Share Page | Client-facing trip view | $0 |

#### Booking Segments
| Feature | Description | Cost |
|---------|-------------|------|
| Flight Segments | Carrier, flight#, times, terminals | $0 |
| Hotel Segments | Property, room type, confirmation | $0 |
| Tour Segments | Activities with supplier info | $0 |
| Transfer Segments | Ground transport bookings | $0 |
| Cruise Segments | Ship, cabin, port schedule | $0 |
| Insurance Segments | Policy details | $0 |
| Segment Travelers | Assign travelers to segments | $0 |
| Confirmation Numbers | Per-segment tracking | $0 |
| Supplier Management | Vendor contacts & codes | $0 |
| Commission Tracking | Per-segment commission rates | $0 |

#### Quotes & Invoicing
| Feature | Description | Cost |
|---------|-------------|------|
| Quote Builder | Line items, agency fee, discounts | $0 |
| Quote Versioning | v1, v2, v3 with history | $0 |
| Quote PDF Export | Client-ready document | $0 |
| Client Approval | Approval workflow with signature | $0 |
| Invoice Generation | Auto-generate from approved quote | $0 |
| Invoice List | All invoices with status | $0 |
| Payment Tracking | Partial payments, balance due | $0 |
| Payment Schedule | Deposit, final payment deadlines | $0 |
| Payment Reminders | Automated email reminders | $0 |

#### Financial Tracking
| Feature | Description | Cost |
|---------|-------------|------|
| Revenue Dashboard | Total revenue, margins | $0 |
| Commission Report | Expected vs received commissions | $0 |
| Supplier Payments | Track what's owed to suppliers | $0 |
| Profit per Trip | Net margin calculation | $0 |
| Payouts (Stripe Connect) | Agent payout management | $0 |

#### Task Management
| Feature | Description | Cost |
|---------|-------------|------|
| Task List | All tasks with filters | $0 |
| Task Creation | Manual task creation | $0 |
| System-Generated Tasks | Auto-created for deadlines | $0 |
| Task Reminders | Email notifications | $0 |
| Task Priority | High/Medium/Low | $0 |
| Task Due Dates | Deadline tracking | $0 |

#### Documents
| Feature | Description | Cost |
|---------|-------------|------|
| Document Storage | Upload confirmations, contracts | $0 (storage) |
| Document Types | Passport, visa, confirmation, contract | $0 |
| Client-Visible Flag | Control what client sees | $0 |
| Document Expiry | Passport/visa expiry alerts | $0 |

#### Communications
| Feature | Description | Cost |
|---------|-------------|------|
| Email Log | All sent emails | $0 |
| Email Templates | Pre-built templates | $0 |
| Send Email | Compose & send to client | $0.001 |

#### Agent Settings
| Feature | Description | Cost |
|---------|-------------|------|
| Agency Branding | Logo, colors for exports | $0 |
| Email Signature | Custom signature | $0 |
| Commission Defaults | Default rates by supplier type | $0 |
| Payment Instructions | Terms on invoices | $0 |

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
| **Total Consumer Features** | 100+ |
| **Total Agent Features** | 60+ |
| **Static Pages** | 15 |
