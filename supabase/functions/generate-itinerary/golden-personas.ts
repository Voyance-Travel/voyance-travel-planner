/**
 * Golden Persona Test Suite - Phase 4
 * 
 * 12 distinct personas × 3 cities = 36 test cases
 * Used to prove personalization is working by measuring output differentiation
 */

// =============================================================================
// PERSONA DEFINITIONS
// =============================================================================

export interface GoldenPersona {
  id: string;
  name: string;
  description: string;
  /** Trait scores (-10 to +10) matching the Travel DNA system */
  traitScores: {
    planning: number;
    social: number;
    comfort: number;
    pace: number;
    authenticity: number;
    adventure: number;
    budget: number;
    transformation: number;
  };
  /** Expected preferences derived from traits */
  preferences: {
    dietaryRestrictions?: string[];
    foodLikes?: string[];
    foodDislikes?: string[];
    mobilityNeeds?: string[];
    interests?: string[];
    avoidList?: string[];
  };
  /** Trip context */
  tripContext: {
    tripType: string;
    travelers: number;
    budgetTier: 'budget' | 'moderate' | 'luxury';
    pace: 'relaxed' | 'moderate' | 'packed';
  };
  /** Expected signals in output - used for validation */
  expectedSignals: {
    /** Tags that SHOULD appear in activity personalization */
    mustHaveTags: string[];
    /** Tags that should NOT appear */
    mustNotHaveTags: string[];
    /** Minimum activities per day */
    minActivitiesPerDay: number;
    /** Maximum activities per day */
    maxActivitiesPerDay: number;
    /** Expected activity categories */
    expectedCategories: string[];
    /** Categories to avoid */
    avoidCategories: string[];
  };
}

