# Plan: Enforce Trip Type Theming for All Archetypes

## ✅ COMPLETED

### Implementation Summary

**Problem**: Rome trip with `trip_type: guys-trip` and `flexible_wanderer` archetype was generating generic itineraries because:
1. `flexible_wanderer` was missing from the `guys_trip` archetype combinations
2. No forced slots existed for group trip types
3. Trip type prompts were advisory, not mandatory

### Changes Made

#### 1. Complete Archetype × Trip Type Matrix ✅
**File**: `supabase/functions/generate-itinerary/trip-type-modifiers.ts`

Added all 27 archetypes for each trip type:
- `guys_trip`: 27 archetypes with group-appropriate guidance
- `girls_trip`: 27 archetypes with group-appropriate guidance  
- `birthday`: 27 archetypes with celebration focus
- `anniversary`: 27 archetypes with romantic focus
- `honeymoon`: 27 archetypes with post-wedding recovery focus
- `solo`: 27 archetypes with solo-friendly focus
- `family`: 27 archetypes with kid-friendly focus
- `babymoon`: 27 archetypes with gentle/rest focus

#### 2. Forced Slots for Group Trips ✅
**File**: `supabase/functions/generate-itinerary/personalization-enforcer.ts`

Added new `ForcedSlotType` values:
- `group_bonding_activity` - Guys/Girls trip shared activity
- `evening_entertainment` - Guys trip: bar/pub scene
- `evening_out` - Girls trip: rooftop/cocktails
- `group_experience` - Girls trip: class/tasting/spa
- `photo_worthy` - Girls trip: instagram-worthy moment

Added derivation logic:
- **Guys Trip**: Forces `group_bonding_activity` (mid-trip) + `evening_entertainment` (day 2-3)
- **Girls Trip**: Forces `group_experience` (mid-trip) + `evening_out` (day 2-3) + `photo_worthy` (first 3 days)

#### 3. Group Trip Compliance Check ✅
**File**: `supabase/functions/generate-itinerary/trip-type-modifiers.ts`

Added enforcement block for group trips that requires:
- At least ONE group-focused activity
- At least ONE evening/social option
- Group-friendly dining language
- Prohibition of "intimate", "romantic", "solo" language

### Expected Outcome

Regenerating Rome "Guys Trip" for `flexible_wanderer` should now include:

| Day | Activity Type | Example |
|-----|--------------|---------|
| Day 2 | Group Bonding (FORCED) | Vespa tour of Rome, Gladiator training |
| Day 2 | Evening Out (FORCED) | Trastevere pub crawl, Campo de' Fiori bars |
| Day 3 | Spontaneous Discovery | Wander Testaccio food scene together |
| Daily | Group Dining | Trattorie with shared plates, street food |

### Verification

To verify, regenerate the itinerary and check logs for:
- `forced slots: group_bonding_activity, evening_entertainment`
- Group activities visible in output
- No "romantic" or "intimate" language
- Flexible Wanderer style preserved ("spontaneous", "wander", "discover")
