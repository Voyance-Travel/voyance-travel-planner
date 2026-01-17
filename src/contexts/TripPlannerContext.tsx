import { createContext, useContext, useState, ReactNode } from 'react';

export interface TripBasics {
  destination?: string;
  destinationId?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  tripType?: 'solo' | 'couple' | 'family' | 'group';
}

export interface FlightSelection {
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
  step: number;
  basics: TripBasics;
  flights: FlightSelection | null;
  hotel: HotelSelection | null;
  itinerary: ItineraryDay[];
  totalPrice: number;
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
}

const initialState: TripPlannerState = {
  step: 1,
  basics: {},
  flights: null,
  hotel: null,
  itinerary: [],
  totalPrice: 0,
};

const TripPlannerContext = createContext<TripPlannerContextType | undefined>(undefined);

export function TripPlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TripPlannerState>(initialState);

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

  const reset = () => {
    setState(initialState);
  };

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