export const GOLDEN_PERSONAS: GoldenPersona[] = [
  // ==========================================================================
  // PERSONA 1: Luxury Planner Foodie Couple
  // ==========================================================================
  {
    id: 'luxury-planner-foodie-couple',
    name: 'Luxury Planner Foodie Couple',
    description: 'Well-off couple seeking fine dining, spa experiences, minimal walking',
    traitScores: {
      planning: 7,      // Loves detailed plans
      social: 2,        // Prefers private experiences
      comfort: 8,       // Luxury seeking
      pace: -3,         // Relaxed
      authenticity: 3,  // Appreciates authentic but refined
      adventure: -2,    // Low adventure
      budget: -7,       // Willing to splurge
      transformation: 2 // Some growth focus
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['fine-dining', 'wine', 'tasting-menus', 'seafood'],
      foodDislikes: ['fast-food', 'buffets'],
      mobilityNeeds: [],
      interests: ['culinary', 'spa', 'wine', 'luxury'],
      avoidList: ['backpacker-hostels', 'crowded-tours', 'adventure-sports']
    },
    tripContext: {
      tripType: 'romantic',
      travelers: 2,
      budgetTier: 'luxury',
      pace: 'relaxed'
    },
    expectedSignals: {
      mustHaveTags: ['romantic', 'fine-dining', 'luxury', 'spa', 'intimate'],
      mustNotHaveTags: ['budget', 'backpacker', 'adventure-sports', 'crowded'],
      minActivitiesPerDay: 2,
      maxActivitiesPerDay: 4,
      expectedCategories: ['dining', 'relaxation', 'cultural', 'sightseeing'],
      avoidCategories: ['adventure', 'nightlife']
    }
  },

  // ==========================================================================
  // PERSONA 2: Budget Spontaneous Solo Backpacker
  // ==========================================================================
  {
    id: 'budget-solo-backpacker',
    name: 'Budget Spontaneous Solo Backpacker',
    description: 'Young solo traveler seeking authentic experiences on a tight budget',
    traitScores: {
      planning: -7,     // Very spontaneous
      social: 6,        // Loves meeting people
      comfort: -5,      // Fine with basic
      pace: 5,          // Active
      authenticity: 8,  // Seeks real local experiences
      adventure: 6,     // Adventurous
      budget: 8,        // Very budget conscious
      transformation: 5 // Growth focused
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['street-food', 'local-markets', 'cheap-eats'],
      foodDislikes: ['tourist-traps', 'overpriced'],
      mobilityNeeds: [],
      interests: ['local-culture', 'street-art', 'walking-tours', 'hostels'],
      avoidList: ['luxury-hotels', 'fine-dining', 'tour-buses']
    },
    tripContext: {
      tripType: 'solo',
      travelers: 1,
      budgetTier: 'budget',
      pace: 'packed'
    },
    expectedSignals: {
      mustHaveTags: ['budget', 'local', 'authentic', 'street-food', 'walking'],
      mustNotHaveTags: ['luxury', 'fine-dining', 'spa', 'private'],
      minActivitiesPerDay: 5,
      maxActivitiesPerDay: 8,
      expectedCategories: ['sightseeing', 'cultural', 'activity', 'dining'],
      avoidCategories: ['relaxation', 'spa']
    }
  },

  // ==========================================================================
  // PERSONA 3: Family with Toddler
  // ==========================================================================
  {
    id: 'family-with-toddler',
    name: 'Family with Toddler',
    description: 'Parents traveling with a 2-year-old, need stroller-friendly, early dinners',
    traitScores: {
      planning: 6,      // Need to plan around naps
      social: 3,        // Family focused
      comfort: 4,       // Need comfortable stays
      pace: -5,         // Very relaxed pace
      authenticity: 2,  // Some cultural interest
      adventure: -3,    // Low adventure
      budget: 2,        // Moderate budget consciousness
      transformation: 0 // Neutral
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['family-friendly', 'high-chairs', 'early-dinner'],
      foodDislikes: ['bars', 'late-night'],
      mobilityNeeds: ['stroller-friendly', 'elevator-access'],
      interests: ['parks', 'playgrounds', 'family-attractions', 'aquariums'],
      avoidList: ['nightclubs', 'wine-bars', 'adult-only', 'long-walks']
    },
    tripContext: {
      tripType: 'family',
      travelers: 3,
      budgetTier: 'moderate',
      pace: 'relaxed'
    },
    expectedSignals: {
      mustHaveTags: ['family-friendly', 'stroller-friendly', 'kid-friendly', 'early-dinner'],
      mustNotHaveTags: ['nightlife', 'adult-only', 'romantic', 'bar'],
      minActivitiesPerDay: 2,
      maxActivitiesPerDay: 4,
      expectedCategories: ['sightseeing', 'activity', 'dining'],
      avoidCategories: ['nightlife', 'adventure']
    }
  },

  // ==========================================================================
  // PERSONA 4: Authentic Culture Seeker
  // ==========================================================================
  {
    id: 'authentic-culture-seeker',
    name: 'Authentic Culture Seeker',
    description: 'Traveler who avoids tourist traps, seeks neighborhood gems and local markets',
    traitScores: {
      planning: 3,      // Some planning
      social: 4,        // Likes local interaction
      comfort: 1,       // Neutral comfort
      pace: 3,          // Moderate-active
      authenticity: 9,  // MAXIMUM authenticity
      adventure: 4,     // Some adventure
      budget: 4,        // Value conscious
      transformation: 6 // Growth focused
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['local-restaurants', 'markets', 'neighborhood-gems', 'cooking-classes'],
      foodDislikes: ['chain-restaurants', 'tourist-menus'],
      mobilityNeeds: [],
      interests: ['local-markets', 'neighborhoods', 'street-art', 'local-crafts'],
      avoidList: ['tourist-traps', 'chain-restaurants', 'hop-on-hop-off']
    },
    tripContext: {
      tripType: 'cultural',
      travelers: 2,
      budgetTier: 'moderate',
      pace: 'moderate'
    },
    expectedSignals: {
      mustHaveTags: ['local', 'authentic', 'neighborhood', 'off-beaten-path', 'local-favorite'],
      mustNotHaveTags: ['tourist-trap', 'chain', 'mainstream', 'touristy'],
      minActivitiesPerDay: 4,
      maxActivitiesPerDay: 6,
      expectedCategories: ['cultural', 'dining', 'shopping', 'sightseeing'],
      avoidCategories: []
    }
  },

  // ==========================================================================
  // PERSONA 5: Adventure Adrenaline Junkie
  // ==========================================================================
  {
    id: 'adventure-adrenaline-junkie',
    name: 'Adventure Adrenaline Junkie',
    description: 'Thrill-seeker wanting extreme sports, hiking, outdoor activities',
    traitScores: {
      planning: 2,      // Some planning for logistics
      social: 4,        // Group activities
      comfort: -4,      // Doesn't need luxury
      pace: 8,          // VERY active
      authenticity: 3,  // Some authenticity
      adventure: 9,     // MAXIMUM adventure
      budget: 3,        // Will pay for experiences
      transformation: 7 // Growth through challenge
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['high-protein', 'energy-food', 'local'],
      foodDislikes: ['heavy-meals'],
      mobilityNeeds: [],
      interests: ['hiking', 'climbing', 'extreme-sports', 'rafting', 'bungee', 'skydiving'],
      avoidList: ['museums', 'shopping', 'spa', 'beaches']
    },
    tripContext: {
      tripType: 'adventure',
      travelers: 1,
      budgetTier: 'moderate',
      pace: 'packed'
    },
    expectedSignals: {
      mustHaveTags: ['adventure', 'outdoor', 'extreme', 'active', 'hiking', 'thrill'],
      mustNotHaveTags: ['relaxing', 'spa', 'shopping', 'museum'],
      minActivitiesPerDay: 4,
      maxActivitiesPerDay: 7,
      expectedCategories: ['activity', 'sightseeing', 'dining'],
      avoidCategories: ['relaxation', 'shopping']
    }
  },

  // ==========================================================================
  // PERSONA 6: Wellness Retreat Seeker
  // ==========================================================================
  {
    id: 'wellness-retreat-seeker',
    name: 'Wellness Retreat Seeker',
    description: 'Focused on yoga, meditation, spa, healthy eating, digital detox',
    traitScores: {
      planning: 4,      // Likes structure
      social: -2,       // Prefers solitude
      comfort: 6,       // Needs comfort for wellness
      pace: -6,         // Very slow pace
      authenticity: 5,  // Authentic wellness
      adventure: -3,    // Low adventure
      budget: -3,       // Will invest in wellness
      transformation: 8 // MAXIMUM transformation focus
    },
    preferences: {
      dietaryRestrictions: ['vegetarian'],
      foodLikes: ['healthy', 'organic', 'plant-based', 'juice-bars'],
      foodDislikes: ['fast-food', 'fried', 'alcohol'],
      mobilityNeeds: [],
      interests: ['yoga', 'meditation', 'spa', 'wellness', 'nature', 'hiking'],
      avoidList: ['nightlife', 'bars', 'fast-food', 'crowded-attractions']
    },
    tripContext: {
      tripType: 'wellness',
      travelers: 1,
      budgetTier: 'luxury',
      pace: 'relaxed'
    },
    expectedSignals: {
      mustHaveTags: ['wellness', 'yoga', 'spa', 'meditation', 'healthy', 'peaceful'],
      mustNotHaveTags: ['nightlife', 'party', 'bar', 'fast-food'],
      minActivitiesPerDay: 2,
      maxActivitiesPerDay: 4,
      expectedCategories: ['relaxation', 'activity', 'dining'],
      avoidCategories: ['nightlife', 'shopping']
    }
  },

  // ==========================================================================
  // PERSONA 7: History & Art Scholar
  // ==========================================================================
  {
    id: 'history-art-scholar',
    name: 'History & Art Scholar',
    description: 'Deep interest in museums, architecture, historical sites, art galleries',
    traitScores: {
      planning: 6,      // Researches extensively
      social: 1,        // Neutral social
      comfort: 3,       // Moderate comfort
      pace: 2,          // Moderate pace for absorption
      authenticity: 7,  // Values authenticity
      adventure: 0,     // Neutral adventure
      budget: 2,        // Will pay for culture
      transformation: 4 // Intellectual growth
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['local-cuisine', 'historic-cafes', 'literary-spots'],
      foodDislikes: [],
      mobilityNeeds: [],
      interests: ['museums', 'art-galleries', 'architecture', 'history', 'guided-tours'],
      avoidList: ['theme-parks', 'shopping-malls', 'beach-resorts']
    },
    tripContext: {
      tripType: 'cultural',
      travelers: 2,
      budgetTier: 'moderate',
      pace: 'moderate'
    },
    expectedSignals: {
      mustHaveTags: ['museum', 'art', 'history', 'architecture', 'cultural', 'educational'],
      mustNotHaveTags: ['theme-park', 'beach', 'party'],
      minActivitiesPerDay: 3,
      maxActivitiesPerDay: 5,
      expectedCategories: ['cultural', 'sightseeing', 'dining'],
      avoidCategories: ['adventure', 'nightlife']
    }
  },

  // ==========================================================================
  // PERSONA 8: Foodie Photographer
  // ==========================================================================
  {
    id: 'foodie-photographer',
    name: 'Foodie Photographer',
    description: 'Focused on Instagrammable spots, food tours, aesthetic cafes',
    traitScores: {
      planning: 5,      // Plans photo opportunities
      social: 3,        // Some social
      comfort: 4,       // Aesthetic comfort
      pace: 4,          // Active for content
      authenticity: 5,  // Authentic aesthetics
      adventure: 2,     // Low adventure
      budget: 0,        // Neutral budget
      transformation: 2 // Low transformation
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['photogenic-food', 'specialty-coffee', 'brunch', 'rooftop-bars'],
      foodDislikes: ['ugly-food', 'dark-restaurants'],
      mobilityNeeds: [],
      interests: ['instagram-spots', 'food-tours', 'cafes', 'rooftops', 'street-art'],
      avoidList: ['dark-restaurants', 'plain-food']
    },
    tripContext: {
      tripType: 'leisure',
      travelers: 2,
      budgetTier: 'moderate',
      pace: 'moderate'
    },
    expectedSignals: {
      mustHaveTags: ['photogenic', 'instagram', 'aesthetic', 'foodie', 'cafe', 'rooftop'],
      mustNotHaveTags: [],
      minActivitiesPerDay: 4,
      maxActivitiesPerDay: 6,
      expectedCategories: ['dining', 'sightseeing', 'cultural'],
      avoidCategories: []
    }
  },

  // ==========================================================================
  // PERSONA 9: Senior Slow Traveler
  // ==========================================================================
  {
    id: 'senior-slow-traveler',
    name: 'Senior Slow Traveler',
    description: 'Retired couple needing accessibility, no stairs, short walks, early schedule',
    traitScores: {
      planning: 7,      // Needs planning for logistics
      social: 4,        // Enjoys social
      comfort: 7,       // Needs comfort
      pace: -7,         // VERY slow pace
      authenticity: 4,  // Some authenticity
      adventure: -5,    // Low adventure
      budget: -2,       // Can spend
      transformation: 1 // Low transformation
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['classic-restaurants', 'comfortable-seating', 'quiet'],
      foodDislikes: ['loud-music', 'standing-bars'],
      mobilityNeeds: ['wheelchair-accessible', 'no-stairs', 'short-walks', 'elevator'],
      interests: ['gardens', 'scenic-views', 'comfortable-transport', 'cruises'],
      avoidList: ['stairs', 'long-walks', 'adventure-activities', 'loud-venues']
    },
    tripContext: {
      tripType: 'leisure',
      travelers: 2,
      budgetTier: 'luxury',
      pace: 'relaxed'
    },
    expectedSignals: {
      mustHaveTags: ['accessible', 'comfortable', 'scenic', 'quiet', 'easy-access'],
      mustNotHaveTags: ['stairs', 'hiking', 'adventure', 'crowded'],
      minActivitiesPerDay: 2,
      maxActivitiesPerDay: 3,
      expectedCategories: ['sightseeing', 'dining', 'cultural'],
      avoidCategories: ['adventure', 'nightlife', 'activity']
    }
  },

  // ==========================================================================
  // PERSONA 10: Business Traveler Extended Stay
  // ==========================================================================
  {
    id: 'business-extended-stay',
    name: 'Business Traveler Extended Stay',
    description: 'Business traveler with weekend free, needs efficient experiences',
    traitScores: {
      planning: 8,      // Very planned
      social: 2,        // Low social need
      comfort: 5,       // Business comfort
      pace: 4,          // Efficient but not rushed
      authenticity: 3,  // Some authenticity
      adventure: 1,     // Low adventure
      budget: -4,       // Company expense
      transformation: 2 // Low transformation
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['business-lunch', 'fine-dining', 'quick-breakfast'],
      foodDislikes: ['slow-service'],
      mobilityNeeds: [],
      interests: ['efficient-sightseeing', 'top-attractions', 'networking-spots'],
      avoidList: ['tourist-queues', 'time-wasters']
    },
    tripContext: {
      tripType: 'business',
      travelers: 1,
      budgetTier: 'luxury',
      pace: 'moderate'
    },
    expectedSignals: {
      mustHaveTags: ['efficient', 'business-friendly', 'top-rated', 'quick'],
      mustNotHaveTags: ['slow', 'backpacker', 'budget'],
      minActivitiesPerDay: 3,
      maxActivitiesPerDay: 5,
      expectedCategories: ['sightseeing', 'dining', 'cultural'],
      avoidCategories: []
    }
  },

  // ==========================================================================
  // PERSONA 11: Vegan Eco-Conscious Traveler
  // ==========================================================================
  {
    id: 'vegan-eco-traveler',
    name: 'Vegan Eco-Conscious Traveler',
    description: 'Strict vegan focused on sustainable, eco-friendly experiences',
    traitScores: {
      planning: 5,      // Plans for food options
      social: 4,        // Community focused
      comfort: 1,       // Eco comfort
      pace: 3,          // Moderate pace
      authenticity: 7,  // Values authentic eco
      adventure: 4,     // Some adventure
      budget: 5,        // Budget conscious
      transformation: 7 // Values growth
    },
    preferences: {
      dietaryRestrictions: ['vegan', 'plant-based'],
      foodLikes: ['vegan-restaurants', 'organic', 'farm-to-table', 'zero-waste'],
      foodDislikes: ['meat', 'dairy', 'seafood', 'leather'],
      mobilityNeeds: [],
      interests: ['eco-tours', 'sustainable', 'nature', 'farmers-markets', 'cycling'],
      avoidList: ['zoos', 'animal-shows', 'leather-shops', 'fast-fashion']
    },
    tripContext: {
      tripType: 'sustainable',
      travelers: 1,
      budgetTier: 'moderate',
      pace: 'moderate'
    },
    expectedSignals: {
      mustHaveTags: ['vegan', 'eco-friendly', 'sustainable', 'organic', 'plant-based'],
      mustNotHaveTags: ['steak', 'seafood', 'zoo', 'animal-shows'],
      minActivitiesPerDay: 4,
      maxActivitiesPerDay: 6,
      expectedCategories: ['dining', 'sightseeing', 'activity', 'shopping'],
      avoidCategories: []
    }
  },

  // ==========================================================================
  // PERSONA 12: Party & Nightlife Explorer
  // ==========================================================================
  {
    id: 'party-nightlife-explorer',
    name: 'Party & Nightlife Explorer',
    description: 'Young group seeking clubs, bars, late nights, late wake-ups',
    traitScores: {
      planning: -4,     // Spontaneous
      social: 9,        // MAXIMUM social
      comfort: 2,       // Basic comfort
      pace: 6,          // Active at night
      authenticity: 3,  // Some authenticity
      adventure: 5,     // Adventurous nightlife
      budget: 3,        // Budget aware
      transformation: 1 // Low transformation
    },
    preferences: {
      dietaryRestrictions: [],
      foodLikes: ['late-night-eats', 'brunch', 'bar-food', 'cocktails'],
      foodDislikes: ['early-breakfast'],
      mobilityNeeds: [],
      interests: ['nightclubs', 'rooftop-bars', 'live-music', 'pub-crawls', 'beach-clubs'],
      avoidList: ['early-morning', 'museums', 'churches']
    },
    tripContext: {
      tripType: 'party',
      travelers: 4,
      budgetTier: 'moderate',
      pace: 'packed'
    },
    expectedSignals: {
      mustHaveTags: ['nightlife', 'club', 'bar', 'party', 'late-night', 'rooftop'],
      mustNotHaveTags: ['early-morning', 'family-friendly', 'quiet'],
      minActivitiesPerDay: 4,
      maxActivitiesPerDay: 7,
      expectedCategories: ['nightlife', 'dining', 'activity'],
      avoidCategories: ['cultural']
    }
  }
];

