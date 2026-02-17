/**
 * Hotel Metadata Mapper
 * 
 * Maps hotel properties to 8-dimension Travel DNA scoring system.
 * Implements corrected signal mapping:
 * - socialScore: Hotel type + amenities (not review ratings)
 * - priceScore: Normalized against user budget target (not result set)
 * - Amenity stacking: Tiered bucketing with diminishing returns
 */

import type { HotelOption } from '@/services/hotelAPI';

// ============================================================================
// Types
// ============================================================================

export interface MappingContext {
  userBudgetTarget: number;
  userBudgetTier: 'budget' | 'moderate' | 'premium' | 'luxury';
  destinationPOIs?: {
    unesco?: string[];
    museums?: string[];
  };
}

export interface HotelMetadata {
  // 8 DNA dimensions (0-1 scale)
  comfortScore: number;
  adventureScore: number;
  cultureScore: number;
  socialScore: number;
  priceScore: number;
  paceScore: number;
  authenticityScore: number;
  simplicityScore: number;
  
  // Quality filter (not a personality dimension)
  qualityScore: number;
  
  // Contextual tags for rationale generation
  tags: string[];
}

export type HotelType = 'hostel' | 'boutique' | 'chain' | 'resort' | 'villa' | 'apartment' | 'ryokan' | 'riad' | 'treehouse' | 'unknown';

// ============================================================================
// Budget Target Mapping
// ============================================================================

export const BUDGET_TARGETS: Record<string, number> = {
  budget: 80,
  moderate: 180,
  premium: 350,
  luxury: 600,
};

export function getBudgetTarget(budgetTier?: string): number {
  return BUDGET_TARGETS[budgetTier || 'moderate'] || BUDGET_TARGETS.moderate;
}

// ============================================================================
// Hotel Type Inference
// ============================================================================

const HOSTEL_KEYWORDS = ['hostel', 'backpacker', 'dorm', 'pod'];
const BOUTIQUE_KEYWORDS = ['boutique', 'design hotel', 'charming', 'intimate'];
const RESORT_KEYWORDS = ['resort', 'all-inclusive', 'beach resort', 'spa resort'];
const VILLA_KEYWORDS = ['villa', 'apartment', 'private residence', 'cottage', 'house'];
const CHAIN_BRANDS = [
  'marriott', 'hilton', 'hyatt', 'ihg', 'accor', 'wyndham', 'radisson',
  'sheraton', 'westin', 'holiday inn', 'crowne plaza', 'intercontinental',
  'doubletree', 'hampton', 'courtyard', 'fairfield', 'residence inn',
  'comfort inn', 'best western', 'la quinta', 'ramada', 'days inn'
];
const UNIQUE_TYPES: Array<{ keywords: string[]; type: HotelType }> = [
  { keywords: ['ryokan', 'traditional japanese'], type: 'ryokan' },
  { keywords: ['riad', 'moroccan'], type: 'riad' },
  { keywords: ['treehouse', 'tree house', 'glamping'], type: 'treehouse' },
];

export function inferHotelType(
  name: string,
  amenities: string[],
  stars?: number
): HotelType {
  const lowerName = name.toLowerCase();
  const lowerAmenities = amenities.map(a => a.toLowerCase()).join(' ');
  const combined = `${lowerName} ${lowerAmenities}`;
  
  // Check unique property types first (high adventure)
  for (const { keywords, type } of UNIQUE_TYPES) {
    if (keywords.some(kw => combined.includes(kw))) {
      return type;
    }
  }
  
  // Hostels
  if (HOSTEL_KEYWORDS.some(kw => combined.includes(kw))) {
    return 'hostel';
  }
  
  // Villas and apartments
  if (VILLA_KEYWORDS.some(kw => combined.includes(kw))) {
    return 'villa';
  }
  
  // Resorts (usually 4-5 star with specific amenities)
  if (RESORT_KEYWORDS.some(kw => combined.includes(kw))) {
    return 'resort';
  }
  
  // Chain hotels
  if (CHAIN_BRANDS.some(brand => lowerName.includes(brand))) {
    return 'chain';
  }
  
  // Boutique (often 3-4 star, smaller properties)
  if (BOUTIQUE_KEYWORDS.some(kw => combined.includes(kw))) {
    return 'boutique';
  }
  
  // Infer from star rating if no other signals
  if (stars) {
    if (stars <= 2) return 'hostel';
    if (stars === 3) return 'chain';
    if (stars >= 4) return 'chain';
  }
  
  return 'unknown';
}

