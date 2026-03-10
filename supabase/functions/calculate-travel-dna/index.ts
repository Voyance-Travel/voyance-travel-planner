import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// TRAVEL DNA V2 - TYPES & INTERFACES
// ============================================================================

// CANONICAL TRAIT POLARITY (used across the entire system):
// - budget:  POSITIVE = frugal/value-focused,  NEGATIVE = splurge/luxury
// - comfort: POSITIVE = luxury-seeking,        NEGATIVE = budget-conscious
// This is the single source of truth - do NOT invert elsewhere!
const BUDGET_TRAIT_POLARITY = 'POSITIVE_IS_FRUGAL' as const;
const COMFORT_TRAIT_POLARITY = 'POSITIVE_IS_LUXURY' as const;

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

// NEW: Explainability structure
interface WhyThisResult {
  primary_archetype_reasons: string[];  // Human-readable reasons for primary archetype
  trait_explanations: Array<{
    trait: Trait;
    value: number;
    explanation: string;
    contributing_answers: string[];
  }>;
  confidence_explanation: string;
  top_evidence: Array<{
    question_id: string;
    answer_id: string;
    answer_label: string;
    impact_summary: string;
  }>;
}

interface TopTraitBadge {
  trait: Trait;
  value: number;
  label: string;  // Human-readable e.g. "High Adventure", "Value-Focused"
  intensity: 'moderate' | 'strong' | 'extreme';
}

interface TravelDNAv2Result {
  version: 2;
  budget_polarity_version: 1 | 2;  // 1 = old inverted (positive=splurge), 2 = fixed (positive=frugal)
  raw_trait_scores: TraitScores;
  trait_scores: TraitScores;
  trait_signal_strength: Partial<Record<Trait, number>>;
  trait_fill_rates: Record<Trait, number>;  // percent-of-possible per trait (0 if untouchable)
  trait_contributions: TraitContribution[];
  archetype_matches: ArchetypeMatch[];
  confidence: number;
  primary_archetype_name: string;
  primary_archetype_display: string;
  primary_archetype_category: string;
  primary_archetype_tagline: string;
  secondary_archetype_name: string | null;
  secondary_archetype_display: string | null;
  secondary_probability?: number;  // NEW: Probability (0-1) of secondary archetype
  dna_rarity: string;
  emotional_drivers: string[];
  tone_tags: string[];
  top_contributors: TraitContribution[];
  top_trait_badges: TopTraitBadge[];  // NEW: Show "Adventure: High" badges
  perfect_trip_preview: string;
  summary: string;
  calculated_at: string;
  // Explainability and disambiguation
  why_this_result: WhyThisResult;
  needs_disambiguation: boolean;
  disambiguation_reason?: string;
  disambiguation_traits?: Trait[];
  next_question_ids?: string[];  // NEW: Specific questions to ask for disambiguation
  tension_label?: string;        // NEW: One-liner resolving apparent contradictions
  tension_explanation?: string;  // NEW: Explanation of the tension resolution
}