// =============================================================================
// TEST CITIES
// =============================================================================

export const TEST_CITIES = [
  { name: 'Paris', country: 'France', currency: 'EUR' },
  { name: 'Tokyo', country: 'Japan', currency: 'JPY' },
  { name: 'New York', country: 'United States', currency: 'USD' }
] as const;

// =============================================================================
// PERSONA TEST RUNNER TYPES
// =============================================================================

export interface PersonaTestResult {
  personaId: string;
  city: string;
  passed: boolean;
  personalizationScore: number;
  signalMatches: {
    mustHaveTagsFound: string[];
    mustHaveTagsMissing: string[];
    mustNotTagsViolated: string[];
    paceCompliant: boolean;
    categoriesMatch: number; // 0-100
  };
  activitiesGenerated: number;
  violations: string[];
  timestamp: string;
}

export interface ContrastTestResult {
  persona1Id: string;
  persona2Id: string;
  city: string;
  similarityScore: number; // 0-100, lower is better (more differentiated)
  sharedActivities: number;
  differentActivities: number;
  passed: boolean; // true if similarity < 85%
  timestamp: string;
}

export interface GoldenTestSuiteResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averagePersonalizationScore: number;
  averageSimilarityScore: number;
  personaResults: PersonaTestResult[];
  contrastResults: ContrastTestResult[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build context object for persona testing
 */
export function buildPersonaContext(
  persona: GoldenPersona, 
  city: typeof TEST_CITIES[number],
  startDate: string,
  totalDays: number
): {
  generationContext: {
    tripId: string;
    userId: string;
    destination: string;
    destinationCountry: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    travelers: number;
    tripType: string;
    budgetTier: string;
    pace: string;
    interests: string[];
    dailyBudget: number;
    currency: string;
  };
  userPreferences: {
    dietaryRestrictions: string[];
    foodLikes: string[];
    foodDislikes: string[];
    mobilityNeeds: string[];
    interests: string[];
    avoidList: string[];
  };
  traitScores: GoldenPersona['traitScores'];
} {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalDays - 1);

  return {
    generationContext: {
      tripId: `test-${persona.id}-${city.name.toLowerCase()}`,
      userId: `golden-test-user-${persona.id}`,
      destination: city.name,
      destinationCountry: city.country,
      startDate: startDate,
      endDate: endDate.toISOString().split('T')[0],
      totalDays,
      travelers: persona.tripContext.travelers,
      tripType: persona.tripContext.tripType,
      budgetTier: persona.tripContext.budgetTier,
      pace: persona.tripContext.pace,
      interests: persona.preferences.interests || [],
      dailyBudget: persona.tripContext.budgetTier === 'luxury' ? 500 : 
                   persona.tripContext.budgetTier === 'moderate' ? 200 : 75,
      currency: city.currency
    },
    userPreferences: {
      dietaryRestrictions: persona.preferences.dietaryRestrictions || [],
      foodLikes: persona.preferences.foodLikes || [],
      foodDislikes: persona.preferences.foodDislikes || [],
      mobilityNeeds: persona.preferences.mobilityNeeds || [],
      interests: persona.preferences.interests || [],
      avoidList: persona.preferences.avoidList || []
    },
    traitScores: persona.traitScores
  };
}

