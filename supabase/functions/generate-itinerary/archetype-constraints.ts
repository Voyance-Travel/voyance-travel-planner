// =============================================================================
// ARCHETYPE CONSTRAINTS - What Each Archetype ACTUALLY Means
// =============================================================================
// This module defines explicit behaviors, restrictions, and day structures
// for ALL 27 archetypes. The AI MUST obey these rules.
// =============================================================================

export interface ArchetypeDefinition {
  identity: string;
  category: 'Explorer' | 'Connector' | 'Achiever' | 'Restorer' | 'Curator' | 'Transformer';
  meaning: string;
  avoid: string[];
  prefer?: string[];
  dayStructure: {
    maxScheduledActivities: number;
    minScheduledActivities?: number;
    requiredUnscheduledBlocks?: number;
    unscheduledBlockMinHours?: number;
    minMealDuration?: number;
    minBuffer?: number;
    startTime: string;
    endTime?: string;
    spaOK?: boolean;
    michelinOK?: boolean;
    vipExpected?: boolean;
    nightlifeExpected?: boolean;
    beachTimeMin?: string;
    sunsetRequired?: boolean;
    walkingExpected?: boolean;
  };
}

// =============================================================================
// CATEGORY 1: EXPLORERS (Discovery-Driven)
// =============================================================================

const EXPLORER_ARCHETYPES: Record<string, ArchetypeDefinition> = {
  cultural_anthropologist: {
    identity: "The Cultural Anthropologist",
    category: "Explorer",
    meaning: `
This traveler wants to UNDERSTAND a place, not just see it.

They want:
- Local customs and traditions explained
- Historical context for everything
- Conversations with locals
- Authentic neighborhoods, not tourist zones
- Museums with depth, not gift shops
- Understanding WHY things are the way they are

Their ideal day:
- Morning at a meaningful historical/cultural site
- Lunch where locals eat, chance to observe daily life
- Afternoon in a neighborhood tourists skip
- Evening: local performance, lecture, or home dining experience

WHAT "CULTURAL" MEANS FOR THEM:
- Depth over breadth
- Context over photo ops
- Learning over consuming
- Authentic over staged

VIOLATIONS:
- Tourist trap restaurants = VIOLATION
- Photo-op-only stops = VIOLATION
- Surface-level experiences = VIOLATION
- "See 10 sites in one day" = VIOLATION
`,
    avoid: [
      'Tourist trap restaurants',
      'Photo-op-only attractions',
      'Surface-level tours',
      'Crowded hotspots at peak times',
      'Staged "cultural" performances for tourists',
      'Shopping districts',
      'Luxury experiences (not the point)'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:00',
      spaOK: false
    }
  },

  urban_nomad: {
    identity: "The Urban Nomad",
    category: "Explorer",
    meaning: `
This traveler treats cities as living organisms to explore.

They want:
- Neighborhood hopping
- Street life and people watching
- Urban architecture and design
- Local cafés as home bases
- Walking, walking, walking
- The vibe of a city, not just its landmarks

Their ideal day:
- Start in one neighborhood with coffee
- Walk to another neighborhood (no taxi/metro)
- Discover things en route
- Lunch at a spot they stumble upon
- Afternoon in yet another area
- Evening: rooftop bar or neighborhood haunt

WHAT "URBAN" MEANS FOR THEM:
- Cities are for walking
- Getting lost is good
- Every neighborhood has character
- Street food > sit-down restaurants

VIOLATIONS:
- Driving/taxi between close locations = VIOLATION
- Only visiting "must-see" landmarks = VIOLATION
- Staying in one area all day = VIOLATION
- Nature activities (wrong traveler) = VIOLATION
`,
    avoid: [
      'Organized tours',
      'Taxis for short distances',
      'Nature/outdoor experiences',
      'Staying in one area all day',
      'Generic tourist restaurants',
      'Suburban attractions'
    ],
    dayStructure: {
      maxScheduledActivities: 5,
      walkingExpected: true,
      startTime: '09:00',
      endTime: '23:00',
      spaOK: false
    }
  },

  wilderness_pioneer: {
    identity: "The Wilderness Pioneer",
    category: "Explorer",
    meaning: `
This traveler seeks nature, outdoors, and adventure.

They want:
- Hiking, trekking, trail exploration
- National parks and natural wonders
- Wildlife encounters
- Physical challenges
- Remote locations
- Camping or eco-lodges over hotels

Their ideal day:
- Early start (sunrise if possible)
- Full-day outdoor activity
- Packed lunch on the trail
- Nature photography
- Simple dinner, early bed

WHAT "WILDERNESS" MEANS FOR THEM:
- Cities are for transit, not staying
- Physical exertion is enjoyment
- Remote > accessible
- Nature > culture

VIOLATIONS:
- City-based itineraries = VIOLATION
- Museums and indoor attractions = VIOLATION
- Fancy restaurants = VIOLATION
- Spa/wellness = VIOLATION (they recover outdoors)
- Shopping of any kind = VIOLATION
`,
    avoid: [
      'City attractions',
      'Museums',
      'Fine dining',
      'Spa/wellness',
      'Shopping',
      'Luxury hotels',
      'Crowded tourist sites'
    ],
    dayStructure: {
      maxScheduledActivities: 2,
      startTime: '06:00',
      endTime: '20:00',
      spaOK: false
    }
  },

  digital_explorer: {
    identity: "The Untethered Traveler",
    category: "Explorer",
    meaning: `
This traveler lives the location-free lifestyle. They work remotely, travel constantly, and blend productivity with exploration.

They want:
- Neighborhoods with great WiFi and coworking-friendly cafés
- Experiences they can fit around a flexible work schedule
- Digital nomad hotspots and creative districts
- Modern, design-forward spaces
- Unique photo opportunities worth sharing
- Late starts (night owl tendencies)

Their ideal day:
- Late morning start, coffee at a café with WiFi
- A few hours of work or creative time
- Afternoon exploration — neighborhood walks, street art, modern architecture
- Evening: rooftop bar, night market, or local scene
- Late night exploration

WHAT "UNTETHERED" MEANS FOR THEM:
- Freedom from a fixed location
- Work and travel are not separate
- Modern over historical (unless it's cool)
- Connected but independent
- Experiences that photograph well

VIOLATIONS:
- Early morning group tours = VIOLATION
- Areas with poor connectivity = VIOLATION
- Rigid schedules = VIOLATION
- "Unplugged" or digital detox experiences = VIOLATION
`,
    avoid: [
      'Early morning group tours',
      'Remote areas without WiFi',
      'Rigid time schedules',
      'Unplugged/digital detox experiences',
      'Traditional fine dining (too long)',
      'Conventional tourist itineraries'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '11:00',
      endTime: '24:00',
      spaOK: false
    }
  },

  flexible_wanderer: {
    identity: "The Wildcard",
    category: "Explorer",
    meaning: `
This traveler HATES rigid schedules. They want freedom.

They want:
- Large blocks of UNSCHEDULED time (2-3 hours with no plan)
- Permission to wander and discover
- Options, not obligations
- The freedom to skip anything
- Spontaneous decisions
- No reservations

Their ideal day:
- Wake up whenever
- One anchor activity (maybe)
- Hours of "wander this neighborhood" with no destination
- Stumble upon lunch
- Evening: "explore the area" not "dinner at Y at 7pm"

WHAT FLEXIBLE ACTUALLY MEANS:
- 50% of daylight hours should be UNSCHEDULED
- Use "explore [neighborhood]" not specific venues
- Meals: "find a spot" not reservations
- They may skip everything and that's OK

VIOLATIONS:
- More than 2-3 scheduled activities = VIOLATION
- Back-to-back anything = VIOLATION
- Specific restaurant reservations = VIOLATION
- Hourly scheduling = VIOLATION
- No unscheduled blocks = VIOLATION
`,
    avoid: [
      'Rigid time slots',
      'Back-to-back activities',
      'Restaurant reservations',
      'Guided tours',
      'Advance booking requirements',
      'Packed itineraries',
      'Luxury experiences',
      'Spa treatments',
      'Fine dining',
      'VIP experiences',
      'Private tours'
    ],
    dayStructure: {
      maxScheduledActivities: 2,
      requiredUnscheduledBlocks: 2,
      unscheduledBlockMinHours: 2,
      startTime: '10:00',
      endTime: '20:00',
      spaOK: false,
      michelinOK: false
    }
  }
};

// =============================================================================
// CATEGORY 2: CONNECTORS (Relationship-Driven)
// =============================================================================

