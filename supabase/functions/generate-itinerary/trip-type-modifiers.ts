/**
 * Trip Type Modifiers - First-class input for itinerary generation
 * 
 * Trip type shapes WHAT you celebrate/focus on
 * Archetype shapes HOW they experience it
 * 
 * A birthday for a Slow Traveler ≠ a birthday for an Adrenaline Architect
 */

export interface TripTypeModifier {
  name: string;
  description: string;
  mustInclude: string[];
  atmosphere: string;
  promptAddition: string;
  frequency: Record<string, string | number | boolean>;
  pacingModifier?: number;
  bufferModifier?: number;
  maxActivitiesPerDay?: number;
  excludeCategories?: string[];
  overrideArchetypeFor?: string[];
  upgradeExperiences?: boolean;
}

export const tripTypeModifiers: Record<string, TripTypeModifier> = {
  // ============ CELEBRATIONS ============

  birthday: {
    name: "Birthday Trip",
    description: "Celebrating a birthday",
    mustInclude: [
      "ONE special celebration dinner (not every dinner)",
      "ONE surprise or special moment",
      "Activity the birthday person specifically loves"
    ],
    atmosphere: "Celebratory but not over-the-top. Focus on what THEY want, not generic 'birthday' activities.",
    promptAddition: `
=== TRIP TYPE: BIRTHDAY CELEBRATION ===

This is a BIRTHDAY trip. Include:
- ONE special dinner (can be nice restaurant, rooftop, or meaningful spot)
- ONE "birthday moment" (sunset at special viewpoint, surprise activity, etc.)
- Activities aligned with what this specific traveler loves (based on archetype)

DO NOT:
- Make every meal a "birthday dinner"
- Add generic birthday activities they wouldn't enjoy
- Force celebration into every day
- Add cake/balloons unless it fits their personality
- Use the word "birthday" in every activity description

A Flexible Wanderer's birthday = discovering a hidden neighborhood gem
A Luxury Luminary's birthday = VIP treatment and fine dining
An Adrenaline Architect's birthday = that skydiving they've always wanted

Match the celebration to WHO they are.
`,
    frequency: {
      specialDinner: 1,
      celebrationMoment: 1,
      mentionInActivities: 0
    },
    pacingModifier: 0
  },

  anniversary: {
    name: "Anniversary Trip",
    description: "Celebrating a relationship milestone",
    mustInclude: [
      "ONE special romantic dinner",
      "Sunset or sunrise moment together",
      "Couples-focused activities"
    ],
    atmosphere: "Romantic, intimate, meaningful. Quality time over quantity of activities.",
    promptAddition: `
=== TRIP TYPE: ANNIVERSARY ===

This is an ANNIVERSARY trip. The focus is ROMANCE and TOGETHERNESS.

Include:
- ONE special dinner (romantic atmosphere, good food, not rushed)
- Sunset or sunrise moment at a scenic spot
- Activities done TOGETHER (not side-by-side but actually shared)
- Intimate venues over crowded ones

Adjust based on archetype:
- Slow Traveler anniversary = long lunches, park strolls, no rushing
- Adrenaline Architect anniversary = adventure they do together (tandem skydive, couples surf lesson)
- Culinary Cartographer anniversary = cooking class together, food tour, special dinner

DO NOT:
- Make it cheesy or generic "romantic"
- Add spa unless they're Retreat Regular or Luxury Luminary
- Force roses/champagne unless it fits
- Schedule them apart
`,
    frequency: {
      specialDinner: 1,
      romanticMoment: 2,
      couplesActivity: 'daily'
    },
    pacingModifier: -1
  },

  honeymoon: {
    name: "Honeymoon",
    description: "Post-wedding celebration trip",
    mustInclude: [
      "Elevated experiences throughout",
      "Privacy and intimacy prioritized",
      "Special romantic moments",
      "Relaxation time (they just had a wedding)"
    ],
    atmosphere: "Luxurious, romantic, restful. They're exhausted from wedding planning. Pamper them.",
    promptAddition: `
=== TRIP TYPE: HONEYMOON ===

This is a HONEYMOON. Different from anniversary:
- They just survived wedding planning - they're EXHAUSTED
- This is likely their most special trip ever
- Elevated everything (within their budget tier)
- More relaxation than a normal trip

Include:
- Upgraded dining experiences (1-2 special dinners)
- Romantic moments (sunset, private experiences)
- REST TIME - don't pack the schedule
- Privacy over crowds
- "Once in a lifetime" experiences appropriate to budget

Even a budget honeymoon should feel special:
- Budget tier: best-value romantic spots, sunset picnic, special local dinner
- Moderate tier: one splurge dinner, couples experience, scenic accommodations
- Luxury tier: full luxury treatment, VIP access, spa, fine dining

DO NOT:
- Pack the schedule like a normal trip
- Forget they need rest
- Make it generic tourist itinerary
- Skip romantic atmosphere
`,
    frequency: {
      specialDinner: 2,
      romanticMoment: 'daily',
      restTime: 'daily',
      upgradeExperiences: true
    },
    pacingModifier: -2,
    upgradeExperiences: true
  },

  // ============ GROUP TRIPS ============

  solo: {
    name: "Solo Trip",
    description: "Traveling alone",
    mustInclude: [
      "Solo-friendly restaurants (counter seating, communal tables)",
      "Safe neighborhoods and transport",
      "Optional social opportunities (if Social Butterfly) or solitude (if not)"
    ],
    atmosphere: "Empowering, safe, flexible. Solo travel is freedom, not loneliness.",
    promptAddition: `
=== TRIP TYPE: SOLO ===

This is a SOLO trip. One person traveling alone.

Include:
- Solo-friendly dining (counter seating, casual spots, food markets)
- Safe areas and well-lit evening routes
- Flexible timing (no need to coordinate)
- Activities that work alone

Adjust based on archetype:
- Social Butterfly solo = walking tours, group activities, hostel social events, pub crawls
- Slow Traveler solo = cafes with books, museums at own pace, peaceful wandering
- Flexible Wanderer solo = maximum freedom, no structure needed

DO NOT:
- Suggest "romantic sunset" or couples activities
- Assume they're lonely or need to meet people (unless Social Butterfly)
- Recommend restaurants that don't seat solo diners well
- Schedule activities requiring partners
`,
    frequency: {
      soloFriendlyDining: 'all meals',
      socialOpportunity: 'optional based on archetype'
    },
    pacingModifier: 0
  },

  girls_trip: {
    name: "Girls Trip",
    description: "Friends getaway (women)",
    mustInclude: [
      "Group-friendly activities",
      "Shareable food experiences",
      "Photo opportunities",
      "Evening out option"
    ],
    atmosphere: "Fun, bonding, celebratory. Shared experiences and memories.",
    promptAddition: `
=== TRIP TYPE: GIRLS TRIP ===

This is a GROUP FRIENDS trip. Focus on SHARED FUN.

Include:
- Activities the whole group can do together
- Shareable food (tapas, family-style, food tours)
- Photo-worthy moments and locations
- At least one "night out" option
- Experiences that create stories

Good for groups:
- Wine/cocktail tastings
- Cooking classes
- Beach clubs
- Rooftop bars
- Walking food tours
- Spa day (if it fits the archetype)

DO NOT:
- Suggest solo activities
- Over-schedule (groups move slower)
- Forget photo opportunities
- Make it all about nightlife (unless that's their archetype)

Adjust to archetype:
- Adrenaline Architect group = group adventure activity
- Culinary Cartographer group = food tour, cooking class, long group dinners
- Beach Therapist group = beach club, sunset drinks, casual seafood
`,
    frequency: {
      groupActivity: 'daily',
      photoOp: 'daily',
      nightOut: '1-2 per trip'
    },
    pacingModifier: -1,
    bufferModifier: 15
  },

  guys_trip: {
    name: "Guys Trip",
    description: "Friends getaway (men)",
    mustInclude: [
      "Group-friendly activities",
      "Good food and drinks",
      "Activity-based bonding",
      "Evening entertainment"
    ],
    atmosphere: "Active, fun, bonding through shared experiences.",
    promptAddition: `
=== TRIP TYPE: GUYS TRIP ===

This is a GROUP FRIENDS trip. Focus on SHARED EXPERIENCES.

Include:
- Activity-based bonding (sports, adventures, tours)
- Good food spots (not necessarily fancy)
- Bar/pub scene
- Something memorable/story-worthy

Good for groups:
- Sporting events
- Outdoor adventures (hiking, water sports)
- Brewery/distillery tours
- Local sports participation
- Food tours
- Evening bar scene

DO NOT:
- Over-schedule (groups move slower)
- Make it all museums and culture (unless that's their archetype)
- Forget downtime for group hanging out
- Assume heavy drinking is required

Adjust to archetype:
- Cultural Anthropologist group = historical pub crawl, local sports match
- Adrenaline Architect group = adventure activity, active experiences
- Culinary Cartographer group = food tour, local specialties, brewery visits
`,
    frequency: {
      groupActivity: 'daily',
      activityBonding: 'daily',
      nightOut: '1-2 per trip'
    },
    pacingModifier: -1,
    bufferModifier: 15
  },

  family: {
    name: "Family Trip",
    description: "Traveling with children",
    mustInclude: [
      "Kid-friendly activities",
      "Family-friendly dining (flexible timing, kid menus)",
      "Rest time / pool time / downtime",
      "Mix of adult and kid interests"
    ],
    atmosphere: "Fun for everyone, manageable logistics, creating family memories.",
    promptAddition: `
=== TRIP TYPE: FAMILY WITH KIDS ===

This trip includes CHILDREN. Everything must work for families.

Include:
- Kid-friendly activities (interactive, not just "looking")
- Family-friendly restaurants (flexible, not fancy)
- REST TIME - kids need breaks
- Mix of kid activities and things parents enjoy
- Easy logistics (not too much transport)

Timing adjustments:
- Earlier dinners (17:30-18:30)
- Afternoon break (13:00-15:00) for rest/pool/nap
- Not too early mornings
- End activities by 19:00-20:00

DO NOT:
- Schedule fine dining
- Plan late-night activities
- Forget snack/bathroom breaks
- Pack the schedule (kids melt down)
- Include adult-only venues
- Require long walks without breaks

Adjust to archetype:
- Bucket List Conqueror family = must-see landmarks but at kid pace
- Beach Therapist family = beach time, pool time, easy seafood dinners
- Cultural Anthropologist family = kid-friendly museums, interactive history
`,
    frequency: {
      kidActivity: 'daily',
      restTime: 'daily',
      familyMeal: 'all meals'
    },
    pacingModifier: -2,
    bufferModifier: 30,
    maxActivitiesPerDay: 3
  },

  // ============ LIFE EVENTS ============

  babymoon: {
    name: "Babymoon",
    description: "Pre-baby celebration trip",
    mustInclude: [
      "Relaxation focus",
      "Pampering experiences",
      "Quality couple time",
      "NO adventure or strenuous activities"
    ],
    atmosphere: "Restful, indulgent, intimate. Last trip before baby arrives.",
    promptAddition: `
=== TRIP TYPE: BABYMOON ===

This is a BABYMOON - a couple's last trip before baby arrives.

The pregnant person is:
- Possibly tired
- Can't do certain activities
- May have food restrictions
- Needs more rest than normal

Include:
- Relaxation (pool, beach, spa if appropriate)
- Quality couple time
- Good food (but consider pregnancy restrictions)
- Gentle activities only
- Comfortable accommodations matter more than usual

DO NOT:
- Suggest adventure activities
- Plan strenuous hiking or walking
- Include raw fish restaurants without alternatives
- Forget rest time
- Pack the schedule
- Suggest alcohol-focused activities

Adjust to archetype:
- Beach Therapist babymoon = beach, pool, prenatal massage
- Culinary Cartographer babymoon = gentle food tours, nice dinners, cooking class
- Slow Traveler babymoon = very relaxed pace, cafes, scenic spots
`,
    frequency: {
      relaxation: 'daily',
      coupleTime: 'daily',
      gentleActivities: 'only'
    },
    pacingModifier: -3,
    excludeCategories: ['adventure_activity', 'extreme_sport', 'hiking', 'strenuous'],
    maxActivitiesPerDay: 2
  },

  retirement: {
    name: "Retirement Trip",
    description: "Celebrating retirement",
    mustInclude: [
      "Bucket list experiences",
      "Celebration moment",
      "Quality over quantity",
      "Comfortable pacing"
    ],
    atmosphere: "Celebratory, meaningful, well-deserved indulgence.",
    promptAddition: `
=== TRIP TYPE: RETIREMENT CELEBRATION ===

This person just RETIRED. This trip celebrates a major life achievement.

Include:
- ONE bucket list experience they've always wanted
- Celebration dinner
- Quality experiences (not rushing through)
- Comfortable pacing and accessibility
- Things they never had time for while working

DO NOT:
- Pack the schedule (they've earned rest)
- Suggest youth-focused venues
- Forget accessibility needs
- Make it feel like work (schedules, timelines)
- Skip the celebration element

Adjust to archetype:
- Bucket List Conqueror retirement = finally checking off that big item
- Slow Traveler retirement = ultimate slow travel, no clock
- Cultural Anthropologist retirement = deep cultural immersion they never had time for
`,
    frequency: {
      bucketListItem: 1,
      celebrationMoment: 1,
      comfortableExperience: 'daily'
    },
    pacingModifier: -2,
    upgradeExperiences: true
  },

  graduation: {
    name: "Graduation Trip",
    description: "Celebrating graduation",
    mustInclude: [
      "Celebration element",
      "Age-appropriate fun",
      "Photo opportunities",
      "Memorable experiences"
    ],
    atmosphere: "Celebratory, fun, marking a milestone.",
    promptAddition: `
=== TRIP TYPE: GRADUATION CELEBRATION ===

This trip celebrates a GRADUATION - educational milestone achieved.

Adjust for who graduated:
- High school grad = fun, social, supervised if with family
- College grad = independent, adventurous, budget-conscious probably
- Graduate degree = may be older, celebrating years of work

Include:
- Celebration moment (doesn't have to be dinner)
- Photo-worthy experiences
- Something memorable/story-worthy
- Age-appropriate nightlife if relevant

Adjust to archetype:
- Gap Year Graduate + graduation = backpacker adventure, social scenes
- Adrenaline Architect + graduation = adventure activity they've earned
- Social Butterfly + graduation = group celebration, nightlife
`,
    frequency: {
      celebrationMoment: 1,
      photoOp: 'multiple',
      funExperience: 'daily'
    },
    pacingModifier: 0
  },

  bachelorette: {
    name: "Bachelorette Party",
    description: "Pre-wedding celebration for bride",
    mustInclude: [
      "Group celebration activities",
      "Photo opportunities",
      "Night out options",
      "Pampering/spa option"
    ],
    atmosphere: "Celebratory, fun, bonding. Last hurrah before marriage.",
    promptAddition: `
=== TRIP TYPE: BACHELORETTE PARTY ===

This is a BACHELORETTE - celebrating the bride-to-be.

Include:
- Group-friendly activities
- Photo-worthy moments (matching outfits, props, etc.)
- Night out / club / bar scene
- Optional spa/pampering
- Brunch culture
- Something memorable for the bride

Good activities:
- Pool/beach club
- Wine/cocktail tastings
- Spa day
- Dancing/clubs
- Group dinner at fun venue
- Activity the bride loves

DO NOT:
- Assume all bachelorettes want the same thing
- Forget the group dynamic
- Over-schedule (groups + drinking = slow)
- Make it uncomfortable for the bride

Match to bride's archetype - not all want clubs!
`,
    frequency: {
      groupActivity: 'daily',
      nightOut: '1-2 per trip',
      brideSpecial: 1
    },
    pacingModifier: -1,
    bufferModifier: 20
  },

  bachelor: {
    name: "Bachelor Party",
    description: "Pre-wedding celebration for groom",
    mustInclude: [
      "Group bonding activities",
      "Adventure or unique experience",
      "Night out options",
      "Memorable story-worthy moments"
    ],
    atmosphere: "Adventurous, fun, bonding. Celebrating with the guys.",
    promptAddition: `
=== TRIP TYPE: BACHELOR PARTY ===

This is a BACHELOR PARTY - celebrating the groom-to-be.

Include:
- Adventure or unique activity (the "story")
- Group bonding experiences
- Night out / bar scene
- Good food (fuel for activities)
- Something the groom specifically wants

Good activities:
- Outdoor adventures (golf, water sports, hiking)
- Sporting events
- Brewery/distillery tours
- Unique local experience
- Evening bar/club scene

DO NOT:
- Assume it's all about drinking
- Forget the group dynamic
- Over-schedule
- Make it uncomfortable for the groom

Match to groom's archetype - not all want Vegas-style!
`,
    frequency: {
      groupActivity: 'daily',
      nightOut: '1-2 per trip',
      adventureActivity: 1
    },
    pacingModifier: -1,
    bufferModifier: 20
  },

  // ============ SPECIAL PURPOSE ============

  wellness: {
    name: "Wellness Retreat",
    description: "Health and wellness focused",
    mustInclude: [
      "Daily wellness activities (yoga, spa, meditation)",
      "Healthy dining",
      "Rest and restoration",
      "Digital detox friendly"
    ],
    atmosphere: "Restorative, healthy, peaceful. This IS the purpose, not a side element.",
    promptAddition: `
=== TRIP TYPE: WELLNESS RETREAT ===

This trip's PURPOSE is WELLNESS. Not a vacation with spa added.

Include:
- Daily wellness activity (yoga, spa, meditation, treatments)
- Healthy dining options
- Rest and recovery time
- Nature/peaceful environments
- Digital detox opportunities

DO NOT:
- Add nightlife
- Pack the schedule with sightseeing
- Include heavy/unhealthy food
- Suggest strenuous activities unless requested
- Forget the purpose is restoration

This essentially makes them Retreat Regular for this trip, regardless of base archetype.
`,
    frequency: {
      wellnessActivity: 'daily',
      healthyDining: 'all meals',
      restTime: 'daily'
    },
    pacingModifier: -3,
    overrideArchetypeFor: ['dining', 'activity_intensity']
  },

  adventure: {
    name: "Adventure Trip",
    description: "Focused on adventure activities",
    mustInclude: [
      "Adventure activity daily",
      "Physical challenges",
      "Outdoor experiences",
      "Recovery time between big activities"
    ],
    atmosphere: "Active, thrilling, challenging. Adventure is the point.",
    promptAddition: `
=== TRIP TYPE: ADVENTURE TRIP ===

This trip's PURPOSE is ADVENTURE. Not sightseeing with one activity added.

Include:
- Adventure activity every day (or every other day with recovery)
- Outdoor experiences
- Physical challenges matching their ability
- Proper recovery between big activities
- Fuel-focused dining (energy, not ambiance)

DO NOT:
- Fill days with museums and cultural sites
- Forget recovery needs
- Exceed physical ability
- Skip safety considerations
- Make it all extreme (varied adventure levels)

This essentially makes them Adrenaline Architect for this trip, regardless of base archetype.
`,
    frequency: {
      adventureActivity: 'daily or every other day',
      outdoorTime: 'daily',
      recoveryTime: 'after major activities'
    },
    overrideArchetypeFor: ['activity_selection'],
    pacingModifier: 1
  },

  foodie: {
    name: "Food & Culinary Trip",
    description: "Focused on culinary experiences",
    mustInclude: [
      "Food experiences multiple times daily",
      "Markets, classes, tours",
      "Researched dining reservations",
      "Local specialties"
    ],
    atmosphere: "Delicious, discovery, culinary immersion. Food IS the itinerary.",
    promptAddition: `
=== TRIP TYPE: FOOD & CULINARY TRIP ===

This trip's PURPOSE is FOOD. Meals aren't interruptions, they're the main events.

Include:
- Morning: market visit or food activity
- Lunch: researched restaurant or food tour
- Afternoon: cooking class, food shopping, or rest before dinner
- Dinner: highlight meal of the day
- Multiple food experiences daily

DO NOT:
- Treat meals as afterthoughts
- Suggest "grab something quick"
- Pack non-food activities that conflict with meal times
- Miss local specialties
- Forget reservations for popular spots

This essentially makes them Culinary Cartographer for this trip, regardless of base archetype.
`,
    frequency: {
      foodExperience: '2-3 daily',
      marketVisit: 'at least once',
      cookingClass: 'at least once',
      signatureMeal: 'daily'
    },
    overrideArchetypeFor: ['dining', 'activity_selection'],
    pacingModifier: -1
  },

  cultural: {
    name: "Cultural Exploration",
    description: "Deep cultural immersion",
    mustInclude: [
      "Museums and historical sites",
      "Local traditions and customs",
      "Authentic local experiences",
      "Cultural performances or events"
    ],
    atmosphere: "Immersive, educational, authentic. Understanding the destination deeply.",
    promptAddition: `
=== TRIP TYPE: CULTURAL EXPLORATION ===

This trip's PURPOSE is CULTURE. Deep understanding of the destination.

Include:
- Museums, galleries, historical sites
- Local traditions and customs
- Authentic neighborhood exploration
- Cultural performances, events, festivals
- Local guides for context

DO NOT:
- Rush through cultural sites
- Skip the "why" - always explain significance
- Make it superficial tourist activities
- Forget local food is part of culture
- Over-schedule (need time to absorb)

This essentially makes them Cultural Anthropologist for this trip, regardless of base archetype.
`,
    frequency: {
      culturalSite: 'daily',
      localExperience: 'daily',
      performance: '1-2 per trip'
    },
    overrideArchetypeFor: ['activity_selection'],
    pacingModifier: -1
  },

  business_leisure: {
    name: "Bleisure Trip",
    description: "Business trip with leisure extension",
    mustInclude: [
      "Work-friendly accommodations",
      "Efficient use of limited free time",
      "Easy logistics",
      "Option for client entertainment if needed"
    ],
    atmosphere: "Efficient, professional base with leisure optimization.",
    promptAddition: `
=== TRIP TYPE: BUSINESS + LEISURE ===

This person is extending a work trip. They have LIMITED free time.

Include:
- Efficient experiences (no wasted time)
- Near-hotel options for short windows
- One good dinner spot (possible client entertainment)
- Weekend full day if applicable
- Easy logistics (they're also working)

DO NOT:
- Plan full days when they're working
- Suggest anything too far from business area
- Forget they may be tired from work
- Over-schedule leisure time
- Ignore potential client entertainment needs
`,
    frequency: {
      efficientExperience: 'during free windows',
      clientDining: 'one option',
      weekendFull: 'if applicable'
    },
    pacingModifier: 1
  },

  romantic: {
    name: "Romantic Getaway",
    description: "Couples trip focused on romance",
    mustInclude: [
      "Intimate dining experiences",
      "Scenic romantic moments",
      "Couples activities",
      "Quality time together"
    ],
    atmosphere: "Romantic, intimate, connected. Focus on each other.",
    promptAddition: `
=== TRIP TYPE: ROMANTIC GETAWAY ===

This is a ROMANTIC trip for a couple.

Include:
- Intimate dining (not crowded tourist spots)
- Scenic moments (sunset, viewpoints, romantic settings)
- Couples activities (not just parallel experiences)
- Downtime for connection

DO NOT:
- Pack the schedule with sightseeing
- Suggest loud/crowded venues
- Forget atmosphere matters
- Schedule them apart
- Make it generic tourist trip

Adjust to archetype - romance looks different for everyone:
- Adrenaline Architect = adventure together builds connection
- Slow Traveler = long meals, walks, no rushing
- Culinary Cartographer = food experiences shared together
`,
    frequency: {
      romanticDinner: 'daily',
      scenicMoment: 'daily',
      couplesActivity: 'daily'
    },
    pacingModifier: -1
  },

  beach: {
    name: "Beach Vacation",
    description: "Sun, sea, and relaxation",
    mustInclude: [
      "Beach/pool time daily",
      "Water activities",
      "Relaxed dining",
      "Sunset moments"
    ],
    atmosphere: "Relaxed, sun-soaked, carefree. Beach IS the destination.",
    promptAddition: `
=== TRIP TYPE: BEACH VACATION ===

This is a BEACH trip. The beach/water is the main attraction.

Include:
- Beach or pool time daily
- Water activities (snorkeling, kayaking, boat trips)
- Casual beachside dining
- Sunset on the beach
- Minimal inland activities

DO NOT:
- Fill days with city sightseeing
- Forget the beach is why they're here
- Over-schedule activities
- Suggest formal dining
- Rush between activities
`,
    frequency: {
      beachTime: 'daily',
      waterActivity: '2-3 per trip',
      sunsetMoment: 'daily'
    },
    pacingModifier: -2
  },

  city_break: {
    name: "City Break",
    description: "Short urban exploration",
    mustInclude: [
      "Key city landmarks",
      "Local neighborhoods",
      "Urban food scene",
      "Nightlife option"
    ],
    atmosphere: "Energetic, urban, efficient. Make the most of limited time.",
    promptAddition: `
=== TRIP TYPE: CITY BREAK ===

This is a short CITY trip. Urban exploration is the focus.

Include:
- Key landmarks and attractions
- Local neighborhood exploration
- Urban food scene (restaurants, street food, markets)
- Nightlife/evening entertainment options
- Efficient use of time

DO NOT:
- Waste time on side trips outside the city
- Miss the iconic spots
- Forget local neighborhoods beyond tourist center
- Skip the food scene
- Over-relax (save beach mode for beach trips)
`,
    frequency: {
      landmark: 'daily',
      localNeighborhood: 'daily',
      urbanDining: 'all meals'
    },
    pacingModifier: 1
  },

  // ============ DEFAULT ============

  none: {
    name: "Standard Trip",
    description: "No special occasion",
    mustInclude: [],
    atmosphere: "Based purely on traveler archetype and preferences.",
    promptAddition: `
=== TRIP TYPE: STANDARD ===

No special occasion. Build itinerary purely based on:
- Traveler archetype
- Preferences
- Budget
- Pacing

No celebration elements required.
No special themes.
Just a great trip for who they are.
`,
    frequency: {},
    pacingModifier: 0
  }
};