// ============================================================================
// Dimension Scoring Functions
// ============================================================================

// Luxury amenities for comfort scoring (tiered bucketing)
const LUXURY_AMENITIES = [
  'spa', 'pool', 'sauna', 'hot tub', 'jacuzzi', 'private terrace',
  'butler service', 'michelin', 'concierge', 'rooftop pool', 'infinity pool',
  'private beach', 'helipad', 'private chef'
];

// Social space amenities
const SOCIAL_AMENITIES = ['rooftop bar', 'bar', 'lounge', 'communal kitchen', 'shared lounge', 'co-working'];
const ANTISOCIAL_AMENITIES = ['private pool', 'private terrace', 'private beach', 'butler service'];

// Adventure amenities
const ADVENTURE_AMENITIES = ['diving', 'surfing', 'kayak', 'hiking', 'adventure', 'excursion', 'trekking'];

// Simplicity amenities
const SIMPLICITY_AMENITIES = ['airport transfer', 'shuttle', 'multilingual', '24-hour front desk', 'express check'];

/**
 * Score comfort based on stars and luxury amenity tier (capped)
 */
export function scoreComfort(stars?: number, amenities: string[] = []): number {
  // Base score from stars
  let score = 0.5; // Default
  if (stars) {
    if (stars === 3) score = 0.5;
    else if (stars === 4) score = 0.75;
    else if (stars >= 5) score = 1.0;
    else if (stars <= 2) score = 0.3;
  }
  
  // Tiered luxury amenity boost (diminishing returns)
  const luxuryCount = countMatchingAmenities(amenities, LUXURY_AMENITIES);
  let amenityBoost = 0;
  if (luxuryCount >= 5) amenityBoost = 0.2;
  else if (luxuryCount >= 3) amenityBoost = 0.15;
  else if (luxuryCount >= 1) amenityBoost = 0.08;
  
  return Math.min(1.0, score * 0.7 + amenityBoost + 0.1); // Weighted blend
}

/**
 * Score adventure based on hotel type and unique features
 */
export function scoreAdventure(
  hotelType: HotelType,
  amenities: string[] = [],
  distance?: number
): number {
  let score = 0.5;
  
  // Unique property types score high
  if (['ryokan', 'riad', 'treehouse'].includes(hotelType)) {
    score = 0.9;
  } else if (hotelType === 'boutique') {
    score = 0.65;
  } else if (hotelType === 'chain') {
    score = 0.3;
  } else if (hotelType === 'resort') {
    score = 0.4;
  } else if (hotelType === 'hostel') {
    score = 0.7; // Hostels often attract adventurers
  }
  
  // Adventure amenities boost
  const adventureCount = countMatchingAmenities(amenities, ADVENTURE_AMENITIES);
  if (adventureCount > 0) {
    score = Math.min(1.0, score + adventureCount * 0.1);
  }
  
  // Distance from center boost (>5km = more adventurous)
  if (distance && distance > 5) {
    score = Math.min(1.0, score + 0.1);
  }
  
  return score;
}

/**
 * Score culture based on neighborhood and local ownership signals
 */
export function scoreCulture(
  hotelType: HotelType,
  neighborhood?: string,
  amenities: string[] = []
): number {
  let score = 0.5;
  
  // Locally-owned / unique types score higher
  if (['ryokan', 'riad', 'boutique'].includes(hotelType)) {
    score = 0.8;
  } else if (hotelType === 'chain') {
    score = 0.3;
  }
  
  // Neighborhood signals (basic heuristics)
  if (neighborhood) {
    const lowerNeighborhood = neighborhood.toLowerCase();
    const culturalKeywords = ['old town', 'historic', 'cultural', 'museum', 'arts', 'heritage', 'traditional'];
    const touristKeywords = ['tourist', 'shopping', 'mall', 'commercial'];
    
    if (culturalKeywords.some(kw => lowerNeighborhood.includes(kw))) {
      score = Math.min(1.0, score + 0.2);
    }
    if (touristKeywords.some(kw => lowerNeighborhood.includes(kw))) {
      score = Math.max(0.2, score - 0.15);
    }
  }
  
  // Cultural amenities
  const culturalAmenities = ['traditional', 'local cuisine', 'cultural', 'art gallery'];
  if (culturalAmenities.some(ca => amenities.some(a => a.toLowerCase().includes(ca)))) {
    score = Math.min(1.0, score + 0.1);
  }
  
  return score;
}

