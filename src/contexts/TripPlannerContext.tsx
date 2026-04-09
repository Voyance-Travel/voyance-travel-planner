import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getLocalToday } from '@/utils/dateUtils';

// Anonymous session management
const ANON_SESSION_KEY = 'voyance_anonymous_session';
const LOCAL_TRIPS_KEY = 'voyance_local_trips';

function getOrCreateAnonymousSession(): string {
  let sessionId = localStorage.getItem(ANON_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(ANON_SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Local localStorage trip storage for anonymous users
function saveLocalTrip(tripData: Record<string, unknown>): string {
  const tripId = tripData.id as string || crypto.randomUUID();
  const trips = JSON.parse(localStorage.getItem(LOCAL_TRIPS_KEY) || '{}');
  trips[tripId] = { ...tripData, id: tripId };
  localStorage.setItem(LOCAL_TRIPS_KEY, JSON.stringify(trips));
  console.log('[TripPlanner] Local trip saved to localStorage:', tripId);
  return tripId;
}

function loadLocalTrip(tripId: string): Record<string, unknown> | null {
  const trips = JSON.parse(localStorage.getItem(LOCAL_TRIPS_KEY) || '{}');
  return trips[tripId] || null;
}

export type TransportMode = 'rental_car' | 'public_transit' | 'rideshare' | 'walking';

export interface TransportationPreference {
  modes: TransportMode[];
  primaryMode?: TransportMode;
  notes?: string;
}

export interface RentalCarDetails {
  rentalCompany?: string;
  carType?: string;
  pickupLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  dropoffLocation?: string;
  dropoffDate?: string;
  dropoffTime?: string;
  dailyRate?: number;
  totalCost?: number;
  currency?: string;
  confirmationNumber?: string;
  bookingUrl?: string;
  insuranceIncluded?: boolean;
  notes?: string;
}

import type { TripDestination, InterCityTransport } from '@/types/multiCity';

export interface TripBasics {
  destination?: string;
  destinationId?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  childrenCount?: number; // Number of children in the travel party
  tripType?: 'solo' | 'couple' | 'family' | 'group';
  originCity?: string;
  budgetTier?: string;
  budgetAmount?: number; // Optional: actual dollar amount user wants to spend
  transportationPreference?: TransportationPreference;
  rentalCar?: RentalCarDetails;
  // Multi-city support
  isMultiCity?: boolean;
  destinations?: TripDestination[];
  interCityTransports?: InterCityTransport[];
  // User-specified activities from chat extraction
  mustDoActivities?: string;
  perDayActivities?: Array<{ dayNumber: number; activities: string }>;
}

export interface FlightSelection {
  id?: string;
  departure?: {
    airline: string;
    flightNumber: string;
    departureTime: string;
    arrivalTime: string;
    cabin: string;
    price: number;
  };
  return?: {
    airline: string;
    flightNumber: string;
    departureTime: string;
    arrivalTime: string;
    cabin: string;
    price: number;
  };
}

export interface HotelSelection {
  id: string;
  name: string;
  location: string;
  address?: string;
  neighborhood?: string;
  rating: number;
  pricePerNight: number;
  roomType: string;
  amenities: string[];
  imageUrl?: string;
  images?: string[];
  website?: string;
  googleMapsUrl?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  reviewCount?: number;
  description?: string;
  placeId?: string;
}

export interface Activity {
  id: string;
  name: string;
  description?: string;
  time?: string;
  duration?: number;
  location?: string;
  category?: string;
  price?: number;
  isLocked?: boolean;
}

export interface DayItinerary {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

export interface TripPlannerState {
  tripId: string | null;
  sessionId: string;
  step: number;
  basics: TripBasics;
  flights: FlightSelection | null;
  hotel: HotelSelection | null;
  itinerary: DayItinerary[];
  totalPrice: number;
  isLoading: boolean;
  error: string | null;
}

interface TripPlannerContextType {
  state: TripPlannerState;
  setStep: (step: number) => void;
  setBasics: (basics: Partial<TripBasics>) => void;
  setFlight: (flight: FlightSelection | null) => void;
  setFlights: (flights: FlightSelection | null) => void;
  setHotel: (hotel: HotelSelection | null) => void;
  setItinerary: (itinerary: DayItinerary[]) => void;
  saveTrip: () => Promise<string | null>;
  loadTrip: (tripId: string) => Promise<void>;
  resetTrip: () => void;
  calculateTotalPrice: () => number;
}

const initialState: TripPlannerState = {
  tripId: null,
  sessionId: getOrCreateAnonymousSession(),
  step: 1,
  basics: {},
  flights: null,
  hotel: null,
  itinerary: [],
  totalPrice: 0,
  isLoading: false,
  error: null,
};

const TripPlannerContext = createContext<TripPlannerContextType | undefined>(undefined);

export function TripPlannerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { plans } = useEntitlements();
  const [state, setState] = useState<TripPlannerState>(initialState);
  
  // CRITICAL: Synchronous ref guard to prevent race condition on saveTrip
  // React state updates are async, so multiple rapid clicks can read tripId as null
  // before the first INSERT completes. This ref blocks concurrent saves immediately.
  const savingInProgressRef = useRef(false);

  // Calculate total price
  const calculateTotalPrice = useCallback(() => {
    let total = 0;
    
    if (state.flights?.departure?.price) {
      total += state.flights.departure.price;
    }
    if (state.flights?.return?.price) {
      total += state.flights.return.price;
    }
    
    if (state.hotel?.pricePerNight && state.basics.startDate && state.basics.endDate) {
      const nights = Math.ceil(
        (new Date(state.basics.endDate).getTime() - new Date(state.basics.startDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      total += state.hotel.pricePerNight * nights;
    }
    
    return total;
  }, [state.flights, state.hotel, state.basics]);

  // Update total price when selections change
  useEffect(() => {
    const newTotal = calculateTotalPrice();
    if (newTotal !== state.totalPrice) {
      setState(prev => ({ ...prev, totalPrice: newTotal }));
    }
  }, [calculateTotalPrice, state.totalPrice]);

  const setStep = (step: number) => {
    setState(prev => ({ ...prev, step }));
  };

  const setBasics = (basics: Partial<TripBasics>) => {
    setState(prev => ({ 
      ...prev, 
      basics: { ...prev.basics, ...basics } 
    }));
  };

  const setFlight = (flight: FlightSelection | null) => {
    setState(prev => ({ ...prev, flights: flight }));
  };

  const setFlights = (flights: FlightSelection | null) => {
    setState(prev => ({ ...prev, flights }));
  };

  const setHotel = (hotel: HotelSelection | null) => {
    setState(prev => ({ ...prev, hotel }));
  };

  const setItinerary = (itinerary: DayItinerary[]) => {
    setState(prev => ({ ...prev, itinerary }));
  };

  const saveTrip = async (): Promise<string | null> => {
    // CRITICAL: Prevent race condition with synchronous ref check
    // This blocks concurrent calls immediately (before any async operation)
    if (savingInProgressRef.current) {
      console.warn('[TripPlanner] Save already in progress, returning existing tripId:', state.tripId);
      return state.tripId;
    }
    savingInProgressRef.current = true;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tripName = state.basics.destination ? `Trip to ${state.basics.destination}` : 'New Trip';

      // Determine owner's plan tier (free if not authenticated or no plan data)
      const ownerPlanTier = plans?.[0] || 'free';

      // Determine trip status based on selections
      const hasFlightAndHotel = state.flights && state.hotel;
      const tripStatus = hasFlightAndHotel ? 'booked' : 'draft';

      const baseTripData: Record<string, unknown> = {
        name: tripName,
        destination: state.basics.destination || 'Unknown',
        destination_country: null,
        start_date: state.basics.startDate || getLocalToday(),
        end_date: state.basics.endDate || getLocalToday(),
        trip_type: state.basics.tripType || 'vacation',
        travelers: state.basics.travelers || 1,
        origin_city: state.basics.originCity,
        budget_tier: state.basics.budgetTier || 'moderate',
        owner_plan_tier: ownerPlanTier, // Track owner's plan for collaboration rules
        status: tripStatus,
        flight_selection: state.flights ? JSON.parse(JSON.stringify(state.flights)) : null,
        hotel_selection: state.hotel ? JSON.parse(JSON.stringify(state.hotel)) : null,
        itinerary_data: state.itinerary.length > 0 ? JSON.parse(JSON.stringify({ days: state.itinerary })) : null,
        transportation_preferences: state.basics.transportationPreference ? JSON.parse(JSON.stringify(state.basics.transportationPreference)) : null,
        metadata: JSON.parse(
          JSON.stringify({
            sessionId: state.sessionId,
            lastUpdated: new Date().toISOString(),
            anonymous: !user,
            rentalCar: state.basics.rentalCar || null,
            mustDoActivities: state.basics.mustDoActivities || '',
            perDayActivities: state.basics.perDayActivities || [],
          })
        ),
      };

      let tripId = state.tripId;

      // Anonymous user: save to localStorage so the flow can continue
      if (!user) {
        const localTripData: Record<string, unknown> = {
          ...baseTripData,
          // localStorage needs an id; backend generates it, but local does not
          id: tripId || undefined,
          user_id: null,
        };

        tripId = saveLocalTrip(localTripData);
        setState(prev => ({
          ...prev,
          tripId,
          isLoading: false,
        }));
        console.log('[TripPlanner] Local trip saved:', tripId);
        return tripId;
      }

      // Backend save for authenticated user
      const tripPayload: Record<string, unknown> = {
        ...baseTripData,
        user_id: user.id,
      };

      if (tripId) {
        const { error } = await supabase
          .from('trips')
          .update(tripPayload as any)
          .eq('id', tripId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // CRITICAL: Double-check database for existing trip before INSERT
        // This prevents duplicates if state.tripId hasn't been set yet
        const { data: existingTrip } = await supabase
          .from('trips')
          .select('id')
          .eq('user_id', user.id)
          .eq('destination', state.basics.destination || 'Unknown')
          .eq('start_date', state.basics.startDate || getLocalToday())
          .eq('end_date', state.basics.endDate || getLocalToday())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingTrip?.id) {
          console.log('[TripPlanner] Found existing trip, updating instead of creating:', existingTrip.id);
          tripId = existingTrip.id;
          // Update the existing trip instead of creating a new one
          const { error } = await supabase
            .from('trips')
            .update(tripPayload as any)
            .eq('id', tripId)
            .eq('user_id', user.id);

          if (error) throw error;
        } else {
          // IMPORTANT: Do not send an "id" column on insert (backend generates it)
          const { data, error } = await supabase
            .from('trips')
            .insert([tripPayload as any])
            .select('id')
            .maybeSingle();

          if (error) throw error;
          if (!data?.id) throw new Error('Failed to create trip');
          tripId = data.id;
        }
      }

      // Save trip occasion as a trip_intent for AI personalization
      if (tripId && state.basics.tripType) {
        const occasionLabels: Record<string, string> = {
          'romantic': 'Romantic couples getaway',
          'anniversary': 'Anniversary celebration trip',
          'honeymoon': 'Honeymoon trip',
          'birthday': 'Birthday celebration trip',
          'girls-trip': "Girls' trip with friends",
          'guys-trip': "Guys' trip with friends", 
          'family': 'Family vacation with children',
          'adult-family': 'Adult family trip (no young children)',
          'solo': 'Solo adventure trip',
          'friends': 'Friends group trip',
          'business': 'Business trip with leisure time',
          'adventure': 'Adventure and outdoor activities focused',
          'wellness': 'Wellness and relaxation retreat',
          'leisure': 'General leisure vacation',
        };
        
        const intentValue = occasionLabels[state.basics.tripType] || state.basics.tripType;
        
        // Upsert the occasion intent (replace if exists)
        await supabase
          .from('trip_intents')
          .upsert({
            trip_id: tripId,
            user_id: user.id,
            intent_type: 'occasion',
            intent_value: intentValue,
            active: true,
          }, {
            onConflict: 'trip_id,intent_type',
            ignoreDuplicates: false,
          });
        
        console.log('[TripPlanner] Trip occasion intent saved:', state.basics.tripType);
      }

      // Trigger achievement for trip creation (only for new trips)
      if (!state.tripId && tripId) {
        try {
          const { checkMilestoneAchievements, syncTripCountAchievements } = await import('@/services/achievementsAPI');
          await checkMilestoneAchievements('trip_created', { tripId, destination: state.basics.destination });
          await syncTripCountAchievements();
        } catch (achievementErr) {
          console.warn('[TripPlanner] Achievement unlock failed (non-blocking):', achievementErr);
        }
      }

      setState(prev => ({
        ...prev,
        tripId,
        isLoading: false,
      }));

      console.log('[TripPlanner] Trip saved successfully:', tripId);
      return tripId;
    } catch (error) {
      console.error('[TripPlanner] Error saving trip:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to save trip',
      }));
      return null;
    } finally {
      // CRITICAL: Always release the lock, even on error
      savingInProgressRef.current = false;
    }
  };

  const loadTrip = async (tripId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let trip: Record<string, unknown> | null = null;

      // Anonymous user: load from localStorage
      if (!user) {
        trip = loadLocalTrip(tripId);
        if (!trip) throw new Error('Trip not found');
      } else {
        // Real mode: load from backend
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Trip not found');
        trip = data as unknown as Record<string, unknown>;
      }

      const metadata = (trip.metadata as Record<string, unknown> | null) || null;
      const itineraryData = trip.itinerary_data as { days?: DayItinerary[] } | null;

      setState(prev => ({
        ...prev,
        tripId: trip!.id as string,
        sessionId: (metadata?.sessionId as string) || prev.sessionId,
        basics: {
          destination: trip!.destination as string,
          startDate: trip!.start_date as string,
          endDate: trip!.end_date as string,
          travelers: (trip!.travelers as number) || 1,
          tripType: trip!.trip_type as TripBasics['tripType'],
          originCity: (trip!.origin_city as string) || undefined,
          budgetTier: (trip!.budget_tier as string) || undefined,
        },
        flights: trip!.flight_selection as unknown as FlightSelection | null,
        hotel: trip!.hotel_selection as unknown as HotelSelection | null,
        itinerary: itineraryData?.days || [],
        isLoading: false,
      }));

      console.log('[TripPlanner] Trip loaded:', tripId);
    } catch (error) {
      console.error('[TripPlanner] Error loading trip:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load trip',
      }));
    }
  };

  const resetTrip = () => {
    setState({
      ...initialState,
      sessionId: getOrCreateAnonymousSession(),
    });
  };

  return (
    <TripPlannerContext.Provider
      value={{
        state,
        setStep,
        setBasics,
        setFlight,
        setFlights,
        setHotel,
        setItinerary,
        saveTrip,
        loadTrip,
        resetTrip,
        calculateTotalPrice,
      }}
    >
      {children}
    </TripPlannerContext.Provider>
  );
}

export function useTripPlanner() {
  const context = useContext(TripPlannerContext);
  if (context === undefined) {
    throw new Error('useTripPlanner must be used within a TripPlannerProvider');
  }
  return context;
}
