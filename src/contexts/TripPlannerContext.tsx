import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { tripsAPI, itineraryAPI } from '@/services/voyanceAPI';
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
  description: string;
  duration: string;
  price: number;
  category: string;
  imageUrl?: string;
  time?: string;
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

export interface TripPlannerState {
  tripId: string | null;
  sessionId: string | null; // For anonymous trips
  step: number;
  basics: TripBasics;
  flights: FlightSelection | null;
  hotel: HotelSelection | null;
  itinerary: ItineraryDay[];
  totalPrice: number;
  isSaving: boolean;
  lastSaved: Date | null;
}

interface TripPlannerContextType {
  state: TripPlannerState;
  setStep: (step: number) => void;
  setBasics: (basics: TripBasics) => void;
  setFlights: (flights: FlightSelection) => void;
  setHotel: (hotel: HotelSelection) => void;
  setItinerary: (itinerary: ItineraryDay[]) => void;
  addActivity: (dayIndex: number, activity: Activity) => void;
  removeActivity: (dayIndex: number, activityId: string) => void;
  calculateTotal: () => number;
  reset: () => void;
  saveTrip: () => Promise<string | null>;
  saveTripToNeon: () => Promise<string | null>;
  loadTrip: (tripId: string) => Promise<void>;
}

const initialState: TripPlannerState = {
  tripId: null,
  sessionId: null,
  step: 1,
  basics: {},
  flights: null,
  hotel: null,
  itinerary: [],
  totalPrice: 0,
  isSaving: false,
  lastSaved: null,
};

const TripPlannerContext = createContext<TripPlannerContextType | undefined>(undefined);

