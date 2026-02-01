import { useCallback } from 'react';
import { toast } from 'sonner';
import { useCompanion } from '@/contexts/CompanionContext';
import { getMicroFeedback, randomMessage } from '@/lib/microFeedback';
import { planningMessages } from '@/lib/companionMessages';

/**
 * Hook for showing companion feedback throughout the app.
 * Provides archetype-aware, contextual feedback for user actions.
 */
export function useCompanionFeedback() {
  const { archetype, showFeedback } = useCompanion();
  
  /**
   * Show feedback for a standard action
   */
  const feedback = useCallback((action: string, customMessage?: string) => {
    showFeedback(action, customMessage);
  }, [showFeedback]);
  
  /**
   * Show destination feedback when user selects a destination
   */
  const destinationFeedback = useCallback((destination: string) => {
    const normalizedDest = destination.toLowerCase().replace(/\s+/g, '_');
    const message = planningMessages.destination.knownCities[normalizedDest as keyof typeof planningMessages.destination.knownCities] 
      || planningMessages.destination.unknownCity;
    
    toast(message, {
      duration: 2500,
      className: 'companion-toast companion-toast-info',
    });
  }, []);
  
  /**
   * Show duration feedback when user selects dates
   */
  const durationFeedback = useCallback((days: number) => {
    const message = planningMessages.dates.getDurationResponse(days);
    
    toast(message, {
      duration: 2500,
      className: 'companion-toast companion-toast-info',
    });
  }, []);
  
  /**
   * Show trip type feedback when user selects trip type
   */
  const tripTypeFeedback = useCallback((tripType: string) => {
    const message = planningMessages.tripType.responses[tripType as keyof typeof planningMessages.tripType.responses] 
      || planningMessages.tripType.responses.default;
    
    toast(message, {
      duration: 2500,
      className: 'companion-toast companion-toast-info',
    });
  }, []);
  
  /**
   * Show first-time visitor feedback
   */
  const firstTimeFeedback = useCallback((isFirstTime: boolean, destination?: string) => {
    const message = isFirstTime 
      ? (destination 
        ? `First time in ${destination}! We'll make sure you see the essentials.`
        : planningMessages.context.firstTime.no)
      : (destination 
        ? `Welcome back to ${destination}. Time for the deeper cuts.`
        : planningMessages.context.firstTime.yes);
    
    toast(message, {
      duration: 2500,
      className: 'companion-toast companion-toast-info',
    });
  }, []);
  
  /**
   * Show child age feedback
   */
  const childAgeFeedback = useCallback((age: number) => {
    let message: string;
    
    if (age <= 3) {
      message = planningMessages.context.children.toddler;
    } else if (age <= 12) {
      message = planningMessages.context.children.young;
    } else {
      message = planningMessages.context.children.teen;
    }
    
    toast(message, {
      duration: 2500,
      className: 'companion-toast companion-toast-info',
    });
  }, []);
  
  /**
   * Show itinerary action feedback
   */
  const itineraryFeedback = useCallback((action: 'moved' | 'removed' | 'added' | 'swapped') => {
    const actionKey = `activity${action.charAt(0).toUpperCase() + action.slice(1)}` as any;
    const message = getMicroFeedback(actionKey, archetype || undefined);
    
    if (message) {
      toast(message, {
        duration: 1500,
        className: 'companion-toast',
      });
    }
  }, [archetype]);
  
  /**
   * Show free time added feedback
   */
  const freeTimeFeedback = useCallback(() => {
    const message = getMicroFeedback('freeTimeAdded', archetype || undefined);
    
    if (message) {
      toast(message, {
        duration: 2000,
        className: 'companion-toast companion-toast-encouragement',
      });
    }
  }, [archetype]);
  
  /**
   * Show save feedback
   */
  const saveFeedback = useCallback(() => {
    toast('Saved.', {
      duration: 1500,
      className: 'companion-toast',
    });
  }, []);
  
  /**
   * Show error feedback
   */
  const errorFeedback = useCallback((message?: string) => {
    toast(message || 'Something went wrong.', {
      duration: 3000,
      className: 'companion-toast companion-toast-error',
    });
  }, []);
  
  /**
   * Show encouragement feedback
   */
  const encouragementFeedback = useCallback((message?: string) => {
    const defaultMessages = [
      "You're doing great.",
      "Looking good.",
      "This is going to be amazing.",
      "Trust your instincts.",
    ];
    
    toast(message || randomMessage(defaultMessages), {
      duration: 2500,
      className: 'companion-toast companion-toast-encouragement',
    });
  }, []);
  
  return {
    feedback,
    destinationFeedback,
    durationFeedback,
    tripTypeFeedback,
    firstTimeFeedback,
    childAgeFeedback,
    itineraryFeedback,
    freeTimeFeedback,
    saveFeedback,
    errorFeedback,
    encouragementFeedback,
  };
}

/**
 * Hook for getting archetype-specific loading messages
 */
export function useLoadingMessages(destination?: string) {
  const { getLoadingMessages } = useCompanion();
  return getLoadingMessages(destination);
}
