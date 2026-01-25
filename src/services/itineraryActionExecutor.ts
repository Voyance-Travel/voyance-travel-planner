/**
 * Itinerary Action Executor
 * Handles executing chatbot actions (swaps, regenerations, filters)
 * using the existing get-activity-alternatives edge function
 */

import { supabase } from '@/integrations/supabase/client';
import type { ItineraryAction } from './itineraryChatAPI';
import type { Json } from '@/integrations/supabase/types';

// ============================================================================
// GUARDRAILS (COMMON-SENSE SCHEDULING)
// - Never alter travel-critical blocks (arrival/airport/transfer/check-in/out)
// - Keep meal structure unless the user is explicitly filtering dining
// - Avoid spammy duplicates (e.g. multiple "sunset" blocks in a row)
// ============================================================================

const PROTECTED_ACTIVITY_KEYWORDS = [
  'arrival',
  'land',
  'flight',
  'airport',
  'customs',
  'immigration',
  'baggage',
  'transfer',
  'check-in',
  'check in',
  'check-out',
  'check out',
  'hotel check-in',
  'hotel check in',
  'hotel check-out',
  'hotel check out',
  'drive to',
  'train to',
  'depart',
];

const PROTECTED_CATEGORIES = [
  'transport',
  'transportation',
  'transfer',
  'flight',
  'logistics',
  'accommodation',
];

const MEAL_KEYWORDS = ['breakfast', 'brunch', 'lunch', 'dinner', 'restaurant', 'cafe', 'coffee', 'meal', 'eat'];

function norm(v?: string): string {
  return (v || '').toLowerCase().trim();
}

function activityTitle(activity: Activity): string {
  return activity.title || activity.name || '';
}

function isProtectedActivity(activity: Activity): boolean {
  const title = norm(activityTitle(activity));
  const category = norm(activity.category);

  if (PROTECTED_CATEGORIES.includes(category)) return true;
  return PROTECTED_ACTIVITY_KEYWORDS.some(k => title.includes(k));
}

function isMealActivity(activity: Activity): boolean {
  const title = norm(activityTitle(activity));
  const category = norm(activity.category);
  if (category.includes('dining') || category.includes('food')) return true;
  return MEAL_KEYWORDS.some(k => title.includes(k));
}

function hasKeywordInDay(day: ItineraryDay, keyword: string): boolean {
  const k = norm(keyword);
  return day.activities.some(a => norm(activityTitle(a)).includes(k));
}

// ============================================================================
// TYPES
// ============================================================================

export interface Activity {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  startTime?: string;
  time?: string;
  cost?: { amount?: number };
  isLocked?: boolean;
  location?: { name?: string; address?: string };
  [key: string]: unknown;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  theme?: string;
  description?: string;
  activities: Activity[];
  [key: string]: unknown;
}

interface AlternativeActivity {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: string;
  estimatedCost: number;
  location: string;
  rating: number;
  matchScore: number;
  whyRecommended: string;
}

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  updatedDays?: ItineraryDay[];
  alternatives?: AlternativeActivity[];
  error?: string;
}

// ============================================================================
// CORE EXECUTION FUNCTIONS
// ============================================================================

/**
 * Execute an itinerary action and return the result
 */
export async function executeAction(
  action: ItineraryAction,
  tripId: string,
  currentDays: ItineraryDay[],
  destination: string
): Promise<ActionExecutionResult> {
  console.log('[ActionExecutor] Executing action:', action.type, action.params);

  switch (action.type) {
    case 'suggest_activity_swap':
      return executeSwapAction(action, tripId, currentDays, destination);
    
    case 'regenerate_day':
      return executeRegenerateAction(action, tripId, currentDays, destination);
    
    case 'adjust_day_pacing':
      return executePacingAction(action, tripId, currentDays, destination);
    
    case 'apply_filter':
      return executeFilterAction(action, tripId, currentDays, destination);
    
    default:
      return {
        success: false,
        message: 'Unknown action type',
        error: `Action type "${action.type}" is not supported`,
      };
  }
}

