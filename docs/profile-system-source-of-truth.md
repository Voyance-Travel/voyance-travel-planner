# PROFILE_SYSTEM_SOURCE_OF_TRUTH.md

## Overview

The Voyance Profile Page is a dynamic, multi-tabbed user interface that personalizes travel experiences by surfacing rich data collected through the Dream Quiz, user behaviors, and AI-powered enrichment. It is composed of structured backend data, secure API endpoints, and a highly animated, modern frontend powered by Framer Motion.

This document serves as the **source of truth for the backend implementation** of the Profile system, including precise table usage, API requirements, logic ownership, and expected data flow.

---

## Tabs Summary

| Tab          | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| Overview     | Displays travel DNA, emotional signature, and profile completion |
| My Trips     | Displays real user trips, filters, and stats                     |
| Preferences  | Shows editable preferences across 10 travel categories           |
| Companions   | Manages linked travel profiles (group travel system)             |
| Achievements | Displays gamified badges and milestones                          |
| Billing      | Displays current plan and upgrade/transaction history            |

---

## Key Tables Used

| Table Name                 | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| `users`                    | Core user data (display name, loyaltyTier, handle)    |
| `quiz_sessions`            | Tracks active and complete quiz sessions              |
| `quiz_responses`           | Raw answers from each quiz step                       |
| `travel_dna_profiles`      | Personality, traits, archetype, confidence, rarity    |
| `user_preferences`         | LEGACY TABLE - DO NOT USE (use individual tables)     |
| `trips`                    | All trips tied to user (draft, booked, completed)     |
| `timeline_blocks`          | Daily itinerary elements                              |
| `manual_bookings`          | Manually-entered trip segments                        |
| `stripe_transactions`      | Stripe payments for plans, add-ons                    |
| `stripe_webhooks`          | Stripe billing and subscription events                |
| `achievement_unlocks`      | User milestone data (NOT IMPLEMENTED YET)             |
| `user_companions`          | Social linking (NOT IMPLEMENTED YET)                  |

---

## Profile Tabs – Backend Structure & Data Flow

### Overview Tab

* **Tables Used**: `travel_dna_profiles`, `users`, and the 7 enrichment tables (NOT `user_preferences`)
* **Flow**:

  1. User identity block is built from `users.display_name`, `handle`, `loyaltyTier` (camelCase), and `avatar_url`
  2. Quiz submission triggers enrichment pipeline
  3. `finalize-profile` endpoint populates travel DNA and 7 separate preference tables
  4. Data is pulled via `/user/preferences/*` endpoints for rendering
* **APIs Required**:

  * `GET /api/v1/user/profile` (for display_name, handle, loyaltyTier, avatar_url)
  * `GET /api/v1/user/preferences/travel-dna`
  * `GET /api/v1/user/preferences/core`

### My Trips Tab

* **Tables Used**: `trips`, `timeline_blocks`, `manual_bookings`
* **Flow**:

  1. Trip creation via `POST /api/v1/trips`
  2. Retrieval via `GET /api/v1/trips` (fetches all trips for the user)
  3. Optional updates via PUT/DELETE
* **APIs Required**:

  * `GET /api/v1/trips` - Fetches all user trips (no status filtering on backend)
  * `POST /api/v1/trips`
  * `PUT /api/v1/trips/:id`
  * `DELETE /api/v1/trips/:id`

* **Frontend Implementation**:
  * Component: `ProfileV6.tsx` (Trips tab)
  * Service: `tripsAPI.ts`
  * Filtering Strategy: **Client-side only** - All trips are fetched once and filtered on the frontend based on selected tab (All, Upcoming, Completed, Drafts)
  * Data Flow:
    1. `fetchTrips()` fetches all trips without status filter (limit: 100)
    2. `trips` array filters out invalid entries (must have destination and name)
    3. `filteredTrips` applies the selected filter (all/upcoming/completed/drafts)
    4. `tripCounts` memoized object provides consistent counts for all filter badges
  * Rationale: Avoids race conditions between backend filtering and UI state; ensures counts and displayed trips are always in sync

### Preferences Tab

* **Table Used**: Individual preference tables (`user_core_preferences`, `user_flight_preferences`, `user_food_preferences`, `user_mobility_preferences`, `user_ai_preferences`, `travel_dna_profiles`)
* **Flow**:

  1. Quiz finalization populates all preference fields across multiple tables
  2. Frontend loads all preferences via `userPreferencesAPI.getUserPreferences(userId)` which aggregates all sections
  3. Frontend saves via sectioned PUT endpoints for each category
* **APIs Required**:

  * **GET (Read All)**: Uses `userPreferencesAPI.getUserPreferences(userId)` which internally calls:
    * `GET /api/v1/user/preferences/core`
    * `GET /api/v1/user/preferences/flight`
    * `GET /api/v1/user/preferences/food`
    * `GET /api/v1/user/preferences/mobility`
    * `GET /api/v1/user/preferences/ai`
    * `GET /api/v1/user/preferences/travel-dna`
  * **PUT (Write/Update)**: Uses individual sectioned endpoints via `userPreferencesAPI`:
    * `PUT /api/v1/user/preferences/core` via `updateCorePreferences(userId, data)`
    * `PUT /api/v1/user/preferences/flight` via `updateFlightPreferences(userId, data)`
    * `PUT /api/v1/user/preferences/food` via `updateFoodPreferences(userId, data)`
    * `PUT /api/v1/user/preferences/mobility` via `updateMobilityPreferences(userId, data)`
    * `PUT /api/v1/user/preferences/ai` via `updateAIPreferences(userId, data)`
    * `PUT /api/v1/user/preferences/travel-dna` via `updateTravelDNA(userId, data)`