/**
 * Get archetype × trip type interaction guidance
 */
export function getTripTypeInteraction(tripType: string, archetype: string): string {
  const normalizedArchetype = archetype?.toLowerCase().replace(/[_\s-]+/g, '_') || '';
  const normalizedTripType = tripType?.toLowerCase().replace(/[_\s-]+/g, '_') || 'none';

  const combinations: Record<string, Record<string, string>> = {
    // ═══════════════════════════════════════════════════════════════
    // GUYS TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    guys_trip: {
      // EXPLORERS
      cultural_anthropologist: "Historical pub crawl, local sports culture, traditional games locals play, authentic neighborhood bars.",
      urban_nomad: "Neighborhood bar hopping on foot, discovering local hangouts, street food crawl, rooftop beers.",
      wilderness_pioneer: "Group hiking, outdoor adventure day, kayaking or rafting, campfire vibes if possible.",
      digital_explorer: "Gaming bar, VR experiences, eSports venue, arcade night, tech district with craft beer.",
      flexible_wanderer: "Spontaneous pub discoveries, stumble into perfect local bars, group freedom to explore, no rigid plans.",
      // CONNECTORS
      social_butterfly: "Pub crawls, group tours, meeting locals, sports bar with atmosphere, maximum social energy.",
      family_architect: "Dad's trip away - sports, good food, relaxed pace, guilt-free guy time.",
      romantic_curator: "N/A - redirect to couples trip",
      community_builder: "Local community spots, neighborhood bars where regulars go, authentic local experience.",
      // ACHIEVERS
      bucket_list_conqueror: "Legendary stadium visit, famous brewery, iconic guys trip experience they've talked about.",
      adrenaline_architect: "Group adventure - skydiving, bungee, white water rafting, extreme shared experience.",
      collection_curator: "Brewery tour, whiskey tasting trail, sports memorabilia hunt, whatever the group geeks out on.",
      status_seeker: "VIP table, exclusive club, hard-to-get sports tickets, brag-worthy experience.",
      // RESTORERS
      zen_seeker: "Morning wellness solo, then join the guys. Balance personal practice with group evening.",
      retreat_regular: "Golf trip vibes, spa morning then guys activities, wellness-adjacent bonding.",
      beach_therapist: "Beach day, boat trip, sunset beers, casual seafood, low-key guys trip.",
      slow_traveler: "Long lunches, craft beer tastings, no rushing anywhere. Quality hang time over packed schedule.",
      // CURATORS
      culinary_cartographer: "Food and beer tour, BBQ pilgrimage, local specialty hunt, brewery crawl, hearty meals.",
      art_aficionado: "Architecture walk then drinks, design district then rooftop bar, culture by day, bars by night.",
      luxury_luminary: "Premium everything - VIP sports box, high-end steakhouse, exclusive lounge, top-shelf whiskey.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable brewery, farm-to-table group dinner, eco-adventure activity, local craft producers.",
      gap_year_graduate: "Budget pub crawl, hostel social, cheap eats challenge, backpacker bar scene, maximum fun minimum cost.",
      midlife_explorer: "Grown-up guys trip - good restaurants, nice bars, one adventure activity, quality over quantity.",
      sabbatical_scholar: "Historical drinking tour, literary pub crawl, intellectual bonding over beers.",
      healing_journeyer: "Supportive friends trip - nature walks, meaningful conversations, gentle pace with the guys.",
      retirement_ranger: "Golf, wine tasting, comfortable pace, early dinners, quality time with old friends.",
      balanced_story_collector: "Mix of activities - some sports, some food, some nightlife, memorable shared experience."
    },

    // ═══════════════════════════════════════════════════════════════
    // GIRLS TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    girls_trip: {
      // EXPLORERS
      cultural_anthropologist: "Art galleries, cultural walking tour, women-owned businesses, meaningful local experiences.",
      urban_nomad: "Neighborhood exploration, cute cafes, boutique shopping streets, rooftop cocktails.",
      wilderness_pioneer: "Adventure retreat - hiking then wine, outdoor spa, glamping, nature bonding.",
      digital_explorer: "Instagram spots, trendy cafes, photo-worthy murals, aesthetic everything, night markets.",
      flexible_wanderer: "Wandering together, stumbling upon cute spots, spontaneous shopping finds, no rigid plans.",
      // CONNECTORS
      social_butterfly: "Group classes, wine tours, meeting locals, maximum social activities, evening out.",
      family_architect: "Mom's escape - spa day, wine, adult conversation, sleep in, no kids menu.",
      romantic_curator: "N/A - redirect to couples trip",
      community_builder: "Women's cooperatives, female artisan workshops, meaningful female-owned business visits.",
      // ACHIEVERS
      bucket_list_conqueror: "The bucket list destination, iconic photo spots, must-do experiences checked off.",
      adrenaline_architect: "Group adventure - surfing lesson, hiking, zip-lining, paddleboarding together.",
      collection_curator: "Shopping for their passion, specialty boutiques, curated finds, themed experiences.",
      status_seeker: "Influencer spots, exclusive brunches, VIP treatment, impressive venues, shareable moments.",
      // RESTORERS
      zen_seeker: "Wellness retreat vibes - yoga morning, healthy brunch, meditation, peaceful group activities.",
      retreat_regular: "Full spa day, wellness activities, healthy dining, treatments, relaxation focus.",
      beach_therapist: "Beach club day, pool lounging, sunset cocktails, casual beachwear shopping.",
      slow_traveler: "Long brunches, leisurely boutique browsing, no rushing, quality girlfriend time.",
      // CURATORS
      culinary_cartographer: "Food tour, cooking class together, wine tasting, restaurant hopping, market visit.",
      art_aficionado: "Gallery hopping, design districts, art-focused experiences, creative workshops.",
      luxury_luminary: "Spa day, fine dining, luxury shopping, champagne everything, five-star treatment.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable fashion shopping, eco-spa, farm-to-table experiences, ethical brands.",
      gap_year_graduate: "Budget-friendly fun, hostels with style, cheap eats, backpacker adventures, thrift shopping.",
      midlife_explorer: "Grown-up girls trip - nice hotels, good food, meaningful experiences, celebrating friendship.",
      sabbatical_scholar: "Bookshop crawl, museum visits, intellectual cafes, cultural deep dives together.",
      healing_journeyer: "Supportive friends trip - gentle activities, nature walks, meaningful talks, holding space.",
      retirement_ranger: "Comfortable pace, nice restaurants, easy activities, celebrating years of friendship.",
      balanced_story_collector: "Mix of everything - shopping, culture, food, drinks, photos, memories."
    },

    // ═══════════════════════════════════════════════════════════════
    // BIRTHDAY - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    birthday: {
      // EXPLORERS
      cultural_anthropologist: "Birthday at meaningful historical site, special cultural experience, museum they love.",
      urban_nomad: "Birthday neighborhood discovery, surprise in a hidden local spot, urban exploration gift.",
      wilderness_pioneer: "Birthday summit hike, outdoor celebration, campfire birthday, nature experience.",
      digital_explorer: "Birthday at unique/viral venue, photo-worthy celebration, shareable moment.",
      flexible_wanderer: "Low-key birthday wander, stumble upon something special, no forced celebration.",
      // CONNECTORS
      social_butterfly: "Big birthday party, group dinner, festive atmosphere, all their friends energy.",
      family_architect: "Family birthday celebration, kid-friendly venue if with children, multi-generational.",
      romantic_curator: "Romantic birthday dinner, surprise experience planned by partner, intimate celebration.",
      community_builder: "Birthday giving back, celebration with local community, meaningful over material.",
      // ACHIEVERS
      bucket_list_conqueror: "Birthday bucket list item - THE thing they've always wanted to do. Make it happen.",
      adrenaline_architect: "Birthday adventure - skydiving, bungee, that thrilling thing they've wanted.",
      collection_curator: "Birthday related to their passion, adding to their collection, specialty experience.",
      status_seeker: "VIP birthday treatment, impressive venue, exclusive experience, show-stopping.",
      // RESTORERS
      zen_seeker: "Peaceful birthday - sunrise meditation, meaningful quiet celebration, spiritual significance.",
      retreat_regular: "Spa birthday, full pampering day, wellness celebration, treatments.",
      beach_therapist: "Beach birthday - sunset celebration, toes in sand, simple and perfect.",
      slow_traveler: "Leisurely birthday - long special lunch, no rushing, savoring the day.",
      // CURATORS
      culinary_cartographer: "Birthday at THE restaurant they've wanted, food-focused celebration.",
      art_aficionado: "Birthday at special gallery, private museum experience, art-related celebration.",
      luxury_luminary: "Full luxury birthday - champagne, VIP everything, the works, make them feel royal.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable celebration, nature birthday experience, eco-conscious and meaningful.",
      gap_year_graduate: "Fun budget birthday, hostel party vibes, creative celebration, experience over expense.",
      midlife_explorer: "Meaningful milestone birthday, quality celebration, marking the moment.",
      sabbatical_scholar: "Birthday at meaningful historical or intellectual site, thoughtful celebration.",
      healing_journeyer: "Gentle birthday, peaceful celebration, self-care day, honoring the journey.",
      retirement_ranger: "Comfortable birthday celebration, quality over chaos, celebrating life.",
      balanced_story_collector: "Classic birthday - nice dinner, special moment, cake, making a memory."
    },

    // ═══════════════════════════════════════════════════════════════
    // ANNIVERSARY - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    anniversary: {
      // EXPLORERS
      cultural_anthropologist: "Anniversary exploring together, meaningful cultural site, learning as a couple.",
      urban_nomad: "City anniversary - romantic neighborhood walks, discovering spots together.",
      wilderness_pioneer: "Adventure anniversary - hiking, nature, outdoor romance, campfire under stars.",
      digital_explorer: "Modern anniversary - unique experiences, photo-worthy moments, shareable romance.",
      flexible_wanderer: "Wandering anniversary - no agenda, discover together, spontaneous romance.",
      // CONNECTORS
      social_butterfly: "Anniversary with friends nearby, celebratory energy, sharing the love.",
      family_architect: "Anniversary escape from kids, adult time, remembering why you fell in love.",
      romantic_curator: "Ultimate romantic anniversary - every detail planned, maximum romance.",
      community_builder: "Anniversary volunteering together, meaningful shared experience, giving back.",
      // ACHIEVERS
      bucket_list_conqueror: "Anniversary at dream destination, checking off together, romantic achievement.",
      adrenaline_architect: "Adventure anniversary - shared thrills, bonding through excitement.",
      collection_curator: "Anniversary focused on shared interest - wine region, art capitals together.",
      status_seeker: "Impressive anniversary - luxury, VIP, the kind others envy.",
      // RESTORERS
      zen_seeker: "Peaceful anniversary - meditation together, spiritual sites, quiet romance.",
      retreat_regular: "Spa anniversary - couple's treatments, wellness focus, relaxation.",
      beach_therapist: "Beach anniversary - ocean sunsets, simple romance, toes in sand together.",
      slow_traveler: "Slow anniversary - long meals, no rushing, savoring each moment together.",
      // CURATORS
      culinary_cartographer: "Food anniversary - cooking class together, restaurant tour, wine tasting.",
      art_aficionado: "Art anniversary - museums together, design experiences, cultural romance.",
      luxury_luminary: "Luxury anniversary - five-star everything, private experiences, premium romance.",
      // TRANSFORMERS
      eco_ethicist: "Eco anniversary - sustainable resort, nature, responsible romance.",
      gap_year_graduate: "Budget anniversary - backpacker romance, meaningful over expensive.",
      midlife_explorer: "Mature anniversary - quality experiences, celebrating years together.",
      sabbatical_scholar: "Learning anniversary - exploring together, intellectual couple time.",
      healing_journeyer: "Healing anniversary - gentle, restorative, reconnecting.",
      retirement_ranger: "Later-life anniversary - comfortable, quality, no rushing.",
      balanced_story_collector: "Classic anniversary - romantic dinner, sunset, celebrating together."
    },

    // ═══════════════════════════════════════════════════════════════
    // HONEYMOON - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    honeymoon: {
      cultural_anthropologist: "Immersive honeymoon - learning together, cultural depth, meaningful sites.",
      urban_nomad: "City honeymoon - exploring neighborhoods together, romantic urban discovery.",
      wilderness_pioneer: "Adventure honeymoon - hiking, nature, outdoor romance, wilderness together.",
      digital_explorer: "Modern honeymoon - unique experiences, photo-worthy, aesthetically perfect.",
      flexible_wanderer: "Wandering honeymoon - no agenda, discover together, spontaneous romance.",
      social_butterfly: "Social honeymoon - cooking classes, tours with others, meeting couples.",
      family_architect: "N/A pre-kids, or blended family honeymoon with thoughtful kid inclusion.",
      romantic_curator: "Ultimate romantic honeymoon - every detail curated for maximum romance.",
      community_builder: "Meaningful honeymoon - volunteering together, starting marriage with purpose.",
      bucket_list_conqueror: "Dream destination honeymoon - must-sees with romantic lens.",
      adrenaline_architect: "Adventure honeymoon - shared thrills, building memories through excitement.",
      collection_curator: "Honeymoon around shared passion - wine region, art capitals, food tour.",
      status_seeker: "Impressive honeymoon - the kind that makes others jealous, VIP everything.",
      zen_seeker: "Peaceful honeymoon - meditation together, spiritual sites, quiet romance.",
      retreat_regular: "Spa honeymoon - couple's treatments, wellness focus, deep relaxation.",
      beach_therapist: "Beach honeymoon - ultimate relaxation, ocean, simple perfect romance.",
      slow_traveler: "Slow honeymoon - long meals, no rushing, savoring every newlywed moment.",
      culinary_cartographer: "Food honeymoon - cooking classes together, restaurant exploration.",
      art_aficionado: "Art honeymoon - museums together, design hotels, cultural romance.",
      luxury_luminary: "Luxury honeymoon - five-star everything, private experiences, premium.",
      eco_ethicist: "Eco honeymoon - sustainable resorts, nature, responsible romance.",
      gap_year_graduate: "Budget honeymoon - backpacker romance, meaningful over expensive.",
      midlife_explorer: "Mature honeymoon - quality over flash, meaningful experiences.",
      sabbatical_scholar: "Learning honeymoon - courses together, intellectual exploration.",
      healing_journeyer: "Healing honeymoon - gentle start to marriage, restorative.",
      retirement_ranger: "Later-life honeymoon - comfortable, quality, no rushing.",
      balanced_story_collector: "Classic honeymoon - mix of romance, sightseeing, relaxation."
    },

    // ═══════════════════════════════════════════════════════════════
    // SOLO - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    solo: {
      cultural_anthropologist: "Deep solo immersion - museums at own pace, conversations with locals, no compromise.",
      urban_nomad: "Solo city freedom - complete independence, own discoveries, own timing.",
      wilderness_pioneer: "Solo wilderness - self-reliance, solo hiking, camping alone, personal challenge.",
      digital_explorer: "Solo but connected - gaming cafes, sharing online, solo-friendly tech spots.",
      flexible_wanderer: "Ultimate solo freedom - no compromise ever, complete spontaneity.",
      social_butterfly: "Solo but social - walking tours, hostel events, pub crawls, meeting travelers.",
      family_architect: "Parent's solo escape - rest, adult activities, recharge alone.",
      romantic_curator: "Solo self-romance - treating yourself, self-dates, self-love trip.",
      community_builder: "Solo volunteering - meaningful connections, giving back alone.",
      bucket_list_conqueror: "Solo bucket list - doing it YOUR way, no compromise, your pace.",
      adrenaline_architect: "Solo adventure - personal challenges, self-reliance, proving yourself.",
      collection_curator: "Solo deep dive - full focus on your interest, no distraction from others.",
      status_seeker: "Solo luxury - treating yourself, indulgence without sharing.",
      zen_seeker: "Solo spiritual journey - meditation retreat, silent time, inner focus.",
      retreat_regular: "Solo wellness - spa alone, yoga retreat, complete self-care.",
      beach_therapist: "Solo beach - reading, swimming, complete relaxation alone.",
      slow_traveler: "Solo slow travel - own pace, no negotiation, pure freedom.",
      culinary_cartographer: "Solo food journey - counter seating, food tours, cooking classes.",
      art_aficionado: "Solo art immersion - hours in museums, own pace, no rushing for anyone.",
      luxury_luminary: "Solo luxury - complete self-indulgence, treating yourself to the best.",
      eco_ethicist: "Solo eco travel - low impact, meaningful connections, nature.",
      gap_year_graduate: "Classic solo backpacking - hostels, meeting travelers, cheap eats.",
      midlife_explorer: "Solo rediscovery - finding yourself, new experiences, total freedom.",
      sabbatical_scholar: "Solo study - libraries, courses, intellectual exploration alone.",
      healing_journeyer: "Solo healing - solitude as medicine, nature, reflection, space.",
      retirement_ranger: "Solo adventure - finally doing exactly what YOU want.",
      balanced_story_collector: "Solo exploration - mix of everything, completely own pace."
    },

    // ═══════════════════════════════════════════════════════════════
    // FAMILY - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    family: {
      cultural_anthropologist: "Educational family trip - kid-friendly history, interactive museums, learning fun.",
      urban_nomad: "Family city exploration - parks, playgrounds, kid-friendly neighborhoods.",
      wilderness_pioneer: "Family outdoor adventure - easy hikes, nature centers, age-appropriate camping.",
      digital_explorer: "Family tech fun - science museums, aquariums, interactive digital exhibits.",
      flexible_wanderer: "Flexible family - go with kid energy, spontaneous park stops, no rigid schedule.",
      social_butterfly: "Social family trip - activities with other families, kid-friendly group tours.",
      family_architect: "Ultimate family trip - perfectly planned for all ages, everyone considered.",
      romantic_curator: "Family trip with couple moments - one parents' date night, babysitter arranged.",
      community_builder: "Family volunteering - age-appropriate giving back, teaching kids to help.",
      bucket_list_conqueror: "Family bucket list - theme parks, zoos, must-do family experiences.",
      adrenaline_architect: "Adventure family - age-appropriate thrills, water parks, easy adventures.",
      collection_curator: "Family learning trip - focused on kids' interests, what they love.",
      status_seeker: "Impressive family trip - best resorts, VIP family experiences, kids club.",
      zen_seeker: "Calm family trip - nature, peaceful activities, mindful family time.",
      retreat_regular: "Family wellness - kid-friendly resort, family spa, healthy activities.",
      beach_therapist: "Beach family trip - sandcastles, swimming, ice cream, simple kid fun.",
      slow_traveler: "Slow family trip - no rushing, long beach days, relaxed kid pace.",
      culinary_cartographer: "Foodie family - cooking classes, food tours, teaching kids about food.",
      art_aficionado: "Art family - kid-friendly museums, hands-on art activities, creative fun.",
      luxury_luminary: "Luxury family - five-star family resorts, kids clubs, family suites.",
      eco_ethicist: "Eco family - teaching sustainability, nature, conservation experiences.",
      gap_year_graduate: "Budget family - camping, picnics, free activities, creative fun.",
      midlife_explorer: "Multi-gen family - activities for all ages, quality family time.",
      sabbatical_scholar: "Educational family - learning experiences, historical sites, curious kids.",
      healing_journeyer: "Gentle family trip - nature, bonding, peaceful family activities.",
      retirement_ranger: "Grandparent trip - comfortable pace, making memories with grandkids.",
      balanced_story_collector: "Classic family vacation - mix of everything, something for everyone."
    },

    // ═══════════════════════════════════════════════════════════════
    // BABYMOON - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    babymoon: {
      cultural_anthropologist: "Gentle cultural babymoon - easy museums, no long walks, comfortable pace.",
      urban_nomad: "City babymoon - comfortable neighborhoods, frequent rest stops, gentle exploration.",
      wilderness_pioneer: "Nature babymoon - scenic drives, easy walks, nature viewing, no strenuous activity.",
      digital_explorer: "Modern babymoon - comfortable unique experiences, easy photo spots.",
      flexible_wanderer: "Relaxed babymoon - no plans, rest when needed, gentle wandering.",
      social_butterfly: "Connected babymoon - comfortable group activities, prenatal yoga class.",
      family_architect: "N/A - this IS the pre-family trip.",
      romantic_curator: "Romantic babymoon - last couple trip before baby, intimate and gentle.",
      community_builder: "Meaningful babymoon - gentle volunteering, comfortable connections.",
      bucket_list_conqueror: "Bucket list babymoon - comfortable must-sees before baby arrives.",
      adrenaline_architect: "MODIFIED - no adventure activities. Redirect to scenic, easy experiences.",
      collection_curator: "Gentle interest babymoon - easy version of their passion.",
      status_seeker: "Luxury babymoon - premium pampering, first-class comfort.",
      zen_seeker: "Peaceful babymoon - prenatal yoga, meditation, spiritual preparation.",
      retreat_regular: "Spa babymoon - prenatal treatments, ultimate pampering, rest.",
      beach_therapist: "Beach babymoon - lounging, gentle swimming, relaxation.",
      slow_traveler: "Ultimate slow babymoon - no rushing ever, complete rest.",
      culinary_cartographer: "Food babymoon - pregnancy-safe dining focus, gentle food tours.",
      art_aficionado: "Art babymoon - museums at easy pace, seated viewing options.",
      luxury_luminary: "Luxury babymoon - five-star pampering, every comfort anticipated.",
      eco_ethicist: "Eco babymoon - sustainable resort, gentle nature, peaceful.",
      gap_year_graduate: "Budget babymoon - comfortable basics, rest focus over activities.",
      midlife_explorer: "Meaningful babymoon - quality rest before this new chapter.",
      sabbatical_scholar: "Gentle learning babymoon - easy cultural experiences.",
      healing_journeyer: "Restful babymoon - preparing body and mind, peaceful.",
      retirement_ranger: "N/A - not typical demographic.",
      balanced_story_collector: "Classic babymoon - mix of rest and gentle activities."
    },

    // ═══════════════════════════════════════════════════════════════
    // GRADUATION - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    graduation: {
      // EXPLORERS
      cultural_anthropologist: "Educational celebration - meaningful historical site, cultural depth, honoring the learning journey.",
      urban_nomad: "City graduation trip - neighborhood exploration, celebrating freedom, urban adventure begins.",
      wilderness_pioneer: "Outdoor graduation celebration - summit hike, nature adventure, conquering new heights.",
      digital_explorer: "Modern graduation trip - Instagram-worthy moments, trendy spots, shareable celebration.",
      flexible_wanderer: "Freedom graduation trip - no more schedules, pure spontaneity, celebrating independence.",
      // CONNECTORS
      social_butterfly: "Party graduation - group celebration, meeting people, nightlife, maximum social energy.",
      family_architect: "Family graduation celebration - multi-generational trip, making parents proud, shared joy.",
      romantic_curator: "Couples graduation trip - celebrating together, romantic milestone marking.",
      community_builder: "Meaningful graduation - volunteering, giving back, starting next chapter with purpose.",
      // ACHIEVERS
      bucket_list_conqueror: "Bucket list graduation - THE trip you've been waiting for, reward for years of work.",
      adrenaline_architect: "Adventure graduation - you earned this thrill, skydiving, bungee, epic experience.",
      collection_curator: "Passion graduation trip - deep dive into your interest, celebrating your expertise.",
      status_seeker: "Impressive graduation trip - brag-worthy destination, VIP experiences, Instagram gold.",
      // RESTORERS
      zen_seeker: "Peaceful graduation - rest after years of stress, meditation, finding center before next chapter.",
      retreat_regular: "Wellness graduation - spa recovery from finals, treatments, restoring depleted energy.",
      beach_therapist: "Beach graduation - finally relaxing, ocean therapy, decompressing from academic stress.",
      slow_traveler: "Slow graduation trip - no deadlines, no rushing, savoring freedom at last.",
      // CURATORS
      culinary_cartographer: "Foodie graduation - eating your way through celebration, food adventures, no meal plan budget.",
      art_aficionado: "Art graduation - museums without rush, cultural immersion, feeding creativity.",
      luxury_luminary: "Luxury graduation - treating yourself after sacrifice, premium everything, you earned it.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable graduation - eco-conscious celebration, nature, starting career with values.",
      gap_year_graduate: "Budget graduation adventure - backpacking, hostels, stretching graduation money far.",
      midlife_explorer: "Career-change graduation - celebrating reinvention, meaningful new chapter.",
      sabbatical_scholar: "Academic graduation - intellectual celebration, bookshops, scholarly satisfaction.",
      healing_journeyer: "Gentle graduation - recovering from academic pressure, peaceful transition.",
      retirement_ranger: "Late-life graduation - celebrating lifelong learning, comfortable pace.",
      balanced_story_collector: "Classic graduation trip - mix of celebration, relaxation, and adventure."
    },

    // ═══════════════════════════════════════════════════════════════
    // RETIREMENT - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    retirement: {
      // EXPLORERS
      cultural_anthropologist: "Cultural retirement trip - finally time for deep immersion, meaningful exploration, no work calls.",
      urban_nomad: "City retirement exploration - walking cities at your pace, no schedule, urban freedom.",
      wilderness_pioneer: "Outdoor retirement - hiking bucket list, nature immersion, active retirement celebration.",
      digital_explorer: "Modern retirement trip - unique experiences, photo-worthy moments, staying current.",
      flexible_wanderer: "Freedom retirement - no more schedules ever, pure spontaneity, earned independence.",
      // CONNECTORS
      social_butterfly: "Social retirement - group tours, meeting fellow travelers, cruises, new friendships.",
      family_architect: "Family retirement trip - traveling with grandkids, multi-generational memories.",
      romantic_curator: "Romantic retirement - second honeymoon energy, celebrating partnership through career.",
      community_builder: "Meaningful retirement - volunteering abroad, giving back with new free time.",
      // ACHIEVERS
      bucket_list_conqueror: "Ultimate bucket list - THE destinations you've always dreamed of, no more 'someday'.",
      adrenaline_architect: "Active retirement - proving age is just a number, adventure within ability.",
      collection_curator: "Passion retirement - finally time for your hobby, deep expertise trips.",
      status_seeker: "Impressive retirement - luxury travel you've earned, premium experiences, bragging rights.",
      // RESTORERS
      zen_seeker: "Peaceful retirement - spiritual exploration, meditation retreats, finding meaning.",
      retreat_regular: "Wellness retirement - spa trips, health focus, taking care of yourself finally.",
      beach_therapist: "Beach retirement - ocean time, relaxation, simple pleasures, no alarm clocks.",
      slow_traveler: "Slow retirement travel - ultimate slow travel, weeks not days, no rushing ever.",
      // CURATORS
      culinary_cartographer: "Foodie retirement - food tours, cooking classes, culinary bucket list.",
      art_aficionado: "Art retirement - museums without rushing, cultural immersion, lifelong learning.",
      luxury_luminary: "Luxury retirement - five-star everything, you worked for this, premium treatment.",
      // TRANSFORMERS
      eco_ethicist: "Eco retirement - sustainable travel, nature, leaving good footprint.",
      gap_year_graduate: "Budget retirement adventure - stretching savings, smart travel, experience over luxury.",
      midlife_explorer: "N/A - retirement is past midlife, redirect to retirement_ranger.",
      sabbatical_scholar: "Learning retirement - courses, lectures, intellectual travel, lifelong student.",
      healing_journeyer: "Healing retirement - rest from career stress, gentle recovery, peace.",
      retirement_ranger: "Classic retirement travel - comfortable pace, quality experiences, celebrating life's work.",
      balanced_story_collector: "Balanced retirement - mix of bucket list, relaxation, and new experiences."
    },

    // ═══════════════════════════════════════════════════════════════
    // WELLNESS RETREAT - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    wellness_retreat: {
      // EXPLORERS
      cultural_anthropologist: "Cultural wellness - local healing traditions, traditional medicine, indigenous wellness practices.",
      urban_nomad: "Urban wellness - city yoga studios, juice bars, wellness neighborhoods, mindful city walking.",
      wilderness_pioneer: "Nature wellness - forest bathing, outdoor yoga, wilderness therapy, hiking meditation.",
      digital_explorer: "Modern wellness - biohacking centers, wellness tech, meditation apps, infrared saunas.",
      flexible_wanderer: "Flexible wellness - drop-in classes, no rigid schedule, intuitive self-care.",
      // CONNECTORS
      social_butterfly: "Group wellness - retreat with others, group yoga, wellness community, shared healing.",
      family_architect: "Family wellness - kid-friendly wellness resort, family yoga, healthy habits together.",
      romantic_curator: "Couples wellness - partner yoga, couples massage, romantic health retreat.",
      community_builder: "Community wellness - wellness volunteering, teaching yoga, sharing healing.",
      // ACHIEVERS
      bucket_list_conqueror: "Achievement wellness - complete a program, yoga teacher training, wellness certification.",
      adrenaline_architect: "Active wellness - intensive fitness retreat, challenging yoga, athletic recovery.",
      collection_curator: "Specialist wellness - deep dive into specific practice, Ayurveda immersion, expertise.",
      status_seeker: "Premium wellness - exclusive retreat, celebrity-level facilities, impressive program.",
      // RESTORERS
      zen_seeker: "Spiritual wellness - meditation intensive, silent retreat, deep practice, enlightenment focus.",
      retreat_regular: "Full wellness immersion - comprehensive program, daily treatments, total reset.",
      beach_therapist: "Beach wellness - oceanside yoga, beach meditation, water therapy, natural healing.",
      slow_traveler: "Gentle wellness - no intensive programs, slow yoga, rest-focused, easy pace.",
      // CURATORS
      culinary_cartographer: "Nutrition wellness - healthy cooking, detox cuisine, food as medicine, clean eating.",
      art_aficionado: "Creative wellness - art therapy, creative expression, healing through art.",
      luxury_luminary: "Luxury wellness - six-star spa resort, premium treatments, world-class facilities.",
      // TRANSFORMERS
      eco_ethicist: "Eco wellness - sustainable retreat, organic everything, nature connection, earth healing.",
      gap_year_graduate: "Budget wellness - affordable retreat, work-exchange yoga, hostel yoga classes.",
      midlife_explorer: "Transformative wellness - midlife reset, health reboot, new chapter preparation.",
      sabbatical_scholar: "Learning wellness - wellness education, understanding the science, intellectual approach.",
      healing_journeyer: "Deep healing retreat - trauma-informed, therapeutic focus, professional support.",
      retirement_ranger: "Gentle wellness - age-appropriate, restorative, comfortable healing.",
      balanced_story_collector: "Balanced wellness - mix of activity, rest, treatments, and learning."
    },

    // ═══════════════════════════════════════════════════════════════
    // ADVENTURE TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    adventure: {
      // EXPLORERS
      cultural_anthropologist: "Cultural adventure - adventurous local experiences, off-grid communities, challenging cultural immersion.",
      urban_nomad: "Urban adventure - parkour spots, urban climbing, city challenges, underground exploration.",
      wilderness_pioneer: "Ultimate wilderness adventure - multi-day trek, mountaineering, expedition-level.",
      digital_explorer: "Tech adventure - drone photography spots, GoPro moments, shareable thrills.",
      flexible_wanderer: "Spontaneous adventure - no fixed plan, say yes to opportunities, organic thrills.",
      // CONNECTORS
      social_butterfly: "Group adventure - adventure tours, meeting fellow thrill-seekers, shared adrenaline.",
      family_architect: "Family adventure - age-appropriate thrills, adventure parks, safe excitement.",
      romantic_curator: "Couples adventure - tandem skydiving, couples surf lessons, bonding through thrills.",
      community_builder: "Purposeful adventure - conservation expeditions, meaningful challenges.",
      // ACHIEVERS
      bucket_list_conqueror: "Bucket list adventure - THE thing you've always wanted to do, epic achievement.",
      adrenaline_architect: "Maximum adventure - extreme everything, pushing limits, ultimate thrills.",
      collection_curator: "Specialist adventure - deep expertise in one activity, skill progression.",
      status_seeker: "Impressive adventure - brag-worthy experiences, exclusive access, Instagram gold.",
      // RESTORERS
      zen_seeker: "Mindful adventure - adventure as meditation, present-moment focus, flow states.",
      retreat_regular: "Recovery adventure - active recovery, challenging but balanced, spa after.",
      beach_therapist: "Water adventure - surfing, diving, kiteboarding, ocean-based thrills.",
      slow_traveler: "Gentle adventure - hiking not climbing, kayaking not rapids, accessible thrills.",
      // CURATORS
      culinary_cartographer: "Food adventure - extreme food experiences, foraging, survival cooking.",
      art_aficionado: "Creative adventure - adventure photography, capturing the extreme, artistic thrills.",
      luxury_luminary: "Luxury adventure - heli-skiing, private guides, premium adventure experiences.",
      // TRANSFORMERS
      eco_ethicist: "Eco adventure - sustainable expeditions, conservation adventures, leave no trace.",
      gap_year_graduate: "Budget adventure - cheap thrills, backpacker adventures, DIY adrenaline.",
      midlife_explorer: "Midlife adventure - proving yourself, new challenges, age-defying experiences.",
      sabbatical_scholar: "Learning adventure - understanding the science, skilled progression, expert instruction.",
      healing_journeyer: "Therapeutic adventure - adventure therapy, overcoming fears, building confidence.",
      retirement_ranger: "Accessible adventure - within physical ability, safe thrills, proving vitality.",
      balanced_story_collector: "Mixed adventure - variety of activities, some intense, some moderate."
    },

    // ═══════════════════════════════════════════════════════════════
    // FOODIE TRIP - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    foodie: {
      // EXPLORERS
      cultural_anthropologist: "Cultural food immersion - understanding food history, traditional techniques, food as culture.",
      urban_nomad: "Street food crawl - neighborhood eating, market hopping, local joints, walking food tour.",
      wilderness_pioneer: "Foraging foodie - wild food, farm visits, source-to-table, outdoor cooking.",
      digital_explorer: "Instagrammable food - aesthetic cafes, trendy spots, viral restaurants, food content.",
      flexible_wanderer: "Spontaneous foodie - no reservations, follow your nose, discover hidden gems.",
      // CONNECTORS
      social_butterfly: "Social food experience - group cooking classes, food tours, communal dining, chef's tables.",
      family_architect: "Family food adventure - kid-friendly cooking classes, food tours with children, teaching food.",
      romantic_curator: "Romantic food journey - couples cooking class, intimate dinners, wine pairings.",
      community_builder: "Community food - home dining experiences, local family meals, food cooperatives.",
      // ACHIEVERS
      bucket_list_conqueror: "Bucket list restaurants - THE places you've always wanted to eat, famous chefs.",
      adrenaline_architect: "Extreme food - bizarre foods, spicy challenges, food adventures, eating dares.",
      collection_curator: "Specialist foodie - deep dive into one cuisine, wine expertise, cheese mastery.",
      status_seeker: "Elite dining - Michelin stars, hard reservations, celebrity chef experiences, bragging rights.",
      // RESTORERS
      zen_seeker: "Mindful eating - slow food, meditation before meals, food as spiritual practice.",
      retreat_regular: "Wellness foodie - healthy gourmet, spa cuisine, nutritional excellence.",
      beach_therapist: "Seafood journey - coastal cuisine, beachside dining, fresh catch, ocean flavors.",
      slow_traveler: "Slow food pilgrimage - long lunches, savoring every bite, meal as destination.",
      // CURATORS
      culinary_cartographer: "Ultimate food obsession - every meal researched, maximum food experiences, total immersion.",
      art_aficionado: "Artistic dining - beautiful presentation, design-forward restaurants, food as art.",
      luxury_luminary: "Luxury gastronomy - tasting menus, rare ingredients, premium wine pairings, five-star dining.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable foodie - farm-to-table, organic, zero-waste restaurants, ethical eating.",
      gap_year_graduate: "Budget foodie - cheap eats, street food, market meals, maximum flavor minimum cost.",
      midlife_explorer: "Culinary awakening - new cuisines, cooking skills, food education, expanding palate.",
      sabbatical_scholar: "Food education - culinary school, understanding technique, wine certifications.",
      healing_journeyer: "Comfort food journey - nourishing meals, food as healing, gentle culinary exploration.",
      retirement_ranger: "Leisurely food tour - long lunches, comfortable dining, accessible restaurants.",
      balanced_story_collector: "Balanced food trip - mix of fine dining, street food, cooking classes, markets."
    },

    // ═══════════════════════════════════════════════════════════════
    // BUSINESS LEISURE (Bleisure) - All 27 Archetypes
    // ═══════════════════════════════════════════════════════════════
    business_leisure: {
      // EXPLORERS
      cultural_anthropologist: "Cultural bleisure - squeeze in museums, historical sites during breaks, evening cultural walks.",
      urban_nomad: "Urban bleisure - explore neighborhoods near conference, walking between meetings, city discovery.",
      wilderness_pioneer: "Active bleisure - morning runs, weekend nature escape, outdoor breaks.",
      digital_explorer: "Tech bleisure - visit tech districts, innovative cafes, work-friendly unique spaces.",
      flexible_wanderer: "Opportunistic bleisure - grab free moments, spontaneous discoveries, flexible exploring.",
      // CONNECTORS
      social_butterfly: "Networking bleisure - client dinners, colleague outings, business social events.",
      family_architect: "Family extension - bring family for weekend after work, kid-friendly additions.",
      romantic_curator: "Partner bleisure - partner joins for weekend, romantic extension after business.",
      community_builder: "Meaningful bleisure - local business connections, community visits during gaps.",
      // ACHIEVERS
      bucket_list_conqueror: "Efficient bleisure - hit major landmarks in limited time, maximize free hours.",
      adrenaline_architect: "Active bleisure - morning workouts, adventure day after conference, active breaks.",
      collection_curator: "Specialist bleisure - visit specific interest during free time, targeted experiences.",
      status_seeker: "Impressive bleisure - best restaurants for client dinners, VIP experiences, show off city.",
      // RESTORERS
      zen_seeker: "Wellness bleisure - hotel yoga, meditation apps, peaceful moments between meetings.",
      retreat_regular: "Spa bleisure - hotel spa after work, wellness morning routine, recovery.",
      beach_therapist: "Beach bleisure - beach lunch break, coastal weekend, ocean time if near water.",
      slow_traveler: "Restful bleisure - don't overschedule free time, quality over quantity, actual rest.",
      // CURATORS
      culinary_cartographer: "Food bleisure - research best restaurants, local specialties, food-focused free time.",
      art_aficionado: "Art bleisure - galleries during lunch, museum after conference, cultural evenings.",
      luxury_luminary: "Premium bleisure - upgrade hotel, expense account dinners, luxury free time.",
      // TRANSFORMERS
      eco_ethicist: "Sustainable bleisure - eco-conscious choices, sustainable restaurants, green options.",
      gap_year_graduate: "Budget bleisure - save per diem, cheap local eats, budget explorations.",
      midlife_explorer: "Meaningful bleisure - make work trips count, quality experiences in limited time.",
      sabbatical_scholar: "Learning bleisure - bookshops, lectures if available, intellectual additions.",
      healing_journeyer: "Gentle bleisure - don't overdo it, rest between work, gentle exploration.",
      retirement_ranger: "N/A - not typical for retirees, redirect to leisure trip.",
      balanced_story_collector: "Balanced bleisure - mix of rest, food, sights in available time."
    }
  };

  const combo = combinations[normalizedTripType]?.[normalizedArchetype];

  if (combo) {
    return `
=== ${tripType.toUpperCase()} + ${archetype.replace(/_/g, ' ').toUpperCase()} ===
${combo}

Synthesize BOTH inputs:
- Trip type (${tripType}) shapes WHAT to include
- Archetype (${archetype}) shapes HOW they experience it
`;
  }

  return '';
}

