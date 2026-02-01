

# Plan: Enforce Trip Type Theming for All Archetypes

## Problem Summary

Your Rome trip has `trip_type: guys-trip` and archetype `flexible_wanderer`, but the itinerary looks generic because:

| Issue | Root Cause |
|-------|------------|
| Missing archetype combination | `guys_trip` only defines 5 archetypes - `flexible_wanderer` is NOT included |
| No forced slots for group trips | `personalization-enforcer.ts` has forced slots for birthdays/celebrations but NOT for guys/girls trips |
| Advisory-only prompts | The trip type section suggests but doesn't REQUIRE themed activities |

## Current State Analysis

### File 1: `trip-type-modifiers.ts` (lines 983-989)
The `getTripTypeInteraction()` function only defines 5 archetypes for `guys_trip`:
- `adrenaline_architect` ✓
- `culinary_cartographer` ✓
- `social_butterfly` ✓
- `beach_therapist` ✓
- `cultural_anthropologist` ✓

**Missing**: `flexible_wanderer` (YOUR archetype) and 21 other archetypes

### File 2: `personalization-enforcer.ts` (lines 53-67)
The `ForcedSlotType` union includes celebration slots but NO group trip slots:
```typescript
export type ForcedSlotType = 
  | 'celebration_dinner'     // Birthday/Anniversary ✓
  | 'celebration_experience' // Birthday/Anniversary ✓
  // Missing: group_bonding_activity, evening_entertainment, etc.
```

The `deriveForcedSlots()` function (lines 328-357) handles celebrations but has NO logic for `guys_trip` or `girls_trip`.

---

## Solution: Three-Part Implementation

### Part 1: Complete Archetype × Trip Type Matrix

**File**: `supabase/functions/generate-itinerary/trip-type-modifiers.ts`

Update `getTripTypeInteraction()` to add all 27 archetypes for each trip type.

**Changes to make in `combinations` object (lines 918-1020)**:

For `guys_trip` (add ~22 missing archetypes):
```typescript
guys_trip: {
  // EXISTING 5 archetypes...
  
  // ADD these:
  flexible_wanderer: "Spontaneous guys trip - no rigid plans, discover bars and local spots together, follow group energy wherever it leads.",
  slow_traveler: "Relaxed guys trip - long meals, craft beers, no rushing. Quality hang time over packed activities.",
  bucket_list_conqueror: "Epic guys trip - legendary stadium, famous brewery, iconic experience the group has talked about.",
  luxury_luminary: "Upscale guys trip - VIP sections, premium restaurants, exclusive experiences.",
  retreat_regular: "Golf trip vibes - spa morning then guys activities, wellness-adjacent bonding.",
  urban_nomad: "Neighborhood bar hopping on foot, discovering local hangouts, street food crawl.",
  zen_seeker: "Morning wellness solo, then join the guys. Balance personal practice with group evening.",
  healing_journeyer: "Supportive friends trip - nature walks, meaningful conversations, gentle pace.",
  gap_year_graduate: "Budget pub crawl, hostel social, cheap eats challenge, maximum fun minimum cost.",
  midlife_explorer: "Grown-up guys trip - good restaurants, nice bars, one adventure activity.",
  sabbatical_scholar: "Historical drinking tour, literary pub crawl, intellectual bonding over beers.",
  retirement_ranger: "Golf, wine tasting, comfortable pace, early dinners, quality time with old friends.",
  balanced_story_collector: "Mix of activities - some sports, some food, some nightlife, memorable experience.",
  eco_ethicist: "Sustainable brewery, farm-to-table group dinner, eco-adventure activity.",
  digital_explorer: "Gaming bar, VR experiences, eSports venue, arcade night, tech district with craft beer.",
  wilderness_pioneer: "Group hiking, outdoor adventure day, kayaking or rafting, campfire vibes.",
  collection_curator: "Brewery tour, whiskey tasting trail, sports memorabilia hunt.",
  status_seeker: "VIP table, exclusive club, hard-to-get sports tickets, brag-worthy experience.",
  art_aficionado: "Architecture walk then drinks, design district then rooftop bar.",
  community_builder: "Local community spots, neighborhood bars where regulars go.",
  family_architect: "Dad's trip away - sports, good food, relaxed pace.",
  romantic_curator: "N/A - redirect to couples trip"
}
```

Similarly complete `girls_trip`, `birthday`, `anniversary`, `honeymoon`, `solo`, `family`, and `babymoon` with all 27 archetypes.

