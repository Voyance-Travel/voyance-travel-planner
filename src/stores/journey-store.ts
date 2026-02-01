/**
 * JourneyStore - Session-aware tracking of user journey through the site
 * Enables contextual CTAs, smart navigation, and personalized nudges
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type JourneyStage = 
  | 'new'           // Just arrived
  | 'curious'       // Viewed 1-2 pages
  | 'exploring'     // Viewed 3+ pages
  | 'in-quiz'       // Started quiz
  | 'post-quiz'     // Completed quiz
  | 'planning'      // Creating a trip
  | 'has-trip';     // Has created at least one trip

export type ActionType = 
  | 'quiz_started'
  | 'quiz_completed'
  | 'trip_started'
  | 'trip_created'
  | 'destination_selected'
  | 'itinerary_viewed'
  | 'pricing_viewed'
  | 'demo_viewed';

interface NextStep {
  label: string;
  href: string;
  priority: 'low' | 'medium' | 'high';
  subtext?: string;
}

interface JourneyState {
  // Tracking data
  pagesViewed: string[];
  actionsCompleted: ActionType[];
  sessionStartTime: number;
  lastActivityTime: number;
  
  // Actions
  trackPageView: (page: string) => void;
  trackAction: (action: ActionType) => void;
  
  // Computed helpers
  getJourneyStage: () => JourneyStage;
  getSuggestedNextStep: () => NextStep;
  getTimeOnSite: () => number;
  hasViewedPage: (page: string) => boolean;
  hasCompletedAction: (action: ActionType) => boolean;
  
  // Reset for testing
  resetJourney: () => void;
}

const initialState = {
  pagesViewed: [] as string[],
  actionsCompleted: [] as ActionType[],
  sessionStartTime: Date.now(),
  lastActivityTime: Date.now(),
};

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({
      ...initialState,

      trackPageView: (page: string) => {
        const { pagesViewed } = get();
        if (!pagesViewed.includes(page)) {
          set({ 
            pagesViewed: [...pagesViewed, page],
            lastActivityTime: Date.now(),
          });
        } else {
          set({ lastActivityTime: Date.now() });
        }
      },

      trackAction: (action: ActionType) => {
        const { actionsCompleted } = get();
        if (!actionsCompleted.includes(action)) {
          set({ 
            actionsCompleted: [...actionsCompleted, action],
            lastActivityTime: Date.now(),
          });
        }
      },

      getJourneyStage: (): JourneyStage => {
        const { pagesViewed, actionsCompleted } = get();
        
        // Check action-based stages first (highest priority)
        if (actionsCompleted.includes('trip_created')) return 'has-trip';
        if (actionsCompleted.includes('trip_started')) return 'planning';
        if (actionsCompleted.includes('quiz_completed')) return 'post-quiz';
        if (actionsCompleted.includes('quiz_started')) return 'in-quiz';
        
        // Fall back to page-based stages
        if (pagesViewed.length >= 3) return 'exploring';
        if (pagesViewed.length >= 1) return 'curious';
        return 'new';
      },

      getSuggestedNextStep: (): NextStep => {
        const stage = get().getJourneyStage();
        const { pagesViewed, actionsCompleted } = get();
        
        switch (stage) {
          case 'new':
            return {
              label: 'See How It Works',
              href: '/how-it-works',
              priority: 'low',
            };
            
          case 'curious':
            if (!pagesViewed.includes('/demo')) {
              return {
                label: 'See a Demo',
                href: '/demo',
                priority: 'medium',
              };
            }
            return {
              label: 'Find Your Style',
              href: '/quiz',
              priority: 'medium',
              subtext: '4 minutes',
            };
            
          case 'exploring':
            if (!actionsCompleted.includes('demo_viewed')) {
              return {
                label: 'Try the Demo',
                href: '/demo',
                priority: 'medium',
              };
            }
            return {
              label: 'Discover Your Travel DNA',
              href: '/quiz',
              priority: 'high',
              subtext: 'Changes everything',
            };
            
          case 'in-quiz':
            return {
              label: 'Continue Quiz',
              href: '/quiz',
              priority: 'high',
            };
            
          case 'post-quiz':
            return {
              label: 'Plan Your Trip',
              href: '/start',
              priority: 'high',
              subtext: 'Built for you',
            };
            
          case 'planning':
            return {
              label: 'Continue Planning',
              href: '/planner',
              priority: 'high',
            };
            
          case 'has-trip':
            return {
              label: 'View Your Trips',
              href: '/trip/dashboard',
              priority: 'medium',
            };
            
          default:
            return {
              label: 'Get Started',
              href: '/start',
              priority: 'medium',
            };
        }
      },

      getTimeOnSite: (): number => {
        return Date.now() - get().sessionStartTime;
      },

      hasViewedPage: (page: string): boolean => {
        return get().pagesViewed.includes(page);
      },

      hasCompletedAction: (action: ActionType): boolean => {
        return get().actionsCompleted.includes(action);
      },

      resetJourney: () => {
        set({
          ...initialState,
          sessionStartTime: Date.now(),
          lastActivityTime: Date.now(),
        });
      },
    }),
    {
      name: 'voyance-journey',
      storage: createJSONStorage(() => sessionStorage), // Session-only, resets on close
      partialize: (state) => ({
        pagesViewed: state.pagesViewed,
        actionsCompleted: state.actionsCompleted,
        sessionStartTime: state.sessionStartTime,
        lastActivityTime: state.lastActivityTime,
      }),
    }
  )
);

// Hook to track current page automatically
export function usePageTracking(pageName: string) {
  const trackPageView = useJourneyStore(state => state.trackPageView);
  
  // Track on mount
  if (typeof window !== 'undefined') {
    // Use microtask to avoid React strict mode double-firing
    queueMicrotask(() => trackPageView(pageName));
  }
}
