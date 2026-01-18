import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// ARCHETYPE REGISTRY - 25+ archetypes across 6 categories
// ============================================================================
interface Archetype {
  id: string;
  name: string;
  category: 'EXPLORER' | 'CONNECTOR' | 'ACHIEVER' | 'RESTORER' | 'CURATOR' | 'TRANSFORMER';
  tagline: string;
  primaryTraits: string[];
  traitWeights: Record<string, { min: number; max: number; weight: number }>;
}

const ARCHETYPES: Archetype[] = [
  // EXPLORER category
  {
    id: 'cultural_anthropologist',
    name: 'The Cultural Anthropologist',
    category: 'EXPLORER',
    tagline: "You don't just visit places, you become them.",
    primaryTraits: ['authenticity', 'social', 'transformation'],
    traitWeights: {
      authenticity: { min: 6, max: 10, weight: 3 },
      social: { min: 3, max: 10, weight: 2 },
      transformation: { min: 4, max: 10, weight: 2 },
    },
  },
  {
    id: 'urban_nomad',
    name: 'The Urban Nomad',
    category: 'EXPLORER',
    tagline: 'Cities speak to you in neon and noise.',
    primaryTraits: ['pace', 'social', 'adventure'],
    traitWeights: {
      pace: { min: 4, max: 10, weight: 2 },
      social: { min: 5, max: 10, weight: 2 },
      adventure: { min: 3, max: 10, weight: 2 },
    },
  },
  {
    id: 'wilderness_pioneer',
    name: 'The Wilderness Pioneer',
    category: 'EXPLORER',
    tagline: 'WiFi is optional, wilderness is essential.',
    primaryTraits: ['adventure', 'authenticity', 'budget'],
    traitWeights: {
      adventure: { min: 7, max: 10, weight: 3 },
      authenticity: { min: 5, max: 10, weight: 2 },
      comfort: { min: -10, max: 0, weight: 2 },
    },
  },
  {
    id: 'digital_explorer',
    name: 'The Digital Explorer',
    category: 'EXPLORER',
    tagline: 'Your laptop is your passport extension.',
    primaryTraits: ['planning', 'pace', 'comfort'],
    traitWeights: {
      planning: { min: 3, max: 10, weight: 2 },
      comfort: { min: 2, max: 10, weight: 2 },
      pace: { min: -5, max: 5, weight: 1 },
    },
  },
  
  // CONNECTOR category
  {
    id: 'social_butterfly',
    name: 'The Social Butterfly',
    category: 'CONNECTOR',
    tagline: 'Every stranger is a friend you haven\'t met.',
    primaryTraits: ['social', 'adventure', 'pace'],
    traitWeights: {
      social: { min: 7, max: 10, weight: 3 },
      adventure: { min: 0, max: 10, weight: 1 },
    },
  },
  {
    id: 'family_architect',
    name: 'The Family Architect',
    category: 'CONNECTOR',
    tagline: 'Making memories that outlive photo albums.',
    primaryTraits: ['social', 'planning', 'comfort'],
    traitWeights: {
      social: { min: 5, max: 10, weight: 2 },
      planning: { min: 5, max: 10, weight: 2 },
      comfort: { min: 3, max: 10, weight: 2 },
    },
  },
  {
    id: 'romantic_curator',
    name: 'The Romantic Curator',
    category: 'CONNECTOR',
    tagline: 'Love is better with a view.',
    primaryTraits: ['comfort', 'authenticity', 'social'],
    traitWeights: {
      comfort: { min: 5, max: 10, weight: 2 },
      authenticity: { min: 3, max: 10, weight: 2 },
    },
  },
  {
    id: 'story_seeker',
    name: 'The Story Seeker',
    category: 'CONNECTOR',
    tagline: 'Every person is a book you haven\'t read yet.',
    primaryTraits: ['social', 'authenticity', 'transformation'],
    traitWeights: {
      social: { min: 6, max: 10, weight: 2 },
      authenticity: { min: 5, max: 10, weight: 2 },
      transformation: { min: 3, max: 10, weight: 2 },
    },
  },
  
  // ACHIEVER category
  {
    id: 'bucket_list_conqueror',
    name: 'The Bucket List Conqueror',
    category: 'ACHIEVER',
    tagline: 'Life is a checklist of wonders.',
    primaryTraits: ['pace', 'adventure', 'planning'],
    traitWeights: {
      pace: { min: 5, max: 10, weight: 2 },
      adventure: { min: 4, max: 10, weight: 2 },
      planning: { min: 3, max: 10, weight: 2 },
    },
  },
  {
    id: 'adrenaline_architect',
    name: 'The Adrenaline Architect',
    category: 'ACHIEVER',
    tagline: 'Normal is just a setting on the washing machine.',
    primaryTraits: ['adventure', 'pace', 'budget'],
    traitWeights: {
      adventure: { min: 8, max: 10, weight: 3 },
      pace: { min: 6, max: 10, weight: 2 },
    },
  },
  {
    id: 'collection_curator',
    name: 'The Collection Curator',
    category: 'ACHIEVER',
    tagline: 'Countries collected, stamps earned.',
    primaryTraits: ['pace', 'planning', 'adventure'],
    traitWeights: {
      pace: { min: 5, max: 10, weight: 2 },
      planning: { min: 5, max: 10, weight: 2 },
    },
  },
  {
    id: 'status_seeker',
    name: 'The Status Seeker',
    category: 'ACHIEVER',
    tagline: 'First class isn\'t a seat, it\'s a lifestyle.',
    primaryTraits: ['comfort', 'budget', 'social'],
    traitWeights: {
      comfort: { min: 7, max: 10, weight: 3 },
      budget: { min: 5, max: 10, weight: 2 },
    },
  },
  
  // RESTORER category
  {
    id: 'zen_seeker',
    name: 'The Zen Seeker',
    category: 'RESTORER',
    tagline: 'Breathe in experience, exhale expectation.',
    primaryTraits: ['pace', 'authenticity', 'transformation'],
    traitWeights: {
      pace: { min: -10, max: -3, weight: 3 },
      transformation: { min: 5, max: 10, weight: 2 },
    },
  },
  {
    id: 'retreat_regular',
    name: 'The Retreat Regular',
    category: 'RESTORER',
    tagline: 'Wellness isn\'t a trend, it\'s a lifestyle.',
    primaryTraits: ['pace', 'comfort', 'transformation'],
    traitWeights: {
      pace: { min: -10, max: -2, weight: 2 },
      comfort: { min: 5, max: 10, weight: 2 },
    },
  },
  {
    id: 'beach_therapist',
    name: 'The Beach Therapist',
    category: 'RESTORER',
    tagline: 'Salt water heals everything.',
    primaryTraits: ['pace', 'comfort', 'social'],
    traitWeights: {
      pace: { min: -10, max: -2, weight: 2 },
      comfort: { min: 3, max: 10, weight: 2 },
    },
  },
  {
    id: 'slow_traveler',
    name: 'The Slow Traveler',
    category: 'RESTORER',
    tagline: 'Stay long enough to have a favorite café.',
    primaryTraits: ['pace', 'authenticity', 'social'],
    traitWeights: {
      pace: { min: -10, max: -5, weight: 3 },
      authenticity: { min: 5, max: 10, weight: 2 },
    },
  },
  {
    id: 'escape_artist',
    name: 'The Escape Artist',
    category: 'RESTORER',
    tagline: 'Sometimes you need to leave to find yourself.',
    primaryTraits: ['pace', 'comfort', 'transformation'],
    traitWeights: {
      pace: { min: -10, max: 0, weight: 2 },
      transformation: { min: 3, max: 10, weight: 2 },
    },
  },
  
  // CURATOR category
  {
    id: 'culinary_cartographer',
    name: 'The Culinary Cartographer',
    category: 'CURATOR',
    tagline: 'Your passport is basically a menu.',
    primaryTraits: ['authenticity', 'social', 'adventure'],
    traitWeights: {
      authenticity: { min: 6, max: 10, weight: 2 },
      social: { min: 3, max: 10, weight: 1 },
    },
  },
  {
    id: 'art_aficionado',
    name: 'The Art Aficionado',
    category: 'CURATOR',
    tagline: 'Every gallery is a pilgrimage.',
    primaryTraits: ['authenticity', 'planning', 'pace'],
    traitWeights: {
      authenticity: { min: 5, max: 10, weight: 2 },
      planning: { min: 3, max: 10, weight: 2 },
    },
  },
  {
    id: 'luxury_luminary',
    name: 'The Luxury Luminary',
    category: 'CURATOR',
    tagline: 'Champagne wishes, caviar dreams, economy never.',
    primaryTraits: ['comfort', 'budget', 'planning'],
    traitWeights: {
      comfort: { min: 8, max: 10, weight: 3 },
      budget: { min: 7, max: 10, weight: 2 },
    },
  },
  {
    id: 'eco_ethicist',
    name: 'The Eco Ethicist',
    category: 'CURATOR',
    tagline: 'Leave nothing but footprints.',
    primaryTraits: ['authenticity', 'transformation', 'budget'],
    traitWeights: {
      authenticity: { min: 5, max: 10, weight: 2 },
      transformation: { min: 5, max: 10, weight: 2 },
    },
  },
  {
    id: 'curated_luxe',
    name: 'Curated Luxe',
    category: 'CURATOR',
    tagline: "You don't travel—you orchestrate experiences.",
    primaryTraits: ['comfort', 'planning', 'authenticity'],
    traitWeights: {
      comfort: { min: 6, max: 10, weight: 2 },
      planning: { min: 6, max: 10, weight: 2 },
    },
  },
  
  // TRANSFORMER category
  {
    id: 'gap_year_graduate',
    name: 'The Gap Year Graduate',
    category: 'TRANSFORMER',
    tagline: 'The world is the ultimate classroom.',
    primaryTraits: ['transformation', 'adventure', 'budget'],
    traitWeights: {
      transformation: { min: 7, max: 10, weight: 3 },
      adventure: { min: 5, max: 10, weight: 2 },
    },
  },
  {
    id: 'midlife_explorer',
    name: 'The Midlife Explorer',
    category: 'TRANSFORMER',
    tagline: 'It\'s never too late to become who you were meant to be.',
    primaryTraits: ['transformation', 'comfort', 'authenticity'],
    traitWeights: {
      transformation: { min: 6, max: 10, weight: 2 },
      comfort: { min: 4, max: 10, weight: 2 },
    },
  },
  {
    id: 'sabbatical_scholar',
    name: 'The Sabbatical Scholar',
    category: 'TRANSFORMER',
    tagline: 'Taking time off to find time on.',
    primaryTraits: ['transformation', 'pace', 'authenticity'],
    traitWeights: {
      transformation: { min: 6, max: 10, weight: 2 },
      pace: { min: -5, max: 5, weight: 1 },
      authenticity: { min: 5, max: 10, weight: 2 },
    },
  },
  {
    id: 'healing_journeyer',
    name: 'The Healing Journeyer',
    category: 'TRANSFORMER',
    tagline: 'Travel is the medicine for the soul.',
    primaryTraits: ['transformation', 'pace', 'social'],
    traitWeights: {
      transformation: { min: 7, max: 10, weight: 3 },
      pace: { min: -10, max: 0, weight: 2 },
    },
  },
  
  // Default fallback
  {
    id: 'explorer',
    name: 'The Explorer',
    category: 'EXPLORER',
    tagline: 'The world is your playground.',
    primaryTraits: ['adventure', 'authenticity', 'pace'],
    traitWeights: {
      adventure: { min: 0, max: 10, weight: 1 },
      authenticity: { min: 0, max: 10, weight: 1 },
    },
  },
];

