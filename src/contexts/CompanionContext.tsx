import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { CompanionState } from '@/lib/companionMessages';
import { 
  strangerMessages, 
  gettingToKnowMessages, 
  revealedMessages,
  planningMessages,
  bookedMessages,
  travelingMessages,
  returnedMessages,
  loyalMessages,
  emptyStateMessages,
  errorMessages,
} from '@/lib/companionMessages';
import { getMicroFeedback, getGreeting, randomMessage } from '@/lib/microFeedback';

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CompanionContextType {
  /** Current state of the companion relationship */
  state: CompanionState;
  
  /** User's primary archetype (if known) */
  archetype: string | null;
  
  /** User's first name (if known) */
  userName: string | null;
  
  /** Get a message for a specific key and context */
  getMessage: (key: string, context?: Record<string, any>) => string;
  
  /** Show a companion toast notification */
  showFeedback: (action: string, customMessage?: string) => void;
  
  /** Get contextual greeting */
  getContextualGreeting: () => string;
  
  /** Get archetype-aware loading messages */
  getLoadingMessages: (destination?: string) => string[];
  
  /** All message libraries (for direct access) */
  messages: {
    stranger: typeof strangerMessages;
    gettingToKnow: typeof gettingToKnowMessages;
    revealed: typeof revealedMessages;
    planning: typeof planningMessages;
    booked: typeof bookedMessages;
    traveling: typeof travelingMessages;
    returned: typeof returnedMessages;
    loyal: typeof loyalMessages;
    empty: typeof emptyStateMessages;
    error: typeof errorMessages;
  };
}

const CompanionContext = createContext<CompanionContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

interface CompanionProviderProps {
  children: React.ReactNode;
}

export function CompanionProvider({ children }: CompanionProviderProps) {
  const { user } = useAuth();
  
  // Extract user data from transformed User object
  const archetype = user?.travelDNA?.type || null;
  const userName = user?.name?.split(' ')[0] || null;
  const hasCompletedQuiz = user?.quizCompleted || false;
  
  // Determine companion state based on user context
  const state = useMemo<CompanionState>(() => {
    if (!user) return 'stranger';
    if (!hasCompletedQuiz) return 'getting_to_know';
    
    // For now, default to 'revealed' or 'planning' for authenticated users with archetype
    // This could be enhanced with trip data to determine booked/traveling/returned/loyal states
    return 'planning';
  }, [user, hasCompletedQuiz]);
  
  // Message resolver
  const getMessage = useCallback((key: string, context?: Record<string, any>): string => {
    // Parse the key to find the right message
    const [category, ...rest] = key.split('.');
    const subKey = rest.join('.');
    
    switch (category) {
      case 'stranger':
        return resolveNestedMessage(strangerMessages, subKey) || key;
      case 'quiz':
        return resolveNestedMessage(gettingToKnowMessages, subKey) || key;
      case 'reveal':
        return resolveNestedMessage(revealedMessages, subKey) || key;
      case 'planning':
        return resolvePlanningMessage(subKey, context) || key;
      case 'booked':
        return resolveNestedMessage(bookedMessages, subKey) || key;
      case 'traveling':
        return resolveNestedMessage(travelingMessages, subKey) || key;
      case 'returned':
        return resolveNestedMessage(returnedMessages, subKey) || key;
      case 'loyal':
        return resolveNestedMessage(loyalMessages, subKey) || key;
      case 'empty':
        return resolveNestedMessage(emptyStateMessages, subKey) || key;
      case 'error':
        return resolveNestedMessage(errorMessages, subKey) || key;
      default:
        return key;
    }
  }, []);
  
  // Show feedback toast
  const showFeedback = useCallback((action: string, customMessage?: string) => {
    const message = customMessage || getMicroFeedback(action as any, archetype || undefined);
    
    if (message) {
      toast(message, {
        duration: 2000,
        className: 'companion-toast',
      });
    }
  }, [archetype]);
  
  // Get contextual greeting
  const getContextualGreeting = useCallback((): string => {
    if (state === 'stranger') {
      return strangerMessages.homepage.hero;
    }
    
    if (userName) {
      return getGreeting(userName);
    }
    
    return getGreeting();
  }, [state, userName]);
  
  // Get archetype-aware loading messages
  const getLoadingMessages = useCallback((destination?: string): string[] => {
    const messages: string[] = [];
    
    if (destination) {
      messages.push(planningMessages.generating.start(destination));
    }
    
    // Get archetype-specific messages
    const archetypeMessages = archetype 
      ? planningMessages.generating.archetypeMessages[archetype as keyof typeof planningMessages.generating.archetypeMessages]
      : planningMessages.generating.archetypeMessages.default;
    
    if (archetypeMessages) {
      messages.push(...archetypeMessages);
    }
    
    messages.push(planningMessages.generating.final);
    messages.push(planningMessages.generating.complete);
    
    return messages;
  }, [archetype]);
  
  // All message libraries
  const messages = useMemo(() => ({
    stranger: strangerMessages,
    gettingToKnow: gettingToKnowMessages,
    revealed: revealedMessages,
    planning: planningMessages,
    booked: bookedMessages,
    traveling: travelingMessages,
    returned: returnedMessages,
    loyal: loyalMessages,
    empty: emptyStateMessages,
    error: errorMessages,
  }), []);
  
  const value = useMemo<CompanionContextType>(() => ({
    state,
    archetype,
    userName,
    getMessage,
    showFeedback,
    getContextualGreeting,
    getLoadingMessages,
    messages,
  }), [state, archetype, userName, getMessage, showFeedback, getContextualGreeting, getLoadingMessages, messages]);
  
  return (
    <CompanionContext.Provider value={value}>
      {children}
    </CompanionContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCompanion(): CompanionContextType {
  const context = useContext(CompanionContext);
  
  if (!context) {
    // Return a default context for use outside provider
    return {
      state: 'stranger',
      archetype: null,
      userName: null,
      getMessage: (key) => key,
      showFeedback: () => {},
      getContextualGreeting: () => '',
      getLoadingMessages: () => [],
      messages: {
        stranger: strangerMessages,
        gettingToKnow: gettingToKnowMessages,
        revealed: revealedMessages,
        planning: planningMessages,
        booked: bookedMessages,
        traveling: travelingMessages,
        returned: returnedMessages,
        loyal: loyalMessages,
        empty: emptyStateMessages,
        error: errorMessages,
      },
    };
  }
  
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function resolveNestedMessage(obj: any, path: string): string | null {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }
  
  return typeof current === 'string' ? current : null;
}

function resolvePlanningMessage(path: string, context?: Record<string, any>): string | null {
  const [section, key] = path.split('.');
  
  if (section === 'destination' && key === 'response' && context?.destination) {
    const dest = context.destination.toLowerCase().replace(/\s+/g, '_');
    return planningMessages.destination.knownCities[dest as keyof typeof planningMessages.destination.knownCities] 
      || planningMessages.destination.knownCities.default;
  }
  
  if (section === 'dates' && key === 'response' && typeof context?.days === 'number') {
    return planningMessages.dates.getDurationResponse(context.days);
  }
  
  if (section === 'tripType' && key === 'response' && context?.tripType) {
    return planningMessages.tripType.responses[context.tripType as keyof typeof planningMessages.tripType.responses] 
      || planningMessages.tripType.responses.default;
  }
  
  return resolveNestedMessage(planningMessages, path);
}