const CONNECTOR_ARCHETYPES: Record<string, ArchetypeDefinition> = {
  social_butterfly: {
    identity: "The Social Butterfly",
    category: "Connector",
    meaning: `
This traveler wants to MEET PEOPLE, not just see places.

They want:
- Group tours and activities
- Social dining experiences
- Pub crawls and nightlife
- Cooking classes with others
- Hostel common areas or social hotels
- Meeting locals and other travelers

Their ideal day:
- Group breakfast or morning activity
- Shared experience (class, tour)
- Lunch with people they just met
- Social afternoon activity
- Group dinner
- Nightlife

WHAT "SOCIAL" MEANS FOR THEM:
- Alone time is wasted time
- Group activities over solo
- Conversations over contemplation
- Party hostels over boutique hotels

VIOLATIONS:
- Solo activities = VIOLATION
- Quiet, contemplative experiences = VIOLATION
- Private tours = VIOLATION
- "Hidden gems" that are empty = VIOLATION
`,
    avoid: [
      'Solo activities',
      'Private tours',
      'Quiet/contemplative experiences',
      'Empty "hidden gems"',
      'Meditation/wellness',
      'Museums without guides',
      'Self-guided anything'
    ],
    dayStructure: {
      maxScheduledActivities: 5,
      startTime: '09:00',
      nightlifeExpected: true,
      spaOK: false
    }
  },

  family_architect: {
    identity: "The Family Architect",
    category: "Connector",
    meaning: `
This traveler is building family memories.

They want:
- Kid-friendly activities
- Manageable pacing for children
- Family-friendly restaurants
- Mix of education and fun
- Nap time / rest time built in
- Safe, accessible locations

Their ideal day:
- Start after kids wake (not too early)
- Morning activity (zoo, aquarium, kid museum)
- Early lunch (kids get hungry)
- Rest time / pool time / nap
- Afternoon light activity
- Early dinner
- Maybe one evening activity (gelato walk)

WHAT "FAMILY" MEANS:
- Kids' needs come first
- Energy management matters
- Not every moment needs activities
- Pool time counts as an activity

VIOLATIONS:
- Adult-only venues = VIOLATION
- Fine dining = VIOLATION
- Late-night activities = VIOLATION
- Long walks without breaks = VIOLATION
- "Must-see" that requires 2hr queue = VIOLATION
`,
    avoid: [
      'Adult-only venues',
      'Fine dining',
      'Late-night activities',
      'Long queues',
      'Activities requiring silence',
      'Dangerous/risky experiences',
      'Alcohol-focused venues'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '09:00',
      endTime: '19:00',
      spaOK: false,
      michelinOK: false
    }
  },

  romantic_curator: {
    identity: "The Romantic Curator",
    category: "Connector",
    meaning: `
This traveler is creating romantic moments with a partner.

They want:
- Intimate experiences for two
- Sunset spots
- Candlelit dinners
- Scenic walks
- Couple-focused activities
- Privacy over crowds

Their ideal day:
- Leisurely morning together
- Shared cultural experience
- Romantic lunch with a view
- Afternoon: spa, beach, or scenic spot
- Sunset moment (planned)
- Intimate dinner

WHAT "ROMANTIC" MEANS:
- Atmosphere matters
- Crowds kill the mood
- Sunset is non-negotiable
- One special dinner per trip

VIOLATIONS:
- Group activities = VIOLATION
- Family-focused venues = VIOLATION
- Crowded tourist spots = VIOLATION
- Fast-paced itineraries = VIOLATION
`,
    avoid: [
      'Group tours',
      'Family-focused venues',
      'Crowded attractions at peak times',
      'Fast food',
      'Hostel/budget accommodations',
      'Nightclubs (unless requested)',
      'Solo activities'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      sunsetRequired: true,
      startTime: '09:30',
      spaOK: true
    }
  },

  community_builder: {
    identity: "The Purpose Voyager",
    category: "Connector",
    meaning: `
This traveler wants their trip to MEAN something beyond tourism.

They want:
- Cultural exchange with locals, not just observation
- Supporting local artisans and small businesses directly
- Meaningful homestay or local family dining experiences
- Understanding how people actually live
- Experiences that create mutual benefit
- Leaving a place a little better than they found it

Their ideal day:
- Morning: visit a local artisan workshop or small business
- Lunch with a local family or at a community-run spot
- Afternoon: cultural exchange, local market, or meaningful conversation
- Evening: locally owned restaurant, supporting the neighborhood economy

WHAT "PURPOSE" MEANS FOR THEM:
- Impact over entertainment
- Exchange over observation
- Supporting local economies directly
- Authentic connection, not staged experiences
- They want to understand, not just consume

VIOLATIONS:
- Luxury resort bubbles = VIOLATION
- Chain restaurants/hotels = VIOLATION
- Tourist-only zones = VIOLATION
- Passive sightseeing without connection = VIOLATION
`,
    avoid: [
      'Luxury experiences',
      'Tourist bubbles',
      'Chain businesses',
      'Passive sightseeing',
      'Exploitative "poverty tourism"',
      'Staged authenticity'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '08:00',
      spaOK: false,
      michelinOK: false
    }
  },

  story_seeker: {
    identity: "The Story Seeker",
    category: "Connector",
    meaning: `
This traveler wants the REAL stories. Not the tourist version — the locals-only, off-the-beaten-path, "you won't believe what happened" stories.

They want:
- To be WITH the locals, not observing them
- Off-beaten-path experiences that tourists never find
- The crazy stories — the hidden bar, the secret viewpoint, the local legend
- Authentic human connection, not curated "cultural experiences"
- To come home with stories nobody else has
- The narrative of a place, told by the people who live it

Their ideal day:
- Morning: wander into a neighborhood tourists don't go to
- Coffee at the local spot where regulars know each other
- Lunch: wherever a local recommends on the spot
- Afternoon: follow a lead — someone told them about a place, a person, a thing
- Evening: local bar, live music, wherever the night takes them

WHAT "STORY" MEANS FOR THEM:
- The best stories come from the unexpected
- They'd rather talk to a bartender for 2 hours than see 5 landmarks
- "Hidden gem" isn't a marketing phrase — it's what they actually want
- They collect experiences, not photos
- If it's on a "Top 10" list, they're probably not interested

UNLIKE Cultural Anthropologist (who wants to UNDERSTAND):
- Story Seeker wants to EXPERIENCE, not analyze
- Less academic, more spontaneous
- They follow the moment, not a research agenda

VIOLATIONS:
- Major tourist attractions as the focus = VIOLATION
- Organized group tours = VIOLATION
- "Must-see" lists = VIOLATION
- Tourist-oriented restaurants = VIOLATION
- Curated/staged cultural experiences = VIOLATION
`,
    avoid: [
      'Major tourist attractions as focus',
      'Organized group tours',
      'Must-see lists',
      'Tourist restaurants',
      'Staged cultural experiences',
      'Chain anything',
      'Shopping districts'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '09:30',
      endTime: '23:00',
      spaOK: false,
      michelinOK: false,
      nightlifeExpected: true,
      requiredUnscheduledBlocks: 1
    }
  }
};

const ACHIEVER_ARCHETYPES: Record<string, ArchetypeDefinition> = {
  bucket_list_conqueror: {
    identity: "The Milestone Voyager",
    category: "Achiever",
    meaning: `
This traveler wants to CHECK THINGS OFF. The iconic experiences.

They want:
- The famous landmarks
- The must-sees
- The "I was there" moments
- Photo proof of achievements
- Efficient routing to maximize coverage
- Skip-the-line everything

Their ideal day:
- Early start to beat crowds
- Major landmark #1
- Major landmark #2
- Quick lunch (not the focus)
- Major landmark #3
- Sunset at famous viewpoint
- Dinner wherever

WHAT "BUCKET LIST" MEANS:
- Famous things exist for a reason
- Missing the Colosseum in Rome is failure
- Quantity has quality
- Efficiency is valued

VIOLATIONS:
- Skipping major landmarks = VIOLATION
- "Hidden gems" instead of famous sites = VIOLATION
- Too much downtime = VIOLATION
- Missing the iconic photo = VIOLATION
`,
    avoid: [
      'Skipping major landmarks',
      'Too much relaxation time',
      'Obscure attractions over famous ones',
      'Slow pacing',
      'Long meals'
    ],
    dayStructure: {
      minScheduledActivities: 4,
      maxScheduledActivities: 7,
      startTime: '08:00',
      spaOK: false
    }
  },

  adrenaline_architect: {
    identity: "The Adrenaline Architect",
    category: "Achiever",
    meaning: `
This traveler chases thrills and physical challenges.

They want:
- Adventure activities (skydiving, bungee, etc.)
- Extreme sports
- Physical challenges
- Unique adrenaline experiences
- Active exploration
- Stories to tell

Their ideal day:
- Very early start
- Morning: major adrenaline activity
- Recovery lunch
- Afternoon: secondary active experience
- Evening: recharge for tomorrow

WHAT "ADRENALINE" MEANS:
- If it's not a little scary, it's not enough
- Physical exertion is the point
- Passive sightseeing is boring
- Comfort is not the goal

VIOLATIONS:
- Museums = VIOLATION
- Spa/relaxation = VIOLATION
- Shopping = VIOLATION
- "Leisurely" anything = VIOLATION
- No active experiences = VIOLATION
`,
    avoid: [
      'Museums',
      'Spa/relaxation',
      'Shopping',
      'Leisurely pacing',
      'Passive sightseeing',
      'Fine dining (takes too long)',
      'Cultural performances'
    ],
    dayStructure: {
      minScheduledActivities: 2,
      maxScheduledActivities: 6,
      startTime: '07:00',
      spaOK: false
    }
  },

  collection_curator: {
    identity: "The Passport Collector",
    category: "Achiever",
    meaning: `
This traveler lives to be somewhere NEW. They collect destinations like stamps in a passport.

They want:
- New places, new experiences, new stamps
- The thrill of arrival — touching down somewhere they've never been
- A mix of iconic and unexpected moments
- Flexibility — the vibe might change on the way there
- Being able to say "I've been there, I've done that, I've lived that"
- Travel as identity — this is who they are

Their ideal day:
- Morning: something iconic for this destination
- Lunch: whatever the locals recommend
- Afternoon: explore what makes this place unique
- Evening: experience the local scene

WHAT "COLLECTOR" MEANS FOR THEM:
- It's about BEING somewhere new, not checking boxes
- Every destination adds to who they are
- They're always planning the next trip
- The journey matters as much as the destination
- They adapt to wherever they land

VIOLATIONS:
- Generic tourist itinerary that could be anywhere = VIOLATION
- Ignoring what makes this destination unique = VIOLATION
- Overly rigid scheduling = VIOLATION
`,
    avoid: [
      'Generic sightseeing',
      'Experiences outside their interest area (unless essential)',
      'Surface-level tours',
      'Rushed visits'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:00',
      spaOK: false
    }
  },

  status_seeker: {
    identity: "The VIP Voyager",
    category: "Achiever",
    meaning: `
This traveler wants exclusive, impressive, shareable experiences.

They want:
- VIP access
- Exclusive experiences
- Impressive venues
- Instagram-worthy moments
- Luxury touches
- Stories that impress others

Their ideal day:
- Exclusive breakfast spot
- VIP tour or private access
- Lunch at "the" restaurant
- Impressive afternoon experience
- Sunset at the best viewpoint
- Dinner at hard-to-book restaurant

WHAT "STATUS" MEANS:
- If everyone can do it, it's not special
- Access matters
- The story matters
- Luxury is expected

VIOLATIONS:
- Budget options = VIOLATION
- Crowded tourist experiences = VIOLATION
- Anything "basic" = VIOLATION
`,
    avoid: [
      'Budget restaurants',
      'Crowded tourist lines',
      'Basic experiences',
      'Hostels/budget hotels',
      'Public transit (unless iconic)',
      'Chain anything'
    ],
    dayStructure: {
      maxScheduledActivities: 5,
      startTime: '09:00',
      spaOK: true,
      michelinOK: true,
      vipExpected: true
    }
  }
};