---

### Part 2: Add Forced Slots for Group Trip Types

**File**: `supabase/functions/generate-itinerary/personalization-enforcer.ts`

**Step 2a**: Expand `ForcedSlotType` union (line 53-67):

```typescript
export type ForcedSlotType = 
  | 'signature_meal'
  | 'deep_context'
  | 'linger_block'
  | 'edge_activity'
  | 'wellness_moment'
  | 'authentic_encounter'
  | 'social_experience'
  | 'solo_retreat'
  | 'vip_experience'
  | 'couples_moment'
  | 'connectivity_spot'
  | 'family_activity'
  | 'celebration_dinner'
  | 'celebration_experience'
  // NEW GROUP TRIP SLOTS:
  | 'group_bonding_activity'    // Guys/Girls trip: shared group activity
  | 'evening_entertainment'     // Guys trip: bar/pub/sports bar
  | 'evening_out'               // Girls trip: rooftop/wine bar/cocktails
  | 'group_experience'          // Girls trip: class/tasting/spa
  | 'photo_worthy';             // Girls trip: instagram-worthy moment
```

**Step 2b**: Add guys_trip slot derivation (after line 357, before the interest slots section):

```typescript
// 6. GUYS TRIP: Group bonding and evening entertainment
const isGuysTrip = context?.tripType === 'guys_trip' || 
  context?.tripType === 'guys-trip' ||
  context?.tripType?.toLowerCase()?.includes('guys');
if (isGuysTrip) {
  // Group bonding activity mid-trip
  const groupActivityDay = Math.ceil(totalDays / 2);
  if (dayNumber === groupActivityDay && totalDays >= 2) {
    slots.push({
      type: 'group_bonding_activity',
      traitSource: 'context',
      traitValue: 0,
      description: 'GUYS TRIP: Group bonding activity (sports, adventure, brewery tour, or shared experience)',
      validationTags: ['group', 'bonding', 'adventure', 'sports', 'tour', 'brewery', 'active', 'shared-experience', 'guys-activity']
    });
  }
  // Evening entertainment (day 2 or 3)
  const eveningDay = totalDays >= 3 ? 2 : 1;
  if (dayNumber === eveningDay) {
    slots.push({
      type: 'evening_entertainment',
      traitSource: 'context',
      traitValue: 0,
      description: 'GUYS TRIP: Evening out (bar, pub crawl, sports bar, or nightlife)',
      validationTags: ['bar', 'pub', 'nightlife', 'sports-bar', 'evening', 'drinks', 'social', 'night-out']
    });
  }
}

// 7. GIRLS TRIP: Group experiences and photo opportunities
const isGirlsTrip = context?.tripType === 'girls_trip' || 
  context?.tripType === 'girls-trip' ||
  context?.tripType?.toLowerCase()?.includes('girls');
if (isGirlsTrip) {
  // Group experience mid-trip
  const groupExperienceDay = Math.ceil(totalDays / 2);
  if (dayNumber === groupExperienceDay && totalDays >= 2) {
    slots.push({
      type: 'group_experience',
      traitSource: 'context',
      traitValue: 0,
      description: 'GIRLS TRIP: Shared group experience (wine tasting, cooking class, spa day, or group tour)',
      validationTags: ['group', 'class', 'tasting', 'spa', 'tour', 'shared', 'bonding', 'girls-activity']
    });
  }
  // Evening out option
  const eveningDay = totalDays >= 3 ? 2 : 1;
  if (dayNumber === eveningDay) {
    slots.push({
      type: 'evening_out',
      traitSource: 'context',
      traitValue: 0,
      description: 'GIRLS TRIP: Evening out (rooftop bar, wine bar, cocktails, or nightlife)',
      validationTags: ['rooftop', 'wine-bar', 'cocktails', 'evening', 'nightlife', 'drinks', 'girls-night']
    });
  }
  // Photo-worthy moment
  if (dayNumber <= 3) {
    slots.push({
      type: 'photo_worthy',
      traitSource: 'context',
      traitValue: 0,
      description: 'GIRLS TRIP: Photo-worthy location or aesthetically beautiful experience',
      validationTags: ['photo', 'instagram', 'scenic', 'aesthetic', 'viewpoint', 'beautiful', 'shareable']
    });
  }
}
```

---

### Part 3: Strengthen Prompt Enforcement

**File**: `supabase/functions/generate-itinerary/trip-type-modifiers.ts`

