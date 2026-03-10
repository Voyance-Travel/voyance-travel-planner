# Neon → Lovable Cloud Migration Plan

> ## ✅ MIGRATION COMPLETE (January 2025)
> 
> **This document is now HISTORICAL REFERENCE ONLY.**
> 
> The migration from Neon PostgreSQL to Lovable Cloud has been completed.
> All data has been imported and verified. The system now runs entirely on Lovable Cloud.
> 
> **Current state:**
> - 33 tables in production (all with RLS enabled)
> - 2,250 destinations imported
> - 740 airports imported
> - All user data migrated
> - Neon edge function deprecated
> 
> For current architecture, see: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md)

---

## Original Executive Summary (Historical)

This document outlined the migration from Neon PostgreSQL to Lovable Cloud (Supabase).

**Migration Stats (Completed):**
- Total Neon Tables Analyzed: ~85
- Tables Migrated: 33 (with full data)
- Tables Merged/Consolidated: 17
- Tables Deprecated: ~50 (redundant)

---

## Phase 1: Core Reference Tables (Foundation)

These tables must be migrated first as other tables depend on them.

### 1.1 Destinations (2,228 rows) ✅ CREATED
```sql
-- Core reference table for all location-based features
-- All activities, attractions, trips reference this
```
**Status**: Schema created, awaiting data import

### 1.2 Airports (880 rows) ✅ CREATED
```sql
-- Flight search, home airport lookup
```
**Status**: Schema created, awaiting data import

### 1.3 Activities (15,886 rows) ✅ EXISTS
```sql
-- Things to do at destinations
-- Links to destination_id
```
**Status**: Schema exists, awaiting data import

### 1.4 Attractions (7,000 rows) ✅ EXISTS
```sql
-- Points of interest at destinations
-- Links to destination_id
```
**Status**: Schema exists, awaiting data import

---

## Phase 2: User Data Migration

### 2.1 Users → Profiles Mapping

Neon `users` table has 14 records (5 real users, 9 test users).

**Real Users to Migrate:**
| Email | Display Name | Travel DNA |
|-------|--------------|------------|
| ashtonlaurenn@gmail.com | Ashton Lightfoot | The Untethered Traveler |
| cameronblake08@gmail.com | Cameron Blake | restoration_seeker |
| 1cameronblake@gmail.com | Cameron Blake | beauty_curator |
| brchesky1@gmail.com | Robert Chesky | (incomplete) |

**Migration Strategy:**
- Real users will need to re-register via Supabase Auth
- Profile data (display_name, handle, travel_dna) will be imported to `profiles` table
- Preference data consolidated into `user_preferences` table

### 2.2 User Preferences Consolidation

**Neon Tables → Cloud `user_preferences`:**

| Neon Table | Fields to Migrate |
|------------|-------------------|
| user_core_preferences | planning_preference, travel_pace, budget_tier, accommodation_style |
| user_contextual_overrides | weather_preferences, climate_preferences, loyalty_programs |
| user_emotional_signature | emotional_drivers, travel_vibes, interests, travel_dna |
| user_flight_preferences | home_airport, seat_preference, preferred_airlines, direct_flights_only |
| user_food_preferences | dietary_restrictions, food_likes, food_dislikes |
| user_mobility_accessibility | mobility_level, accessibility_needs |

All these fields already exist in Cloud's `user_preferences` table!

---

## Phase 3: Trip & Itinerary Data

### 3.1 Trips (10 rows)
Merge Neon trips into Cloud's `trips` table.

### 3.2 Trip Activities (48 rows)
Rich activity data with photos, locations, booking info.
**Action**: Create new `trip_activities` table linked to trips.

### 3.3 Trip Itineraries (16 rows)
Day-by-day structure.
**Action**: Store in `trips.itinerary_data` JSON field (already exists).

---

## Phase 4: Content & Supporting Tables

### 4.1 Guides (6 rows)
Editorial travel guides.
**Action**: Create `guides` table.

### 4.2 Quiz Data (Already in Cloud)
- quiz_sessions (6 rows) - exists in Cloud
- quiz_responses (57 rows) - exists in Cloud
- travel_dna_profiles (4 rows) - exists in Cloud