/**
 * Execute a swap action - get alternatives and apply the best match
 */
async function executeSwapAction(
  action: ItineraryAction,
  tripId: string,
  currentDays: ItineraryDay[],
  destination: string
): Promise<ActionExecutionResult> {
  const {
    target_day,
    target_activity_index,
    target_activity_title,
    reason,
    preference_hint,
  } = action.params as {
    target_day: number;
    target_activity_index?: number;
    target_activity_title?: string;
    reason?: string;
    preference_hint?: string;
  };

  // Find the target day
  const dayIndex = currentDays.findIndex(d => d.dayNumber === target_day);
  if (dayIndex === -1) {
    return {
      success: false,
      message: `Day ${target_day} not found in itinerary`,
      error: 'Day not found',
    };
  }

  const day = currentDays[dayIndex];
  
  // Find the target activity
  let activityIndex = target_activity_index;
  if (activityIndex === undefined && target_activity_title) {
    activityIndex = day.activities.findIndex(
      a => (a.title || a.name)?.toLowerCase().includes(target_activity_title.toLowerCase())
    );
  }

  if (activityIndex === undefined || activityIndex < 0 || activityIndex >= day.activities.length) {
    return {
      success: false,
      message: `Activity "${target_activity_title}" not found on Day ${target_day}`,
      error: 'Activity not found',
    };
  }

  const targetActivity = day.activities[activityIndex];
  
  // Check if activity is locked
  if (targetActivity.isLocked) {
    return {
      success: false,
      message: `"${targetActivity.title || targetActivity.name}" is locked and cannot be swapped`,
      error: 'Activity is locked',
    };
  }

  // Guardrail: never swap travel-critical blocks unless explicitly rebuilt via full generator
  if (isProtectedActivity(targetActivity)) {
    return {
      success: false,
      message: `That item is part of your travel logistics (arrival/transfer/check-in) and can't be swapped via chat.`,
      error: 'Protected activity',
    };
  }

  // Build search query from preference hint or reason
  const searchQuery = preference_hint || reason || '';
  
  // Collect all existing activity names to exclude from suggestions
  const existingActivityNames = currentDays.flatMap(d => 
    d.activities.map(a => a.title || a.name).filter(Boolean)
  ) as string[];

  // Fetch alternatives using the existing edge function
  const { data, error } = await supabase.functions.invoke('get-activity-alternatives', {
    body: {
      currentActivity: {
        id: targetActivity.id || `act-${dayIndex}-${activityIndex}`,
        name: targetActivity.title || targetActivity.name || 'Activity',
        type: targetActivity.category || 'activity',
        description: targetActivity.description,
        time: targetActivity.startTime || targetActivity.time,
      },
      destination,
      searchQuery,
      excludeActivities: existingActivityNames,
    },
  });

  if (error || !data?.success) {
    return {
      success: false,
      message: 'Failed to fetch alternatives',
      error: error?.message || data?.error || 'Unknown error',
    };
  }

  const alternatives = data.alternatives as AlternativeActivity[];
  
  if (!alternatives || alternatives.length === 0) {
    return {
      success: false,
      message: 'No suitable alternatives found',
      error: 'No alternatives available',
    };
  }

  // Pick the best alternative (highest matchScore)
  const bestAlternative = alternatives.reduce((best, curr) => 
    (curr.matchScore > best.matchScore) ? curr : best
  );

  // Apply the swap to the itinerary
  const updatedDays = [...currentDays];
  updatedDays[dayIndex] = {
    ...day,
    activities: day.activities.map((act, idx) => {
      if (idx === activityIndex) {
        return {
          ...act,
          id: bestAlternative.id,
          title: bestAlternative.name,
          name: bestAlternative.name,
          description: bestAlternative.description,
          category: bestAlternative.category,
          cost: { amount: bestAlternative.estimatedCost },
          location: { name: bestAlternative.location },
          // Preserve timing
          startTime: act.startTime,
          time: act.time,
          isLocked: false,
        };
      }
      return act;
    }),
  };

  // Update the trip in database
  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: `Swapped "${targetActivity.title || targetActivity.name}" → "${bestAlternative.name}"`,
    updatedDays,
    alternatives,
  };
}