// Helper to normalize budget trait from older profiles with inverted polarity
function normalizeBudgetTrait(budgetTrait: number, polarityVersion: 1 | 2): number {
  // v1 = old inverted deltas (positive=splurge), v2 = fixed (positive=frugal)
  return polarityVersion === 1 ? -budgetTrait : budgetTrait;
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

// Fine-grained trait requirement (0-1 scale from V3 quiz)
interface FineGrainedReq {
  trait: string;         // e.g. 'nature_orientation', 'cultural_depth'
  min?: number;          // minimum value (0-1)
  max?: number;          // maximum value (0-1)
  weight: number;        // bonus/penalty multiplier
  sweetSpot?: number;    // ideal value (0-1)
}

interface ArchetypeV2 {
  id: string;
  name: string;
  category: 'EXPLORER' | 'CONNECTOR' | 'ACHIEVER' | 'RESTORER' | 'CURATOR' | 'TRANSFORMER';
  tagline: string;
  primaryTraits: ArchetypeTraitDef[];
  hardNo?: ArchetypeHardNo[];
  signatureAnswers?: string[];  // Answer IDs that strongly correlate
  fineGrained?: FineGrainedReq[];  // NEW: Fine-grained V3 trait requirements
}

const ARCHETYPES_V2: ArchetypeV2[] = [
  // ═══════════════════════════════════════
  // EXPLORER category
  // ═══════════════════════════════════════
  {
    id: 'cultural_anthropologist',
    name: 'The Cultural Anthropologist',
    category: 'EXPLORER',
    tagline: "You don't just visit places, you become them.",
    primaryTraits: [
      { trait: 'authenticity', weight: 3, sweetSpot: 7, range: [3, 10] },
      { trait: 'transformation', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    fineGrained: [
      { trait: 'cultural_depth', min: 0.6, weight: 15, sweetSpot: 0.85 },
      { trait: 'learning_focus', min: 0.4, weight: 10, sweetSpot: 0.7 },
    ],
    hardNo: [
      { trait: 'authenticity', range: [-10, -1], penalty: -20 },
    ],
    signatureAnswers: ['cd1', 'b1', 'g2', 'sm4', 'sm5'],  // culture_depth: immersion + history + culture activities
  },
  {
    id: 'urban_nomad',
    name: 'The Urban Nomad',
    category: 'EXPLORER',
    tagline: 'Cities speak to you in neon and noise.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: 5, range: [2, 8] },
      { trait: 'social', weight: 2, sweetSpot: 4, range: [1, 8] },
      { trait: 'comfort', weight: 1, sweetSpot: 3, range: [0, 8] },
    ],
    fineGrained: [
      { trait: 'nature_orientation', max: 0.3, weight: 10 },  // Must NOT be nature-focused
      { trait: 'novelty_seeking', min: 0.65, weight: 10, sweetSpot: 0.85 },  // Genuinely novelty-driven
      { trait: 'social_energy', min: 0.55, weight: 8, sweetSpot: 0.75 },  // City-social energy
      { trait: 'flexibility', min: 0.6, weight: 6, sweetSpot: 0.8 },  // Spontaneous urban explorer
    ],
    hardNo: [
      { trait: 'social', range: [-10, -3], penalty: -10 },
      { trait: 'pace', range: [-10, 1], penalty: -15 },  // Not a slow traveler
    ],
    signatureAnswers: ['b3', 'a2', 'g4', 'i3'],
  },
  {
    id: 'wilderness_pioneer',
    name: 'The Wilderness Pioneer',
    category: 'EXPLORER',
    tagline: 'WiFi is optional, wilderness is essential.',
    primaryTraits: [
      { trait: 'adventure', weight: 3, sweetSpot: 7, range: [3, 10] },
      { trait: 'comfort', weight: 3, sweetSpot: -4, range: [-10, 2] },
      { trait: 'social', weight: 1, sweetSpot: -3, range: [-10, 3] },
    ],
    fineGrained: [
      { trait: 'nature_orientation', min: 0.6, weight: 15, sweetSpot: 0.9 },  // CORE differentiator
    ],
    hardNo: [
      { trait: 'comfort', range: [6, 10], penalty: -20 },
      { trait: 'adventure', range: [-10, 0], penalty: -15 },
    ],
    signatureAnswers: ['ad1', 'b2', 'g1', 'sm5', 'i2'],
  },
  {
    id: 'digital_explorer',
    name: 'The Untethered Traveler',
    category: 'EXPLORER',
    tagline: 'Your laptop is your passport extension.',
    primaryTraits: [
      { trait: 'planning', weight: 2, sweetSpot: -2, range: [-6, 4] },
      { trait: 'authenticity', weight: 2, sweetSpot: 5, range: [2, 8] },
    ],
    fineGrained: [
      { trait: 'photo_focus', min: 0.3, weight: 10, sweetSpot: 0.7 },
      { trait: 'flexibility', min: 0.4, weight: 6 },
    ],
    signatureAnswers: ['a3', 'e2', 'e4', 'h3', 'sm5'],
  },
  
  // ═══════════════════════════════════════
  // CONNECTOR category
  // ═══════════════════════════════════════
  {
    id: 'social_butterfly',
    name: 'The Connection Curator',
    category: 'CONNECTOR',
    tagline: "Every stranger is a friend you haven't met.",
    primaryTraits: [
      { trait: 'social', weight: 4, sweetSpot: 8, range: [5, 10] },
      { trait: 'pace', weight: 2, sweetSpot: 5, range: [2, 8] },
    ],
    fineGrained: [
      { trait: 'social_energy', min: 0.7, weight: 12, sweetSpot: 0.9 },
      { trait: 'group_size_pref', min: 0.6, weight: 8 },
    ],
    hardNo: [
      { trait: 'social', range: [-10, 0], penalty: -25 },
    ],
    signatureAnswers: ['sm1', 'a4', 'g4', 'f3'],
  },
  {
    id: 'family_architect',
    name: 'The Family Architect',
    category: 'CONNECTOR',
    tagline: 'Making memories that outlive photo albums.',
    primaryTraits: [
      { trait: 'social', weight: 2, sweetSpot: 4, range: [1, 7] },
      { trait: 'planning', weight: 3, sweetSpot: 6, range: [3, 10] },
      { trait: 'comfort', weight: 2, sweetSpot: 4, range: [1, 7] },
    ],
    fineGrained: [
      { trait: 'family_focus', min: 0.3, weight: 18, sweetSpot: 0.8 },
    ],
    signatureAnswers: ['sm2', 'f4', 'e1', 'e2', 'h4'],
  },
  {
    id: 'romantic_curator',
    name: 'The Romantic Curator',
    category: 'CONNECTOR',
    tagline: 'Love is better with a view.',
    primaryTraits: [
      { trait: 'social', weight: 2, sweetSpot: 1, range: [-3, 4] },
      { trait: 'comfort', weight: 3, sweetSpot: 6, range: [3, 10] },
    ],
    fineGrained: [
      { trait: 'romance_focus', min: 0.4, weight: 15, sweetSpot: 0.8 },
    ],
    hardNo: [
      { trait: 'social', range: [6, 10], penalty: -15 },
    ],
    signatureAnswers: ['sm3', 'f2', 'h1', 'h2', 'b4'],
  },
  {
    id: 'community_builder',
    name: 'The Community Builder',
    category: 'CONNECTOR',
    tagline: 'Travel with purpose, leave a legacy.',
    primaryTraits: [
      { trait: 'authenticity', weight: 3, sweetSpot: 7, range: [4, 10] },
      { trait: 'transformation', weight: 3, sweetSpot: 7, range: [4, 10] },
      { trait: 'social', weight: 2, sweetSpot: 4, range: [0, 7] },
    ],
    fineGrained: [
      { trait: 'ethics_focus', min: 0.5, weight: 12, sweetSpot: 0.8 },
    ],
    signatureAnswers: ['sm4', 'cd1', 'tt3', 'tt4'],
  },
  {
    id: 'story_seeker',
    name: 'The Story Seeker',
    category: 'CONNECTOR',
    tagline: "Every person is a book you haven't read yet.",
    primaryTraits: [
      { trait: 'social', weight: 2, sweetSpot: 5, range: [2, 8] },
      { trait: 'authenticity', weight: 2, sweetSpot: 6, range: [4, 10] },
      { trait: 'transformation', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['a4', 'n1', 'cd1'],  // group morning + meaningful convo + immersion
  },
  
  // ═══════════════════════════════════════
  // ACHIEVER category
  // ═══════════════════════════════════════
  {
    id: 'bucket_list_conqueror',
    name: 'The Milestone Voyager',
    category: 'ACHIEVER',
    tagline: 'Life is a checklist of wonders.',
    primaryTraits: [
      { trait: 'pace', weight: 3, sweetSpot: 6, range: [3, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 5, range: [2, 8] },
    ],
    fineGrained: [
      { trait: 'bucket_list', min: 0.5, weight: 12, sweetSpot: 0.8 },
    ],
    hardNo: [
      { trait: 'pace', range: [-10, -2], penalty: -15 },
    ],
    signatureAnswers: ['cd3', 'd2', 'e1', 'e2', 'tt5'],
  },
  {
     id: 'adrenaline_architect',
    name: 'The Adrenaline Architect',
    category: 'ACHIEVER',
    tagline: 'Normal is just a setting on the washing machine.',
    primaryTraits: [
      { trait: 'adventure', weight: 4, sweetSpot: 9, range: [7, 10] },
      { trait: 'pace', weight: 3, sweetSpot: 8, range: [5, 10] },
    ],
    fineGrained: [
      { trait: 'physical_intensity', min: 0.5, weight: 10, sweetSpot: 0.8 },
    ],
    hardNo: [
      { trait: 'adventure', range: [-10, 4], penalty: -25 },
      { trait: 'pace', range: [-10, 2], penalty: -15 },
    ],
    signatureAnswers: ['ad2', 'g1', 'd2', 'b2'],
  },
  {
    id: 'collection_curator',
    name: 'The Passport Collector',
    category: 'ACHIEVER',
    tagline: 'Countries collected, stamps earned.',
    primaryTraits: [
      { trait: 'planning', weight: 3, sweetSpot: 7, range: [4, 10] },
      { trait: 'authenticity', weight: 2, sweetSpot: 5, range: [2, 8] },
    ],
    fineGrained: [
      { trait: 'niche_interest', min: 0.3, weight: 12, sweetSpot: 0.7 },
    ],
    signatureAnswers: ['e1', 'cd1', 'cd2', 'tt3'],
  },
  {
    id: 'status_seeker',
    name: 'The VIP Voyager',
    category: 'ACHIEVER',
    tagline: "First class isn't a seat, it's a lifestyle.",
    primaryTraits: [
      { trait: 'comfort', weight: 3, sweetSpot: 8, range: [5, 10] },
      { trait: 'budget', weight: 3, sweetSpot: -7, range: [-10, -3] },
      { trait: 'social', weight: 2, sweetSpot: 4, range: [0, 7] },
    ],
    fineGrained: [
      { trait: 'status_seeking', min: 0.5, weight: 12, sweetSpot: 0.8 },
    ],
    hardNo: [
      { trait: 'budget', range: [4, 10], penalty: -20 },
    ],
    signatureAnswers: ['ld1', 'c4', 'h2', 'b4'],
  },
  
  // ═══════════════════════════════════════
  // RESTORER category
  // ═══════════════════════════════════════
  {
    id: 'zen_seeker',
    name: 'The Zen Seeker',
    category: 'RESTORER',
    tagline: 'Breathe in experience, exhale expectation.',
    primaryTraits: [
      { trait: 'pace', weight: 3, sweetSpot: -6, range: [-10, -2] },
      { trait: 'transformation', weight: 2, sweetSpot: 6, range: [3, 10] },
      { trait: 'social', weight: 2, sweetSpot: -4, range: [-10, 0] },
    ],
    fineGrained: [
      { trait: 'spirituality', min: 0.4, weight: 12, sweetSpot: 0.7 },
      { trait: 'restoration_need', min: 0.5, weight: 8 },
    ],
    hardNo: [
      { trait: 'pace', range: [5, 10], penalty: -20 },
    ],
    signatureAnswers: ['rm1', 'a1', 'g5', 'd1'],
  },
  {
    id: 'retreat_regular',
    name: 'The Wellness Devotee',
    category: 'RESTORER',
    tagline: "Wellness isn't a trend, it's a lifestyle.",
    primaryTraits: [
      { trait: 'transformation', weight: 3, sweetSpot: 7, range: [4, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 5, range: [2, 8] },
    ],
    fineGrained: [
      { trait: 'restoration_need', min: 0.5, weight: 10, sweetSpot: 0.8 },
    ],
    signatureAnswers: ['rm4', 'g5', 'e2', 'tt3'],
  },
  {
    id: 'beach_therapist',
    name: 'The Beach Therapist',
    category: 'RESTORER',
    tagline: 'Salt water heals everything.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: -4, range: [-10, 0] },
      { trait: 'comfort', weight: 2, sweetSpot: 4, range: [0, 7] },
    ],
    fineGrained: [
      { trait: 'nature_orientation', min: 0.6, max: 0.85, weight: 12, sweetSpot: 0.7 },
      { trait: 'restoration_need', min: 0.7, weight: 12, sweetSpot: 0.85 },
      { trait: 'spirituality', max: 0.4, weight: 6 },
    ],
    hardNo: [
      { trait: 'pace', range: [6, 10], penalty: -15 },
      { trait: 'transformation', range: [5, 10], penalty: -15 },
      { trait: 'authenticity', range: [6, 10], penalty: -10 },
    ],
    signatureAnswers: ['rm2', 'i1', 'd1', 'd4', 'a1'],
  },
  {
    id: 'slow_traveler',
    name: 'The Slow Traveler',
    category: 'RESTORER',
    tagline: 'Stay long enough to have a favorite café.',
    primaryTraits: [
      { trait: 'pace', weight: 4, sweetSpot: -6, range: [-10, -2] },
      { trait: 'authenticity', weight: 3, sweetSpot: 7, range: [4, 10] },
      { trait: 'planning', weight: 2, sweetSpot: -3, range: [-8, 2] },
    ],
    fineGrained: [
      { trait: 'cultural_depth', min: 0.3, weight: 10, sweetSpot: 0.6 },
      { trait: 'nature_orientation', max: 0.7, weight: 4 },  // Not primarily nature-focused
    ],
    hardNo: [
      { trait: 'pace', range: [4, 10], penalty: -20 },
    ],
    signatureAnswers: ['rm3', 'd1', 'h3', 'e3', 'e4'],
  },
  {
    id: 'escape_artist',
    name: 'The Reset Traveler',
    category: 'RESTORER',
    tagline: 'Sometimes you need to leave to find yourself.',
    primaryTraits: [
      { trait: 'pace', weight: 2, sweetSpot: -4, range: [-10, 2] },
      { trait: 'transformation', weight: 2, sweetSpot: 5, range: [2, 10] },
    ],
    signatureAnswers: ['a1', 'd4', 'tt2', 'sm5'],  // quiet + relaxed + fresh start + solo
  },
  {
    id: 'sanctuary_seeker',
    name: 'The Sanctuary Seeker',
    category: 'RESTORER',
    tagline: 'Travel is finding your perfect refuge.',
    primaryTraits: [
      { trait: 'comfort', weight: 3, sweetSpot: 8, range: [6, 10] },
      { trait: 'planning', weight: 2, sweetSpot: 6, range: [4, 10] },
      { trait: 'social', weight: 2, sweetSpot: -3, range: [-10, 2] },
      { trait: 'adventure', weight: 1, sweetSpot: 0, range: [-5, 4] },
    ],
    hardNo: [
      { trait: 'social', range: [6, 10], penalty: -20 },
    ],
    signatureAnswers: ['o1', 'rm1', 'rm2', 'h2', 'a1', 'ld2', 'ad4'],  // solitude + stillness/ocean + luxury + craft
  },
  
  // ═══════════════════════════════════════
  // CURATOR category
  // ═══════════════════════════════════════
  {
    id: 'culinary_cartographer',
    name: 'The Culinary Cartographer',
    category: 'CURATOR',
    tagline: 'Your passport is basically a menu.',
    primaryTraits: [
      { trait: 'authenticity', weight: 2, sweetSpot: 5, range: [2, 9] },
    ],
    fineGrained: [
      { trait: 'food_focus', min: 0.4, weight: 20, sweetSpot: 0.85 },  // CORE: must love food (lowered min from 0.5 for sparse trait)
      { trait: 'cultural_depth', min: 0.3, weight: 6, sweetSpot: 0.7 },  // Bonus for cultural interest
      { trait: 'status_seeking', max: 0.7, weight: 4 },  // Mild penalty if too status-driven (raised from 0.6)
    ],
    signatureAnswers: ['g3', 'cd1', 'b3'],  // food + immersion + city (food cities)
  },
  {
    id: 'art_aficionado',
    name: 'The Art Aficionado',
    category: 'CURATOR',
    tagline: 'Every gallery is a pilgrimage.',
    primaryTraits: [
      { trait: 'authenticity', weight: 2, sweetSpot: 5, range: [2, 8] },
      { trait: 'comfort', weight: 2, sweetSpot: 4, range: [1, 7] },
    ],
    fineGrained: [
      { trait: 'art_focus', min: 0.25, weight: 18, sweetSpot: 0.8 },  // CORE: must love art (lowered min from 0.4 for sparse trait)
      { trait: 'cultural_depth', min: 0.4, weight: 8, sweetSpot: 0.8 },
      { trait: 'food_focus', max: 0.6, weight: 4 },  // Penalty if food is dominant (not art)
    ],
    signatureAnswers: ['cd2', 'g2', 'b3', 'h1'],  // culture_depth: aesthetic + culture + city + boutique
  },
  {
    id: 'luxury_luminary',
    name: 'The Luxury Luminary',
    category: 'CURATOR',
    tagline: 'Champagne wishes, caviar dreams, economy never.',
    primaryTraits: [
      { trait: 'comfort', weight: 4, sweetSpot: 9, range: [6, 10] },
      { trait: 'budget', weight: 3, sweetSpot: -8, range: [-10, -4] },
      { trait: 'planning', weight: 2, sweetSpot: 5, range: [2, 8] },
    ],
    hardNo: [
      { trait: 'comfort', range: [-10, 2], penalty: -20 },
    ],
    signatureAnswers: ['ld2', 'c4', 'h2', 'e1'],  // luxury_driver: craft + luxury + resort + planning
  },
  {
    id: 'eco_ethicist',
    name: 'The Mindful Voyager',
    category: 'CURATOR',
    tagline: 'Leave nothing but footprints.',
    primaryTraits: [
      { trait: 'authenticity', weight: 3, sweetSpot: 8, range: [5, 10] },
      { trait: 'transformation', weight: 2, sweetSpot: 5, range: [2, 8] },
    ],
    fineGrained: [
      { trait: 'ethics_focus', min: 0.3, weight: 15, sweetSpot: 0.8 },
      { trait: 'nature_orientation', min: 0.4, weight: 8, sweetSpot: 0.7 },
    ],
    signatureAnswers: ['sm4', 'g1', 'h5', 'rm3'],
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
    signatureAnswers: ['e1', 'h1', 'ld2'],  // detailed + boutique + craft
  },
  
  // ═══════════════════════════════════════
  // TRANSFORMER category
  // ═══════════════════════════════════════
  {
    id: 'gap_year_graduate',
    name: 'The Horizon Chaser',
    category: 'TRANSFORMER',
    tagline: 'The world is the ultimate classroom.',
    primaryTraits: [
      { trait: 'transformation', weight: 4, sweetSpot: 8, range: [5, 10] },
      { trait: 'social', weight: 2, sweetSpot: -3, range: [-7, 3] },
      { trait: 'planning', weight: 2, sweetSpot: -4, range: [-8, 2] },
    ],
    signatureAnswers: ['tt1', 'sm5', 'e4', 'c1'],  // transformation: identity + solo + spontaneous + budget
  },
  {
    id: 'midlife_explorer',
    name: 'The Renaissance Voyager',
    category: 'TRANSFORMER',
    tagline: "It's never too late to become who you were meant to be.",
    primaryTraits: [
      { trait: 'transformation', weight: 3, sweetSpot: 6, range: [3, 9] },
      { trait: 'authenticity', weight: 2, sweetSpot: 5, range: [2, 8] },
      { trait: 'comfort', weight: 2, sweetSpot: 3, range: [0, 7] },
    ],
    fineGrained: [
      { trait: 'restoration_need', min: 0.3, weight: 8, sweetSpot: 0.5 },
      { trait: 'cultural_depth', min: 0.3, weight: 8, sweetSpot: 0.6 },
    ],
    signatureAnswers: ['tt2', 'a2', 'c2', 'c3'],
  },
  {
    id: 'sabbatical_scholar',
    name: 'The Sabbatical Scholar',
    category: 'TRANSFORMER',
    tagline: 'Taking time off to find time on.',
    primaryTraits: [
      { trait: 'transformation', weight: 4, sweetSpot: 8, range: [5, 10] },
      { trait: 'authenticity', weight: 2, sweetSpot: 6, range: [3, 9] },
      { trait: 'planning', weight: 2, sweetSpot: 3, range: [-2, 7] },
    ],
    fineGrained: [
      { trait: 'learning_focus', min: 0.4, weight: 15, sweetSpot: 0.8 },
      { trait: 'cultural_depth', min: 0.4, weight: 8, sweetSpot: 0.7 },
    ],
    signatureAnswers: ['tt3', 'g2', 'cd1', 'sm5', 'sm4'],
  },
  {
    id: 'healing_journeyer',
    name: 'The Restoration Seeker',
    category: 'TRANSFORMER',
    tagline: 'Travel is the medicine for the soul.',
    primaryTraits: [
      { trait: 'transformation', weight: 3, sweetSpot: 7, range: [4, 10] },
      { trait: 'pace', weight: 3, sweetSpot: -5, range: [-10, 0] },
      { trait: 'comfort', weight: 2, sweetSpot: 4, range: [0, 7] },
    ],
    fineGrained: [
      { trait: 'healing_focus', min: 0.25, weight: 20, sweetSpot: 0.8 },  // CORE: travel as medicine
      { trait: 'restoration_need', min: 0.5, weight: 8, sweetSpot: 0.75 },
    ],
    hardNo: [
      { trait: 'pace', range: [5, 10], penalty: -15 },
    ],
    signatureAnswers: ['tt4', 'rm1', 'rm4', 'g5', 'd1'],  // transformation: healing + stillness/program + wellness
  },
  {
    id: 'retirement_ranger',
    name: 'The Boundless Explorer',
    category: 'TRANSFORMER',
    tagline: 'Finally free to explore without limits.',
    primaryTraits: [
      { trait: 'comfort', weight: 3, sweetSpot: 5, range: [2, 8] },
      { trait: 'planning', weight: 2, sweetSpot: 5, range: [2, 8] },
      { trait: 'transformation', weight: 2, sweetSpot: 4, range: [1, 7] },
    ],
    signatureAnswers: ['tt5', 'c3', 'c4', 'e1', 'e2', 'sm2', 'sm3'],  // transformation: fulfillment + comfort/luxury + planning + family/partner
  },
  
  // ═══════════════════════════════════════
  // FALLBACK archetypes
  // ═══════════════════════════════════════
  {
    id: 'balanced_story_collector',
    name: 'The Balanced Story Collector',
    category: 'FALLBACK',
    tagline: 'Every journey adds a chapter worth reading.',
    primaryTraits: [
      // Tighter profile — only wins when traits are truly neutral and no featured archetype matches well
      { trait: 'planning', weight: 0.5, sweetSpot: 0, range: [-2, 2] },
      { trait: 'social', weight: 0.5, sweetSpot: 0, range: [-2, 2] },
      { trait: 'comfort', weight: 0.5, sweetSpot: 0, range: [-2, 2] },
      { trait: 'pace', weight: 0.5, sweetSpot: 0, range: [-2, 2] },
      { trait: 'authenticity', weight: 0.5, sweetSpot: 0, range: [-2, 2] },
      { trait: 'adventure', weight: 0.5, sweetSpot: 0, range: [-2, 2] },
    ],
    signatureAnswers: ['ad3', 'e2', 'd3', 'c2'],
  },
  {
    id: 'flexible_wanderer',
    name: 'The Wildcard',
    category: 'FALLBACK',
    tagline: "Plans are just suggestions—the road decides.",
    primaryTraits: [
      { trait: 'planning', weight: 1.5, sweetSpot: -5, range: [-10, 0] },
      { trait: 'adventure', weight: 1, sweetSpot: 5, range: [2, 10] },
      { trait: 'authenticity', weight: 0.5, sweetSpot: 4, range: [0, 10] },
    ],
    signatureAnswers: ['ad4', 'cd4', 'rm5', 'ld3', 'tt6'],
  },
  
  // Default fallback
  {
    id: 'explorer',
    name: 'The Explorer',
    category: 'FALLBACK',
    tagline: 'The world is your playground.',
    primaryTraits: [
      { trait: 'adventure', weight: 0.5, sweetSpot: 5, range: [-3, 10] },
      { trait: 'authenticity', weight: 0.5, sweetSpot: 5, range: [-3, 10] },
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
  // Q1: Morning routine (STRENGTHENED social signals)
  'a1': { deltas: { pace: -5, social: -5, transformation: 2 }, label: 'Quiet morning person' },  // Stronger solitude signal
  'a2': { deltas: { adventure: 5, pace: 4, planning: -2 }, label: 'Early explorer' },
  'a3': { deltas: { authenticity: 4, planning: 3 }, label: 'Food researcher' },
  'a4': { deltas: { social: 6, planning: -2 }, label: 'Group-oriented' },  // Stronger group signal
  
// Q2: Dream destination
  'b1': { deltas: { authenticity: 6, transformation: 3 }, label: 'History lover' },
  'b2': { deltas: { adventure: 5, authenticity: 3, social: -3 }, label: 'Nature seeker' },
  'b3': { deltas: { social: 4, pace: 3, adventure: 2 }, label: 'City lover' },
  'b4': { deltas: { comfort: 6, budget: -5 }, label: 'Luxury seeker' },  // FIXED: budget negative = splurge
  
  // Q3: Budget - BIPOLAR (budget-conscious vs big-spender)
  // CANONICAL POLARITY: budget positive = frugal/value-focused, negative = splurge/luxury
  'c1': { deltas: { budget: 5, adventure: 2, comfort: -3 }, label: 'Budget-conscious' },  // FIXED: positive = frugal
  'c2': { deltas: { budget: 0, comfort: 2 }, label: 'Balanced spender' },
  'c3': { deltas: { comfort: 5, budget: -4 }, label: 'Quality-first' },  // FIXED: negative = splurge
  'c4': { deltas: { budget: -7, comfort: 6 }, label: 'No-expense-spared' },  // FIXED: negative = splurge
  
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
  
  // Q6: Companions - BIPOLAR for social (STRENGTHENED penalties)
  'f1': { deltas: { social: -7, transformation: 3 }, label: 'Solo traveler' },  // Stronger solo penalty
  'f2': { deltas: { social: 1, comfort: 2 }, label: 'Romantic traveler' },  // Slightly reduced
  'f3': { deltas: { social: 6, adventure: 2 }, label: 'Group traveler' },  // Slightly increased
  'f4': { deltas: { social: 4, planning: 3, comfort: 2 }, label: 'Family traveler' },
  
  // Q7: Activities
  'g1': { deltas: { adventure: 6, pace: 3 }, label: 'Outdoor adventurer' },
  'g2': { deltas: { authenticity: 5, transformation: 2 }, label: 'Culture seeker' },
  'g3': { deltas: { authenticity: 4, social: 2 }, label: 'Foodie' },
  'g4': { deltas: { social: 4, pace: 2 }, label: 'Nightlife lover' },
  'g5': { deltas: { pace: -4, transformation: 4, comfort: 2 }, label: 'Wellness focus' },
  'g6': { deltas: { comfort: 2, authenticity: 2 }, label: 'Shopper' },
  
  // Q8: Accommodation (STRENGTHENED social signals)
  'h1': { deltas: { authenticity: 4, comfort: 2 }, label: 'Boutique hotel' },
  'h2': { deltas: { comfort: 6, budget: -5, social: -2 }, label: 'Luxury resort' },  // Private luxury implies less social
  'h3': { deltas: { authenticity: 4, social: -4 }, label: 'Local rental' },  // Stronger solitude signal
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
  
  // Q11: Post-trip feeling
  'k1': { deltas: { transformation: 7, authenticity: 3 }, label: 'Seeks personal growth' },
  'k2': { deltas: { pace: -5, comfort: 4 }, label: 'Seeks restoration' },
  'k3': { deltas: { adventure: 5, pace: 3, social: 2 }, label: 'Seeks excitement' },
  'k4': { deltas: { social: 6, transformation: 2 }, label: 'Seeks connection' },
  
  // Q12: Cultural immersion depth
  'l1': { deltas: { authenticity: 7, transformation: 4, comfort: -3 }, label: 'Deep immersion' },
  'l2': { deltas: { authenticity: 4, planning: 2 }, label: 'Thoughtful explorer' },
  'l3': { deltas: { comfort: 5, budget: -5, authenticity: 2 }, label: 'Curated premium' },
  'l4': { deltas: { planning: 3, adventure: 2 }, label: 'Highlight collector' },
  
  // Q13: Luxury definition - separates comfort vs authenticity luxury
  'm1': { deltas: { pace: -5, planning: -3, comfort: 2 }, label: 'Time-freedom luxury' },
  'm2': { deltas: { adventure: 4, budget: -4, authenticity: 3 }, label: 'Exclusive access' },
  'm3': { deltas: { comfort: 7, budget: -7 }, label: 'Premium comfort' },
  'm4': { deltas: { authenticity: 6, budget: 2, transformation: 3 }, label: 'Authentic luxury' },
  
  // Q14: Meaningful moments - transformation focused
  'n1': { deltas: { transformation: 6, social: 3, authenticity: 4 }, label: 'Perspective shift' },
  'n2': { deltas: { authenticity: 4, adventure: 3, planning: 2 }, label: 'Bucket list achiever' },
  'n3': { deltas: { adventure: 5, transformation: 5 }, label: 'Challenge seeker' },
  'n4': { deltas: { social: 4, pace: -3, authenticity: 3 }, label: 'Connection moment' },
  
  // Q15: Social energy - EXPLICIT introvert/extrovert disambiguation
  'o1': { deltas: { social: -8, transformation: 2, comfort: 2 }, label: 'Solitude recharger' },  // Strong introvert signal
  'o2': { deltas: { social: -3, comfort: 2 }, label: 'Small groups' },  // Mild introvert
  'o3': { deltas: { social: 3 }, label: 'Flexible social' },  // Balanced
  'o4': { deltas: { social: 8, adventure: 2 }, label: 'Extrovert energizer' },  // Strong extrovert signal
  
  // Q16: Adventure driver - Separates Wilderness Pioneer ↔ Adrenaline Architect
  'ad1': { deltas: { authenticity: 5, social: -3, adventure: 4 }, label: 'Frontier seeker' },      // Remote/wilderness
  'ad2': { deltas: { adventure: 6, pace: 4, transformation: 3 }, label: 'Intensity seeker' },     // Adrenaline/challenge
  'ad3': { deltas: { adventure: 4, authenticity: 2 }, label: 'Both adventure types' },            // Balanced
  'ad4': { deltas: { adventure: -5, comfort: 3 }, label: 'Not adventure-focused' },               // None
  
  // Q17: Culture depth - Separates Cultural Anthropologist ↔ Art Aficionado ↔ Bucket List
  'cd1': { deltas: { authenticity: 6, transformation: 4, planning: 2 }, label: 'Deep immersion' },  // Anthropological
  'cd2': { deltas: { authenticity: 3, comfort: 2 }, label: 'Aesthetic focus' },                     // Art/design
  'cd3': { deltas: { pace: 3, planning: 3, authenticity: -2 }, label: 'Highlights collector' },     // Bucket list
  'cd4': { deltas: { adventure: 2 }, label: 'Not culture-focused' },                                // None
  
  // Q18: Restoration mode - Separates Zen Seeker ↔ Beach Therapist ↔ Slow Traveler ↔ Retreat Regular
  'rm1': { deltas: { pace: -6, social: -4, transformation: 5 }, label: 'Stillness seeker' },        // Zen/meditation
  'rm2': { deltas: { pace: -4, comfort: 3, social: -2 }, label: 'Ocean rhythm' },                   // Beach therapy
  'rm3': { deltas: { pace: -5, authenticity: 5, planning: -3 }, label: 'Slow settler' },            // Slow travel
  'rm4': { deltas: { planning: 4, transformation: 4, comfort: 2 }, label: 'Structured wellness' }, // Retreat
  'rm5': { deltas: { pace: 3, adventure: 2 }, label: 'Action over recharge' },                      // None
  
  // Q19: Luxury driver - Separates Status Seeker ↔ Luxury Luminary
  'ld1': { deltas: { comfort: 5, social: 3, budget: -6 }, label: 'Prestige seeker' },               // Status-driven
  'ld2': { deltas: { comfort: 6, planning: 3, budget: -5 }, label: 'Craft appreciator' },           // Quality-driven
  'ld3': { deltas: { budget: 4, authenticity: 2 }, label: 'Value prioritizer' },                    // Not luxury-focused
  
  // Q20: Transformation type - Separates Gap Year ↔ Midlife ↔ Sabbatical ↔ Healing ↔ Retirement
  'tt1': { deltas: { transformation: 7, social: -2, authenticity: 3 }, label: 'Identity discovery' },      // Gap year
  'tt2': { deltas: { transformation: 6, pace: 2 }, label: 'Fresh start seeker' },                          // Midlife
  'tt3': { deltas: { transformation: 5, planning: 3, authenticity: 4 }, label: 'Skill builder' },          // Sabbatical
  'tt4': { deltas: { transformation: 6, pace: -4, comfort: 3 }, label: 'Healing focus' },                   // Healing
  'tt5': { deltas: { transformation: 4, adventure: 3, planning: 2 }, label: 'Dream fulfillment' },          // Retirement
  'tt6': { deltas: { transformation: -3, comfort: 2 }, label: 'Not transformation-focused' },               // None
  
  // Q21: Social mode - Separates Social Butterfly ↔ Family Architect ↔ Romantic Curator ↔ Community Builder
  'sm1': { deltas: { social: 7, pace: 2 }, label: 'Group social' },                                         // Social butterfly
  'sm2': { deltas: { social: 4, planning: 4, comfort: 3 }, label: 'Family focused' },                       // Family architect
  'sm3': { deltas: { social: 1, comfort: 3, authenticity: 2 }, label: 'Partner focused' },                  // Romantic curator
  'sm4': { deltas: { social: 3, authenticity: 5, transformation: 4 }, label: 'Community builder' },         // Volunteering/giving back
  'sm5': { deltas: { social: -6, transformation: 3, authenticity: 2 }, label: 'Solo traveler' },            // Solo
};

// ============================================================================
// LEGACY ANSWER MAPPINGS - Must be declared BEFORE QUESTION_MAPPINGS
// ============================================================================

const LEGACY_ANSWER_MAPPINGS: Record<string, AnswerDelta> = {
  // Traveler type
  'explorer': { deltas: { adventure: 4, authenticity: 5, transformation: 3 }, label: 'Explorer type' },
  'escape_artist': { deltas: { pace: -5, comfort: 3, transformation: 4 }, label: 'Escape artist' },
  'curated_luxe': { deltas: { comfort: 6, planning: 4, budget: -5 }, label: 'Curated luxe' },  // FIXED: negative = splurge (luxury curator)
  'story_seeker': { deltas: { social: 5, authenticity: 4, transformation: 3 }, label: 'Story seeker' },
  
  // Vibes (STRENGTHENED social signals)
  'coastal': { deltas: { pace: -2, comfort: 2, social: -1 }, label: 'Coastal vibe' },  // Beach = less social
  'urban': { deltas: { social: 4, pace: 2, adventure: 1 }, label: 'Urban vibe' },  // Stronger social signal
  'mountain': { deltas: { adventure: 4, authenticity: 2, social: -2 }, label: 'Mountain vibe' },  // Remote = less social
  'quiet': { deltas: { pace: -4, social: -5, comfort: 2 }, label: 'Quiet vibe' },  // Much stronger solitude signal
  'bold': { deltas: { adventure: 5, transformation: 2, pace: 2 }, label: 'Bold vibe' },
  'spiritual': { deltas: { transformation: 5, authenticity: 4, pace: -2 }, label: 'Spiritual vibe' },
  
  // Budget - CANONICAL POLARITY: positive = frugal, negative = splurge
  'budget': { deltas: { budget: 4, comfort: -2, adventure: 2 }, label: 'Budget tier' },  // FIXED: positive = frugal
  'moderate': { deltas: { budget: 0, comfort: 2 }, label: 'Moderate tier' },
  'premium': { deltas: { budget: -4, comfort: 4 }, label: 'Premium tier' },  // FIXED: negative = splurge
  'luxury': { deltas: { budget: -7, comfort: 6 }, label: 'Luxury tier' },  // FIXED: negative = splurge
  
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
  
  // Hotel/Evening vibes (from Preferences page — stored in travel_vibes)
  'Spa treatments': { deltas: { social: -1, pace: -2, comfort: 3 }, label: 'Spa vibe' },
  'Drinks & socializing': { deltas: { social: 3, adventure: 1 }, label: 'Social evening vibe' },
  'Alone time in room': { deltas: { social: -3, pace: -1 }, label: 'Solitude vibe' },
  'Room service': { deltas: { social: -2, comfort: 2 }, label: 'Room service vibe' },
  'Exploring nightlife': { deltas: { social: 3, adventure: 2, pace: 1 }, label: 'Nightlife vibe' },
  'Early sleep': { deltas: { pace: -2, social: -1, planning: 1 }, label: 'Early sleep vibe' },
  'Light walking': { deltas: { pace: -1, authenticity: 1 }, label: 'Light walking vibe' },
};

// ============================================================================
// QUESTION-SPECIFIC MAPPINGS - For accurate possibleMax calculation
// Each question maps to ONLY the answers that are valid for that question
// ============================================================================

const QUESTION_MAPPINGS: Record<string, Record<string, AnswerDelta>> = {
  // Quiz 1.0 questions use LEGACY_ANSWER_MAPPINGS but scoped to valid answers
  traveler_type: {
    explorer: LEGACY_ANSWER_MAPPINGS.explorer,
    escape_artist: LEGACY_ANSWER_MAPPINGS.escape_artist,
    curated_luxe: LEGACY_ANSWER_MAPPINGS.curated_luxe,
    story_seeker: LEGACY_ANSWER_MAPPINGS.story_seeker,
  },
  travel_vibes: {
    coastal: LEGACY_ANSWER_MAPPINGS.coastal,
    urban: LEGACY_ANSWER_MAPPINGS.urban,
    mountain: LEGACY_ANSWER_MAPPINGS.mountain,
    quiet: LEGACY_ANSWER_MAPPINGS.quiet,
    bold: LEGACY_ANSWER_MAPPINGS.bold,
    spiritual: LEGACY_ANSWER_MAPPINGS.spiritual,
    // Hotel/evening vibes from Preferences page
    'Spa treatments': LEGACY_ANSWER_MAPPINGS['Spa treatments'],
    'Drinks & socializing': LEGACY_ANSWER_MAPPINGS['Drinks & socializing'],
    'Alone time in room': LEGACY_ANSWER_MAPPINGS['Alone time in room'],
    'Room service': LEGACY_ANSWER_MAPPINGS['Room service'],
    'Exploring nightlife': LEGACY_ANSWER_MAPPINGS['Exploring nightlife'],
    'Early sleep': LEGACY_ANSWER_MAPPINGS['Early sleep'],
    'Light walking': LEGACY_ANSWER_MAPPINGS['Light walking'],
  },
  budget: {
    budget: LEGACY_ANSWER_MAPPINGS.budget,
    moderate: LEGACY_ANSWER_MAPPINGS.moderate,
    premium: LEGACY_ANSWER_MAPPINGS.premium,
    luxury: LEGACY_ANSWER_MAPPINGS.luxury,
  },
  pace: {
    relaxed: LEGACY_ANSWER_MAPPINGS.relaxed,
    balanced: LEGACY_ANSWER_MAPPINGS.balanced,
    active: LEGACY_ANSWER_MAPPINGS.active,
  },
  planning_style: {
    detailed: LEGACY_ANSWER_MAPPINGS.detailed,
    flexible: LEGACY_ANSWER_MAPPINGS.flexible,
    spontaneous: LEGACY_ANSWER_MAPPINGS.spontaneous,
  },
  travel_companions: {
    solo: LEGACY_ANSWER_MAPPINGS.solo,
    partner: LEGACY_ANSWER_MAPPINGS.partner,
    family: LEGACY_ANSWER_MAPPINGS.family,
    friends: LEGACY_ANSWER_MAPPINGS.friends,
  },
  interests: {
    food: LEGACY_ANSWER_MAPPINGS.food,
    culture: LEGACY_ANSWER_MAPPINGS.culture,
    nature: LEGACY_ANSWER_MAPPINGS.nature,
    art: LEGACY_ANSWER_MAPPINGS.art,
    nightlife: LEGACY_ANSWER_MAPPINGS.nightlife,
    wellness: LEGACY_ANSWER_MAPPINGS.wellness,
    adventure: LEGACY_ANSWER_MAPPINGS.adventure,
    shopping: LEGACY_ANSWER_MAPPINGS.shopping,
  },
  accommodation: {
    boutique: LEGACY_ANSWER_MAPPINGS.boutique,
    chain: LEGACY_ANSWER_MAPPINGS.chain,
    vacation_rental: LEGACY_ANSWER_MAPPINGS.vacation_rental,
    resort: LEGACY_ANSWER_MAPPINGS.resort,
  },
  // Quiz 2.0 question mappings (if using ANSWER_DELTAS)
  morning_routine: { a1: ANSWER_DELTAS.a1, a2: ANSWER_DELTAS.a2, a3: ANSWER_DELTAS.a3, a4: ANSWER_DELTAS.a4 },
  dream_destination: { b1: ANSWER_DELTAS.b1, b2: ANSWER_DELTAS.b2, b3: ANSWER_DELTAS.b3, b4: ANSWER_DELTAS.b4 },
  budget_style: { c1: ANSWER_DELTAS.c1, c2: ANSWER_DELTAS.c2, c3: ANSWER_DELTAS.c3, c4: ANSWER_DELTAS.c4 },
  pace_style: { d1: ANSWER_DELTAS.d1, d2: ANSWER_DELTAS.d2, d3: ANSWER_DELTAS.d3, d4: ANSWER_DELTAS.d4 },
  planning_preference: { e1: ANSWER_DELTAS.e1, e2: ANSWER_DELTAS.e2, e3: ANSWER_DELTAS.e3, e4: ANSWER_DELTAS.e4 },
  companions: { f1: ANSWER_DELTAS.f1, f2: ANSWER_DELTAS.f2, f3: ANSWER_DELTAS.f3, f4: ANSWER_DELTAS.f4 },
  activities: { g1: ANSWER_DELTAS.g1, g2: ANSWER_DELTAS.g2, g3: ANSWER_DELTAS.g3, g4: ANSWER_DELTAS.g4, g5: ANSWER_DELTAS.g5, g6: ANSWER_DELTAS.g6 },
  accommodation_style: { h1: ANSWER_DELTAS.h1, h2: ANSWER_DELTAS.h2, h3: ANSWER_DELTAS.h3, h4: ANSWER_DELTAS.h4, h5: ANSWER_DELTAS.h5 },
  climate: { i1: ANSWER_DELTAS.i1, i2: ANSWER_DELTAS.i2, i3: ANSWER_DELTAS.i3, i4: ANSWER_DELTAS.i4 },
  trip_length: { j1: ANSWER_DELTAS.j1, j2: ANSWER_DELTAS.j2, j3: ANSWER_DELTAS.j3, j4: ANSWER_DELTAS.j4 },
  post_trip_feeling: { k1: ANSWER_DELTAS.k1, k2: ANSWER_DELTAS.k2, k3: ANSWER_DELTAS.k3, k4: ANSWER_DELTAS.k4 },
  cultural_immersion: { l1: ANSWER_DELTAS.l1, l2: ANSWER_DELTAS.l2, l3: ANSWER_DELTAS.l3, l4: ANSWER_DELTAS.l4 },
  luxury_definition: { m1: ANSWER_DELTAS.m1, m2: ANSWER_DELTAS.m2, m3: ANSWER_DELTAS.m3, m4: ANSWER_DELTAS.m4 },
  meaningful_moment: { n1: ANSWER_DELTAS.n1, n2: ANSWER_DELTAS.n2, n3: ANSWER_DELTAS.n3, n4: ANSWER_DELTAS.n4 },
  social_energy: { o1: ANSWER_DELTAS.o1, o2: ANSWER_DELTAS.o2, o3: ANSWER_DELTAS.o3, o4: ANSWER_DELTAS.o4 },
  
  // Q16-Q21: Disambiguation questions for archetype separation
  adventure_driver: { ad1: ANSWER_DELTAS.ad1, ad2: ANSWER_DELTAS.ad2, ad3: ANSWER_DELTAS.ad3, ad4: ANSWER_DELTAS.ad4 },
  culture_depth: { cd1: ANSWER_DELTAS.cd1, cd2: ANSWER_DELTAS.cd2, cd3: ANSWER_DELTAS.cd3, cd4: ANSWER_DELTAS.cd4 },
  restoration_mode: { rm1: ANSWER_DELTAS.rm1, rm2: ANSWER_DELTAS.rm2, rm3: ANSWER_DELTAS.rm3, rm4: ANSWER_DELTAS.rm4, rm5: ANSWER_DELTAS.rm5 },
  luxury_driver: { ld1: ANSWER_DELTAS.ld1, ld2: ANSWER_DELTAS.ld2, ld3: ANSWER_DELTAS.ld3 },
  transformation_type: { tt1: ANSWER_DELTAS.tt1, tt2: ANSWER_DELTAS.tt2, tt3: ANSWER_DELTAS.tt3, tt4: ANSWER_DELTAS.tt4, tt5: ANSWER_DELTAS.tt5, tt6: ANSWER_DELTAS.tt6 },
  social_mode: { sm1: ANSWER_DELTAS.sm1, sm2: ANSWER_DELTAS.sm2, sm3: ANSWER_DELTAS.sm3, sm4: ANSWER_DELTAS.sm4, sm5: ANSWER_DELTAS.sm5 },
  
  // Additional legacy question mappings (must match all keys used in calculateTraitScoresV2)
  hotel_priorities: {
    boutique: LEGACY_ANSWER_MAPPINGS.boutique,
    chain: LEGACY_ANSWER_MAPPINGS.chain,
    vacation_rental: LEGACY_ANSWER_MAPPINGS.vacation_rental,
    resort: LEGACY_ANSWER_MAPPINGS.resort,
    location: { deltas: { planning: 2, authenticity: 3 }, label: 'Location priority' },
    amenities: { deltas: { comfort: 4 }, label: 'Amenities priority' },
    unique: { deltas: { authenticity: 4, adventure: 2 }, label: 'Unique stays' },
  },
  weather_preference: {
    warm: { deltas: { comfort: 2 }, label: 'Warm weather' },
    mild: { deltas: { pace: 1 }, label: 'Mild weather' },
    cold: { deltas: { adventure: 2 }, label: 'Cold weather' },
    seasonal: { deltas: { authenticity: 2, adventure: 1 }, label: 'Seasonal variety' },
    tropical: { deltas: { comfort: 3, pace: -1 }, label: 'Tropical weather' },
    temperate: { deltas: { authenticity: 2, pace: 1 }, label: 'Temperate climate' },
    variable: { deltas: { adventure: 2, planning: 2 }, label: 'Variable weather' },
  },
  dining_style: {
    local: { deltas: { authenticity: 5, social: 2 }, label: 'Local cuisine' },
    familiar: { deltas: { comfort: 2 }, label: 'Familiar food' },
    fine_dining: { deltas: { comfort: 4, budget: -3 }, label: 'Fine dining' },  // negative = splurge
    street_food: { deltas: { authenticity: 4, adventure: 2, budget: 2 }, label: 'Street food' },  // positive = value
    adventurous: { deltas: { adventure: 4, authenticity: 3 }, label: 'Adventurous eater' },
    balanced: { deltas: { comfort: 2, authenticity: 2 }, label: 'Balanced dining' },
  },
  flight_preferences: {
    direct: { deltas: { comfort: 2, planning: 2 }, label: 'Direct flights' },
    layover_ok: { deltas: { budget: 2, adventure: 1 }, label: 'Layovers OK' },  // positive = value
    premium_class: { deltas: { comfort: 5, budget: -5 }, label: 'Premium class' },  // negative = splurge
    budget_carrier: { deltas: { budget: 4, comfort: -2 }, label: 'Budget carrier' },  // positive = value
    flexible: { deltas: { adventure: 2, budget: 2 }, label: 'Flexible flights' },
  },
  // NEW: Trip frequency and duration (previously missing)
  trip_frequency: {
    monthly: { deltas: { pace: 3, adventure: 2, transformation: 2 }, label: 'Frequent traveler' },
    quarterly: { deltas: { pace: 1, planning: 2 }, label: 'Regular traveler' },
    biannually: { deltas: { planning: 3, comfort: 2 }, label: 'Occasional traveler' },
    annually: { deltas: { planning: 4, comfort: 3 }, label: 'Annual vacationer' },
  },
  trip_duration: {
    weekend: { deltas: { pace: 4, adventure: 2 }, label: 'Weekend warrior' },
    short_week: { deltas: { pace: 2 }, label: 'Short breaks' },
    week: { deltas: { authenticity: 2, pace: 0 }, label: 'Week trips' },
    extended: { deltas: { authenticity: 4, transformation: 3, pace: -2 }, label: 'Extended journeys' },
  },
};

// ============================================================================
// DISAMBIGUATION QUESTION PICKER - Maps traits to questions that clarify them
// IMPORTANT: All question IDs here MUST exist in the quiz schema!
// ============================================================================

// Valid quiz question IDs derived from QUESTION_MAPPINGS (single source of truth)
// Plus a few disambiguation-specific questions that may not be in QUESTION_MAPPINGS yet
const VALID_QUIZ_QUESTION_IDS = new Set([
  ...Object.keys(QUESTION_MAPPINGS),
  // Disambiguation-specific questions (must be added to quiz if not present)
  'splurge_priority', 'activity_density', 'service_level',
]);

// Fallback safe questions that always exist in QUESTION_MAPPINGS
const SAFE_FALLBACK_QUESTIONS = Object.keys(QUESTION_MAPPINGS).includes('budget') 
  ? ['budget', 'pace', 'interests'] 
  : ['traveler_type', 'travel_vibes'];

const DISAMBIGUATION_QUESTIONS_BY_TRAIT: Record<Trait, string[]> = {
  pace: ['pace_style', 'activity_density', 'pace'],
  authenticity: ['travel_vibes', 'dining_style', 'interests'],
  comfort: ['accommodation', 'hotel_priorities', 'service_level'],
  adventure: ['activities', 'interests', 'travel_vibes'],
  social: ['travel_companions', 'dining_style', 'interests'],
  planning: ['planning_style', 'planning_preference', 'interests'],
  budget: ['budget', 'splurge_priority', 'accommodation'],
  transformation: ['traveler_type', 'interests', 'activities'],
};

// ============================================================================
// TENSION RESOLVERS - One-liners for common profile contradictions
// ============================================================================

interface TensionPattern {
  condition: (traits: TraitScores) => boolean;
  label: string;
  explanation: string;
}

// CANONICAL POLARITY: budget positive = frugal/value-focused, negative = splurge/luxury
// All conditions below follow this rule!
const TENSION_PATTERNS: TensionPattern[] = [
  // ORDERED BY SPECIFICITY: most specific patterns FIRST to prevent masking
  
  // 1. aspirational luxury = highest comfort + strongest frugality (most specific combo)
  {
    condition: (t) => t.comfort >= 6 && t.budget >= 5,
    label: 'aspirational luxury',
    explanation: 'You have refined tastes and love finding exceptional value—high-end feel with smart choices.',
  },
  // 2. premium adventure = 3 traits required (adventure + comfort + frugal)
  {
    condition: (t) => t.adventure >= 5 && t.comfort >= 4 && t.budget >= 2,
    label: 'premium adventure',
    explanation: 'You seek thrilling experiences with excellent logistics—adventure without roughing it.',
  },
  // 3. budget adventurer = high adventure + strong frugality
  {
    condition: (t) => t.adventure >= 5 && t.budget >= 5,
    label: 'budget adventurer',
    explanation: 'You love bold experiences and are resourceful about making them happen affordably.',
  },
  // 4. value-focused premium = high comfort + frugality (less specific than aspirational)
  {
    condition: (t) => t.comfort >= 5 && t.budget >= 3,
    label: 'value-focused premium',
    explanation: 'You appreciate quality but are strategic about where you splurge—maximizing comfort ROI.',
  },
  // 5. splurge-forward luxury = high comfort + splurge preference (budget negative)
  {
    condition: (t) => t.comfort >= 5 && t.budget <= -3,
    label: 'splurge-forward luxury',
    explanation: 'You prioritize top-tier experiences and comfort, and cost isn\'t a primary constraint.',
  },
  // 6. selective intensity = slow pace + high adventure
  {
    condition: (t) => t.pace <= -4 && t.adventure >= 4,
    label: 'selective intensity',
    explanation: "You prefer a relaxed base pace punctuated by bold peak experiences: quality over quantity.",
  },
  // 7. solo immersive = low social + high authenticity
  {
    condition: (t) => t.social <= -3 && t.authenticity >= 5,
    label: 'solo immersive',
    explanation: 'You seek deep local connections on your own terms—meaningful encounters, not constant company.',
  },
  // 8. planned spontaneity = high planning + high adventure
  {
    condition: (t) => t.planning >= 5 && t.adventure >= 4,
    label: 'planned spontaneity',
    explanation: 'You research thoroughly so you can be spontaneous with confidence—adventure with a safety net.',
  },
  // 9. curated authentic = comfort + authenticity (broader match)
  {
    condition: (t) => t.comfort >= 4 && t.authenticity >= 5,
    label: 'curated authentic',
    explanation: "You want genuine local experiences without sacrificing comfort: the best of both worlds.",
  },
  // 10. intense growth = high pace + high transformation
  {
    condition: (t) => t.pace >= 4 && t.transformation >= 4,
    label: 'intense growth',
    explanation: 'You pack in experiences not for the checklist, but for maximum personal transformation.',
  },
];

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
  fillRates: Record<Trait, number>;  // NEW: percent-of-possible per trait (0-100)
  possibleMax: TraitScores;  // NEW: maximum possible score per trait given answered questions
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
  
  // NEW: Track maximum possible contribution per trait from answered questions
  const possibleMax: TraitScores = {
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
  
  // Smoothing prior (prevents extreme scores from few answers)
  const PRIOR = 1;
  
  /**
   * Get max possible delta for each trait from a question's answer options
   */
  function getMaxPossibleForQuestion(questionId: string, answerOptions: string[], mappings: Record<string, AnswerDelta>): Partial<TraitScores> {
    const maxByTrait: Partial<TraitScores> = {};
    
    for (const answerId of answerOptions) {
      const delta = mappings[answerId];
      if (!delta) continue;
      
      for (const [trait, value] of Object.entries(delta.deltas)) {
        const absValue = Math.abs(value as number);
        const current = maxByTrait[trait as Trait] || 0;
        if (absValue > current) {
          maxByTrait[trait as Trait] = absValue;
        }
      }
    }
    
    return maxByTrait;
  }
  
  /**
   * Add to possibleMax for traits touched by this question
   * FIXED: Now uses question-specific mappings from QUESTION_MAPPINGS
   */
  function updatePossibleMax(questionId: string, multiplier: number = 1.0) {
    // Get question-specific mapping (not the global LEGACY_ANSWER_MAPPINGS!)
    const qMap = QUESTION_MAPPINGS[questionId];
    if (!qMap) {
      console.warn(`[TravelDNA] No QUESTION_MAPPINGS for: ${questionId}`);
      return;
    }
    
    // Calculate max possible contribution for each trait from this question's answers only
    const maxByTrait: Partial<Record<Trait, number>> = {};
    for (const delta of Object.values(qMap)) {
      if (!delta) continue;
      for (const [trait, value] of Object.entries(delta.deltas)) {
        const absVal = Math.abs(value as number);
        maxByTrait[trait as Trait] = Math.max(maxByTrait[trait as Trait] ?? 0, absVal);
      }
    }
    
    // Add to possibleMax with multiplier
    for (const [trait, maxVal] of Object.entries(maxByTrait)) {
      possibleMax[trait as Trait] += (maxVal as number) * multiplier;
    }
  }
  
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
      updatePossibleMax('traveler_type', 1.0);
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
    // Count as one question for possibleMax
    updatePossibleMax('travel_vibes', 1.0);
  }
  
  // Process budget (single select)
  if (answers.budget) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.budget];
    if (delta) {
      applyAnswerDeltas('budget', answers.budget, delta, 1.0);
      updatePossibleMax('budget', 1.0);  // Use 'budget' key which matches QUESTION_MAPPINGS
    }
  }
  
  // Process pace (single select)
  if (answers.pace) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.pace];
    if (delta) {
      applyAnswerDeltas('pace', answers.pace, delta, 1.0);
      updatePossibleMax('pace', 1.0);  // Use 'pace' key which matches QUESTION_MAPPINGS
    }
  }
  
  // Process planning_style (single select)
  if (answers.planning_style) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.planning_style];
    if (delta) {
      applyAnswerDeltas('planning_style', answers.planning_style, delta, 1.0);
      updatePossibleMax('planning_style', 1.0);
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
    updatePossibleMax('travel_companions', 1.0);
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
    updatePossibleMax('interests', 1.0);
  }
  
  // Process accommodation (single select)
  if (answers.accommodation) {
    const delta = LEGACY_ANSWER_MAPPINGS[answers.accommodation];
    if (delta) {
      applyAnswerDeltas('accommodation', answers.accommodation, delta, 1.0);
      updatePossibleMax('accommodation', 1.0);
    }
  }
  
  // Process hotel_priorities (multi-select) - NORMALIZED
  // NOTE: hotel_priorities may use mixed deltas, but QUESTION_MAPPINGS covers it
  if (answers.hotel_priorities?.length) {
    const k = answers.hotel_priorities.length;
    const multiplier = 1 / Math.min(k, 3);
    
    for (const priority of answers.hotel_priorities) {
      const delta = ANSWER_DELTAS[priority] || LEGACY_ANSWER_MAPPINGS[priority];
      if (delta) {
        applyAnswerDeltas('hotel_priorities', priority, delta, multiplier);
      }
    }
    updatePossibleMax('accommodation_style', 1.0);  // Use accommodation_style from QUESTION_MAPPINGS
  }
  
  // Process weather_preference (multi-select) - NORMALIZED
  if (answers.weather_preference?.length) {
    const k = answers.weather_preference.length;
    const multiplier = 1 / Math.min(k, 2);
    
    for (const weather of answers.weather_preference) {
      // Look up in QUESTION_MAPPINGS.weather_preference first, then fallback
      const delta = QUESTION_MAPPINGS.weather_preference?.[weather] || 
                    ANSWER_DELTAS[weather] || 
                    LEGACY_ANSWER_MAPPINGS[weather];
      if (delta) {
        applyAnswerDeltas('weather_preference', weather, delta, multiplier);
      }
    }
    updatePossibleMax('weather_preference', 1.0);
  }
  
  // Process dining_style (single select) - NEW
  if (answers.dining_style) {
    const delta = QUESTION_MAPPINGS.dining_style?.[answers.dining_style] || 
                  LEGACY_ANSWER_MAPPINGS[answers.dining_style];
    if (delta) {
      applyAnswerDeltas('dining_style', answers.dining_style, delta, 1.0);
      updatePossibleMax('dining_style', 1.0);
    }
  }
  
  // Process flight_preferences (single or multi-select) - NEW
  if (answers.flight_preferences) {
    const flightPref = Array.isArray(answers.flight_preferences) 
      ? answers.flight_preferences 
      : [answers.flight_preferences];
    const k = flightPref.length;
    const multiplier = 1 / Math.min(k, 2);
    
    for (const pref of flightPref) {
      const delta = QUESTION_MAPPINGS.flight_preferences?.[pref] || 
                    LEGACY_ANSWER_MAPPINGS[pref];
      if (delta) {
        applyAnswerDeltas('flight_preferences', pref, delta, multiplier);
      }
    }
    updatePossibleMax('flight_preferences', 1.0);
  }
  
  // Process trip_frequency (single select) - NEW
  if (answers.trip_frequency) {
    const delta = QUESTION_MAPPINGS.trip_frequency?.[answers.trip_frequency];
    if (delta) {
      applyAnswerDeltas('trip_frequency', answers.trip_frequency, delta, 1.0);
      updatePossibleMax('trip_frequency', 1.0);
    }
  }
  
  // Process trip_duration (single select) - NEW
  if (answers.trip_duration) {
    const delta = QUESTION_MAPPINGS.trip_duration?.[answers.trip_duration];
    if (delta) {
      applyAnswerDeltas('trip_duration', answers.trip_duration, delta, 1.0);
      updatePossibleMax('trip_duration', 1.0);
    }
  }
  
  // Calculate fill rates (percent-of-possible)
  // FIXED: Return 0 if trait had no opportunity to be influenced (possibleMax=0)
  const fillRates: Record<Trait, number> = {} as Record<Trait, number>;
  for (const trait of ALL_TRAITS) {
    if (possibleMax[trait] <= 0) {
      // No questions touched this trait - fill rate is 0, not 50%
      fillRates[trait] = 0;
    } else {
      const denom = possibleMax[trait] + PRIOR;
      const num = Math.abs(rawScores[trait]) + PRIOR * 0.5;  // Neutral prior
      fillRates[trait] = Math.round((num / denom) * 100);
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
    fillRates,
    possibleMax,
    contributions,
  };
}

// ============================================================================
// PREFERENCE-BASED V2 TRAIT COMPUTATION (fallback when legacy parser fails)
// Maps preference-format answers directly to V2 traits (-10 to +10 scale)
// ============================================================================

function computeV2TraitsFromPreferences(answers: QuizAnswers): Record<string, number> {
  const traits: Record<string, number> = {
    planning: 0, social: 0, comfort: 0, pace: 0,
    authenticity: 0, adventure: 0, budget: 0, transformation: 0,
  };

  // Budget preference → budget trait (CANONICAL: positive = frugal)
  const budgetMap: Record<string, number> = {
    budget: 7, value: 5, moderate: 2, flexible: 0, premium: -4, luxury: -7,
  };
  if (answers.budget && budgetMap[answers.budget] !== undefined) {
    traits.budget = budgetMap[answers.budget];
  }

  // Pace preference
  const paceMap: Record<string, number> = {
    slow: -6, relaxed: -3, moderate: 0, balanced: 0, active: 4, packed: 7, intense: 7,
  };
  if (answers.pace && paceMap[answers.pace] !== undefined) {
    traits.pace = paceMap[answers.pace];
  }

  // Planning style
  const planningMap: Record<string, number> = {
    spontaneous: -6, flexible: -3, balanced: 0, moderate: 0, structured: 4, detailed: 7,
  };
  if (answers.planning_style && planningMap[answers.planning_style] !== undefined) {
    traits.planning = planningMap[answers.planning_style];
  }

  // Accommodation → comfort trait
  const accomMap: Record<string, number> = {
    hostel: -5, budget: -3, mid_range: 0, moderate: 0, boutique: 3, luxury: 6, resort: 7,
  };
  if (answers.accommodation && accomMap[answers.accommodation] !== undefined) {
    traits.comfort = accomMap[answers.accommodation];
  }

  // Travel companions → social trait
  if (answers.travel_companions?.length) {
    const companions = answers.travel_companions;
    if (companions.includes('solo')) traits.social -= 4;
    if (companions.includes('partner')) traits.social -= 1;
    if (companions.includes('friends') || companions.includes('group')) traits.social += 4;
    if (companions.includes('family')) traits.social += 2;
    traits.social = Math.max(-10, Math.min(10, traits.social));
  }

  // Interests → adventure + authenticity + transformation
  if (answers.interests?.length) {
    const interests = answers.interests;
    if (interests.includes('adventure') || interests.includes('outdoor')) traits.adventure += 4;
    if (interests.includes('culture') || interests.includes('history')) {
      traits.authenticity += 4;
      traits.transformation += 2;
    }
    if (interests.includes('food') || interests.includes('culinary')) traits.authenticity += 2;
    if (interests.includes('relaxation') || interests.includes('wellness')) {
      traits.pace -= 3;
      traits.transformation += 2;
    }
    if (interests.includes('nightlife') || interests.includes('entertainment')) {
      traits.social += 2;
      traits.pace += 2;
    }
    // Clamp all
    for (const t of Object.keys(traits)) {
      traits[t] = Math.max(-10, Math.min(10, traits[t]));
    }
  }

  // Traveler type → broad trait adjustments
  const travelerTypeMap: Record<string, Partial<Record<string, number>>> = {
    explorer: { adventure: 4, authenticity: 3 },
    relaxer: { pace: -5, comfort: 3 },
    adventurer: { adventure: 6, pace: 3 },
    culture_buff: { authenticity: 5, transformation: 3 },
    foodie: { authenticity: 3 },
    luxury: { comfort: 6, budget: -5 },
    backpacker: { budget: 6, adventure: 3, comfort: -3 },
    planner: { planning: 5 },
    spontaneous: { planning: -5 },
  };
  if (answers.traveler_type && travelerTypeMap[answers.traveler_type]) {
    for (const [t, v] of Object.entries(travelerTypeMap[answers.traveler_type]!)) {
      traits[t] = Math.max(-10, Math.min(10, (traits[t] || 0) + (v || 0)));
    }
  }

  // Travel vibes → additional signal
  if (answers.travel_vibes?.length) {
    for (const vibe of answers.travel_vibes) {
      const vibeLower = vibe.toLowerCase();
      if (vibeLower.includes('adventure')) traits.adventure += 2;
      if (vibeLower.includes('relax') || vibeLower.includes('peace')) traits.pace -= 2;
      if (vibeLower.includes('culture') || vibeLower.includes('local')) traits.authenticity += 2;
      if (vibeLower.includes('luxury') || vibeLower.includes('comfort')) traits.comfort += 2;
      if (vibeLower.includes('transform') || vibeLower.includes('grow')) traits.transformation += 2;
    }
    for (const t of Object.keys(traits)) {
      traits[t] = Math.max(-10, Math.min(10, traits[t]));
    }
  }

  console.log('[TravelDNA V2] computeV2TraitsFromPreferences result:', traits);
  return traits;
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
  contributions: TraitContribution[],
  fineGrainedTraits?: Record<string, number> | null
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
    
    // Apply fine-grained V3 trait scoring (the critical differentiator for most archetypes)
    if (archetype.fineGrained && fineGrainedTraits) {
      for (const fg of archetype.fineGrained) {
        const traitValue = fineGrainedTraits[fg.trait];
        if (traitValue === undefined) continue;
        
        // Check min/max constraints
        const meetsMin = fg.min === undefined || traitValue >= fg.min;
        const meetsMax = fg.max === undefined || traitValue <= fg.max;
        
        if (meetsMin && meetsMax) {
          // Calculate bonus based on proximity to sweetSpot (if defined)
          let matchQuality = 1.0;
          if (fg.sweetSpot !== undefined) {
            const distance = Math.abs(traitValue - fg.sweetSpot);
            matchQuality = Math.max(0.3, 1 - distance); // Minimum 0.3 quality if in range
          }
          const bonus = matchQuality * fg.weight;
          score += bonus;
          if (bonus > 3) {
            reasons.push({
              trait: 'authenticity' as Trait, // Use authenticity as placeholder for fine-grained
              effect: 'boost',
              amount: Math.round(bonus * 10) / 10,
              note: `Fine-grained ${fg.trait} at ${traitValue.toFixed(2)} (bonus: +${bonus.toFixed(1)})`,
            });
          }
        } else {
          // Outside acceptable range = steeper penalty to prevent false matches
          const penalty = -(fg.weight * 0.75);
          score += penalty;
          if (penalty < -3) {
            reasons.push({
              trait: 'authenticity' as Trait,
              effect: 'penalty',
              amount: Math.round(penalty * 10) / 10,
              note: `Fine-grained ${fg.trait} at ${traitValue.toFixed(2)} outside range${fg.min !== undefined ? ` min:${fg.min}` : ''}${fg.max !== undefined ? ` max:${fg.max}` : ''}`,
            });
          }
        }
      }
    }
    
    // Penalize FALLBACK archetypes to prevent them from dominating
    if (archetype.category === 'FALLBACK') {
      score *= 0.6; // 40% penalty — fallbacks should only win when nothing else fits
    }
    
    archetypeScores.push({ archetype, score, reasons });
  }
  
  // Sort by score descending
  archetypeScores.sort((a, b) => b.score - a.score);
  
  // ═══════════════════════════════════════
  // NO FALLBACK LOGIC
  // ═══════════════════════════════════════
  // Previously, weak/flat profiles would get auto-assigned flexible_wanderer or 
  // balanced_story_collector. This has been removed so that archetypes are ALWAYS
  // determined purely by the user's actual quiz/preference data with no artificial
  // boosting of generic archetypes.
  //
  // If the user has weak signals, their archetype confidence will simply be lower.
  // ═══════════════════════════════════════
  const _unused_fallbackUsed = false; // Preserved for downstream compat if referenced
  
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
  // CANONICAL: budget positive = frugal/value-focused, negative = splurge/luxury
  if (traits.budget >= 5) tags.push('value-driven');  // FIXED: positive = frugal
  if (traits.budget <= -3) tags.push('luxury');  // FIXED: negative = splurge
  
  return [...new Set(tags)].slice(0, 8);
}

// ============================================================================
// "WHY THIS RESULT" EXPLAINABILITY BUILDER
// ============================================================================

function buildWhyThisResult(
  primaryArchetype: ArchetypeV2,
  secondaryArchetype: ArchetypeV2 | null,
  primaryMatch: ArchetypeMatch,
  traits: TraitScores,
  topContributors: TraitContribution[],
  confidence: number
): WhyThisResult {
  // Build human-readable reasons for primary archetype
  const primaryReasons: string[] = [];
  
  // From match reasons
  for (const reason of primaryMatch.reasons.slice(0, 3)) {
    if (reason.effect === 'boost') {
      const traitLabel = formatTraitLabel(reason.trait, traits[reason.trait]);
      primaryReasons.push(`Your ${traitLabel} aligns with ${primaryArchetype.name}`);
    }
  }
  
  // From top contributors
  for (const contrib of topContributors.slice(0, 2)) {
    if (contrib.label) {
      primaryReasons.push(`You selected "${contrib.label}"`);
    }
  }
  
  // Build trait explanations
  const traitExplanations: WhyThisResult['trait_explanations'] = [];
  
  for (const trait of ALL_TRAITS) {
    const value = traits[trait];
    if (Math.abs(value) >= 3) {  // Only explain significant traits
      const contributingAnswers = topContributors
        .filter(c => c.deltas[trait] !== undefined && Math.abs(c.deltas[trait] as number) >= 1)
        .map(c => c.label || c.answer_id)
        .slice(0, 3);
      
      traitExplanations.push({
        trait,
        value,
        explanation: formatTraitExplanation(trait, value),
        contributing_answers: contributingAnswers,
      });
    }
  }
  
  // Build confidence explanation
  let confidenceExplanation: string;
  if (confidence >= 80) {
    confidenceExplanation = 'High confidence - your answers strongly point to this archetype';
  } else if (confidence >= 60) {
    confidenceExplanation = 'Good confidence - your profile shows clear preferences with some flexibility';
  } else if (confidence >= 40) {
    confidenceExplanation = 'Moderate confidence - you have a blend of different travel styles';
  } else {
    confidenceExplanation = 'Still learning about you - your profile shows diverse preferences';
  }
  
  // Build top evidence
  const topEvidence: WhyThisResult['top_evidence'] = topContributors.slice(0, 4).map(c => ({
    question_id: c.question_id,
    answer_id: c.answer_id,
    answer_label: c.label || c.answer_id,
    impact_summary: formatImpactSummary(c.deltas),
  }));
  
  return {
    primary_archetype_reasons: primaryReasons.slice(0, 4),
    trait_explanations: traitExplanations.slice(0, 5),
    confidence_explanation: confidenceExplanation,
    top_evidence: topEvidence,
  };
}

function formatTraitLabel(trait: Trait, value: number): string {
  // CANONICAL: budget positive = frugal/value-focused, negative = splurge/luxury
  const labels: Record<Trait, [string, string]> = {
    planning: ['spontaneous nature', 'love of planning'],
    social: ['solo preference', 'social energy'],
    comfort: ['budget-conscious mindset', 'comfort-seeking style'],  // FIXED: comfort polarity
    pace: ['relaxed pace', 'active pace'],
    authenticity: ['mainstream preferences', 'authenticity focus'],
    adventure: ['safe choices', 'adventurous spirit'],
    budget: ['luxury preference', 'value focus'],  // FIXED: positive = value/frugal, negative = luxury
    transformation: ['leisure focus', 'growth mindset'],
  };
  
  const [low, high] = labels[trait];
  return value >= 0 ? high : low;
}

function formatTraitExplanation(trait: Trait, value: number): string {
  const intensity = Math.abs(value) >= 7 ? 'strongly' : Math.abs(value) >= 4 ? 'moderately' : 'somewhat';
  const direction = value >= 0 ? 'high' : 'low';
  
  // CANONICAL: budget positive = frugal/value-focused, negative = splurge/luxury
  const explanations: Record<Trait, [string, string]> = {
    planning: ['You prefer to go with the flow', 'You like having things planned out'],
    social: ['You prefer solo or intimate travel', 'You thrive in social settings'],
    comfort: ['You prioritize experience over comfort', 'You appreciate comfort and quality'],
    pace: ['You prefer a relaxed, unhurried pace', 'You like to pack in activities'],
    authenticity: ['You enjoy popular attractions', 'You seek authentic, local experiences'],
    adventure: ['You prefer familiar experiences', 'You seek adventure and new challenges'],
    budget: ['You enjoy premium experiences', 'You prioritize value and smart spending'],  // FIXED: positive = value, negative = premium
    transformation: ['Travel is about relaxation', 'Travel is about personal growth'],
  };
  
  const [low, high] = explanations[trait];
  return `${intensity} ${direction === 'high' ? high : low}`;
}

function formatImpactSummary(deltas: Partial<TraitScores>): string {
  const parts: string[] = [];
  for (const [trait, value] of Object.entries(deltas)) {
    if (value && Math.abs(value) >= 2) {
      const direction = value > 0 ? '+' : '';
      parts.push(`${trait}: ${direction}${Math.round(value)}`);
    }
  }
  return parts.slice(0, 3).join(', ') || 'minor impact';
}

//

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
            content: `You are a poetic travel writer. Write ONE sentence (12-15 words max) capturing this traveler's ideal trip FEELING. Be evocative and abstract—describe the experience, NOT specific places, activities, or destinations. Use "you" voice. Example: "You linger in hidden corners until they feel like home."`,
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
    
    // Track cost for this AI call
    const costTracker = trackCost('travel_dna', 'google/gemini-3-flash-preview');
    costTracker.recordAiUsage(data);
    await costTracker.save();
    
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
  
  parts.push('\nDescribe the FEELING of their perfect trip in ONE short, evocative sentence. No specific places or activities.');
  
  return parts.join('\n');
}