**Action**: Import data directly.

---

## Phase 5: Cache & Analytics Tables (Schema Only)

These tables are empty but needed for functionality:

| Table | Purpose |
|-------|---------|
| search_cache | Cache flight/hotel API results (TTL: 4 hours) |
| prompt_cache | Cache LLM responses (TTL: 24 hours) |
| prompt_templates | Reusable LLM prompts |
| price_tracking | Price change alerts |
| manual_bookings | User-added reservations |
| notifications | User alerts |
| subscriptions | Billing status |
| stripe_products | Product catalog |
| stripe_transactions | Payment records |
| stripe_webhooks | Webhook logs |

---

## Data Import Strategy

### For Large Tables (>1000 rows)

Due to API limits, we'll use a bulk-import edge function:

```typescript
// supabase/functions/bulk-import/index.ts
// Processes CSV data in chunks
// Handles UUID preservation, JSON parsing
```

**Import Order:**
1. destinations (2,228 rows) - No dependencies
2. airports (880 rows) - No dependencies
3. activities (15,886 rows) - Depends on destinations
4. attractions (7,000 rows) - Depends on destinations

### For Small Tables (<100 rows)

Direct SQL INSERT via migration tool.

---

## Tables to DELETE

These tables are redundant, deprecated, or replaced by Cloud equivalents:

### Image Tables (Bad Data)
- destination_images
- activity_images
- image_cache

### Old Itinerary Architecture (Replaced by JSON)
- itinerary_cache
- itinerary_days
- itinerary_slots
- itinerary_snapshots
- itinerary_frontend_ready

### Redundant User Tables
- user_profiles (→ profiles)
- user_saved_trips (→ saved_items)
- user_feature_flags (→ plan_entitlements)

### Empty/Marketing Tables
- dream_match_cache
- drift_analysis_cache
- emotional_conflicts
- emotional_enhancements
- upgrade_flows
- trial_previews

### Duplicate Quiz Tables
- quiz_questions (in frontend code)
- quiz_answers (→ quiz_responses)
- quiz_sections (in frontend code)

---

## Post-Migration Checklist

- [ ] Verify all reference data imported (destinations, airports, activities, attractions)
- [ ] Verify user profiles created for real users
- [ ] Verify quiz data imported
- [ ] Verify trip data imported
- [ ] Update services to use Cloud instead of Neon
- [ ] Remove Neon API calls from codebase
- [ ] Test all features with Cloud data
- [ ] Delete Neon edge function
- [ ] Remove NEON_DATABASE_URL secret

---

## Schema Reference

### Cloud Tables After Migration

**Core Reference:**
- destinations
- airports
- activities
- attractions
- activity_catalog

**User Data:**
- profiles
- user_preferences
- user_roles
- user_usage

**Trip Data:**
- trips
- trip_activities (new)
- trip_collaborators

**Content:**
- guides (new)

**Quiz:**
- quiz_sessions
- quiz_responses
- travel_dna_profiles
- travel_dna_history

**Cache:**
- search_cache (new)
- prompt_cache (new)
- prompt_templates (new)

**Billing:**
- subscriptions (new)
- stripe_products (new)
- stripe_transactions (new)
- stripe_webhooks (new)
- plans
- plan_entitlements

**Social:**
- friendships
- saved_items

**System:**
- audit_logs
- feature_flags
- notifications (new)

---

## Migration Commands

### Import Destinations
```bash
# Via bulk-import edge function
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"table": "destinations", "rows": [...]}' \
  $SUPABASE_URL/functions/v1/bulk-import
```

### Import Activities (Chunked)
Due to size, import in batches of 500 rows.

---

## Success Criteria

1. **Data Integrity**: All row counts match Neon source
2. **Referential Integrity**: All foreign key relationships preserved
3. **Functionality**: All features work with Cloud data
4. **Performance**: Query times ≤ Neon performance
5. **Cost**: Neon subscription cancelled

---

*Document created: January 18, 2026*
*Status: In Progress*