/**
 * Calculate similarity between two itinerary outputs
 * Returns 0-100 where lower means more differentiated (good)
 */
export function calculateOutputSimilarity(
  activities1: Array<{ title: string; category: string; tags?: string[] }>,
  activities2: Array<{ title: string; category: string; tags?: string[] }>
): number {
  const titles1 = new Set(activities1.map(a => a.title.toLowerCase()));
  const titles2 = new Set(activities2.map(a => a.title.toLowerCase()));
  
  // Jaccard similarity for titles
  const intersection = new Set([...titles1].filter(t => titles2.has(t)));
  const union = new Set([...titles1, ...titles2]);
  const titleSimilarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;

  // Category distribution similarity
  const cats1 = activities1.map(a => a.category);
  const cats2 = activities2.map(a => a.category);
  
  const catCount1 = cats1.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {} as Record<string, number>);
  const catCount2 = cats2.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {} as Record<string, number>);
  
  const allCats = new Set([...Object.keys(catCount1), ...Object.keys(catCount2)]);
  let catDiff = 0;
  allCats.forEach(cat => {
    const ratio1 = (catCount1[cat] || 0) / cats1.length;
    const ratio2 = (catCount2[cat] || 0) / cats2.length;
    catDiff += Math.abs(ratio1 - ratio2);
  });
  const categorySimilarity = Math.max(0, 100 - (catDiff * 50));

  // Tag overlap similarity
  const allTags1 = new Set(activities1.flatMap(a => a.tags || []));
  const allTags2 = new Set(activities2.flatMap(a => a.tags || []));
  const tagIntersection = new Set([...allTags1].filter(t => allTags2.has(t)));
  const tagUnion = new Set([...allTags1, ...allTags2]);
  const tagSimilarity = tagUnion.size > 0 ? (tagIntersection.size / tagUnion.size) * 100 : 0;

  // Weighted average
  return Math.round(
    titleSimilarity * 0.5 + 
    categorySimilarity * 0.3 + 
    tagSimilarity * 0.2
  );
}