/**
 * Execute a regenerate day action
 */
async function executeRegenerateAction(
  action: ItineraryAction,
  tripId: string,
  currentDays: ItineraryDay[],
  destination: string
): Promise<ActionExecutionResult> {
  const { target_day, new_focus } = action.params as {
    target_day: number;
    new_focus?: string;
  };

  const dayIndex = currentDays.findIndex(d => d.dayNumber === target_day);
  if (dayIndex === -1) {
    return {
      success: false,
      message: `Day ${target_day} not found`,
      error: 'Day not found',
    };
  }

  const day = currentDays[dayIndex];

  // IMPORTANT:
  // Chat-based "regenerate" should NOT do naive activity-by-activity swaps.
  // Use the same flight-aware day generator used elsewhere so we keep:
  // - arrival/airport/transfer/check-in sequencing
  // - meals / sane pacing
  // - realistic time windows
  const keepActivities = day.activities
    .filter(a => a.isLocked || isProtectedActivity(a) || isMealActivity(a))
    .map(a => a.id)
    .filter(Boolean);

  const { data, error } = await supabase.functions.invoke('generate-itinerary', {
    body: {
      action: 'regenerate-day',
      tripId,
      dayNumber: target_day,
      destination,
      keepActivities,
      // Pass the full current activities so edge function can preserve locked ones
      currentActivities: day.activities,
      // Soft hint only; generator may ignore unknown preference keys
      preferences: new_focus ? { dayFocus: new_focus } : undefined,
    },
  });

  if (error || !data?.day) {
    return {
      success: false,
      message: 'Failed to regenerate day with scheduling constraints',
      error: error?.message || data?.error || 'Unknown error',
    };
  }

  const updatedDays = [...currentDays];
  updatedDays[dayIndex] = {
    ...day,
    ...data.day,
    activities: data.day.activities || day.activities,
  };

  // The generator already persists; also update local trip copy for UI consistency
  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: `Refreshed Day ${target_day}${new_focus ? ` (more “${new_focus}”)` : ''} without breaking flight/arrival timing`,
    updatedDays,
  };
}

/**
 * Execute a pacing adjustment action
 */
async function executePacingAction(
  action: ItineraryAction,
  tripId: string,
  currentDays: ItineraryDay[],
  destination: string
): Promise<ActionExecutionResult> {
  const { target_day, adjustment } = action.params as {
    target_day: number;
    adjustment: 'more_relaxed' | 'more_packed';
  };

  const dayIndex = currentDays.findIndex(d => d.dayNumber === target_day);
  if (dayIndex === -1) {
    return {
      success: false,
      message: `Day ${target_day} not found`,
      error: 'Day not found',
    };
  }

  const day = currentDays[dayIndex];
  let updatedActivities = [...day.activities];

  if (adjustment === 'more_relaxed') {
    // Remove the lowest priority unlocked activity
    const unlockedIdx = updatedActivities.findIndex(a => !a.isLocked);
    if (unlockedIdx !== -1 && updatedActivities.length > 2) {
      updatedActivities.splice(unlockedIdx, 1);
    }
  } else if (adjustment === 'more_packed') {
    // Add an additional activity suggestion
    const existingActivity = day.activities.find(a => !a.isLocked) || day.activities[0];
    
    const { data, error } = await supabase.functions.invoke('get-activity-alternatives', {
      body: {
        currentActivity: {
          id: 'new',
          name: 'Quick Activity',
          type: 'activity',
        },
        destination,
        searchQuery: 'quick nearby experience',
      },
    });

    if (!error && data?.success && data.alternatives?.length > 0) {
      const alternatives = data.alternatives as AlternativeActivity[];
      const newActivity = alternatives[0];
      
      updatedActivities.push({
        id: newActivity.id,
        title: newActivity.name,
        name: newActivity.name,
        description: newActivity.description,
        category: newActivity.category,
        cost: { amount: newActivity.estimatedCost },
        location: { name: newActivity.location },
        startTime: '15:00', // Default afternoon slot
        isLocked: false,
      });
    }
  }

  const updatedDays = [...currentDays];
  updatedDays[dayIndex] = {
    ...day,
    activities: updatedActivities,
  };

  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: adjustment === 'more_relaxed'
      ? `Made Day ${target_day} more relaxed`
      : `Added more activities to Day ${target_day}`,
    updatedDays,
  };
}