// =============================================================================
// CATEGORY 4: RESTORERS (Wellness-Driven)
// =============================================================================

const RESTORER_ARCHETYPES: Record<string, ArchetypeDefinition> = {
  zen_seeker: {
    identity: "The Zen Seeker",
    category: "Restorer",
    meaning: `
This traveler seeks spiritual and mindfulness experiences.

They want:
- Meditation retreats
- Temples and sacred sites
- Yoga classes
- Mindfulness experiences
- Quiet contemplation
- Spiritual connection

Their ideal day:
- Early morning meditation or yoga
- Visit sacred/spiritual site
- Quiet, mindful lunch
- Afternoon contemplation or practice
- Evening reflection

WHAT "ZEN" MEANS:
- Silence is golden
- Spiritual depth over sightseeing
- Practice over tourism
- Inner journey over outer

VIOLATIONS:
- Nightlife = VIOLATION
- Crowded tourist sites = VIOLATION
- Fast pacing = VIOLATION
- Noise and chaos = VIOLATION
`,
    avoid: [
      'Nightlife',
      'Crowded attractions',
      'Fast-paced itineraries',
      'Noisy venues',
      'Alcohol-focused experiences',
      'Shopping',
      'Adrenaline activities'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '06:00',
      endTime: '21:00',
      spaOK: true
    }
  },

  retreat_regular: {
    identity: "The Wellness Devotee",
    category: "Restorer",
    meaning: `
This traveler wants structured wellness programs.

They want:
- Wellness retreat experiences
- Spa treatments (YES, this IS the spa person)
- Health-focused dining
- Structured relaxation
- Detox/cleanse options
- Professional wellness guidance

Their ideal day:
- Morning wellness activity
- Spa treatment
- Healthy lunch
- Afternoon treatment or class
- Evening: gentle yoga, healthy dinner

WHAT "RETREAT" MEANS:
- Professional wellness, not DIY
- Structured programs welcome
- Health is the priority
- This IS the spa traveler

THIS traveler gets spa. Others don't.

VIOLATIONS:
- Adventure activities = VIOLATION
- Unhealthy food = VIOLATION
- Late nights = VIOLATION
- Alcohol = VIOLATION
- City sightseeing focus = VIOLATION
`,
    avoid: [
      'Adventure activities',
      'Unhealthy dining',
      'Late nights',
      'Alcohol-focused experiences',
      'City sightseeing',
      'Crowded attractions'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '07:00',
      endTime: '21:00',
      spaOK: true
    }
  },

  beach_therapist: {
    identity: "The Beach Therapist",
    category: "Restorer",
    meaning: `
This traveler finds peace at the BEACH, not the SPA.

They want:
- Extended beach/water time (3-4 hours minimum)
- Sunset watching
- Casual seafood meals
- Hammock time
- Ocean sounds
- Simple, natural restoration

THIS IS NOT A SPA PERSON. The BEACH is their therapy.

Their ideal day:
- Late morning start
- Beach by 11am, stay until 4pm
- Casual lunch near water
- Rest
- Sunset somewhere scenic
- Simple dinner, feet in sand if possible

WHAT "BEACH THERAPIST" MEANS:
- Beach = spa for them
- Simple > fancy
- Natural > manufactured
- Ocean > treatment room

VIOLATIONS:
- Spa treatments = VIOLATION
- Wellness centers = VIOLATION
- Luxury hotel amenities = VIOLATION
- Being far from water = VIOLATION
- Packed schedules = VIOLATION
`,
    avoid: [
      'Spa treatments',
      'Wellness centers',
      'Massage',
      'Luxury resort amenities',
      'Fine dining',
      'City activities',
      'Anything far from water',
      'Hotel spas',
      'Hammams',
      'Thermal baths (unless natural hot springs)'
    ],
    dayStructure: {
      maxScheduledActivities: 2,
      beachTimeMin: '3 hours',
      startTime: '10:00',
      sunsetRequired: true,
      spaOK: false,
      michelinOK: false
    }
  },

  slow_traveler: {
    identity: "The Slow Traveler",
    category: "Restorer",
    meaning: `
This traveler savors. They don't collect.

They want:
- Deep experiences over broad coverage
- 2-3 activities MAX per day
- Long meals (90+ minutes)
- Time to sit and watch the world
- Coffee that lasts an hour
- No rushing ever

Their ideal day:
- Wake naturally
- Leisurely breakfast (1 hour)
- ONE meaningful morning activity
- Long lunch (90 min)
- Afternoon wandering or rest
- Evening: one thing OR nothing

WHAT "SLOW" MEANS:
- If choosing between 2 things, choose 1
- Less is always more
- Buffer time is not wasted time
- Sitting in a piazza IS the activity

VIOLATIONS:
- More than 3 activities = VIOLATION
- Meals under 60 min = VIOLATION
- "Quick" anything = VIOLATION
- Rushing = VIOLATION
- Back-to-back = VIOLATION
`,
    avoid: [
      'Packed schedules',
      'Quick meals',
      'Rushing',
      'Must-see lists',
      'Back-to-back activities',
      'Early morning starts',
      'Tour groups'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      minMealDuration: 90,
      minBuffer: 60,
      startTime: '09:30',
      spaOK: false,
      requiredUnscheduledBlocks: 2
    }
  },

  sanctuary_seeker: {
    identity: "The Sanctuary Seeker",
    category: "Restorer",
    meaning: `
This traveler needs peace, quiet, and escape from crowds.

They want:
- Quiet, uncrowded places
- Nature over cities
- Private spaces
- Minimal interaction required
- Refuge from overstimulation
- Solitude as a feature, not a bug

Their ideal day:
- Wake when ready
- Quiet breakfast alone
- Visit uncrowded natural or cultural site
- Solo lunch at peaceful spot
- Afternoon: reading, nature, solitude
- Quiet dinner

WHAT "SANCTUARY" MEANS:
- Crowds = stress
- Quiet = comfort
- Alone time is required
- Introvert-friendly everything

VIOLATIONS:
- Group tours = VIOLATION
- Crowded tourist sites = VIOLATION
- Social activities = VIOLATION
- Nightlife = VIOLATION
- Forced interaction = VIOLATION
`,
    avoid: [
      'Group tours',
      'Crowded attractions',
      'Social/group activities',
      'Nightlife',
      'Noisy restaurants',
      'Popular tourist times',
      'Shared tables'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '09:00',
      endTime: '20:00',
      spaOK: false,
      requiredUnscheduledBlocks: 1
    }
  },

  escape_artist: {
    identity: "The Escape Artist",
    category: "Restorer",
    meaning: `
This traveler is OVERWHELMED and needs to GET AWAY. They're not picky about where — they just need OUT.

They want:
- Escape from their daily life, completely
- A drink in their hand, a book in their hand, feet in the water
- Permission to do absolutely nothing
- The same place five times in a row if it works
- No planning pressure — just GO
- To breathe. Just breathe.

Their ideal day:
- Wake up whenever they wake up
- Coffee or a drink, somewhere with a view
- Maybe walk somewhere. Maybe don't.
- Lunch wherever looks good
- Afternoon: beach, pool, hammock, book
- Dinner: easy, no reservations needed
- Early to bed or sunset drinks — whatever feels right

WHAT "ESCAPE" MEANS FOR THEM:
- They don't care about "seeing everything"
- They'd happily go to the same resort/city again and again
- Routine comfort is MORE appealing than novelty
- They're not lazy — they're DEPLETED
- The point is the ABSENCE of their normal life
- Where'd that person go? That's the whole vibe

UNLIKE Sanctuary Seeker (who needs quiet/solitude):
- Escape Artist might want a busy beach bar — noise is fine if it's NOT their life's noise
- They're escaping stress, not stimulation necessarily
- Social is fine, planned is not

VIOLATIONS:
- Packed itineraries = VIOLATION
- "Must-see" pressure = VIOLATION
- Early morning scheduled activities = VIOLATION
- Complex logistics = VIOLATION
- Anything that feels like OBLIGATION = VIOLATION
`,
    avoid: [
      'Packed itineraries',
      'Must-see pressure',
      'Complex logistics',
      'Early morning schedules',
      'Obligation-feeling activities',
      'Complicated transit',
      'Reservations with strict times'
    ],
    dayStructure: {
      maxScheduledActivities: 2,
      startTime: '10:00',
      endTime: '21:00',
      spaOK: true,
      requiredUnscheduledBlocks: 2,
      unscheduledBlockMinHours: 2
    }
  }
};

