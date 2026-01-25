/**
 * Behavioral Tracking Service
 * 
 * Captures implicit user signals for AI personalization:
 * - Search patterns (destinations searched but not selected)
 * - Activity interactions (clicks, saves, time spent)
 * - Itinerary edits (removals, reorders, time changes)
 * - Booking abandonment signals
 */

import { supabase } from '@/integrations/supabase/client';

// ============ TYPES ============

export type EnrichmentType = 
  | 'destination_search'
  | 'destination_decline'
  | 'destination_interest'
  | 'activity_click'
  | 'activity_save'
  | 'activity_remove'
  | 'activity_reorder'
  | 'activity_swap'      // NEW: User swapped for alternative
  | 'activity_complete'  // NEW: Activity kept through trip completion
  | 'booking_abandon'
  | 'time_change'
  | 'category_preference';

export interface TrackingEvent {
  enrichment_type: EnrichmentType;
  entity_type: 'destination' | 'activity' | 'category' | 'time_slot';
  entity_id: string;
  entity_name: string;
  metadata?: Record<string, unknown>;
  feedback_tags?: string[];
}

// ============ DEBOUNCE CACHE ============
// Prevent duplicate tracking within short windows

const recentEvents = new Map<string, number>();
const DEBOUNCE_MS = 5000; // 5 second debounce

function shouldTrack(eventKey: string): boolean {
  const now = Date.now();
  const lastTracked = recentEvents.get(eventKey);
  
  if (lastTracked && now - lastTracked < DEBOUNCE_MS) {
    return false;
  }
  
  recentEvents.set(eventKey, now);
  
  // Cleanup old entries periodically
  if (recentEvents.size > 100) {
    const cutoff = now - DEBOUNCE_MS * 2;
    for (const [key, time] of recentEvents.entries()) {
      if (time < cutoff) recentEvents.delete(key);
    }
  }
  
  return true;
}

// ============ CORE TRACKING FUNCTION ============

async function trackEvent(event: TrackingEvent): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Don't track anonymous users
    
    const eventKey = `${user.id}:${event.enrichment_type}:${event.entity_id}`;
    if (!shouldTrack(eventKey)) return;
    
    // Check for existing enrichment record
    const { data: existing } = await supabase
      .from('user_enrichment')
      .select('id, interaction_count, metadata, feedback_tags')
      .eq('user_id', user.id)
      .eq('enrichment_type', event.enrichment_type)
      .eq('entity_id', event.entity_id)
      .maybeSingle();
    
    const now = new Date().toISOString();
    
    if (existing) {
      // Update existing record - increment interaction count
      const newCount = (existing.interaction_count || 1) + 1;
      const existingMetadata = (existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)) 
        ? existing.metadata as Record<string, unknown>
        : {};
      
      const interactionHistory = Array.isArray((existingMetadata as any).interaction_history) 
        ? (existingMetadata as any).interaction_history.slice(-9) 
        : [];
      
      await supabase
        .from('user_enrichment')
        .update({
          interaction_count: newCount,
          metadata: {
            ...existingMetadata,
            ...event.metadata,
            last_interaction_at: now,
            interaction_history: [
              ...interactionHistory,
              { at: now, ...event.metadata }
            ]
          },
          feedback_tags: event.feedback_tags || existing.feedback_tags,
        })
        .eq('id', existing.id);
    } else {
      // Insert new record
      await supabase
        .from('user_enrichment')
        .insert({
          user_id: user.id,
          enrichment_type: event.enrichment_type,
          entity_type: event.entity_type,
          entity_id: event.entity_id,
          entity_name: event.entity_name,
          interaction_count: 1,
          feedback_tags: event.feedback_tags,
          metadata: {
            ...event.metadata,
            first_interaction_at: now,
            last_interaction_at: now,
          },
        });
    }
  } catch (error) {
    // Silent fail - don't disrupt UX for tracking
    console.debug('[BehaviorTracking] Error:', error);
  }
}

// ============ PUBLIC API ============

/**
 * Track when user searches for a destination
 */
export function trackDestinationSearch(
  destination: string,
  resultsCount: number
): void {
  const normalized = destination.toLowerCase().trim();
  if (!normalized || normalized.length < 2) return;
  
  trackEvent({
    enrichment_type: 'destination_search',
    entity_type: 'destination',
    entity_id: normalized.replace(/\s+/g, '_'),
    entity_name: destination,
    metadata: { 
      query: destination,
      results_count: resultsCount,
      searched_at: new Date().toISOString()
    }
  });
}

