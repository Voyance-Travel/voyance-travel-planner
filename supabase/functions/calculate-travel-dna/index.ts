import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TRAVEL DNA V2 - TYPES & INTERFACES
// ============================================================================

type Trait = 'planning' | 'social' | 'comfort' | 'pace' | 'authenticity' | 'adventure' | 'budget' | 'transformation';

const ALL_TRAITS: Trait[] = ['planning', 'social', 'comfort', 'pace', 'authenticity', 'adventure', 'budget', 'transformation'];

interface TraitScores {
  planning: number;
  social: number;
  comfort: number;
  pace: number;
  authenticity: number;
  adventure: number;
  budget: number;
  transformation: number;
}

interface TraitContribution {
  question_id: string;
  answer_id: string;
  label?: string;
  deltas: Partial<TraitScores>;
  normalized_multiplier: number;
}

interface ArchetypeMatch {
  archetype_id: string;
  name: string;
  category: string;
  score: number;
  pct: number;
  reasons: Array<{ trait: Trait; effect: 'boost' | 'penalty'; amount: number; note?: string }>;
}

interface TravelDNAv2Result {
  version: 2;
  raw_trait_scores: TraitScores;
  trait_scores: TraitScores;
  trait_signal_strength: Partial<Record<Trait, number>>;
  trait_contributions: TraitContribution[];
  archetype_matches: ArchetypeMatch[];
  confidence: number;
  primary_archetype_name: string;
  primary_archetype_display: string;
  primary_archetype_category: string;
  primary_archetype_tagline: string;
  secondary_archetype_name: string | null;
  secondary_archetype_display: string | null;
  dna_rarity: string;
  emotional_drivers: string[];
  tone_tags: string[];
  top_contributors: TraitContribution[];
  perfect_trip_preview: string;
  summary: string;
  calculated_at: string;
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

// ============================================================================
// ARCHETYPE REGISTRY V2 - Enhanced with sweetSpot, hardNo, signatureAnswers
// ============================================================================

interface ArchetypeTraitDef {
  trait: Trait;
  weight: number;
  sweetSpot: number;      // Ideal value for this trait
  range: [number, number]; // [min, max] acceptable range
}

interface ArchetypeHardNo {
  trait: Trait;
  range: [number, number];
  penalty: number;
}

interface ArchetypeV2 {
  id: string;
  name: string;
  category: 'EXPLORER' | 'CONNECTOR' | 'ACHIEVER' | 'RESTORER' | 'CURATOR' | 'TRANSFORMER';
  tagline: string;
  primaryTraits: ArchetypeTraitDef[];
  hardNo?: ArchetypeHardNo[];
  signatureAnswers?: string[];  // Answer IDs that strongly correlate
}

const ARCHETYPES_V2: ArchetypeV2[] = [
  // EXPLORER category
  {
    id: 'cultural_anthropologist',
    name: 'The Cultural Anthropologist',
    category: 'EXPLORER',
    tagline: "You don't just visit places, you become them.",
    primaryTraits: [
      { trait: 'authenticity', weight: 3, sweetSpot: 8, range: [5, 10] },
      { trait: 'social', weight: 2, sweetSpot: 5, range: [2, 10] },
      { trait: 'transformation', weight: 2, sweetSpot: 6, range: [3, 10] },
    ],
    hardNo: [{ trait: 'comfort', range: [8, 10], penalty: -15 }],
    signatureAnswers: ['b1', 'g2'],
  },
  {
    id: 'urban_nomad',
    name: 'The Urban Nomad',
    category: 'EXPLORER',
    tagline: 'Cities speak to you in neon and noise.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: 6, range: [3, 10] },
      { trait: 'social', weight: 2, sweetSpot: 7, range: [4, 10] },
      { trait: 'adventure', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['b3', 'g4'],
  },
  {
    id: 'wilderness_pioneer',
    name: 'The Wilderness Pioneer',
    category: 'EXPLORER',
    tagline: 'WiFi is optional, wilderness is essential.',
    primaryTraits: [
      { trait: 'adventure', weight: 3, sweetSpot: 9, range: [7, 10] },
      { trait: 'authenticity', weight: 2, sweetSpot: 7, range: [4, 10] },
      { trait: 'comfort', weight: 2, sweetSpot: -5, range: [-10, 2] },
    ],
    hardNo: [{ trait: 'budget', range: [7, 10], penalty: -10 }],
    signatureAnswers: ['b2', 'g1', 'i2'],
  },
  {
    id: 'digital_explorer',
    name: 'The Digital Explorer',
    category: 'EXPLORER',
    tagline: 'Your laptop is your passport extension.',
    primaryTraits: [
      { trait: 'planning', weight: 2, sweetSpot: 5, range: [2, 10] },
      { trait: 'comfort', weight: 2, sweetSpot: 4, range: [0, 8] },
      { trait: 'pace', weight: 1, sweetSpot: 0, range: [-5, 5] },
    ],
    signatureAnswers: ['d3', 'h3'],
  },
  
  // CONNECTOR category
  {
    id: 'social_butterfly',
    name: 'The Social Butterfly',
    category: 'CONNECTOR',
    tagline: "Every stranger is a friend you haven't met.",
    primaryTraits: [
      { trait: 'social', weight: 3, sweetSpot: 9, range: [6, 10] },
      { trait: 'adventure', weight: 1, sweetSpot: 4, range: [0, 10] },
    ],
    hardNo: [{ trait: 'social', range: [-10, 0], penalty: -20 }],
    signatureAnswers: ['f3', 'g4'],
  },
  {
    id: 'family_architect',
    name: 'The Family Architect',
    category: 'CONNECTOR',
    tagline: 'Making memories that outlive photo albums.',
    primaryTraits: [
      { trait: 'social', weight: 2, sweetSpot: 6, range: [3, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 7, range: [4, 10] },
      { trait: 'comfort', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['f4'],
  },
  {
    id: 'romantic_curator',
    name: 'The Romantic Curator',
    category: 'CONNECTOR',
    tagline: 'Love is better with a view.',
    primaryTraits: [
      { trait: 'comfort', weight: 2, sweetSpot: 6, range: [3, 10] },
      { trait: 'authenticity', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['f2'],
  },
  {
    id: 'story_seeker',
    name: 'The Story Seeker',
    category: 'CONNECTOR',
    tagline: "Every person is a book you haven't read yet.",
    primaryTraits: [
      { trait: 'social', weight: 2, sweetSpot: 7, range: [5, 10] },
      { trait: 'authenticity', weight: 2, sweetSpot: 6, range: [4, 10] },
      { trait: 'transformation', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['a4'],
  },
  
  // ACHIEVER category
  {
    id: 'bucket_list_conqueror',
    name: 'The Bucket List Conqueror',
    category: 'ACHIEVER',
    tagline: 'Life is a checklist of wonders.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: 7, range: [4, 10] },
      { trait: 'adventure', weight: 2, sweetSpot: 6, range: [3, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 6, range: [2, 10] },
    ],
    signatureAnswers: ['d2'],
  },
  {
    id: 'adrenaline_architect',
    name: 'The Adrenaline Architect',
    category: 'ACHIEVER',
    tagline: 'Normal is just a setting on the washing machine.',
    primaryTraits: [
      { trait: 'adventure', weight: 3, sweetSpot: 10, range: [7, 10] },
      { trait: 'pace', weight: 2, sweetSpot: 8, range: [5, 10] },
    ],
    hardNo: [{ trait: 'pace', range: [-10, -3], penalty: -20 }],
    signatureAnswers: ['g1'],
  },
  {
    id: 'collection_curator',
    name: 'The Collection Curator',
    category: 'ACHIEVER',
    tagline: 'Countries collected, stamps earned.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: 6, range: [4, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 6, range: [4, 10] },
    ],
    signatureAnswers: ['e1'],
  },
  {
    id: 'status_seeker',
    name: 'The Status Seeker',
    category: 'ACHIEVER',
    tagline: "First class isn't a seat, it's a lifestyle.",
    primaryTraits: [
      { trait: 'comfort', weight: 3, sweetSpot: 9, range: [6, 10] },
      { trait: 'budget', weight: 2, sweetSpot: 8, range: [5, 10] },
    ],
    signatureAnswers: ['c4', 'h2'],
  },
  
  // RESTORER category
  {
    id: 'zen_seeker',
    name: 'The Zen Seeker',
    category: 'RESTORER',
    tagline: 'Breathe in experience, exhale expectation.',
    primaryTraits: [
      { trait: 'pace', weight: 3, sweetSpot: -7, range: [-10, -2] },
      { trait: 'transformation', weight: 2, sweetSpot: 7, range: [4, 10] },
    ],
    hardNo: [{ trait: 'pace', range: [5, 10], penalty: -25 }],
    signatureAnswers: ['d1', 'g5'],
  },
  {
    id: 'retreat_regular',
    name: 'The Retreat Regular',
    category: 'RESTORER',
    tagline: "Wellness isn't a trend, it's a lifestyle.",
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: -6, range: [-10, -1] },
      { trait: 'comfort', weight: 2, sweetSpot: 7, range: [4, 10] },
    ],
    signatureAnswers: ['g5', 'h2'],
  },
  {
    id: 'beach_therapist',
    name: 'The Beach Therapist',
    category: 'RESTORER',
    tagline: 'Salt water heals everything.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: -5, range: [-10, 0] },
      { trait: 'comfort', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['i1'],
  },
  {
    id: 'slow_traveler',
    name: 'The Slow Traveler',
    category: 'RESTORER',
    tagline: 'Stay long enough to have a favorite café.',
    primaryTraits: [
      { trait: 'pace', weight: 3, sweetSpot: -8, range: [-10, -4] },
      { trait: 'authenticity', weight: 2, sweetSpot: 7, range: [4, 10] },
    ],
    signatureAnswers: ['d1'],
  },
  {
    id: 'escape_artist',
    name: 'The Escape Artist',
    category: 'RESTORER',
    tagline: 'Sometimes you need to leave to find yourself.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: -4, range: [-10, 2] },
      { trait: 'transformation', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['a1', 'd4'],
  },
  
  // CURATOR category
  {
    id: 'culinary_cartographer',
    name: 'The Culinary Cartographer',
    category: 'CURATOR',
    tagline: 'Your passport is basically a menu.',
    primaryTraits: [
      { trait: 'authenticity', weight: 2, sweetSpot: 7, range: [5, 10] },
      { trait: 'social', weight: 1, sweetSpot: 4, range: [0, 10] },
    ],
    signatureAnswers: ['a3', 'g3'],
  },
  {
    id: 'art_aficionado',
    name: 'The Art Aficionado',
    category: 'CURATOR',
    tagline: 'Every gallery is a pilgrimage.',
    primaryTraits: [
      { trait: 'authenticity', weight: 2, sweetSpot: 6, range: [4, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['g2'],
  },
  {
    id: 'luxury_luminary',
    name: 'The Luxury Luminary',
    category: 'CURATOR',
    tagline: 'Champagne wishes, caviar dreams, economy never.',
    primaryTraits: [
      { trait: 'comfort', weight: 3, sweetSpot: 9, range: [7, 10] },
      { trait: 'budget', weight: 2, sweetSpot: 9, range: [6, 10] },
    ],
    hardNo: [{ trait: 'budget', range: [-10, 2], penalty: -20 }],
    signatureAnswers: ['c4', 'h2', 'b4'],
  },
  {
    id: 'eco_ethicist',
    name: 'The Eco Ethicist',
    category: 'CURATOR',
    tagline: 'Leave nothing but footprints.',
    primaryTraits: [
      { trait: 'authenticity', weight: 2, sweetSpot: 7, range: [4, 10] },
      { trait: 'transformation', weight: 2, sweetSpot: 6, range: [4, 10] },
    ],
    signatureAnswers: [],
  },
  {
    id: 'curated_luxe',
    name: 'Curated Luxe',
    category: 'CURATOR',
    tagline: "You don't travel—you orchestrate experiences.",
    primaryTraits: [
      { trait: 'comfort', weight: 2, sweetSpot: 7, range: [5, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 7, range: [5, 10] },
    ],
    signatureAnswers: ['e1', 'h1'],
  },
  
  // TRANSFORMER category
  {
    id: 'gap_year_graduate',
    name: 'The Gap Year Graduate',
    category: 'TRANSFORMER',
    tagline: 'The world is the ultimate classroom.',
    primaryTraits: [
      { trait: 'transformation', weight: 3, sweetSpot: 9, range: [6, 10] },
      { trait: 'adventure', weight: 2, sweetSpot: 7, range: [4, 10] },
    ],
    signatureAnswers: [],
  },
  {
    id: 'midlife_explorer',
    name: 'The Midlife Explorer',
    category: 'TRANSFORMER',
    tagline: "It's never too late to become who you were meant to be.",
    primaryTraits: [
      { trait: 'transformation', weight: 2, sweetSpot: 7, range: [5, 10] },
      { trait: 'comfort', weight: 2, sweetSpot: 5, range: [3, 10] },
    ],
    signatureAnswers: [],
  },
  {
    id: 'sabbatical_scholar',
    name: 'The Sabbatical Scholar',
    category: 'TRANSFORMER',
    tagline: 'Taking time off to find time on.',
    primaryTraits: [
      { trait: 'transformation', weight: 2, sweetSpot: 7, range: [5, 10] },
      { trait: 'pace', weight: 1, sweetSpot: 0, range: [-5, 5] },
      { trait: 'authenticity', weight: 2, sweetSpot: 6, range: [4, 10] },
    ],
    signatureAnswers: [],
  },
  {
    id: 'healing_journeyer',
    name: 'The Healing Journeyer',
    category: 'TRANSFORMER',
    tagline: 'Travel is the medicine for the soul.',
    primaryTraits: [
      { trait: 'transformation', weight: 3, sweetSpot: 8, range: [6, 10] },
      { trait: 'pace', weight: 2, sweetSpot: -5, range: [-10, 0] },
    ],
    signatureAnswers: ['g5'],
  },
  
  // Default fallback
  {
    id: 'explorer',
    name: 'The Explorer',
    category: 'EXPLORER',
    tagline: 'The world is your playground.',
    primaryTraits: [
      { trait: 'adventure', weight: 1, sweetSpot: 5, range: [-5, 10] },
      { trait: 'authenticity', weight: 1, sweetSpot: 5, range: [-5, 10] },
    ],
    signatureAnswers: [],
  },
];

// ============================================================================
// ANSWER DELTA MAPPINGS - Now includes NEGATIVE evidence
// ============================================================================

interface AnswerDelta {
  deltas: Partial<TraitScores>;
  label?: string;
}

// Map from answer_id to trait deltas (supports negative values for bipolar scoring)
const ANSWER_DELTAS: Record<string, AnswerDelta> = {
  // Q1: Morning routine
  'a1': { deltas: { pace: -5, social: -3, transformation: 2 }, label: 'Quiet morning person' },
  'a2': { deltas: { adventure: 5, pace: 4, planning: -2 }, label: 'Early explorer' },
  'a3': { deltas: { authenticity: 4, planning: 3 }, label: 'Food researcher' },
  'a4': { deltas: { social: 5, planning: -2 }, label: 'Group-oriented' },
  
  // Q2: Dream destination
  'b1': { deltas: { authenticity: 6, transformation: 3 }, label: 'History lover' },
  'b2': { deltas: { adventure: 5, authenticity: 3, social: -3 }, label: 'Nature seeker' },
  'b3': { deltas: { social: 4, pace: 3, adventure: 2 }, label: 'City lover' },
  'b4': { deltas: { comfort: 6, budget: 5 }, label: 'Luxury seeker' },
  
  // Q3: Budget - BIPOLAR (budget-conscious vs big-spender)
  'c1': { deltas: { budget: -5, adventure: 2, comfort: -3 }, label: 'Budget-conscious' },
  'c2': { deltas: { budget: 0, comfort: 2 }, label: 'Balanced spender' },
  'c3': { deltas: { comfort: 5, budget: 4 }, label: 'Quality-first' },
  'c4': { deltas: { budget: 7, comfort: 6 }, label: 'No-expense-spared' },
  
  // Q4: Pace - BIPOLAR (slow vs active)
  'd1': { deltas: { pace: -7, authenticity: 4 }, label: 'Slow & immersive' },
  'd2': { deltas: { pace: 6, adventure: 4 }, label: 'Active traveler' },
  'd3': { deltas: { planning: -2, adventure: 2 }, label: 'Flexible' },
  'd4': { deltas: { pace: -5, comfort: 3 }, label: 'Relaxed vacation' },
  
  // Q5: Planning style - BIPOLAR (detailed vs spontaneous)
  'e1': { deltas: { planning: 7 }, label: 'Detailed planner' },
  'e2': { deltas: { planning: 0, adventure: 2 }, label: 'Light-touch planner' },
  'e3': { deltas: { planning: 2, comfort: 2 }, label: 'Delegator' },
  'e4': { deltas: { planning: -7, adventure: 5 }, label: 'Spontaneous' },
  
  // Q6: Companions - BIPOLAR for social
  'f1': { deltas: { social: -5, transformation: 3 }, label: 'Solo traveler' },
  'f2': { deltas: { social: 2, comfort: 2 }, label: 'Romantic traveler' },
  'f3': { deltas: { social: 5, adventure: 2 }, label: 'Group traveler' },
  'f4': { deltas: { social: 4, planning: 3, comfort: 2 }, label: 'Family traveler' },
  
  // Q7: Activities
  'g1': { deltas: { adventure: 6, pace: 3 }, label: 'Outdoor adventurer' },
  'g2': { deltas: { authenticity: 5, transformation: 2 }, label: 'Culture seeker' },
  'g3': { deltas: { authenticity: 4, social: 2 }, label: 'Foodie' },
  'g4': { deltas: { social: 4, pace: 2 }, label: 'Nightlife lover' },
  'g5': { deltas: { pace: -4, transformation: 4, comfort: 2 }, label: 'Wellness focus' },
  'g6': { deltas: { comfort: 2, authenticity: 2 }, label: 'Shopper' },
  
  // Q8: Accommodation
  'h1': { deltas: { authenticity: 4, comfort: 2 }, label: 'Boutique hotel' },
  'h2': { deltas: { comfort: 6, budget: 5 }, label: 'Luxury resort' },
  'h3': { deltas: { authenticity: 4, social: -2 }, label: 'Local rental' },
  'h4': { deltas: { planning: 2, comfort: 2 }, label: 'Chain hotel' },
  'h5': { deltas: { adventure: 4, authenticity: 3 }, label: 'Unique stays' },
  
  // Q9: Climate
  'i1': { deltas: { comfort: 2, pace: -2 }, label: 'Beach lover' },
  'i2': { deltas: { adventure: 4, authenticity: 2 }, label: 'Mountain lover' },
  'i3': { deltas: { social: 3, pace: 2 }, label: 'City climate' },
  'i4': { deltas: { adventure: 3 }, label: 'Four seasons' },
  
  // Q10: Trip length (if present)
  'j1': { deltas: { pace: 2 }, label: 'Weekend trips' },
  'j2': { deltas: { pace: 0 }, label: 'Short week' },
  'j3': { deltas: { authenticity: 2 }, label: 'Week trips' },
  'j4': { deltas: { authenticity: 4, transformation: 3, pace: -2 }, label: 'Extended trips' },
};

// Legacy answer mappings (for old quiz responses)
const LEGACY_ANSWER_MAPPINGS: Record<string, AnswerDelta> = {
  // Traveler type
  'explorer': { deltas: { adventure: 4, authenticity: 5, transformation: 3 }, label: 'Explorer type' },
  'escape_artist': { deltas: { pace: -5, comfort: 3, transformation: 4 }, label: 'Escape artist' },
  'curated_luxe': { deltas: { comfort: 6, planning: 4, budget: 5 }, label: 'Curated luxe' },
  'story_seeker': { deltas: { social: 5, authenticity: 4, transformation: 3 }, label: 'Story seeker' },
  
  // Vibes
  'coastal': { deltas: { pace: -2, comfort: 2 }, label: 'Coastal vibe' },
  'urban': { deltas: { social: 3, pace: 2, adventure: 1 }, label: 'Urban vibe' },
  'mountain': { deltas: { adventure: 4, authenticity: 2 }, label: 'Mountain vibe' },
  'quiet': { deltas: { pace: -4, social: -2, comfort: 2 }, label: 'Quiet vibe' },
  'bold': { deltas: { adventure: 5, transformation: 2, pace: 2 }, label: 'Bold vibe' },
  'spiritual': { deltas: { transformation: 5, authenticity: 4, pace: -2 }, label: 'Spiritual vibe' },
  
  // Budget
  'budget': { deltas: { budget: -4, comfort: -2, adventure: 2 }, label: 'Budget tier' },
  'moderate': { deltas: { budget: 0, comfort: 2 }, label: 'Moderate tier' },
  'premium': { deltas: { budget: 4, comfort: 4 }, label: 'Premium tier' },
  'luxury': { deltas: { budget: 7, comfort: 6 }, label: 'Luxury tier' },
  
  // Pace
  'relaxed': { deltas: { pace: -6, comfort: 2 }, label: 'Relaxed pace' },
  'balanced': { deltas: { pace: 0 }, label: 'Balanced pace' },
  'active': { deltas: { pace: 6, adventure: 3 }, label: 'Active pace' },
  
  // Planning style
  'detailed': { deltas: { planning: 7 }, label: 'Detailed planning' },
  'flexible': { deltas: { planning: 0, adventure: 2 }, label: 'Flexible planning' },
  'spontaneous': { deltas: { planning: -6, adventure: 4 }, label: 'Spontaneous planning' },
  
  // Companions
  'solo': { deltas: { social: -4, transformation: 3 }, label: 'Solo travel' },
  'partner': { deltas: { social: 2, comfort: 2 }, label: 'Partner travel' },
  'family': { deltas: { social: 4, planning: 3, comfort: 3 }, label: 'Family travel' },
  'friends': { deltas: { social: 5, adventure: 2 }, label: 'Friends travel' },
  
  // Interests
  'food': { deltas: { authenticity: 3, social: 1 }, label: 'Food interest' },
  'culture': { deltas: { authenticity: 4, transformation: 2 }, label: 'Culture interest' },
  'nature': { deltas: { adventure: 3, authenticity: 2 }, label: 'Nature interest' },
  'art': { deltas: { authenticity: 3, planning: 1 }, label: 'Art interest' },
  'nightlife': { deltas: { social: 4, pace: 2 }, label: 'Nightlife interest' },
  'wellness': { deltas: { pace: -3, transformation: 3, comfort: 2 }, label: 'Wellness interest' },
  'adventure': { deltas: { adventure: 5, pace: 2 }, label: 'Adventure interest' },
  'shopping': { deltas: { comfort: 2, social: 1 }, label: 'Shopping interest' },
  
  // Accommodation
  'boutique': { deltas: { authenticity: 3, comfort: 3 }, label: 'Boutique hotel' },
  'chain': { deltas: { planning: 2, comfort: 2 }, label: 'Chain hotel' },
  'vacation_rental': { deltas: { authenticity: 3, social: -1 }, label: 'Vacation rental' },
  'resort': { deltas: { comfort: 5, pace: -2 }, label: 'Resort' },
};

// ============================================================================
// SATURATION CONSTANT - Controls how quickly traits reach extremes
// ============================================================================
const SATURATION_S = 10;  // Higher = slower saturation, lower = faster

/**
 * Apply saturation: score = 10 * tanh(raw / S)
 * This prevents traits from hitting extremes too easily
 */
function applySaturation(rawScore: number): number {
  const saturated = 10 * Math.tanh(rawScore / SATURATION_S);
  // Clamp and round to 1 decimal
  return Math.round(Math.max(-10, Math.min(10, saturated)) * 10) / 10;
}

// ============================================================================
// V2 TRAIT CALCULATION ENGINE
// ============================================================================

interface TraitCalculationResult {
  rawScores: TraitScores;
  finalScores: TraitScores;
  signalStrength: Partial<Record<Trait, number>>;
  contributions: TraitContribution[];
}

function calculateTraitScoresV2(answers: QuizAnswers): TraitCalculationResult {
  // Initialize raw scores at 0
  const rawScores: TraitScores = {
    planning: 0,
    social: 0,
    comfort: 0,
    pace: 0,
    authenticity: 0,
    adventure: 0,
    budget: 0,
    transformation: 0,
  };
  
  const contributions: TraitContribution[] = [];
  const signalStrength: Partial<Record<Trait, number>> = {};
  
  /**
   * Apply a single answer's deltas with normalization
   */
  function applyAnswerDeltas(
    questionId: string,
    answerId: string,
    delta: AnswerDelta,
    multiplier: number
  ) {
    const scaledDeltas: Partial<TraitScores> = {};
    
    for (const [trait, value] of Object.entries(delta.deltas)) {
      const scaledValue = (value as number) * multiplier;
      rawScores[trait as Trait] += scaledValue;
      scaledDeltas[trait as Trait] = scaledValue;
      
      // Track signal strength (absolute value of contributions)
      signalStrength[trait as Trait] = (signalStrength[trait as Trait] || 0) + Math.abs(scaledValue);
    }
    
    contributions.push({
      question_id: questionId,
      answer_id: answerId,
      label: delta.label,
      deltas: scaledDeltas,
      normalized_multiplier: multiplier,
    });
  }
  
  // Process traveler_type (single select)
  if (answers.traveler_type) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.traveler_type];
    if (delta) {
      applyAnswerDeltas('traveler_type', answers.traveler_type, delta, 1.0);
    }
  }
  
  // Process travel_vibes (multi-select) - NORMALIZED
  if (answers.travel_vibes?.length) {
    const k = answers.travel_vibes.length;
    const multiplier = 1 / Math.min(k, 3);  // Diminishing returns after 3
    
    for (const vibe of answers.travel_vibes) {
      const delta = LEGACY_ANSWER_MAPPINGS[vibe];
      if (delta) {
        applyAnswerDeltas('travel_vibes', vibe, delta, multiplier);
      }
    }
  }
  
  // Process budget (single select)
  if (answers.budget) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.budget];
    if (delta) {
      applyAnswerDeltas('budget', answers.budget, delta, 1.0);
    }
  }
  
  // Process pace (single select)
  if (answers.pace) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.pace];
    if (delta) {
      applyAnswerDeltas('pace', answers.pace, delta, 1.0);
    }
  }
  
  // Process planning_style (single select)
  if (answers.planning_style) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.planning_style];
    if (delta) {
      applyAnswerDeltas('planning_style', answers.planning_style, delta, 1.0);
    }
  }
  
  // Process travel_companions (multi-select) - NORMALIZED
  if (answers.travel_companions?.length) {
    const k = answers.travel_companions.length;
    const multiplier = 1 / Math.min(k, 2);  // Max 2 companion types typically
    
    for (const companion of answers.travel_companions) {
      const delta = LEGACY_ANSWER_MAPPINGS[companion];
      if (delta) {
        applyAnswerDeltas('travel_companions', companion, delta, multiplier);
      }
    }
  }
  
  // Process interests (multi-select) - NORMALIZED
  if (answers.interests?.length) {
    const k = answers.interests.length;
    const multiplier = 1 / Math.min(k, 3);  // Diminishing returns after 3
    
    for (const interest of answers.interests) {
      const delta = LEGACY_ANSWER_MAPPINGS[interest];
      if (delta) {
        applyAnswerDeltas('interests', interest, delta, multiplier);
      }
    }
  }
  
  // Process accommodation (single select)
  if (answers.accommodation) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.accommodation];
    if (delta) {
      applyAnswerDeltas('accommodation', answers.accommodation, delta, 1.0);
    }
  }
  
  // Process hotel_priorities (multi-select) - NORMALIZED
  if (answers.hotel_priorities?.length) {
    const k = answers.hotel_priorities.length;
    const multiplier = 1 / Math.min(k, 3);
    
    for (const priority of answers.hotel_priorities) {
      const delta = ANSWER_DELTAS[priority] || LEGACY_ANSWER_MAPPINGS[priority];
      if (delta) {
        applyAnswerDeltas('hotel_priorities', priority, delta, multiplier);
      }
    }
  }
  
  // Process weather_preference (multi-select) - NORMALIZED
  if (answers.weather_preference?.length) {
    const k = answers.weather_preference.length;
    const multiplier = 1 / Math.min(k, 2);
    
    for (const weather of answers.weather_preference) {
      const delta = ANSWER_DELTAS[weather] || LEGACY_ANSWER_MAPPINGS[weather];
      if (delta) {
        applyAnswerDeltas('weather_preference', weather, delta, multiplier);
      }
    }
  }
  
  // Apply saturation to produce final scores
  const finalScores: TraitScores = {
    planning: applySaturation(rawScores.planning),
    social: applySaturation(rawScores.social),
    comfort: applySaturation(rawScores.comfort),
    pace: applySaturation(rawScores.pace),
    authenticity: applySaturation(rawScores.authenticity),
    adventure: applySaturation(rawScores.adventure),
    budget: applySaturation(rawScores.budget),
    transformation: applySaturation(rawScores.transformation),
  };
  
  return {
    rawScores,
    finalScores,
    signalStrength,
    contributions,
  };
}

// ============================================================================
// V2 ARCHETYPE MATCHING - With blends and improved confidence
// ============================================================================

interface ArchetypeMatchingResult {
  matches: ArchetypeMatch[];
  confidence: number;
}

function matchArchetypesV2(
  traits: TraitScores,
  contributions: TraitContribution[]
): ArchetypeMatchingResult {
  // Collect all answer IDs for signature matching
  const answerIds = new Set(contributions.map(c => c.answer_id));
  
  const archetypeScores: { archetype: ArchetypeV2; score: number; reasons: ArchetypeMatch['reasons'] }[] = [];
  
  for (const archetype of ARCHETYPES_V2) {
    let score = 0;
    const reasons: ArchetypeMatch['reasons'] = [];
    
    // Score primary traits
    for (const traitDef of archetype.primaryTraits) {
      const traitValue = traits[traitDef.trait];
      const { sweetSpot, range, weight } = traitDef;
      const [min, max] = range;
      
      // Check if in range
      if (traitValue >= min && traitValue <= max) {
        // Calculate match quality based on distance from sweetSpot
        const rangeSize = max - min;
        const distanceFromSweetSpot = Math.abs(traitValue - sweetSpot);
        const maxDistance = Math.max(Math.abs(sweetSpot - min), Math.abs(sweetSpot - max));
        const matchQuality = 1 - (distanceFromSweetSpot / maxDistance);
        
        const traitScore = matchQuality * weight * 10;
        score += traitScore;
        
        if (traitScore > 5) {
          reasons.push({
            trait: traitDef.trait,
            effect: 'boost',
            amount: Math.round(traitScore * 10) / 10,
            note: `${traitDef.trait} at ${traitValue} (sweet spot: ${sweetSpot})`,
          });
        }
      } else {
        // Outside range = small penalty
        const penalty = -weight * 2;
        score += penalty;
        
        if (penalty < -3) {
          reasons.push({
            trait: traitDef.trait,
            effect: 'penalty',
            amount: Math.round(penalty * 10) / 10,
            note: `${traitDef.trait} at ${traitValue} outside range [${min}, ${max}]`,
          });
        }
      }
    }
    
    // Apply hardNo penalties
    if (archetype.hardNo) {
      for (const hardNo of archetype.hardNo) {
        const traitValue = traits[hardNo.trait];
        const [min, max] = hardNo.range;
        
        if (traitValue >= min && traitValue <= max) {
          score += hardNo.penalty;
          reasons.push({
            trait: hardNo.trait,
            effect: 'penalty',
            amount: hardNo.penalty,
            note: `Hard no: ${hardNo.trait} in forbidden range [${min}, ${max}]`,
          });
        }
      }
    }
    
    // Apply signature answer bonuses
    if (archetype.signatureAnswers?.length) {
      const matchedSignatures = archetype.signatureAnswers.filter(id => answerIds.has(id));
      if (matchedSignatures.length > 0) {
        const bonus = matchedSignatures.length * 5;
        score += bonus;
        // Don't add to reasons (too granular)
      }
    }
    
    archetypeScores.push({ archetype, score, reasons });
  }
  
  // Sort by score descending
  archetypeScores.sort((a, b) => b.score - a.score);
  
  // Take top 5 for blend
  const topN = archetypeScores.slice(0, 5);
  
  // Calculate blend percentages using softmax
  const temperature = 2.0;  // Higher = more even distribution
  const maxScore = Math.max(...topN.map(a => a.score));
  const expScores = topN.map(a => Math.exp((a.score - maxScore) / temperature));
  const sumExp = expScores.reduce((sum, e) => sum + e, 0);
  const percentages = expScores.map(e => Math.round((e / sumExp) * 100));
  
  // Ensure percentages sum to 100
  const sumPct = percentages.reduce((sum, p) => sum + p, 0);
  if (sumPct !== 100 && percentages.length > 0) {
    percentages[0] += 100 - sumPct;
  }
  
  // Build matches array
  const matches: ArchetypeMatch[] = topN.map((item, i) => ({
    archetype_id: item.archetype.id,
    name: item.archetype.name,
    category: item.archetype.category,
    score: Math.round(item.score * 10) / 10,
    pct: percentages[i],
    reasons: item.reasons.slice(0, 3),  // Top 3 reasons
  }));
  
  // Calculate confidence based on margin + entropy
  const scores = topN.map(a => a.score);
  const margin = scores.length >= 2 ? scores[0] - scores[1] : scores[0];
  
  // Entropy of the blend distribution
  const probs = percentages.map(p => p / 100);
  const entropy = -probs.reduce((sum, p) => {
    if (p > 0) return sum + p * Math.log2(p);
    return sum;
  }, 0);
  const maxEntropy = Math.log2(topN.length);  // Maximum entropy for N items
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  
  // Confidence formula:
  // - High margin (top1 >> top2) → high confidence
  // - Low entropy (concentrated blend) → high confidence
  // Margin typically 0-30, scale to 0-50
  // Entropy typically 0-1, invert and scale to 0-50
  const marginComponent = Math.min(50, (margin / 30) * 50);
  const entropyComponent = (1 - normalizedEntropy) * 50;
  const confidence = Math.min(100, Math.max(0, Math.round(marginComponent + entropyComponent)));
  
  return { matches, confidence };
}

// ============================================================================
// RARITY CALCULATION (unchanged from v1)
// ============================================================================

function calculateRarity(primary: string, secondary: string | null): string {
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
    const combo = [primary, secondary].sort();
    
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
// EMOTIONAL DRIVERS & TONE TAGS (enhanced)
// ============================================================================

function extractEmotionalDrivers(answers: QuizAnswers, contributions: TraitContribution[]): string[] {
  const drivers = new Set<string>();
  
  // From contributions
  for (const contrib of contributions) {
    const label = contrib.label?.toLowerCase() || '';
    if (label.includes('adventure') || label.includes('explorer')) {
      drivers.add('discovery');
      drivers.add('thrill');
    }
    if (label.includes('relax') || label.includes('slow') || label.includes('quiet')) {
      drivers.add('peace');
      drivers.add('restoration');
    }
    if (label.includes('food') || label.includes('culinary')) {
      drivers.add('pleasure');
    }
    if (label.includes('culture') || label.includes('history')) {
      drivers.add('learning');
      drivers.add('meaning');
    }
    if (label.includes('solo')) {
      drivers.add('freedom');
      drivers.add('self-discovery');
    }
    if (label.includes('family') || label.includes('group') || label.includes('partner')) {
      drivers.add('connection');
    }
    if (label.includes('luxury') || label.includes('comfort')) {
      drivers.add('indulgence');
    }
  }
  
  return Array.from(drivers).slice(0, 5);
}

function extractToneTags(traits: TraitScores, contributions: TraitContribution[]): string[] {
  const tags: string[] = [];
  
  // From trait scores
  if (traits.adventure >= 5) tags.push('adventurous');
  if (traits.adventure <= -5) tags.push('cautious');
  if (traits.comfort >= 5) tags.push('comfort-seeking');
  if (traits.comfort <= -3) tags.push('rustic');
  if (traits.authenticity >= 5) tags.push('authentic');
  if (traits.pace <= -4) tags.push('slow-paced');
  if (traits.pace >= 4) tags.push('fast-paced');
  if (traits.social >= 5) tags.push('social');
  if (traits.social <= -4) tags.push('introspective');
  if (traits.planning >= 5) tags.push('organized');
  if (traits.planning <= -4) tags.push('spontaneous');
  if (traits.transformation >= 5) tags.push('transformative');
  if (traits.budget >= 5) tags.push('luxury');
  if (traits.budget <= -3) tags.push('value-driven');
  
  return [...new Set(tags)].slice(0, 8);
}

// ============================================================================
// AI PERFECT TRIP GENERATION
// ============================================================================

async function generatePerfectTrip(
  archetype: ArchetypeV2,
  secondaryArchetype: ArchetypeV2 | null,
  blendPct: number,
  answers: QuizAnswers,
  traits: TraitScores,
  confidence: number
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.warn('LOVABLE_API_KEY not configured, using fallback');
    return getFallbackPerfectTrip(archetype.id);
  }
  
  const prompt = buildPerfectTripPromptV2(archetype, secondaryArchetype, blendPct, answers, traits, confidence);
  
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
            content: `You are a luxury travel concierge crafting the perfect trip vision. 
Write in second person ("you"), be evocative and aspirational but realistic. 
Keep the response to 2-3 sentences max. Do NOT include specific dates or prices.
Focus on the *feeling* and *experience* rather than logistics.
${confidence < 60 ? 'This traveler has a mixed profile - acknowledge versatility.' : ''}`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    
    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        console.warn('AI rate limited, using fallback');
        return getFallbackPerfectTrip(archetype.id);
      }
      throw new Error(`AI request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    return content?.trim() || getFallbackPerfectTrip(archetype.id);
  } catch (error) {
    console.error('AI generation error:', error);
    return getFallbackPerfectTrip(archetype.id);
  }
}

function buildPerfectTripPromptV2(
  archetype: ArchetypeV2,
  secondaryArchetype: ArchetypeV2 | null,
  blendPct: number,
  answers: QuizAnswers,
  traits: TraitScores,
  confidence: number
): string {
  const parts: string[] = [];
  
  // Archetype blend info
  parts.push(`Primary archetype: ${archetype.name} (${blendPct}%) - "${archetype.tagline}"`);
  if (secondaryArchetype && blendPct < 80) {
    parts.push(`Secondary: ${secondaryArchetype.name} (${100 - blendPct}%)`);
  }
  parts.push(`Category: ${archetype.category}`);
  parts.push(`Confidence: ${confidence}/100`);
  
  // Key traits
  const traitDescriptions: string[] = [];
  if (Math.abs(traits.pace) >= 4) {
    traitDescriptions.push(traits.pace > 0 ? 'active traveler' : 'slow-paced explorer');
  }
  if (Math.abs(traits.social) >= 4) {
    traitDescriptions.push(traits.social > 0 ? 'social connector' : 'solo adventurer');
  }
  if (traits.comfort >= 4) {
    traitDescriptions.push('comfort-seeking');
  }
  if (traits.adventure >= 4) {
    traitDescriptions.push('adventure-driven');
  }
  if (traitDescriptions.length > 0) {
    parts.push(`Key traits: ${traitDescriptions.join(', ')}`);
  }
  
  // Context from answers
  if (answers.budget) {
    const budgetLabels: Record<string, string> = {
      budget: 'budget-conscious',
      moderate: 'balanced spending',
      premium: 'willing to splurge',
      luxury: 'no expense spared',
    };
    parts.push(`Budget: ${budgetLabels[answers.budget] || 'flexible'}`);
  }
  
  if (answers.interests?.length) {
    parts.push(`Interests: ${answers.interests.slice(0, 4).join(', ')}`);
  }
  
  if (answers.travel_companions?.length) {
    parts.push(`Travels with: ${answers.travel_companions.join(', ')}`);
  }
  
  parts.push('\nCraft their perfect trip vision in 2-3 evocative sentences.');
  
  return parts.join('\n');
}

function getFallbackPerfectTrip(archetypeId: string): string {
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
    escape_artist: 'You travel to leave everything behind and find yourself in the process. Your ideal trip offers sanctuary, space to breathe, and the freedom to simply be.',
    social_butterfly: 'Your trips come alive through the people you meet. From hostel common rooms to local festivals, your journey is a collection of faces and shared laughter.',
  };
  
  return fallbacks[archetypeId] || 'Your ideal journey is one of discovery and personal meaning. Find experiences that resonate with who you are and who you want to become.';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
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
    
    console.log('[TravelDNA V2] Calculating for user:', userId);
    console.log('[TravelDNA V2] Quiz answers:', Object.keys(answers));
    
    // Step 1: Calculate trait scores with contributions
    const { rawScores, finalScores, signalStrength, contributions } = calculateTraitScoresV2(answers);
    console.log('[TravelDNA V2] Raw scores:', rawScores);
    console.log('[TravelDNA V2] Final scores (saturated):', finalScores);
    
    // Step 2: Match archetypes with blends
    const { matches, confidence } = matchArchetypesV2(finalScores, contributions);
    console.log('[TravelDNA V2] Top matches:', matches.slice(0, 3).map(m => `${m.name} (${m.pct}%)`));
    console.log('[TravelDNA V2] Confidence:', confidence);
    
    // Step 3: Get primary and secondary archetypes
    const primaryMatch = matches[0];
    const secondaryMatch = matches[1];
    const primaryArchetype = ARCHETYPES_V2.find(a => a.id === primaryMatch.archetype_id) || ARCHETYPES_V2[ARCHETYPES_V2.length - 1];
    const secondaryArchetype = secondaryMatch ? ARCHETYPES_V2.find(a => a.id === secondaryMatch.archetype_id) : null;
    
    // Step 4: Calculate rarity
    const rarity = calculateRarity(primaryMatch.archetype_id, secondaryMatch?.archetype_id || null);
    
    // Step 5: Extract emotional drivers and tone tags
    const emotionalDrivers = extractEmotionalDrivers(answers, contributions);
    const toneTags = extractToneTags(finalScores, contributions);
    
    // Step 6: Get top contributors for transparency
    const topContributors = [...contributions]
      .map(c => ({
        ...c,
        totalImpact: Object.values(c.deltas).reduce((sum, v) => sum + Math.abs(v as number), 0),
      }))
      .sort((a, b) => b.totalImpact - a.totalImpact)
      .slice(0, 5);
    
    // Step 7: Generate AI-powered perfect trip
    const perfectTrip = await generatePerfectTrip(
      primaryArchetype,
      secondaryArchetype || null,
      primaryMatch.pct,
      answers,
      finalScores,
      confidence
    );
    
    // Step 8: Build summary
    const blendText = secondaryMatch && primaryMatch.pct < 80 
      ? ` with ${secondaryArchetype?.name || 'secondary'} influences`
      : '';
    const confidenceText = confidence >= 80 
      ? 'clearly' 
      : confidence >= 60 
        ? 'predominantly' 
        : 'with some flexibility';
    const summary = `You are ${confidenceText} a ${primaryArchetype.name}${blendText}. ${primaryArchetype.tagline}`;
    
    // Build V2 result
    const result: TravelDNAv2Result = {
      version: 2,
      raw_trait_scores: rawScores,
      trait_scores: finalScores,
      trait_signal_strength: signalStrength,
      trait_contributions: contributions,
      archetype_matches: matches,
      confidence,
      primary_archetype_name: primaryMatch.archetype_id,
      primary_archetype_display: primaryArchetype.name,
      primary_archetype_category: primaryArchetype.category,
      primary_archetype_tagline: primaryArchetype.tagline,
      secondary_archetype_name: secondaryMatch?.archetype_id || null,
      secondary_archetype_display: secondaryArchetype?.name || null,
      dna_rarity: rarity,
      emotional_drivers: emotionalDrivers,
      tone_tags: toneTags,
      top_contributors: topContributors,
      perfect_trip_preview: perfectTrip,
      summary,
      calculated_at: new Date().toISOString(),
    };
    
    console.log('[TravelDNA V2] Calculation complete');
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[TravelDNA V2] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
