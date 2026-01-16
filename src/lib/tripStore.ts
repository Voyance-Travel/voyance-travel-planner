import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Trip, TripSelections, Itinerary, FlightOption, HotelOption } from './trips';

interface TripStore {
  trips: Trip[];
  selections: Record<string, TripSelections>;
  itineraries: Record<string, Itinerary>;
  
  // Trip actions
  createTrip: (trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTrip: (tripId: string, updates: Partial<Trip>) => void;
  getTrip: (tripId: string) => Trip | undefined;
  getUserTrips: (userId: string) => Trip[];
  
  // Selection actions
  saveSelections: (tripId: string, flight?: FlightOption, hotel?: HotelOption) => void;
  getSelections: (tripId: string) => TripSelections | undefined;
  
  // Itinerary actions
  saveItinerary: (tripId: string, itinerary: Omit<Itinerary, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>) => void;
  getItinerary: (tripId: string) => Itinerary | undefined;
  hasItinerary: (tripId: string) => boolean;
}

export const useTripStore = create<TripStore>()(
  persist(
    (set, get) => ({
      trips: [],
      selections: {},
      itineraries: {},
      
      createTrip: (tripData) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const trip: Trip = {
          ...tripData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        
        set(state => ({
          trips: [...state.trips, trip],
        }));
        
        return id;
      },
      
      updateTrip: (tripId, updates) => {
        set(state => ({
          trips: state.trips.map(t => 
            t.id === tripId 
              ? { ...t, ...updates, updatedAt: new Date().toISOString() }
              : t
          ),
        }));
      },
      
      getTrip: (tripId) => {
        return get().trips.find(t => t.id === tripId);
      },
      
      getUserTrips: (userId) => {
        return get().trips.filter(t => t.userId === userId);
      },
      
      saveSelections: (tripId, flight, hotel) => {
        const existing = get().selections[tripId];
        const priceLockExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        set(state => ({
          selections: {
            ...state.selections,
            [tripId]: {
              id: existing?.id || crypto.randomUUID(),
              tripId,
              flight: flight || existing?.flight,
              hotel: hotel || existing?.hotel,
            },
          },
        }));
        
        // Update trip with price lock
        get().updateTrip(tripId, { priceLockExpiresAt });
      },
      
      getSelections: (tripId) => {
        return get().selections[tripId];
      },
      
      saveItinerary: (tripId, itineraryData) => {
        const now = new Date().toISOString();
        const itinerary: Itinerary = {
          ...itineraryData,
          id: crypto.randomUUID(),
          tripId,
          createdAt: now,
          updatedAt: now,
        };
        
        set(state => ({
          itineraries: {
            ...state.itineraries,
            [tripId]: itinerary,
          },
        }));
      },
      
      getItinerary: (tripId) => {
        return get().itineraries[tripId];
      },
      
      hasItinerary: (tripId) => {
        return !!get().itineraries[tripId];
      },
    }),
    {
      name: 'voyance-trips',
    }
  )
);
