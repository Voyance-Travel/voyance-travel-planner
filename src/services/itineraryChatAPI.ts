/**
 * Itinerary Assistant API Service
 * Frontend interface for the constrained itinerary chatbot
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ItineraryAction[];
  timestamp: Date;
}

export interface ItineraryAction {
  type: 'suggest_activity_swap' | 'adjust_day_pacing' | 'apply_filter' | 'regenerate_day' | 'rewrite_day' | 'propose_change' | 'record_user_intent' | 'answer_question';
  params: Record<string, unknown>;
  status: 'pending' | 'applied' | 'declined' | 'failed';
}

export interface ItineraryContext {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  currentDayNumber?: number;
  days: Array<{
    dayNumber: number;
    date: string;
    activities: Array<{
      index: number;
      title: string;
      category?: string;
      time: string;
      cost?: number;
      isLocked?: boolean;
    }>;
  }>;
  accommodationInfo?: {
    name: string;
    neighborhood?: string;
    city?: string;
  };
  blendedDna?: {
    blendedTraits: Record<string, number>;
    travelerProfiles: Array<{ userId: string; name: string; archetypeId: string; isOwner: boolean; weight: number }>;
    isBlended: boolean;
  };
}

export interface ChatResponse {
  message: string;
  actions: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  capturedPreferences: Array<{
    type: string;
    value: string;
    confidence: string;
  }>;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Send a message to the itinerary assistant
 */
export async function sendChatMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  itineraryContext: ItineraryContext,
  conversationId?: string
): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke('itinerary-chat', {
    body: {
      messages,
      itineraryContext,
      conversationId,
      stream: false,
      blendedDna: itineraryContext.blendedDna,
    },
  });

  if (error) {
    console.error('[ItineraryChat] Error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Generate a unique conversation ID
 */
export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get action display info
 */
export function getActionDisplayInfo(action: { type: string; params: Record<string, unknown> }): {
  title: string;
  description: string;
  icon: 'swap' | 'pace' | 'filter' | 'refresh' | 'rewrite';
  creditCost: number;
} {
  switch (action.type) {
    case 'rewrite_day':
      return {
        title: `Rewrite Day ${action.params.target_day}`,
        description: action.params.reason as string || 'Rewrite this day based on your instructions',
        icon: 'rewrite',
        creditCost: 10,
      };
    case 'suggest_activity_swap':
      return {
        title: `Swap activity on Day ${action.params.target_day}`,
        description: action.params.reason as string || `Find alternatives for "${action.params.target_activity_title}"`,
        icon: 'swap',
        creditCost: 5,
      };
    case 'adjust_day_pacing':
      const adjustment = action.params.adjustment as string;
      return {
        title: `Adjust Day ${action.params.target_day} pacing`,
        description: adjustment === 'more_relaxed' 
          ? 'Make the day more relaxed with fewer activities'
          : 'Pack in more activities for an action-filled day',
        icon: 'pace',
        creditCost: 5,
      };
    case 'apply_filter':
      return {
        title: `Apply ${action.params.filter_type} filter`,
        description: `Filter for: ${action.params.filter_value}`,
        icon: 'filter',
        creditCost: 5,
      };
    case 'regenerate_day':
      return {
        title: `Regenerate Day ${action.params.target_day}`,
        description: action.params.new_focus as string || 'Create a new itinerary for this day',
        icon: 'refresh',
        creditCost: 10,
      };
    case 'propose_change': {
      const wouldCall = action.params.would_call as string | undefined;
      const creditMap: Record<string, number> = {
        rewrite_day: 10,
        regenerate_day: 10,
        suggest_activity_swap: 5,
        adjust_day_pacing: 5,
        apply_filter: 5,
      };
      const iconMap: Record<string, 'swap' | 'pace' | 'filter' | 'refresh' | 'rewrite'> = {
        rewrite_day: 'rewrite',
        regenerate_day: 'refresh',
        suggest_activity_swap: 'swap',
        adjust_day_pacing: 'pace',
        apply_filter: 'filter',
      };
      return {
        title: `Suggested change · Day ${action.params.target_day}`,
        description: (action.params.summary as string) || 'Apply this suggested change?',
        icon: (wouldCall && iconMap[wouldCall]) || 'rewrite',
        creditCost: (wouldCall && creditMap[wouldCall]) ?? 5,
      };
    }
    case 'record_user_intent':
      return {
        title: `Saved request · Day ${action.params.dayNumber ?? action.params.target_day}`,
        description: (action.params.title as string) || 'Saved for the next regeneration',
        icon: 'rewrite',
        creditCost: 0,
      };
    default:
      return {
        title: 'Unknown action',
        description: '',
        icon: 'swap',
        creditCost: 5,
      };
  }
}

/**
 * Calculate total credit cost for a set of actions
 */
export function calculateActionsCreditCost(actions: Array<{ type: string; params: Record<string, unknown> }>): number {
  return actions.reduce((total, action) => {
    const info = getActionDisplayInfo(action);
    return total + info.creditCost;
  }, 0);
}

export default {
  sendChatMessage,
  generateConversationId,
  getActionDisplayInfo,
};