* **Frontend Implementation**:
  * Component: `ProfileV6.tsx` (Preferences tab)
  * Service: `userPreferencesAPI.ts` (handles data fetching and persistence)
  * Save Strategy: All preference sections are saved in parallel when user clicks save
  * Data Format: Frontend uses `BackendPreferencesData` structure with sections: `core`, `flight`, `food`, `mobility`, `ai`, `travelDNA`

### Companions Tab

* **Planned Table**: `user_companions`
* **Planned Flow**:

  1. User sends invitation to another user (by handle)
  2. Companion accepts → creates bidirectional link
  3. Trips marked as "shared" become visible to companions
* **Planned APIs**:

  * `POST /api/v1/companions/invite`
  * `GET /api/v1/companions`
  * `PATCH /api/v1/companions/:id`

### Achievements Tab

* **Tables Used**: `achievement_unlocks`
* **Flow**:

  1. Backend logs user milestone actions (e.g. trip booked, quiz completed)
  2. `achievement_unlocks` table tracks unlocked badge IDs
  3. Frontend fetches this list for visual rendering
* **APIs Required**:

  * `GET /api/v1/user/achievements`
  * `POST /api/v1/user/achievements/unlock`

### Billing Tab

* **Tables Used**: `stripe_transactions`, `stripe_webhooks`
* **Flow**:

  1. User clicks upgrade CTA → `create-checkout-session`
  2. Stripe completes transaction → webhook fires
  3. `stripe_transactions` logs the result
* **APIs Required**:

  * `GET /api/v1/billing/history`
  * `POST /api/v1/billing/create-checkout-session`
  * `POST /api/v1/billing/stripe-webhook`

---

## API Endpoints

### **Core Profile System**
| Endpoint                                       | Purpose                              |
| ---------------------------------------------- | ------------------------------------ |
| `POST /api/v1/quiz/finalize-profile`           | Populates all enrichment tables      |
| `GET /api/v1/user/profile`                     | Returns current user's display_name, handle, loyalty tier, avatar |
| `POST /api/v1/user/avatar`                     | Uploads or updates user's avatar (optional)                       |
| `GET /api/v1/user/profile/`                    | Complete user profile data           |
| `GET /api/v1/users/profile`                    | User profile operations              |
| `GET /api/v1/users/travel-profile`             | Travel profile data                  |
| `GET /api/v1/user/profile/identity`             | Travel archetype, tagline, confidence, rarity & motivators        |

### **User Preferences**
| Endpoint                                       | Purpose                              |
| ---------------------------------------------- | ------------------------------------ |
| `GET /api/v1/user/preferences`                 | General user preferences             |
| `GET /api/v1/user/preferences/core`            | Core travel preferences              |
| `GET /api/v1/user/preferences/mobility`        | Mobility/accessibility preferences   |
| `GET /api/v1/user/preferences/flight`          | Flight preferences                   |
| `GET /api/v1/user/preferences/food`            | Food preferences                     |
| `GET /api/v1/user/preferences/travel-dna`      | Travel DNA profile data              |
| `GET /api/v1/user/preferences/ai`              | AI preferences                       |

### **Trips & Billing**
| Endpoint                                       | Purpose                              |
| ---------------------------------------------- | ------------------------------------ |
| `GET /api/v1/trips`                            | Get all trips (supports query params) |
| `POST /api/v1/trips`                           | Create new trip                      |
| `PUT /api/v1/trips/:id`                        | Update trip                          |
| `DELETE /api/v1/trips/:id`                     | Delete trip                          |
| `GET /api/v1/billing/history`                  | Stripe transactions                  |
| `POST /api/v1/billing/create-checkout-session` | Stripe checkout link                 |
| `POST /api/v1/billing/stripe-webhook`          | Stripe event logging and sync        |

#### **Trip Query Parameters**
| Parameter | Values | Example |
|-----------|--------|---------|
| `status` | draft, planned, upcoming, completed, cancelled | `?status=upcoming` |
| `limit` | 1-100 (default: 20) | `?limit=50` |
| `offset` | For pagination | `?offset=20` |
| `sortBy` | createdAt, startDate, endDate, name | `?sortBy=startDate` |
| `sortOrder` | asc, desc | `?sortOrder=asc` |

### **User Operations**
| Endpoint                                       | Purpose                              |
| ---------------------------------------------- | ------------------------------------ |
| `GET /api/v1/user/stats/trips`                 | User trip statistics (note: singular "user") |
| `GET /api/v1/user/stats/countries`             | User country statistics              |
| `POST /api/v1/users/request-deletion`          | GDPR account deletion               |

> All endpoints use `req.user.id` derived from secure JWT session.



## User Flow: Profile System

This section outlines the expected behavior and backend dependencies for how users move through the Profile system — from account creation through profile enrichment, quiz completion, and return visits.

### 1. 🔚 New User Registration Flow

| Step | Action |
|------|--------|
| 1.1  | User signs up via Auth system (e.g. OAuth or email login) |
| 1.2  | `users` table entry is created with a generated id, handle, default loyalty tier, and `quizCompleted = null` |
| 1.3  | User is redirected to the Dream Quiz (`/quiz`) immediately after signup |

### 2. 🧠 Dream Quiz Completion Flow

See `QUIZ_SYSTEM.md` for full schema and logic.

At a high level:

1. Final call to `POST /api/v1/quiz/finalize-profile`
2. Populates all 8 enrichment tables (NOT the legacy `user_preferences` table):
   - `travel_dna_profiles`
   - `user_core_preferences`
   - `user_food_preferences`
   - `user_flight_preferences`
   - `user_contextual_overrides`
   - `user_mobility_accessibility`
   - `user_emotional_signature`
   - `user_travel_profile`
3. Updates `users.quizCompleted = [timestamp]`
4. **Creates starter trip draft** (see Trip Draft Bootstrapping below)

### 3. 🔓 Profile Unlock Logic