/**
 * Execute a filter action (dietary, accessibility, budget)
 */
async function executeFilterAction(
  action: ItineraryAction,
  tripId: string,
  currentDays: ItineraryDay[],
  destination: string
): Promise<ActionExecutionResult> {
  // NOTE: the chatbot tool schema uses scopes like "entire_trip"/"specific_day".
  // Keep this parsing permissive so we don't accidentally apply a trip-wide rewrite.
  const { filter_type, filter_value, scope, target_day } = action.params as {
    filter_type: string;
    filter_value: string;
    scope?: 'all' | 'day' | 'entire_trip' | 'specific_day' | 'dining_only' | 'activities_only';
    target_day?: number;
  };

  const searchQuery = `${filter_type}: ${filter_value}`;
  const allAlternatives: AlternativeActivity[] = [];
  const updatedDays = [...currentDays];
  let swapCount = 0;

  const existingActivityNames = currentDays
    .flatMap(d => d.activities.map(a => activityTitle(a)).filter(Boolean))
    .map(s => s.trim());

  // Determine which days to apply to
  const normalizedScope = scope || 'entire_trip';
  const dayIndexes: number[] = (() => {
    if (normalizedScope === 'day' || normalizedScope === 'specific_day') {
      if (!target_day) return [];
      const idx = currentDays.findIndex(d => d.dayNumber === target_day);
      return idx >= 0 ? [idx] : [];
    }
    return currentDays.map((_, idx) => idx);
  })();

  // For "romantic" and similar vibe filters: avoid rewriting the whole day.
  // Make at most a couple swaps per day and never touch meals/logistics.
  const maxSwapsPerDay = (filter_type === 'romantic' || filter_type === 'adventure' || filter_type === 'family_friendly')
    ? 2
    : 999;

  // Apply filter to relevant days
  for (const dayIndex of dayIndexes) {
    const day = currentDays[dayIndex];
    const updatedActivities = [...day.activities];
    let swapsThisDay = 0;

    for (let actIndex = 0; actIndex < day.activities.length; actIndex++) {
      const activity = day.activities[actIndex];
      if (activity.isLocked) continue;

      // Guardrail: never touch arrival/transfer/check-in/out blocks via filters
      if (isProtectedActivity(activity)) continue;

      // Guardrail: keep meals unless filter explicitly targets dining
      const diningOnly = normalizedScope === 'dining_only' || filter_type === 'dietary';
      const activitiesOnly = normalizedScope === 'activities_only' || filter_type === 'romantic' || filter_type === 'adventure';
      if (diningOnly && !isMealActivity(activity)) continue;
      if (activitiesOnly && isMealActivity(activity)) continue;

      if (swapsThisDay >= maxSwapsPerDay) continue;

      // For dietary/accessibility, focus on dining or relevant categories
      const shouldFilter = 
        filter_type === 'dietary' ? activity.category?.toLowerCase().includes('dining') || activity.category?.toLowerCase().includes('food') :
        filter_type === 'accessibility' ? true :
        filter_type === 'budget' ? true :
        true;

      if (!shouldFilter) continue;

      const { data, error } = await supabase.functions.invoke('get-activity-alternatives', {
        body: {
          currentActivity: {
            id: activity.id || `act-${dayIndex}-${actIndex}`,
            name: activity.title || activity.name || 'Activity',
            type: activity.category || 'activity',
            description: activity.description,
            time: activity.startTime || activity.time,
          },
          destination,
          searchQuery,
          excludeActivities: existingActivityNames,
        },
      });

      if (!error && data?.success && data.alternatives?.length > 0) {
        const alternatives = data.alternatives as AlternativeActivity[];
        const best = alternatives[0];
        
        // Only count as a swap if the new activity is actually different
        const currentName = (activity.title || activity.name || '').toLowerCase().trim();
        const newName = (best.name || '').toLowerCase().trim();
        const isSameActivity = currentName === newName || 
          currentName.includes(newName) || 
          newName.includes(currentName);
        
        // Simple dedupe for spammy concepts like multiple "sunset" blocks
        const bestName = norm(best.name);
        const wouldDuplicateSunset = bestName.includes('sunset') && hasKeywordInDay(day, 'sunset');
        const wouldDuplicateOpera = bestName.includes('opera') && hasKeywordInDay(day, 'opera');

        if (!isSameActivity && !wouldDuplicateSunset && !wouldDuplicateOpera) {
          allAlternatives.push(...alternatives);
          updatedActivities[actIndex] = {
            ...activity,
            id: best.id,
            title: best.name,
            name: best.name,
            description: best.description,
            category: best.category,
            cost: { amount: best.estimatedCost },
            location: { name: best.location },
            isLocked: false,
          };
          swapCount++;
          swapsThisDay++;
        }
      }
    }

    updatedDays[dayIndex] = { ...day, activities: updatedActivities };
  }

  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: swapCount > 0 
      ? `Applied ${filter_type} filter "${filter_value}" - updated ${swapCount} activities`
      : `No activities needed updating for ${filter_type} filter`,
    updatedDays,
    alternatives: allAlternatives,
  };
}