export function TripPlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TripPlannerState>(initialState);
  const { user, isAuthenticated } = useAuth();

  const setStep = (step: number) => {
    setState(prev => ({ ...prev, step }));
  };

  const setBasics = (basics: TripBasics) => {
    setState(prev => ({ ...prev, basics }));
  };

  const setFlights = (flights: FlightSelection) => {
    setState(prev => ({ ...prev, flights }));
  };

  const setHotel = (hotel: HotelSelection) => {
    setState(prev => ({ ...prev, hotel }));
  };

  const setItinerary = (itinerary: ItineraryDay[]) => {
    setState(prev => ({ ...prev, itinerary }));
  };

  const addActivity = (dayIndex: number, activity: Activity) => {
    setState(prev => {
      const newItinerary = [...prev.itinerary];
      if (newItinerary[dayIndex]) {
        newItinerary[dayIndex].activities.push(activity);
      }
      return { ...prev, itinerary: newItinerary };
    });
  };

  const removeActivity = (dayIndex: number, activityId: string) => {
    setState(prev => {
      const newItinerary = [...prev.itinerary];
      if (newItinerary[dayIndex]) {
        newItinerary[dayIndex].activities = newItinerary[dayIndex].activities.filter(
          a => a.id !== activityId
        );
      }
      return { ...prev, itinerary: newItinerary };
    });
  };

  const calculateTotal = () => {
    let total = 0;
    
    if (state.flights?.departure) {
      total += state.flights.departure.price;
    }
    if (state.flights?.return) {
      total += state.flights.return.price;
    }
    
    if (state.hotel && state.basics.startDate && state.basics.endDate) {
      const start = new Date(state.basics.startDate);
      const end = new Date(state.basics.endDate);
      const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      total += state.hotel.pricePerNight * nights;
    }
    
    state.itinerary.forEach(day => {
      day.activities.forEach(activity => {
        total += activity.price;
      });
    });
    
    return total;
  };

  /**
   * Save trip to Neon DB (works for both anonymous and authenticated users)
   */
  const saveTripToNeon = useCallback(async (): Promise<string | null> => {
    if (!state.basics.destination || !state.basics.startDate || !state.basics.endDate) {
      console.warn('[TripPlanner] Cannot save to Neon: missing required fields');
      return null;
    }

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const sessionId = state.sessionId || getOrCreateAnonymousSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/neon-db/trips/anonymous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          sessionId,
          origin: state.basics.originCity,
          destination: state.basics.destination,
          startDate: state.basics.startDate,
          endDate: state.basics.endDate,
          travelers: state.basics.travelers || 1,
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setState(prev => ({ 
        ...prev, 
        sessionId: result.sessionId || sessionId,
        isSaving: false, 
        lastSaved: new Date() 
      }));

      console.log('[TripPlanner] Trip saved to Neon:', result.sessionId || sessionId);
      return result.sessionId || sessionId;
    } catch (error) {
      console.error('[TripPlanner] Neon save error:', error);
      setState(prev => ({ ...prev, isSaving: false }));
      return null;
    }
  }, [state]);

  /**
   * Save trip to BOTH Supabase (primary) and Railway backend
   * Only works for authenticated users
   */
  const saveTrip = useCallback(async (): Promise<string | null> => {
    // If not authenticated, save to Neon instead
    if (!isAuthenticated || !user) {
      console.log('[TripPlanner] Not authenticated, saving to Neon');
      return saveTripToNeon();
    }

    if (!state.basics.destination || !state.basics.startDate || !state.basics.endDate) {
      console.warn('[TripPlanner] Cannot save: missing required fields');
      return null;
    }

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const tripName = `Trip to ${state.basics.destination}`;
      
      // 1. Save to Supabase (primary data store)
      const supabaseTripData = {
        user_id: user.id,
        name: tripName,
        destination: state.basics.destination,
        start_date: state.basics.startDate,
        end_date: state.basics.endDate,
        travelers: state.basics.travelers || 1,
        trip_type: state.basics.tripType || 'solo',
        origin_city: state.basics.originCity,
        budget_tier: state.basics.budgetTier || 'moderate',
        status: 'planning' as const,
        flight_selection: state.flights ? JSON.parse(JSON.stringify(state.flights)) : null,
        hotel_selection: state.hotel ? JSON.parse(JSON.stringify(state.hotel)) : null,
        itinerary_data: state.itinerary.length > 0 ? JSON.parse(JSON.stringify({ days: state.itinerary })) : null,
        metadata: JSON.parse(JSON.stringify({
          totalPrice: calculateTotal(),
          lastStep: state.step,
        })),
      };

      let tripId = state.tripId;

      if (tripId) {
        // Update existing trip
        const { error } = await supabase
          .from('trips')
          .update({
            ...supabaseTripData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tripId);

        if (error) throw error;
      } else {
        // Create new trip
        const { data, error } = await supabase
          .from('trips')
          .insert([supabaseTripData])
          .select('id')
          .single();

        if (error) throw error;
        tripId = data.id;
      }

      // 2. Also sync to Railway backend (for itinerary generation)
      try {
        if (state.tripId) {
          await tripsAPI.update(tripId!, {
            name: tripName,
            destination: state.basics.destination,
            startDate: state.basics.startDate,
            endDate: state.basics.endDate,
            travelers: state.basics.travelers,
            budgetRange: state.basics.budgetTier as 'tight' | 'moderate' | 'flexible' | 'luxury',
            tripType: state.basics.tripType,
            departureCity: state.basics.originCity,
          });
        } else {
          await tripsAPI.create({
            name: tripName,
            destination: state.basics.destination,
            startDate: state.basics.startDate,
            endDate: state.basics.endDate,
            travelers: state.basics.travelers,
            budgetRange: state.basics.budgetTier as 'tight' | 'moderate' | 'flexible' | 'luxury',
            tripType: state.basics.tripType,
            departureCity: state.basics.originCity,
          });
        }
      } catch (railwayError) {
        // Don't fail if Railway sync fails - Supabase is primary
        console.warn('[TripPlanner] Railway sync failed (non-critical):', railwayError);
      }

      setState(prev => ({ 
        ...prev, 
        tripId, 
        isSaving: false, 
        lastSaved: new Date() 
      }));

      console.log('[TripPlanner] Trip saved successfully:', tripId);
      return tripId;
    } catch (error) {
      console.error('[TripPlanner] Save error:', error);
      setState(prev => ({ ...prev, isSaving: false }));
      return null;
    }
  }, [state, user, isAuthenticated, calculateTotal, saveTripToNeon]);

  /**
   * Load trip from Supabase
   */
  const loadTrip = useCallback(async (tripId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Trip not found');

      const itineraryData = data.itinerary_data as { days?: ItineraryDay[] } | null;
      const flightData = data.flight_selection as unknown as FlightSelection | null;
      const hotelData = data.hotel_selection as unknown as HotelSelection | null;
      const metadata = data.metadata as { lastStep?: number; totalPrice?: number } | null;

      setState({
        tripId: data.id,
        sessionId: null,
        step: metadata?.lastStep || 1,
        basics: {
          destination: data.destination,
          startDate: data.start_date,
          endDate: data.end_date,
          travelers: data.travelers || 1,
          tripType: data.trip_type as TripBasics['tripType'],
          originCity: data.origin_city || undefined,
          budgetTier: data.budget_tier || 'moderate',
        },
        flights: flightData,
        hotel: hotelData,
        itinerary: itineraryData?.days || [],
        totalPrice: metadata?.totalPrice || 0,
        isSaving: false,
        lastSaved: new Date(data.updated_at),
      });

      console.log('[TripPlanner] Trip loaded:', tripId);
    } catch (error) {
      console.error('[TripPlanner] Load error:', error);
    }
  }, []);

  const reset = () => {
    setState(initialState);
  };

  // Auto-save on significant changes (debounced)
  useEffect(() => {
    if (!state.basics.destination) return;
    
    const timer = setTimeout(() => {
      if (isAuthenticated && state.tripId) {
        saveTrip();
      } else if (state.sessionId) {
        saveTripToNeon();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [state.basics, state.flights, state.hotel, state.step]);

  return (
    <TripPlannerContext.Provider
      value={{
        state,
        setStep,
        setBasics,
        setFlights,
        setHotel,
        setItinerary,
        addActivity,
        removeActivity,
        calculateTotal,
        reset,
        saveTrip,
        saveTripToNeon,
        loadTrip,
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

export default TripPlannerContext;