| Condition | Behavior |
|-----------|----------|
| `users.quizCompleted IS NOT NULL` | All Profile tabs become accessible |
| All enrichment tables populated | Tabs render fully enriched content |
| Tables are partially missing | Tabs show fallback or default states |
| Quiz not completed | Redirect user to `/quiz` until completion |

### 4. 🎯 Trip Draft Bootstrapping

**Problem**: New users exist in `users` table but have no corresponding entry in `trips` table, causing frontend to fail when detecting trip state.

**Solution**: Automatically create a placeholder trip record when quiz is finalized to establish baseline trip tracking.

#### Implementation in `/finalize-profile` endpoint:

```typescript
// After populating enrichment tables and updating users.quizCompleted
// Create starter trip draft to bootstrap trip tracking

const existingDraft = await db
  .select()
  .from(trips)
  .where(and(
    eq(trips.user_id, userId),
    eq(trips.status, 'draft')
  ))
  .limit(1);

if (existingDraft.length === 0) {
  await db.insert(trips).values({
    id: generateUUID(),
    user_id: userId,
    session_id: generateUUID(), // Required field
    name: null, // Will be filled when user starts planning
    destination: null, // Will be filled when user selects destination
    start_date: null,
    end_date: null,
    status: 'draft',
    currency: 'USD', // Required field with default
    travelers: 1, // Required field with default
    created_at: new Date(),
    updated_at: new Date()
  });
}
```

#### Benefits:

| Benefit | Description |
|---------|-------------|
| ✅ **UI State Tracking** | Frontend can now distinguish "0 trips" vs "no trip tracking" |
| ✅ **My Trips Tab** | Returns `[]` instead of 404, enabling proper empty states |
| ✅ **Analytics Funnel** | Track "quiz complete → trip planning started" conversion |
| ✅ **Personalization Ready** | Draft can pre-populate with travel DNA preferences |
| ✅ **Consistent UX** | Trip metadata and profile metadata always co-exist |

#### Frontend Behavior:

```typescript
// Frontend can now properly detect user state:
const response = await tripsAPI.getUserTrips();
// New user with starter draft: { success: true, data: [{ status: 'draft', name: null, ... }] }
// User with real trips: { success: true, data: [{ status: 'upcoming', name: 'Tokyo Adventure', ... }] }

// UI Logic:
const hasActiveTrips = trips.filter(t => t.status !== 'draft' || t.name !== null).length > 0;
// Shows empty states for users with only null draft
// Shows trip carousels for users with real trip data
```

### 5. 🔐 Persistency Across Sessions

| Event | Expected Result |
|-------|-----------------|
| User logs out + logs in again | JWT session restored → `req.user.id` available |
| Quiz previously completed | User lands on `/profile`, not `/quiz` |
| Quiz never completed | Redirect logic enforces `/quiz` start |
| Profile tab loads | Backend fetches data from enrichment tables and users |

### 6. 📂 Tab-Specific User Dependencies

| Tab | Requires |
|-----|----------|
| Overview | `travel_dna_profiles`, 8 enrichment tables (NOT `user_preferences`) |
| My Trips | `users.id` + starter trip draft (always exists after quiz) |
| Preferences | All 8 enrichment tables |
| Billing | `users.id`, `stripe_transactions` |
| Achievements | `achievement_unlocks` (NOT IMPLEMENTED - show empty state) |
| Companions | `user_companions` (NOT IMPLEMENTED - show empty state) |

### 7. 🚫 Failure Modes

| Scenario | System Behavior |
|----------|-----------------|
| `finalize-profile` fails | Profile not unlocked; `quizCompleted` remains null |
| Enrichment incomplete | Tabs show fallback UI or skeletons |
| JWT invalid or missing | All `/profile` API calls return `401 Unauthorized` |
| Invalid route hit | Errors logged via middleware, returned as `404` or `500` |

### 7. 🧪 QA Test Scenario (Happy Path)

1. Create a new user via frontend
2. Complete the full Dream Quiz
3. Confirm enrichment inserts in Neon
4. Visit `/profile` → all data loads
5. Log out and log back in
6. `/profile` remains unlocked with persistent data

---

## Backend Ownership Notes

* Enrichment tables are only populated via `/quiz/finalize-profile`
* User authentication must be enforced before any preferences/trips are returned
* All tab content depends on proper population of the 8 enrichment tables (NOT the legacy `user_preferences`)
* Quiz completion should toggle `users.quizCompleted = [timestamp]`
* Stripe webhooks must be idempotent and log to `stripe_webhooks`
* `trip_preferences` table is ONLY for per-trip overrides (has trip_id as primary key) - NOT for user preferences

---

## CRITICAL: Correct Database Schema

### ⚠️ Legacy Tables (DO NOT USE)
- `user_preferences` - 48-column legacy table, replaced by individual enrichment tables

### ✅ Correct User Preference Tables
The user preferences are stored in 8 separate tables:
1. `user_core_preferences` - Travel pace, budget, accommodation style
2. `user_food_preferences` - Dietary restrictions, likes/dislikes
3. `user_flight_preferences` - Seat preferences, airlines
4. `user_contextual_overrides` - Situational preferences
5. `user_mobility_accessibility` - Accessibility needs
6. `user_emotional_signature` - Emotional drivers for travel
7. `user_travel_profile` - Profile completeness, archetype info
8. `travel_dna_profiles` - Personality traits, confidence scores

### ⚠️ Common Misunderstandings
- `trip_preferences` is NOT for user preferences - it's for per-trip overrides only (has trip_id)
- `users.loyaltyTier` uses camelCase, NOT snake_case
- `achievement_unlocks` and `user_companions` tables do NOT exist yet

---

## Authentication & Security

All Profile endpoints require secure JWT authentication:

### JWT Token Requirements
- **Header Format**: `Authorization: Bearer <token>`
- **Token Source**: Obtained from auth endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`)
- **User Context**: Token provides `req.user.id` for all database operations
- **Validation**: Each request verifies token and checks user exists in database

### Authentication Error Responses
| Status | Code | Message | Cause |
|--------|------|---------|-------|
| `401` | `AUTH_TOKEN_MISSING` | Missing or invalid Authorization header | No Bearer token provided |
| `401` | `AUTH_TOKEN_INVALID` | Invalid or expired token | JWT verification failed |
| `401` | `AUTH_USER_NOT_FOUND` | User not found | Valid JWT but user deleted |
| `500` | `AUTH_ERROR` | Authentication failed | Internal auth system error |

---

## Error Response Standards

All Profile endpoints return consistent error structures for reliable frontend handling:

### Standard Error Format
```json
{
  "_error": "Human readable error message",
  "code": "MACHINE_READABLE_CODE",
  "status": 404
}
```

### Common Error Codes
| Code | Meaning | When It Occurs |
|------|---------|----------------|
| `NO_USER_ID` | Missing user authentication | JWT missing or invalid |
| `NO_PREFERENCES` | No preference data found | Quiz not completed |
| `FETCH_ERROR` | Database retrieval failed | Connection or query issues |
| `SAVE_ERROR` | Database write failed | Insert/update operation failed |
| `QUIZ_ERROR` | Quiz completion failed | Enrichment pipeline error |
| `SESSION_NOT_FOUND` | Quiz session invalid | Invalid session ID or ownership |
| `VALIDATION_ERROR` | Request data invalid | Zod schema validation failed |

---

## Data Dependencies & Prerequisites

### Profile Unlock Logic
The Profile system has strict data dependencies that must be satisfied:

**Quiz Completion Required:**
1. User must complete Dream Quiz via `POST /api/v1/quiz/finalize-profile`
2. Sets `users.quizCompleted = NOW() AT TIME ZONE 'UTC'`
3. Populates **all 8 enrichment tables** with comprehensive data
4. Without completion: most preference endpoints return empty data or 404

### Enrichment Table Population
Quiz finalization populates these critical tables:

| Table | Purpose | Key Data |
|-------|---------|----------|
| `travel_dna_profiles` | Personality & archetype | Primary/secondary archetype, trait scores, confidence |
| `user_core_preferences` | Core travel preferences | Budget tier, travel style, group size |
| `user_food_preferences` | Food & dining preferences | Dietary restrictions, cuisine interests, celebration foods |
| `user_flight_preferences` | Flight booking preferences | Airline loyalty, seat preferences, booking timing |
| `user_mobility_accessibility` | Accessibility needs | Mobility aids, accommodation requirements |
| `user_contextual_overrides` | Situational preferences | Context-specific travel adjustments |
| `user_emotional_signature` | Emotional drivers | Motivation patterns, emotional triggers |
| `user_travel_profile` | Travel behavior profile | Trip frequency, destination patterns, booking habits |

### Field Mapping Logic
Quiz responses map to database columns via intelligent field ID mapping:
- `"1.2_primary_goal"` → `primary_goal`
- `"3.1_airport_code"` → `airport_code`
- `"4.1_celebration_food"` → `celebrationFood`
- `"9.1_food_interest"` → `interests.food`

**Default Value Strategy:**
- Missing emotional drivers inferred from travel style responses
- Budget tier defaults calculated from spending preferences
- Activity weights derived from quiz response patterns

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 🔐 Authentication Failures
| Problem | Symptoms | Root Cause | Solution |
|---------|----------|------------|----------|
| No Bearer token | 401 `AUTH_TOKEN_MISSING` | Frontend not sending header | Add `Authorization: Bearer <token>` |
| Invalid JWT | 401 `AUTH_TOKEN_INVALID` | Token expired/corrupted | Refresh token via auth flow |
| User not found | 401 `AUTH_USER_NOT_FOUND` | User deleted after login | Re-authenticate user |

#### 📋 Preference Loading Failures
| Problem | Symptoms | Root Cause | Solution |
|---------|----------|------------|----------|
| Empty preferences | `{}` response | Quiz never completed | Complete Dream Quiz first |
| 404 on specific endpoints | `NO_PREFERENCES` error | Enrichment tables empty | Verify quiz finalization |
| 500 database errors | `FETCH_ERROR` code | Schema/connection issues | Check database logs |

#### 🎯 Quiz Completion Issues
| Problem | Symptoms | Root Cause | Solution |
|---------|----------|------------|----------|
| Finalization fails | 500 `QUIZ_ERROR` | Missing quiz responses | Ensure all quiz steps saved |
| Session not found | 404 `SESSION_NOT_FOUND` | Invalid session ID | Verify session ownership |
| DNA generation fails | 500 `DNA_GENERATION_FAILED` | Insufficient response data | Check required quiz fields |

#### 💾 Data Persistence Problems
| Problem | Symptoms | Root Cause | Solution |
|---------|----------|------------|----------|
| Preferences not saving | 500 `SAVE_ERROR` | Database constraints | Check field validation |
| Enrichment incomplete | Partial data in tables | Pipeline interruption | Re-run quiz finalization |
| Profile not unlocked | Quiz completed but no access | `users.quizCompleted` null | Verify user table update |

### Debug Workflow
1. **Check Authentication**: Verify JWT token validity and user existence
2. **Verify Quiz State**: Confirm `users.quizCompleted` timestamp exists
3. **Audit Enrichment**: Check all 8 enrichment tables have user data
4. **Test Endpoints**: Use source of truth API list to validate each endpoint
5. **Review Logs**: Check audit events for `QUIZ_COMPLETED` and error details

---

## Backend Implementation Notes

### Service Layer Architecture
- **User Preferences Service**: Handles CRUD operations for all preference data
- **Quiz Data Enrichment**: Maps quiz responses to enrichment table schemas
- **Travel DNA Generator**: Creates personality profiles from quiz responses
- **Audit Service**: Logs all user actions and system events

### Database Transaction Safety
- Quiz finalization uses database transactions for atomic operations
- Preference updates are logged with audit trails
- Failed operations rollback completely to prevent partial states

### Performance Considerations
- Preference endpoints cache enrichment data for optimal loading
- Quiz responses are validated before expensive DNA generation
- Database queries use indexed user ID lookups for speed

### Error Handling Strategy
- **Development**: Full error details and stack traces exposed
- **Production**: Sanitized error messages with internal details hidden
- **Logging**: All errors captured with request context and user metadata

---

## Frontend Component Mapping

This section provides the definitive mapping between backend data and frontend components for the ProfileV6 implementation.

### Component Architecture Overview

**Main Component**: `ProfileV6.tsx` (3,385 lines)  
**Architecture**: Monolithic with external component imports  
**Animation System**: Framer Motion throughout  
**State Management**: React Context + local state  

### Core Tab Components

#### 1. Overview Tab Components

| Component | Data Source | Backend Mapping | Required APIs |
|-----------|-------------|-----------------|---------------|
| `TravelDNASection` | Context: `travelDNA` | `travel_dna_profiles.*` | `GET /api/v1/user/preferences/travel-dna` |
| `ProfileCompletionProgress` | Context: `profile.completeness` | `user_travel_profile.profile_completeness` | `GET /api/v1/user/profile` |
| `WorldMap` | Context: `destinations[]` | `trips.destinations` + `user_travel_profile.visited_countries` | `GET /api/v1/trips` |
| `TripCarousels` | Context: `recommendations` | Trip recommendation engine data | `GET /api/v1/trips/recommendations` |
| `MemoryLane` | Context: `travelMemories` | `trips.photos` + `timeline_blocks.images` | `GET /api/v1/trips/memories` |

**Component Props Mapping**:
```typescript
// TravelDNASection
interface TravelDNAProps {
  primaryArchetype: travel_dna_profiles.primary_archetype_name;
  secondaryArchetype: travel_dna_profiles.secondary_archetype_name;
  confidence: travel_dna_profiles.confidence;
  traitScores: travel_dna_profiles.trait_scores; // JSON parse required
  summary: travel_dna_profiles.summary;
  emotionalDrivers: travel_dna_profiles.emotional_drivers; // Array
}
```

#### 2. My Trips Tab Components

| Component | Data Source | Backend Mapping | Required APIs |
|-----------|-------------|-----------------|---------------|
| Trip Statistics Dashboard | `tripStats` context | Backend aggregated statistics | `GET /api/v1/user/stats/trips` |
| Trip Cards | `trips[]` context | `trips.*` (timeline_blocks fetched separately) | `GET /api/v1/trips` |
| Trip Filtering | Query params + trip data | Backend filtering by status | `GET /api/v1/trips?status=upcoming` |
| `RateReviewModal` | Selected trip | `trips.rating`, `trips.review` | `PATCH /api/v1/trips/:id` |

**Component Props Mapping**:
```typescript
// Trip Cards
interface TripCardProps {
  id: trips.id;
  name: trips.name;  // Backend uses 'name' not 'title'
  destination: trips.destination;
  dates: trips.start_date + trips.end_date;
  status: trips.status;
  progress: calculated locally;
  budget: trips.budget;
  // coverImage: NOT AVAILABLE - use placeholder images
  rating?: trips.rating;  // For completed trips only
  review?: trips.review;  // For completed trips only
}

