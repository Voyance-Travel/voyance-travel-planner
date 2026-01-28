// =============================================================================
// ARCHETYPE CONSTRAINTS - What Each Archetype ACTUALLY Means
// =============================================================================
// This module defines explicit behaviors, restrictions, and day structures
// for each archetype. The AI MUST obey these rules.
// =============================================================================

export interface ArchetypeDefinition {
  identity: string;
  meaning: string;
  avoid: string[];
  prefer?: string[];
  dayStructure: {
    maxScheduledActivities: number;
    requiredUnscheduledBlocks?: number;
    unscheduledBlockMinHours?: number;
    minMealDuration?: number;
    minBuffer?: number;
    startTime: string;
    endTime: string;
  };
}

export const ARCHETYPE_DEFINITIONS: Record<string, ArchetypeDefinition> = {
  flexible_wanderer: {
    identity: "The Flexible Wanderer",
    meaning: `
This traveler HATES rigid schedules. They want:
- Large blocks of UNSCHEDULED time (2-3 hours with no plan)
- Permission to wander and discover
- Options, not obligations
- The freedom to skip anything

Their ideal day:
- Wake up whenever
- One anchor activity (museum, landmark)
- Hours of "wander this neighborhood" with no specific destination
- Stumble upon lunch, don't schedule it
- Evening: "explore the area around X" not "dinner at Y at 7pm"

WHAT FLEXIBLE ACTUALLY MEANS:
- 50% of daylight hours should be UNSCHEDULED
- Use phrases like "explore the area" not specific venues
- Give neighborhoods to wander, not addresses to visit
- Meals should be "find a spot in X neighborhood" not reservations

VIOLATIONS:
- More than 3 scheduled activities = VIOLATION
- Back-to-back anything = VIOLATION
- Specific restaurant reservations = VIOLATION (unless they requested)
- Hourly schedule = VIOLATION
`,
    avoid: [
      'Rigid time slots',
      'Back-to-back activities',
      'Restaurant reservations',
      'Guided tours',
      'Anything requiring advance booking',
      'Packed itineraries',
      'Luxury experiences (not their vibe)',
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
      endTime: '20:00'
    }
  },

  beach_therapist: {
    identity: "The Beach Therapist",
    meaning: `
This traveler finds peace at the BEACH, not the SPA.

They want:
- Extended beach/water time (3-4 hours minimum)
- Sunset watching
- Casual seafood meals
- Hammock time
- Ocean sounds, not spa music

THIS IS NOT A SPA PERSON. "Therapist" means the BEACH is their therapy.

Their ideal day:
- Late morning start
- Beach by 11am, stay until 3-4pm
- Casual lunch near water
- Rest/nap
- Sunset somewhere scenic
- Simple dinner, feet in sand if possible

WHAT RESTORATION MEANS FOR THEM:
- Beach, ocean, water, waves
- NOT spa, NOT massage, NOT wellness center
- NOT luxury resort amenities
- Simple, natural, elemental

VIOLATIONS:
- Spa treatments = VIOLATION
- Wellness centers = VIOLATION
- Luxury hotel experiences = VIOLATION
- Packed schedules = VIOLATION
- Being far from water = VIOLATION
`,
    avoid: [
      'Spa treatments',
      'Wellness centers',
      'Massage',
      'Luxury resorts',
      'Fine dining',
      'Anything indoors when beach is available',
      'Structured activities',
      'Reservations',
      'Hotel spas',
      'Hammams',
      'Thermal baths (unless natural hot springs)'
    ],
    dayStructure: {
      maxScheduledActivities: 2,
      startTime: '10:00',
      endTime: '21:00'
    }
  },

  slow_traveler: {
    identity: "The Slow Traveler",
    meaning: `
This traveler savors. They don't collect.

They want:
- Deep experiences over broad coverage
- 2-3 activities MAX per day
- Long meals (90+ minutes)
- Time to sit and watch the world
- Coffee that lasts an hour
- No rushing

Their ideal day:
- Wake naturally, no alarm
- Leisurely breakfast (1 hour)
- ONE meaningful morning activity
- Long lunch (90 min)
- Afternoon wandering or rest
- Evening: one thing OR nothing

WHAT SLOW ACTUALLY MEANS:
- If choosing between 2 good things, choose 1
- Always less, never more
- Buffer time is not wasted time
- Sitting in a piazza IS the activity

VIOLATIONS:
- More than 3 activities = VIOLATION
- Meals under 60 minutes = VIOLATION
- "Quick" anything = VIOLATION
- Rushing between sites = VIOLATION
- Back-to-back activities = VIOLATION
`,
    avoid: [
      'Packed schedules',
      'Quick meals',
      'Rushing',
      'Must-see lists',
      'FOMO-driven planning',
      'Back-to-back activities',
      'Tight time slots'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      minMealDuration: 90,
      minBuffer: 60,
      startTime: '09:30',
      endTime: '21:00'
    }
  },

  cultural_anthropologist: {
    identity: "The Cultural Anthropologist",
    meaning: `
This traveler studies culture, not just visits.

They want:
- Local interactions, not tourist experiences
- Markets, neighborhoods, daily life
- Understanding how locals live
- Language practice opportunities
- Non-touristy dining

Their ideal day:
- Morning at a local market or café
- Wandering neighborhoods locals frequent
- Lunch where workers eat
- Afternoon: museum OR craft workshop OR local event
- Evening: neighborhood bar, not tourist area

WHAT CULTURAL IMMERSION MEANS:
- Avoid tourist centers and famous restaurants
- Seek ordinary life, not curated experiences
- Value conversations over sightseeing

VIOLATIONS:
- Tourist trap restaurants = VIOLATION
- Hop-on-hop-off tours = VIOLATION
- Chain restaurants = VIOLATION
- Only visiting landmarks = VIOLATION
`,
    avoid: [
      'Tourist trap restaurants',
      'Hop-on-hop-off tours',
      'Chain restaurants',
      'Crowded landmark-only itineraries',
      'Pre-packaged tours',
      'Tourist menus'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '09:00',
      endTime: '22:00'
    }
  },

  luxury_luminary: {
    identity: "The Luxury Luminary",
    meaning: `
THIS is the traveler who wants spa, Michelin, VIP.

They expect:
- Premium everything
- Michelin-starred dining
- Spa treatments
- VIP access
- Private tours
- Luxury hotels

For THIS archetype only:
- Spa daily is acceptable
- Fine dining every meal is expected
- Price is not mentioned
- "Exclusive" is a feature
`,
    prefer: [
      'Michelin restaurants',
      'Spa treatments',
      'VIP access',
      'Private tours',
      'Luxury hotels',
      'Premium everything',
      'Exclusive experiences'
    ],
    avoid: [
      'Budget options',
      'Street food',
      'Hostels',
      'Public transit',
      'Crowded tourist spots',
      'Queue waiting'
    ],
    dayStructure: {
      maxScheduledActivities: 5,
      startTime: '09:00',
      endTime: '23:00'
    }
  },

  zen_seeker: {
    identity: "The Zen Seeker",
    meaning: `
This traveler seeks inner peace through travel.

They want:
- Meditation spots (temples, gardens, nature)
- Quiet environments
- Wellness (yoga, meditation, spas OK for this archetype)
- Minimal stimulation
- Reflective time

Their ideal day:
- Sunrise yoga or meditation
- Quiet temple or garden visit
- Light, healthy lunch
- Spa or wellness treatment
- Sunset contemplation
- Early, simple dinner

WHAT ZEN MEANS:
- Silence over noise
- Nature over city
- Wellness over activity
- Presence over productivity

This archetype DOES want spa/wellness, unlike Beach Therapist.
`,
    prefer: [
      'Spa treatments',
      'Meditation spaces',
      'Gardens and temples',
      'Yoga',
      'Nature walks',
      'Wellness retreats'
    ],
    avoid: [
      'Crowded attractions',
      'Nightlife',
      'Noisy restaurants',
      'Packed schedules',
      'High-energy activities'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '07:00',
      endTime: '20:00'
    }
  },

  adrenaline_architect: {
    identity: "The Adrenaline Architect",
    meaning: `
This traveler lives for the rush.

They want:
- Adventure sports
- Physical challenges
- Unique experiences
- Story-worthy activities
- Pushing limits

Their ideal day:
- Early start for maximum activity time
- Morning: main adventure (hiking, diving, etc.)
- Active lunch spot
- Afternoon: secondary adventure
- Evening: celebrating the day

Pack it full of action!
`,
    prefer: [
      'Adventure sports',
      'Hiking',
      'Diving/water sports',
      'Extreme activities',
      'Physical challenges',
      'Off-the-beaten-path'
    ],
    avoid: [
      'Spa treatments',
      'Long leisurely meals',
      'Shopping',
      'Sedentary activities',
      'Touristy bus tours'
    ],
    dayStructure: {
      maxScheduledActivities: 6,
      startTime: '07:00',
      endTime: '22:00'
    }
  },

  culinary_cartographer: {
    identity: "The Culinary Cartographer",
    meaning: `
This traveler experiences destinations through food.

They want:
- Food markets and local specialties
- Cooking classes
- Restaurant exploration
- Food history and culture
- Tasting experiences

Their ideal day:
- Breakfast at beloved local spot
- Morning market visit
- Long, exploratory lunch
- Afternoon cooking class or food tour
- Evening: carefully researched dinner

Food IS the activity.
`,
    prefer: [
      'Food markets',
      'Cooking classes',
      'Local restaurants',
      'Food tours',
      'Wine/beer tastings',
      'Specialty food shops'
    ],
    avoid: [
      'Chain restaurants',
      'Tourist-menu restaurants',
      'Fast food',
      'Non-food-focused activities taking up meal times'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      minMealDuration: 75,
      startTime: '09:00',
      endTime: '23:00'
    }
  },

  bucket_list_conqueror: {
    identity: "The Bucket List Conqueror",
    meaning: `
This traveler wants to see the highlights.

They want:
- Major landmarks
- Famous attractions
- Photo opportunities
- Checking things off the list
- Efficiency

Their ideal day:
- Early start to beat crowds
- Hit the major sights
- Efficient routing
- Famous restaurant for lunch
- More sights afternoon
- Sunset at iconic spot

This is the ONE archetype where packed schedules are OK.
`,
    prefer: [
      'Major landmarks',
      'Famous museums',
      'Iconic viewpoints',
      'Well-known restaurants',
      'Skip-the-line access'
    ],
    avoid: [
      'Obscure local spots (unless also famous)',
      'Too much downtime',
      'Missing major attractions'
    ],
    dayStructure: {
      maxScheduledActivities: 7,
      startTime: '08:00',
      endTime: '22:00'
    }
  },

  romantic_curator: {
    identity: "The Romantic Curator",
    meaning: `
This traveler is creating couple moments.

They want:
- Intimate settings
- Sunset views
- Romantic dinners
- Couple activities
- Privacy

Their ideal day:
- Late, leisurely breakfast
- One morning activity together
- Long romantic lunch
- Afternoon rest or spa (as couple)
- Sunset somewhere special
- Candlelit dinner

Romance > efficiency.
`,
    prefer: [
      'Rooftop restaurants',
      'Sunset spots',
      'Couples spa',
      'Wine tastings',
      'Scenic walks',
      'Intimate venues'
    ],
    avoid: [
      'Family-oriented activities',
      'Crowded tourist traps',
      'Group tours',
      'Rushed schedules'
    ],
    dayStructure: {
      maxScheduledActivities: 4,
      startTime: '10:00',
      endTime: '23:00'
    }
  },

  family_architect: {
    identity: "The Family Architect",
    meaning: `
This traveler is managing a family experience.

They want:
- Kid-friendly activities
- Manageable pacing (kids tire)
- Family-appropriate dining
- Flexibility for meltdowns
- Educational but fun

Their ideal day:
- Morning: one family activity
- Early lunch (kids are hungry)
- Afternoon: flexible, maybe rest
- Easy dinner early (6pm)
- Back to hotel reasonable hour

Build in flexibility for family chaos!
`,
    prefer: [
      'Kid-friendly attractions',
      'Parks and playgrounds',
      'Interactive museums',
      'Early dinner reservations',
      'Flexible timing'
    ],
    avoid: [
      'Fine dining',
      'Late activities',
      'Adult-only venues',
      'Very long walking days',
      'Tight schedules'
    ],
    dayStructure: {
      maxScheduledActivities: 3,
      startTime: '09:00',
      endTime: '19:00'
    }
  }
};