/**
 * Get the trip type modifier, with fallback to 'none'
 */
export function getTripTypeModifier(tripType: string | undefined | null): TripTypeModifier {
  if (!tripType || tripType === 'undefined' || tripType === 'null') {
    return tripTypeModifiers.none;
  }

  const normalized = tripType.toLowerCase().replace(/[\s-]+/g, '_');
  return tripTypeModifiers[normalized] || tripTypeModifiers.none;
}

/**
 * Build the complete trip type prompt section
 */
export function buildTripTypePromptSection(
  tripType: string | undefined | null,
  archetype: string,
  totalDays: number
): string {
  const modifier = getTripTypeModifier(tripType);
  const interaction = getTripTypeInteraction(tripType || 'none', archetype);

  if (modifier.name === 'Standard Trip' && !interaction) {
    return ''; // No special trip type guidance needed
  }

  let section = `
══════════════════════════════════════════════════════════════════════
                          TRIP TYPE REQUIREMENTS
══════════════════════════════════════════════════════════════════════

${modifier.promptAddition}
`;

  // Add frequency rules
  if (Object.keys(modifier.frequency).length > 0) {
    section += `
=== FREQUENCY RULES ===
${Object.entries(modifier.frequency).map(([key, value]) =>
      `- ${key.replace(/_/g, ' ')}: ${value}`
    ).join('\n')}
`;
  }

  // Add excluded categories
  if (modifier.excludeCategories && modifier.excludeCategories.length > 0) {
    section += `
=== EXCLUDED FOR THIS TRIP TYPE ===
DO NOT include activities in these categories: ${modifier.excludeCategories.join(', ')}
`;
  }

  // Add pacing modifier
  if (modifier.pacingModifier && modifier.pacingModifier !== 0) {
    const pacingDirection = modifier.pacingModifier < 0 ? 'SLOWER' : 'FASTER';
    section += `
=== PACING ADJUSTMENT ===
This trip type requires ${pacingDirection} pacing than normal (modifier: ${modifier.pacingModifier > 0 ? '+' : ''}${modifier.pacingModifier})
${modifier.pacingModifier < -2 ? 'VERY relaxed schedule. Maximum 2-3 activities per day.' : ''}
${modifier.pacingModifier > 0 ? 'More efficient scheduling. Make the most of available time.' : ''}
`;
  }

  // Add max activities if specified
  if (modifier.maxActivitiesPerDay) {
    section += `
HARD LIMIT: Maximum ${modifier.maxActivitiesPerDay} scheduled activities per day for this trip type.
`;
  }

  // Add archetype interaction
  if (interaction) {
    section += interaction;
  }

  // Add upgrade note
  if (modifier.upgradeExperiences) {
    section += `
=== UPGRADE WITHIN BUDGET ===
Elevate experiences within the stated budget tier. Choose the BEST options at their price point.
`;
  }

  // Add critical compliance check based on trip type category
  const normalizedType = (tripType || '').toLowerCase().replace(/[\s-]+/g, '_');
  
  // Group trips
  const groupTripTypes = ['guys_trip', 'girls_trip', 'family', 'bachelorette', 'bachelor'];
  if (groupTripTypes.some(g => normalizedType.includes(g))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: GROUP TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a GROUP trip. The itinerary MUST include:
✓ At least ONE group-focused activity (not something done alone)
✓ At least ONE evening/social option (bar, pub, dinner out, nightlife)
✓ Group-friendly dining (shareable food, not intimate couple spots)
✓ Downtime for group hanging out

⚠️ VIOLATION CHECK:
If this itinerary looks like a SOLO trip or COUPLE trip = REGENERATE
The GROUP nature MUST be OBVIOUS in activity selection and language.

Do NOT use language like "intimate", "romantic", "quiet solo moment"
DO use language like "group-friendly", "perfect for friends", "shared experience"
`;
  }

  // Celebration trips
  const celebrationTypes = ['birthday', 'anniversary', 'honeymoon', 'graduation', 'retirement'];
  if (celebrationTypes.some(c => normalizedType.includes(c))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: CELEBRATION TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a CELEBRATION trip. The itinerary MUST include:
✓ At least ONE clear celebration moment (special dinner, toast, experience)
✓ The occasion should feel SPECIAL, not generic
✓ Something memorable that marks this milestone

⚠️ VIOLATION CHECK:
If this itinerary could be a random vacation with no occasion = REGENERATE
The CELEBRATION nature MUST be OBVIOUS.
`;
  }

  // Romance trips (may overlap with celebration)
  const romanceTypes = ['anniversary', 'honeymoon', 'babymoon'];
  if (romanceTypes.some(r => normalizedType.includes(r))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: ROMANCE TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a ROMANTIC trip. The itinerary MUST include:
✓ Romance/couples focus visible throughout
✓ Activities designed for TWO people together
✓ At least ONE romantic highlight (sunset, special dinner, scenic moment)
✓ Pacing relaxed enough for couples time

⚠️ VIOLATION CHECK:
If this itinerary lacks romantic elements = REGENERATE
Do NOT use language like "solo", "group", "meeting people"
DO use language like "together", "romantic", "intimate", "couples"
`;
  }

  // Purpose-driven trips
  const purposeTypes = ['wellness_retreat', 'wellness', 'adventure', 'foodie', 'culinary'];
  if (purposeTypes.some(p => normalizedType.includes(p))) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: PURPOSE-DRIVEN TRIP COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a PURPOSE-DRIVEN trip (${normalizedType.replace(/_/g, ' ')}). The itinerary MUST:
✓ Make the PURPOSE dominate the itinerary
✓ Show the theme EVERY DAY, not just once
✓ Be immediately recognizable for what it is

⚠️ VIOLATION CHECK:
If someone couldn't immediately identify the trip purpose = REGENERATE
The theme must be OBVIOUS and VISIBLE throughout.
`;
  }

  // Business leisure
  if (normalizedType.includes('business') || normalizedType.includes('bleisure')) {
    section += `
═══════════════════════════════════════════════════════════════════════
              CRITICAL: BUSINESS LEISURE COMPLIANCE CHECK
═══════════════════════════════════════════════════════════════════════

This is a BLEISURE trip. The itinerary MUST:
✓ Keep free-time activities EFFICIENT (not full-day commitments)
✓ Include a quality dinner option for business entertaining
✓ Place activities NEAR likely business/hotel districts
✓ Allow flexibility for work schedule changes

⚠️ VIOLATION CHECK:
If activities require too much time or travel = REGENERATE
The LIMITED FREE TIME reality must be respected.
`;
  }

  return section;
}