/**
 * Validate persona test result against expected signals
 */
export function validatePersonaOutput(
  persona: GoldenPersona,
  days: Array<{ activities: Array<{ 
    title: string; 
    category: string; 
    tags?: string[];
    personalization?: { tags: string[] };
  }> }>
): PersonaTestResult['signalMatches'] {
  const allActivities = days.flatMap(d => d.activities);
  const allTags = new Set<string>();
  
  allActivities.forEach(a => {
    (a.tags || []).forEach(t => allTags.add(t.toLowerCase()));
    (a.personalization?.tags || []).forEach(t => allTags.add(t.toLowerCase()));
  });

  const expected = persona.expectedSignals;
  
  // Check must-have tags
  const mustHaveTagsFound = expected.mustHaveTags.filter(t => 
    allTags.has(t.toLowerCase())
  );
  const mustHaveTagsMissing = expected.mustHaveTags.filter(t => 
    !allTags.has(t.toLowerCase())
  );
  
  // Check must-not tags
  const mustNotTagsViolated = expected.mustNotHaveTags.filter(t => 
    allTags.has(t.toLowerCase())
  );

  // Check pace compliance
  const avgActivitiesPerDay = allActivities.length / days.length;
  const paceCompliant = avgActivitiesPerDay >= expected.minActivitiesPerDay && 
                        avgActivitiesPerDay <= expected.maxActivitiesPerDay;

  // Check category distribution
  const actualCategories = new Set(allActivities.map(a => a.category.toLowerCase()));
  const expectedCategoriesFound = expected.expectedCategories.filter(c => 
    actualCategories.has(c.toLowerCase())
  );
  const categoriesMatch = Math.round(
    (expectedCategoriesFound.length / expected.expectedCategories.length) * 100
  );

  return {
    mustHaveTagsFound,
    mustHaveTagsMissing,
    mustNotTagsViolated,
    paceCompliant,
    categoriesMatch
  };
}
