import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface GenerationContext {
  tripId: string;
  userId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
  dailyBudget?: number;
  currency?: string;
}

interface StrictActivity {
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
  cost: { amount: number; currency: string; formatted?: string };
  description: string;
  tags: string[];
  bookingRequired: boolean;
  transportation: {
    method: string;
    duration: string;
    estimatedCost: { amount: number; currency: string };
    instructions: string;
  };
  tips?: string;
  photos?: Array<{ url: string; photographer?: string; alt?: string }>;
  rating?: { value: number; totalReviews: number };
  verified?: { isValid: boolean; confidence: number; placeId?: string };
  durationMinutes?: number;
  categoryIcon?: string;
  // New fields for venue details
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  priceLevel?: number; // 1-4 scale
  googleMapsUrl?: string;
  reviewHighlights?: string[];
}

interface StrictDay {
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
}

interface TripOverview {
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
}

interface EnrichedItinerary {
  days: StrictDay[];
  overview?: TripOverview;
  enrichmentMetadata: {
    enrichedAt: string;
    geocodedActivities: number;
    verifiedActivities: number;
    photosAdded: number;
    totalActivities: number;
  };
}

// =============================================================================
// RATE LIMITING - In-memory store (resets on cold start, but limits abuse)
// =============================================================================
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMITS = {
  'generate-full': { maxRequests: 3, windowMs: 300000 }, // 3 full generations per 5 min
  'generate-day': { maxRequests: 10, windowMs: 60000 },   // 10 day regenerations per min
  default: { maxRequests: 20, windowMs: 60000 }           // 20 requests per min for other actions
};

function checkRateLimit(userId: string, action: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `${userId}:${action}`;
  const limits = RATE_LIMITS[action as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limits.windowMs });
    return { allowed: true, remaining: limits.maxRequests - 1 };
  }
  
  if (entry.count >= limits.maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: limits.maxRequests - entry.count };
}

// =============================================================================
// STRICT SCHEMA FOR AI GENERATION (Tool Definition)
// =============================================================================

const STRICT_ITINERARY_TOOL = {
  type: "function",
  function: {
    name: "create_complete_itinerary",
    description: "Creates a complete, structured travel itinerary with all required details including COORDINATES, COSTS, and COMPREHENSIVE TAGS",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "array",
          description: "Array of daily itinerary plans",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "integer", minimum: 1 },
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              title: { type: "string", description: "Day title (e.g., 'Historic Exploration')" },
              activities: {
                type: "array",
                minItems: 3,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    startTime: { type: "string", description: "HH:MM format (24-hour)" },
                    endTime: { type: "string", description: "HH:MM format (24-hour)" },
                    category: {
                      type: "string",
                      enum: ["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"]
                    },
                    location: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Venue name" },
                        address: { type: "string", description: "Full street address with city and postal code" },
                        coordinates: {
                          type: "object",
                          properties: {
                            lat: { type: "number", description: "Latitude (e.g., 48.8584)" },
                            lng: { type: "number", description: "Longitude (e.g., 2.2945)" }
                          },
                          required: ["lat", "lng"],
                          description: "REQUIRED: Approximate GPS coordinates for the venue"
                        }
                      },
                      required: ["name", "address", "coordinates"]
                    },
                    cost: {
                      type: "object",
                      properties: {
                        amount: { type: "number", minimum: 0, description: "REQUIRED: Realistic cost per person in local currency. Use 0 for free attractions." },
                        currency: { type: "string", description: "ISO currency code (USD, EUR, GBP, etc.)" }
                      },
                      required: ["amount", "currency"]
                    },
                    description: { type: "string", description: "Activity description (2-3 sentences)" },
                    tags: { 
                      type: "array", 
                      items: { type: "string" }, 
                      minItems: 5,
                      description: "REQUIRED: 5-8 comprehensive tags for search. Include: category tags (museum, park), experience tags (romantic, family-friendly), time tags (morning, sunset), price tags (free, budget-friendly, premium), mood tags (adventure, relaxation)"
                    },
                    bookingRequired: { type: "boolean" },
                    transportation: {
                      type: "object",
                      properties: {
                        method: { type: "string", enum: ["walk", "metro", "bus", "taxi", "uber", "tram", "train", "car"] },
                        duration: { type: "string" },
                        estimatedCost: {
                          type: "object",
                          properties: {
                            amount: { type: "number" },
                            currency: { type: "string" }
                          },
                          required: ["amount", "currency"]
                        },
                        instructions: { type: "string" }
                      },
                      required: ["method", "duration", "estimatedCost", "instructions"]
                    },
                    tips: { type: "string", description: "Insider tip or recommendation" },
                    rating: {
                      type: "object",
                      properties: {
                        value: { type: "number", minimum: 1, maximum: 5 },
                        totalReviews: { type: "integer", minimum: 0 }
                      },
                      required: ["value", "totalReviews"]
                    },
                    website: { type: "string", description: "Official website URL if available" },
                    priceLevel: { type: "integer", minimum: 1, maximum: 4, description: "Price level 1-4 ($ to $$$$)" },
                    reviewHighlights: { 
                      type: "array", 
                      items: { type: "string" }, 
                      maxItems: 3,
                      description: "2-3 short review snippets highlighting what visitors love"
                    }
                  },
                  required: ["id", "title", "startTime", "endTime", "category", "location", "cost", "description", "tags", "bookingRequired", "transportation"]
                }
              }
            },
            required: ["dayNumber", "date", "title", "activities"]
          }
        }
      },
      required: ["days"]
    }
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// =============================================================================
// GROUP PREFERENCE BLENDING - For multi-traveler trips with linked friends
// =============================================================================

interface TravelDNAV2 {
  user_id?: string;
  dna_version?: number;
  trait_scores?: Record<string, number>;
  archetype_matches?: Array<{
    archetype_id: string;
    name: string;
    category?: string;
    score: number;
    pct: number;
    reasons?: Array<{ trait: string; effect: string; amount: number; note?: string }>;
  }>;
  confidence?: number;
  trait_contributions?: Array<{
    question_id: string;
    answer_id: string;
    label?: string;
    deltas: Record<string, number>;
    normalized_multiplier: number;
  }>;
}

interface TravelDNAProfile {
  user_id: string;
  trait_scores?: Record<string, number>;
  travel_dna_v2?: TravelDNAV2;
  archetype_matches?: TravelDNAV2['archetype_matches'];
  confidence?: number;
  dna_version?: number;
}

interface PreferenceProfile {
  user_id: string;
  interests?: string[];
  travel_pace?: string;
  budget_tier?: string;
  dining_style?: string;
  activity_level?: string;
  dietary_restrictions?: string[];
  accessibility_needs?: string[];
  mobility_needs?: string;
  mobility_level?: string;
  climate_preferences?: string[];
  eco_friendly?: boolean;
}

/**
 * Blend preferences for group trips using weighted averaging
 * The trip organizer can optionally have higher weight
 */
function blendGroupPreferences(
  profiles: PreferenceProfile[],
  organizerId?: string
): PreferenceProfile | null {
  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0];

  console.log(`[GroupBlend] Blending preferences for ${profiles.length} travelers`);

  // Assign weights - organizer gets 1.5x weight
  const weights = profiles.map(p => p.user_id === organizerId ? 1.5 : 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map(w => w / totalWeight);

  // Blend interests - take union with frequency-based ordering
  const interestCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    (p.interests || []).forEach(interest => {
      interestCounts[interest] = (interestCounts[interest] || 0) + normalizedWeights[idx];
    });
  });
  const blendedInterests = Object.entries(interestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([interest]) => interest);

  // Blend pace - weighted voting
  const paceCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.travel_pace) {
      paceCounts[p.travel_pace] = (paceCounts[p.travel_pace] || 0) + normalizedWeights[idx];
    }
  });
  const blendedPace = Object.entries(paceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'moderate';

  // Blend activity level - weighted voting
  const activityCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.activity_level) {
      activityCounts[p.activity_level] = (activityCounts[p.activity_level] || 0) + normalizedWeights[idx];
    }
  });
  const blendedActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Blend dining style - weighted voting
  const diningCounts: Record<string, number> = {};
  profiles.forEach((p, idx) => {
    if (p.dining_style) {
      diningCounts[p.dining_style] = (diningCounts[p.dining_style] || 0) + normalizedWeights[idx];
    }
  });
  const blendedDining = Object.entries(diningCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // CRITICAL: Merge all dietary restrictions (union - don't leave anyone out!)
  const allDietary = new Set<string>();
  profiles.forEach(p => {
    (p.dietary_restrictions || []).forEach(d => allDietary.add(d));
  });

  // CRITICAL: Merge all accessibility needs (union)
  const allAccessibility = new Set<string>();
  profiles.forEach(p => {
    (p.accessibility_needs || []).forEach(a => allAccessibility.add(a));
  });

  // Mobility - take most restrictive
  const mobilityLevels = ['limited', 'moderate', 'active', 'very_active'];
  let mostRestrictiveMobility = 'active';
  profiles.forEach(p => {
    if (p.mobility_level) {
      const currentIdx = mobilityLevels.indexOf(mostRestrictiveMobility);
      const newIdx = mobilityLevels.indexOf(p.mobility_level);
      if (newIdx < currentIdx) mostRestrictiveMobility = p.mobility_level;
    }
  });

  // Eco-friendly - if any member cares, respect it
  const anyEcoFriendly = profiles.some(p => p.eco_friendly);

  // Climate preferences - intersection preferred, union if empty
  const climateSets = profiles.map(p => new Set(p.climate_preferences || []));
  let blendedClimate: string[] = [];
  if (climateSets.every(s => s.size > 0)) {
    // Find intersection
    const first = climateSets[0];
    const intersection = [...first].filter(c => climateSets.every(s => s.has(c)));
    if (intersection.length > 0) {
      blendedClimate = intersection;
    } else {
      // Fallback to union
      const union = new Set<string>();
      climateSets.forEach(s => s.forEach(c => union.add(c)));
      blendedClimate = [...union];
    }
  }

  console.log(`[GroupBlend] Result: ${blendedInterests.length} interests, pace=${blendedPace}, ${allDietary.size} dietary restrictions`);

  return {
    user_id: 'blended',
    interests: blendedInterests,
    travel_pace: blendedPace,
    activity_level: blendedActivity,
    dining_style: blendedDining,
    dietary_restrictions: [...allDietary],
    accessibility_needs: [...allAccessibility],
    mobility_level: mostRestrictiveMobility,
    climate_preferences: blendedClimate,
    eco_friendly: anyEcoFriendly,
  };
}