// ============================================================================
// TRAIT CALCULATION ENGINE
// ============================================================================
interface TraitWeights {
  planning: number;
  social: number;
  comfort: number;
  pace: number;
  authenticity: number;
  adventure: number;
  budget: number;
  transformation: number;
}

interface QuizAnswers {
  traveler_type?: string;
  travel_vibes?: string[];
  trip_frequency?: string;
  trip_duration?: string;
  budget?: string;
  pace?: string;
  planning_style?: string;
  travel_companions?: string[];
  interests?: string[];
  accommodation?: string;
  hotel_priorities?: string[];
  dining_style?: string;
  dietary_restrictions?: string[];
  weather_preference?: string[];
  flight_preferences?: string[];
}

function calculateTraitScores(answers: QuizAnswers): TraitWeights {
  // Initialize scores at neutral (0)
  const scores: TraitWeights = {
    planning: 0,
    social: 0,
    comfort: 0,
    pace: 0,
    authenticity: 0,
    adventure: 0,
    budget: 0,
    transformation: 0,
  };
  
  // Traveler type contributions
  const travelerTypeWeights: Record<string, Partial<TraitWeights>> = {
    explorer: { adventure: 4, authenticity: 5, transformation: 3 },
    escape_artist: { pace: -5, comfort: 3, transformation: 4 },
    curated_luxe: { comfort: 6, planning: 4, budget: 5 },
    story_seeker: { social: 5, authenticity: 4, transformation: 3 },
  };
  
  if (answers.traveler_type && travelerTypeWeights[answers.traveler_type]) {
    const weights = travelerTypeWeights[answers.traveler_type];
    Object.entries(weights).forEach(([trait, value]) => {
      scores[trait as keyof TraitWeights] += value;
    });
  }
  
  // Travel vibes contributions
  const vibeWeights: Record<string, Partial<TraitWeights>> = {
    coastal: { pace: -2, comfort: 2 },
    urban: { social: 3, pace: 2, adventure: 1 },
    mountain: { adventure: 4, authenticity: 2 },
    quiet: { pace: -4, comfort: 2 },
    bold: { adventure: 5, transformation: 2 },
    spiritual: { transformation: 5, authenticity: 4 },
  };
  
  if (answers.travel_vibes?.length) {
    answers.travel_vibes.forEach(vibe => {
      const weights = vibeWeights[vibe];
      if (weights) {
        Object.entries(weights).forEach(([trait, value]) => {
          scores[trait as keyof TraitWeights] += value;
        });
      }
    });
  }
  
  // Budget tier contributions
  const budgetWeights: Record<string, Partial<TraitWeights>> = {
    budget: { budget: -3, comfort: -2, adventure: 2 },
    moderate: { budget: 0, comfort: 2 },
    premium: { budget: 4, comfort: 4 },
    luxury: { budget: 7, comfort: 6 },
  };
  
  if (answers.budget && budgetWeights[answers.budget]) {
    const weights = budgetWeights[answers.budget];
    Object.entries(weights).forEach(([trait, value]) => {
      scores[trait as keyof TraitWeights] += value;
    });
  }
  
  // Travel pace contributions
  const paceWeights: Record<string, Partial<TraitWeights>> = {
    relaxed: { pace: -6, comfort: 2 },
    balanced: { pace: 0 },
    active: { pace: 6, adventure: 3 },
  };
  
  if (answers.pace && paceWeights[answers.pace]) {
    const weights = paceWeights[answers.pace];
    Object.entries(weights).forEach(([trait, value]) => {
      scores[trait as keyof TraitWeights] += value;
    });
  }
  
  // Planning style contributions
  const planningWeights: Record<string, Partial<TraitWeights>> = {
    detailed: { planning: 7 },
    flexible: { planning: 0, adventure: 2 },
    spontaneous: { planning: -5, adventure: 4 },
  };
  
  if (answers.planning_style && planningWeights[answers.planning_style]) {
    const weights = planningWeights[answers.planning_style];
    Object.entries(weights).forEach(([trait, value]) => {
      scores[trait as keyof TraitWeights] += value;
    });
  }
  
  // Companion contributions
  const companionWeights: Record<string, Partial<TraitWeights>> = {
    solo: { social: -3, transformation: 3 },
    partner: { social: 2, comfort: 2 },
    family: { social: 4, planning: 3, comfort: 3 },
    friends: { social: 5, adventure: 2 },
  };
  
  if (answers.travel_companions?.length) {
    answers.travel_companions.forEach(companion => {
      const weights = companionWeights[companion];
      if (weights) {
        Object.entries(weights).forEach(([trait, value]) => {
          scores[trait as keyof TraitWeights] += value;
        });
      }
    });
  }
  
  // Interest contributions
  const interestWeights: Record<string, Partial<TraitWeights>> = {
    food: { authenticity: 3, social: 1 },
    culture: { authenticity: 4, transformation: 2 },
    nature: { adventure: 3, authenticity: 2 },
    art: { authenticity: 3, planning: 1 },
    nightlife: { social: 4, pace: 2 },
    wellness: { pace: -3, transformation: 3, comfort: 2 },
    adventure: { adventure: 5, pace: 2 },
    shopping: { comfort: 2, social: 1 },
  };
  
  if (answers.interests?.length) {
    answers.interests.forEach(interest => {
      const weights = interestWeights[interest];
      if (weights) {
        Object.entries(weights).forEach(([trait, value]) => {
          scores[trait as keyof TraitWeights] += value;
        });
      }
    });
  }
  
  // Accommodation contributions
  const accommodationWeights: Record<string, Partial<TraitWeights>> = {
    boutique: { authenticity: 3, comfort: 3 },
    luxury: { comfort: 6, budget: 5 },
    chain: { planning: 2, comfort: 2 },
    vacation_rental: { authenticity: 3, social: -1 },
    resort: { comfort: 5, pace: -2 },
  };
  
  if (answers.accommodation && accommodationWeights[answers.accommodation]) {
    const weights = accommodationWeights[answers.accommodation];
    Object.entries(weights).forEach(([trait, value]) => {
      scores[trait as keyof TraitWeights] += value;
    });
  }
  
  // Dining style contributions
  const diningWeights: Record<string, Partial<TraitWeights>> = {
    adventurous: { authenticity: 4, adventure: 2 },
    balanced: { authenticity: 1 },
    familiar: { comfort: 3 },
    fine_dining: { comfort: 4, budget: 4 },
  };
  
  if (answers.dining_style && diningWeights[answers.dining_style]) {
    const weights = diningWeights[answers.dining_style];
    Object.entries(weights).forEach(([trait, value]) => {
      scores[trait as keyof TraitWeights] += value;
    });
  }
  
  // Clamp all scores to -10 to +10
  Object.keys(scores).forEach(key => {
    scores[key as keyof TraitWeights] = Math.max(-10, Math.min(10, scores[key as keyof TraitWeights]));
  });
  
  return scores;
}