const CURATOR_ARCHETYPES: Record<string, ArchetypeDefinition> = {
  culinary_cartographer: {
    identity: "The Culinary Cartographer",
    category: "Curator",
    meaning: `
This traveler plans trips around FOOD.

They want:
- Food markets and local specialties
- Cooking classes
- Restaurant reservations at the best spots
- Food tours
- Understanding local food culture
- Eating where locals eat

Their ideal day:
- Morning: market visit or food tour
- Lunch: local specialty
- Afternoon: cooking class or food exploration
- Dinner: researched restaurant (one splurge per trip OK)

WHAT "CULINARY" MEANS:
- Every meal matters
- Food IS the sightseeing
- Markets > museums
- Local > international

One signature_meal splurge per trip is expected.

VIOLATIONS:
- Generic tourist restaurants = VIOLATION
- Skipping local specialties = VIOLATION
- Fast food = VIOLATION
- Hotel breakfast at budget/chain hotels = VIOLATION (unless exceptional). Luxury hotel restaurants (Four Seasons, Aman, Park Hyatt, Ritz-Carlton, Mandarin Oriental, Peninsula, etc.) are ACCEPTABLE and often PREFERRED for breakfast.
`,
    avoid: [
      'Tourist trap restaurants',
      'Chain restaurants',
      'Skipping meals',
      'Hotel breakfast at budget/chain hotels (luxury hotel restaurants are OK)',
      'International cuisine in a local destination',
      'Fast food'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      minMealDuration: 75,
      startTime: '09:00',
      spaOK: false,
      michelinOK: true
    }
  },

  art_aficionado: {
    identity: "The Art Aficionado",
    category: "Curator",
    meaning: `
This traveler lives for art and design.

They want:
- Major museums with depth
- Gallery hopping
- Architecture tours
- Public art and street art
- Design districts
- Art-focused experiences

Their ideal day:
- Morning: major museum (2-3 hours, not rushed)
- Lunch near the art district
- Afternoon: galleries or architecture walk
- Evening: design-focused dining or performance

WHAT "ART" MEANS:
- Quality time in museums, not rushed
- Lesser-known galleries matter
- Architecture counts
- Design is art

VIOLATIONS:
- Rushing through museums = VIOLATION
- Skipping the main art museum = VIOLATION
- No art experiences in a day = VIOLATION
`,
    avoid: [
      'Rushing through museums',
      'Nature-focused activities',
      'Adventure activities',
      'Sports',
      'Beach time (unless art-related)'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:30',
      spaOK: false
    }
  },

  luxury_luminary: {
    identity: "The Luxury Luminary",
    category: "Curator",
    meaning: `
THIS is the traveler who wants spa, Michelin, VIP.

They expect:
- Premium everything
- Michelin-starred dining
- Spa treatments
- VIP access
- Private tours
- Five-star hotels
- First-class service

For THIS archetype:
- Spa daily is acceptable
- Fine dining every meal is expected
- Price is not mentioned
- "Exclusive" is a feature

Their ideal day:
- Leisurely morning, room service
- Late breakfast at hotel
- Private tour or VIP experience
- Lunch at acclaimed restaurant
- Afternoon spa
- Sunset at exclusive venue
- Michelin dinner

VIOLATIONS:
- Budget options = VIOLATION
- Public transit = VIOLATION
- Crowded attractions = VIOLATION
- "Value" language = VIOLATION
`,
    avoid: [
      'Budget options',
      'Public transit',
      'Crowded attractions',
      'Casual dining',
      'Hostels/budget hotels',
      'Waiting in lines',
      'Value-focused language'
    ],
    dayStructure: {
      maxScheduledActivities: 5,
      startTime: '10:00',
      spaOK: true,
      michelinOK: true,
      vipExpected: true
    }
  },

  history_hunter: {
    identity: "The History Hunter",
    category: "Curator",
    meaning: `
This traveler wants to walk through history.

They want:
- Historical sites with context
- Museums with depth
- Guided tours from expert historians
- Understanding the past
- Layers of history in a place
- Archaeological sites

Their ideal day:
- Morning: major historical site with guide
- Lunch in historic setting
- Afternoon: museum or secondary site
- Evening: historic neighborhood walk

WHAT "HISTORY" MEANS:
- Context matters
- Chronology helps
- Expert guides preferred
- Depth over breadth

VIOLATIONS:
- Modern attractions only = VIOLATION
- Skipping major historical sites = VIOLATION
- Surface-level visits = VIOLATION
`,
    avoid: [
      'Modern-only attractions',
      'Adventure activities',
      'Beach time',
      'Shopping',
      'Nightlife'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:00',
      spaOK: false
    }
  }
};

// =============================================================================
// CATEGORY 6: TRANSFORMERS (Life-Stage Driven)
// =============================================================================

