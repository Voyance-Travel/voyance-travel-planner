/**
 * Trip City Types
 * Types for per-city tracking in multi-city trips
 */

export type TransportType = 'flight' | 'train' | 'bus' | 'car' | 'ferry';
export type CityGenerationStatus = 'pending' | 'generating' | 'generated' | 'failed';
export type TransitionDayMode = 'half_and_half' | 'skip';

export interface TransportDetails {
  carrier?: string;
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  bookingRef?: string;
  seatClass?: string;
  duration?: string;
  notes?: string;
  // Station / airport / terminal info
  departureStation?: string;
  arrivalStation?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  // Extra details
  seatNumber?: string;
  costPerPerson?: number;
  totalCost?: number;
  currency?: string;
  // Car rental specific
  rentalCompany?: string;
  carClass?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  costPerDay?: number;
  // Ferry specific
  cabinType?: string;
  // General
  fromCity?: string;
  toCity?: string;
}

export interface TripCity {
  id: string;
  trip_id: string;
  city_order: number;
  city_name: string;
  country?: string;
  destination_id?: string;
  slug?: string;

  // Dates
  arrival_date?: string;
  departure_date?: string;
  nights?: number;

  // Hotel
  hotel_selection?: Record<string, unknown>;
  hotel_cost_cents: number;

  // Transport to this city
  transport_type?: TransportType;
  transport_details?: TransportDetails;
  transport_cost_cents: number;
  transport_currency: string;
  transition_day_mode: TransitionDayMode | null;

  // Generation status
  generation_status: CityGenerationStatus;
  days_generated: number;
  days_total: number;
  itinerary_data?: Record<string, unknown>;

  // Budget
  activity_cost_cents: number;
  dining_cost_cents: number;
  misc_cost_cents: number;
  total_cost_cents: number; // computed column

  created_at: string;
  updated_at: string;
}

export interface TripCityInsert {
  trip_id: string;
  city_order: number;
  city_name: string;
  country?: string;
  destination_id?: string;
  slug?: string;
  arrival_date?: string;
  departure_date?: string;
  nights?: number;
  hotel_selection?: Record<string, unknown>;
  hotel_cost_cents?: number;
  transport_type?: TransportType;
  transport_details?: TransportDetails;
  transport_cost_cents?: number;
  transport_currency?: string;
  transition_day_mode?: TransitionDayMode;
  generation_status?: CityGenerationStatus;
  days_generated?: number;
  days_total?: number;
  itinerary_data?: Record<string, unknown>;
  activity_cost_cents?: number;
  dining_cost_cents?: number;
  misc_cost_cents?: number;
}

export interface TripCityUpdate extends Partial<Omit<TripCityInsert, 'trip_id'>> {}

export interface TripCityBudgetSummary {
  cityName: string;
  hotelCents: number;
  transportCents: number;
  activityCents: number;
  diningCents: number;
  miscCents: number;
  totalCents: number;
}
