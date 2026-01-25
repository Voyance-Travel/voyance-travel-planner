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

  return {
    id: activity.id,
    title: activity.name,
    description: activity.description,
    time: activity.startTime,
    duration: activity.duration,
    type: typeMap[activity.category] || 'activity',
    cost: activity.estimatedCost?.amount || 0,
    location: {
      name: activity.venue?.name || activity.location,
      address: activity.location,
      coordinates: activity.coordinates,
    },
    rating: activity.venue?.rating,
    tags: [],
    // Preserve explicit lock state from backend; fall back to legacy fields if present.
    isLocked: activity.isLocked ?? activity.savedByUser ?? false,
    photos: activity.photos,
    bookingRequired: activity.bookingRequired,
    tips: activity.tips,
    walkingDistance: activity.walkingDistance,
    walkingTime: activity.walkingTime,
  };
}

/**
 * Convert backend day to frontend-friendly format
 */
export function convertBackendDay(day: BackendDay): DayItinerary {
  const activities = day.activities.map(convertBackendActivity);
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
