// ============================================================================
// ITINERARY TYPES - Aligned with backend itinerary.ts
// ============================================================================

// Backend-aligned activity types
export type BackendActivityCategory = 
  | 'sightseeing' 
  | 'dining' 
  | 'cultural' 
  | 'adventure' 
  | 'relaxation' 
  | 'shopping' 
  | 'transportation' 
  | 'accommodation';

// Frontend-friendly activity types for sample itineraries
export type ActivityType = 
  | 'transportation' 
  | 'accommodation' 
  | 'dining' 
  | 'cultural' 
  | 'activity' 
  | 'relaxation' 
  | 'shopping';

export type WeatherCondition = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy';

export type TripStyle = 'budget' | 'moderate' | 'luxury';
export type TripPace = 'relaxed' | 'moderate' | 'packed';

export interface ActivityLocation {
  name: string;
  address: string;
  coordinates?: { lat: number; lng: number };
}

// Sample itinerary activity (frontend-friendly)
export interface ItineraryActivity {
  id: string;
  title: string;
  description: string;
  time: string;
  duration: string;
  type: ActivityType;
  cost: number;
  location: ActivityLocation;
  rating?: number;
  tags: string[];
  isLocked: boolean;
  // Optional backend-aligned fields
  photos?: string[];
  bookingRequired?: boolean;
  tips?: string;
  walkingDistance?: number;
  walkingTime?: number;
  aiNotes?: Array<{ id: string; content: string; savedAt: string; query?: string }>;
}

// Backend activity type (from itineraryAPI.ts)
export interface BackendActivity {
  id: string;
  name: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  duration: string;
  location: string;
  estimatedCost: { amount: number; currency: string };
  bookingRequired: boolean;
  tips?: string;
  coordinates?: { lat: number; lng: number };
  photos?: string[];
  walkingDistance?: number;
  walkingTime?: number;
  /**
   * Whether the activity is locked in the itinerary (should be preserved during regeneration).
   * This is persisted in itinerary_data and returned by backend functions.
   */
  isLocked?: boolean;
  venue?: {
    name: string;
    type?: string;
    cuisine?: string[];
    priceRange?: string;
    rating?: number;
    reviewCount?: number;
  };
  savedByUser?: boolean;
  savedByCount?: number;
  aiNotes?: Array<{ id: string; content: string; savedAt: string; query?: string }>;
}

export interface DayWeather {
  high: number;
  low: number;
  condition: WeatherCondition;
  description: string;
  rainChance?: number;
  humidity?: number;
}

// Sample day itinerary (frontend-friendly)
export interface DayItinerary {
  date: string;
  dayNumber: number;
  theme: string;
  description: string;
  weather: DayWeather;
  activities: ItineraryActivity[];
  totalCost: number;
  estimatedWalkingTime: string;
  estimatedDistance: string;
}

// Backend day type
export interface BackendDay {
  dayNumber: number;
  date?: string;
  theme?: string;
  activities: BackendActivity[];
  meals?: {
    breakfast?: { name: string; location: string; estimatedCost: { amount: number; currency: string } };
    lunch?: { name: string; location: string; estimatedCost: { amount: number; currency: string } };
    dinner?: { name: string; location: string; estimatedCost: { amount: number; currency: string } };
  };
  weather?: {
    temperature: { high: number; low: number };
    conditions: string;
    rainChance: number;
  };
  paceScore?: 'relaxed' | 'moderate' | 'packed';
  totalWalkingDistance?: number;
}

export interface TripSummary {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  totalCost: number;
  style: TripStyle;
  pace: TripPace;
  flightCost?: number;
  hotelCost?: number;
  dailyCosts?: number;
}

export interface DestinationInfo {
  overview: string;
  culturalNotes: string;
  bestTime: string;
  currency: string;
  language: string;
  tips: string;
}

export interface FlightSegment {
  airline: string;
  flightNumber: string;
  departure: {
    airport: string;
    city: string;
    time: string;
    date: string;
    terminal: string;
  };
  arrival: {
    airport: string;
    city: string;
    time: string;
    date: string;
    terminal: string;
  };
  duration: string;
  stops: string;
  seats: string[];
  class: string;
}

export interface FlightInfo {
  outbound: FlightSegment;
  return: FlightSegment;
  /** All legs for multi-city trips — preferred over outbound/return when present */
  legs?: FlightSegment[];
}

export interface HotelReview {
  author: string;
  date: string;
  rating: number;
  comment: string;
}

export interface HotelInfo {
  name: string;
  type: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: string;
  amenities: string[];
  rating: number;
  reviewCount: number;
  address: string;
  distanceFromAirport: string;
  images: string[];
  recentReviews: HotelReview[];
}

export interface SampleItineraryData {
  destination: string;
  style: TripStyle;
  pace: TripPace;
  flightCost: number;
  hotelCost: number;
  flightInfo: FlightInfo;
  hotelInfo: HotelInfo;
  destinationInfo: DestinationInfo;
  days: DayItinerary[];
}

// ============================================================================
// TYPE CONVERSION UTILITIES
// ============================================================================

/**
 * Convert backend activity to frontend-friendly format
 */
