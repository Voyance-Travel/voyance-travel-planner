import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, isDemoModeEnabled } from './AuthContext';

// Anonymous session management
const ANON_SESSION_KEY = 'voyance_anonymous_session';
const DEMO_TRIPS_KEY = 'voyance_demo_trips';

function getOrCreateAnonymousSession(): string {
  let sessionId = localStorage.getItem(ANON_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(ANON_SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Demo mode localStorage trip storage
function saveDemoTrip(tripData: Record<string, unknown>): string {
  const tripId = tripData.id as string || crypto.randomUUID();
  const trips = JSON.parse(localStorage.getItem(DEMO_TRIPS_KEY) || '{}');
  trips[tripId] = { ...tripData, id: tripId };
  localStorage.setItem(DEMO_TRIPS_KEY, JSON.stringify(trips));
  console.log('[TripPlanner] Demo trip saved to localStorage:', tripId);
  return tripId;
}

function loadDemoTrip(tripId: string): Record<string, unknown> | null {
  const trips = JSON.parse(localStorage.getItem(DEMO_TRIPS_KEY) || '{}');
  return trips[tripId] || null;
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
  address?: string;
  neighborhood?: string;
  rating: number;
  pricePerNight: number;
  roomType: string;
  amenities: string[];
  imageUrl?: string;
  images?: string[];
  website?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  reviewCount?: number;
  description?: string;
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
  const [state, setState] = useState<TripPlannerState>(initialState);

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
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tripName = state.basics.destination ? `Trip to ${state.basics.destination}` : 'New Trip';

      const tripData: Record<string, unknown> = {
        id: state.tripId || undefined,
        user_id: user?.id ?? null,
        name: tripName,
        destination: state.basics.destination || 'Unknown',
        destination_country: null,
        start_date: state.basics.startDate || new Date().toISOString().split('T')[0],
        end_date: state.basics.endDate || new Date().toISOString().split('T')[0],
        trip_type: state.basics.tripType || 'vacation',
        travelers: state.basics.travelers || 1,
        origin_city: state.basics.originCity,
        budget_tier: state.basics.budgetTier || 'moderate',
        status: 'draft',
        flight_selection: state.flights ? JSON.parse(JSON.stringify(state.flights)) : null,
        hotel_selection: state.hotel ? JSON.parse(JSON.stringify(state.hotel)) : null,
        itinerary_data: state.itinerary.length > 0 ? JSON.parse(JSON.stringify({ days: state.itinerary })) : null,
        metadata: JSON.parse(
          JSON.stringify({
            sessionId: state.sessionId,
            lastUpdated: new Date().toISOString(),
            anonymous: !user,
          })
        ),
      };

      let tripId = state.tripId;

      // Demo mode OR anonymous user: save to localStorage so the flow can continue
      if (isDemoModeEnabled() || !user) {
        tripId = saveDemoTrip(tripData);
        setState(prev => ({
          ...prev,
          tripId,
          isLoading: false,
        }));
        console.log('[TripPlanner] Local trip saved:', tripId);
        return tripId;
      }

      // Real mode: save to backend
      if (tripId) {
        const { error } = await supabase
          .from('trips')
          .update(tripData as any)
          .eq('id', tripId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('trips')
          .insert([tripData as any])
          .select('id')
          .single();

        if (error) throw error;
        tripId = data.id;
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
    }
  };

  const loadTrip = async (tripId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let trip: Record<string, unknown> | null = null;

      // Demo mode OR anonymous user: load from localStorage
      if (isDemoModeEnabled() || !user) {
        trip = loadDemoTrip(tripId);
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
