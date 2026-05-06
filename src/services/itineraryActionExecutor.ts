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
// ============================================================================

const PROTECTED_ACTIVITY_KEYWORDS = [
  'arrival', 'land', 'flight', 'airport', 'customs', 'immigration',
  'baggage', 'transfer', 'check-in', 'check in', 'check-out', 'check out',
  'hotel check-in', 'hotel check in', 'hotel check-out', 'hotel check out',
  'drive to', 'train to', 'depart',
];

const PROTECTED_CATEGORIES = [
  'transport', 'transportation', 'transfer', 'flight', 'logistics', 'accommodation',
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

function isAccommodationActivity(activity: Activity): boolean {
  const cat = norm(activity.category);
  const title = norm(activityTitle(activity));
  return cat === 'accommodation' || cat === 'hotel' || cat === 'stay'
    || title.includes('hotel check') || title.includes('check-in at')
    || title.includes('check into') || title.includes('check in at');
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
  cost?: { amount?: number; currency?: string };
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

export interface DiffEntry {
  type: 'removed' | 'added' | 'moved' | 'modified';
  dayNumber: number;
  activityTitle: string;
  category?: string;
  costBefore?: number;
  costAfter?: number;
}

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  updatedDays?: ItineraryDay[];
  alternatives?: AlternativeActivity[];
  diff?: DiffEntry[];
  costDelta?: number; // positive = more expensive, negative = cheaper
  error?: string;
}

// ============================================================================
// DIFF & BUDGET VALIDATION
// ============================================================================

function getActivityCost(a: Activity): number {
  if (typeof a.cost === 'number') return a.cost;
  if (a.cost && typeof a.cost === 'object' && 'amount' in a.cost) return (a.cost as { amount?: number }).amount || 0;
  return 0;
}

/**
 * Compute a diff between old and new day activities
 */
export function computeDayDiff(dayNumber: number, oldActivities: Activity[], newActivities: Activity[]): DiffEntry[] {
  const diff: DiffEntry[] = [];
  const oldIds = new Set(oldActivities.map(a => a.id));
  const newIds = new Set(newActivities.map(a => a.id));
  const oldByTitle = new Map(oldActivities.map(a => [(a.title || a.name || '').toLowerCase(), a]));
  const newByTitle = new Map(newActivities.map(a => [(a.title || a.name || '').toLowerCase(), a]));

  for (const a of oldActivities) {
    const title = (a.title || a.name || '').toLowerCase();
    if (!newIds.has(a.id) && !newByTitle.has(title)) {
      diff.push({ type: 'removed', dayNumber, activityTitle: a.title || a.name || '', category: a.category, costBefore: getActivityCost(a) });
    }
  }
  for (const a of newActivities) {
    const title = (a.title || a.name || '').toLowerCase();
    if (!oldIds.has(a.id) && !oldByTitle.has(title)) {
      diff.push({ type: 'added', dayNumber, activityTitle: a.title || a.name || '', category: a.category, costAfter: getActivityCost(a) });
    }
  }
  return diff;
}

/**
 * Compute total cost for a day
 */
function computeDayCost(activities: Activity[]): number {
  return activities.reduce((sum, a) => sum + getActivityCost(a), 0);
}

/**
 * Detect budget direction intent from user message context
 */
export function detectBudgetIntent(actions: Array<{ type: string; params: Record<string, unknown> }>): 'cheaper' | 'expensive' | null {
  for (const action of actions) {
    const instructions = String(action.params.instructions || action.params.reason || '').toLowerCase();
    const cheaperWords = ['cheaper', 'budget', 'save', 'less expensive', 'more affordable', 'cut cost', 'reduce cost', 'lower cost', 'frugal', 'economical'];
    const expensiveWords = ['luxury', 'premium', 'upscale', 'splurge', 'high-end', 'more expensive'];
    if (cheaperWords.some(w => instructions.includes(w))) return 'cheaper';
    if (expensiveWords.some(w => instructions.includes(w))) return 'expensive';
  }
  return null;
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
    
    case 'rewrite_day':
      return executeRewriteDayAction(action, tripId, currentDays, destination);
    
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
 * Execute a rewrite_day action
 */
async function executeRewriteDayAction(
  action: ItineraryAction,
  tripId: string,
  currentDays: ItineraryDay[],
  destination: string
): Promise<ActionExecutionResult> {
  const { target_day, instructions, preserve_locked = true, reason } = action.params as {
    target_day: number;
    instructions: string;
    preserve_locked?: boolean;
    reason?: string;
  };

  const dayIndex = currentDays.findIndex(d => d.dayNumber === target_day);
  if (dayIndex === -1) {
    return { success: false, message: `Day ${target_day} not found`, error: 'Day not found' };
  }

  const day = currentDays[dayIndex];
  const keepActivities = preserve_locked
    ? day.activities.filter(a => a.isLocked || isProtectedActivity(a)).map(a => a.id).filter(Boolean)
    : [];

  const { data, error } = await supabase.functions.invoke('generate-itinerary', {
    body: {
      action: 'regenerate-day',
      tripId,
      dayNumber: target_day,
      destination,
      keepActivities,
      currentActivities: day.activities,
      preferences: {
        dayFocus: instructions,
        rewriteInstructions: instructions,
      },
    },
  });

  if (error || !data?.day) {
    return { success: false, message: 'Failed to rewrite day', error: error?.message || data?.error || 'Unknown error' };
  }

  let newActivities = data.day.activities || day.activities;

  // Preserve distinct accommodation intents (check-in, freshen-up, return, checkout)
  // instead of collapsing all hotel cards into one
  {
    const { mergeAccommodationActivities } = await import('@/utils/accommodationActivities');
    newActivities = mergeAccommodationActivities(day.activities, newActivities);
  }

  // Budget-down guard: if instructions asked for cheaper, cap costs at original levels
  const budgetDownKeywords = /cheap|budget|afford|save money|less expensive|lower cost|reduce.*cost|cut.*spending|frugal/i;
  if (budgetDownKeywords.test(instructions || '')) {
    for (const newAct of newActivities) {
      const origMatch = day.activities.find((a: any) => 
        a.startTime === newAct.startTime || a.title === newAct.title
      );
      if (origMatch) {
        const origCost = Number(origMatch.cost?.amount ?? origMatch.estimatedCost ?? 0);
        const newCost = Number(newAct.cost?.amount ?? newAct.estimatedCost ?? 0);
        // If the AI returned a MORE expensive option, cap it at the original cost
        if (newCost > origCost && origCost > 0) {
          if (newAct.cost) newAct.cost.amount = Math.max(0, origCost - 5);
          if (newAct.estimatedCost !== undefined) newAct.estimatedCost = Math.max(0, origCost - 5);
        }
      }
    }
  }

  const diff = computeDayDiff(target_day, day.activities, newActivities);

  // Surface day-level metadata changes (headline/theme/description) in the diff
  const metadataKeys = ['headline', 'theme', 'description'] as const;
  for (const key of metadataKeys) {
    const oldVal = (day as any)[key];
    const newVal = (data.day as any)?.[key];
    if (newVal && oldVal && newVal !== oldVal) {
      diff.push({
        type: 'modified',
        dayNumber: target_day,
        activityTitle: `Day ${key}: "${oldVal}" → "${newVal}"`,
        category: 'metadata',
      });
    }
  }

  const costBefore = computeDayCost(day.activities);
  const costAfter = computeDayCost(newActivities);
  const costDelta = costAfter - costBefore;

  // Preserve original day metadata unless the user explicitly asked for a title/theme change
  const themeKeywords = /rename|retheme|new theme|change.*title|new.*title|retitle/i;
  const allowMetadataOverwrite = themeKeywords.test(instructions || '');
  const mergedDay = { ...day, activities: newActivities };
  if (allowMetadataOverwrite && data.day) {
    for (const key of metadataKeys) {
      if ((data.day as any)[key]) {
        (mergedDay as any)[key] = (data.day as any)[key];
      }
    }
  }

  const updatedDays = [...currentDays];
  updatedDays[dayIndex] = mergedDay;
  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: reason || `Rewrote Day ${target_day} based on your instructions`,
    updatedDays,
    diff,
    costDelta,
  };
}

/**
 * Execute a swap action
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

  const dayIndex = currentDays.findIndex(d => d.dayNumber === target_day);
  if (dayIndex === -1) {
    return { success: false, message: `Day ${target_day} not found in itinerary`, error: 'Day not found' };
  }

  const day = currentDays[dayIndex];
  let activityIndex = target_activity_index;
  if (activityIndex === undefined && target_activity_title) {
    activityIndex = day.activities.findIndex(
      a => (a.title || a.name)?.toLowerCase().includes(target_activity_title.toLowerCase())
    );
  }

  if (activityIndex === undefined || activityIndex < 0 || activityIndex >= day.activities.length) {
    return { success: false, message: `Activity "${target_activity_title}" not found on Day ${target_day}`, error: 'Activity not found' };
  }

  const targetActivity = day.activities[activityIndex];
  if (targetActivity.isLocked) {
    return { success: false, message: `"${activityTitle(targetActivity)}" is locked and cannot be swapped`, error: 'Activity is locked' };
  }
  if (isProtectedActivity(targetActivity)) {
    return { success: false, message: `That item is part of your travel logistics and can't be swapped via chat.`, error: 'Protected activity' };
  }

  const searchQuery = preference_hint || reason || '';
  const existingActivityNames = currentDays.flatMap(d => 
    d.activities.map(a => a.title || a.name).filter(Boolean)
  ) as string[];

  const { data, error } = await supabase.functions.invoke('get-activity-alternatives', {
    body: {
      currentActivity: {
        id: targetActivity.id || `act-${dayIndex}-${activityIndex}`,
        name: activityTitle(targetActivity) || 'Activity',
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
    return { success: false, message: 'Failed to fetch alternatives', error: error?.message || data?.error || 'Unknown error' };
  }

  const alternatives = data.alternatives as AlternativeActivity[];
  if (!alternatives || alternatives.length === 0) {
    return { success: false, message: 'No suitable alternatives found', error: 'No alternatives available' };
  }

  const bestAlternative = alternatives.reduce((best, curr) => (curr.matchScore > best.matchScore) ? curr : best);

  const updatedDays = [...currentDays];
  updatedDays[dayIndex] = {
    ...day,
    activities: day.activities.map((act, idx) => {
      if (idx === activityIndex) {
        return {
          startTime: act.startTime,
          time: act.time,
          duration: act.duration,
          id: bestAlternative.id,
          title: bestAlternative.name,
          name: bestAlternative.name,
          description: bestAlternative.description,
          category: bestAlternative.category,
          cost: { amount: bestAlternative.estimatedCost, currency: 'USD' },
          location: { name: bestAlternative.location },
          rating: bestAlternative.rating,
          matchScore: bestAlternative.matchScore,
          whyRecommended: bestAlternative.whyRecommended,
          tips: undefined,
          voyanceInsight: undefined,
          isVoyancePick: false,
          reviewCount: undefined,
          isLocked: false,
        } as Activity;
      }
      return act;
    }),
  };

  const costBefore = getActivityCost(targetActivity);
  const costAfter = bestAlternative.estimatedCost || 0;
  const diff: DiffEntry[] = [
    { type: 'removed', dayNumber: target_day, activityTitle: activityTitle(targetActivity), category: targetActivity.category, costBefore },
    { type: 'added', dayNumber: target_day, activityTitle: bestAlternative.name, category: bestAlternative.category, costAfter },
  ];

  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: `Swapped "${activityTitle(targetActivity)}" → "${bestAlternative.name}"`,
    updatedDays,
    alternatives,
    diff,
    costDelta: costAfter - costBefore,
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
    return { success: false, message: `Day ${target_day} not found`, error: 'Day not found' };
  }

  const day = currentDays[dayIndex];
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
      currentActivities: day.activities,
      preferences: new_focus ? { dayFocus: new_focus } : undefined,
    },
  });

  if (error || !data?.day) {
    return { success: false, message: 'Failed to regenerate day with scheduling constraints', error: error?.message || data?.error || 'Unknown error' };
  }

  const regenActivities = data.day.activities || day.activities;
  const regenDiff = computeDayDiff(target_day, day.activities, regenActivities);
  const regenCostDelta = computeDayCost(regenActivities) - computeDayCost(day.activities);

  const updatedDays = [...currentDays];
  updatedDays[dayIndex] = { ...day, ...data.day, activities: regenActivities };
  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: 'Refreshed Day ' + target_day + (new_focus ? ' (more "' + new_focus + '")' : '') + ' without breaking flight/arrival timing',
    updatedDays,
    diff: regenDiff,
    costDelta: regenCostDelta,
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
    return { success: false, message: `Day ${target_day} not found`, error: 'Day not found' };
  }

  const day = currentDays[dayIndex];
  let updatedActivities = [...day.activities];

  if (adjustment === 'more_relaxed') {
    const unlockedIdx = updatedActivities.findIndex(a => !a.isLocked);
    if (unlockedIdx !== -1 && updatedActivities.length > 2) {
      updatedActivities.splice(unlockedIdx, 1);
    }
  } else if (adjustment === 'more_packed') {
    // Find the largest time gap in the day's schedule
    const sortedActs = [...updatedActivities]
      .map(a => ({ ...a, mins: parseTimeToMinutes(a.startTime || a.time) }))
      .filter(a => a.mins < 9999)
      .sort((a, b) => a.mins - b.mins);

    let gapStart = '10:00'; // default morning start
    let gapStartMins = 10 * 60;
    let largestGap = 0;

    if (sortedActs.length > 0) {
      // Check gaps between consecutive activities
      for (let i = 0; i < sortedActs.length - 1; i++) {
        const endMins = sortedActs[i].mins + 90; // assume ~90min per activity
        const nextStart = sortedActs[i + 1].mins;
        const gap = nextStart - endMins;
        if (gap > largestGap) {
          largestGap = gap;
          gapStartMins = endMins;
          const h = Math.floor(endMins / 60);
          const m = endMins % 60;
          gapStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      // Also check gap after last activity
      const lastEnd = sortedActs[sortedActs.length - 1].mins + 90;
      const eveningEnd = 21 * 60; // 9 PM
      if (eveningEnd - lastEnd > largestGap) {
        largestGap = eveningEnd - lastEnd;
        gapStartMins = lastEnd;
        const h = Math.floor(lastEnd / 60);
        const m = lastEnd % 60;
        gapStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }

    const { data, error } = await supabase.functions.invoke('get-activity-alternatives', {
      body: {
        currentActivity: { id: 'new', name: 'Quick Activity', type: 'activity' },
        destination,
        searchQuery: 'quick nearby experience',
      },
    });

    if (!error && data?.success && data.alternatives?.length > 0) {
      const alternatives = data.alternatives as AlternativeActivity[];
      const newActivity = alternatives[0];
      const endMins = gapStartMins + 60;
      const endH = Math.floor(endMins / 60);
      const endM = endMins % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      updatedActivities.push({
        id: newActivity.id,
        title: newActivity.name,
        name: newActivity.name,
        description: newActivity.description,
        category: newActivity.category,
        cost: { amount: newActivity.estimatedCost },
        location: { name: newActivity.location },
        startTime: gapStart,
        endTime,
        isLocked: false,
      } as Activity);
    }
  }

  const pacingDiff = computeDayDiff(target_day, day.activities, updatedActivities);
  const pacingDelta = computeDayCost(updatedActivities) - computeDayCost(day.activities);

  const updatedDays = [...currentDays];
  updatedDays[dayIndex] = { ...day, activities: updatedActivities };
  await updateTripItinerary(tripId, updatedDays);

  return {
    success: true,
    message: adjustment === 'more_relaxed'
      ? `Made Day ${target_day} more relaxed`
      : `Added more activities to Day ${target_day}`,
    updatedDays,
    diff: pacingDiff,
    costDelta: pacingDelta,
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

  const normalizedScope = scope || 'entire_trip';
  const dayIndexes: number[] = (() => {
    if (normalizedScope === 'day' || normalizedScope === 'specific_day') {
      if (!target_day) return [];
      const idx = currentDays.findIndex(d => d.dayNumber === target_day);
      return idx >= 0 ? [idx] : [];
    }
    return currentDays.map((_, idx) => idx);
  })();

  const maxSwapsPerDay = (filter_type === 'romantic' || filter_type === 'adventure' || filter_type === 'family_friendly') ? 2 : 999;
  const allDiffs: DiffEntry[] = [];
  let totalCostDelta = 0;

  for (const dayIndex of dayIndexes) {
    const day = currentDays[dayIndex];
    const updatedActivities = [...day.activities];
    let swapsThisDay = 0;

    for (let actIndex = 0; actIndex < day.activities.length; actIndex++) {
      const activity = day.activities[actIndex];
      if (activity.isLocked) continue;
      if (isProtectedActivity(activity)) continue;

      const diningOnly = normalizedScope === 'dining_only' || filter_type === 'dietary';
      const activitiesOnly = normalizedScope === 'activities_only' || filter_type === 'romantic' || filter_type === 'adventure';
      if (diningOnly && !isMealActivity(activity)) continue;
      if (activitiesOnly && isMealActivity(activity)) continue;
      if (swapsThisDay >= maxSwapsPerDay) continue;

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
            name: activityTitle(activity) || 'Activity',
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
        
        const currentName = (activity.title || activity.name || '').toLowerCase().trim();
        const newName = (best.name || '').toLowerCase().trim();
        const isSameActivity = currentName === newName || currentName.includes(newName) || newName.includes(currentName);
        
        const bestName = norm(best.name);
        const wouldDuplicateSunset = bestName.includes('sunset') && hasKeywordInDay(day, 'sunset');
        const wouldDuplicateOpera = bestName.includes('opera') && hasKeywordInDay(day, 'opera');

        if (!isSameActivity && !wouldDuplicateSunset && !wouldDuplicateOpera) {
          const oldCost = getActivityCost(activity);
          const newCost = best.estimatedCost || 0;
          allDiffs.push(
            { type: 'removed', dayNumber: day.dayNumber, activityTitle: activityTitle(activity), category: activity.category, costBefore: oldCost },
            { type: 'added', dayNumber: day.dayNumber, activityTitle: best.name, category: best.category, costAfter: newCost },
          );
          totalCostDelta += newCost - oldCost;

          allAlternatives.push(...alternatives);
          updatedActivities[actIndex] = {
            ...activity,
            id: best.id,
            title: best.name,
            name: best.name,
            description: best.description,
            category: best.category,
            cost: { amount: best.estimatedCost, currency: 'USD' },
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
    diff: allDiffs,
    costDelta: totalCostDelta,
  };
}

// ============================================================================
// CHRONOLOGICAL SORTING
// ============================================================================

function parseTimeToMinutes(timeStr: string | undefined): number {
  if (!timeStr) return 9999;
  const normalized = timeStr.trim();
  // Handle HH:MM AM/PM, HH:MM, H:MM formats (case-insensitive, flexible spacing)
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  return 9999;
}

function sortActivitiesChronologically(days: ItineraryDay[]): ItineraryDay[] {
  return days.map(day => ({
    ...day,
    activities: [...day.activities].sort((a, b) => {
      const aMin = parseTimeToMinutes(a.startTime || a.time);
      const bMin = parseTimeToMinutes(b.startTime || b.time);
      return aMin - bMin;
    }),
  }));
}

// ============================================================================
// DATABASE UPDATE
// ============================================================================

async function updateTripItinerary(tripId: string, updatedDays: ItineraryDay[]): Promise<void> {
  // Run client-side meal compliance guard before saving (async — uses real venue names)
  try {
    const { enforceItineraryMealComplianceAsync } = await import('@/utils/mealGuard');
    const mealResult = await enforceItineraryMealComplianceAsync(updatedDays as any, supabase);
    if (mealResult.totalInjected > 0) {
      console.warn(`[ActionExecutor] Meal guard injected ${mealResult.totalInjected} meals before save`);
    }
  } catch (e) {
    console.warn('[ActionExecutor] Meal guard failed, skipping:', e);
  }

  // Final stub sweep — mirrors the server's nuclearPlaceholderSweep so no
  // generic "Breakfast at a café near your hotel" string can hit the DB.
  try {
    const { preSaveMealStubSweep } = await import('@/utils/preSaveMealSweep');
    preSaveMealStubSweep(updatedDays as any);
  } catch (e) {
    console.warn('[ActionExecutor] Pre-save meal sweep failed, skipping:', e);
  }

  // Normalize "HH:MM:SS"-shaped duration strings before persisting.
  try {
    const { normalizeDurationsInDays } = await import('@/utils/durationNormalize');
    normalizeDurationsInDays(updatedDays as any);
  } catch (e) {
    console.warn('[ActionExecutor] Duration normalize failed, skipping:', e);
  }

  const sortedDays = sortActivitiesChronologically(updatedDays);
  try {
    // Fetch existing itinerary metadata to preserve it
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
    const itineraryPayload = {
      ...currentData,
      days: JSON.parse(JSON.stringify(sortedDays)),
    };

    // Route through backend save-itinerary for normalization, meal guard, and table sync
    const { error: saveError } = await supabase.functions.invoke('generate-itinerary', {
      body: {
        action: 'save-itinerary',
        tripId,
        itinerary: itineraryPayload,
      },
    });

    if (saveError) {
      console.error('[ActionExecutor] Backend save failed, falling back to direct update:', saveError);
      // Fallback: direct update
      const { error: updateError } = await supabase
        .from('trips')
        .update({
          itinerary_data: itineraryPayload as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (updateError) {
        console.error('[ActionExecutor] Direct update also failed:', updateError);
      }
    } else {
      console.log('[ActionExecutor] Trip itinerary saved via backend (normalized + meal-guarded)');
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
