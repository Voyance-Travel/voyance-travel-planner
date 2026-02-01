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
    // Birthday combinations
    birthday: {
      slow_traveler: "Birthday celebration through quality, not quantity. One very special experience done slowly and savored.",
      adrenaline_architect: "Birthday = that bucket list adventure activity they've been wanting. Make it happen.",
      culinary_cartographer: "Birthday dinner at THE restaurant they've been dying to try. Food is the celebration.",
      luxury_luminary: "Full VIP birthday treatment. Champagne, upgrades, the works.",
      flexible_wanderer: "Birthday surprise hidden in a day of wandering. Low-key celebration, big discovery.",
      beach_therapist: "Sunset birthday moment on the beach. Simple but perfect. Maybe a special beachside dinner.",
      social_butterfly: "Birthday with friends/group vibe. Celebration dinner with laughter and connection.",
      cultural_anthropologist: "Birthday immersed in local culture. Special experience that teaches something new.",
      bucket_list_conqueror: "Birthday checking off a major item. Make it significant and memorable."
    },

    // Anniversary combinations
    anniversary: {
      adrenaline_architect: "Adventure anniversary - shared thrills build memories. But include recovery romance time.",
      slow_traveler: "Ultimate slow anniversary. Long meals, no rushing, pure quality time together.",
      bucket_list_conqueror: "Anniversary at dream destination. Still see the sites, but with romantic lens.",
      culinary_cartographer: "Food-focused anniversary. Cooking together, long dinners, wine tastings.",
      beach_therapist: "Beach anniversary - sunset walks, seafood dinners, relaxed togetherness.",
      luxury_luminary: "Elevated anniversary experience. VIP treatment, special touches throughout."
    },

    // Honeymoon combinations
    honeymoon: {
      adrenaline_architect: "Adventure honeymoon - shared thrills build memories. But include recovery and romance time.",
      slow_traveler: "Ultimate slow honeymoon. Long meals, no rushing, pure quality time. They're exhausted - let them rest.",
      bucket_list_conqueror: "Dream destination honeymoon. See the sites, but with romantic lens and rest time.",
      culinary_cartographer: "Food-focused honeymoon. Cooking together, long dinners, wine tastings.",
      beach_therapist: "Beach honeymoon paradise - they need to recover from wedding stress. Sun, rest, togetherness.",
      luxury_luminary: "Full luxury honeymoon. This is their moment - spare nothing within budget.",
      flexible_wanderer: "Wander together honeymoon. Discover places as a newly married couple. Low structure, high romance."
    },

    // Solo trip combinations
    solo: {
      social_butterfly: "Solo but social. Walking tours, group activities, hostel events, pub crawls. Meet people!",
      slow_traveler: "Ultimate solo freedom. Own pace, own choices, no compromise. Pure self-indulgence.",
      flexible_wanderer: "Solo wandering. Complete freedom. Go where the day takes you. No schedule needed.",
      healing_journeyer: "Solo healing journey. Solitude is the point, not loneliness. Meaningful alone time.",
      cultural_anthropologist: "Deep solo cultural immersion. No distractions from learning and absorbing.",
      adrenaline_architect: "Solo adventure - take risks only you want. No group consensus needed.",
      bucket_list_conqueror: "Solo bucket list mission. Focus entirely on what YOU want to see and do."
    },

    // Family combinations  
    family: {
      bucket_list_conqueror: "Family bucket list - but at kid pace. Prioritize ruthlessly. Quality over quantity.",
      adrenaline_architect: "Family adventure - age-appropriate thrills. Water parks, easy hikes, bike rides.",
      culinary_cartographer: "Foodie family - kid-friendly food tours, cooking classes, ice cream missions.",
      beach_therapist: "Beach family vacation - pool time, sandcastles, easy seafood. Kids need downtime.",
      slow_traveler: "Very slow family pace. Kids need even more rest than you do. Accept it.",
      cultural_anthropologist: "Family cultural exploration - kid-friendly museums, interactive history, stories."
    },

    // Girls/Guys trip combinations
    girls_trip: {
      beach_therapist: "Beach girls trip - beach club, sunset cocktails, casual seafood, pool time.",
      culinary_cartographer: "Foodie girls trip - wine tastings, cooking class, long group dinners.",
      social_butterfly: "Social girls trip - nightlife, group activities, meeting new people.",
      adrenaline_architect: "Adventure girls trip - group activity, water sports, shared thrills.",
      luxury_luminary: "Luxe girls trip - spa day, fine dining, VIP treatment."
    },

    guys_trip: {
      adrenaline_architect: "Adventure guys trip - outdoor activities, sports, shared challenges.",
      culinary_cartographer: "Foodie guys trip - brewery tours, BBQ, local specialties, hearty meals.",
      social_butterfly: "Social guys trip - sports bars, pub crawls, meeting locals.",
      beach_therapist: "Beach guys trip - water sports, beach bars, casual seafood.",
      cultural_anthropologist: "Cultural guys trip - historical pubs, local sports match, authentic experiences."
    },

    // Babymoon combinations
    babymoon: {
      beach_therapist: "Beach babymoon - pool, gentle beach time, prenatal massage, rest.",
      slow_traveler: "Ultimate rest babymoon - no schedule, just togetherness before baby.",
      culinary_cartographer: "Gentle foodie babymoon - nice dinners (no raw fish), cooking class.",
      luxury_luminary: "Pampered babymoon - spa, room service, being taken care of."
    },

    // Retirement combinations
    retirement: {
      bucket_list_conqueror: "Finally checking off that big dream destination. No work constraints!",
      slow_traveler: "Ultimate slow retirement trip - no clock, no rush, pure enjoyment.",
      cultural_anthropologist: "Deep cultural immersion they never had time for while working.",
      luxury_luminary: "Well-deserved luxury retirement celebration."
    },

    // Wellness combinations
    wellness: {
      slow_traveler: "Natural wellness fit - already values slow, restorative experiences.",
      adrenaline_architect: "Wellness recovery - they need it even if they resist. Balance the energy.",
      bucket_list_conqueror: "Wellness as reset before next big adventure."
    },

    // Adventure combinations
    adventure: {
      slow_traveler: "Adventure at their pace - not rushed, quality over quantity of activities.",
      culinary_cartographer: "Adventure + food - fuel the adventure with great local eating.",
      social_butterfly: "Group adventures - shared experiences create connection."
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

  return section;
}