/**
 * Score social environment based on hotel type and amenities
 * NOT based on review ratings!
 */
export function scoreSocial(
  hotelType: HotelType,
  amenities: string[] = [],
  stars?: number
): number {
  let score = 0.5;
  
  // Hotel type is primary signal
  switch (hotelType) {
    case 'hostel':
      score = 0.85;
      break;
    case 'boutique':
      score = 0.65; // Intimate, conversational
      break;
    case 'resort':
      score = 0.35; // Large, anonymous
      break;
    case 'villa':
    case 'apartment':
      score = 0.15; // Private, antisocial
      break;
    case 'chain':
      score = 0.45;
      break;
    default:
      score = 0.5;
  }
  
  // Social space amenities boost
  const socialCount = countMatchingAmenities(amenities, SOCIAL_AMENITIES);
  score = Math.min(1.0, score + socialCount * 0.1);
  
  // Private amenities penalty
  const antisocialCount = countMatchingAmenities(amenities, ANTISOCIAL_AMENITIES);
  score = Math.max(0.1, score - antisocialCount * 0.1);
  
  // Star rating adjustment (2-3 star = social crowd, 5 star = privacy-oriented)
  if (stars) {
    if (stars <= 3) score = Math.min(1.0, score + 0.08);
    if (stars >= 5) score = Math.max(0.1, score - 0.08);
  }
  
  return score;
}

/**
 * Score price alignment against USER'S budget target
 * NOT normalized against result set!
 */
export function scorePriceAlignment(
  pricePerNight: number,
  userBudgetTarget: number,
  budgetTier: string
): number {
  const ratio = pricePerNight / userBudgetTarget;
  
  // Luxury travelers have inverted sensitivity
  if (budgetTier === 'luxury') {
    // They want premium, price below target is slightly less aligned
    if (ratio < 0.7) return 0.6; // Too cheap for their taste
    if (ratio <= 1.0) return 0.85; // Good
    if (ratio <= 1.3) return 1.0; // Perfect (willing to pay for quality)
    if (ratio <= 1.6) return 0.7;
    return 0.4;
  }
  
  // Standard scoring for other tiers — smoother curve
  if (ratio <= 1.0) return 1.0;   // At or below target = perfect
  if (ratio <= 1.2) return 0.85;  // 20% over = good
  if (ratio <= 1.5) return 0.65;  // 50% over = acceptable
  if (ratio <= 2.0) return 0.4;   // 2x over = stretch
  return 0.2;                      // Way over but not zero
}

/**
 * Score pace/energy management based on transit accessibility
 */
export function scorePace(
  neighborhood?: string,
  amenities: string[] = [],
  distance?: number
): number {
  let score = 0.5;
  
  // Transit accessibility signals
  if (neighborhood) {
    const lowerNeighborhood = neighborhood.toLowerCase();
    const transitKeywords = ['central', 'downtown', 'station', 'metro', 'subway', 'transit'];
    const remoteKeywords = ['secluded', 'remote', 'countryside', 'rural', 'mountain'];
    
    if (transitKeywords.some(kw => lowerNeighborhood.includes(kw))) {
      score = 0.8; // Fast-paced easy
    }
    if (remoteKeywords.some(kw => lowerNeighborhood.includes(kw))) {
      score = 0.3; // Slow-paced
    }
  }
  
  // Close to center = easier fast pace
  if (distance !== undefined) {
    if (distance <= 1) score = Math.min(1.0, score + 0.15);
    else if (distance <= 3) score = Math.min(1.0, score + 0.05);
    else if (distance > 5) score = Math.max(0.2, score - 0.1);
  }
  
  return score;
}

/**
 * Score authenticity based on local ownership and character
 */
export function scoreAuthenticity(
  hotelType: HotelType,
  neighborhood?: string,
  amenities: string[] = []
): number {
  let score = 0.5;
  
  // Locally-owned types score high
  if (['ryokan', 'riad', 'boutique', 'treehouse'].includes(hotelType)) {
    score = 0.85;
  } else if (hotelType === 'chain') {
    score = 0.25;
  } else if (hotelType === 'resort') {
    score = 0.35;
  }
  
  // Neighborhood character
  if (neighborhood) {
    const lowerNeighborhood = neighborhood.toLowerCase();
    const residentialKeywords = ['residential', 'local', 'neighborhood', 'authentic'];
    const touristKeywords = ['tourist', 'strip', 'commercial'];
    
    if (residentialKeywords.some(kw => lowerNeighborhood.includes(kw))) {
      score = Math.min(1.0, score + 0.15);
    }
    if (touristKeywords.some(kw => lowerNeighborhood.includes(kw))) {
      score = Math.max(0.2, score - 0.1);
    }
  }
  
  return score;
}

