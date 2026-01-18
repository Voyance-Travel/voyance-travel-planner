import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

// Anonymous session management
const ANON_SESSION_KEY = 'voyance_anonymous_session';

function getOrCreateAnonymousSession(): string {
  let sessionId = localStorage.getItem(ANON_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(ANON_SESSION_KEY, sessionId);
  }
  return sessionId;
}

export interface TripBasics {
  destination?: string;
  destinationId?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  tripType?: 'solo' | 'couple' | 'family' | 'group';
  originCity?: string;
  budgetTier?: string;
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
  rating: number;
  pricePerNight: number;
  roomType: string;
  amenities: string[];
  imageUrl?: string;
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
  flight: FlightSelection | null;
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
  flight: null,
  hotel: null,
  itinerary: [],
  totalPrice: 0,
  isLoading: false,
  error: null,
};

const TripPlannerContext = createContext<TripPlannerContextType | undefined>(undefined);

export function TripPlannerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<TripPlannerState>(initialState);

  // Calculate total price
  const calculateTotalPrice = useCallback(() => {
    let total = 0;
    
    if (state.flight?.departure?.price) {
      total += state.flight.departure.price;
    }
    if (state.flight?.return?.price) {
      total += state.flight.return.price;
    }
    
    if (state.hotel?.pricePerNight && state.basics.startDate && state.basics.endDate) {
      const nights = Math.ceil(
        (new Date(state.basics.endDate).getTime() - new Date(state.basics.startDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      total += state.hotel.pricePerNight * nights;
    }
    
    return total;
  }, [state.flight, state.hotel, state.basics]);

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
    setState(prev => ({ ...prev, flight }));
  };

  const setHotel = (hotel: HotelSelection | null) => {
    setState(prev => ({ ...prev, hotel }));
  };

  const setItinerary = (itinerary: DayItinerary[]) => {
    setState(prev => ({ ...prev, itinerary }));
  };

  const saveTrip = async (): Promise<string | null> => {
    if (!user) {
      console.warn('[TripPlanner] Cannot save trip: user not authenticated');
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tripName = state.basics.destination 
        ? `Trip to ${state.basics.destination}` 
        : 'New Trip';

      const tripData = {
        user_id: user.id,
        name: tripName,
        destination: state.basics.destination || 'Unknown',
        destination_country: null,
        start_date: state.basics.startDate || new Date().toISOString().split('T')[0],
        end_date: state.basics.endDate || new Date().toISOString().split('T')[0],
        trip_type: state.basics.tripType || 'vacation',
        travelers: state.basics.travelers || 1,
        origin_city: state.basics.originCity,
        budget_tier: state.basics.budgetTier || 'moderate',
        status: 'draft' as const,
        flight_selection: state.flight as unknown as Record<string, unknown> | null,
        hotel_selection: state.hotel as unknown as Record<string, unknown> | null,
        itinerary_data: state.itinerary.length > 0 ? { days: state.itinerary } : null,
        metadata: {
          sessionId: state.sessionId,
          lastUpdated: new Date().toISOString(),
        },
      };

      let tripId = state.tripId;

      if (tripId) {
        // Update existing trip
        const { error } = await supabase
          .from('trips')
          .update(tripData)
          .eq('id', tripId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new trip
        const { data, error } = await supabase
          .from('trips')
          .insert([tripData])
          .select('id')
          .single();

        if (error) throw error;
        tripId = data.id;
      }

      setState(prev => ({ 
        ...prev, 
        tripId,
        isLoading: false 
      }));

      console.log('[TripPlanner] Trip saved successfully:', tripId);
      return tripId;

    } catch (error) {
      console.error('[TripPlanner] Error saving trip:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to save trip' 
      }));
      return null;
    }
  };

  const loadTrip = async (tripId: string) => {
    if (!user) {
      console.warn('[TripPlanner] Cannot load trip: user not authenticated');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data: trip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (!trip) throw new Error('Trip not found');

      const metadata = trip.metadata as Record<string, unknown> | null;
      const itineraryData = trip.itinerary_data as { days?: DayItinerary[] } | null;

      setState(prev => ({
        ...prev,
        tripId: trip.id,
        sessionId: (metadata?.sessionId as string) || prev.sessionId,
        basics: {
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          travelers: trip.travelers || 1,
          tripType: trip.trip_type as TripBasics['tripType'],
          originCity: trip.origin_city || undefined,
          budgetTier: trip.budget_tier || undefined,
        },
        flight: trip.flight_selection as unknown as FlightSelection | null,
        hotel: trip.hotel_selection as unknown as HotelSelection | null,
        itinerary: itineraryData?.days || [],
        isLoading: false,
      }));

      console.log('[TripPlanner] Trip loaded:', tripId);

    } catch (error) {
      console.error('[TripPlanner] Error loading trip:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load trip' 
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
