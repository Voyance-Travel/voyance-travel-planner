/**
 * JourneyStore - Session-aware tracking of user journey
 * Used for smart defaults and contextual CTAs (not for nagging)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type JourneyStage = 
  | 'new'
  | 'curious'
  | 'exploring'
  | 'in-quiz'
  | 'post-quiz'
  | 'planning'
  | 'has-trip';

export type ActionType = 
  | 'quiz_started'
  | 'quiz_completed'
  | 'trip_started'
  | 'trip_created'
  | 'destination_selected'
  | 'itinerary_viewed'
  | 'demo_viewed';

interface NextStep {
  label: string;
  href: string;
}

interface JourneyState {
  pagesViewed: string[];
  actionsCompleted: ActionType[];
  sessionStartTime: number;
  
  // Actions
  trackPageView: (page: string) => void;
  trackAction: (action: ActionType) => void;
  
  // Helpers
  getJourneyStage: () => JourneyStage;
  getSuggestedNextStep: () => NextStep;
  hasCompletedAction: (action: ActionType) => boolean;
  
  resetJourney: () => void;
}

const initialState = {
  pagesViewed: [] as string[],
  actionsCompleted: [] as ActionType[],
  sessionStartTime: Date.now(),
};

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({
      ...initialState,

      trackPageView: (page: string) => {
        const { pagesViewed } = get();
        if (!pagesViewed.includes(page)) {
          set({ pagesViewed: [...pagesViewed, page] });
        }
      },

      trackAction: (action: ActionType) => {
        const { actionsCompleted } = get();
        if (!actionsCompleted.includes(action)) {
          set({ actionsCompleted: [...actionsCompleted, action] });
        }
      },

      getJourneyStage: (): JourneyStage => {
        const { pagesViewed, actionsCompleted } = get();
        
        if (actionsCompleted.includes('trip_created')) return 'has-trip';
        if (actionsCompleted.includes('trip_started')) return 'planning';
        if (actionsCompleted.includes('quiz_completed')) return 'post-quiz';
        if (actionsCompleted.includes('quiz_started')) return 'in-quiz';
        if (pagesViewed.length >= 3) return 'exploring';
        if (pagesViewed.length >= 1) return 'curious';
        return 'new';
      },

      // Simple, non-pushy suggestions
      getSuggestedNextStep: (): NextStep => {
        const stage = get().getJourneyStage();
        
        switch (stage) {
          case 'new':
          case 'curious':
          case 'exploring':
            return { label: 'Get Started', href: '/start' };
          case 'in-quiz':
            return { label: 'Continue', href: '/quiz' };
          case 'post-quiz':
            return { label: 'Plan a Trip', href: '/start' };
          case 'planning':
            return { label: 'Continue', href: '/planner' };
          case 'has-trip':
            return { label: 'My Trips', href: '/trip/dashboard' };
          default:
            return { label: 'Get Started', href: '/start' };
        }
      },

      hasCompletedAction: (action: ActionType): boolean => {
        return get().actionsCompleted.includes(action);
      },

      resetJourney: () => {
        set({ ...initialState, sessionStartTime: Date.now() });
      },
    }),
    {
      name: 'voyance-journey',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        pagesViewed: state.pagesViewed,
        actionsCompleted: state.actionsCompleted,
        sessionStartTime: state.sessionStartTime,
      }),
    }
  )
);

// Hook to track page views
export function usePageTracking(pageName: string) {
  const trackPageView = useJourneyStore(state => state.trackPageView);
  
  if (typeof window !== 'undefined') {
    queueMicrotask(() => trackPageView(pageName));
  }
}