// ============================================================================
// ARCHETYPE MATCHING
// ============================================================================
function matchArchetype(traits: TraitWeights): { primary: Archetype; secondary: Archetype | null; confidence: number } {
  const archetypeScores: { archetype: Archetype; score: number }[] = [];
  
  ARCHETYPES.forEach(archetype => {
    let score = 0;
    let matchCount = 0;
    
    Object.entries(archetype.traitWeights).forEach(([traitName, config]) => {
      const traitValue = traits[traitName as keyof TraitWeights] ?? 0;
      
      // Check if trait is within the archetype's preferred range
      if (traitValue >= config.min && traitValue <= config.max) {
        // Higher score for being closer to the middle of the range
        const rangeMiddle = (config.min + config.max) / 2;
        const distanceFromMiddle = Math.abs(traitValue - rangeMiddle);
        const rangeSize = config.max - config.min;
        const matchQuality = 1 - (distanceFromMiddle / (rangeSize / 2));
        
        score += matchQuality * config.weight * 10;
        matchCount++;
      }
    });
    
    // Bonus for matching multiple primary traits
    if (matchCount >= 2) {
      score *= 1.2;
    }
    
    archetypeScores.push({ archetype, score });
  });
  
  // Sort by score descending
  archetypeScores.sort((a, b) => b.score - a.score);
  
  const primary = archetypeScores[0]?.archetype ?? ARCHETYPES[ARCHETYPES.length - 1];
  const secondary = archetypeScores[1]?.archetype ?? null;
  
  // Calculate confidence (0-100)
  const maxPossibleScore = 100;
  const primaryScore = archetypeScores[0]?.score ?? 0;
  const confidence = Math.min(100, Math.round((primaryScore / maxPossibleScore) * 100 + 50));
  
  return { primary, secondary, confidence };
}

