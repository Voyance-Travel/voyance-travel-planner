import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =============================================================================
// INLINED TYPES & PERSONAS (from golden-personas.ts)
// =============================================================================

interface GoldenPersona {
  id: string;
  name: string;
  description: string;
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
  preferences: {
    dietaryRestrictions?: string[];
    foodLikes?: string[];
    foodDislikes?: string[];
    mobilityNeeds?: string[];
    interests?: string[];
    avoidList?: string[];
  };
  tripContext: {
    tripType: string;
    travelers: number;
    budgetTier: 'budget' | 'moderate' | 'luxury';
    pace: 'relaxed' | 'moderate' | 'packed';
  };
  expectedSignals: {
    mustHaveTags: string[];
    mustNotHaveTags: string[];
    minActivitiesPerDay: number;
    maxActivitiesPerDay: number;
    expectedCategories: string[];
    avoidCategories: string[];
  };
}

interface PersonaTestResult {
  personaId: string;
  city: string;
  passed: boolean;
  personalizationScore: number;
  signalMatches: {
    mustHaveTagsFound: string[];
    mustHaveTagsMissing: string[];
    mustNotTagsViolated: string[];
    paceCompliant: boolean;
    categoriesMatch: number;
  };
  activitiesGenerated: number;
  violations: string[];
  timestamp: string;
}

interface ContrastTestResult {
  persona1Id: string;
  persona2Id: string;
  city: string;
  similarityScore: number;
  sharedActivities: number;
  differentActivities: number;
  passed: boolean;
  timestamp: string;
}

