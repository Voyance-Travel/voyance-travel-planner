// ============================================================================
// ITINERARY TYPES - Comprehensive types for sample and real itineraries
// ============================================================================

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
}

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
}

export interface DayWeather {
  high: number;
  low: number;
  condition: WeatherCondition;
  description: string;
}

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