// Default for archetypes not explicitly defined
const DEFAULT_DEFINITION: ArchetypeDefinition = {
  identity: "Balanced Traveler",
  meaning: "A balanced approach to travel with no extreme preferences.",
  avoid: [],
  dayStructure: {
    maxScheduledActivities: 5,
    startTime: '09:00',
    endTime: '21:00'
  }
};

/**
 * Get archetype definition, falling back to default if not found
 */
export function getArchetypeDefinition(archetype: string | undefined): ArchetypeDefinition {
  if (!archetype) return DEFAULT_DEFINITION;
  
  const normalized = archetype.toLowerCase().replace(/\s+/g, '_');
  return ARCHETYPE_DEFINITIONS[normalized] || DEFAULT_DEFINITION;
}

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
    lines.push(`   These are NOT suggestions. Violating these = failed itinerary.`);
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
  lines.push(`   Day starts: ${definition.dayStructure.startTime}`);
  lines.push(`   Day ends: ${definition.dayStructure.endTime}`);
  
  if (definition.dayStructure.requiredUnscheduledBlocks) {
    lines.push(`   Required unscheduled blocks: ${definition.dayStructure.requiredUnscheduledBlocks} (min ${definition.dayStructure.unscheduledBlockMinHours}h each)`);
  }
  if (definition.dayStructure.minMealDuration) {
    lines.push(`   Minimum meal duration: ${definition.dayStructure.minMealDuration} minutes`);
  }
  if (definition.dayStructure.minBuffer) {
    lines.push(`   Minimum buffer between activities: ${definition.dayStructure.minBuffer} minutes`);
  }
  lines.push('');
  
  return lines.join('\n');
}