// Trip Statistics Response
interface TripStatsResponse {
  planned: { count: number; trips: Trip[] };    // includes "planned" and "upcoming"
  completed: { count: number; trips: Trip[] };
  drafts: { count: number; trips: Trip[] };
  total: number;
}
```

#### 3. Preferences Tab Components

| Section | Data Source | Backend Mapping | Required APIs |
|---------|-------------|-----------------|---------------|
| Flight Preferences | `preferences.flight` | `user_flight_preferences.*` | `GET /api/v1/user/preferences/flight` |
| Hotel Preferences | `preferences.core` | `user_core_preferences.accommodation_style` | `GET /api/v1/user/preferences/core` |
| Budget Preferences | `preferences.core` | `user_core_preferences.budget_tier` | `GET /api/v1/user/preferences/core` |
| Food Preferences | `preferences.food` | `user_food_preferences.*` | `GET /api/v1/user/preferences/food` |
| Accessibility | `preferences.mobility` | `user_mobility_accessibility.*` | `GET /api/v1/user/preferences/mobility` |
| AI Preferences | `preferences.ai` | Default values (table TBD) | `GET /api/v1/user/preferences/ai` |

**Current Issue**: Using `ExtendedPreferences` interface instead of backend schema
**Required Change**: Map to actual enrichment table structure

#### 4. Billing Tab Components

| Component | Data Source | Backend Mapping | Required APIs |
|-----------|-------------|-----------------|---------------|
| Current Plan Status | User subscription data | `stripe_transactions.plan_type` | `GET /api/v1/billing/history` |
| Pricing Plans Grid | Static pricing data | Stripe pricing configuration | `GET /api/v1/billing/plans` |
| Transaction History | Billing history | `stripe_transactions.*` | `GET /api/v1/billing/history` |
| Upgrade Flow | Stripe checkout | Stripe checkout session | `POST /api/v1/billing/create-checkout-session` |

#### 5. Companions Tab Components

| Component | Data Source | Backend Mapping | Required APIs |
|-----------|-------------|-----------------|---------------|
| `TravelCompanions` | Companions data | `user_companions.*` (future table) | `GET /api/v1/companions` |
| Invite Interface | Invitation system | `user_companions.invite_status` | `POST /api/v1/companions/invite` |

**Status**: Using demo data, needs backend table implementation

#### 6. Achievements Tab Components

| Component | Data Source | Backend Mapping | Required APIs |
|-----------|-------------|-----------------|---------------|
| `TrophyCase` | Achievements data | `achievement_unlocks.*` | `GET /api/v1/user/achievements` |
| Achievement Cards | Individual achievements | `achievement_unlocks.achievement_id` | Achievement metadata API |

### External Component Dependencies

#### Profile-Specific Components (from `/components/profile/`)

| Component | Purpose | Data Requirements | Status |
|-----------|---------|------------------|---------|
| `LockedProfile` | Quiz completion gate | `users.quizCompleted` | ✅ Working |
| `TravelDNASection` | Travel personality display | `travel_dna_profiles.*` | ✅ Working |
| `WorldMap` | Interactive travel map | `trips.destinations[]` | ✅ Working |
| `TripCarousels` | Trip recommendations | Trip recommendation data | ⚠️ Using demo data |
| `MemoryLane` | Travel memory gallery | `trips.photos`, `timeline_blocks.images` | ⚠️ Using demo data |
| `ProfileCompletionProgress` | Progress tracking | `user_travel_profile.profile_completeness` | ✅ Working |
| `TravelCompanions` | Companion management | `user_companions.*` | ⚠️ Using demo data |
| `TrophyCase` | Achievement showcase | `achievement_unlocks.*` | ⚠️ Using demo data |

### Data Flow & State Management

#### Context Integration
```typescript
const {
  profile,           // user_travel_profile.*
  travelDNA,         // travel_dna_profiles.*
  preferences,       // All user_*_preferences tables
  loyaltyStats,      // Aggregated loyalty program data
  tripStats,         // Aggregated trip statistics
  isLoading,         // Loading states
  updateAvatar       // Profile update functions
} = useUserProfile();
```

#### Local State Variables
```typescript
activeTab: TabType;                    // UI state
tripFilter: TripFilterType;            // trips.status filtering
selectedTrip: Trip | null;             // Selected trip for actions
showRateReviewModal: boolean;          // Modal visibility
backendPreferences: BackendPreferencesData; // ✅ Backend-aligned preferences
saveStatus: SaveStatusType;            // Manual save status
```

### API Endpoint Alignment Issues

#### ❌ Legacy Endpoints (Need Replacement)
```typescript
// Current (incorrect)
GET /api/user/profile-lite
GET /api/user/travel-dna-details  
GET /api/user/profile
POST /api/users/me/settings
GET /api/user/me/settings
```

#### ✅ Required Source of Truth Endpoints
```typescript
// Core Profile System
GET /api/v1/user/preferences/travel-dna
GET /api/v1/user/preferences/core
GET /api/v1/user/preferences/flight
GET /api/v1/user/preferences/food
GET /api/v1/user/preferences/mobility
GET /api/v1/user/preferences/ai

