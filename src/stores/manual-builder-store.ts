 /**
  * Manual Builder Mode Store
  * 
  * Tracks when a user opts to "build it themselves" - keeping preview activities
  * and access to manual tools (budget, bookings, notes) without requiring credits.
  */
 
 import { create } from 'zustand';
 import { persist } from 'zustand/middleware';
 
 interface ManualBuilderState {
   /** Trip IDs where user opted for manual builder mode */
   manualBuilderTrips: Set<string>;
   /** Check if a trip is in manual builder mode */
   isManualBuilder: (tripId: string) => boolean;
   /** Enable manual builder mode for a trip */
   enableManualBuilder: (tripId: string) => void;
   /** Disable manual builder mode (e.g., if they upgrade) */
   disableManualBuilder: (tripId: string) => void;
 }
 
 export const useManualBuilderStore = create<ManualBuilderState>()(
   persist(
     (set, get) => ({
       manualBuilderTrips: new Set<string>(),
       
       isManualBuilder: (tripId: string) => {
         return get().manualBuilderTrips.has(tripId);
       },
       
       enableManualBuilder: (tripId: string) => {
         set((state) => ({
           manualBuilderTrips: new Set([...state.manualBuilderTrips, tripId]),
         }));
       },
       
       disableManualBuilder: (tripId: string) => {
         set((state) => {
           const newSet = new Set(state.manualBuilderTrips);
           newSet.delete(tripId);
           return { manualBuilderTrips: newSet };
         });
       },
     }),
     {
       name: 'voyance-manual-builder',
       // Custom serialization for Set
       storage: {
         getItem: (name) => {
           const str = localStorage.getItem(name);
           if (!str) return null;
           const parsed = JSON.parse(str);
           return {
             ...parsed,
             state: {
               ...parsed.state,
               manualBuilderTrips: new Set(parsed.state.manualBuilderTrips || []),
             },
           };
         },
         setItem: (name, value) => {
           const serialized = {
             ...value,
             state: {
               ...value.state,
               manualBuilderTrips: [...value.state.manualBuilderTrips],
             },
           };
           localStorage.setItem(name, JSON.stringify(serialized));
         },
         removeItem: (name) => localStorage.removeItem(name),
       },
     }
   )
 );