/**
 * Track when user shows interest in a destination (clicks, hovers, etc.)
 */
export function trackDestinationInterest(
  city: string,
  country: string,
  source: 'card_click' | 'details_view' | 'compare' | 'save'
): void {
  const entityId = `${city.toLowerCase()}_${country.toLowerCase()}`.replace(/\s+/g, '_');
  
  trackEvent({
    enrichment_type: 'destination_interest',
    entity_type: 'destination',
    entity_id: entityId,
    entity_name: `${city}, ${country}`,
    metadata: { source }
  });
}

/**
 * Track when user clicks on an activity in the itinerary
 */
export function trackActivityClick(
  activityId: string,
  activityName: string,
  category: string,
  destination: string
): void {
  trackEvent({
    enrichment_type: 'activity_click',
    entity_type: 'activity',
    entity_id: activityId,
    entity_name: activityName,
    metadata: { category, destination }
  });
  
  // Also track category preference
  trackCategoryInteraction(category, 'click');
}

/**
 * Track when user removes an activity from itinerary
 */
export function trackActivityRemoval(
  activityId: string,
  activityName: string,
  category: string,
  reason?: string
): void {
  trackEvent({
    enrichment_type: 'activity_remove',
    entity_type: 'activity',
    entity_id: activityId,
    entity_name: activityName,
    metadata: { category, reason },
    feedback_tags: reason ? [reason] : undefined
  });
  
  // Track negative category signal
  trackCategoryInteraction(category, 'remove');
}

/**
 * Track when user swaps an activity for an alternative
 * Captures personalization tags from both original and replacement
 */
export function trackActivitySwap(
  originalActivityId: string,
  originalActivityName: string,
  originalCategory: string,
  originalPersonalizationTags: string[],
  newActivityId: string,
  newActivityName: string,
  newCategory: string,
  newPersonalizationTags: string[],
  destination?: string
): void {
  // Track the swap event with all personalization context
  trackEvent({
    enrichment_type: 'activity_swap',
    entity_type: 'activity',
    entity_id: originalActivityId,
    entity_name: originalActivityName,
    metadata: { 
      original_category: originalCategory,
      original_tags: originalPersonalizationTags,
      new_activity_id: newActivityId,
      new_activity_name: newActivityName,
      new_category: newCategory,
      new_tags: newPersonalizationTags,
      destination
    },
    feedback_tags: originalPersonalizationTags // Tags that were rejected
  });
  
  // Track negative signal for original category
  trackCategoryInteraction(originalCategory, 'remove');
  
  // Track positive signal for new category
  trackCategoryInteraction(newCategory, 'save');
}

/**
 * Track when activity is kept through trip completion (positive signal)
 */
export function trackActivityComplete(
  activityId: string,
  activityName: string,
  category: string,
  personalizationTags: string[],
  destination?: string
): void {
  trackEvent({
    enrichment_type: 'activity_complete',
    entity_type: 'activity',
    entity_id: activityId,
    entity_name: activityName,
    metadata: { category, destination },
    feedback_tags: personalizationTags
  });
  
  trackCategoryInteraction(category, 'complete');
}

/**
 * Track when user reorders activities (signals time preference)
 */
export function trackActivityReorder(
  activityId: string,
  activityName: string,
  fromPosition: number,
  toPosition: number,
  newTimeSlot?: string
): void {
  trackEvent({
    enrichment_type: 'activity_reorder',
    entity_type: 'activity',
    entity_id: activityId,
    entity_name: activityName,
    metadata: { 
      from_position: fromPosition,
      to_position: toPosition,
      new_time_slot: newTimeSlot,
      moved_earlier: toPosition < fromPosition
    }
  });
}

/**
 * Track category interactions (aggregated preferences)
 */
export function trackCategoryInteraction(
  category: string,
  action: 'click' | 'save' | 'remove' | 'complete'
): void {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '_');
  const weight = action === 'remove' ? -1 : action === 'complete' ? 2 : 1;
  
  trackEvent({
    enrichment_type: 'category_preference',
    entity_type: 'category',
    entity_id: normalizedCategory,
    entity_name: category,
    metadata: { action, weight }
  });
}

/**
 * Track time preference signals (when user changes activity times)
 */