// Trips & Data
GET /api/v1/trips                    // Supports query params
GET /api/v1/trips?status=upcoming    // Filter by status
GET /api/v1/user/stats/trips         // Aggregated statistics
GET /api/v1/user/stats/countries     // Countries visited
POST /api/v1/trips
PUT /api/v1/trips/:id
DELETE /api/v1/trips/:id

// Billing
GET /api/v1/billing/history
POST /api/v1/billing/create-checkout-session

// Social Features
GET /api/v1/companions
POST /api/v1/companions/invite

// Achievements
GET /api/v1/user/achievements
POST /api/v1/user/achievements/unlock
```

### Component Data Transformation Requirements

#### JSON Field Parsing
```typescript
// travel_dna_profiles.trait_scores (jsonb → object)
const traitScores: Record<string, number> = JSON.parse(travelDNA.trait_scores);

// user_food_preferences.taste_graph (jsonb → object)  
const tasteGraph: TastePreferences = JSON.parse(foodPrefs.taste_graph);

// user_flight_preferences.airline_loyalty (jsonb → object)
const loyaltyPrograms: LoyaltyData = JSON.parse(flightPrefs.airline_loyalty);
```

#### Array Field Processing
```typescript
// travel_dna_profiles.emotional_drivers (text[] → string[])
const emotionalDrivers: string[] = travelDNA.emotional_drivers;

// user_food_preferences.dietary_restrictions (text[] → string[])
const restrictions: string[] = foodPrefs.dietary_restrictions;

// user_mobility_accessibility.accessibility_needs (text[] → string[])
const accessibilityNeeds: string[] = mobilityPrefs.accessibility_needs;
```

### Error Handling Integration

#### Standard Error Format Compliance
```typescript
// Current: Basic try/catch with toast notifications
// Required: Standard error format handling

interface ComponentErrorHandler {
  onAuthError: (error: {code: 'AUTH_TOKEN_MISSING' | 'AUTH_TOKEN_INVALID'}) => void;
  onDataError: (error: {code: 'NO_PREFERENCES' | 'FETCH_ERROR'}) => void;
  onQuizError: (error: {code: 'QUIZ_ERROR' | 'SESSION_NOT_FOUND'}) => void;
}
```

### Performance Optimizations

#### Loading Strategy
```typescript
// Immediate render priorities
1. Profile header (users.name, users.avatar_url)
2. Tab navigation (static)
3. Active tab skeleton (animated)

