/**
 * Popup Coordination Store
 * Prevents multiple modals from fighting for attention
 * Implements a queue-based system with priority levels
 */

import { create } from 'zustand';

export type PopupType = 
  | 'welcome_credits'
  | 'onboarding_preferences' 
  | 'itinerary_tour'
  | 'credit_progress_bar'
  | 'review_capture';

interface PopupPriority {
  type: PopupType;
  priority: number; // Lower = higher priority
  minDelaySinceLastPopup: number; // ms to wait after previous popup closes
}

// Priority order - only one modal at a time
// Progress bar is always-visible but hides when modals are active
const POPUP_PRIORITIES: PopupPriority[] = [
  { type: 'welcome_credits', priority: 1, minDelaySinceLastPopup: 0 },
  { type: 'itinerary_tour', priority: 2, minDelaySinceLastPopup: 500 },
  { type: 'onboarding_preferences', priority: 3, minDelaySinceLastPopup: 1000 },
  { type: 'review_capture', priority: 4, minDelaySinceLastPopup: 2000 },
  { type: 'credit_progress_bar', priority: 10, minDelaySinceLastPopup: 2000 },
];

interface PopupState {
  activePopup: PopupType | null;
  lastPopupClosedAt: number | null;
  queuedPopups: PopupType[];
  
  // Actions
  requestPopup: (type: PopupType) => boolean;
  closePopup: (type: PopupType) => void;
  isPopupAllowed: (type: PopupType) => boolean;
  hasActiveModal: () => boolean;
}

export const usePopupCoordination = create<PopupState>((set, get) => ({
  activePopup: null,
  lastPopupClosedAt: null,
  queuedPopups: [],

  requestPopup: (type: PopupType): boolean => {
    const state = get();
    const priority = POPUP_PRIORITIES.find(p => p.type === type);
    
    if (!priority) return false;

    // Check timing constraint
    if (state.lastPopupClosedAt) {
      const timeSinceLastClose = Date.now() - state.lastPopupClosedAt;
      if (timeSinceLastClose < priority.minDelaySinceLastPopup) {
        // Queue it for later
        if (!state.queuedPopups.includes(type)) {
          set({ queuedPopups: [...state.queuedPopups, type] });
        }
        return false;
      }
    }

    // If no active popup, show immediately
    if (!state.activePopup) {
      set({ activePopup: type });
      return true;
    }

    // If this popup has higher priority than active, don't interrupt
    // (we wait for current to close)
    if (!state.queuedPopups.includes(type)) {
      set({ queuedPopups: [...state.queuedPopups, type] });
    }
    return false;
  },

  closePopup: (type: PopupType) => {
    const state = get();
    
    if (state.activePopup !== type) return;

    const now = Date.now();
    const remainingQueue = state.queuedPopups.filter(t => t !== type);
    
    // Sort by priority and find next popup to show
    const sortedQueue = remainingQueue.sort((a, b) => {
      const aPriority = POPUP_PRIORITIES.find(p => p.type === a)?.priority ?? 99;
      const bPriority = POPUP_PRIORITIES.find(p => p.type === b)?.priority ?? 99;
      return aPriority - bPriority;
    });

    set({
      activePopup: null,
      lastPopupClosedAt: now,
      queuedPopups: remainingQueue,
    });

    // After a short delay, try to show next queued popup
    if (sortedQueue.length > 0) {
      const nextPopup = sortedQueue[0];
      const nextPriority = POPUP_PRIORITIES.find(p => p.type === nextPopup);
      
      setTimeout(() => {
        get().requestPopup(nextPopup);
      }, nextPriority?.minDelaySinceLastPopup ?? 500);
    }
  },

  isPopupAllowed: (type: PopupType): boolean => {
    const state = get();
    return state.activePopup === type || state.activePopup === null;
  },

  hasActiveModal: (): boolean => {
    const state = get();
    // Progress bar is not a "modal" - it's persistent
    return state.activePopup !== null && state.activePopup !== 'credit_progress_bar';
  },
}));

// Storage keys for tracking popup history
export const POPUP_STORAGE = {
  WELCOME_SHOWN: 'voyance_welcome_shown',
  ONBOARDING_SHOWN: 'voyance_onboarding_nudge_shown',
  ITINERARY_TOUR_COMPLETED: 'voyance_itinerary_tour_completed',
  PROGRESS_BAR_COLLAPSED: 'voyance_progress_bar_collapsed',
  REVIEW_SUBMITTED: 'voyance_review_submitted',
} as const;

// Cooldown periods (in ms)
export const POPUP_COOLDOWNS = {
  ONBOARDING_PREFERENCES: 24 * 60 * 60 * 1000, // 24 hours
  PROGRESS_BAR_REMINDER: 4 * 60 * 60 * 1000, // 4 hours between auto-expand
} as const;