export function trackTimePreference(
  originalTime: string,
  newTime: string,
  activityCategory: string
): void {
  const getTimeSlot = (time: string): string => {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 10) return 'early_morning';
    if (hour < 12) return 'morning';
    if (hour < 14) return 'midday';
    if (hour < 17) return 'afternoon';
    if (hour < 20) return 'evening';
    return 'night';
  };
  
  const originalSlot = getTimeSlot(originalTime);
  const newSlot = getTimeSlot(newTime);
  
  if (originalSlot !== newSlot) {
    trackEvent({
      enrichment_type: 'time_change',
      entity_type: 'time_slot',
      entity_id: `${activityCategory}_${newSlot}`,
      entity_name: `${activityCategory} → ${newSlot}`,
      metadata: {
        original_slot: originalSlot,
        new_slot: newSlot,
        category: activityCategory,
        prefers_earlier: newTime < originalTime
      }
    });
  }
}

/**
 * Track booking abandonment (started but didn't complete)
 */
export function trackBookingAbandonment(
  activityId: string,
  activityName: string,
  stage: 'clicked_book' | 'viewed_price' | 'started_checkout'
): void {
  trackEvent({
    enrichment_type: 'booking_abandon',
    entity_type: 'activity',
    entity_id: activityId,
    entity_name: activityName,
    metadata: { stage, abandoned_at: new Date().toISOString() }
  });
}

// ============ BATCH AGGREGATION ============

/**
 * Aggregate user's behavioral signals for prompt injection
 * Called by edge functions before itinerary generation
 */
export async function getAggregatedBehaviorSignals(userId: string): Promise<{
  searchedDestinations: string[];
  interestedCategories: { category: string; weight: number }[];
  avoidCategories: { category: string; weight: number }[];
  timePreferences: { category: string; preferredSlot: string }[];
  removedActivityTypes: string[];
}> {
  try {
    const { data: enrichments } = await supabase
      .from('user_enrichment')
      .select('enrichment_type, entity_id, entity_name, interaction_count, metadata, feedback_tags')
      .eq('user_id', userId)
      .in('enrichment_type', [
        'destination_search',
        'category_preference',
        'time_change',
        'activity_remove'
      ])
      .order('interaction_count', { ascending: false })
      .limit(100);
    
    if (!enrichments?.length) {
      return {
        searchedDestinations: [],
        interestedCategories: [],
        avoidCategories: [],
        timePreferences: [],
        removedActivityTypes: []
      };
    }
    
    // Process search patterns
    const searchedDestinations = enrichments
      .filter(e => e.enrichment_type === 'destination_search')
      .slice(0, 10)
      .map(e => e.entity_name);
    
    // Process category preferences
    const categoryMap = new Map<string, number>();
    enrichments
      .filter(e => e.enrichment_type === 'category_preference')
      .forEach(e => {
        const weight = (e.metadata as any)?.weight || 1;
        const current = categoryMap.get(e.entity_id) || 0;
        categoryMap.set(e.entity_id, current + weight * (e.interaction_count || 1));
      });
    
    const sortedCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const interestedCategories = sortedCategories
      .filter(([_, weight]) => weight > 0)
      .slice(0, 5)
      .map(([category, weight]) => ({ category, weight }));
    
    const avoidCategories = sortedCategories
      .filter(([_, weight]) => weight < 0)
      .slice(0, 5)
      .map(([category, weight]) => ({ category, weight: Math.abs(weight) }));
    
    // Process time preferences
    const timeMap = new Map<string, Map<string, number>>();
    enrichments
      .filter(e => e.enrichment_type === 'time_change')
      .forEach(e => {
        const meta = e.metadata as any;
        if (meta?.category && meta?.new_slot) {
          if (!timeMap.has(meta.category)) {
            timeMap.set(meta.category, new Map());
          }
          const slots = timeMap.get(meta.category)!;
          slots.set(meta.new_slot, (slots.get(meta.new_slot) || 0) + 1);
        }
      });
    
    const timePreferences = Array.from(timeMap.entries())
      .map(([category, slots]) => {
        const [preferredSlot] = Array.from(slots.entries())
          .sort((a, b) => b[1] - a[1])[0] || ['morning'];
        return { category, preferredSlot };
      });
    
    // Process removed activity types
    const removedActivityTypes = enrichments
      .filter(e => e.enrichment_type === 'activity_remove')
      .slice(0, 10)
      .map(e => (e.metadata as any)?.category)
      .filter(Boolean);
    
    return {
      searchedDestinations,
      interestedCategories,
      avoidCategories,
      timePreferences,
      removedActivityTypes: [...new Set(removedActivityTypes)]
    };
  } catch (error) {
    console.error('[BehaviorTracking] Aggregation error:', error);
    return {
      searchedDestinations: [],
      interestedCategories: [],
      avoidCategories: [],
      timePreferences: [],
      removedActivityTypes: []
    };
  }
}