const TRANSFORMER_ARCHETYPES: Record<string, ArchetypeDefinition> = {
  eco_ethicist: {
    identity: "The Mindful Voyager",
    category: "Transformer",
    meaning: `
This traveler prioritizes sustainability and ethics.

They want:
- Eco-friendly accommodations
- Sustainable experiences
- Low carbon footprint
- Supporting local/ethical businesses
- Nature conservation experiences
- Avoiding over-tourism

Their ideal day:
- Local, sustainable breakfast
- Eco-tour or conservation activity
- Lunch at farm-to-table
- Afternoon nature experience
- Evening at locally-owned restaurant

WHAT "ECO" MEANS:
- Environmental impact matters
- Local businesses over chains
- Quality over convenience
- Would rather skip than harm

VIOLATIONS:
- Chain hotels/restaurants = VIOLATION
- High-carbon activities = VIOLATION
- Over-touristed sites without purpose = VIOLATION
- Single-use plastic = VIOLATION
`,
    avoid: [
      'Chain hotels/restaurants',
      'High-carbon activities',
      'Over-touristed sites',
      'Single-use plastic venues',
      'Exploitative tourism',
      'Cruise ships'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '08:00',
      spaOK: false
    }
  },

  gap_year_graduate: {
    identity: "The Horizon Chaser",
    category: "Transformer",
    meaning: `
This traveler is chasing their first big adventure — or their next one. Budget-smart, experience-hungry, and ready for anything.

They want:
- Maximum experiences on a reasonable budget
- Social travel — meeting other travelers and locals
- Street food and authentic local eats over fancy restaurants
- Authentic experiences over comfort
- Stories worth telling
- Nightlife and spontaneous plans

Their ideal day:
- Morning: free walking tour or self-guided exploration
- Street food lunch
- Afternoon: adventure or cultural exploration
- Sunset drinks with new friends
- Night out — local bars, live music, whatever happens

WHAT "HORIZON CHASER" MEANS:
- Budget is smart, not restrictive
- Social energy is high
- Comfort is nice but not the priority
- Experience over everything
- Every trip is an adventure, regardless of age

VIOLATIONS:
- Expensive fine dining = VIOLATION
- Private tours = VIOLATION
- Luxury anything = VIOLATION
- Isolated/solo-only experiences = VIOLATION
`,
    avoid: [
      'Expensive restaurants',
      'Private tours',
      'Luxury hotels',
      'High-cost activities',
      'Isolated experiences',
      'Fine dining'
    ],
    dayStructure: {
      maxScheduledActivities: 5,
      startTime: '09:00',
      nightlifeExpected: true,
      spaOK: false,
      michelinOK: false
    }
  },

  midlife_explorer: {
    identity: "The Rediscovery Traveler",
    category: "Transformer",
    meaning: `
This traveler is in a chapter of reinvention. They're rediscovering themselves through travel.

They want:
- Meaningful experiences that challenge them (gently)
- Comfortable but not excessive — quality matters
- Cultural enrichment and new perspectives
- Self-reflection time built into the day
- Balance of activity and rest
- Experiences that feel like growth, not just tourism

Their ideal day:
- Comfortable morning start
- Meaningful cultural experience (museum, neighborhood, historical site)
- Good lunch — quality matters, not speed
- Afternoon: something new, or time to reflect
- Evening: nice dinner, not rushed

WHAT "REDISCOVERY" MEANS:
- Quality over quantity
- Meaning over checking boxes
- Comfort is reasonable and deserved
- Still adventurous, but intentional
- Travel as a way to find new parts of yourself

VIOLATIONS:
- Backpacker hostels = VIOLATION
- Extreme activities = VIOLATION
- Party focus = VIOLATION
- Rushed itineraries = VIOLATION
`,
    avoid: [
      'Backpacker accommodations',
      'Extreme/dangerous activities',
      'Party/nightclub focus',
      'Rushed itineraries',
      'Youth-focused venues'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:00',
      spaOK: true
    }
  },

  sabbatical_scholar: {
    identity: "The Immersion Seeker",
    category: "Transformer",
    meaning: `
This traveler wants to LIVE through a city, not just pass through it.

They want:
- Museums that tell the story of a place
- Guided tours with expert knowledge
- Monuments and historical sites with real context
- Coffee at the café where a famous writer once worked
- Understanding the layers of history beneath their feet
- Cultural depth — not just eat-and-drink tourism

Their ideal day:
- Morning: museum or major historical/cultural site
- Lunch at a spot with its own story
- Afternoon: walking tour, monument, or historic neighborhood
- Evening: local performance, reading, or reflection at a meaningful venue

WHAT "IMMERSION" MEANS:
- They want to know WHERE they are and WHY it matters
- History lives in the streets, not just museums
- Finding the story in every building, every corner
- Deep understanding over surface-level tourism
- It's not all museums — it's discovering the history woven into everyday places

VIOLATIONS:
- Beach resort focus = VIOLATION
- Pure adventure activities = VIOLATION
- Party focus = VIOLATION
- Surface-level sightseeing = VIOLATION
- Rushing through museums = VIOLATION
`,
    avoid: [
      'Beach/resort focus',
      'Adventure activities',
      'Nightlife',
      'Surface-level sightseeing',
      'Rushed visits to museums'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:00',
      spaOK: false
    }
  },

  healing_journeyer: {
    identity: "The Restoration Seeker",
    category: "Transformer",
    meaning: `
This traveler is processing something — grief, change, recovery.

They want:
- Gentle, restorative experiences
- Meaningful solitude
- Nature and beauty
- Safe spaces
- No pressure
- Permission to feel

Their ideal day:
- Slow morning, no rush
- Gentle walk in nature or beautiful space
- Quiet lunch
- Afternoon: journaling, reflection, or gentle activity
- Evening: peaceful dinner

WHAT "HEALING" MEANS:
- Gentleness is required
- No pressure to "see everything"
- Solitude is OK
- Beauty helps healing
- Space to feel

VIOLATIONS:
- Packed itineraries = VIOLATION
- Party/nightlife = VIOLATION
- Forced social interaction = VIOLATION
- Adrenaline activities = VIOLATION
- "Must-see" pressure = VIOLATION
`,
    avoid: [
      'Packed itineraries',
      'Nightlife',
      'Forced social activities',
      'Adrenaline/extreme experiences',
      'Crowds',
      'Pressure'
    ],
    dayStructure: {
      maxScheduledActivities: 2,
      startTime: '10:00',
      spaOK: false,
      requiredUnscheduledBlocks: 2
    }
  },

  retirement_ranger: {
    identity: "The Boundless Explorer",
    category: "Transformer",
    meaning: `
This traveler has the gift of TIME and they're using every bit of it.

They want:
- Comfortable pacing — no rushing, ever
- Accessible activities that don't require extreme physical effort
- Quality experiences — they've earned them
- Good food, well-chosen restaurants
- Interesting and enriching, but not exhausting
- Time to actually enjoy every moment

Their ideal day:
- Leisurely breakfast — no alarm clock
- One morning activity (not too much walking)
- Nice lunch with no rush
- Afternoon rest or light activity
- Early dinner at a well-chosen spot
- Early evening — comfortable wind-down

WHAT "BOUNDLESS" MEANS:
- Comfort matters — they've earned it
- Accessibility matters — not every experience requires stairs
- No rushing, ever
- Quality over quantity
- They have the freedom to linger

VIOLATIONS:
- Extreme walking distances = VIOLATION
- Late-night activities = VIOLATION
- Budget accommodations = VIOLATION
- Physically demanding experiences = VIOLATION
- Rushed itineraries = VIOLATION
`,
    avoid: [
      'Extreme walking distances',
      'Late-night activities',
      'Budget accommodations',
      'Physically demanding experiences',
      'Youth-focused venues',
      'Nightclubs',
      'Rushed itineraries'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '09:00',
      endTime: '20:00',
      spaOK: true
    }
  },

  balanced_story_collector: {
    identity: "The Balanced Story Collector",
    category: "Transformer",
    meaning: `
This is the fallback / balanced traveler.

They want:
- A bit of everything
- Mix of iconic and local
- Balanced pacing
- Good value
- Flexibility
- Memorable moments

Their ideal day:
- Morning: one significant experience
- Lunch: local spot
- Afternoon: exploration or second activity
- Evening: nice dinner

WHAT "BALANCED" MEANS:
- No strong extremes
- Mix of experiences
- Adaptable
- Open to suggestions

This is the default when no strong archetype emerges.
`,
    avoid: [
      'Extreme luxury',
      'Extreme budget',
      'Extreme pacing (too slow or fast)',
      'Over-specialization'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:00',
      spaOK: false,
      michelinOK: false
    }
  }
};

// =============================================================================
// COMBINED DEFINITIONS
// =============================================================================

export const ARCHETYPE_DEFINITIONS: Record<string, ArchetypeDefinition> = {
  ...EXPLORER_ARCHETYPES,
  ...CONNECTOR_ARCHETYPES,
  ...ACHIEVER_ARCHETYPES,
  ...RESTORER_ARCHETYPES,
  ...CURATOR_ARCHETYPES,
  ...TRANSFORMER_ARCHETYPES
};

// Default for archetypes not explicitly defined
const DEFAULT_DEFINITION: ArchetypeDefinition = {
  identity: "Balanced Traveler",
  category: "Transformer",
  meaning: "A balanced approach to travel with no extreme preferences.",
  avoid: [],
  dayStructure: {
    maxScheduledActivities: 4,
    startTime: '09:00',
    spaOK: false,
    michelinOK: false
  }
};

/**
 * Get archetype definition, falling back to default if not found
 */
export function getArchetypeDefinition(archetype: string | undefined): ArchetypeDefinition {
  if (!archetype) return DEFAULT_DEFINITION;
  
  let normalized = archetype.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

  // Legacy archetype merges
  if (normalized === 'curated_luxe') normalized = 'status_seeker';

  return ARCHETYPE_DEFINITIONS[normalized] || DEFAULT_DEFINITION;
}

// =============================================================================
// WHO GETS WHAT - Quick Reference for Prompt Building
// =============================================================================

export function canHaveSpa(archetype: string | undefined): boolean {
  const def = getArchetypeDefinition(archetype);
  return def.dayStructure.spaOK === true;
}

export function canHaveMichelin(archetype: string | undefined): boolean {
  const def = getArchetypeDefinition(archetype);
  return def.dayStructure.michelinOK === true;
}

export function needsUnscheduledBlocks(archetype: string | undefined): boolean {
  const def = getArchetypeDefinition(archetype);
  return (def.dayStructure.requiredUnscheduledBlocks ?? 0) > 0;
}

export function getMaxActivities(archetype: string | undefined): number {
  const def = getArchetypeDefinition(archetype);
  return def.dayStructure.maxScheduledActivities;
}

// =============================================================================
// PROMPT BUILDING FUNCTIONS
// =============================================================================

/**
 * Build archetype constraints block for prompt
 */