interface GoldenTestSuiteResult {
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

// 12 Golden Personas
const GOLDEN_PERSONAS: GoldenPersona[] = [
  {
    id: 'luxury-planner-foodie-couple',
    name: 'Luxury Planner Foodie Couple',
    description: 'Well-off couple seeking fine dining, spa experiences',
    traitScores: { planning: 7, social: 2, comfort: 8, pace: -3, authenticity: 3, adventure: -2, budget: -7, transformation: 2 },
    preferences: {
      foodLikes: ['fine-dining', 'wine', 'tasting-menus'],
      foodDislikes: ['fast-food', 'buffets'],
      interests: ['culinary', 'spa', 'wine', 'luxury'],
      avoidList: ['backpacker-hostels', 'crowded-tours']
    },
    tripContext: { tripType: 'romantic', travelers: 2, budgetTier: 'luxury', pace: 'relaxed' },
    expectedSignals: {
      mustHaveTags: ['romantic', 'fine-dining', 'luxury'],
      mustNotHaveTags: ['budget', 'backpacker'],
      minActivitiesPerDay: 2, maxActivitiesPerDay: 4,
      expectedCategories: ['dining', 'relaxation', 'cultural'],
      avoidCategories: ['adventure', 'nightlife']
    }
  },
  {
    id: 'budget-solo-backpacker',
    name: 'Budget Spontaneous Solo Backpacker',
    description: 'Young solo traveler on tight budget',
    traitScores: { planning: -7, social: 6, comfort: -5, pace: 5, authenticity: 8, adventure: 6, budget: 8, transformation: 5 },
    preferences: {
      foodLikes: ['street-food', 'local-markets'],
      foodDislikes: ['tourist-traps'],
      interests: ['local-culture', 'walking-tours'],
      avoidList: ['luxury-hotels', 'fine-dining']
    },
    tripContext: { tripType: 'solo', travelers: 1, budgetTier: 'budget', pace: 'packed' },
    expectedSignals: {
      mustHaveTags: ['budget', 'local', 'authentic', 'street-food'],
      mustNotHaveTags: ['luxury', 'fine-dining', 'spa'],
      minActivitiesPerDay: 5, maxActivitiesPerDay: 8,
      expectedCategories: ['sightseeing', 'cultural', 'activity'],
      avoidCategories: ['relaxation', 'spa']
    }
  },
  {
    id: 'family-with-toddler',
    name: 'Family with Toddler',
    description: 'Parents with 2-year-old, need stroller-friendly',
    traitScores: { planning: 6, social: 3, comfort: 4, pace: -5, authenticity: 2, adventure: -3, budget: 2, transformation: 0 },
    preferences: {
      foodLikes: ['family-friendly', 'early-dinner'],
      mobilityNeeds: ['stroller-friendly'],
      interests: ['parks', 'playgrounds', 'aquariums'],
      avoidList: ['nightclubs', 'wine-bars', 'long-walks']
    },
    tripContext: { tripType: 'family', travelers: 3, budgetTier: 'moderate', pace: 'relaxed' },
    expectedSignals: {
      mustHaveTags: ['family-friendly', 'kid-friendly'],
      mustNotHaveTags: ['nightlife', 'adult-only', 'bar'],
      minActivitiesPerDay: 2, maxActivitiesPerDay: 4,
      expectedCategories: ['sightseeing', 'activity'],
      avoidCategories: ['nightlife', 'adventure']
    }
  },
  {
    id: 'authentic-culture-seeker',
    name: 'Authentic Culture Seeker',
    description: 'Avoids tourist traps, seeks local gems',
    traitScores: { planning: 3, social: 4, comfort: 1, pace: 3, authenticity: 9, adventure: 4, budget: 4, transformation: 6 },
    preferences: {
      foodLikes: ['local-restaurants', 'markets', 'cooking-classes'],
      foodDislikes: ['chain-restaurants'],
      interests: ['local-markets', 'neighborhoods', 'street-art'],
      avoidList: ['tourist-traps', 'hop-on-hop-off']
    },
    tripContext: { tripType: 'cultural', travelers: 2, budgetTier: 'moderate', pace: 'moderate' },
    expectedSignals: {
      mustHaveTags: ['local', 'authentic', 'neighborhood'],
      mustNotHaveTags: ['tourist-trap', 'chain', 'touristy'],
      minActivitiesPerDay: 4, maxActivitiesPerDay: 6,
      expectedCategories: ['cultural', 'dining', 'sightseeing'],
      avoidCategories: []
    }
  },
  {
    id: 'adventure-adrenaline-junkie',
    name: 'Adventure Adrenaline Junkie',
    description: 'Thrill-seeker wanting extreme sports',
    traitScores: { planning: 2, social: 4, comfort: -4, pace: 8, authenticity: 3, adventure: 9, budget: 3, transformation: 7 },
    preferences: {
      interests: ['hiking', 'climbing', 'extreme-sports', 'rafting'],
      avoidList: ['museums', 'shopping', 'spa']
    },
    tripContext: { tripType: 'adventure', travelers: 1, budgetTier: 'moderate', pace: 'packed' },
    expectedSignals: {
      mustHaveTags: ['adventure', 'outdoor', 'active', 'hiking'],
      mustNotHaveTags: ['relaxing', 'spa', 'shopping'],
      minActivitiesPerDay: 4, maxActivitiesPerDay: 7,
      expectedCategories: ['activity', 'sightseeing'],
      avoidCategories: ['relaxation', 'shopping']
    }
  },
  {
    id: 'wellness-retreat-seeker',
    name: 'Wellness Retreat Seeker',
    description: 'Yoga, meditation, spa, healthy eating',
    traitScores: { planning: 4, social: -2, comfort: 6, pace: -6, authenticity: 5, adventure: -3, budget: -3, transformation: 8 },
    preferences: {
      dietaryRestrictions: ['vegetarian'],
      foodLikes: ['healthy', 'organic', 'plant-based'],
      interests: ['yoga', 'meditation', 'spa', 'wellness'],
      avoidList: ['nightlife', 'bars', 'fast-food']
    },
    tripContext: { tripType: 'wellness', travelers: 1, budgetTier: 'luxury', pace: 'relaxed' },
    expectedSignals: {
      mustHaveTags: ['wellness', 'yoga', 'spa', 'healthy'],
      mustNotHaveTags: ['nightlife', 'party', 'bar'],
      minActivitiesPerDay: 2, maxActivitiesPerDay: 4,
      expectedCategories: ['relaxation', 'activity'],
      avoidCategories: ['nightlife', 'shopping']
    }
  },
  {
    id: 'history-art-scholar',
    name: 'History & Art Scholar',
    description: 'Museums, architecture, historical sites',
    traitScores: { planning: 6, social: 1, comfort: 3, pace: 2, authenticity: 7, adventure: 0, budget: 2, transformation: 4 },
    preferences: {
      foodLikes: ['local-cuisine', 'historic-cafes'],
      interests: ['museums', 'art-galleries', 'architecture', 'history'],
      avoidList: ['theme-parks', 'shopping-malls']
    },
    tripContext: { tripType: 'cultural', travelers: 2, budgetTier: 'moderate', pace: 'moderate' },
    expectedSignals: {
      mustHaveTags: ['museum', 'art', 'history', 'architecture'],
      mustNotHaveTags: ['theme-park', 'beach'],
      minActivitiesPerDay: 3, maxActivitiesPerDay: 5,
      expectedCategories: ['cultural', 'sightseeing'],
      avoidCategories: ['adventure', 'nightlife']
    }
  },
  {
    id: 'foodie-photographer',
    name: 'Foodie Photographer',
    description: 'Instagrammable spots, food tours, aesthetic cafes',
    traitScores: { planning: 5, social: 3, comfort: 4, pace: 4, authenticity: 5, adventure: 2, budget: 0, transformation: 2 },
    preferences: {
      foodLikes: ['photogenic-food', 'specialty-coffee', 'brunch'],
      interests: ['instagram-spots', 'food-tours', 'cafes', 'rooftops']
    },
    tripContext: { tripType: 'leisure', travelers: 2, budgetTier: 'moderate', pace: 'moderate' },
    expectedSignals: {
      mustHaveTags: ['photogenic', 'instagram', 'foodie', 'cafe'],
      mustNotHaveTags: [],
      minActivitiesPerDay: 4, maxActivitiesPerDay: 6,
      expectedCategories: ['dining', 'sightseeing'],
      avoidCategories: []
    }
  },
  {
    id: 'senior-slow-traveler',
    name: 'Senior Slow Traveler',
    description: 'Retired couple, accessibility, no stairs',
    traitScores: { planning: 7, social: 4, comfort: 7, pace: -7, authenticity: 4, adventure: -5, budget: -2, transformation: 1 },
    preferences: {
      foodLikes: ['classic-restaurants', 'comfortable-seating'],
      mobilityNeeds: ['wheelchair-accessible', 'no-stairs', 'elevator'],
      interests: ['gardens', 'scenic-views'],
      avoidList: ['stairs', 'long-walks', 'adventure-activities']
    },
    tripContext: { tripType: 'leisure', travelers: 2, budgetTier: 'luxury', pace: 'relaxed' },
    expectedSignals: {
      mustHaveTags: ['accessible', 'comfortable', 'scenic'],
      mustNotHaveTags: ['stairs', 'hiking', 'adventure'],
      minActivitiesPerDay: 2, maxActivitiesPerDay: 3,
      expectedCategories: ['sightseeing', 'dining'],
      avoidCategories: ['adventure', 'nightlife', 'activity']
    }
  },
  {
    id: 'business-extended-stay',
    name: 'Business Traveler Extended Stay',
    description: 'Business traveler, efficient experiences',
    traitScores: { planning: 8, social: 2, comfort: 5, pace: 4, authenticity: 3, adventure: 1, budget: -4, transformation: 2 },
    preferences: {
      foodLikes: ['business-lunch', 'fine-dining', 'quick-breakfast'],
      interests: ['efficient-sightseeing', 'top-attractions'],
      avoidList: ['tourist-queues']
    },
    tripContext: { tripType: 'business', travelers: 1, budgetTier: 'luxury', pace: 'moderate' },
    expectedSignals: {
      mustHaveTags: ['efficient', 'top-rated'],
      mustNotHaveTags: ['backpacker', 'budget'],
      minActivitiesPerDay: 3, maxActivitiesPerDay: 5,
      expectedCategories: ['sightseeing', 'dining'],
      avoidCategories: []
    }
  },
  {
    id: 'vegan-eco-traveler',
    name: 'Vegan Eco-Conscious Traveler',
    description: 'Strict vegan, sustainable experiences',
    traitScores: { planning: 5, social: 4, comfort: 1, pace: 3, authenticity: 7, adventure: 4, budget: 5, transformation: 7 },
    preferences: {
      dietaryRestrictions: ['vegan', 'plant-based'],
      foodLikes: ['vegan-restaurants', 'organic', 'zero-waste'],
      foodDislikes: ['meat', 'dairy', 'seafood'],
      interests: ['eco-tours', 'sustainable', 'farmers-markets'],
      avoidList: ['zoos', 'animal-shows']
    },
    tripContext: { tripType: 'sustainable', travelers: 1, budgetTier: 'moderate', pace: 'moderate' },
    expectedSignals: {
      mustHaveTags: ['vegan', 'eco-friendly', 'sustainable'],
      mustNotHaveTags: ['steak', 'seafood', 'zoo'],
      minActivitiesPerDay: 4, maxActivitiesPerDay: 6,
      expectedCategories: ['dining', 'sightseeing', 'activity'],
      avoidCategories: []
    }
  },
  {
    id: 'party-nightlife-explorer',
    name: 'Party & Nightlife Explorer',
    description: 'Young group seeking clubs, bars, late nights',
    traitScores: { planning: -4, social: 9, comfort: 2, pace: 6, authenticity: 3, adventure: 5, budget: 3, transformation: 1 },
    preferences: {
      foodLikes: ['late-night-eats', 'brunch', 'cocktails'],
      interests: ['nightclubs', 'rooftop-bars', 'live-music', 'pub-crawls'],
      avoidList: ['early-morning', 'museums']
    },
    tripContext: { tripType: 'party', travelers: 4, budgetTier: 'moderate', pace: 'packed' },
    expectedSignals: {
      mustHaveTags: ['nightlife', 'club', 'bar', 'party'],
      mustNotHaveTags: ['early-morning', 'family-friendly'],
      minActivitiesPerDay: 4, maxActivitiesPerDay: 7,
      expectedCategories: ['nightlife', 'dining'],
      avoidCategories: ['cultural']
    }
  }
];

const TEST_CITIES = [
  { name: 'Paris', country: 'France', currency: 'EUR' },
  { name: 'Tokyo', country: 'Japan', currency: 'JPY' },
  { name: 'New York', country: 'United States', currency: 'USD' }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildPersonaContext(persona: GoldenPersona, city: typeof TEST_CITIES[number], startDate: string, totalDays: number) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalDays - 1);