/**
 * Score simplicity/planning friction tolerance
 */
export function scoreSimplicity(
  cancellationPolicy?: string,
  amenities: string[] = [],
  neighborhood?: string
): number {
  let score = 0.5;
  
  // Free cancellation is a big simplicity boost
  if (cancellationPolicy === 'free') {
    score += 0.25;
  } else if (cancellationPolicy === 'nonRefundable') {
    score -= 0.15;
  }
  
  // Simplicity amenities
  const simplicityCount = countMatchingAmenities(amenities, SIMPLICITY_AMENITIES);
  score += Math.min(0.2, simplicityCount * 0.08);
  
  // Transit proximity helps
  if (neighborhood) {
    const lowerNeighborhood = neighborhood.toLowerCase();
    if (['central', 'station', 'airport'].some(kw => lowerNeighborhood.includes(kw))) {
      score += 0.1;
    }
  }
  
  return Math.min(1.0, Math.max(0.1, score));
}

/**
 * Quality score from review rating (for filtering, not personality matching)
 */
export function scoreQuality(rating?: number): number {
  if (!rating) return 0.5;
  // Normalize 0-10 rating to 0-1
  if (rating <= 10) return rating / 10;
  // If rating is 0-5 scale
  return rating / 5;
}

// ============================================================================
// Helper Functions
// ============================================================================

function countMatchingAmenities(amenities: string[], targetList: string[]): number {
  const lowerAmenities = amenities.map(a => a.toLowerCase());
  return targetList.filter(target => 
    lowerAmenities.some(a => a.includes(target.toLowerCase()))
  ).length;
}

// ============================================================================
// Main Mapper Function
// ============================================================================

export function mapHotelToMetadata(
  hotel: HotelOption,
  context: MappingContext
): HotelMetadata {
  const hotelType = inferHotelType(hotel.name, hotel.amenities, hotel.stars);
  const tags: string[] = [];
  
  // Add type tag
  if (hotelType !== 'unknown') {
    tags.push(hotelType);
  }
  
  // Calculate all 8 dimensions
  const comfortScore = scoreComfort(hotel.stars, hotel.amenities);
  const adventureScore = scoreAdventure(hotelType, hotel.amenities, hotel.distance);
  const cultureScore = scoreCulture(hotelType, hotel.neighborhood, hotel.amenities);
  const socialScore = scoreSocial(hotelType, hotel.amenities, hotel.stars);
  const priceScore = scorePriceAlignment(
    hotel.pricePerNight,
    context.userBudgetTarget,
    context.userBudgetTier
  );
  const paceScore = scorePace(hotel.neighborhood, hotel.amenities, hotel.distance);
  const authenticityScore = scoreAuthenticity(hotelType, hotel.neighborhood, hotel.amenities);
  const simplicityScore = scoreSimplicity(hotel.cancellationPolicy, hotel.amenities, hotel.neighborhood);
  const qualityScore = scoreQuality(hotel.rating);
  
  // Generate contextual tags
  if (comfortScore >= 0.8) tags.push('luxury');
  if (adventureScore >= 0.8) tags.push('unique');
  if (socialScore >= 0.7) tags.push('social');
  if (socialScore <= 0.3) tags.push('private');
  if (priceScore >= 0.9) tags.push('great-value');
  if (authenticityScore >= 0.8) tags.push('authentic');
  if (simplicityScore >= 0.8) tags.push('hassle-free');
  
  return {
    comfortScore,
    adventureScore,
    cultureScore,
    socialScore,
    priceScore,
    paceScore,
    authenticityScore,
    simplicityScore,
    qualityScore,
    tags,
  };
}

// ============================================================================
// Batch Mapping
// ============================================================================

export function mapHotelsToMetadata(
  hotels: HotelOption[],
  context: MappingContext
): Map<string, HotelMetadata> {
  const metadataMap = new Map<string, HotelMetadata>();
  
  for (const hotel of hotels) {
    metadataMap.set(hotel.id, mapHotelToMetadata(hotel, context));
  }
  
  return metadataMap;
}