// ============================================================================
// RARITY CALCULATION
// ============================================================================
function calculateRarity(primary: Archetype, secondary: Archetype | null): string {
  const rareCombos = [
    ['luxury_luminary', 'wilderness_pioneer'],
    ['zen_seeker', 'adrenaline_architect'],
    ['slow_traveler', 'bucket_list_conqueror'],
    ['escape_artist', 'social_butterfly'],
  ];
  
  const commonCombos = [
    ['zen_seeker', 'slow_traveler'],
    ['cultural_anthropologist', 'culinary_cartographer'],
    ['luxury_luminary', 'curated_luxe'],
    ['adrenaline_architect', 'wilderness_pioneer'],
  ];
  
  if (secondary) {
    const combo = [primary.id, secondary.id].sort();
    
    for (const rare of rareCombos) {
      const sorted = [...rare].sort();
      if (combo[0] === sorted[0] && combo[1] === sorted[1]) {
        return 'Rare';
      }
    }
    
    for (const common of commonCombos) {
      const sorted = [...common].sort();
      if (combo[0] === sorted[0] && combo[1] === sorted[1]) {
        return 'Common';
      }
    }
  }
  
  return 'Uncommon';
}

// ============================================================================
// EMOTIONAL DRIVERS EXTRACTION
// ============================================================================
function extractEmotionalDrivers(answers: QuizAnswers): string[] {
  const drivers: string[] = [];
  
  const travelerDrivers: Record<string, string[]> = {
    explorer: ['discovery', 'curiosity', 'growth'],
    escape_artist: ['freedom', 'peace', 'renewal'],
    curated_luxe: ['comfort', 'excellence', 'indulgence'],
    story_seeker: ['connection', 'meaning', 'understanding'],
  };
  
  if (answers.traveler_type && travelerDrivers[answers.traveler_type]) {
    drivers.push(...travelerDrivers[answers.traveler_type]);
  }
  
  // Add from interests
  if (answers.interests?.includes('wellness')) drivers.push('restoration');
  if (answers.interests?.includes('adventure')) drivers.push('thrill');
  if (answers.interests?.includes('culture')) drivers.push('learning');
  if (answers.interests?.includes('food')) drivers.push('pleasure');
  
  // Dedupe and limit to 5
  return [...new Set(drivers)].slice(0, 5);
}