export function buildArchetypeConstraintsBlock(archetype: string | undefined): string {
  const definition = getArchetypeDefinition(archetype);
  
  if (!archetype || definition === DEFAULT_DEFINITION) {
    return '';
  }
  
  const lines: string[] = [];
  lines.push(`${'='.repeat(60)}`);
  lines.push(`🎭 ARCHETYPE IDENTITY: ${definition.identity}`);
  lines.push(`   Category: ${definition.category}`);
  lines.push(`${'='.repeat(60)}`);
  lines.push('');
  lines.push(definition.meaning.trim());
  lines.push('');
  
  if (definition.avoid.length > 0) {
    lines.push(`❌ THIS TRAVELER SPECIFICALLY DOES NOT WANT:`);
    lines.push(`${'─'.repeat(40)}`);
    for (const item of definition.avoid) {
      lines.push(`   - ${item}`);
    }
    lines.push('');
    lines.push(`   These are NOT suggestions. Violating these = FAILED itinerary.`);
    lines.push('');
  }
  
  if (definition.prefer && definition.prefer.length > 0) {
    lines.push(`✅ THIS TRAVELER WANTS:`);
    lines.push(`${'─'.repeat(40)}`);
    for (const item of definition.prefer) {
      lines.push(`   - ${item}`);
    }
    lines.push('');
  }
  
  lines.push(`📐 DAY STRUCTURE RULES:`);
  lines.push(`${'─'.repeat(40)}`);
  lines.push(`   Max scheduled activities: ${definition.dayStructure.maxScheduledActivities}`);
  if (definition.dayStructure.minScheduledActivities) {
    lines.push(`   Min scheduled activities: ${definition.dayStructure.minScheduledActivities}`);
  }
  lines.push(`   Day starts: ${definition.dayStructure.startTime}`);
  if (definition.dayStructure.endTime) {
    lines.push(`   Day ends: ${definition.dayStructure.endTime}`);
  }
  
  if (definition.dayStructure.requiredUnscheduledBlocks) {
    lines.push(`   ⚠️ Required unscheduled blocks: ${definition.dayStructure.requiredUnscheduledBlocks} (min ${definition.dayStructure.unscheduledBlockMinHours || 2}h each)`);
  }
  if (definition.dayStructure.minMealDuration) {
    lines.push(`   Minimum meal duration: ${definition.dayStructure.minMealDuration} minutes`);
  }
  if (definition.dayStructure.minBuffer) {
    lines.push(`   Minimum buffer between activities: ${definition.dayStructure.minBuffer} minutes`);
  }
  if (definition.dayStructure.sunsetRequired) {
    lines.push(`   ⚠️ Sunset moment: REQUIRED`);
  }
  if (definition.dayStructure.beachTimeMin) {
    lines.push(`   ⚠️ Beach time: minimum ${definition.dayStructure.beachTimeMin}`);
  }
  
  // SPA/MICHELIN/VIP permissions
  lines.push('');
  lines.push(`🚦 PERMISSIONS FOR THIS ARCHETYPE:`);
  lines.push(`   Spa treatments: ${definition.dayStructure.spaOK ? '✅ ALLOWED' : '❌ NOT ALLOWED'}`);
  lines.push(`   Michelin dining: ${definition.dayStructure.michelinOK ? '✅ ALLOWED' : '❌ NOT ALLOWED'}`);
  lines.push(`   VIP/Private tours: ${definition.dayStructure.vipExpected ? '✅ EXPECTED' : '⚪ Only if requested'}`);
  lines.push('');
  
  return lines.join('\n');
}

// =============================================================================
// TRIP-WIDE VARIETY RULES
// =============================================================================

export function buildTripWideVarietyRules(archetype: string | undefined): string {
  const definition = getArchetypeDefinition(archetype);
  const isLuxury = definition.dayStructure.spaOK && definition.dayStructure.michelinOK;
  
  if (isLuxury) {
    return `
=== TRIP-WIDE VARIETY (LUXURY TIER) ===
Spa and fine dining frequency is relaxed for this archetype.
Still ensure variety in experiences (not just spa + dinner repeat).
`;
  }
  
  return `
=== TRIP-WIDE VARIETY RULES (ENFORCED) ===

NO REPETITION:
- Maximum 1 spa/wellness experience PER TRIP (unless Luxury Luminary/Wellness Devotee/Zen Seeker)
- Maximum 1 Michelin restaurant PER TRIP (unless Luxury Luminary/Culinary Cartographer)
- Maximum 1 cooking class PER TRIP
- Maximum 1 wine/cocktail "experience" PER TRIP (casual drinks don't count)
- Maximum 3 museums PER TRIP (for trips under 7 days)
- Maximum 1 "sunset experience" activity PER TRIP

NO SAME-CATEGORY BACK-TO-BACK:
- Never two museums on the same day
- Never two churches/temples in a row
- Never two "shopping" activities in a row
- Never two formal "dining experiences" in a row (casual meals are different)

VARIETY CHECK:
Before finalizing, verify each day has different vibes:
- Mix indoor/outdoor
- Mix active/passive  
- Mix cultural/sensory
- Mix planned/spontaneous

If any rule is violated, replace the duplicate with something different.
`;
}

// =============================================================================
// UNSCHEDULED TIME RULES
// =============================================================================

export function buildUnscheduledTimeRules(archetype: string | undefined, pace: number): string {
  const definition = getArchetypeDefinition(archetype);
  const needsUnscheduled = (definition.dayStructure.requiredUnscheduledBlocks ?? 0) > 0 || pace <= -3;
  
  if (!needsUnscheduled) {
    return '';
  }
  
  return `
=== UNSCHEDULED TIME (REQUIRED) ===

This traveler needs FREEDOM. Your itinerary must include:

UNSCHEDULED BLOCKS:
- Minimum ${definition.dayStructure.requiredUnscheduledBlocks || 2} blocks of ${definition.dayStructure.unscheduledBlockMinHours || 2}+ hours with NO specific activity
- Label these as "Free time to explore [neighborhood]"
- Do NOT fill this with suggestions
- Do NOT schedule a backup plan

EXAMPLE OF CORRECT UNSCHEDULED BLOCK:
"14:00 - 17:00: Free time to wander Trastevere
  No agenda. Get lost. Find your own lunch. Sit in a piazza. 
  This is not wasted time — this IS the experience."

EXAMPLE OF INCORRECT (DO NOT DO THIS):
"14:00 - 17:00: Flexible Exploration Time
  - Option A: Visit Palazzo Corsini
  - Option B: Shop on Via della Scala  
  - Option C: Coffee at Bar San Calisto"

The second example is NOT unscheduled. It's a menu. Don't do that.

For meals during unscheduled time:
- "Find lunch in Trastevere" ✓
- "Lunch at Osteria da Fortunata at 1:30pm" ✗
`;
}

// =============================================================================
// ACTIVITY NAMING RULES (ANTI-GAMING)
// =============================================================================

export function buildNamingRules(): string {
  return `
=== ACTIVITY NAMING (ANTI-GAMING) ===

DO NOT name activities after the archetype. This is manipulation, not personalization.

WRONG:
- "Wildcard Boutique Hunt"
- "Slow Traveler Coffee Moment"  
- "Beach Therapist Sunset Session"
- "Cultural Anthropologist Market Tour"
- "Zen Seeker Meditation Walk"

RIGHT:
- "Browse vintage shops in Monti"
- "Coffee at Sant'Eustachio"
- "Sunset at Piazzale Michelangelo"
- "Explore Campo de' Fiori Market"
- "Morning meditation at the temple"

The archetype shapes WHAT you choose, not what you CALL it.

If the archetype name appears in an activity title, you have FAILED.

Also avoid:
- "Curated" anything (pretentious)
- "Experience" as noun unless it's an actual experience (cooking class = OK, "walking experience" = NO)
- "Journey" "Discovery" "Exploration" as activity names
- Marketing language: "Authentic", "Hidden Gem", "Local Secret"

ALSO BANNED: promotional adjectives that make activity titles sound like ad copy:
- "Elite" (e.g., "Elite Comedy Performance" → just "Comedy Show at [venue name]")
- "Premium" (e.g., "Premium Dining" → "Dinner at [restaurant]")
- "World-Class" / "World Class"
- "Signature" (unless it's literally a signature dish name)
- "Exclusive" / "VIP" (unless the activity genuinely is a VIP ticket)
- "Unforgettable" / "Spectacular" / "Iconic"
- "Immersive" (unless it's literally an immersive theater/art show)
- "Ultimate" / "Quintessential"
- "Artisan" / "Artisanal" (unless it's literally an artisan workshop)

NAMING PRINCIPLE: Write titles like a knowledgeable friend would text them to you, not like a tourism brochure.

GOOD: "Comedy show at Comedy Cellar", "Dinner at Carbone", "Walk across Brooklyn Bridge"
BAD: "Elite Comedy Performance", "Signature Italian Dining Experience", "Iconic Bridge Crossing"

If a venue has a real name, USE IT in the title. "Dinner at Joe's Pizza" beats "Authentic NYC Pizza Experience" every time.
`;
}

// =============================================================================
// PACING ENFORCEMENT
// =============================================================================

