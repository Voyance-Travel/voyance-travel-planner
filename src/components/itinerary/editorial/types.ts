// Shared itinerary display types — extracted from EditorialItinerary.tsx.
import type { ActivityType } from '@/types/itinerary';
import type { BookingItemState, TravelerInfo } from '@/services/bookingStateMachine';
import type { ContextualTip } from '../ContextualTipsPopover';
import type { SelectedTransfer } from '../AirportHotelTransfer';

export interface EditorialActivity {
  id: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  time?: string; // For backward compatibility
  duration?: string;
  durationMinutes?: number;
  category?: string;
  type?: ActivityType;
  cost?: { amount: number; currency: string };
  estimatedCost?: { amount: number; currency: string }; // Fallback from AI generation
  location?: { name?: string; address?: string; lat?: number; lng?: number };
  rating?: { value: number; totalReviews: number } | number;
  tags?: string[];
  bookingRequired?: boolean;
  tips?: string;
  photos?: Array<{ url: string } | string>;
  transportation?: {
    method: string;
    duration: string;
    distance?: string;
    estimatedCost?: { amount: number; currency: string };
    instructions?: string;
  };
  timeBlockType?: string;
  isLocked?: boolean;
  website?: string;
  bookingUrl?: string; // External booking URL for affiliate links
  viatorProductCode?: string; // Viator product code for API bookings
  // Booking state fields
  bookingState?: BookingItemState;
  quotePriceCents?: number;
  quoteExpiresAt?: string;
  quoteLocked?: boolean;
  confirmationNumber?: string;
  voucherUrl?: string;
  voucherData?: {
    voucherCode?: string;
    voucherUrl?: string;
    qrCode?: string;
    redemptionInstructions?: string;
  };
  cancellationPolicy?: {
    deadline: string;
    refundPercentage: number;
    description: string;
  };
  travelerData?: TravelerInfo[];
  vendorName?: string;
  bookedAt?: string;
  cancelledAt?: string;
  /** User ID of the collaborator this activity was suggested for (group trips) */
  suggestedFor?: string;
  /** Founder-curated Voyance Pick */
  isVoyancePick?: boolean;
  /** Option group fields for parsed either/or activities */
  isOption?: boolean;
  optionGroup?: string;
  // Intelligence fields from AI generation
  isHiddenGem?: boolean;
  hasTimingHack?: boolean;
  bestTime?: string;
  crowdLevel?: string;
  voyanceInsight?: string;
  contextualTips?: ContextualTip[];
  personalization?: {
    whyThisFits?: string;
    tags?: string[];
    confidence?: number;
  };
  /** Placeholder activity that needs a real recommendation */
  needsRefinement?: boolean;
  /** Saved AI concierge notes */
  aiNotes?: import('../ActivityConciergeSheet').AISavedNote[];
}

export interface TransportOption {
  id: string;
  mode: 'train' | 'flight' | 'bus' | 'car' | 'ferry';
  operator: string;
  emoji?: string;
  inTransitDuration: string;
  doorToDoorDuration: string;
  cost: {
    perPerson: number;
    total: number;
    currency: string;
    includesTransfers?: boolean;
  };
  departure: { point: string; neighborhood?: string };
  arrival: { point: string; neighborhood?: string };
  pros: string[];
  cons: string[];
  bookingTip?: string;
  bookingUrl?: string;
  bookingWebsite?: string;
  scenicOpportunities?: string[];
  isRecommended: boolean;
  recommendationReason?: string;
}

export interface EditorialDay {
  dayNumber: number;
  date?: string;
  title?: string;
  theme?: string;
  description?: string;
  activities: EditorialActivity[];
  weather?: {
    condition?: string;
    high?: number;
    low?: number;
  };
  estimatedWalkingTime?: string;
  estimatedDistance?: string;
  metadata?: {
    isPreview?: boolean;
    isLocked?: boolean;
    [key: string]: unknown;
  };
  // Multi-city / transition day fields
  city?: string;
  country?: string;
  isTransitionDay?: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  transportComparison?: TransportOption[];
  selectedTransportId?: string;
  // Departure day fields
  isDepartureDay?: boolean;
  departureTo?: string;
  departureTransportType?: string;
  departureTransportDetails?: Record<string, unknown>;
}

export interface FlightLegDisplay {
  airline?: string;
  airlineCode?: string;
  flightNumber?: string;
  departure?: { time?: string; airport?: string; date?: string };
  arrival?: { time?: string; airport?: string; date?: string };
  price?: number;
  cabinClass?: string;
  seat?: string;
  duration?: string;
  confirmationCode?: string;
  terminal?: string;
  gate?: string;
  baggageInfo?: string;
  boardingPassUrl?: string;
  frequentFlyerNumber?: string;
  isDestinationArrival?: boolean;
  isDestinationDeparture?: boolean;
}

export interface FlightSelection {
  outbound?: FlightLegDisplay;
  return?: FlightLegDisplay;
  /** All legs for multi-city trips — preferred over outbound/return when present */
  legs?: FlightLegDisplay[];
}

export interface HotelSelection {
  id?: string;
  name?: string;
  address?: string;
  rating?: number;
  pricePerNight?: number;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  imageUrl?: string;
  images?: string[];
  amenities?: string[];
  type?: string;
  reviewCount?: number;
  neighborhood?: string;
  description?: string;
  website?: string;
  googleMapsUrl?: string;
  totalPrice?: number;
}

/** Per-city hotel info for multi-city trips */
export interface CityHotelInfo {
  cityName: string;
  cityOrder: number;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  hotel?: HotelSelection | null;
  cityId?: string; // trip_cities row id for hotel search targeting
  // Inter-city transport info
  transportType?: 'flight' | 'train' | 'bus' | 'car' | 'ferry';
  transportDetails?: {
    carrier?: string;
    flightNumber?: string;
    departureTime?: string;
    arrivalTime?: string;
    bookingRef?: string;
    seatClass?: string;
    duration?: string;
    notes?: string;
  };
  transportCostCents?: number;
  transportCurrency?: string;
  // Airport-hotel transfer selections
  arrivalTransfer?: SelectedTransfer | null;
  departureTransfer?: SelectedTransfer | null;
}