// =============================================================================
// TRIP-WIDE VARIETY RULES
// =============================================================================

export function buildTripWideVarietyRules(archetype: string | undefined): string {
  const isLuxury = archetype?.toLowerCase().includes('luxury') || 
                   archetype?.toLowerCase().includes('luminary');
  
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
- Maximum 1 spa/wellness experience PER TRIP (unless Luxury Luminary/Zen Seeker)
- Maximum 1 Michelin restaurant PER TRIP (unless Luxury Luminary)
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
  const normalized = archetype?.toLowerCase().replace(/\s+/g, '_') || '';
  const needsUnscheduledTime = normalized === 'flexible_wanderer' || 
                                normalized === 'slow_traveler' ||
                                pace <= -3;
  
  if (!needsUnscheduledTime) {
    return '';
  }
  
  return `
=== UNSCHEDULED TIME (REQUIRED) ===

This traveler needs FREEDOM. Your itinerary must include:

UNSCHEDULED BLOCKS:
- Minimum 2 blocks of 2+ hours with NO specific activity
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
- "Flexible Wanderer Boutique Hunt"
- "Slow Traveler Coffee Moment"  
- "Beach Therapist Sunset Session"
- "Cultural Anthropologist Market Tour"

RIGHT:
- "Browse vintage shops in Monti"
- "Coffee at Sant'Eustachio"
- "Sunset at Piazzale Michelangelo"
- "Explore Campo de' Fiori Market"

The archetype shapes WHAT you choose, not what you CALL it.

If the archetype name appears in an activity title, you have FAILED.

Also avoid:
- "Curated" anything (pretentious)
- "Experience" as noun unless it's an actual experience (cooking class = OK, "walking experience" = NO)
- "Journey" "Discovery" "Exploration" as activity names
- Marketing language: "Authentic", "Hidden Gem", "Local Secret"
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

Premium experiences expected:
- Michelin dining appropriate
- Spa and wellness expected
- VIP access and skip-the-line preferred
- Private tours acceptable
- Price is not a concern

Ensure quality matches the tier.
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

export function buildAllConstraints(
  archetype: string | undefined,
  budgetTier: string | undefined,
  traits: { pace: number; budget: number }
): string {
  const sections: string[] = [];
  
  sections.push(buildArchetypeConstraintsBlock(archetype));
  sections.push(buildTripWideVarietyRules(archetype));
  sections.push(buildUnscheduledTimeRules(archetype, traits.pace));
  sections.push(buildPacingRules(traits.pace));
  sections.push(buildBudgetConstraints(budgetTier, traits.budget));
  sections.push(buildNamingRules());
  
  // Add final validation block
  sections.push(`
=== VALIDATION BEFORE FINALIZING ===

Check every activity against:
1. Does this violate the archetype's avoid list? → REMOVE IT
2. Does this violate budget limits? → REMOVE IT
3. Does this repeat something from another day? (spa, Michelin, etc.) → REMOVE IT
4. Is the pacing too packed for this traveler? → REMOVE activities
5. Is there required unscheduled time? → ADD IT
6. Is the archetype name in the activity title? → RENAME IT
7. Are there "luxury/premium/exclusive" words for a non-luxury traveler? → REMOVE them

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