// ============================================================================
// DATABASE UPDATE
// ============================================================================

/**
 * Update the trip's itinerary_data in the database
 */
async function updateTripItinerary(tripId: string, updatedDays: ItineraryDay[]): Promise<void> {
  try {
    // First get the current trip to preserve other itinerary_data fields
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .maybeSingle();

    if (fetchError) {
      console.error('[ActionExecutor] Error fetching trip:', fetchError);
      return;
    }

    const currentData = (trip?.itinerary_data as Record<string, unknown>) || {};
    
    // Update with new days - serialize to JSON for Supabase
    const itineraryUpdate: Json = {
      ...currentData,
      days: JSON.parse(JSON.stringify(updatedDays)),
    } as Json;
    
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        itinerary_data: itineraryUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (updateError) {
      console.error('[ActionExecutor] Error updating trip:', updateError);
    } else {
      console.log('[ActionExecutor] Trip itinerary updated successfully');
    }
  } catch (err) {
    console.error('[ActionExecutor] Update error:', err);
  }
}

/**
 * Update localStorage for local trips
 */
export function updateLocalTripItinerary(tripId: string, updatedDays: ItineraryDay[]): void {
  try {
    const localTripsRaw = localStorage.getItem('voyance_local_trips');
    if (localTripsRaw) {
      const localTrips = JSON.parse(localTripsRaw);
      if (localTrips?.[tripId]) {
        localTrips[tripId].itinerary_data = {
          ...localTrips[tripId].itinerary_data,
          days: updatedDays,
        };
        localTrips[tripId].updated_at = new Date().toISOString();
        localStorage.setItem('voyance_local_trips', JSON.stringify(localTrips));
        console.log('[ActionExecutor] Local trip updated');
      }
    }
  } catch (err) {
    console.error('[ActionExecutor] Local update error:', err);
  }
}