  return {
    generationContext: {
      tripId: `test-${persona.id}-${city.name.toLowerCase()}`,
      userId: `golden-test-user-${persona.id}`,
      destination: city.name,
      destinationCountry: city.country,
      startDate,
      endDate: endDate.toISOString().split('T')[0],
      totalDays,
      travelers: persona.tripContext.travelers,
      tripType: persona.tripContext.tripType,
      budgetTier: persona.tripContext.budgetTier,
      pace: persona.tripContext.pace,
      interests: persona.preferences.interests || [],
      dailyBudget: persona.tripContext.budgetTier === 'luxury' ? 500 : persona.tripContext.budgetTier === 'moderate' ? 200 : 75,
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

function validatePersonaOutput(
  persona: GoldenPersona,
  days: Array<{ activities: Array<{ title: string; category: string; tags?: string[]; personalization?: { tags: string[] } }> }>
) {
  const allActivities = days.flatMap(d => d.activities);
  const allTags = new Set<string>();
  
  allActivities.forEach(a => {
    (a.tags || []).forEach(t => allTags.add(t.toLowerCase()));
    (a.personalization?.tags || []).forEach(t => allTags.add(t.toLowerCase()));
  });

  const expected = persona.expectedSignals;
  
  const mustHaveTagsFound = expected.mustHaveTags.filter(t => allTags.has(t.toLowerCase()));
  const mustHaveTagsMissing = expected.mustHaveTags.filter(t => !allTags.has(t.toLowerCase()));
  const mustNotTagsViolated = expected.mustNotHaveTags.filter(t => allTags.has(t.toLowerCase()));

  const avgActivitiesPerDay = allActivities.length / days.length;
  const paceCompliant = avgActivitiesPerDay >= expected.minActivitiesPerDay && avgActivitiesPerDay <= expected.maxActivitiesPerDay;

  const actualCategories = new Set(allActivities.map(a => a.category.toLowerCase()));
  const expectedCategoriesFound = expected.expectedCategories.filter(c => actualCategories.has(c.toLowerCase()));
  const categoriesMatch = Math.round((expectedCategoriesFound.length / Math.max(1, expected.expectedCategories.length)) * 100);

  return { mustHaveTagsFound, mustHaveTagsMissing, mustNotTagsViolated, paceCompliant, categoriesMatch };
}

function calculateOutputSimilarity(
  activities1: Array<{ title: string; category: string; tags?: string[] }>,
  activities2: Array<{ title: string; category: string; tags?: string[] }>
): number {
  const titles1 = new Set(activities1.map(a => a.title.toLowerCase()));
  const titles2 = new Set(activities2.map(a => a.title.toLowerCase()));
  
  const intersection = new Set([...titles1].filter(t => titles2.has(t)));
  const union = new Set([...titles1, ...titles2]);
  const titleSimilarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;

  const allTags1 = new Set(activities1.flatMap(a => a.tags || []));
  const allTags2 = new Set(activities2.flatMap(a => a.tags || []));
  const tagIntersection = new Set([...allTags1].filter(t => allTags2.has(t)));
  const tagUnion = new Set([...allTags1, ...allTags2]);
  const tagSimilarity = tagUnion.size > 0 ? (tagIntersection.size / tagUnion.size) * 100 : 0;

  return Math.round(titleSimilarity * 0.6 + tagSimilarity * 0.4);
}

function generateMockItinerary(persona: GoldenPersona, days: number) {
  const paceConfig = { relaxed: { min: 2, max: 4 }, moderate: { min: 4, max: 5 }, packed: { min: 5, max: 7 } };
  const pace = paceConfig[persona.tripContext.pace];
  const result = [];
  
  for (let d = 0; d < days; d++) {
    const numActivities = Math.floor(Math.random() * (pace.max - pace.min + 1)) + pace.min;
    const activities = [];
    
    for (let a = 0; a < numActivities; a++) {
      const category = persona.expectedSignals.expectedCategories[Math.floor(Math.random() * persona.expectedSignals.expectedCategories.length)] || 'sightseeing';
      activities.push({
        title: `Mock ${category} Activity ${d + 1}-${a + 1}`,
        category,
        tags: [...persona.expectedSignals.mustHaveTags.slice(0, 3), category],
        personalization: { tags: persona.expectedSignals.mustHaveTags.slice(0, 2) }
      });
    }
    result.push({ activities });
  }
  return result;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ==========================================================================
    // AUTHENTICATION: Validate JWT using anon client with user's token
    // ==========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[golden-persona-tests] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth client to validate the user's JWT
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error('[golden-persona-tests] Invalid JWT:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = userData.user;
    console.log(`[golden-persona-tests] Authenticated user: ${user.id}`);

    // ==========================================================================
    // AUTHORIZATION: Check admin role using service client
    // ==========================================================================
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error(`[golden-persona-tests] User ${user.id} is not an admin`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[golden-persona-tests] Admin access confirmed for user: ${user.id}`);

    const config = await req.json().catch(() => ({}));
    const { personas: personaFilter = [], cities: cityFilter = [], daysPerTrip = 3, runContrastTests = true, dryRun = true } = config;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    const startDateStr = startDate.toISOString().split('T')[0];

    const testPersonas = personaFilter.length > 0 ? GOLDEN_PERSONAS.filter(p => personaFilter.includes(p.id)) : GOLDEN_PERSONAS;
    const testCities = cityFilter.length > 0 ? TEST_CITIES.filter(c => cityFilter.includes(c.name)) : TEST_CITIES;

    console.log(`🧪 Golden Persona Tests: ${testPersonas.length} personas × ${testCities.length} cities = ${testPersonas.length * testCities.length} tests`);

    const results: GoldenTestSuiteResult = {
      runId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      completedAt: '',
      totalTests: testPersonas.length * testCities.length,
      passedTests: 0,
      failedTests: 0,
      averagePersonalizationScore: 0,
      averageSimilarityScore: 0,
      personaResults: [],
      contrastResults: []
    };

    const generatedOutputs = new Map<string, { persona: GoldenPersona; city: string; days: Array<{ activities: Array<{ title: string; category: string; tags?: string[]; personalization?: { tags: string[] } }> }> }>();

    for (const persona of testPersonas) {
      for (const city of testCities) {
        const testKey = `${persona.id}-${city.name}`;
        try {
          let days;
          if (dryRun) {
            days = generateMockItinerary(persona, daysPerTrip);
          } else {
            const context = buildPersonaContext(persona, city, startDateStr, daysPerTrip);
            const genResponse = await fetch(`${supabaseUrl}/functions/v1/generate-itinerary`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ tripId: context.generationContext.tripId, forceRegenerate: true, testMode: true, testContext: context })
            });
            if (!genResponse.ok) throw new Error(`Generation failed: ${await genResponse.text()}`);
            const genResult = await genResponse.json();
            days = genResult.itinerary?.days || [];
          }

          generatedOutputs.set(testKey, { persona, city: city.name, days });
          const signalMatches = validatePersonaOutput(persona, days);
          const activitiesGenerated = days.reduce((sum: number, d: { activities: unknown[] }) => sum + d.activities.length, 0);
          
          const mustHaveScore = signalMatches.mustHaveTagsFound.length / Math.max(1, persona.expectedSignals.mustHaveTags.length) * 40;
          const mustNotScore = signalMatches.mustNotTagsViolated.length === 0 ? 25 : 0;
          const paceScore = signalMatches.paceCompliant ? 20 : 0;
          const categoryScore = signalMatches.categoriesMatch * 0.15;
          const personalizationScore = Math.round(mustHaveScore + mustNotScore + paceScore + categoryScore);

          const violations: string[] = [];
          if (signalMatches.mustHaveTagsMissing.length > 0) violations.push(`Missing: ${signalMatches.mustHaveTagsMissing.join(', ')}`);
          if (signalMatches.mustNotTagsViolated.length > 0) violations.push(`Violated: ${signalMatches.mustNotTagsViolated.join(', ')}`);
          if (!signalMatches.paceCompliant) violations.push(`Pace: ${(activitiesGenerated / daysPerTrip).toFixed(1)}/day`);

          const passed = personalizationScore >= 60 && violations.length <= 1;
          results.personaResults.push({ personaId: persona.id, city: city.name, passed, personalizationScore, signalMatches, activitiesGenerated, violations, timestamp: new Date().toISOString() });
          if (passed) results.passedTests++; else results.failedTests++;
          console.log(`  ${passed ? '✅' : '❌'} ${persona.name} in ${city.name}: ${personalizationScore}%`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          results.personaResults.push({ personaId: persona.id, city: city.name, passed: false, personalizationScore: 0, signalMatches: { mustHaveTagsFound: [], mustHaveTagsMissing: persona.expectedSignals.mustHaveTags, mustNotTagsViolated: [], paceCompliant: false, categoriesMatch: 0 }, activitiesGenerated: 0, violations: [`Error: ${msg}`], timestamp: new Date().toISOString() });
          results.failedTests++;
        }
      }
    }

    if (runContrastTests) {
      const contrastPairs = [['luxury-planner-foodie-couple', 'budget-solo-backpacker'], ['family-with-toddler', 'party-nightlife-explorer'], ['wellness-retreat-seeker', 'adventure-adrenaline-junkie']];
      for (const city of testCities) {
        for (const [p1Id, p2Id] of contrastPairs) {
          const o1 = generatedOutputs.get(`${p1Id}-${city.name}`);
          const o2 = generatedOutputs.get(`${p2Id}-${city.name}`);
          if (!o1 || !o2) continue;
          const a1 = o1.days.flatMap(d => d.activities);
          const a2 = o2.days.flatMap(d => d.activities);
          const similarityScore = calculateOutputSimilarity(a1, a2);
          const titles1 = new Set(a1.map(a => a.title.toLowerCase()));
          const titles2 = new Set(a2.map(a => a.title.toLowerCase()));
          const sharedActivities = [...titles1].filter(t => titles2.has(t)).length;
          const passed = similarityScore < 85;
          results.contrastResults.push({ persona1Id: p1Id, persona2Id: p2Id, city: city.name, similarityScore, sharedActivities, differentActivities: titles1.size + titles2.size - 2 * sharedActivities, passed, timestamp: new Date().toISOString() });
          console.log(`  ${passed ? '✅' : '⚠️'} ${p1Id} vs ${p2Id}: ${similarityScore}% similar`);
        }
      }
    }

    results.completedAt = new Date().toISOString();
    results.averagePersonalizationScore = results.personaResults.length > 0 ? Math.round(results.personaResults.reduce((s, r) => s + r.personalizationScore, 0) / results.personaResults.length) : 0;
    results.averageSimilarityScore = results.contrastResults.length > 0 ? Math.round(results.contrastResults.reduce((s, r) => s + r.similarityScore, 0) / results.contrastResults.length) : 0;

    await supabase.from('audit_logs').insert({ action: 'golden_persona_test_run', action_type: 'test', actor: 'system', user_id: user.id, metadata: { runId: results.runId, totalTests: results.totalTests, passedTests: results.passedTests, failedTests: results.failedTests, avgScore: results.averagePersonalizationScore } });

    console.log(`\n📊 SUMMARY: ${results.passedTests}/${results.totalTests} passed (${Math.round(results.passedTests / results.totalTests * 100)}%)`);
    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Test error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