/**
 * Fetch collaborator preferences for a trip
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCollaboratorPreferences(supabase: any, tripId: string): Promise<PreferenceProfile[]> {
  try {
    // Get collaborators linked to this trip
    const { data: collaborators, error: collabError } = await supabase
      .from('trip_collaborators')
      .select('user_id')
      .eq('trip_id', tripId);

    if (collabError || !collaborators?.length) {
      return [];
    }

    const userIds = collaborators.map((c: { user_id: string }) => c.user_id);
    
    // Fetch their preferences using the SAFE view (excludes PII like phone_number)
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences_safe')
      .select('*')
      .in('user_id', userIds);

    if (prefError) {
      console.error('[GroupBlend] Error fetching collaborator preferences:', prefError);
      return [];
    }

    return (preferences || []) as PreferenceProfile[];
  } catch (e) {
    console.error('[GroupBlend] Error:', e);
    return [];
  }
}

/**
 * Get flight and hotel context for AI prompt
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface FlightHotelContextResult {
  context: string;
  arrivalTime?: string;
  arrivalTime24?: string;
  earliestFirstActivityTime?: string;
  returnDepartureTime?: string;
  returnDepartureTime24?: string;
  latestLastActivityTime?: string;
  hotelName?: string;
  hotelAddress?: string;
}

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  if (!period && hours >= 24) return null;
  return hours * 60 + mins;
}

function minutesToHHMM(totalMinutes: number): string {
  const mins = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutesToHHMM(timeHHMM: string, deltaMins: number): string {
  const base = parseTimeToMinutes(timeHHMM);
  if (base === null) return timeHHMM;
  return minutesToHHMM(base + deltaMins);
}

function normalizeTo24h(timeStr: string): string | null {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return null;
  return minutesToHHMM(mins);
}

async function getFlightHotelContext(supabase: any, tripId: string): Promise<FlightHotelContextResult> {
  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select('flight_selection, hotel_selection')
      .eq('id', tripId)
      .maybeSingle();

    if (error || !trip) return { context: '' };

    const sections: string[] = [];
    let arrivalTimeStr: string | undefined;
    let arrivalTime24: string | undefined;
    let earliestFirstActivity: string | undefined;
    let returnDepartureTimeStr: string | undefined;
    let returnDepartureTime24: string | undefined;
    let latestLastActivity: string | undefined;
    let hotelName: string | undefined;
    let hotelAddress: string | undefined;

    // Parse flight information - handle both flat and nested structures
    // Flat: { arrivalTime, returnDepartureTime }
    // Nested: { departure: { arrivalTime }, return: { departureTime } }
    const flightRaw = trip.flight_selection as Record<string, unknown> | null;
    
    if (flightRaw) {
      const flightInfo: string[] = [];
      
      // Extract arrival time for Day 1 (when we land at destination)
      // Nested structure: departure.arrivalTime (outbound flight arrives at destination)
      // Flat structure: arrivalTime
      const nestedDeparture = flightRaw.departure as Record<string, unknown> | undefined;
      const nestedReturn = flightRaw.return as Record<string, unknown> | undefined;
      
      const outboundArrival = (nestedDeparture?.arrivalTime as string) || (flightRaw.arrivalTime as string);
      const returnDeparture = (nestedReturn?.departureTime as string) || (flightRaw.returnDepartureTime as string);
      
      // Airport info
      const departureAirport = flightRaw.departureAirport as string | undefined;
      const arrivalAirport = flightRaw.arrivalAirport as string | undefined;
      
      if (departureAirport && arrivalAirport) {
        flightInfo.push(`✈️ Outbound: ${departureAirport} → ${arrivalAirport}`);
      }
      
      // Outbound departure time
      const outboundDeparture = (nestedDeparture?.departureTime as string) || (flightRaw.departureTime as string);
      if (outboundDeparture) {
        flightInfo.push(`  Departure: ${outboundDeparture}`);
      }
      
      // Day 1 arrival - CRITICAL for first activity timing
      if (outboundArrival) {
        // Normalize to 24h HH:MM (required by the AI tool schema for startTime/endTime)
        arrivalTimeStr = outboundArrival; // keep original for display
        arrivalTime24 = normalizeTo24h(outboundArrival) || (outboundArrival.includes('T') ? normalizeTo24h(new Date(outboundArrival).toTimeString()) || undefined : undefined);
        flightInfo.push(`  Arrival: ${arrivalTimeStr}${arrivalTime24 ? ` (24h: ${arrivalTime24})` : ''}`);

        // Calculate earliest sightseeing time: arrival + 4 hours buffer
        if (arrivalTime24) {
          const ARRIVAL_BUFFER_MINS = 4 * 60;
          earliestFirstActivity = minutesToHHMM((parseTimeToMinutes(arrivalTime24) || 0) + ARRIVAL_BUFFER_MINS);
        }

        console.log(`[FlightContext] Raw arrival: "${outboundArrival}", arrival24: ${arrivalTime24}, earliest sightseeing: ${earliestFirstActivity}`);
      }
      
      // Last day - return flight departure
      if (returnDeparture) {
        returnDepartureTimeStr = returnDeparture;
        returnDepartureTime24 = normalizeTo24h(returnDeparture) || undefined;
        flightInfo.push(`✈️ Return departure: ${returnDepartureTimeStr}`);

        // Calculate latest last activity: return departure - 3 hours buffer
        if (returnDepartureTime24) {
          const DEPARTURE_BUFFER_MINS = 3 * 60;
          latestLastActivity = minutesToHHMM((parseTimeToMinutes(returnDepartureTime24) || 0) - DEPARTURE_BUFFER_MINS);
        }

        console.log(`[FlightContext] Return raw ${returnDepartureTimeStr}, return24: ${returnDepartureTime24}, latest activity: ${latestLastActivity}`);
      }
      
      if (flightInfo.length > 0) {
        let flightConstraints = `\n${'='.repeat(40)}\n✈️ FLIGHT SCHEDULE - CRITICAL CONSTRAINTS\n${'='.repeat(40)}\n${flightInfo.join('\n')}`;
        
        // Add explicit timing constraints
        if (earliestFirstActivity) {
          flightConstraints += `\n\n🚨 DAY 1 TIMING CONSTRAINT:`;
          flightConstraints += `\n   - Flight lands at ${arrivalTime24 || arrivalTimeStr}`;
          flightConstraints += `\n   - Allow 4 hours for: customs/immigration, baggage, transport to hotel, check-in`;
          flightConstraints += `\n   - EARLIEST first sightseeing activity: ${earliestFirstActivity} (NOT earlier!)`;
          flightConstraints += `\n   - If arrival is late (after 6 PM), Day 1 should only include: arrival → transfer → check-in → (optional) quick dinner near hotel → rest`;
        }
        
        if (latestLastActivity) {
          flightConstraints += `\n\n🚨 LAST DAY TIMING CONSTRAINT:`;
          flightConstraints += `\n   - Return flight departs at ${returnDepartureTimeStr}`;
          flightConstraints += `\n   - Allow 3 hours for: checkout, transport to airport, check-in, security`;
          flightConstraints += `\n   - LATEST activity before airport transfer: ${latestLastActivity}`;
        }
        
        sections.push(flightConstraints);
      }
    }

    // Parse hotel information  
    const hotel = trip.hotel_selection as {
      name?: string;
      address?: string;
      neighborhood?: string;
      checkIn?: string;
      checkOut?: string;
    } | null;
    
    if (hotel) {
      const hotelInfo: string[] = [];
      if (hotel.name) {
        hotelInfo.push(`🏨 Hotel: ${hotel.name}`);
        hotelName = hotel.name;
      }
      if (hotel.address) {
        hotelInfo.push(`   Address: ${hotel.address}`);
        hotelAddress = hotel.address;
      }
      if (hotel.neighborhood) {
        hotelInfo.push(`   Neighborhood: ${hotel.neighborhood}`);
      }
      if (hotelInfo.length > 0) {
        sections.push(`\n${'='.repeat(40)}\n🏨 ACCOMMODATION (Use as daily starting/ending point)\n${'='.repeat(40)}\n${hotelInfo.join('\n')}\n⚠️ Start each day from the hotel area and end nearby for easy return.`);
      }
    }

    return {
      context: sections.join('\n'),
      arrivalTime: arrivalTimeStr,
      arrivalTime24,
      earliestFirstActivityTime: earliestFirstActivity,
      returnDepartureTime: returnDepartureTimeStr,
      returnDepartureTime24,
      latestLastActivityTime: latestLastActivity,
      hotelName,
      hotelAddress,
    };
  } catch (e) {
    console.error('[FlightHotel] Error:', e);
    return { context: '' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLearnedPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preference_insights')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserPreferences(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(`
        interests, 
        travel_pace, 
        budget_tier, 
        dining_style, 
        activity_level,
        dietary_restrictions,
        accessibility_needs,
        mobility_needs,
        mobility_level,
        hotel_style,
        accommodation_style,
        flight_preferences,
        flight_time_preference,
        seat_preference,
        direct_flights_only,
        climate_preferences,
        weather_preferences,
        preferred_regions,
        eco_friendly,
        traveler_type,
        travel_vibes,
        planning_preference,
        travel_companions,
        vibe,
        travel_style,
        primary_goal
      `)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// =============================================================================
// TRAVEL DNA V2 INTEGRATION - Archetype blend + confidence for persona
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTravelDNAV2(supabase: any, userId: string): Promise<TravelDNAProfile | null> {
  try {
    // First check for Travel DNA v2 data
    const { data: dnaProfile, error: dnaError } = await supabase
      .from('travel_dna_profiles')
      .select('user_id, trait_scores, travel_dna_v2, archetype_matches, dna_version')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (dnaProfile?.travel_dna_v2) {
      console.log('[TravelDNA] Found v2 profile with archetype blend');
      return {
        user_id: dnaProfile.user_id,
        trait_scores: dnaProfile.travel_dna_v2.trait_scores,
        travel_dna_v2: dnaProfile.travel_dna_v2,
        archetype_matches: dnaProfile.travel_dna_v2.archetype_matches,
        confidence: dnaProfile.travel_dna_v2.confidence,
        dna_version: 2,
      };
    }

    // Fallback to v1 or archetype_matches column
    if (dnaProfile?.archetype_matches) {
      console.log('[TravelDNA] Found v1 profile with archetype_matches');
      return {
        user_id: dnaProfile.user_id,
        trait_scores: dnaProfile.trait_scores,
        archetype_matches: dnaProfile.archetype_matches,
        dna_version: 1,
      };
    }

    // Also check profiles.travel_dna for legacy data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('travel_dna, travel_dna_overrides')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.travel_dna) {
      const dna = profile.travel_dna as Record<string, unknown>;
      console.log('[TravelDNA] Found legacy profile data');
      return {
        user_id: userId,
        trait_scores: dna.trait_scores as Record<string, number>,
        dna_version: 1,
      };
    }

    return null;
  } catch (e) {
    console.error('[TravelDNA] Error fetching:', e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTraitOverrides(supabase: any, userId: string): Promise<Record<string, number> | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('travel_dna_overrides')
      .eq('id', userId)
      .maybeSingle();
    
    if (data?.travel_dna_overrides && typeof data.travel_dna_overrides === 'object') {
      console.log('[TravelDNA] Found trait overrides');
      return data.travel_dna_overrides as Record<string, number>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build Travel DNA persona context for AI prompt
 * Includes archetype blend, confidence level, and trait information
 */
