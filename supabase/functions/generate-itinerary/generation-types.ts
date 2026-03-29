/**
 * Shared types for the generate-itinerary pipeline.
 *
 * Both index.ts (generate-full) and action-generate-day.ts import from here,
 * eliminating the need for inline type definitions.
 */

import type { PreBookedCommitment } from './pre-booked-commitments.ts';
import type { TravelerDNA } from './prompt-library.ts';
import type { FlightData as PromptFlightData, HotelData as PromptHotelData } from './prompt-library.ts';
import type { TravelerArchetype } from './group-archetype-blending.ts';

// =============================================================================
// MULTI-CITY DAY INFO
// =============================================================================

export interface MultiCityDayInfo {
  cityName: string;
  country?: string;
  isTransitionDay: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  transportType?: string;
  // Per-city hotel info for prompt injection
  hotelName?: string;
  hotelAddress?: string;
  hotelNeighborhood?: string;
  hotelCheckIn?: string;
  hotelCheckOut?: string;
  isFirstDayInCity?: boolean;
  isLastDayInCity?: boolean;
  // Split-stay: hotel changed from previous day within same city
  isHotelChange?: boolean;
  previousHotelName?: string;
  // Next-leg transport details for departure day (populated on last day in city)
  nextLegTransport?: string;
  nextLegCity?: string;
  nextLegTransportDetails?: Record<string, any>;
}

// =============================================================================
// GENERATION CONTEXT
// =============================================================================

export interface GenerationContext {
  tripId: string;
  userId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  travelers: number;
  childrenCount?: number;
  childrenAges?: number[];
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
  dailyBudget?: number;
  /** Actual user-set total budget in cents (from trip settings), null if not set */
  budgetTotalCents?: number | null;
  /** Computed actual daily budget per person from user-set budget */
  actualDailyBudgetPerPerson?: number | null;
  currency?: string;
  // Phase 9: Full DNA injection for prompt library
  travelerDNA?: TravelerDNA;
  flightData?: PromptFlightData;
  hotelData?: PromptHotelData;
  // Phase 12: First-time visitor detection
  isFirstTimeVisitor?: boolean;
  firstTimePerCity?: Record<string, boolean>;
  // Phase 2: Advanced temporal intelligence
  originCity?: string;
  destinationTimezone?: string;
  jetLagSensitivity?: 'low' | 'moderate' | 'high';
  // Phase 3: Premium features
  preBookedCommitments?: PreBookedCommitment[];
  mustDoActivities?: string;
  additionalNotes?: string;
  interestCategories?: string[];
  mustHaves?: Array<{ label: string; notes?: string }>;
  generationRules?: Array<{
    type: string;
    days?: string[];
    from?: string;
    to?: string;
    reason?: string;
    date?: string;
    description?: string;
    hotelName?: string;
    additionalGuests?: number;
    note?: string;
    text?: string;
  }>;
  /** Whether this generation is triggered by Smart Finish enrichment mode */
  isSmartFinish?: boolean;
  /** Smart Finish was requested for this trip (anchors must still be preserved) */
  smartFinishRequested?: boolean;
  /** Trip vibe/intent extracted from pasted text (e.g. "foodie adventure") */
  tripVibe?: string;
  /** Specific trip priorities extracted from pasted text */
  tripPriorities?: string[];
  /** User constraints from chat planner (full-day events, time blocks, preferences) */
  userConstraints?: Array<{
    type: string;
    description: string;
    day?: number;
    time?: string;
    allDay?: boolean;
  }>;
  /** Flight details from chat planner */
  flightDetails?: string;
  groupArchetypes?: TravelerArchetype[];
  // Collaborator user IDs and names for suggestedFor attribution
  collaboratorTravelers?: Array<{ userId: string; name: string }>;
  // Blended DNA snapshot for saving to trip record
  blendedDnaSnapshot?: Record<string, unknown> | null;
  // Celebration day: User-specified day for birthday/anniversary celebration (1-indexed)
  celebrationDay?: number;
  // Multi-city support
  isMultiCity?: boolean;
  multiCityDayMap?: MultiCityDayInfo[];
  // Pre-fetched venue operating hours from verified_venues cache
  venueHoursCache?: Array<{ name: string; opening_hours: string[] }>;
  // Per-city daily budget override
  perCityDailyBudget?: Record<string, number>;
  // Is first day in city (for multi-city)
  isFirstDayInCity?: boolean;
}

// =============================================================================
// STRICT ACTIVITY
// =============================================================================