Add compliance check to `buildTripTypePromptSection()` function (after line 1119, before the `return section`):

```typescript
// Add critical compliance check for group trips
const groupTripTypes = ['guys_trip', 'guys-trip', 'girls_trip', 'girls-trip', 'family', 'bachelorette', 'bachelor'];
const normalizedType = (tripType || '').toLowerCase().replace(/[\s-]+/g, '_');
if (groupTripTypes.some(g => normalizedType.includes(g.replace(/-/g, '_')))) {
  section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: GROUP TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a GROUP trip. The itinerary MUST include:
✓ At least ONE group-focused activity (not something done alone)
✓ At least ONE evening/social option (bar, pub, dinner out)
✓ Group-friendly dining (shareable food, not intimate couple spots)
✓ Downtime for group hanging out

⚠️ VIOLATION CHECK:
If this itinerary looks like a SOLO trip or COUPLE trip = REGENERATE
The GROUP nature MUST be OBVIOUS in activity selection and language.

Do NOT use language like "intimate", "romantic", "quiet solo moment"
DO use language like "group-friendly", "perfect for friends", "shared experience"
`;
}
```

---

## Files to Modify

| File | Changes | Lines Affected |
|------|---------|----------------|
| `trip-type-modifiers.ts` | Add ~100 missing archetype combinations across 8 trip types | 918-1020 (expand) |
| `trip-type-modifiers.ts` | Add compliance check block | After 1119 |
| `personalization-enforcer.ts` | Add 5 new `ForcedSlotType` values | 53-67 |
| `personalization-enforcer.ts` | Add guys_trip and girls_trip slot derivation logic | After 357 |

---

## Technical Details

### New Forced Slot Types

| Slot Type | Trip Types | Purpose |
|-----------|------------|---------|
| `group_bonding_activity` | guys_trip, girls_trip | Shared activity everyone does together |
| `evening_entertainment` | guys_trip | Bar/pub/sports bar scene |
| `evening_out` | girls_trip | Rooftop/wine bar/cocktails |
| `group_experience` | girls_trip | Class/tasting/spa |
| `photo_worthy` | girls_trip | Instagram-worthy moment |

### Archetypes to Add for Each Trip Type

| Trip Type | Currently Defined | Need to Add |
|-----------|------------------|-------------|
| `guys_trip` | 5 | 22 |
| `girls_trip` | 5 | 22 |
| `birthday` | 9 | 18 |
| `anniversary` | 6 | 21 |
| `honeymoon` | 7 | 20 |
| `solo` | 7 | 20 |
| `family` | 6 | 21 |
| `babymoon` | 4 | 23 |

---

## Expected Outcome

After implementation, regenerating the Rome "Guys Trip" for `flexible_wanderer` should include:

| Day | Activity Type | Example for Flexible Wanderer + Guys Trip |
|-----|--------------|-------------------------------------------|
| Day 2 | Group Bonding (FORCED) | Vespa tour of Rome OR Gladiator training |
| Day 2 | Evening Out (FORCED) | Trastevere pub crawl OR Campo de' Fiori bars |
| Day 3 | Spontaneous Discovery | Wander Testaccio food scene together |
| Daily | Group Dining | Trattorie with shared plates, street food |

The itinerary will blend:
- **Flexible Wanderer style**: spontaneous, wandering, unscheduled blocks, "discover together"
- **Guys Trip theme**: group activities, evening bar scene, group-friendly dining

---

## Verification Steps

After implementation, regenerate the Rome itinerary and check:

| Check | Expected |
|-------|----------|
| Logs show forced slots | `[Stage 1.96] forced slots: group_bonding_activity, evening_entertainment` |
| At least 1 group activity | Vespa tour, gladiator school, brewery tour |
| At least 1 evening out | Bar hopping, pub crawl, sports bar |
| Dining described as group-friendly | "shared plates", "perfect for groups" |
| No "romantic" or "intimate" language | Should NOT appear |
| Flexible Wanderer style present | "spontaneous", "wander", "discover" |

---

## Implementation Effort

| Task | Effort |
|------|--------|
| Add ~100 missing archetype combinations | 45 min |
| Add 5 new ForcedSlotType values | 5 min |
| Add guys_trip slot derivation | 15 min |
| Add girls_trip slot derivation | 15 min |
| Add compliance check block | 10 min |
| Test with Rome guys trip regeneration | 15 min |

**Total**: ~1.5-2 hours