function getFallbackPerfectTrip(archetypeId: string): string {
  const fallbacks: Record<string, string> = {
    cultural_anthropologist: 'You become part of the places you visit.',
    urban_nomad: 'You find home in the rhythm of new cities.',
    wilderness_pioneer: 'You earn your views and sleep under open skies.',
    zen_seeker: 'You find stillness wherever you wander.',
    culinary_cartographer: 'You taste your way to understanding.',
    luxury_luminary: 'Every detail is exactly as it should be.',
    adrenaline_architect: 'Your heart races in the most beautiful settings.',
    slow_traveler: 'You stay long enough to have a favorite café.',
    family_architect: 'You create stories everyone will retell.',
    story_seeker: 'You collect moments that change you.',
    escape_artist: 'You finally find the quiet you have been craving.',
    social_butterfly: 'You make friends everywhere you go.',
  };
  
  return fallbacks[archetypeId] || 'You travel exactly the way you were meant to.';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { answers, userId, existingOverrides, precomputedTraits, fineGrainedTraits } = await req.json();
    
    if (!answers) {
      return new Response(
        JSON.stringify({ error: 'Missing quiz answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[TravelDNA V2] Calculating for user:', userId);
    console.log('[TravelDNA V2] Quiz answers:', Object.keys(answers));
    if (precomputedTraits) {
      console.log('[TravelDNA V2] Received pre-computed V2 traits from frontend:', precomputedTraits);
    }
    if (fineGrainedTraits) {
      console.log('[TravelDNA V2] ✅ Received fine-grained V3 traits:', JSON.stringify(fineGrainedTraits));
    } else {
      console.warn('[TravelDNA V2] ⚠️ NO fine-grained V3 traits received — archetype matching will use V2-only (degraded accuracy for 23/27 archetypes)');
    }
    if (existingOverrides && Object.keys(existingOverrides).length > 0) {
      console.log('[TravelDNA V2] User has existing trait overrides:', existingOverrides);
    }
    
    // DEV ASSERTION: Generic polarity check to catch drift across BOTH mapping tables
    // CANONICAL: budget positive = frugal/value-focused, negative = splurge/luxury
    function getBudgetDelta(key: string): number | undefined {
      return (
        LEGACY_ANSWER_MAPPINGS[key]?.deltas?.budget ??
        ANSWER_DELTAS[key]?.deltas?.budget ??
        undefined
      );
    }
    
    function assertBudgetPolarity(key: string, expectedSign: 'positive' | 'negative') {
      const delta = getBudgetDelta(key);
      if (delta === undefined) return;
      if (expectedSign === 'positive' && delta < 0) {
        console.error(`[TravelDNA V2 POLARITY ERROR] ${key} budget delta ${delta} expected positive`);
      }
      if (expectedSign === 'negative' && delta > 0) {
        console.error(`[TravelDNA V2 POLARITY ERROR] ${key} budget delta ${delta} expected negative`);
      }
    }
    
    assertBudgetPolarity('budget', 'positive');
    assertBudgetPolarity('luxury', 'negative');
    assertBudgetPolarity('premium', 'negative');
    assertBudgetPolarity('curated_luxe', 'negative');
    assertBudgetPolarity('c1', 'positive');
    assertBudgetPolarity('c3', 'negative');
    assertBudgetPolarity('c4', 'negative');
    assertBudgetPolarity('b4', 'negative');
    
    // Step 1: Calculate trait scores
    // If frontend sent pre-computed V2 traits (from V3 quiz), use those as the base
    // Otherwise fall back to legacy answer parsing
    let rawScores: TraitScores;
    let finalScores: TraitScores;
    let signalStrength: Partial<Record<Trait, number>> = {};
    let fillRates: Record<Trait, number> = {} as Record<Trait, number>;
    let contributions: TraitContribution[] = [];
    
    // Only use precomputedTraits if they contain real signal (not all zeros from failed V3 parsing)
    const precomputedHasSignal = precomputedTraits && typeof precomputedTraits === 'object' &&
      ALL_TRAITS.some(t => Math.abs(precomputedTraits[t] ?? 0) >= 1.0);
    
    if (precomputedHasSignal) {
      // V3 quiz path: frontend already converted 25-trait scores to 8-trait system
      console.log('[TravelDNA V2] Using pre-computed traits (V3 quiz path)');
      rawScores = {
        planning: precomputedTraits.planning ?? 0,
        social: precomputedTraits.social ?? 0,
        comfort: precomputedTraits.comfort ?? 0,
        pace: precomputedTraits.pace ?? 0,
        authenticity: precomputedTraits.authenticity ?? 0,
        adventure: precomputedTraits.adventure ?? 0,
        budget: precomputedTraits.budget ?? 0,
        transformation: precomputedTraits.transformation ?? 0,
      };
      // Apply saturation to pre-computed values
      finalScores = {
        planning: applySaturation(rawScores.planning),
        social: applySaturation(rawScores.social),
        comfort: applySaturation(rawScores.comfort),
        pace: applySaturation(rawScores.pace),
        authenticity: applySaturation(rawScores.authenticity),
        adventure: applySaturation(rawScores.adventure),
        budget: applySaturation(rawScores.budget),
        transformation: applySaturation(rawScores.transformation),
      };
      // Set fill rates to 100% since we have complete data from V3 quiz
      for (const trait of ALL_TRAITS) {
        fillRates[trait] = 100;
        signalStrength[trait] = Math.abs(finalScores[trait]);
      }
    } else {
      // Legacy quiz path (or precomputedTraits were all zeros): parse answers using ANSWER_DELTAS
      if (precomputedTraits && !precomputedHasSignal) {
        console.log('[TravelDNA V2] ⚠️ precomputedTraits received but all near-zero — falling back to legacy answer parsing');
      }
      const result = calculateTraitScoresV2(answers);
      rawScores = result.rawScores;
      finalScores = result.finalScores;
      signalStrength = result.signalStrength;
      fillRates = result.fillRates;
      contributions = result.contributions;
      
      // ═══════════════════════════════════════
      // FALLBACK: If legacy parsing produced all-zero/near-zero traits,
      // compute traits directly from preference-format answer values.
      // This prevents every user from getting "Balanced Story Collector".
      // ═══════════════════════════════════════
      const allNearZero = ALL_TRAITS.every(t => Math.abs(finalScores[t]) < 1.5);
      if (allNearZero) {
        console.log('[TravelDNA V2] ⚠️ Legacy parser produced near-zero traits — using preference-based fallback');
        const prefTraits = computeV2TraitsFromPreferences(answers);
        if (Object.values(prefTraits).some(v => Math.abs(v) >= 2)) {
          rawScores = { ...prefTraits } as TraitScores;
          finalScores = {
            planning: applySaturation(prefTraits.planning ?? 0),
            social: applySaturation(prefTraits.social ?? 0),
            comfort: applySaturation(prefTraits.comfort ?? 0),
            pace: applySaturation(prefTraits.pace ?? 0),
            authenticity: applySaturation(prefTraits.authenticity ?? 0),
            adventure: applySaturation(prefTraits.adventure ?? 0),
            budget: applySaturation(prefTraits.budget ?? 0),
            transformation: applySaturation(prefTraits.transformation ?? 0),
          };
          for (const trait of ALL_TRAITS) {
            fillRates[trait] = Math.abs(finalScores[trait]) > 0 ? 75 : 0;
            signalStrength[trait] = Math.abs(finalScores[trait]);
          }
          console.log('[TravelDNA V2] ✅ Preference-based traits:', finalScores);
        }
      }
    }
    
    console.log('[TravelDNA V2] Raw scores:', rawScores);
    console.log('[TravelDNA V2] Final scores (saturated):', finalScores);
    console.log('[TravelDNA V2] Fill rates:', fillRates);
    
    // Step 1b: Apply existing overrides as a "bias" to final scores
    // This ensures user's manual adjustments influence archetype matching
    // but the computed base still comes from quiz answers
    const effectiveScores: TraitScores = { ...finalScores };
    if (existingOverrides && typeof existingOverrides === 'object') {
      for (const trait of ALL_TRAITS) {
        if (existingOverrides[trait] !== undefined) {
          // Blend override with computed score (70% computed, 30% override influence)
          const override = existingOverrides[trait] as number;
          const computed = finalScores[trait];
          // Use weighted average to respect both quiz and manual adjustments
          effectiveScores[trait] = Math.round((computed * 0.7 + override * 0.3) * 10) / 10;
        }
      }
      console.log('[TravelDNA V2] Effective scores after override blend:', effectiveScores);
    }
    
    // Step 2: Match archetypes with blends (use effectiveScores to incorporate user overrides)
    const { matches, confidence } = matchArchetypesV2(effectiveScores, contributions, fineGrainedTraits || null);
    console.log('[TravelDNA V2] Top matches:', matches.slice(0, 3).map(m => `${m.name} (${m.pct}%)`));
    console.log('[TravelDNA V2] Confidence:', confidence);
    
    // Step 3: Get primary and secondary archetypes (ensure they are different)
    const primaryMatch = matches[0];
    // Find the first match that is different from the primary
    const secondaryMatch = matches.slice(1).find(m => m.archetype_id !== primaryMatch.archetype_id) || null;
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
    
    // Step 6b: Generate top trait badges (users trust these even if archetype seems "off")
    const topTraitBadges: TopTraitBadge[] = [];
    const traitLabels: Record<Trait, [string, string]> = {
      planning: ['Spontaneous', 'Planner'],
      social: ['Solo-Oriented', 'Social'],
      comfort: ['Experience-First', 'Comfort-Seeking'],
      pace: ['Slow & Steady', 'Active'],
      authenticity: ['Mainstream', 'Authentic'],
      adventure: ['Familiar', 'Adventurous'],
      budget: ['Premium', 'Value-Focused'],  // CANONICAL: positive = frugal/value
      transformation: ['Relaxation', 'Growth-Seeking'],
    };
    
    for (const trait of ALL_TRAITS) {
      const value = finalScores[trait];
      const absValue = Math.abs(value);
      
      if (absValue >= 3) {  // Only show badges for significant traits
        const [lowLabel, highLabel] = traitLabels[trait];
        const label = value >= 0 ? highLabel : lowLabel;
        const intensity: 'moderate' | 'strong' | 'extreme' = 
          absValue >= 7 ? 'extreme' : absValue >= 5 ? 'strong' : 'moderate';
        
        topTraitBadges.push({ trait, value, label, intensity });
      }
    }
    
    // Sort badges by absolute value (strongest first), take top 4
    topTraitBadges.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const finalBadges = topTraitBadges.slice(0, 4);
    console.log('[TravelDNA V2] Top trait badges:', finalBadges.map(b => b.label));
    
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
    
    // Step 9: Build "Why This Result" explainability
    const whyThisResult = buildWhyThisResult(
      primaryArchetype,
      secondaryArchetype || null,
      primaryMatch,
      finalScores,
      topContributors,
      confidence
    );
    
    // Step 10: Determine if disambiguation is needed + pick next questions
    // IMPROVED: Use probability-based closeness instead of raw percentage gap
    // Secondary is "real" if: secondaryPct >= 25% OR secondaryPct >= 90% of primaryPct
    const primaryPct = primaryMatch.pct;
    const secondaryPct = secondaryMatch?.pct || 0;
    const secondaryIsClose = secondaryPct >= 25 || (secondaryPct >= primaryPct * 0.9);
    const top2Gap = primaryPct - secondaryPct;
    
    // Disambiguation needed if: low confidence OR secondary is very close to primary
    const needsDisambiguation = confidence < 60 || (secondaryIsClose && top2Gap <= 15);
    let disambiguationReason: string | undefined;
    let disambiguationTraits: Trait[] | undefined;
    let nextQuestionIds: string[] | undefined;
    
    if (needsDisambiguation) {
      if (confidence < 60) {
        disambiguationReason = 'Low confidence - mixed signals in profile';
      } else if (secondaryIsClose) {
        disambiguationReason = `Close match between ${primaryArchetype.name} (${primaryPct}%) and ${secondaryArchetype?.name || 'secondary'} (${secondaryPct}%)`;
      }
      
      // Find traits that differentiate top 2 archetypes
      if (primaryArchetype && secondaryArchetype) {
        const primaryTraitSet = new Set(primaryArchetype.primaryTraits.map(t => t.trait));
        const secondaryTraitSet = new Set(secondaryArchetype.primaryTraits.map(t => t.trait));
        
        // Traits that differ between archetypes
        disambiguationTraits = ALL_TRAITS.filter(t => 
          (primaryTraitSet.has(t) && !secondaryTraitSet.has(t)) ||
          (!primaryTraitSet.has(t) && secondaryTraitSet.has(t))
        );
        
        // If no differentiating traits, use primary traits of both
        if (disambiguationTraits.length === 0) {
          disambiguationTraits = [...primaryTraitSet, ...secondaryTraitSet].slice(0, 3) as Trait[];
        }
      }
      
      // Step 10b: Pick disambiguation questions based on traits with low fill rates
      // Rank by: (1) low fill rate (unknown trait) and (2) importance to top 2 archetypes
      // IMPORTANT: Filter out already-answered questions + validate IDs exist
      
      // Build set of already-answered question IDs
      const answeredQuestionIds = new Set(Object.keys(answers).filter(k => {
        const val = answers[k as keyof QuizAnswers];
        return val !== undefined && val !== null && 
               (Array.isArray(val) ? val.length > 0 : true);
      }));
      
      if (disambiguationTraits && disambiguationTraits.length > 0) {
        // Sort disambiguation traits by fill rate (ascending - lowest first)
        const sortedTraits = [...disambiguationTraits].sort((a, b) => 
          (fillRates[a] || 0) - (fillRates[b] || 0)
        );
        
        // Pick questions for the top trait(s)
        const questionsToAsk: string[] = [];
        for (const trait of sortedTraits.slice(0, 3)) {
          const possibleQuestions = DISAMBIGUATION_QUESTIONS_BY_TRAIT[trait] || [];
          for (const q of possibleQuestions) {
            // Only add if: (1) valid quiz ID, (2) not already answered, (3) not already selected
            if (VALID_QUIZ_QUESTION_IDS.has(q) && 
                !answeredQuestionIds.has(q) && 
                !questionsToAsk.includes(q)) {
              questionsToAsk.push(q);
              break;  // Take first valid unanswered question per trait
            }
          }
        }
        
        // If no valid questions found, use safe fallbacks
        if (questionsToAsk.length === 0) {
          for (const q of SAFE_FALLBACK_QUESTIONS) {
            if (!answeredQuestionIds.has(q)) {
              questionsToAsk.push(q);
            }
          }
        }
        
        if (questionsToAsk.length > 0) {
          nextQuestionIds = questionsToAsk.slice(0, 3);
          console.log(`[TravelDNA V2] Disambiguation questions selected:`, nextQuestionIds);
          console.log(`[TravelDNA V2] Already answered:`, Array.from(answeredQuestionIds));
        } else {
          console.log(`[TravelDNA V2] No unanswered disambiguation questions available`);
        }
      }
    }
    
    console.log('[TravelDNA V2] Needs disambiguation:', needsDisambiguation, disambiguationReason);
    
    // Step 11: Detect and resolve tension patterns
    let tensionLabel: string | undefined;
    let tensionExplanation: string | undefined;
    
    for (const pattern of TENSION_PATTERNS) {
      if (pattern.condition(finalScores)) {
        tensionLabel = pattern.label;
        tensionExplanation = pattern.explanation;
        console.log(`[TravelDNA V2] Tension detected: ${tensionLabel}`);
        break;  // Use first matching pattern
      }
    }
    
    // Build V2 result
    const result: TravelDNAv2Result = {
      version: 2,
      budget_polarity_version: 2,  // v2 = fixed polarity (positive=frugal)
      raw_trait_scores: rawScores,
      trait_scores: finalScores,
      trait_signal_strength: signalStrength,
      trait_fill_rates: fillRates,
      trait_contributions: contributions,
      archetype_matches: matches,
      confidence,
      primary_archetype_name: primaryMatch.archetype_id,
      primary_archetype_display: primaryArchetype.name,
      primary_archetype_category: primaryArchetype.category,
      primary_archetype_tagline: primaryArchetype.tagline,
      secondary_archetype_name: secondaryMatch?.archetype_id || null,
      secondary_archetype_display: secondaryArchetype?.name || null,
      secondary_probability: secondaryMatch ? secondaryMatch.pct / 100 : undefined,
      dna_rarity: rarity,
      emotional_drivers: emotionalDrivers,
      tone_tags: toneTags,
      top_contributors: topContributors,
      top_trait_badges: finalBadges,
      perfect_trip_preview: perfectTrip,
      summary,
      calculated_at: new Date().toISOString(),
      why_this_result: whyThisResult,
      needs_disambiguation: needsDisambiguation,
      disambiguation_reason: disambiguationReason,
      disambiguation_traits: disambiguationTraits,
      next_question_ids: nextQuestionIds,
      tension_label: tensionLabel,
      tension_explanation: tensionExplanation,
    };
    
    console.log('[TravelDNA V2] Calculation complete');
    
    // ═══════════════════════════════════════
    // SERVER-SIDE PERSIST: Save archetype + traits to DB (bypasses RLS via service role)
    // This ensures the archetype is always saved even if client-side save fails
    // ═══════════════════════════════════════
    if (userId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );
        const { error: persistError } = await supabaseAdmin
          .from('travel_dna_profiles')
          .update({
            primary_archetype_name: result.primary_archetype_name,
            secondary_archetype_name: result.secondary_archetype_name || null,
            trait_scores: result.trait_scores,
            dna_confidence_score: result.confidence,
            dna_rarity: result.dna_rarity,
            archetype_matches: result.archetype_matches,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        
        if (persistError) {
          console.error('[TravelDNA V2] ❌ Server-side persist failed:', persistError.message);
        } else {
          console.log('[TravelDNA V2] ✅ Archetype + traits persisted to DB for user:', userId);
        }
      } catch (e) {
        console.error('[TravelDNA V2] Server-side persist exception:', e);
      }
    }
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[TravelDNA V2] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: "Travel DNA calculation failed", code: "DNA_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