// ============================================================================
// TONE TAGS EXTRACTION
// ============================================================================
function extractToneTags(answers: QuizAnswers, traits: TraitWeights): string[] {
  const tags: string[] = [];
  
  // From trait scores
  if (traits.adventure >= 5) tags.push('adventurous');
  if (traits.comfort >= 5) tags.push('comfort-seeking');
  if (traits.authenticity >= 5) tags.push('authentic');
  if (traits.pace <= -3) tags.push('slow-paced');
  if (traits.pace >= 3) tags.push('active');
  if (traits.social >= 5) tags.push('social');
  if (traits.social <= -3) tags.push('introspective');
  if (traits.planning >= 5) tags.push('organized');
  if (traits.planning <= -3) tags.push('spontaneous');
  if (traits.transformation >= 5) tags.push('transformative');
  
  // From vibes
  if (answers.travel_vibes?.includes('spiritual')) tags.push('mindful');
  if (answers.travel_vibes?.includes('bold')) tags.push('bold');
  
  return [...new Set(tags)].slice(0, 8);
}

// ============================================================================
// AI PERFECT TRIP GENERATION
// ============================================================================
async function generatePerfectTrip(
  archetype: Archetype,
  answers: QuizAnswers,
  traits: TraitWeights
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.warn('LOVABLE_API_KEY not configured, using fallback');
    return getFallbackPerfectTrip(archetype);
  }
  
  const prompt = buildPerfectTripPrompt(archetype, answers, traits);
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a luxury travel concierge crafting the perfect trip vision for a traveler. 
Write in second person ("you"), be evocative and aspirational but realistic. 
Keep the response to 2-3 sentences max. Do NOT include specific dates or prices.
Focus on the *feeling* and *experience* rather than logistics.`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    
    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        console.warn('AI rate limited, using fallback');
        return getFallbackPerfectTrip(archetype);
      }
      throw new Error(`AI request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      return content.trim();
    }
    
    return getFallbackPerfectTrip(archetype);
  } catch (error) {
    console.error('AI generation error:', error);
    return getFallbackPerfectTrip(archetype);
  }
}

