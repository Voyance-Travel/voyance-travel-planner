/**
 * Trip-related type definitions
 */

export interface TripActivity {
  id: string;
  name: string;
  description?: string;
  type: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  duration?: number; // in minutes
  location?: {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  price?: number;
  currency?: string;
  imageUrl?: string;
  notes?: string;
  isLocked?: boolean;
  bookingRequired?: boolean;
  bookingUrl?: string;
  reservationMade?: boolean;
  confirmationNumber?: string;
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  activities: TripActivity[];
  weather?: {
    high: number;
    low: number;
    condition: string;
    icon: string;
  };
}

export interface Trip {
  id: string;
  userId?: string;
  name: string;
  destination: string;
  destinationId?: string;
  departureCity?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: TripStatus;
  budget?: number;
  currency: string;
  travelers: number;
  travelStyle?: string;
  interests?: string[];
  itinerary?: ItineraryDay[];
  flight?: FlightSelection;
  hotel?: HotelSelection;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = 
  | "draft" 
  | "planning" 
  | "booked" 
  | "completed" 
  | "cancelled";

export interface FlightSelection {
  id?: string;
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  price?: number;
  currency?: string;
  class?: string;
  returnFlight?: {
    flightNumber?: string;
    departureTime?: string;
    arrivalTime?: string;
  };
}

export interface HotelSelection {
  id?: string;
  name?: string;
  address?: string;
  starRating?: number;
  pricePerNight?: number;
  totalPrice?: number;
  currency?: string;
  roomType?: string;
  amenities?: string[];
  imageUrl?: string;
  checkIn?: string;
  checkOut?: string;
}

export interface TripSummary {
  id: string;
  name: string;
  destination: string;
  departureCity?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: TripStatus;
  budget?: number;
  currency: string;
  travelers: number;
  createdAt: string;
  updatedAt: string;
}