function buildTravelDNAContext(
  dna: TravelDNAProfile | null, 
  overrides: Record<string, number> | null
): string {
  if (!dna) return '';

  const sections: string[] = [];
  
  // Get effective trait scores (overrides take precedence)
  const traitScores = overrides 
    ? { ...dna.trait_scores, ...overrides }
    : dna.trait_scores;
  
  // Archetype blend section
  const archetypes = dna.travel_dna_v2?.archetype_matches || dna.archetype_matches;
  const confidence = dna.travel_dna_v2?.confidence ?? dna.confidence ?? 75;
  
  if (archetypes && archetypes.length > 0) {
    const blendParts = archetypes.slice(0, 3).map((a: { name: string; pct: number }) => 
      `${a.name.replace(/_/g, ' ')} (${Math.round(a.pct)}%)`
    );
    
    const confidenceLabel = confidence >= 80 ? 'High' : confidence >= 60 ? 'Moderate' : 'Uncertain';
    
    let personaSection = `\n${'='.repeat(60)}\n🧬 TRAVEL DNA ARCHETYPE BLEND\n${'='.repeat(60)}`;
    personaSection += `\nArchetype Blend: ${blendParts.join(' + ')}`;
    personaSection += `\nConfidence: ${Math.round(confidence)}/100 (${confidenceLabel})`;
    
    // Add guidance based on confidence
    if (confidence < 60) {
      personaSection += `\n\n⚠️ LOW CONFIDENCE NOTICE:`;
      personaSection += `\n   - This traveler's profile has mixed signals or is still being refined`;
      personaSection += `\n   - Avoid overly assertive persona-based recommendations`;
      personaSection += `\n   - Include more variety and let activities speak for themselves`;
      personaSection += `\n   - Consider offering 2 stylistic alternatives for key decisions`;
    } else if (confidence >= 80) {
      personaSection += `\n\n✅ HIGH CONFIDENCE:`;
      personaSection += `\n   - Lean into the primary archetype's preferences confidently`;
      personaSection += `\n   - Personalization can be more specific and targeted`;
    }
    
    sections.push(personaSection);
  }
  
  // Trait summary section
  if (traitScores && Object.keys(traitScores).length > 0) {
    const traitLabels: Record<string, [string, string]> = {
      planning: ['Spontaneous', 'Detailed Planner'],
      social: ['Solo/Intimate', 'Social/Group'],
      comfort: ['Budget-Conscious', 'Luxury-Seeking'],
      pace: ['Relaxed', 'Fast-Paced'],
      authenticity: ['Tourist-Friendly', 'Local/Authentic'],
      adventure: ['Safe/Comfortable', 'Adventurous'],
      budget: ['Splurge', 'Frugal'],
      transformation: ['Leisure', 'Growth-Focused'],
    };
    
    let traitSection = `\n${'='.repeat(60)}\n📊 TRAIT PROFILE\n${'='.repeat(60)}`;
    
    for (const [trait, score] of Object.entries(traitScores)) {
      const labels = traitLabels[trait];
      if (labels && typeof score === 'number') {
        const normalized = Math.round(score);
        const direction = normalized > 0 ? labels[1] : normalized < 0 ? labels[0] : 'Balanced';
        const intensity = Math.abs(normalized) >= 7 ? 'Strong' : Math.abs(normalized) >= 4 ? 'Moderate' : 'Slight';
        traitSection += `\n   ${trait}: ${normalized > 0 ? '+' : ''}${normalized}/10 → ${intensity} ${direction}`;
      }
    }
    
    // Add override notice if applicable
    if (overrides && Object.keys(overrides).length > 0) {
      traitSection += `\n\n   ⚙️ User has manually adjusted some traits - respect these preferences.`;
    }
    
    sections.push(traitSection);
  }
  
  return sections.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPreferenceContext(insights: any, prefs: any): string {
  const sections: { title: string; items: string[] }[] = [];

  // ==========================================================================
  // LEARNED INSIGHTS (from activity feedback)
  // ==========================================================================
  if (insights) {
    const insightItems: string[] = [];
    
    const lovedTypes = Object.entries(insights.loved_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (lovedTypes.length > 0) {
      insightItems.push(`✅ LOVES: ${lovedTypes.join(', ')}`);
    }

    const dislikedTypes = Object.entries(insights.disliked_activity_types || {})
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    if (dislikedTypes.length > 0) {
      insightItems.push(`❌ AVOID activities: ${dislikedTypes.join(', ')}`);
    }

    if (insights.preferred_pace) {
      const formattedPace = insights.preferred_pace.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      insightItems.push(`Learned pace preference: ${formattedPace}`);
    }
    
    if (insightItems.length > 0) {
      sections.push({ title: '🧠 LEARNED FROM PAST TRIPS', items: insightItems });
    }
  }

  // ==========================================================================
  // USER PREFERENCES
  // ==========================================================================
  if (prefs) {
    const coreItems: string[] = [];
    const restrictionItems: string[] = [];
    const mobilityItems: string[] = [];
    const climateItems: string[] = [];
    const accommodationItems: string[] = [];
    const personaItems: string[] = [];

    // Traveler persona (from quiz - key for personalization!)
    if (prefs.traveler_type) {
      const personaMap: Record<string, string> = {
        'explorer': 'Curiosity-driven explorer who seeks authentic, off-the-beaten-path adventures and hidden gems',
        'escape_artist': 'Peace-seeker who travels to disconnect, recharge, and find inner peace',
        'curated_luxe': 'Refinement-focused traveler who appreciates curated experiences and premium service',
        'story_seeker': 'Moment-collector who focuses on memorable experiences and cultural connections',
      };
      personaItems.push(`🧭 TRAVELER TYPE: ${personaMap[prefs.traveler_type] || prefs.traveler_type}`);
    }
    
    if (prefs.travel_vibes?.length) {
      personaItems.push(`Attracted to: ${prefs.travel_vibes.join(', ')} environments`);
    }
    
    if (prefs.vibe || prefs.travel_style) {
      personaItems.push(`Overall vibe: ${prefs.vibe || prefs.travel_style}`);
    }
    
    if (prefs.travel_companions?.length) {
      const companionContext = prefs.travel_companions.map((c: string) => {
        const map: Record<string, string> = {
          'solo': 'solo traveler - include opportunities for reflection and meeting locals',
          'partner': 'traveling with partner - include romantic spots and couple activities',
          'family': 'family travel - ensure kid-friendly options and manageable pacing',
          'friends': 'group of friends - include social activities and shared experiences',
        };
        return map[c] || c;
      });
      personaItems.push(`Travel style: ${companionContext.join('; ')}`);
    }
    
    if (prefs.planning_preference) {
      const planningMap: Record<string, string> = {
        'detailed': 'Plans everything in advance - provide specific times, reservations, and backup options',
        'flexible': 'Prefers a loose framework - provide key bookings but leave room for spontaneity',
        'spontaneous': 'Minimal planning preferred - focus on must-see highlights, leave gaps for discovery',
      };
      personaItems.push(`Planning style: ${planningMap[prefs.planning_preference] || prefs.planning_preference}`);
    }
    
    if (personaItems.length > 0) {
      sections.push({ title: '🎭 TRAVELER PERSONA', items: personaItems });
    }

    // Core preferences
    if (prefs.interests?.length) {
      coreItems.push(`Interests: ${prefs.interests.slice(0, 6).join(', ')}`);
    }
    if (prefs.travel_pace) {
      coreItems.push(`Travel pace: ${prefs.travel_pace}`);
    }
    if (prefs.activity_level) {
      coreItems.push(`Activity level: ${prefs.activity_level}`);
    }
    if (prefs.dining_style) {
      coreItems.push(`Dining style: ${prefs.dining_style}`);
    }
    if (prefs.eco_friendly) {
      coreItems.push(`🌱 Eco-conscious traveler - prefer sustainable options`);
    }
    
    if (coreItems.length > 0) {
      sections.push({ title: '🎯 TRAVEL STYLE', items: coreItems });
    }

    // CRITICAL: Dietary restrictions
    if (prefs.dietary_restrictions?.length) {
      restrictionItems.push(`⚠️ DIETARY RESTRICTIONS: ${prefs.dietary_restrictions.join(', ')}`);
      restrictionItems.push(`ALL meal recommendations MUST accommodate these restrictions`);
    }
    
    if (restrictionItems.length > 0) {
      sections.push({ title: '🍽️ DIETARY REQUIREMENTS (MANDATORY)', items: restrictionItems });
    }

    // CRITICAL: Accessibility & Mobility
    if (prefs.accessibility_needs?.length || prefs.mobility_needs || prefs.mobility_level) {
      if (prefs.accessibility_needs?.length) {
        mobilityItems.push(`♿ ACCESSIBILITY NEEDS: ${prefs.accessibility_needs.join(', ')}`);
      }
      if (prefs.mobility_needs) {
        mobilityItems.push(`Mobility requirements: ${prefs.mobility_needs}`);
      }
      if (prefs.mobility_level) {
        mobilityItems.push(`Mobility level: ${prefs.mobility_level}`);
      }
      mobilityItems.push(`ALL venues MUST be accessible. Avoid long walks, steep stairs, or inaccessible locations.`);
      
      sections.push({ title: '♿ ACCESSIBILITY (MANDATORY)', items: mobilityItems });
    }

    // Climate & Weather preferences - THE DIFFERENTIATOR
    if (prefs.climate_preferences?.length || prefs.weather_preferences?.length) {
      if (prefs.climate_preferences?.length) {
        climateItems.push(`Preferred climates: ${prefs.climate_preferences.join(', ')}`);
      }
      if (prefs.weather_preferences?.length) {
        climateItems.push(`Weather preferences: ${prefs.weather_preferences.join(', ')}`);
      }
      climateItems.push(`Schedule outdoor activities during optimal weather conditions`);
      climateItems.push(`Have indoor backup options for weather-sensitive activities`);
      
      sections.push({ title: '🌤️ CLIMATE & WEATHER PREFERENCES', items: climateItems });
    }

    // Accommodation preferences
    if (prefs.hotel_style || prefs.accommodation_style) {
      if (prefs.hotel_style) {
        accommodationItems.push(`Hotel style: ${prefs.hotel_style}`);
      }
      if (prefs.accommodation_style) {
        accommodationItems.push(`Accommodation preference: ${prefs.accommodation_style}`);
      }
      
      sections.push({ title: '🏨 ACCOMMODATION STYLE', items: accommodationItems });
    }

    // Flight preferences (useful for airport arrival/departure context)
    if (prefs.flight_preferences || prefs.flight_time_preference || prefs.seat_preference) {
      const flightItems: string[] = [];
      if (prefs.flight_time_preference) {
        flightItems.push(`Preferred flight times: ${prefs.flight_time_preference}`);
      }
      if (prefs.direct_flights_only) {
        flightItems.push(`Prefers direct flights only`);
      }
      
      if (flightItems.length > 0) {
        sections.push({ title: '✈️ FLIGHT PREFERENCES', items: flightItems });
      }
    }

    // Preferred regions
    if (prefs.preferred_regions?.length) {
      sections.push({ 
        title: '🗺️ REGIONAL PREFERENCES', 
        items: [`Favorite regions: ${prefs.preferred_regions.join(', ')}`] 
      });
    }
  }

  // Build the final context string
  if (sections.length === 0) {
    return '';
  }

  const contextParts = sections.map(section => 
    `${section.title}:\n${section.items.map(item => `  - ${item}`).join('\n')}`
  );

  return `\n\n${'='.repeat(60)}\n🎯 PERSONALIZED TRAVELER PROFILE\n${'='.repeat(60)}\n${contextParts.join('\n\n')}`;
}

// =============================================================================
// AI PREFERENCE ENRICHMENT ("FLUFFING")
// Transforms raw preferences into rich, detailed context
// =============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichPreferencesWithAI(prefs: any, destination: string, LOVABLE_API_KEY: string): Promise<string> {
  if (!prefs || Object.keys(prefs).filter(k => prefs[k] !== null).length === 0) {
    return "";
  }

  const prompt = `You are a travel personalization expert. Transform these raw user preferences into RICH, DETAILED guidance for an AI itinerary generator.

RAW PREFERENCES:
${JSON.stringify(prefs, null, 2)}

DESTINATION: ${destination}

Your task: Expand each preference into actionable, specific guidance. For example:
- "vegetarian" → "This traveler is vegetarian - recommend restaurants with dedicated vegetarian menus, avoid steakhouses, highlight plant-based cuisine, suggest local vegetarian specialties of ${destination}"
- "temperate climate" → "Prefers mild weather 60-75°F - schedule outdoor activities in morning/late afternoon, include shaded walking tours, have indoor alternatives for midday heat"
- "accessibility_needs: wheelchair" → "Requires wheelchair access - verify elevator access at all venues, avoid cobblestone areas, recommend accessible transportation, ensure restaurant seating accommodates wheelchairs"

Create a detailed traveler profile with:
1. **TRAVELER PERSONA** (2-3 sentences capturing their travel style and what drives them)
2. **MANDATORY CONSTRAINTS** (dietary, accessibility, allergies - these are non-negotiable)
3. **CLIMATE GUIDANCE** (how weather preferences should shape the schedule)
4. **ACTIVITY PRIORITIES** (what to emphasize based on interests)
5. **SPECIAL INSTRUCTIONS** (3-5 specific "always" or "never" rules)

Make it conversational and actionable, not a bullet list. The AI reading this should feel like they deeply understand this traveler.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a travel personalization expert. Create rich, detailed traveler profiles that help AI itinerary generators deeply understand each traveler." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.warn("[Preference Enrichment] AI call failed, using raw context");
      return "";
    }

    const result = await response.json();
    const enrichedProfile = result.choices?.[0]?.message?.content || "";
    
    if (enrichedProfile) {
      console.log("[Preference Enrichment] Successfully enriched preferences");
      return `\n\n${'='.repeat(60)}\n🌟 AI-ENRICHED TRAVELER PROFILE\n${'='.repeat(60)}\n${enrichedProfile}`;
    }
    
    return "";
  } catch (error) {
    console.warn("[Preference Enrichment] Error:", error);
    return "";
  }
}

function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(startDate: string, dayOffset: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split('T')[0];
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    sightseeing: 'map-pin',
    dining: 'utensils',
    cultural: 'landmark',
    shopping: 'shopping-bag',
    relaxation: 'spa',
    transport: 'car',
    accommodation: 'bed',
    activity: 'activity'
  };
  return icons[category] || 'star';
}

// =============================================================================
// STAGE 1: CONTEXT PREPARATION
// =============================================================================

interface DirectTripData {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function prepareContext(supabase: any, tripId: string, userId?: string, directTripData?: DirectTripData): Promise<GenerationContext | null> {
  console.log(`[Stage 1] Preparing context for trip ${tripId}`);

  // First try to fetch from database
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();

  // If we have direct trip data, use it as fallback (for localStorage/demo mode trips)
  if (!trip && directTripData) {
    console.log('[Stage 1] Trip not in database, using direct trip data');
    
    const totalDays = calculateDays(directTripData.startDate, directTripData.endDate);
    
    const context: GenerationContext = {
      tripId: directTripData.tripId,
      userId: directTripData.userId || userId || 'anonymous',
      destination: directTripData.destination,
      destinationCountry: directTripData.destinationCountry,
      startDate: directTripData.startDate,
      endDate: directTripData.endDate,
      totalDays,
      travelers: directTripData.travelers || 1,
      tripType: directTripData.tripType,
      budgetTier: directTripData.budgetTier,
      pace: 'moderate',
      interests: [],
      currency: 'USD'
    };
    
    // Set daily budget based on tier
    const budgetMap: Record<string, number> = {
      budget: 75,
      economy: 100,
      standard: 150,
      comfort: 200,
      premium: 300,
      luxury: 500
    };
    context.dailyBudget = budgetMap[context.budgetTier || 'standard'] || 150;
    
    console.log(`[Stage 1] Context prepared from direct data: ${context.totalDays} days in ${context.destination}`);
    return context;
  }

  if (error || !trip) {
    console.error('[Stage 1] Trip not found:', error);
    return null;
  }

  const totalDays = calculateDays(trip.start_date, trip.end_date);

  const context: GenerationContext = {
    tripId: trip.id,
    userId: userId || trip.user_id,
    destination: trip.destination,
    destinationCountry: trip.destination_country,
    startDate: trip.start_date,
    endDate: trip.end_date,
    totalDays,
    travelers: trip.travelers || 1,
    tripType: trip.trip_type,
    budgetTier: trip.budget_tier,
    pace: trip.metadata?.pace || 'moderate',
    interests: trip.metadata?.interests || [],
    currency: 'USD'
  };

  // Set daily budget based on tier
  const budgetMap: Record<string, number> = {
    budget: 75,
    economy: 100,
    standard: 150,
    comfort: 200,
    premium: 300,
    luxury: 500
  };
  context.dailyBudget = budgetMap[context.budgetTier || 'standard'] || 150;

  console.log(`[Stage 1] Context prepared: ${context.totalDays} days in ${context.destination}`);
  return context;
}

// =============================================================================
// STAGE 2: AI GENERATION WITH STRICT SCHEMA
// =============================================================================

async function generateItineraryAI(
  context: GenerationContext,
  preferenceContext: string,
  LOVABLE_API_KEY: string
): Promise<{ days: StrictDay[] } | null> {
  console.log(`[Stage 2] Starting AI generation for ${context.totalDays} days`);

  const systemPrompt = `You are an expert travel planner creating HIGHLY PERSONALIZED itineraries. Your itineraries are:
- Realistic with proper timing and logistics
- Include a balanced mix of experiences (cultural, culinary, relaxation, activities)
- Feature local hidden gems alongside popular attractions
- Account for travel time between activities
- STRICTLY tailored to the traveler's personal profile and constraints

MANDATORY PERSONALIZATION RULES:
1. DIETARY RESTRICTIONS are NON-NEGOTIABLE - never recommend restaurants or food that violate dietary requirements
2. ACCESSIBILITY NEEDS are NON-NEGOTIABLE - all venues must be accessible, avoid stairs/long walks if mobility issues exist
3. CLIMATE/WEATHER preferences should inform activity timing (outdoor activities during preferred conditions)
4. Use the traveler's INTERESTS to prioritize activity categories
5. Match the traveler's PACE preference (relaxed = fewer activities with more downtime, packed = more activities)
6. Honor LEARNED PREFERENCES from past trips - include activities they've loved, avoid what they disliked

CRITICAL DATA REQUIREMENTS (REQUIRED FOR EVERY ACTIVITY):
1. COORDINATES: Provide approximate lat/lng for EVERY venue. You know major landmarks, restaurants, and attractions worldwide. Example: Eiffel Tower = {"lat": 48.8584, "lng": 2.2945}
2. COSTS: Provide realistic per-person cost estimates for EVERY activity. Use 0 for free attractions. Research typical prices - museum entry ~$15-25, restaurant meal ~$30-80, tours ~$50-100.
3. TAGS: Generate 5-8 comprehensive tags for EACH activity for searchability:
   - Category tags: museum, park, restaurant, cafe, landmark, historic, religious
   - Experience tags: romantic, family-friendly, adventure, relaxation, educational, scenic
   - Time tags: morning, afternoon, evening, sunset, sunrise, night
   - Price tags: free, budget-friendly, moderate-price, premium, splurge
   - Mood tags: photo-op, instagram-worthy, hidden-gem, must-see, local-favorite
4. ADDRESSES: Complete street addresses with postal codes
5. RATINGS: Realistic ratings (3.5-5.0) and review counts (100-50000) based on venue popularity

STRUCTURAL REQUIREMENTS:
1. Include 4-6 activities per day including meals
2. START times depend on flight schedule (see FLIGHT CONSTRAINTS in preferences if provided):
   - If flight arrival time is specified: first sightseeing activity must be AT LEAST 4 hours AFTER landing
   - If no flight info: start days around 9:00 AM
3. End days by 9:00-10:00 PM (unless late arrival day - then end earlier)
4. Account for travel time between activities
5. Include transportation instructions between each activity
6. DAY 1 MUST START with airport arrival and transfer to hotel (times based on actual flight if provided)
7. LAST DAY MUST END with hotel checkout and transfer to airport (times based on return flight if provided)
8. Include website URLs for popular venues when known`;

  const daysList = [];
  for (let i = 0; i < context.totalDays; i++) {
    daysList.push(`Day ${i + 1}: ${formatDate(context.startDate, i)}`);
  }

  const userPrompt = `Generate a complete ${context.totalDays}-day itinerary for ${context.destination}${context.destinationCountry ? `, ${context.destinationCountry}` : ''}.

TRIP DETAILS:
- Dates: ${context.startDate} to ${context.endDate}
- Duration: ${context.totalDays} days
- Travelers: ${context.travelers}
- Budget tier: ${context.budgetTier || 'standard'} (~$${context.dailyBudget}/day per person)
- Trip type: ${context.tripType || 'leisure'}
- Pace: ${context.pace || 'moderate'}
${preferenceContext}

IMPORTANT STRUCTURE:
- DAY 1: Start with "Arrival at [Airport Name]" as the FIRST activity (category: "transport") at the ACTUAL arrival time from flight data, 
  followed by "Airport Transfer to Hotel" (category: "transport"), 
  then "Check-in at Hotel" (category: "accommodation")
  ⚠️ CRITICAL: If flight arrival time is provided, the first NON-transport/accommodation activity CANNOT start earlier than 4 hours after landing. 
  For example: landing at 10:30 AM → first sightseeing/dining at 14:30 (2:30 PM) or later.
- LAST DAY: End with "Hotel Checkout" (category: "accommodation"), 
  followed by "Transfer to Airport" (category: "transport") - ensure arrival at airport 2.5-3 hours before departure, 
  then "Departure from [Airport Name]" (category: "transport")

Generate activities for these days:
${daysList.join('\n')}

REQUIRED FOR EACH ACTIVITY (NO EXCEPTIONS):
1. Unique ID (format: "day1-act1", "day1-act2", etc.)
2. Specific venue name and FULL street address (including city and postal code)
3. COORDINATES: lat/lng values (you know these for major venues worldwide!)
4. COST: Realistic per-person cost in ${context.currency || 'USD'} (0 for free, realistic amounts for paid)
5. TAGS: 5-8 comprehensive tags covering category, experience type, time of day, price tier, and mood
6. Category (sightseeing, dining, cultural, shopping, relaxation, transport, accommodation, activity)
7. Start and end times in HH:MM format
8. Description (2-3 sentences including what makes it special)
9. Rating (value 3.5-5.0) and totalReviews (100-50000 for popular, less for hidden gems)
10. Whether booking is required
11. Transportation from previous location (method, duration, cost, instructions)
12. An insider tip
13. Website URL if well-known venue

COST GUIDELINES (per person):
- Free attractions: 0
- Museum entry: 15-30
- Casual restaurant: 20-40
- Mid-range restaurant: 40-80
- Fine dining: 80-200
- Tours: 40-150
- Shows/entertainment: 50-150

TAG EXAMPLES for a restaurant:
["dining", "restaurant", "french-cuisine", "evening", "romantic", "moderate-price", "local-favorite", "dinner"]

Create a well-paced, authentic travel experience!`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [STRICT_ITINERARY_TOOL],
        tool_choice: { type: "function", function: { name: "create_complete_itinerary" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error(`[Stage 2] AI Gateway error: ${status}`, errorText);
      throw new Error(status === 429 ? 'Rate limit exceeded' : status === 402 ? 'Credits exhausted' : 'AI generation failed');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("[Stage 2] No tool call in response");
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log(`[Stage 2] Generated ${result.days?.length || 0} days`);

    // Enhance activities with calculated fields and fallback costs
    const fallbackCosts: Record<string, number> = {
      sightseeing: 15,
      cultural: 20,
      dining: 35,
      shopping: 0,
      relaxation: 40,
      transport: 10,
      accommodation: 0,
      activity: 25
    };

    result.days = result.days.map((day: StrictDay) => ({
      ...day,
      activities: day.activities.map((act: StrictActivity) => {
        const amount = act.cost?.amount && act.cost.amount > 0 
          ? act.cost.amount 
          : (fallbackCosts[act.category] || 20);
        return {
          ...act,
          durationMinutes: calculateDuration(act.startTime, act.endTime),
          categoryIcon: getCategoryIcon(act.category),
          cost: {
            amount,
            currency: act.cost?.currency || 'USD',
            formatted: `$${amount} USD`
          }
        };
      })
    }));

    return result;
  } catch (error) {
    console.error("[Stage 2] Generation error:", error);
    throw error;
  }
}

// =============================================================================
// STAGE 3: EARLY SAVE (Critical - ensures user gets itinerary even if later stages fail)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function earlySaveItinerary(supabase: any, tripId: string, days: StrictDay[]): Promise<boolean> {
  console.log(`[Stage 3] Early save for trip ${tripId} with ${days.length} days`);

  try {
    const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);

    const itineraryData = {
      days,
      status: 'generating', // Will be updated to 'ready' after full enrichment
      generatedAt: new Date().toISOString(),
      enrichmentMetadata: {
        enrichedAt: new Date().toISOString(),
        geocodedActivities: 0,
        verifiedActivities: 0,
        photosAdded: 0,
        totalActivities
      }
    };

    const { error } = await supabase
      .from('trips')
      .update({
        itinerary_data: itineraryData,
        itinerary_status: 'generating',
        updated_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (error) {
      console.error('[Stage 3] Early save failed:', error);
      return false;
    }

    console.log(`[Stage 3] Early save successful - ${totalActivities} activities`);
    return true;
  } catch (e) {
    console.error('[Stage 3] Early save error:', e);
    return false;
  }
}

// =============================================================================
// STAGE 4: ENRICHMENT (Real Photos + Venue Verification via Google Places API v1)
// =============================================================================

// Google Places API v1 - Verify venue and get rich details
interface VenueVerification {
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
}

async function verifyVenueWithGooglePlaces(
  venueName: string,
  destination: string,
  GOOGLE_MAPS_API_KEY: string | undefined
): Promise<VenueVerification | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log('[Stage 4] Google Maps API key not configured, skipping venue verification');
    return null;
  }

  try {
    const textQuery = `${venueName} ${destination}`;
    console.log(`[Stage 4] Verifying venue: ${venueName}`);

    // Use AbortController for 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.websiteUri,places.googleMapsUri",
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: 1,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Stage 4] Google Places API error for "${venueName}":`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    const place = data.places?.[0];

    if (!place) {
      console.log(`[Stage 4] No place found for: ${venueName}`);
      return null;
    }

    // Map price level from new API format
    const mapPriceLevel = (priceLevel: string): number => {
      const mapping: Record<string, number> = {
        PRICE_LEVEL_FREE: 0,
        PRICE_LEVEL_INEXPENSIVE: 1,
        PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3,
        PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };
      return mapping[priceLevel] ?? 2;
    };

    console.log(`[Stage 4] ✅ Verified venue: ${venueName} → ${place.displayName?.text || 'Unknown'}`);

    return {
      isValid: true,
      confidence: 0.95,
      placeId: place.id,
      formattedAddress: place.formattedAddress,
      coordinates: place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : undefined,
      rating: place.rating ? {
        value: place.rating,
        totalReviews: place.userRatingCount || 0,
      } : undefined,
      priceLevel: place.priceLevel ? mapPriceLevel(place.priceLevel) : undefined,
      openingHours: place.currentOpeningHours?.weekdayDescriptions,
      website: place.websiteUri,
      googleMapsUrl: place.googleMapsUri,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[Stage 4] Venue verification timeout for: ${venueName}`);
    } else {
      console.log(`[Stage 4] Venue verification error for "${venueName}":`, error);
    }
    return null;
  }
}

// Fetch real venue photos using the destination-images edge function
// Priority: Cache → Google Places → TripAdvisor → Wikimedia → AI (last resort)
async function fetchActivityImage(
  activityTitle: string,
  category: string,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ url: string; source: string; attribution?: string } | null> {
  try {
    // Skip image fetching for transport/downtime activities
    const skipCategories = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
    if (skipCategories.includes(category?.toLowerCase() || '')) {
      return null;
    }

    console.log(`[Stage 4] Fetching real photo for: ${activityTitle} in ${destination}`);

    // Use AbortController for 5-second timeout on image fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Call the destination-images edge function with venue name
    const response = await fetch(`${supabaseUrl}/functions/v1/destination-images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        venueName: activityTitle,
        destination: destination,
        category: category,
        imageType: 'activity',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[Stage 4] Image fetch failed for "${activityTitle}":`, response.status);
      return null;
    }

    const data = await response.json();
    const image = data.images?.[0];

    if (image?.url && image.source !== 'fallback') {
      console.log(`[Stage 4] ✅ Got ${image.source} photo for: ${activityTitle}`);
      return {
        url: image.url,
        source: image.source,
        attribution: image.attribution,
      };
    }

    return null;
  } catch (e) {
    console.log(`[Stage 4] Image fetch error for "${activityTitle}":`, e);
    return null;
  }
}

async function enrichActivity(
  activity: StrictActivity,
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined
): Promise<StrictActivity> {
  const enriched = { ...activity };

  // Skip enrichment for transport/downtime activities
  const skipCategories = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
  if (skipCategories.includes(activity.category?.toLowerCase() || '')) {
    enriched.verified = { isValid: true, confidence: 0.75 };
    return enriched;
  }

  // Run venue verification and photo fetch in parallel for speed
  const [venueData, photoResult] = await Promise.all([
    // Verify venue with Google Places API v1
    verifyVenueWithGooglePlaces(activity.title, destination, GOOGLE_MAPS_API_KEY),
    // Fetch real venue photo using tiered approach
    !enriched.photos?.length 
      ? fetchActivityImage(activity.title, activity.category || 'sightseeing', destination, supabaseUrl, supabaseKey)
      : Promise.resolve(null),
  ]);

  // Apply venue verification data (coordinates, ratings, opening hours, etc.)
  if (venueData) {
    if (venueData.coordinates) {
      enriched.location = {
        ...enriched.location,
        coordinates: venueData.coordinates,
      };
      if (venueData.formattedAddress) {
        enriched.location.address = venueData.formattedAddress;
      }
    }
    if (venueData.rating) {
      enriched.rating = venueData.rating;
    }
    if (venueData.priceLevel !== undefined) {
      enriched.priceLevel = venueData.priceLevel;
    }
    if (venueData.openingHours) {
      enriched.openingHours = venueData.openingHours;
    }
    if (venueData.website) {
      enriched.website = venueData.website;
    }
    if (venueData.googleMapsUrl) {
      enriched.googleMapsUrl = venueData.googleMapsUrl;
    }
    enriched.verified = {
      isValid: venueData.isValid,
      confidence: venueData.confidence,
      placeId: venueData.placeId,
    };
  }

  // Apply photo data
  if (photoResult) {
    enriched.photos = [{
      url: photoResult.url,
      alt: `${activity.title} in ${destination}`,
      photographer: photoResult.attribution || `Source: ${photoResult.source}`,
    }];
  }

  // Set verification confidence based on what we got
  if (!enriched.verified) {
    const hasRealPhoto = enriched.photos?.length && 
      !enriched.photos[0]?.photographer?.includes('AI Generated');
    
    enriched.verified = {
      isValid: true,
      confidence: hasRealPhoto ? 0.8 : (enriched.photos?.length ? 0.7 : 0.6)
    };
  }

  return enriched;
}

async function enrichItinerary(
  days: StrictDay[],
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  GOOGLE_MAPS_API_KEY: string | undefined
): Promise<StrictDay[]> {
  console.log(`[Stage 4] Starting enrichment for ${days.length} days with real photos + venue verification`);

  const enrichedDays: StrictDay[] = [];
  let totalPhotos = 0;
  let verifiedCount = 0;

  for (const day of days) {
    const enrichedActivities: StrictActivity[] = [];

    // Process activities in batches of 3 with delays for rate limits
    // (3 activities × 2 API calls each = 6 concurrent requests per batch)
    const BATCH_SIZE = 3;
    for (let i = 0; i < day.activities.length; i += BATCH_SIZE) {
      const batch = day.activities.slice(i, i + BATCH_SIZE);
      const enrichedBatch = await Promise.all(
        batch.map(act => enrichActivity(act, destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY))
      );
      enrichedActivities.push(...enrichedBatch);
      totalPhotos += enrichedBatch.filter(a => a.photos?.length).length;
      verifiedCount += enrichedBatch.filter(a => a.verified?.placeId).length;

      // Delay between batches to respect API rate limits
      if (i + BATCH_SIZE < day.activities.length) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Calculate day metadata
    const totalCost = enrichedActivities.reduce((sum, a) => sum + (a.cost?.amount || 0), 0);
    const mealsCount = enrichedActivities.filter(a => a.category === 'dining').length;
    const activityCount = enrichedActivities.length;

    enrichedDays.push({
      ...day,
      activities: enrichedActivities,
      metadata: {
        theme: day.title,
        totalEstimatedCost: totalCost,
        mealsIncluded: mealsCount,
        pacingLevel: activityCount <= 3 ? 'relaxed' : activityCount <= 5 ? 'moderate' : 'packed'
      }
    });
  }

  console.log(`[Stage 4] Enrichment complete - ${totalPhotos} photos, ${verifiedCount} venues verified`);
  return enrichedDays;
}

// =============================================================================
// STAGE 5: TRIP OVERVIEW GENERATION
// =============================================================================

function generateTripOverview(days: StrictDay[], context: GenerationContext): TripOverview {
  console.log('[Stage 5] Generating trip overview');

  // Calculate budget breakdown
  let activitiesCost = 0;
  let foodCost = 0;
  let transportationCost = 0;

  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.category === 'dining') {
        foodCost += activity.cost?.amount || 0;
      } else {
        activitiesCost += activity.cost?.amount || 0;
      }
      transportationCost += activity.transportation?.estimatedCost?.amount || 0;
    }
  }

  // Estimate accommodations (35% of activities + food)
  const subtotal = activitiesCost + foodCost + transportationCost;
  const accommodations = Math.round(subtotal * 0.35);

  // Extract highlights (most expensive/featured activities)
  const allActivities = days.flatMap(d => d.activities);
  const highlights = allActivities
    .filter(a => a.category === 'sightseeing' || a.category === 'cultural')
    .sort((a, b) => (b.cost?.amount || 0) - (a.cost?.amount || 0))
    .slice(0, 5)
    .map(a => a.title);

  const overview: TripOverview = {
    currency: context.currency || 'USD',
    budgetBreakdown: {
      accommodations: Math.round(accommodations),
      activities: Math.round(activitiesCost),
      food: Math.round(foodCost),
      transportation: Math.round(transportationCost),
      total: Math.round(subtotal + accommodations)
    },
    highlights: highlights.length > 0 ? highlights : ['Explore local attractions', 'Enjoy authentic cuisine'],
    localTips: [
      'Book popular attractions in advance',
      'Try local restaurants away from tourist areas',
      'Use public transportation for authentic experiences',
      'Learn a few phrases in the local language',
      'Keep some local currency for small vendors'
    ]
  };

  console.log(`[Stage 5] Overview generated - Total budget: $${overview.budgetBreakdown?.total}`);
  return overview;
}

// =============================================================================
// STAGE 6: FINAL SAVE
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finalSaveItinerary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tripId: string,
  enrichedData: EnrichedItinerary,
  context: GenerationContext
): Promise<boolean> {
  console.log(`[Stage 6] Final save for trip ${tripId}`);

  try {
    const frontendReadyData = {
      success: true,
      status: 'ready',
      destination: context.destination,
      title: `${context.destination} - ${context.totalDays} Days`,
      tripId: context.tripId,
      totalDays: context.totalDays,
      itinerary: {
        days: enrichedData.days,
        generatedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        preferences: {
          pace: context.pace,
          budgetTier: context.budgetTier,
          interests: context.interests
        },
        metadata: {
          aiModel: 'gemini-3-flash-preview',
          version: '2.0'
        }
      },
      overview: enrichedData.overview,
      enrichmentMetadata: enrichedData.enrichmentMetadata
    };

    const { error } = await supabase
      .from('trips')
      .update({
        itinerary_data: frontendReadyData,
        itinerary_status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', tripId);

    if (error) {
      console.error('[Stage 6] Final save failed:', error);
      return false;
    }

    console.log('[Stage 6] Final save successful');
    return true;
  } catch (e) {
    console.error('[Stage 6] Final save error:', e);
    return false;
  }
}

// =============================================================================
// AUTHENTICATION HELPER
// =============================================================================
async function validateAuth(req: Request, supabase: any): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create auth client for validation
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
    });

    // Validate authentication
    const authResult = await validateAuth(req, authClient);
    if (!authResult) {
      console.error("[generate-itinerary] Unauthorized request");
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please sign in to generate itineraries." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[generate-itinerary] Authenticated user: ${authResult.userId}`);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`);

    // Rate limit check for expensive operations
    const rateCheck = checkRateLimit(authResult.userId, action);
    if (!rateCheck.allowed) {
      console.log(`[generate-itinerary] Rate limit exceeded for ${authResult.userId} on ${action}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a few minutes before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-full - Complete 7-stage pipeline
    // ==========================================================================
    if (action === 'generate-full') {
      const { tripId, userId, tripData } = params;

      // STAGE 1: Context Preparation (supports direct trip data for localStorage/demo mode)
      const directTripData = tripData ? {
        tripId,
        destination: tripData.destination,
        destinationCountry: tripData.destinationCountry,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        travelers: tripData.travelers,
        tripType: tripData.tripType,
        budgetTier: tripData.budgetTier,
        userId: tripData.userId || userId,
      } : undefined;

      const context = await prepareContext(supabase, tripId, userId, directTripData);
      if (!context) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user preferences for personalization
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      let prefs = userId ? await getUserPreferences(supabase, userId) : null;
      
      // =======================================================================
      // GROUP PREFERENCE BLENDING - For multi-traveler trips with linked friends
      // =======================================================================
      console.log("[Stage 1.2] Checking for trip collaborators...");
      const collaboratorPrefs = await getCollaboratorPreferences(supabase, tripId);
      
      if (collaboratorPrefs.length > 0) {
        console.log(`[Stage 1.2] Found ${collaboratorPrefs.length} collaborators - blending preferences`);
        
        // Include primary user's preferences in the blend
        const allProfiles: PreferenceProfile[] = prefs 
          ? [{ user_id: userId || 'primary', ...prefs }, ...collaboratorPrefs]
          : collaboratorPrefs;
        
        // Blend all preferences with organizer (primary user) having higher weight
        const blendedPrefs = blendGroupPreferences(allProfiles, userId);
        
        if (blendedPrefs) {
          console.log(`[Stage 1.2] Blended group preferences successfully`);
          prefs = blendedPrefs;
        }
      }
      
      // =======================================================================
      // TRAVEL DNA V2 - Archetype blend + trait scores for persona
      // =======================================================================
      console.log("[Stage 1.3] Fetching Travel DNA v2...");
      const travelDNA = userId ? await getTravelDNAV2(supabase, userId) : null;
      const traitOverrides = userId ? await getTraitOverrides(supabase, userId) : null;
      const travelDNAContext = buildTravelDNAContext(travelDNA, traitOverrides);
      
      if (travelDNA) {
        const confidence = travelDNA.travel_dna_v2?.confidence ?? travelDNA.confidence ?? 75;
        console.log(`[Stage 1.3] Travel DNA loaded: v${travelDNA.dna_version}, confidence=${confidence}`);
      }
      
      // =======================================================================
      // FLIGHT & HOTEL CONTEXT - Use booked flight/hotel in itinerary planning
      // =======================================================================
      console.log("[Stage 1.4] Fetching flight and hotel context...");
      const flightHotelResult = await getFlightHotelContext(supabase, tripId);
      if (flightHotelResult.context) {
        console.log("[Stage 1.4] Flight/hotel context added to AI prompt");
        if (flightHotelResult.earliestFirstActivityTime) {
          console.log(`[Stage 1.4] Day 1 earliest activity: ${flightHotelResult.earliestFirstActivityTime}`);
        }
        if (flightHotelResult.latestLastActivityTime) {
          console.log(`[Stage 1.4] Last day latest activity: ${flightHotelResult.latestLastActivityTime}`);
        }
      }
      
      // Build raw preference context (structured data)
      const rawPreferenceContext = buildPreferenceContext(insights, prefs);
      
      // STAGE 1.5: AI-Enrich preferences ("fluffing" layer)
      // Transform raw preferences into rich, detailed AI guidance
      console.log("[Stage 1.5] Enriching preferences with AI...");
      let enrichedPreferenceContext = "";
      if (prefs && Object.values(prefs).some(v => v !== null)) {
        try {
          enrichedPreferenceContext = await enrichPreferencesWithAI(prefs, context.destination, LOVABLE_API_KEY);
          console.log("[Stage 1.5] Preference enrichment complete");
        } catch (enrichError) {
          console.warn("[Stage 1.5] Preference enrichment failed, using raw context:", enrichError);
        }
      }
      
      // Combine all context for maximum personalization
      // Order: Travel DNA (archetype/confidence) → raw prefs → enriched prefs → flight/hotel
      const preferenceContext = travelDNAContext + rawPreferenceContext + enrichedPreferenceContext + flightHotelResult.context;

      // STAGE 2: AI Generation
      let aiResult;
      try {
        aiResult = await generateItineraryAI(context, preferenceContext, LOVABLE_API_KEY);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        const status = message.includes('Rate limit') ? 429 : message.includes('Credits') ? 402 : 500;
        return new Response(
          JSON.stringify({ error: message }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!aiResult?.days?.length) {
        return new Response(
          JSON.stringify({ error: "No itinerary generated" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // STAGE 3: Early Save (Critical - ensures user gets itinerary)
      await earlySaveItinerary(supabase, tripId, aiResult.days);

      // STAGE 4: Enrichment (real photos + venue verification via Google Places API v1)
      let enrichedDays: StrictDay[];
      try {
        enrichedDays = await enrichItinerary(aiResult.days, context.destination, supabaseUrl, supabaseKey, GOOGLE_MAPS_API_KEY);
      } catch (enrichError) {
        console.warn('[generate-itinerary] Enrichment failed, using base itinerary:', enrichError);
        enrichedDays = aiResult.days;
      }

      // STAGE 5: Trip Overview
      const overview = generateTripOverview(enrichedDays, context);

      // Build enrichment metadata
      const totalActivities = enrichedDays.reduce((sum, d) => sum + d.activities.length, 0);
      const photosAdded = enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.photos?.length).length, 0
      );
      const verifiedVenues = enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.verified?.placeId).length, 0
      );
      const geocodedActivities = enrichedDays.reduce(
        (sum, d) => sum + d.activities.filter(a => a.location?.coordinates).length, 0
      );

      const enrichedItinerary: EnrichedItinerary = {
        days: enrichedDays,
        overview,
        enrichmentMetadata: {
          enrichedAt: new Date().toISOString(),
          geocodedActivities,
          verifiedActivities: verifiedVenues,
          photosAdded,
          totalActivities
        }
      };

      // STAGE 6: Final Save
      await finalSaveItinerary(supabase, tripId, enrichedItinerary, context);

      // Return complete response
      return new Response(
        JSON.stringify({
          success: true,
          status: 'ready',
          tripId,
          totalDays: context.totalDays,
          totalActivities,
          itinerary: {
            days: enrichedDays,
            overview
          },
          enrichmentMetadata: enrichedItinerary.enrichmentMetadata
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: generate-day - Single day generation with flight/hotel awareness
    // ==========================================================================
    if (action === 'generate-day') {
      const { tripId, dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities, userId } = params;

      // Get user preferences
      const insights = userId ? await getLearnedPreferences(supabase, userId) : null;
      const userPrefs = userId ? await getUserPreferences(supabase, userId) : null;
      const preferenceContext = buildPreferenceContext(insights, userPrefs);

      // CRITICAL: Fetch flight/hotel context for Day 1 and last day timing
      const flightContext = tripId ? await getFlightHotelContext(supabase, tripId) : { context: '' };
      const isFirstDay = dayNumber === 1;
      const isLastDay = dayNumber === totalDays;
      
      console.log(`[generate-day] Day ${dayNumber}/${totalDays}, isFirst=${isFirstDay}, isLast=${isLastDay}`);
      if (flightContext.arrivalTime) {
        console.log(`[generate-day] Flight arrival: ${flightContext.arrivalTime}, earliest activity: ${flightContext.earliestFirstActivityTime}`);
      }
      if (flightContext.returnDepartureTime) {
        console.log(`[generate-day] Return departure: ${flightContext.returnDepartureTime}, latest activity: ${flightContext.latestLastActivityTime}`);
      }

      // Build day-specific constraints
       let dayConstraints = '';
       if (isFirstDay && (flightContext.arrivalTime24 || flightContext.arrivalTime)) {
         const arrival24 = flightContext.arrivalTime24 || (flightContext.arrivalTime ? normalizeTo24h(flightContext.arrivalTime) : null) || '18:00';
         const arrivalMins = parseTimeToMinutes(arrival24) ?? (18 * 60);
         const transferStart = addMinutesToHHMM(arrival24, 45);
         const transferEnd = addMinutesToHHMM(transferStart, 60);
         const checkInStart = transferEnd;
         const checkInEnd = addMinutesToHHMM(checkInStart, 30);
         const earliestAfterArrival = flightContext.earliestFirstActivityTime || addMinutesToHHMM(arrival24, 240);
         const isLateArrival = arrivalMins >= (18 * 60);

        dayConstraints = `
THE FLIGHT LANDS AT ${arrival24} (that's ${flightContext.arrivalTime || arrival24}).
The traveler is NOT in the destination before this time. They are on a plane.

REQUIRED ACTIVITY SEQUENCE (in this exact order):
1. Activity 1: "Arrival at Airport" 
   - startTime: "${arrival24}", endTime: "${addMinutesToHHMM(arrival24, 30)}"
   - category: "transport"
   - location: { name: "Airport", address: "Rome Fiumicino Airport (FCO)" }
   
2. Activity 2: "Airport Transfer to Hotel"
   - startTime: "${transferStart}", endTime: "${transferEnd}" 
   - category: "transport"
   
3. Activity 3: "Hotel Check-in"
   - startTime: "${checkInStart}", endTime: "${checkInEnd}"
   - category: "accommodation"
   - location: { name: "${flightContext.hotelName || 'Hotel'}", address: "${flightContext.hotelAddress || 'Hotel Address'}" }

${isLateArrival ? `
Since arrival is after 6 PM, Day 1 should ONLY have:
- The 3 activities above (Arrival, Transfer, Check-in)
- OPTIONALLY: One late dinner activity near the hotel (starting around ${addMinutesToHHMM(checkInEnd, 60)})
- NO other activities. The traveler needs rest after a long flight.
` : `
After check-in, the earliest any sightseeing/dining can start is ${earliestAfterArrival}.
`}

DO NOT include any activities that happen BEFORE ${arrival24} - no breakfast, no morning sightseeing.
The day starts when the plane lands, not at 9 AM.`;
       } else if (isLastDay && flightContext.returnDepartureTime) {
         const departure24 = flightContext.returnDepartureTime24 || normalizeTo24h(flightContext.returnDepartureTime) || '12:00';
         const latestActivity = flightContext.latestLastActivityTime || addMinutesToHHMM(departure24, -180);
         
         dayConstraints = `
THE RETURN FLIGHT DEPARTS AT ${departure24} (that's ${flightContext.returnDepartureTime}).
The traveler must be at the airport 3 hours before departure.

REQUIRED ENDING SEQUENCE (activities must end with):
1. "Hotel Checkout" (category: accommodation) - around ${addMinutesToHHMM(departure24, -210)}
2. "Transfer to Airport" (category: transport) 
3. "Departure from Airport" (category: transport) - endTime should be ${departure24}

ALL sightseeing/activities must END by ${latestActivity}.
Plan only morning activities and leave afternoon clear for airport.`;
       }

      // Build system prompt with day-specific timing constraints EMBEDDED
      let timingInstructions = '';
      if (isFirstDay && dayConstraints) {
        // For arrival day, put constraints directly in system prompt for maximum weight
        timingInstructions = `
CRITICAL ARRIVAL DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
      } else if (isLastDay && dayConstraints) {
        timingInstructions = `
CRITICAL DEPARTURE DAY INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
${dayConstraints}

FAILURE TO FOLLOW THESE TIMING RULES IS UNACCEPTABLE.`;
      } else {
        timingInstructions = '- Start around 9:00 AM, end by 9:00-10:00 PM';
      }

      const systemPrompt = `You are an expert travel planner. Generate a single day's detailed itinerary.

${timingInstructions}

General Requirements:
- Include FULL street addresses for all locations
- Provide realistic cost estimates in local currency
- Account for travel time between activities
- Include meals (breakfast, lunch, dinner as appropriate for the time of day)
- Every activity MUST have a "title" field (the display name)
- All times MUST be in 24-hour HH:MM format`;

      const userPrompt = `Generate Day ${dayNumber} of ${totalDays} in ${destination}${destinationCountry ? `, ${destinationCountry}` : ''}.

Date: ${date}
Travelers: ${travelers}
Budget: ${budgetTier || 'standard'}
${preferences?.pace ? `Pace: ${preferences.pace}` : ''}
${preferenceContext}
${previousDayActivities?.length ? `\nAvoid repeating: ${previousDayActivities.join(', ')}` : ''}

Generate activities following the timing constraints specified in the system prompt.`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            tools: [{
              type: "function",
              function: {
                name: "create_day_itinerary",
                description: "Creates a structured day itinerary",
                parameters: {
                  type: "object",
                  properties: {
                    dayNumber: { type: "number" },
                    date: { type: "string" },
                    theme: { type: "string" },
                    title: { type: "string", description: "Day title like 'Arrival Day' or 'Historic Exploration'" },
                    activities: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          title: { type: "string", description: "Activity display name (REQUIRED)" },
                          name: { type: "string", description: "Alias for title" },
                          description: { type: "string" },
                          category: { type: "string", enum: ["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"] },
                          startTime: { type: "string", description: "HH:MM format (24-hour)" },
                          endTime: { type: "string", description: "HH:MM format (24-hour)" },
                          duration: { type: "string" },
                          location: { 
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              address: { type: "string" }
                            }
                          },
                          estimatedCost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } } },
                          cost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } } },
                          bookingRequired: { type: "boolean" },
                          tips: { type: "string" },
                          coordinates: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } },
                          type: { type: "string" }
                        },
                        required: ["title", "category", "startTime", "endTime", "location"]
                      }
                    },
                    narrative: { type: "object", properties: { theme: { type: "string" }, highlights: { type: "array", items: { type: "string" } } } }
                  },
                  required: ["dayNumber", "date", "theme", "activities"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "create_day_itinerary" } },
          }),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error("AI generation failed");
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall?.function?.arguments) {
          throw new Error("Invalid AI response format");
        }

        const generatedDay = JSON.parse(toolCall.function.arguments);

        // Normalize activities: ensure title exists, add IDs and enhancements
        generatedDay.activities = generatedDay.activities.map((act: { 
          id?: string; 
          title?: string; 
          name?: string; 
          startTime?: string; 
          endTime?: string; 
          category?: string;
          estimatedCost?: { amount: number; currency: string };
          cost?: { amount: number; currency: string };
          location?: string | { name?: string; address?: string };
        }, idx: number) => {
          // Normalize title: use title, fallback to name
          const normalizedTitle = act.title || act.name || `Activity ${idx + 1}`;
          
          // Normalize cost: use cost or estimatedCost
          const normalizedCost = act.cost || act.estimatedCost || { amount: 0, currency: 'USD' };
          
          // Normalize location: convert string to object if needed
          let normalizedLocation = act.location;
          if (typeof act.location === 'string') {
            normalizedLocation = { name: act.location, address: act.location };
          }
          
          return {
            ...act,
            id: act.id || `day${dayNumber}-act${idx + 1}-${Date.now()}`,
            title: normalizedTitle,
            name: normalizedTitle, // Keep both for compatibility
            cost: normalizedCost,
            location: normalizedLocation,
            durationMinutes: act.startTime && act.endTime ? calculateDuration(act.startTime, act.endTime) : 60,
            categoryIcon: getCategoryIcon(act.category || 'activity')
          };
        });

        // Ensure day has a title
        generatedDay.title = generatedDay.title || generatedDay.theme || `Day ${dayNumber}`;

        return new Response(
          JSON.stringify({
            success: true,
            day: generatedDay,
            dayNumber,
            totalDays,
            usedPersonalization: !!preferenceContext,
            flightAware: !!(flightContext.arrivalTime || flightContext.returnDepartureTime)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("[generate-day] Error:", error);
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==========================================================================
    // ACTION: get-trip (with ownership verification)
    // ==========================================================================
    if (action === 'get-trip') {
      const { tripId } = params;
      
      // Use authenticated client to enforce RLS, or verify ownership with service role
      const { data: trip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership - user must be the trip owner or a collaborator
      const isOwner = trip.user_id === authResult.userId;
      
      // Check if user is a collaborator via direct query
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const isCollaborator = !!collab;
      
      if (!isOwner && !isCollaborator) {
        console.error(`[get-trip] Unauthorized access attempt by ${authResult.userId} for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Trip not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          trip: {
            tripId: trip.id,
            destination: trip.destination,
            destinationCountry: trip.destination_country,
            startDate: trip.start_date,
            endDate: trip.end_date,
            travelers: trip.travelers || 1,
            tripType: trip.trip_type,
            budgetTier: trip.budget_tier
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: save-itinerary (with ownership verification)
    // ==========================================================================
    if (action === 'save-itinerary') {
      const { tripId, itinerary } = params;

      // First verify the user has access to this trip
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('user_id')
        .eq('id', tripId)
        .single();

      if (tripError || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership or edit permission
      const isOwner = trip.user_id === authResult.userId;
      
      // Check if user is a collaborator with edit permission
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('id, permission')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const hasEditPermission = collab && (collab.permission === 'edit' || collab.permission === 'admin');
      
      if (!isOwner && !hasEditPermission) {
        console.error(`[save-itinerary] Unauthorized save attempt by ${authResult.userId} for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Access denied. You don't have permission to modify this trip." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from('trips')
        .update({
          itinerary_data: itinerary,
          itinerary_status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId);

      if (error) {
        console.error("[save-itinerary] Failed:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save itinerary" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================================================
    // ACTION: get-itinerary (with ownership verification)
    // ==========================================================================
    if (action === 'get-itinerary') {
      const { tripId } = params;

      const { data: trip, error } = await supabase
        .from('trips')
        .select('id, user_id, destination, destination_country, start_date, end_date, travelers, itinerary_data, itinerary_status')
        .eq('id', tripId)
        .single();

      if (error || !trip) {
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership or collaboration
      const isOwner = trip.user_id === authResult.userId;
      
      // Check if user is a collaborator
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', authResult.userId)
        .not('accepted_at', 'is', null)
        .maybeSingle();
      
      const isCollaborator = !!collab;
      
      if (!isOwner && !isCollaborator) {
        console.error(`[get-itinerary] Unauthorized access attempt by ${authResult.userId} for trip ${tripId}`);
        return new Response(
          JSON.stringify({ error: "Trip not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!trip.itinerary_data) {
        return new Response(
          JSON.stringify({
            success: true,
            status: trip.itinerary_status || 'not_started',
            itinerary: null
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: trip.itinerary_status || 'ready',
          tripId: trip.id,
          destination: trip.destination,
          ...trip.itinerary_data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-itinerary] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