function buildPerfectTripPrompt(archetype: Archetype, answers: QuizAnswers, traits: TraitWeights): string {
  const parts: string[] = [];
  
  parts.push(`Traveler archetype: ${archetype.name} - "${archetype.tagline}"`);
  parts.push(`Category: ${archetype.category}`);
  
  // Add budget context
  if (answers.budget) {
    const budgetLabels: Record<string, string> = {
      budget: 'budget-conscious, maximizing value',
      moderate: 'balanced spending, good value',
      premium: 'willing to splurge on key experiences',
      luxury: 'no expense spared, premium everything',
    };
    parts.push(`Budget style: ${budgetLabels[answers.budget] || 'flexible'}`);
  }
  
  // Add pace context
  if (answers.pace) {
    const paceLabels: Record<string, string> = {
      relaxed: 'slow-paced, 1-2 activities per day',
      balanced: 'moderate pace, 3-4 activities',
      active: 'action-packed, 5+ activities per day',
    };
    parts.push(`Travel pace: ${paceLabels[answers.pace] || 'balanced'}`);
  }
  
  // Add companion context
  if (answers.travel_companions?.length) {
    parts.push(`Travels with: ${answers.travel_companions.join(', ')}`);
  }
  
  // Add interest context
  if (answers.interests?.length) {
    parts.push(`Key interests: ${answers.interests.slice(0, 4).join(', ')}`);
  }
  
  // Add vibe context
  if (answers.travel_vibes?.length) {
    parts.push(`Preferred vibes: ${answers.travel_vibes.join(', ')}`);
  }
  
  // Add accommodation preference
  if (answers.accommodation) {
    parts.push(`Accommodation style: ${answers.accommodation}`);
  }
  
  // Add trip duration
  if (answers.trip_duration) {
    const durationLabels: Record<string, string> = {
      weekend: '2-3 days',
      short_week: '4-5 days',
      week: 'one week',
      extended: '10+ days',
    };
    parts.push(`Ideal trip length: ${durationLabels[answers.trip_duration] || answers.trip_duration}`);
  }
  
  parts.push('\nCraft their perfect trip vision in 2-3 evocative sentences. Be specific about the type of destination and experiences, but dont name specific places unless it truly fits. Focus on how they will FEEL.');
  
  return parts.join('\n');
}