// Lazy loading priorities  
1. Travel DNA data (travel_dna_profiles.*)
2. Trip statistics (aggregated data)
3. Preference data (user_*_preferences.*)
4. Secondary tab data (on-demand)
```

#### Animation Performance
```typescript
// Framer Motion optimizations
- Page transitions: GPU-accelerated transforms
- Loading states: CSS-based animations
- Data visualization: Intersection Observer
- Interactive elements: debounced interactions
```

### Component Testing Requirements

#### Unit Test Coverage
```typescript
describe('ProfileV6 Components', () => {
  test('Tab switching functionality');
  test('API error handling with standard error codes');
  test('Preference form validation');
  test('Authentication state management');
  test('Data transformation (JSON/Array parsing)');
});
```

#### Integration Test Scenarios
```typescript
describe('Profile Integration', () => {
  test('End-to-end tab workflows');
  test('API endpoint alignment');
  test('Error recovery scenarios');
  test('Real-time data updates');
  test('Cross-component state management');
});
```

### Mobile Responsiveness

#### Component Adaptations
```typescript
// Responsive breakpoints
Mobile (< 768px): Single column, stacked tabs
Tablet (768px - 1024px): Adjusted grids, touch targets
Desktop (> 1024px): Full multi-column layout

// Touch interactions
Tab navigation: Touch-friendly tap targets
Trip cards: Swipe gestures for actions
Map interactions: Touch zoom/pan support
```

### Production Readiness Checklist

#### ✅ Ready for Production
- Tab switching logic
- Authentication flow
- Basic error handling
- Responsive design
- Animation performance
- Backend preferences alignment (completed)

#### ⚠️ Requires Backend Alignment
- API endpoint migration to `/api/v1/*` pattern
- Real trip data integration (remove demo data)
- Billing integration with Stripe
- Achievement system implementation
- Companion social features

#### 🔄 In Progress
- Standard error format adoption
- Performance optimizations
- Accessibility compliance
- Comprehensive testing

---

## Travel DNA Identity System

### Overview
The Travel DNA Identity system transforms quiz responses into personalized, horoscope-like travel identities that resonate emotionally with users.

### Key Components

1. **UserIdentityReveal Component** (`/src/components/profile/UserIdentityReveal.tsx`)
   - Displays personalized archetype information
   - Shows rarity percentage and confidence score
   - Provides "What This Means", "Superpowers", and "Growth Edges"
   - Animated reveal with sections for deeper exploration

2. **Archetype Narratives** (`/src/data/archetypeNarratives.ts`)
   - 25+ unique travel archetypes across 6 categories
   - Emotional, horoscope-like copy for each archetype
   - Visual themes and color schemes per category

3. **useArchetypeData Hook** (`/src/hooks/useArchetypeData.ts`)
   - Fetches travel DNA from `/api/v1/user/preferences/travel-dna`
   - Handles loading and error states
   - Processes backend response into frontend format

### Implementation in ProfileV6
- UserIdentityReveal appears at the top of the Overview tab
- Provides immediate emotional payoff after quiz completion
- ProfileCompletionProgress moved to bottom (less aggressive)

### Reference Documentation
See `TRAVEL_ARCHETYPES.md` for complete archetype definitions and backend/frontend alignment.

## Travel Identity API

### Endpoint
```
GET /api/v1/user/profile/identity
```

### Purpose
Returns the user's travel archetype, tagline, confidence score, rarity information, and top emotional motivators for display in the Travel Identity block on the Profile Overview tab.

### Authentication
- **Required**: Bearer token in Authorization header
- **Returns 401**: If no valid token provided

### Response Schema

#### Success Response (200)
```json
{
  "archetype": {
    "id": "balanced_story_collector",
    "label": "Balanced Story Collector",
    "tagline": "You travel for clarity, calm, and cinematic stillness.",
    "confidence": 92,
    "rarity": "Uncommon (4%)"
  },
  "motivators": ["belonging", "reflection", "freedom"]
}
```

#### Error Response (404)
```json
{
  "_error": "Identity data not found",
  "code": "IDENTITY_NOT_FOUND"
}
```

#### Error Response (401)
```json
{
  "_error": "Missing or invalid Authorization header",
  "code": "NO_USER_ID"
}
```

#### Error Response (500)
```json
{
  "_error": "Failed to fetch identity data",
  "code": "IDENTITY_FETCH_ERROR"
}
```

### Field Specifications

| Field | Type | Description | Example | Required |
|-------|------|-------------|---------|----------|
| `archetype.id` | string | Lowercase archetype identifier with underscores | "balanced_story_collector" | Yes |
| `archetype.label` | string | Human-readable archetype name | "Balanced Story Collector" | Yes |
| `archetype.tagline` | string | Personalized travel description | "You travel for clarity..." | Yes |
| `archetype.confidence` | number | Match confidence 0-100 | 92 | Yes |
| `archetype.rarity` | string | Pre-formatted rarity with percentage | "Uncommon (4%)" | Yes |
| `motivators` | string[] | Top 3 emotional drivers | ["belonging", "reflection", "freedom"] | Yes |

### Business Rules

1. **Quiz Completion Required**: Returns 404 if user hasn't completed Dream Quiz
2. **Motivators Limited**: Backend returns maximum 3 motivators, pre-sliced
3. **Rarity Tiers**: 
   - Legendary: <1% of travelers
   - Rare: <5% of travelers
   - Uncommon: <15% of travelers
   - Common: <30% of travelers
   - Very Common: >30% of travelers
4. **Confidence Score**: Integer 0-100, represents match quality
5. **All Fields Required**: No nullable fields in successful response

### Error Codes

| Code | HTTP Status | Meaning | Frontend Action |
|------|-------------|---------|-----------------|
| `NO_USER_ID` | 401 | Not authenticated | Redirect to login |
| `IDENTITY_NOT_FOUND` | 404 | Quiz not completed or data missing | Show quiz completion CTA |
| `IDENTITY_FETCH_ERROR` | 500 | Server error | Show error state with retry |

### Frontend Integration Requirements

1. **Position**: Top of Profile Overview tab, replacing or above TravelDNASection
2. **Cache Duration**: 5 minutes recommended (data updates with quiz retakes)
3. **Loading State**: Show skeleton matching component layout
4. **Error Handling**: Specific handling for each error code
5. **Mobile**: Responsive layout for all screen sizes
6. **Fallback**: Never show hardcoded archetype labels or data

### React Hook Example
```typescript
// hooks/useUserTravelIdentity.ts
import { useQuery } from '@tanstack/react-query';

export function useUserTravelIdentity() {
  return useQuery<TravelIdentity, TravelIdentityError>({
    queryKey: ['user', 'travel-identity'],
    queryFn: async () => {
      const response = await fetch('/api/v1/user/profile/identity', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return response.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### TypeScript Types
```typescript
export interface TravelIdentity {
  archetype: {
    id: string;
    label: string;
    tagline: string;
    confidence: number;
    rarity: string;
  };
  motivators: string[];
}

export interface TravelIdentityError {
  _error: string;
  code: 'NO_USER_ID' | 'IDENTITY_NOT_FOUND' | 'IDENTITY_FETCH_ERROR';
}
```

### Component Integration
The Travel Identity data should be displayed in a dedicated component at the top of the Overview tab:

```typescript
<ProfileOverviewTab>
  <TravelIdentityBlock />  {/* NEW - uses /api/v1/user/profile/identity */}
  <TravelDNASection />     {/* Existing - uses /api/v1/user/preferences/travel-dna */}
  <ProfileStats />
  <RecentTrips />