export interface StrictActivity {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  location: {
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
  };
  cost: {
    amount: number;
    currency: string;
    formatted?: string;
    source?: 'viator' | 'database' | 'estimated' | 'google';
  };
  description: string;
  tags: string[];
  bookingRequired: boolean;
  transportation: {
    method: string;
    duration: string;
    estimatedCost: { amount: number; currency: string };
    instructions: string;
    distanceKm?: number;
  };
  tips?: string;
  photos?: Array<{ url: string; photographer?: string; alt?: string }>;
  rating?: { value: number; totalReviews: number };
  verified?: { isValid: boolean; confidence: number; placeId?: string };
  durationMinutes?: number;
  categoryIcon?: string;
  // Venue details
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  priceLevel?: number;
  googleMapsUrl?: string;
  reviewHighlights?: string[];
  /** Traveler ID whose preferences most influenced this activity (group trips) */
  suggestedFor?: string;
  // Personalization guarantee fields
  personalization?: {
    tags: string[];
    whyThisFits: string;
    confidence: number;
    matchedInputs: string[];
  };
  /** Source provider for venue verification */
  sourceProvider?:
    | 'google_places'
    | 'foursquare'
    | 'viator'
    | 'internal_db'
    | 'ai_generated';
  /** External provider ID for deduplication and verification */
  providerId?: string;
  /** Hidden gem discovered through deep research */
  isHiddenGem?: boolean;
  /** Timing hack */
  hasTimingHack?: boolean;
  bestTime?: string;
  crowdLevel?: 'low' | 'moderate' | 'high';
  voyanceInsight?: string;
  // Allow extra fields for enrichment / AI output
  [key: string]: unknown;
}

// =============================================================================
// STRICT DAY
// =============================================================================

export interface StrictDay {
  dayNumber: number;
  date: string;
  title: string;
  theme?: string;
  activities: StrictActivity[];
  metadata?: {
    theme?: string;
    totalEstimatedCost?: number;
    mealsIncluded?: number;
    pacingLevel?: 'relaxed' | 'moderate' | 'packed';
  };
  accommodationNotes?: string[];
  practicalTips?: string[];
  // Multi-city tags
  city?: string;
  country?: string;
  isTransitionDay?: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  // Transport comparison (transition days)
  transportComparison?: unknown;
  // Allow extra fields
  [key: string]: unknown;
}

// =============================================================================
// TRAVEL ADVISORY & LOCAL EVENTS
// =============================================================================

export interface TravelAdvisory {
  visaRequired?: boolean;
  visaType?: string;
  visaDetails?: string;
  passportValidity?: string;
  entryRequirements?: string[];
  safetyLevel?: 'low-risk' | 'moderate' | 'elevated' | 'high-risk';
  safetyAdvisory?: string;
  healthRequirements?: string[];
  currencyTips?: string;
  importantNotes?: string[];
  lastUpdated?: string;
}

export interface LocalEventInfo {
  name: string;
  type: string;
  dates: string;
  location: string;
  description: string;
  isFree: boolean;
}

// =============================================================================
// TRIP OVERVIEW
// =============================================================================

export interface TripOverview {
  bestTimeToVisit?: string;
  currency?: string;
  language?: string;
  transportationTips?: string;
  culturalTips?: string;
  budgetBreakdown?: {
    accommodations: number;
    activities: number;
    food: number;
    transportation: number;
    total: number;
  };
  highlights?: string[];
  localTips?: string[];
  travelAdvisory?: TravelAdvisory;
  localEvents?: LocalEventInfo[];
}

// =============================================================================
// ENRICHED ITINERARY
// =============================================================================

export interface EnrichedItinerary {
  days: StrictDay[];
  overview?: TripOverview;
  enrichmentMetadata: {
    enrichedAt: string;
    geocodedActivities: number;
    verifiedActivities: number;
    photosAdded: number;
    totalActivities: number;
    failures?: number;
    retriedSuccessfully?: number;
  };
}

// =============================================================================
// ENRICHMENT STATS
// =============================================================================

export interface EnrichmentStats {
  totalActivities: number;
  photosAdded: number;
  venuesVerified: number;
  enrichmentFailures: number;
  retriedSuccessfully: number;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationViolation {
  type: string;
  activityId: string;
  activityTitle: string;
  dayNumber: number;
  details: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ValidationWarning {
  type: string;
  message: string;
  activityId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
  personalizationScore: number;
  stats: {
    activitiesChecked: number;
    personalizationFieldsPresent: number;
    personalizationFieldsMissing: number;
    matchedInputsTotal: number;
  };
}

export interface ValidationContext {
  foodDislikes: string[];
  foodLikes: string[];
  dietaryRestrictions: string[];
  avoidList: string[];
  mobilityNeeds: string[];
  pacePreference: 'relaxed' | 'moderate' | 'packed';
  budgetTier: string;
  traitScores: Record<string, number>;
  tripIntents: string[];
  mustDoActivities?: string[];
}

// =============================================================================
// VENUE VERIFICATION
// =============================================================================

export interface VenueVerification {
  isValid: boolean;
  confidence: number;
  placeId?: string;
  formattedAddress?: string;
  coordinates?: { lat: number; lng: number };
  rating?: { value: number; totalReviews: number };
  priceLevel?: number;
  openingHours?: string[];
  website?: string;
  googleMapsUrl?: string;
  sourceProvider?:
    | 'google_places'
    | 'foursquare'
    | 'viator'
    | 'internal_db'
    | 'ai_verified';
}

export interface CachedVenue {
  id: string;
  name: string;
  google_place_id: string | null;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  rating: number | null;
  total_reviews: number | null;
  price_level: number | null;
  website: string | null;
  verification_confidence: number;
  verification_source: string;
}

// =============================================================================
// DIRECT TRIP DATA (for localStorage/demo mode fallback)
// =============================================================================

export interface DirectTripData {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  tripType?: string;
  budgetTier?: string;
  userId?: string;
}