function getFallbackPerfectTrip(archetype: Archetype): string {
  const fallbacks: Record<string, string> = {
    cultural_anthropologist: 'You thrive when immersed in local life—morning markets, artisan workshops, and dinner invitations from people you just met. Your ideal trip transforms you from tourist to temporary local.',
    urban_nomad: 'Your perfect trip pulses with city energy—rooftop bars, hidden speakeasies, and neighborhoods that reveal themselves only to those who wander. Every street corner tells a story.',
    wilderness_pioneer: 'You belong where the trails end and adventure begins. Your ideal trip trades luxury for authenticity—sleeping under stars, earning your views, and finding yourself in the silence.',
    zen_seeker: 'Your perfect escape is measured in breaths, not bucket list checkmarks. Imagine waking to birdsong, unhurried mornings, and the profound luxury of having nowhere to be.',
    culinary_cartographer: 'For you, travel is tasted, not just seen. Your ideal journey follows your palate through night markets, family-run trattorias, and that hole-in-the-wall only locals know.',
    luxury_luminary: 'Your travels are curated experiences where every detail whispers excellence. From private transfers to sunset champagne, your journey is a masterclass in the art of living well.',
    adrenaline_architect: 'Your perfect trip is designed around peak experiences—the rush of a cliff dive, the thrill of a summit, the exhilaration of pushing your limits in spectacular settings.',
    slow_traveler: 'You dream of trips where you stay long enough to have a regular café order. Your ideal journey is about depth over distance—one place, fully known.',
    family_architect: 'Your perfect trip creates stories your family will retell for decades. Imagine multi-generational memories—grandparents and grandchildren sharing wonder at the same sunset.',
    story_seeker: 'Your travels are measured in connections, not miles. Your ideal trip brings you into living rooms, local celebrations, and conversations that change how you see the world.',
  };
  
  return fallbacks[archetype.id] || `As a ${archetype.name}, your ideal journey embodies ${archetype.tagline.toLowerCase()} Find experiences that speak to your ${archetype.category.toLowerCase()} spirit.`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { answers, userId } = await req.json();
    
    if (!answers) {
      return new Response(
        JSON.stringify({ error: 'Missing quiz answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Calculating Travel DNA for user:', userId);
    console.log('Quiz answers received:', Object.keys(answers));
    
    // Step 1: Calculate trait scores
    const traitScores = calculateTraitScores(answers);
    console.log('Trait scores:', traitScores);
    
    // Step 2: Match archetype
    const { primary, secondary, confidence } = matchArchetype(traitScores);
    console.log('Primary archetype:', primary.id, 'Confidence:', confidence);
    
    // Step 3: Calculate rarity
    const rarity = calculateRarity(primary, secondary);
    
    // Step 4: Extract emotional drivers
    const emotionalDrivers = extractEmotionalDrivers(answers);
    
    // Step 5: Extract tone tags
    const toneTags = extractToneTags(answers, traitScores);
    
    // Step 6: Generate AI-powered perfect trip
    const perfectTrip = await generatePerfectTrip(primary, answers, traitScores);
    
    // Step 7: Generate summary
    const summary = `As a ${primary.name}, ${primary.tagline.toLowerCase()} Your travel DNA reveals a ${rarity.toLowerCase()} combination of traits that makes your journey uniquely yours.`;
    
    const result = {
      primary_archetype_name: primary.id,
      primary_archetype_display: primary.name,
      primary_archetype_category: primary.category,
      primary_archetype_tagline: primary.tagline,
      secondary_archetype_name: secondary?.id || null,
      secondary_archetype_display: secondary?.name || null,
      dna_confidence_score: confidence,
      dna_rarity: rarity,
      trait_scores: traitScores,
      emotional_drivers: emotionalDrivers,
      tone_tags: toneTags,
      perfect_trip_preview: perfectTrip,
      summary,
      calculated_at: new Date().toISOString(),
    };
    
    console.log('Travel DNA calculation complete');
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating Travel DNA:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