</ProfileOverviewTab>
```

### Backend Data Source
This endpoint aggregates data from:
- `travel_dna_profiles` table (archetype information)
- `user_emotional_signature` table (motivators)
- Archetype rarity calculations from quiz completion statistics

### Do NOT:
- Hardcode archetype labels or IDs
- Assume all fields are nullable
- Cache indefinitely (quiz retakes update data)
- Show component if quiz not completed
- Modify the pre-formatted rarity string

## Frontend Profile Header Implementation

### Overview
The Profile Header displays personalized user information fetched from the backend `/api/v1/user/profile` endpoint.

### Implementation Details

#### 1. **useUserIdentity Hook**
Location: `/src/hooks/useUserIdentity.ts`

```typescript
interface UserIdentity {
  display_name: string;
  handle: string;
  loyalty_tier: string;
  avatar_url: string | null;
}
```

**Features:**
- Fetches user profile data from `/api/v1/user/profile`
- Implements email username fallback logic
- Handles backend error codes (NO_USER_ID, PROFILE_NOT_FOUND, PROFILE_FETCH_ERROR)
- Requires authentication context

**Fallback Logic:**
- `display_name`: Falls back to email username (part before @)
- `handle`: Falls back to @{email_username}
- `loyalty_tier`: Falls back to "explorer"
- `avatar_url`: Returns null if not set (frontend shows placeholder)

#### 2. **ProfileHeader Component**
Location: `/src/components/profile/ProfileHeader.tsx`

**Features:**
- Displays user avatar with upload functionality
- Shows display name, @handle, and loyalty tier
- Tier-specific color badges:
  - Explorer: Blue (`bg-blue-100 text-blue-700`)
  - Adventurer: Purple (`bg-purple-100 text-purple-700`)
  - Voyager: Amber (`bg-amber-100 text-amber-700`)
  - Pioneer: Emerald (`bg-emerald-100 text-emerald-700`)
- Avatar upload on click (ready for backend implementation)
- Loading skeleton during data fetch

#### 3. **ProfileV6 Integration**
Location: `/src/pages/ProfileV6.tsx`

**Implementation:**
```typescript
const { user: userIdentity } = useUserIdentity();

// Display name with fallbacks
{userIdentity?.display_name || user?.name || 'Traveler'}

// Handle with fallbacks
@{userIdentity?.handle || user?.handle || 'explorer'}

// Loyalty tier with fallbacks
{userIdentity?.loyalty_tier || loyaltyStats?.tier || 'Explorer'} Member

// Avatar with fallbacks
src={userIdentity?.avatar_url || user?.avatar || '/default-avatar.png'}
```

### Frontend-Backend Alignment

#### ✅ Completed Alignments:
1. **Email Username Fallback** - Implemented in `useUserIdentity` hook
2. **Error Code Handling** - Captures backend error codes with proper types
3. **Trip Field Naming** - Verified using `name` not `title`
4. **JSON Field Parsing** - Backend sends pre-parsed JSON objects
5. **Authentication Headers** - Handled by axios interceptor
6. **Profile Unlock Logic** - Checks `quizCompleted` before showing content

#### 🔄 Avatar Upload (Future)
When backend implements `POST /api/v1/user/avatar`:
```typescript
const formData = new FormData();
formData.append('avatar', file);
await apiService.post('/api/v1/user/avatar', formData);
```

### Component Usage

#### Profile Page (Original)
```typescript
<ProfileHeader 
  quizCompleted={user?.quizCompleted}
  onRestartTour={() => setShowOnboarding(true)}
/>
```

#### ProfileV6 (Hybrid Implementation)
ProfileV6 uses BOTH approaches:

1. **Custom Hero Section** (top of page):
   - Animated destination image slideshow background
   - Animated gradient blobs
   - "Welcome back to VOYANCE" branding
   - Travel identity quote section
   - Animated stats display
   - Dark theme with white text

2. **ProfileHeader Component** (below hero, above tabs):
   ```typescript
   <ProfileHeader 
     quizCompleted={user?.quizCompleted}
     onRestartTour={() => setShowQuizWelcome(true)}
   />
   ```
   - Provides consistent user identity display
   - Handles avatar upload functionality
   - Shows loyalty tier with proper styling
   - Maintains UI consistency across the app

This hybrid approach provides the immersive V6 experience while maintaining component reusability and consistency.

## Last Updated

August 3, 2025

---

This document is the **canonical backend reference** for the Profile page. Any updates to table structure, enrichment flow, or routing logic should be reflected here immediately.