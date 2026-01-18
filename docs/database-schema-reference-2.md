# Database Schema Reference - SOURCE OF TRUTH

**Total Tables:** 60
**Total Columns:** 873

## Table of Contents

- [activities](#activities)
- [activity_catalog](#activity-catalog)
- [activity_images](#activity-images)
- [airports](#airports)
- [api_job_history](#api-job-history)
- [api_jobs](#api-jobs)
- [api_rate_limits](#api-rate-limits)
- [api_workers](#api-workers)
- [attraction_images](#attraction-images)
- [attractions](#attractions)
- [audit_logs](#audit-logs)
- [background_discovery_queue](#background-discovery-queue)
- [blocking_incidents](#blocking-incidents)
- [booking_links](#booking-links)
- [city_import_batches](#city-import-batches)
- [city_import_mapping](#city-import-mapping)
- [city_import_queue](#city-import-queue)
- [destination_enrichment_status](#destination-enrichment-status)
- [destination_generation_stats](#destination-generation-stats)
- [destination_images](#destination-images)
- [destinations](#destinations)
- [dream_match_cache](#dream-match-cache)
- [email_queue](#email-queue)
- [emotional_tags](#emotional-tags)
- [enrichment_queue](#enrichment-queue)
- [feature_flags](#feature-flags)
- [guides](#guides)
- [imageasset](#imageasset)
- [import_status](#import-status)
- [manual_bookings](#manual-bookings)
- [meal_plans](#meal-plans)
- [must_haves](#must-haves)
- [notifications](#notifications)
- [quiz_responses](#quiz-responses)
- [quiz_sessions](#quiz-sessions)
- [rate_limiting](#rate-limiting)
- [reviews](#reviews)
- [save_trip](#save-trip)
- [scraper_health_reports](#scraper-health-reports)
- [seeding_operations](#seeding-operations)
- [seeding_pipeline_stages](#seeding-pipeline-stages)
- [seeding_progress](#seeding-progress)
- [seeding_runs](#seeding-runs)
- [stripe_transactions](#stripe-transactions)
- [stripe_webhooks](#stripe-webhooks)
- [timeline_blocks](#timeline-blocks)
- [travel_dna_history](#travel-dna-history)
- [travel_dna_profiles](#travel-dna-profiles)
- [travel_times](#travel-times)
- [trip_preferences](#trip-preferences)
- [trips](#trips)
- [user_contextual_overrides](#user-contextual-overrides)
- [user_core_preferences](#user-core-preferences)
- [user_emotional_signature](#user-emotional-signature)
- [user_flight_preferences](#user-flight-preferences)
- [user_food_preferences](#user-food-preferences)
- [user_mobility_accessibility](#user-mobility-accessibility)
- [user_preferences](#user-preferences)
- [user_travel_profile](#user-travel-profile)
- [users](#users)

---

## activities

**Columns:** 19

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `destination_id` | `uuid` | ✗ | `-` |
| `name` | `character varying` | ✗ | `-` |
| `description` | `text` | ✓ | `-` |
| `category` | `character varying` | ✓ | `-` |
| `duration_minutes` | `integer` | ✓ | `-` |
| `price_range` | `jsonb` | ✓ | `-` |
| `booking_required` | `boolean` | ✓ | `-` |
| `booking_url` | `text` | ✓ | `-` |
| `best_times` | `jsonb` | ✓ | `-` |
| `crowd_levels` | `jsonb` | ✓ | `-` |
| `coordinates` | `jsonb` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `updated_at` | `timestamp with time zone` | ✓ | `now()` |
| `google_place_id` | `character varying` | ✓ | `-` |
| `accessibility_info` | `jsonb` | ✓ | `-` |
| `transport_options` | `jsonb` | ✓ | `-` |
| `accessibility` | `jsonb` | ✓ | `-` |
| `catalog_id` | `uuid` | ✓ | `-` |

## activity_catalog

**Columns:** 12

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `destination_id` | `uuid` | ✗ | `-` |
| `title` | `text` | ✗ | `-` |
| `description` | `text` | ✓ | `-` |
| `category` | `text` | ✓ | `-` |
| `cost_usd` | `numeric` | ✓ | `-` |
| `estimated_duration_hours` | `numeric` | ✓ | `-` |
| `location` | `jsonb` | ✓ | `'{}'::jsonb` |
| `ai_generated` | `boolean` | ✓ | `true` |
| `source` | `text` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `-` |

## activity_images

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `activity_id` | `uuid` | ✗ | `-` |
| `url` | `text` | ✗ | `-` |
| `source` | `character varying` | ✓ | `-` |
| `attribution` | `text` | ✓ | `-` |
| `is_primary` | `boolean` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `width` | `integer` | ✓ | `-` |
| `height` | `integer` | ✓ | `-` |
| `photo_reference` | `character varying` | ✓ | `-` |

## airports

**Columns:** 11

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `code` | `character varying` | ✗ | `-` |
| `name` | `character varying` | ✗ | `-` |
| `type` | `character varying` | ✓ | `-` |
| `city` | `character varying` | ✓ | `-` |
| `country` | `character varying` | ✓ | `-` |
| `latitude` | `numeric` | ✓ | `-` |
| `longitude` | `numeric` | ✓ | `-` |
| `distance_km` | `numeric` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## api_job_history

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `job_id` | `uuid` | ✗ | `-` |
| `job_type` | `character varying` | ✗ | `-` |
| `api_name` | `character varying` | ✓ | `-` |
| `queue_time_ms` | `integer` | ✓ | `-` |
| `processing_time_ms` | `integer` | ✓ | `-` |
| `total_time_ms` | `integer` | ✓ | `-` |
| `status` | `character varying` | ✗ | `-` |
| `attempts` | `integer` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✗ | `now()` |

## api_jobs

**Columns:** 18

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `job_type` | `character varying` | ✗ | `-` |
| `status` | `character varying` | ✗ | `'pending'::character varying` |
| `priority` | `integer` | ✗ | `5` |
| `payload` | `jsonb` | ✗ | `-` |
| `result` | `jsonb` | ✓ | `-` |
| `context` | `jsonb` | ✓ | `'{}'::jsonb` |
| `attempts` | `integer` | ✗ | `-` |
| `max_attempts` | `integer` | ✗ | `3` |
| `retry_after` | `timestamp without time zone` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✗ | `now()` |
| `started_at` | `timestamp without time zone` | ✓ | `-` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `failed_at` | `timestamp without time zone` | ✓ | `-` |
| `last_error` | `text` | ✓ | `-` |
| `error_count` | `integer` | ✓ | `-` |
| `api_name` | `character varying` | ✓ | `-` |
| `rate_limit_group` | `character varying` | ✓ | `-` |

## api_rate_limits

**Columns:** 14

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `api_name` | `character varying` | ✗ | `-` |
| `rate_limit_group` | `character varying` | ✓ | `-` |
| `max_requests_per_minute` | `integer` | ✗ | `-` |
| `max_requests_per_hour` | `integer` | ✓ | `-` |
| `max_requests_per_day` | `integer` | ✓ | `-` |
| `requests_this_minute` | `integer` | ✓ | `-` |
| `requests_this_hour` | `integer` | ✓ | `-` |
| `requests_this_day` | `integer` | ✓ | `-` |
| `minute_reset_at` | `timestamp without time zone` | ✗ | `(now() + '00:01:00'::interval)` |
| `hour_reset_at` | `timestamp without time zone` | ✗ | `(now() + '01:00:00'::interval)` |
| `day_reset_at` | `timestamp without time zone` | ✗ | `(now() + '1 day'::interval)` |
| `last_rate_limit_hit` | `timestamp without time zone` | ✓ | `-` |
| `rate_limit_hits_today` | `integer` | ✓ | `-` |

## api_workers

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `worker_name` | `character varying` | ✗ | `-` |
| `worker_type` | `character varying` | ✗ | `-` |
| `status` | `character varying` | ✗ | `'active'::character varying` |
| `current_job_id` | `uuid` | ✓ | `-` |
| `jobs_processed` | `integer` | ✓ | `-` |
| `jobs_failed` | `integer` | ✓ | `-` |
| `last_heartbeat` | `timestamp without time zone` | ✗ | `now()` |
| `started_at` | `timestamp without time zone` | ✗ | `now()` |
| `config` | `jsonb` | ✓ | `'{}'::jsonb` |

## attraction_images

**Columns:** 7

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `attraction_id` | `uuid` | ✓ | `-` |
| `image_url` | `text` | ✗ | `-` |
| `source` | `text` | ✗ | `-` |
| `is_primary` | `boolean` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## attractions

**Columns:** 18

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `destination_id` | `uuid` | ✓ | `-` |
| `name` | `text` | ✗ | `-` |
| `description` | `text` | ✓ | `-` |
| `address` | `text` | ✓ | `-` |
| `latitude` | `double precision` | ✓ | `-` |
| `longitude` | `double precision` | ✓ | `-` |
| `category` | `text` | ✓ | `-` |
| `subcategory` | `text` | ✓ | `-` |
| `visit_duration_mins` | `integer` | ✓ | `60` |
| `price_range` | `text` | ✓ | `-` |
| `opening_hours` | `jsonb` | ✓ | `-` |
| `peak_hours` | `jsonb` | ✓ | `-` |
| `crowd_patterns` | `jsonb` | ✓ | `-` |
| `average_rating` | `double precision` | ✓ | `-` |
| `tags` | `ARRAY` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## audit_logs

**Columns:** 7

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `text` | ✗ | `-` |
| `action` | `text` | ✗ | `-` |
| `target` | `text` | ✓ | `-` |
| `metadata` | `jsonb` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `action_type` | `text` | ✓ | `'general'::text` |

## background_discovery_queue

**Columns:** 13

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `job_type` | `text` | ✗ | `-` |
| `target_type` | `text` | ✗ | `-` |
| `target_id` | `text` | ✗ | `-` |
| `payload` | `jsonb` | ✓ | `-` |
| `status` | `text` | ✓ | `'queued'::text` |
| `attempts` | `text` | ✓ | `'0'::text` |
| `last_error` | `text` | ✓ | `-` |
| `scheduled_at` | `timestamp without time zone` | ✓ | `now()` |
| `started_at` | `timestamp without time zone` | ✓ | `-` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## blocking_incidents

**Columns:** 6

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `integer` | ✗ | `nextval('blocking_incidents_id_seq'::regclass)` |
| `service_name` | `character varying` | ✓ | `-` |
| `incident_time` | `timestamp without time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `resolution_time` | `timestamp without time zone` | ✓ | `-` |
| `status` | `character varying` | ✓ | `-` |
| `details` | `jsonb` | ✓ | `-` |

## booking_links

**Columns:** 8

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `trip_id` | `uuid` | ✗ | `-` |
| `booking_type` | `text` | ✗ | `-` |
| `confirmation_url` | `text` | ✗ | `-` |
| `vendor_name` | `text` | ✓ | `-` |
| `notes` | `text` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## city_import_batches

**Columns:** 11

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `batch_name` | `character varying` | ✗ | `-` |
| `description` | `text` | ✓ | `-` |
| `city_count` | `integer` | ✓ | `-` |
| `completed_count` | `integer` | ✓ | `-` |
| `status` | `character varying` | ✓ | `'pending'::character varying` |
| `started_at` | `timestamp with time zone` | ✓ | `-` |
| `completed_at` | `timestamp with time zone` | ✓ | `-` |
| `error_message` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `updated_at` | `timestamp with time zone` | ✓ | `now()` |

## city_import_mapping

**Columns:** 3

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `batch_id` | `uuid` | ✗ | `-` |
| `queue_id` | `uuid` | ✗ | `-` |

## city_import_queue

**Columns:** 15

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `city` | `character varying` | ✗ | `-` |
| `country` | `character varying` | ✗ | `-` |
| `tier` | `integer` | ✗ | `-` |
| `priority` | `integer` | ✗ | `-` |
| `attractions_target` | `integer` | ✗ | `-` |
| `coverage_level` | `character varying` | ✗ | `-` |
| `status` | `character varying` | ✓ | `'pending'::character varying` |
| `started_at` | `timestamp with time zone` | ✓ | `-` |
| `completed_at` | `timestamp with time zone` | ✓ | `-` |
| `error_message` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `updated_at` | `timestamp with time zone` | ✓ | `now()` |
| `region` | `character varying` | ✓ | `-` |
| `batch_id` | `uuid` | ✓ | `-` |

## destination_enrichment_status

**Columns:** 8

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `destination_id` | `uuid` | ✗ | `-` |
| `enrichment_type` | `character varying` | ✗ | `-` |
| `status` | `character varying` | ✗ | `'pending'::character varying` |
| `attempts` | `integer` | ✓ | `-` |
| `last_attempt` | `timestamp without time zone` | ✓ | `-` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `error_message` | `text` | ✓ | `-` |

## destination_generation_stats

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `city` | `character varying` | ✗ | `-` |
| `country` | `character varying` | ✗ | `-` |
| `destinations_count` | `integer` | ✗ | `-` |
| `activities_count` | `integer` | ✗ | `-` |
| `images_count` | `integer` | ✗ | `-` |
| `reviews_count` | `integer` | ✗ | `-` |
| `attractions_coverage` | `numeric` | ✓ | `-` |
| `generation_time_seconds` | `integer` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |

## destination_images

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `destination_id` | `uuid` | ✗ | `-` |
| `image_url` | `text` | ✗ | `-` |
| `source` | `text` | ✗ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |
| `is_primary` | `boolean` | ✓ | `-` |
| `confidence_score` | `double precision` | ✓ | `-` |
| `alt_text` | `text` | ✓ | `-` |
| `is_hero` | `boolean` | ✓ | `-` |

## destinations

**Columns:** 38

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `city` | `text` | ✗ | `-` |
| `country` | `text` | ✗ | `-` |
| `region` | `text` | ✗ | `-` |
| `timezone` | `text` | ✗ | `-` |
| `currency_code` | `text` | ✗ | `-` |
| `description` | `text` | ✗ | `-` |
| `temperature_range` | `text` | ✗ | `-` |
| `seasonality` | `text` | ✗ | `-` |
| `best_time_to_visit` | `text` | ✗ | `-` |
| `cost_tier` | `text` | ✗ | `-` |
| `known_for` | `ARRAY` | ✗ | `'{}'::text[]` |
| `points_of_interest` | `ARRAY` | ✓ | `-` |
| `stock_image_url` | `text` | ✗ | `'/images/default-placeholder.jpg'::text` |
| `featured` | `boolean` | ✗ | `-` |
| `tier` | `text` | ✗ | `'STANDARD'::text` |
| `alternative_names` | `ARRAY` | ✓ | `-` |
| `safe_search_keywords` | `ARRAY` | ✓ | `-` |
| `default_transport_modes` | `ARRAY` | ✓ | `-` |
| `dynamic_weather` | `jsonb` | ✓ | `-` |
| `dynamic_currency_conversion` | `numeric` | ✓ | `-` |
| `seasonal_events` | `jsonb` | ✓ | `-` |
| `last_content_update` | `timestamp without time zone` | ✓ | `-` |
| `last_weather_update` | `timestamp without time zone` | ✓ | `-` |
| `last_currency_update` | `timestamp without time zone` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✗ | `now()` |
| `updated_at` | `timestamp without time zone` | ✗ | `now()` |
| `population` | `bigint` | ✓ | `-` |
| `tags` | `ARRAY` | ✓ | `'{}'::text[]` |
| `google_place_id` | `character varying` | ✓ | `-` |
| `airport_codes` | `jsonb` | ✓ | `-` |
| `currency_data` | `jsonb` | ✓ | `-` |
| `weather_data` | `jsonb` | ✓ | `-` |
| `enrichment_status` | `jsonb` | ✓ | `'{}'::jsonb` |
| `last_enriched` | `timestamp without time zone` | ✓ | `-` |
| `enrichment_priority` | `integer` | ✓ | `-` |
| `coordinates` | `jsonb` | ✓ | `'{"lat": 0, "lng": 0}'::jsonb` |
| `airport_lookup_codes` | `character varying` | ✓ | `-` |

## dream_match_cache

**Columns:** 7

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `quiz_input_json` | `jsonb` | ✗ | `-` |
| `match_result_json` | `jsonb` | ✓ | `-` |
| `confidence_score` | `real` | ✓ | `-` |
| `quiz_timestamp` | `timestamp without time zone` | ✓ | `now()` |
| `expires_at` | `timestamp without time zone` | ✓ | `-` |

## email_queue

**Columns:** 13

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `notification_id` | `uuid` | ✗ | `-` |
| `user_id` | `uuid` | ✗ | `-` |
| `to` | `text` | ✗ | `-` |
| `subject` | `text` | ✗ | `-` |
| `template_id` | `text` | ✗ | `-` |
| `payload` | `jsonb` | ✓ | `-` |
| `status` | `USER-DEFINED` | ✗ | `'queued'::email_status` |
| `retry_count` | `integer` | ✓ | `-` |
| `last_attempt_at` | `timestamp without time zone` | ✓ | `-` |
| `sent_at` | `timestamp without time zone` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## emotional_tags

**Columns:** 9

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `trip_id` | `uuid` | ✗ | `-` |
| `day` | `text` | ✗ | `-` |
| `label` | `text` | ✗ | `-` |
| `notes` | `text` | ✓ | `-` |
| `ai_generated` | `boolean` | ✓ | `true` |
| `user_modified` | `boolean` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## enrichment_queue

**Columns:** 11

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `destination_id` | `uuid` | ✗ | `-` |
| `enrichment_type` | `character varying` | ✗ | `-` |
| `priority` | `integer` | ✓ | `5` |
| `data_source` | `character varying` | ✓ | `-` |
| `payload` | `jsonb` | ✓ | `-` |
| `status` | `character varying` | ✓ | `'pending'::character varying` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `processed_at` | `timestamp without time zone` | ✓ | `-` |
| `result` | `jsonb` | ✓ | `-` |
| `error_message` | `text` | ✓ | `-` |

## feature_flags

**Columns:** 6

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `flag` | `text` | ✗ | `-` |
| `enabled` | `boolean` | ✗ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `updated_at` | `timestamp with time zone` | ✓ | `now()` |

## guides

**Columns:** 17

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `slug` | `character varying` | ✗ | `-` |
| `title` | `character varying` | ✗ | `-` |
| `subtitle` | `text` | ✓ | `-` |
| `author` | `character varying` | ✓ | `'Voyance Editorial Team'::character varying` |
| `image_url` | `text` | ✗ | `-` |
| `excerpt` | `text` | ✗ | `-` |
| `content` | `jsonb` | ✗ | `-` |
| `category` | `character varying` | ✓ | `-` |
| `reading_time` | `integer` | ✓ | `5` |
| `destination_city` | `character varying` | ✓ | `-` |
| `destination_country` | `character varying` | ✓ | `-` |
| `tags` | `ARRAY` | ✓ | `'{}'::text[]` |
| `featured` | `boolean` | ✓ | `-` |
| `published` | `boolean` | ✓ | `true` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## imageasset

**Columns:** 4

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `integer` | ✗ | `nextval('imageasset_id_seq'::regclass)` |
| `key` | `character varying` | ✗ | `-` |
| `url` | `text` | ✗ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |

## import_status

**Columns:** 6

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `batch_name` | `text` | ✗ | `-` |
| `started_at` | `timestamp with time zone` | ✓ | `now()` |
| `completed_at` | `timestamp with time zone` | ✓ | `-` |
| `records_processed` | `integer` | ✓ | `-` |
| `records_failed` | `integer` | ✓ | `-` |
| `last_error` | `text` | ✓ | `-` |

## manual_bookings

**Columns:** 12

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `trip_id` | `uuid` | ✗ | `-` |
| `booking_type` | `text` | ✗ | `-` |
| `vendor_name` | `text` | ✗ | `-` |
| `confirmation_code` | `text` | ✓ | `-` |
| `start_date` | `text` | ✗ | `-` |
| `end_date` | `text` | ✓ | `-` |
| `notes` | `text` | ✓ | `-` |
| `ai_generated` | `boolean` | ✗ | `true` |
| `user_modified` | `boolean` | ✗ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## meal_plans

**Columns:** 14

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `trip_id` | `uuid` | ✗ | `-` |
| `plan_type` | `text` | ✗ | `-` |
| `restaurant_name` | `text` | ✓ | `-` |
| `cuisine` | `text` | ✓ | `-` |
| `price_per_person` | `jsonb` | ✓ | `'{}'::jsonb` |
| `dietary_restrictions` | `jsonb` | ✓ | `'[]'::jsonb` |
| `notes` | `text` | ✓ | `-` |
| `start_date` | `text` | ✗ | `-` |
| `end_date` | `text` | ✗ | `-` |
| `source` | `text` | ✓ | `'manual'::text` |
| `ai_generated` | `jsonb` | ✓ | `'{}'::jsonb` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## must_haves

**Columns:** 8

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `trip_id` | `uuid` | ✗ | `-` |
| `label` | `text` | ✗ | `-` |
| `notes` | `text` | ✓ | `-` |
| `ai_generated` | `boolean` | ✗ | `true` |
| `user_modified` | `boolean` | ✗ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## notifications

**Columns:** 9

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `trip_id` | `uuid` | ✓ | `-` |
| `user_id` | `uuid` | ✗ | `-` |
| `type` | `text` | ✗ | `-` |
| `payload` | `text` | ✓ | `-` |
| `sent` | `boolean` | ✓ | `-` |
| `channel` | `text` | ✓ | `'email'::text` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## quiz_responses

**Columns:** 12

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `session_id` | `uuid` | ✗ | `-` |
| `quiz_version` | `text` | ✓ | `'v3'::text` |
| `field_id` | `text` | ✗ | `-` |
| `field_type` | `text` | ✗ | `-` |
| `answer_value` | `text` | ✗ | `-` |
| `display_label` | `text` | ✓ | `-` |
| `step_id` | `text` | ✓ | `-` |
| `question_prompt` | `text` | ✓ | `-` |
| `response_order` | `integer` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## quiz_sessions

**Columns:** 19

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `quiz_version` | `text` | ✗ | `'v3'::text` |
| `started_at` | `timestamp without time zone` | ✓ | `now()` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `last_activity_at` | `timestamp without time zone` | ✓ | `now()` |
| `current_step` | `integer` | ✓ | `1` |
| `total_steps` | `integer` | ✓ | `11` |
| `completion_percentage` | `integer` | ✓ | `-` |
| `status` | `text` | ✓ | `'in_progress'::text` |
| `user_agent` | `text` | ✓ | `-` |
| `ip_address` | `text` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |
| `completed_percentage` | `integer` | ✓ | `-` |
| `device_type` | `text` | ✓ | `-` |
| `browser_name` | `text` | ✓ | `-` |
| `questions_answered` | `integer` | ✓ | `-` |
| `is_complete` | `boolean` | ✓ | `-` |

## rate_limiting

**Columns:** 6

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `integer` | ✗ | `nextval('rate_limiting_id_seq'::regclass)` |
| `service_name` | `character varying` | ✓ | `-` |
| `timestamp` | `timestamp without time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `requests_count` | `integer` | ✓ | `-` |
| `limit_count` | `integer` | ✓ | `-` |
| `percentage` | `double precision` | ✓ | `-` |

## reviews

**Columns:** 11

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `target_type` | `character varying` | ✗ | `-` |
| `target_id` | `uuid` | ✗ | `-` |
| `source` | `character varying` | ✗ | `-` |
| `rating` | `numeric` | ✗ | `-` |
| `review_text` | `text` | ✓ | `-` |
| `reviewer_name` | `character varying` | ✓ | `-` |
| `review_date` | `date` | ✓ | `-` |
| `helpful_count` | `integer` | ✓ | `-` |
| `source_url` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |

## save_trip

**Columns:** 6

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `text` | ✗ | `-` |
| `user_id` | `text` | ✗ | `-` |
| `trip_details` | `text` | ✗ | `-` |
| `is_unlocked` | `boolean` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `updated_at` | `timestamp with time zone` | ✓ | `now()` |

## scraper_health_reports

**Columns:** 11

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `integer` | ✗ | `nextval('scraper_health_reports_id_seq'::regclass)` |
| `timestamp` | `timestamp without time zone` | ✗ | `now()` |
| `total_operations_24h` | `integer` | ✓ | `-` |
| `successful_operations_24h` | `integer` | ✓ | `-` |
| `failed_operations_24h` | `integer` | ✓ | `-` |
| `reviews_retrieved_24h` | `integer` | ✓ | `-` |
| `avg_duration_seconds` | `integer` | ✓ | `-` |
| `blocked_sources` | `jsonb` | ✓ | `'{}'::jsonb` |
| `api_key_health` | `jsonb` | ✓ | `'{}'::jsonb` |
| `proxy_health` | `jsonb` | ✓ | `'{}'::jsonb` |
| `report_data` | `jsonb` | ✓ | `'{}'::jsonb` |

## seeding_operations

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `operation_type` | `character varying` | ✗ | `-` |
| `description` | `text` | ✓ | `-` |
| `status` | `character varying` | ✗ | `-` |
| `items_processed` | `integer` | ✓ | `-` |
| `items_total` | `integer` | ✓ | `-` |
| `error_message` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `started_at` | `timestamp with time zone` | ✓ | `-` |
| `completed_at` | `timestamp with time zone` | ✓ | `-` |

## seeding_pipeline_stages

**Columns:** 12

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `run_id` | `uuid` | ✗ | `-` |
| `stage_name` | `character varying` | ✗ | `-` |
| `stage_order` | `integer` | ✗ | `-` |
| `status` | `character varying` | ✗ | `'pending'::character varying` |
| `depends_on` | `ARRAY` | ✓ | `-` |
| `config` | `jsonb` | ✓ | `'{}'::jsonb` |
| `total_items` | `integer` | ✓ | `-` |
| `completed_items` | `integer` | ✓ | `-` |
| `started_at` | `timestamp without time zone` | ✓ | `-` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `estimated_duration_seconds` | `integer` | ✓ | `-` |

## seeding_progress

**Columns:** 21

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `run_id` | `uuid` | ✗ | `-` |
| `entity_type` | `character varying` | ✗ | `-` |
| `entity_id` | `character varying` | ✗ | `-` |
| `entity_data` | `jsonb` | ✓ | `-` |
| `status` | `character varying` | ✗ | `'pending'::character varying` |
| `progress_percentage` | `integer` | ✓ | `-` |
| `parent_type` | `character varying` | ✓ | `-` |
| `parent_id` | `character varying` | ✓ | `-` |
| `attempts` | `integer` | ✓ | `-` |
| `max_attempts` | `integer` | ✓ | `3` |
| `last_attempt_at` | `timestamp without time zone` | ✓ | `-` |
| `next_retry_at` | `timestamp without time zone` | ✓ | `-` |
| `processing_time_ms` | `integer` | ✓ | `-` |
| `items_created` | `integer` | ✓ | `-` |
| `api_calls_made` | `integer` | ✓ | `-` |
| `last_error` | `text` | ✓ | `-` |
| `error_count` | `integer` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✗ | `now()` |
| `started_at` | `timestamp without time zone` | ✓ | `-` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |

## seeding_runs

**Columns:** 28

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `name` | `character varying` | ✗ | `-` |
| `status` | `character varying` | ✗ | `'pending'::character varying` |
| `run_type` | `character varying` | ✗ | `'full'::character varying` |
| `config` | `jsonb` | ✗ | `'{}'::jsonb` |
| `target_countries` | `ARRAY` | ✓ | `-` |
| `target_cities` | `ARRAY` | ✓ | `-` |
| `total_countries` | `integer` | ✓ | `-` |
| `completed_countries` | `integer` | ✓ | `-` |
| `total_cities` | `integer` | ✓ | `-` |
| `completed_cities` | `integer` | ✓ | `-` |
| `total_destinations` | `integer` | ✓ | `-` |
| `completed_destinations` | `integer` | ✓ | `-` |
| `total_activities` | `integer` | ✓ | `-` |
| `completed_activities` | `integer` | ✓ | `-` |
| `peak_workers` | `integer` | ✓ | `-` |
| `peak_memory_mb` | `integer` | ✓ | `-` |
| `total_api_calls` | `integer` | ✓ | `-` |
| `failed_api_calls` | `integer` | ✓ | `-` |
| `started_at` | `timestamp without time zone` | ✓ | `-` |
| `paused_at` | `timestamp without time zone` | ✓ | `-` |
| `resumed_at` | `timestamp without time zone` | ✓ | `-` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `estimated_completion` | `timestamp without time zone` | ✓ | `-` |
| `total_runtime_seconds` | `integer` | ✓ | `-` |
| `error_count` | `integer` | ✓ | `-` |
| `last_error` | `text` | ✓ | `-` |
| `last_error_at` | `timestamp without time zone` | ✓ | `-` |

## stripe_transactions

**Columns:** 13

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `text` | ✗ | `-` |
| `session_id` | `text` | ✗ | `-` |
| `payment_intent_id` | `text` | ✓ | `-` |
| `price_id` | `text` | ✗ | `-` |
| `status` | `text` | ✗ | `-` |
| `amount` | `text` | ✗ | `-` |
| `currency` | `text` | ✗ | `-` |
| `metadata` | `jsonb` | ✓ | `-` |
| `is_refunded` | `boolean` | ✗ | `-` |
| `refunded_at` | `timestamp with time zone` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✗ | `now()` |
| `updated_at` | `timestamp with time zone` | ✗ | `now()` |

## stripe_webhooks

**Columns:** 5

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `text` | ✗ | `-` |
| `type` | `text` | ✗ | `-` |
| `user_id` | `text` | ✓ | `-` |
| `processed` | `boolean` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |

## timeline_blocks

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `trip_id` | `uuid` | ✗ | `-` |
| `day` | `text` | ✗ | `-` |
| `morning_activity` | `jsonb` | ✓ | `'{}'::jsonb` |
| `afternoon_activity` | `jsonb` | ✓ | `'{}'::jsonb` |
| `evening_activity` | `jsonb` | ✓ | `'{}'::jsonb` |
| `transport_mode` | `jsonb` | ✓ | `'{}'::jsonb` |
| `meals_included` | `jsonb` | ✓ | `'[]'::jsonb` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## travel_dna_history

**Columns:** 13

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `profile_id` | `uuid` | ✗ | `-` |
| `primary_archetype_id` | `text` | ✗ | `-` |
| `primary_archetype_name` | `text` | ✗ | `-` |
| `confidence` | `integer` | ✗ | `-` |
| `trait_scores` | `jsonb` | ✗ | `-` |
| `emotional_drivers` | `ARRAY` | ✓ | `-` |
| `tone_tags` | `ARRAY` | ✓ | `-` |
| `version` | `integer` | ✗ | `1` |
| `reason` | `text` | ✓ | `-` |
| `changed_from` | `jsonb` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## travel_dna_profiles

**Columns:** 19

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `primary_archetype_id` | `text` | ✗ | `-` |
| `primary_archetype_name` | `text` | ✗ | `-` |
| `secondary_archetype_id` | `text` | ✓ | `-` |
| `secondary_archetype_name` | `text` | ✓ | `-` |
| `confidence` | `integer` | ✗ | `-` |
| `rarity` | `text` | ✓ | `-` |
| `trait_scores` | `jsonb` | ✗ | `-` |
| `top_traits` | `jsonb` | ✓ | `-` |
| `emotional_drivers` | `ARRAY` | ✓ | `'{}'::text[]` |
| `tone_tags` | `ARRAY` | ✓ | `'{}'::text[]` |
| `summary` | `text` | ✓ | `-` |
| `profile` | `jsonb` | ✓ | `-` |
| `behaviors` | `jsonb` | ✓ | `-` |
| `recommendations` | `jsonb` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `calculated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## travel_times

**Columns:** 9

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `from_attraction_id` | `uuid` | ✓ | `-` |
| `to_attraction_id` | `uuid` | ✓ | `-` |
| `travel_mode` | `text` | ✗ | `-` |
| `duration_mins` | `integer` | ✗ | `-` |
| `distance_meters` | `integer` | ✓ | `-` |
| `peak_duration_mins` | `integer` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `-` |

## trip_preferences

**Columns:** 18

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `trip_id` | `uuid` | ✗ | `-` |
| `custom_departure_airport` | `text` | ✓ | `-` |
| `alternate_budget_tier` | `text` | ✓ | `-` |
| `pace_override` | `text` | ✓ | `-` |
| `dietary_restrictions_override` | `ARRAY` | ✓ | `-` |
| `accessibility_needs_override` | `ARRAY` | ✓ | `-` |
| `emotional_tone_override` | `ARRAY` | ✓ | `-` |
| `activity_intensity_override` | `text` | ✓ | `-` |
| `flight_time_preference_override` | `text` | ✓ | `-` |
| `accommodation_style_override` | `text` | ✓ | `-` |
| `climate_preference_override` | `ARRAY` | ✓ | `-` |
| `crowd_tolerance_override` | `text` | ✓ | `-` |
| `special_requests` | `text` | ✓ | `-` |
| `override_reason` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `created_by` | `text` | ✓ | `-` |
| `updated_by` | `text` | ✓ | `-` |

## trips

**Columns:** 34

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `session_id` | `text` | ✓ | `-` |
| `name` | `text` | ✗ | `-` |
| `description` | `text` | ✓ | `-` |
| `status` | `text` | ✗ | `'draft'::text` |
| `trip_type` | `text` | ✓ | `'vacation'::text` |
| `destination_id` | `uuid` | ✓ | `-` |
| `destination_name` | `text` | ✓ | `-` |
| `departure_city` | `text` | ✓ | `-` |
| `start_date` | `date` | ✓ | `-` |
| `end_date` | `date` | ✓ | `-` |
| `total_days` | `integer` | ✓ | `-` |
| `travelers` | `integer` | ✓ | `1` |
| `traveler_type` | `text` | ✓ | `-` |
| `budget_range` | `text` | ✓ | `-` |
| `estimated_cost` | `numeric` | ✓ | `-` |
| `currency` | `text` | ✓ | `'USD'::text` |
| `emotional_tags` | `ARRAY` | ✓ | `-` |
| `primary_goal` | `text` | ✓ | `-` |
| `notes` | `text` | ✓ | `-` |
| `special_requests` | `text` | ✓ | `-` |
| `booking_reference` | `text` | ✓ | `-` |
| `shared_with` | `ARRAY` | ✓ | `-` |
| `is_public` | `boolean` | ✓ | `-` |
| `metadata` | `jsonb` | ✓ | `'{}'::jsonb` |
| `itinerary_id` | `uuid` | ✓ | `-` |
| `source` | `text` | ✓ | `-` |
| `quiz_session_id` | `uuid` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |
| `booked_at` | `timestamp without time zone` | ✓ | `-` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `cancelled_at` | `timestamp without time zone` | ✓ | `-` |

## user_contextual_overrides

**Columns:** 32

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `user_id` | `uuid` | ✗ | `-` |
| `override_sensitivity` | `text` | ✓ | `-` |
| `sacrifice_threshold` | `integer` | ✓ | `-` |
| `communication_style` | `text` | ✓ | `-` |
| `weather_avoid` | `ARRAY` | ✓ | `-` |
| `weather_preference` | `text` | ✓ | `-` |
| `climate_preferences` | `text` | ✓ | `-` |
| `climate_preference` | `text` | ✓ | `-` |
| `climate` | `text` | ✓ | `-` |
| `location_priority` | `text` | ✓ | `-` |
| `location_preference` | `text` | ✓ | `-` |
| `preferred_regions` | `ARRAY` | ✓ | `-` |
| `preferred_region` | `text` | ✓ | `-` |
| `travel_priority` | `text` | ✓ | `-` |
| `schedule_flexibility` | `text` | ✓ | `-` |
| `trip_duration` | `text` | ✓ | `-` |
| `trip_length` | `text` | ✓ | `-` |
| `day_structure` | `text` | ✓ | `-` |
| `daytime_bias` | `numeric` | ✓ | `-` |
| `downtime_ratio` | `numeric` | ✓ | `-` |
| `sleep_schedule` | `text` | ✓ | `-` |
| `preferred_language` | `text` | ✓ | `-` |
| `travel_frequency` | `text` | ✓ | `-` |
| `texture_preference` | `text` | ✓ | `-` |
| `market_preference` | `text` | ✓ | `-` |
| `hotel_loyalty` | `jsonb` | ✓ | `-` |
| `car_rental_loyalty` | `jsonb` | ✓ | `-` |
| `loyalty_programs` | `jsonb` | ✓ | `-` |
| `emergency_contact` | `text` | ✓ | `-` |
| `personal_notes` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## user_core_preferences

**Columns:** 17

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `user_id` | `uuid` | ✗ | `-` |
| `planning_preference` | `text` | ✓ | `-` |
| `trip_structure_preference` | `text` | ✓ | `-` |
| `travel_pace` | `text` | ✓ | `-` |
| `pace_identity` | `text` | ✓ | `-` |
| `budget_tier` | `text` | ✓ | `-` |
| `budget` | `numeric` | ✓ | `-` |
| `currency` | `text` | ✓ | `'USD'::text` |
| `eco_friendly` | `boolean` | ✓ | `-` |
| `accommodation_style` | `text` | ✓ | `-` |
| `hotel_style` | `text` | ✓ | `-` |
| `hotel_vs_flight` | `text` | ✓ | `-` |
| `hotel_floor_preference` | `text` | ✓ | `-` |
| `room_preferences` | `text` | ✓ | `-` |
| `is_customized` | `boolean` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## user_emotional_signature

**Columns:** 22

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `user_id` | `uuid` | ✗ | `-` |
| `primary_goal` | `text` | ✓ | `-` |
| `emotional_drivers` | `ARRAY` | ✓ | `-` |
| `emotional_triggers` | `ARRAY` | ✓ | `-` |
| `emotional_recovery` | `text` | ✓ | `-` |
| `aesthetic_signature` | `text` | ✓ | `-` |
| `travel_vibes` | `ARRAY` | ✓ | `-` |
| `travel_style` | `text` | ✓ | `-` |
| `vibe` | `text` | ✓ | `-` |
| `identity_class` | `text` | ✓ | `-` |
| `traveler_type` | `text` | ✓ | `-` |
| `travel_dna` | `jsonb` | ✓ | `-` |
| `activity_level` | `text` | ✓ | `-` |
| `activity_weights` | `jsonb` | ✓ | `-` |
| `activity_interests` | `ARRAY` | ✓ | `-` |
| `interests` | `ARRAY` | ✓ | `-` |
| `special_interests` | `ARRAY` | ✓ | `-` |
| `travel_goals` | `ARRAY` | ✓ | `-` |
| `bucket_list_destinations` | `ARRAY` | ✓ | `-` |
| `never_again_destinations` | `ARRAY` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## user_flight_preferences

**Columns:** 17

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `user_id` | `uuid` | ✗ | `-` |
| `departure_airport` | `text` | ✓ | `-` |
| `home_airport` | `text` | ✓ | `-` |
| `airport_code` | `text` | ✓ | `-` |
| `airport_radius_miles` | `integer` | ✓ | `-` |
| `direct_flights_only` | `boolean` | ✓ | `-` |
| `flight_preferences` | `jsonb` | ✓ | `-` |
| `flight_time_preference` | `text` | ✓ | `-` |
| `seat_preference` | `text` | ✓ | `-` |
| `preferred_seat` | `text` | ✓ | `-` |
| `preferred_airlines` | `ARRAY` | ✓ | `-` |
| `airline_loyalty` | `jsonb` | ✓ | `-` |
| `tsa_precheck` | `boolean` | ✓ | `-` |
| `global_entry` | `boolean` | ✓ | `-` |
| `passport_number` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## user_food_preferences

**Columns:** 10

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `user_id` | `uuid` | ✗ | `-` |
| `dietary_restrictions` | `ARRAY` | ✓ | `-` |
| `food_likes` | `ARRAY` | ✓ | `-` |
| `food_dislikes` | `ARRAY` | ✓ | `-` |
| `celebration_food` | `text` | ✓ | `-` |
| `comfort_food` | `text` | ✓ | `-` |
| `food_deal_breakers` | `ARRAY` | ✓ | `-` |
| `taste_graph` | `jsonb` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## user_mobility_accessibility

**Columns:** 17

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `user_id` | `uuid` | ✗ | `-` |
| `mobility_level` | `text` | ✓ | `-` |
| `mobility_flags` | `jsonb` | ✓ | `-` |
| `accessibility_needs` | `ARRAY` | ✓ | `-` |
| `accessibility_notes` | `text` | ✓ | `-` |
| `medical_considerations` | `text` | ✓ | `-` |
| `allergies` | `ARRAY` | ✓ | `-` |
| `dietary_restrictions` | `ARRAY` | ✓ | `-` |
| `pet_traveler` | `boolean` | ✓ | `-` |
| `companion_type` | `text` | ✓ | `-` |
| `companion_info` | `jsonb` | ✓ | `-` |
| `frequent_companions` | `ARRAY` | ✓ | `-` |
| `companion_names` | `ARRAY` | ✓ | `-` |
| `travel_companions` | `text` | ✓ | `-` |
| `special_requests` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | ✓ | `CURRENT_TIMESTAMP` |

## user_preferences

**Columns:** 48

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `quiz_completed` | `boolean` | ✓ | `false` |
| `quiz_version` | `text` | ✓ | `'v3'::text` |
| `completed_at` | `timestamp without time zone` | ✓ | `-` |
| `primary_goal` | `text` | ✓ | `-` |
| `traveler_type` | `text` | ✓ | `-` |
| `travel_vibes` | `ARRAY` | ✓ | `-` |
| `emotional_drivers` | `ARRAY` | ✓ | `-` |
| `travel_style` | `text` | ✓ | `-` |
| `travel_frequency` | `text` | ✓ | `-` |
| `trip_duration` | `text` | ✓ | `-` |
| `pace` | `text` | ✓ | `-` |
| `schedule_flexibility` | `text` | ✓ | `-` |
| `trip_structure_preference` | `text` | ✓ | `-` |
| `travel_companions` | `ARRAY` | ✓ | `-` |
| `preferred_group_size` | `text` | ✓ | `-` |
| `communication_style` | `text` | ✓ | `-` |
| `accommodation_style` | `text` | ✓ | `-` |
| `hotel_style` | `text` | ✓ | `-` |
| `hotel_vs_flight` | `text` | ✓ | `-` |
| `flight_preferences` | `jsonb` | ✓ | `-` |
| `preferred_airlines` | `ARRAY` | ✓ | `-` |
| `loyalty_programs` | `ARRAY` | ✓ | `-` |
| `direct_flights_only` | `boolean` | ✓ | `true` |
| `home_airport` | `text` | ✓ | `-` |
| `airport_radius_miles` | `integer` | ✓ | `-` |
| `preferred_regions` | `ARRAY` | ✓ | `-` |
| `climate_preferences` | `ARRAY` | ✓ | `-` |
| `weather_preferences` | `ARRAY` | ✓ | `-` |
| `mobility_level` | `text` | ✓ | `-` |
| `accessibility_needs` | `ARRAY` | ✓ | `-` |
| `dining_style` | `text` | ✓ | `-` |
| `dietary_restrictions` | `ARRAY` | ✓ | `-` |
| `food_likes` | `ARRAY` | ✓ | `-` |
| `food_dislikes` | `ARRAY` | ✓ | `-` |
| `budget_tier` | `text` | ✓ | `-` |
| `budget_range` | `jsonb` | ✓ | `-` |
| `personal_notes` | `text` | ✓ | `-` |
| `eco_friendly` | `boolean` | ✓ | `false` |
| `vibe` | `text` | ✓ | `-` |
| `interests` | `jsonb` | ✓ | `-` |
| `activity_weights` | `jsonb` | ✓ | `-` |
| `sleep_schedule` | `text` | ✓ | `-` |
| `daytime_bias` | `text` | ✓ | `-` |
| `downtime_ratio` | `text` | ✓ | `-` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## user_travel_profile

**Columns:** 56

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `gen_random_uuid()` |
| `user_id` | `uuid` | ✗ | `-` |
| `quiz_completed` | `boolean` | ✓ | `false` |
| `quiz_completed_at` | `timestamp without time zone` | ✓ | `-` |
| `quiz_version` | `text` | ✓ | `'v3'::text` |
| `session_id` | `uuid` | ✓ | `-` |
| `primary_archetype_name` | `text` | ✓ | `-` |
| `secondary_archetype_name` | `text` | ✓ | `-` |
| `dna_confidence_score` | `integer` | ✓ | `-` |
| `dna_rarity` | `text` | ✓ | `-` |
| `trait_scores` | `jsonb` | ✓ | `-` |
| `tone_tags` | `ARRAY` | ✓ | `-` |
| `emotional_drivers` | `ARRAY` | ✓ | `-` |
| `summary` | `text` | ✓ | `-` |
| `calculated_at` | `timestamp without time zone` | ✓ | `-` |
| `travel_pace` | `text` | ✓ | `-` |
| `planning_preference` | `text` | ✓ | `-` |
| `trip_duration` | `text` | ✓ | `-` |
| `travel_frequency` | `text` | ✓ | `-` |
| `preferred_group_size` | `text` | ✓ | `-` |
| `budget_range` | `text` | ✓ | `-` |
| `accommodation_style` | `text` | ✓ | `-` |
| `dining_style` | `text` | ✓ | `-` |
| `hotel_vs_flight` | `text` | ✓ | `-` |
| `seat_preference` | `text` | ✓ | `-` |
| `flight_time_preference` | `text` | ✓ | `-` |
| `direct_flights_only` | `boolean` | ✓ | `-` |
| `preferred_airlines` | `ARRAY` | ✓ | `-` |
| `home_airport` | `text` | ✓ | `-` |
| `airport_radius_miles` | `integer` | ✓ | `-` |
| `mobility_level` | `text` | ✓ | `-` |
| `accessibility_needs` | `ARRAY` | ✓ | `-` |
| `mobility_flags` | `ARRAY` | ✓ | `-` |
| `climate_preferences` | `ARRAY` | ✓ | `-` |
| `weather_avoid` | `ARRAY` | ✓ | `-` |
| `activity_level` | `text` | ✓ | `-` |
| `traveler_type` | `text` | ✓ | `-` |
| `identity_class` | `text` | ✓ | `-` |
| `primary_goal` | `text` | ✓ | `-` |
| `interests` | `ARRAY` | ✓ | `-` |
| `dietary_restrictions` | `ARRAY` | ✓ | `-` |
| `food_likes` | `ARRAY` | ✓ | `-` |
| `food_dislikes` | `ARRAY` | ✓ | `-` |
| `daytime_bias` | `text` | ✓ | `-` |
| `downtime_ratio` | `text` | ✓ | `-` |
| `sleep_schedule` | `text` | ✓ | `-` |
| `schedule_flexibility` | `text` | ✓ | `-` |
| `display_name` | `text` | ✓ | `-` |
| `avatar_url` | `text` | ✓ | `-` |
| `bio` | `text` | ✓ | `-` |
| `location` | `text` | ✓ | `-` |
| `timezone` | `text` | ✓ | `-` |
| `profile_completeness` | `integer` | ✓ | `0` |
| `enhanced_profile` | `boolean` | ✓ | `false` |
| `created_at` | `timestamp without time zone` | ✓ | `now()` |
| `updated_at` | `timestamp without time zone` | ✓ | `now()` |

## users

**Columns:** 23

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| `id` | `uuid` | ✗ | `-` |
| `email` | `text` | ✗ | `-` |
| `name` | `text` | ✓ | `-` |
| `created_at` | `timestamp with time zone` | ✓ | `now()` |
| `updated_at` | `timestamp with time zone` | ✓ | `now()` |
| `provider` | `text` | ✓ | `'email'::text` |
| `hashed_password` | `text` | ✓ | `-` |
| `last_login` | `timestamp with time zone` | ✓ | `-` |
| `handle` | `text` | ✓ | `-` |
| `avatar_url` | `text` | ✓ | `-` |
| `bio` | `text` | ✓ | `-` |
| `onboarding_completed` | `boolean` | ✓ | `-` |
| `email_verified` | `boolean` | ✓ | `true` |
| `username` | `text` | ✓ | `-` |
| `loyaltyPoints` | `integer` | ✓ | `-` |
| `loyaltyTier` | `text` | ✓ | `'bronze'::text` |
| `totalTripsBooked` | `integer` | ✓ | `-` |
| `travelDNA` | `text` | ✓ | `-` |
| `quizCompleted` | `timestamp with time zone` | ✓ | `-` |
| `firstName` | `text` | ✓ | `-` |
| `lastName` | `text` | ✓ | `-` |
| `display_name` | `text` | ✓ | `-` |
| `is_test_user` | `boolean` | ✓ | `-` |

---

# Quiz Data Flow - Simple Overview

## STEP 1: User Creates Account
- User fills out registration form
- Data goes to: **users** table
- Fields populated: email, first_name, last_name, handle, loyalty_tier (bronze), display_name
- Default values: test_user = false

## STEP 2: User Starts Quiz
- User clicks "Take Quiz" 
- Data goes to: **quiz_sessions** table
- Creates new session with: user_id, quiz_type, status = "in_progress", started_at
- Tracks: current step, progress percentage, user agent, IP address

## STEP 3: User Answers Questions (Real-time)
- Every button click during quiz
- Data goes to: **quiz_responses** table
- Records: session_id, question_id, answer (as JSON), timestamp
- Also updates: **quiz_sessions** table with current progress

## STEP 4: Quiz Completion (Step 11)
- User reaches final step
- Updates: **quiz_sessions** table - status = "completed", completion percentage = 100%
- Profile reveal page sends signal to backend: "Start calculating travel DNA"

## STEP 5: Travel DNA Calculation (Backend Process)
- System reads all responses from **quiz_responses** table
- Runs heuristic formulas to calculate travel personality
- Generates: primary DNA type, secondary type, confidence scores, traits, emotional drivers
- Creates comprehensive travel profile based on answers

## STEP 6: Save Travel DNA Results
- Calculated results go to: **travel_dna_profiles** table
- Records: user_id, quiz_session_id, travel_dna_data (JSON), confidence_score
- Also saves to: **travel_dna_history** table (for tracking changes over time)
- Updates: **users** table with quiz_completed_at timestamp and primary travel DNA

## STEP 7: Distribute Data to Preference Tables
Based on quiz answers, system populates these tables:

**user_core_preferences** - Budget range, travel style, group size preferences
**user_emotional_signature** - Emotional profile, intensity scores, confidence levels  
**user_flight_preferences** - Home airport, preferred airlines, cabin class, layover preferences
**user_food_preferences** - Dietary restrictions, cuisine likes/dislikes, spice tolerance
**user_travel_profile** - Activity level, comfort with new experiences, planning style, risk tolerance
**user_contextual_overrides** - Weather preferences, climate preferences, location priorities
**user_mobility_accessibility** - Accessibility needs (partially filled, mostly left for profile page)

## STEP 8: Profile Ready for User
- Frontend displays complete travel profile using data from all preference tables
- User can view their travel DNA results and personality breakdown
- User can edit preferences on profile page (updates go back to preference tables)
- User can retake quiz anytime - creates new entries in travel_dna_history

---

## Key Data Flow Summary

**Main Flow:**
quiz_responses → travel DNA calculation → travel_dna_profiles → distribute to all preference tables

**What Gets Auto-Filled from Quiz:**
- Budget preferences
- Travel style and pace
- Activity level preferences  
- Food preferences and dietary restrictions
- Flight preferences (home airport, etc.)
- Weather and climate preferences
- Emotional travel drivers
- Risk tolerance and planning style

**What's Left Empty for Profile Page:**
- Trip duration preferences
- Communication style preferences  
- Override sensitivity settings
- Detailed accessibility needs
- Sacrifice thresholds

**Retake Flow:**
User retakes quiz → new quiz_responses → new travel_dna_profiles → update all preference tables → old profile saved in travel_dna_history

## Table Relationships (Simple)
- One user has one active travel DNA profile
- One user has many quiz sessions (if they retake)
- One quiz session has many quiz responses (one per question)
- One user has one record in each preference table
- One user can have many contextual overrides
- One user has many travel DNA history records (tracks changes)