export function buildPacingRules(pace: number): string {
  if (pace <= -4) {
    return `
=== PACING: VERY SLOW (pace: ${pace}) ===

HARD LIMITS:
- Maximum 2 scheduled activities per day
- Day starts at 10:00 AM or later
- Day ends by 20:00
- Minimum 90-minute lunch
- Minimum 60-minute buffers between ANY activities
- At least one 2+ hour unscheduled block

WHAT THIS LOOKS LIKE:
10:00 - Wake, leisurely breakfast at hotel
12:00 - ONE morning activity (museum, landmark)
14:00 - Long lunch (90 min)
15:30 - Free time / rest / wander
18:30 - Aperitivo
20:00 - Dinner (casual, no reservation needed)

THAT'S IT. 2 real activities. The rest is living.

VIOLATIONS (if any of these happen, REGENERATE):
- 3+ scheduled activities = VIOLATION
- Activity before 10am = VIOLATION
- Buffer under 60 min = VIOLATION
- No unscheduled block = VIOLATION
`;
  } else if (pace <= -1) {
    return `
=== PACING: SLOW (pace: ${pace}) ===

LIMITS:
- Maximum 3-4 scheduled activities per day
- Day starts at 09:30 or later
- Minimum 60-minute lunch
- Minimum 45-minute buffers between activities
- Include at least one rest/wander block

A slower pace means MORE downtime, not just fewer activities.
`;
  } else if (pace >= 4) {
    return `
=== PACING: FAST (pace: ${pace}) ===

This traveler wants to maximize their trip:
- 5-7 activities per day acceptable
- Can start at 07:00-08:00
- 20-30 minute buffers sufficient
- Pack it in, they want to see everything
- Efficient routing matters

HARD RULES (Fast-Paced — VIOLATIONS REQUIRE REGENERATION):
- NO midday "Freshen Up" / hotel-return blocks. The traveler chains activity → activity. A pre-dinner freshen-up is only acceptable if it's ≤30 minutes AND the next activity requires a dress change (e.g. fine-dining reservation, performance).
- NO unscheduled "free time to explore" blocks. Fast-Paced means scheduled, not loose.
- Idle gap >60 min between consecutive activities = VIOLATION. Fill it with a real activity, food stop, or shorter buffer.
- Buffers between consecutive activities should be ≤20 min unless real transit requires more.
- Every meal slot MUST name a real venue. "Find a local spot" / "Breakfast — find a spot" placeholders = VIOLATION; pick a specific cafe, restaurant, or market.
`;
  }

  return `
=== PACING: MODERATE (pace: ${pace}) ===
- 4-5 activities per day
- 45-minute buffers between activities
- Start around 09:00
- Balance of must-sees and relaxation
`;
}

// =============================================================================
// BUDGET REALITY CHECK
// =============================================================================

export function buildBudgetConstraints(budgetTier: string | undefined, budgetScore: number): string {
  const tier = budgetTier?.toLowerCase() || 'moderate';
  
  // Value-focused: budget tier OR positive budget score
  if (tier === 'budget' || budgetScore >= 3) {
    return `
=== BUDGET: VALUE-FOCUSED (tier: ${tier}, score: ${budgetScore}) ===

THIS TRAVELER DOES NOT WANT:
- Michelin-starred restaurants (€€€€)
- Hotel rooftop bars (overpriced for views)
- Spa treatments (expensive + usually not their vibe)
- Luxury anything
- "Premium" experiences
- VIP access
- Private tours
- Anything described as "exclusive"

THIS TRAVELER WANTS:
- Local trattorias and osterias (€15-30 per person)
- Neighborhood bars locals actually go to
- Free attractions (churches, piazzas, parks, viewpoints)
- Street food and markets
- Self-guided exploration
- Value for money

PRICE LIMITS (per person):
- Lunch: under €20-25
- Dinner: under €40
- Activities: under €25
- No single expense over €50 unless it's a landmark entry fee

REALITY CHECK:
If you include a €180 dinner, you have FAILED.
If you include a €200 spa treatment, you have FAILED.
If you suggest Hotel Hassler rooftop bar, you have FAILED.

Price IS a feature. Highlight good value.
`;
  }
  
  // Luxury: luxury tier OR very negative budget score
  if (tier === 'luxury' || tier === 'premium' || budgetScore <= -5) {
    return `
=== BUDGET: LUXURY (tier: ${tier}, score: ${budgetScore}) ===

Luxury means QUALITY and TASTE, not unlimited spending or absurd opulence.

WHAT LUXURY LOOKS LIKE:
- 4-5 star boutique hotels (not the most expensive option, the BEST option)
- 1-2 Michelin or fine dining meals PER TRIP (not every meal)
- Skip-the-line tickets and private guides WHERE IT ADDS VALUE
- Private transfers for long distances (taxis are fine for short trips)
- Quality over quantity in every choice

WHAT LUXURY DOES NOT MEAN:
- Helicopters to dinner
- $500+ meals every night
- VIP everything
- Gold-plated experiences
- Spending for the sake of spending
- Total trip costs over $6,000 for 15 days

DAILY TARGET: ~$250-400/person/day (including accommodation)
TOTAL TRIP TARGET (15 days): ~$4,000-$6,000/person

MIX HIGH AND LOW:
- Michelin lunch → street food snack later
- Private museum tour → public park walk
- Luxury hotel → local neighborhood café for breakfast
- Fine wine bar → sunset from a free viewpoint

Luxury travelers still appreciate authentic local experiences.
A $5 gelato from the best shop in town IS a luxury experience.
`;
  }
  
  // Moderate: middle ground
  return `
=== BUDGET: MODERATE (tier: ${tier}, score: ${budgetScore}) ===

LIMITS:
- Maximum 1 "splurge" meal per trip (€80+ per person)
- No Michelin-starred restaurants unless specifically requested or signature_meal slot
- Avoid hotel restaurants at 5-star properties unless hotel guest
- Avoid private tours unless specifically requested

PREFER:
- Well-reviewed local restaurants (€25-50 per person)
- Highly-rated affordable experiences
- Quality over flash
- Balance of free and paid activities

Don't use "luxury" or "premium" in descriptions.
`;
}

// =============================================================================
// COMBINED CONSTRAINTS BUILDER
// =============================================================================

export function buildAdventureRules(adventure: number, destination?: string): string {
  if (!adventure || adventure < 4) return '';

  const isThrillSeeker = adventure >= 7;
  const dest = (destination || '').toLowerCase();

  // City-aware adrenaline examples
  const cityExamples: Record<string, string[]> = {
    rome: ['Vespa or e-scooter tour through the historic center', 'e-bike along the Appian Way', 'Tiber kayak/SUP session', 'Gladiator School training (Gruppo Storico Romano)', 'go-karts at Pista La Pista', 'helicopter sightseeing over the city', 'catacombs after-hours/underground crawl'],
    paris: ['e-bike or Vespa tour', 'Seine kayak session', 'climbing gym (Arkose / MurMur)', 'go-karts at RKC Roissy', 'helicopter tour over Île-de-France'],
    barcelona: ['Sailing/SUP off Barceloneta', 'e-bike Montjuïc tour', 'tandem paragliding above the coast', 'Vespa city tour', 'climbing at Sharma Climbing'],
    london: ['ThamesJet speedboat ride', 'e-bike Hyde Park & Royal Parks loop', 'Vertical Chill ice climbing', 'go-karts at Team Sport', 'helicopter London tour'],
    tokyo: ['Akihabara go-kart street tour', 'Mt. Takao trail run/hike', 'Tokyo Bay kayak', 'B Pump bouldering gym'],
    'new york': ['Helicopter Manhattan tour', 'Hudson kayak session', 'The Cliffs climbing gym', 'Citi Bike/electric bike tour through the boroughs'],
    'cape town': ['Table Mountain hike & abseil', 'Shark cage diving', 'Lion\'s Head sunrise hike', 'Cape Point e-bike or motorcycle tour'],
  };

  const matchedCity = Object.keys(cityExamples).find(k => dest.includes(k));
  const examples = matchedCity
    ? cityExamples[matchedCity]
    : ['guided bike or e-bike tour', 'kayak/SUP session', 'climbing gym', 'paragliding/ziplining', 'scooter or motorcycle tour', 'helicopter sightseeing', 'underground/ghost tunnel night crawl'];

  return `
=== 🧗 ADVENTURE / THRILL-SEEKER MODE (adventure trait = +${adventure}) ===

This traveler explicitly slid the Adventure dial to +${adventure}. They want KINETIC, BOLD experiences — not sightseeing dressed up as adventure.

${isThrillSeeker ? 'THRILL-SEEKER (+7 to +10): MINIMUM 2 kinetic/adrenaline experiences across the trip, with at least 1 in the first 3 days.' : 'ADVENTUROUS (+4 to +6): MINIMUM 1 kinetic/edge experience in the trip.'}

✅ THESE COUNT as adventure:
- Vespa / scooter / e-bike / motorcycle tours
- Kayak, SUP, sailing, speedboat, jet boat, rafting
- Climbing gym, bouldering, via ferrata, rappelling
- Paragliding, ziplining, skydiving, hot-air ballooning
- Helicopter sightseeing
- Go-karts, racing experiences
- Hike-and-scramble routes (e.g. Table Mountain, Pedraforca)
- Catacombs / underground / ghost-tunnel night tours
- Combat / movement workshops (gladiator school, MMA, parkour)

❌ THESE DO NOT COUNT — never satisfy the adventure slot with these:
- Parks, gardens, fountains, scenic walks
- Markets, shopping, cafés, gelato stops
- Museums, galleries, churches, archaeological sites (unless paired with a kinetic component like an underground crawl)
- Standard guided walking tours
- Spa/wellness/thermal baths

CITY-APPROPRIATE EXAMPLES${matchedCity ? ` for ${matchedCity}` : ''}:
${examples.map(e => `- ${e}`).join('\n')}

TAGGING REQUIREMENT: Each adventure activity MUST include at least one of these tags in personalization.tags: ['kinetic', 'adrenaline', 'thrill', 'adventure', 'climbing', 'kayak', 'vespa', 'bike-tour', 'helicopter', 'paragliding', 'zipline', 'go-kart', 'speedboat'].
`;
}