export function convertBackendActivity(activity: BackendActivity): ItineraryActivity {
  const typeMap: Record<string, ActivityType> = {
    sightseeing: 'activity',
    dining: 'dining',
    cultural: 'cultural',
    adventure: 'activity',
    relaxation: 'relaxation',
    shopping: 'shopping',
    transportation: 'transportation',
    accommodation: 'accommodation',
  };

  // Handle location being either a string or an object (from restaurant swaps)
  let locationObj: ActivityLocation;
  if (typeof activity.location === 'string') {
    locationObj = {
      name: activity.venue?.name || activity.location,
      address: activity.location,
      coordinates: activity.coordinates,
    };
  } else if (activity.location && typeof activity.location === 'object') {
    // Location is already an object (e.g., from restaurant swap)
    const loc = activity.location as { name?: string; address?: string; coordinates?: { lat: number; lng: number } };
    locationObj = {
      name: loc.name || '',
      address: loc.address || '',
      coordinates: loc.coordinates || activity.coordinates,
    };
  } else {
    locationObj = {
      name: activity.venue?.name || '',
      address: '',
      coordinates: activity.coordinates,
    };
  }

  return {
    id: activity.id,
    title: activity.name,
    description: activity.description,
    time: activity.startTime,
    duration: activity.duration,
    type: typeMap[activity.category] || 'activity',
    cost: activity.estimatedCost?.amount || 0,
    location: locationObj,
    rating: activity.venue?.rating,
    tags: [],
    // Preserve explicit lock state from backend; fall back to legacy fields if present.
    isLocked: activity.isLocked ?? activity.savedByUser ?? false,
    photos: activity.photos,
    bookingRequired: activity.bookingRequired,
    tips: activity.tips,
    walkingDistance: activity.walkingDistance,
    walkingTime: activity.walkingTime,
    aiNotes: activity.aiNotes,
  };
}

/**
 * Parse time string (e.g., "9:00 AM", "14:30") to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  
  const normalized = timeStr.trim().toUpperCase();
  
  // Handle 12-hour format (e.g., "9:00 AM", "2:30 PM")
  const match12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3];
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }
  
  // Handle 24-hour format (e.g., "14:30")
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  
  return 0;
}

/**
 * Convert backend day to frontend-friendly format
 */
export function convertBackendDay(day: BackendDay): DayItinerary {
  const activities = day.activities.map(convertBackendActivity);
  
  // Sort activities chronologically by time
  activities.sort((a, b) => {
    const aMinutes = parseTimeToMinutes(a.time);
    const bMinutes = parseTimeToMinutes(b.time);
    return aMinutes - bMinutes;
  });
  
  const totalCost = activities.reduce((sum, a) => sum + a.cost, 0);

  const conditionMap: Record<string, WeatherCondition> = {
    sunny: 'sunny',
    clear: 'sunny',
    'partly cloudy': 'partly-cloudy',
    cloudy: 'cloudy',
    rain: 'rainy',
    snow: 'snowy',
  };

  return {
    date: day.date || new Date().toISOString(),
    dayNumber: day.dayNumber,
    theme: day.theme || `Day ${day.dayNumber}`,
    description: '',
    weather: {
      high: day.weather?.temperature?.high || 70,
      low: day.weather?.temperature?.low || 55,
      condition: conditionMap[day.weather?.conditions?.toLowerCase() || 'sunny'] || 'sunny',
      description: day.weather?.conditions || 'Pleasant weather',
      rainChance: day.weather?.rainChance,
    },
    activities,
    totalCost,
    estimatedWalkingTime: day.totalWalkingDistance 
      ? `${Math.round(day.totalWalkingDistance / 80)} minutes` 
      : '1 hour',
    estimatedDistance: day.totalWalkingDistance 
      ? `${(day.totalWalkingDistance / 1609).toFixed(1)} miles`
      : '2 miles',
  };
}

/**
 * Convert frontend activity back to backend format (for saving/regenerating)
 * CRITICAL: This preserves isLocked for lock persistence
 */
export function convertFrontendActivityToBackend(activity: ItineraryActivity): BackendActivity {
  const categoryMap: Record<ActivityType, string> = {
    activity: 'sightseeing',
    dining: 'dining',
    cultural: 'cultural',
    relaxation: 'relaxation',
    shopping: 'shopping',
    transportation: 'transportation',
    accommodation: 'accommodation',
  };

  return {
    id: activity.id,
    name: activity.title,
    description: activity.description,
    category: categoryMap[activity.type] || 'sightseeing',
    startTime: activity.time, // Frontend uses 'time' for startTime
    endTime: '', // Will be calculated or empty
    duration: activity.duration,
    location: activity.location?.address || activity.location?.name || '',
    estimatedCost: { amount: activity.cost, currency: 'USD' },
    bookingRequired: activity.bookingRequired || false,
    tips: activity.tips,
    coordinates: activity.location?.coordinates,
    photos: activity.photos,
    walkingDistance: activity.walkingDistance,
    walkingTime: activity.walkingTime,
    isLocked: activity.isLocked, // CRITICAL: Preserve lock state
    venue: activity.location?.name ? { name: activity.location.name } : undefined,
  };
}

/**
 * Convert frontend day back to backend format (for saving)
 * CRITICAL: This preserves isLocked for lock persistence
 */
export function convertFrontendDayToBackend(day: DayItinerary): BackendDay {
  return {
    dayNumber: day.dayNumber,
    date: day.date,
    theme: day.theme,
    activities: day.activities.map(convertFrontendActivityToBackend),
    weather: day.weather ? {
      temperature: { high: day.weather.high, low: day.weather.low },
      conditions: day.weather.description,
      rainChance: day.weather.rainChance || 0,
    } : undefined,
    totalWalkingDistance: day.estimatedDistance 
      ? parseFloat(day.estimatedDistance) * 1609 
      : undefined,
  };
}
