
# ✅ COMPLETED: Fix Restaurant Duplication Pipeline

## Problem
Restaurants were being duplicated across days due to 3 compounding issues:
1. Pool sizing capped at 24 venues (insufficient for longer trips)
2. Prompt only showed 8 venues per meal type
3. Used-restaurant tracking compared inconsistent string formats

## Changes Made

### 1. `generation-utils.ts` — New `extractRestaurantVenueName()` helper
- Strips meal prefixes ("Breakfast at", "Lunch:", "Dinner - ") before normalizing
- Single canonical identity function used by all layers

### 2. `action-generate-trip.ts` — Scaled pool sizing
- Removed `Math.min(mealsNeeded + 6, 24)` hard cap
- Now calculates per-city: `mealsNeeded + surplus` (surplus = max(12, 60% of meals))
- Enforces per-meal minimums (min 6 or cityDays+3 per type)
- Multi-city trips get city-specific day counts

### 3. `action-generate-trip-day.ts` — Normalized used_restaurants tracking
- Uses `extractRestaurantVenueName()` when storing used restaurants
- Also extracts from `location.name` as fallback
- Dedup check uses normalized comparison instead of raw string match
- Meal guard fallback filtering also uses normalized names

### 4. `compile-prompt.ts` — Increased prompt exposure + normalized filtering
- Per-meal limit raised from 8 to dynamic `max(8, min(16, available/4))`
- Pool filtering uses `extractRestaurantVenueName()` for identity matching
- Added explicit "do NOT pick same restaurant for multiple meals" rule

### 5. `repair-day.ts` — Fixed swap logic
- `usedSet` now built with inline normalizer (strips meal prefixes + normalizes)
- Current-day dining tracked by both `location.name` AND title (normalized)
- Pool swap candidate comparison uses same normalizer