export function buildAuthenticityRules(authenticity: number, destination?: string): string {
  if (!authenticity || authenticity < 3) return '';

  const isLocalOnly = authenticity >= 6;
  const dest = (destination || '').toLowerCase();

  // City-aware neighborhoods, local venues, and forbidden tourist traps
  const cityGuide: Record<string, { hoods: string[]; venues: string[]; banned: string[] }> = {
    rome: {
      hoods: ['Testaccio', 'Pigneto', 'Garbatella', 'Monti', 'Quadraro', 'San Lorenzo', 'Trastevere back-streets (avoid the main piazza tourist strip)'],
      venues: ['SantoPalato', 'Trattoria Pennestri', 'Armando al Pantheon', 'Da Felice a Testaccio', 'Mordi e Vai', 'Trapizzino Testaccio', 'Litro (enoteca)', 'Il Goccetto (enoteca)', 'Marigold (Ostiense)', 'Trecca'],
      banned: ['Trevi Fountain dining/photo-op as a stand-alone slot', 'Spanish Steps shops/restaurants', 'Piazza Navona tourist-menu trattorias', 'La Pergola', 'Cavalieri rooftop dining', 'Hard Rock Cafe', 'restaurants on Via della Conciliazione'],
    },
    paris: {
      hoods: ['Belleville', 'Canal Saint-Martin', 'Batignolles', 'Ménilmontant', '11e back-streets', 'Aligre / 12e'],
      venues: ['Le Servan', 'Le Baratin', 'Clamato', 'Septime Cave', 'Marché d\'Aligre vendors', 'wine bars in the 11e'],
      banned: ['Champs-Élysées restaurants', 'Eiffel Tower restaurants (Jules Verne aside, only if luxury archetype)', 'Café de la Paix', 'tourist menus near Notre-Dame'],
    },
    barcelona: {
      hoods: ['Gràcia', 'Poblenou', 'Sant Antoni', 'El Born back-streets', 'Sants'],
      venues: ['Bar del Pla', 'Quimet & Quimet', 'Cañete', 'Bar Cañete', 'Els Sortidors del Parlament', 'Bodega 1900'],
      banned: ['restaurants on La Rambla', 'Port Vell tourist chains', 'paella spots in Barceloneta tourist strip'],
    },
    london: {
      hoods: ['Hackney', 'Peckham', 'Brixton', 'Stoke Newington', 'Bermondsey'],
      venues: ['Brunswick House', 'P. Franco', 'Quality Wines', 'Mangal 2', 'Sweetings', 'Maremma'],
      banned: ['Leicester Square restaurants', 'M&M\'s World food', 'tourist pubs around Big Ben'],
    },
    tokyo: {
      hoods: ['Shimokitazawa', 'Yanaka', 'Koenji', 'Kiyosumi-Shirakawa', 'Sangenjaya'],
      venues: ['neighborhood izakaya in Yanaka', 'kissaten cafés in Koenji', 'standing sushi bars off Shibuya'],
      banned: ['Shibuya Crossing chain restaurants', 'Tokyo Tower observation-deck dining as the meal'],
    },
    'new york': {
      hoods: ['Greenpoint', 'Sunset Park', 'Astoria', 'Crown Heights', 'East Village back-streets'],
      venues: ['Lucali', 'Win Son', 'Hometown Bar-B-Que', 'Frenchette', 'Cervo\'s', 'Wildair'],
      banned: ['Times Square restaurants', 'Bubba Gump', 'Olive Garden Times Square', 'tourist diners in Midtown'],
    },
    lisbon: {
      hoods: ['Graça', 'Marvila', 'Campo de Ourique', 'Anjos', 'Alvalade'],
      venues: ['Taberna Sal Grosso', 'Prado Mercearia', 'A Cevicheria (off-strip)', 'Senhor Uva', 'O Velho Eurico'],
      banned: ['restaurants on Rua Augusta', 'Time Out Market as the only meal experience', 'fado tourist dinners in Bairro Alto strip'],
    },
    'mexico city': {
      hoods: ['Roma Norte', 'Condesa back-streets', 'Coyoacán', 'San Rafael', 'Juárez'],
      venues: ['Contramar (off-tourist hours)', 'Expendio de Maíz', 'Lardo', 'Maximo Bistrot', 'Mercado de Medellín taqueros'],
      banned: ['Zócalo tourist restaurants', 'Sanborns chains', 'mariachi-square tourist dinners'],
    },
  };

  const matched = Object.keys(cityGuide).find(k => dest.includes(k));
  const guide = matched ? cityGuide[matched] : null;

  return `
=== 🏘️ AUTHENTICITY / LOCAL EXPLORER MODE (authenticity trait = +${authenticity}) ===

This traveler explicitly slid the Authenticity dial to +${authenticity}. They want REAL local life — not curated tourist beats dressed up as "hidden gems".

${isLocalOnly
  ? `LOCAL-ONLY (+6 to +10): Each day MUST include at least 2 genuinely local experiences. HARD CAP: at most 1 marquee landmark across the WHOLE TRIP.`
  : `LOCAL EXPLORER (+3 to +5): Each day MUST include at least 1 genuinely local, non-touristy experience. AT MOST 1 famous landmark per day, and it must be paired with a deep local follow-up (e.g. landmark in the morning → meal in a residential neighborhood).`}

✅ THESE COUNT as authentic / local:
- Family-run trattorias, osterias, enoteche, bistros (not chains, not hotel restaurants)
- Neighborhood markets where locals shop (not Instagram "food halls")
- Residential / non-tourist piazzas, parks, and viewpoints
- Independent wine bars, natural-wine spots, working-class bars
- Workshops with actual artisans (not "tourist crafts class")
- Walks through residential districts away from the main attractions

❌ THESE DO NOT COUNT — never satisfy the authenticity slot with these:
- Famous landmarks visited as photo-ops
- Hotel restaurants and chain Michelin destinations marketed to tourists
- Restaurants on the main tourist drags (within 200m of marquee landmarks)
- Tourist menus, multi-language laminated menus, hawkers
- Generic "food tours" that hit only the famous beats
- Luxury rooftops aimed at tourists

${guide ? `NEIGHBORHOOD TARGETS for ${matched}:
${guide.hoods.map(h => `- ${h}`).join('\n')}

LOCAL VENUE EXAMPLES (use these or similar real, non-touristy spots):
${guide.venues.map(v => `- ${v}`).join('\n')}

🚫 HARD-BANNED for this traveler:
${guide.banned.map(b => `- ${b}`).join('\n')}` : `Pick residential neighborhoods away from the main tourist core. Favor family-run venues with local-language menus.`}

TAGGING REQUIREMENT: Each "local" activity MUST include at least one of these tags in personalization.tags: ['neighborhood', 'family-run', 'osteria', 'trattoria', 'enoteca', 'non-touristy', 'hidden-gem', 'local-favorite'].
`;
}

export function buildAllConstraints(
  archetype: string | undefined,
  budgetTier: string | undefined,
  traits: { pace: number; budget: number; adventure?: number; authenticity?: number },
  destination?: string
): string {
  const sections: string[] = [];

  sections.push(buildArchetypeConstraintsBlock(archetype));
  sections.push(buildTripWideVarietyRules(archetype));
  sections.push(buildUnscheduledTimeRules(archetype, traits.pace));
  sections.push(buildPacingRules(traits.pace));
  sections.push(buildBudgetConstraints(budgetTier, traits.budget));
  sections.push(buildAdventureRules(traits.adventure ?? 0, destination));
  sections.push(buildAuthenticityRules(traits.authenticity ?? 0, destination));
  sections.push(buildNamingRules());
  
  // Add final validation block
  sections.push(`
=== VALIDATION BEFORE FINALIZING ===

Check every activity against:
1. Does this violate the archetype's avoid list? → REMOVE IT
2. Does this violate budget limits? → REMOVE IT
3. Is spa included but spaOK = false? → REMOVE IT
4. Is Michelin included but michelinOK = false? → REMOVE IT
5. Does this repeat something from another day? (spa, Michelin, etc.) → REMOVE IT
6. Is the pacing too packed for this traveler? → REMOVE activities
7. Is there required unscheduled time? → ADD IT
8. Is the archetype name in the activity title? → RENAME IT
9. Are there "luxury/premium/exclusive" words for a non-luxury traveler? → REMOVE them
10. Adventure trait ≥ +4 — is there at least one KINETIC adventure activity (not park/fountain/market)? → If missing, ADD one.

If ANY violation exists, fix it before returning.

=== HIERARCHY OF RULES ===
1. ARCHETYPE IDENTITY (highest priority) - defines who they are
2. BUDGET CONSTRAINTS - defines what they can afford
3. PACING RULES - defines density and timing
4. VARIETY RULES - prevents repetition
5. NAMING RULES - prevents gaming

When rules conflict, higher priority wins.
`);
  
  return sections.filter(Boolean).join('\n');
}
