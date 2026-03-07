/**
 * Feedback Trigger Hook
 * Determines when to show feedback prompts based on context and timing
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { parseISO, isToday, differenceInMinutes, differenceInDays, isAfter, isBefore } from 'date-fns';
import type { 
  FeedbackPrompt, 
  TripContext, 
  ActivityContext,
  PromptDisplayContext 
} from '@/types/feedback';
import { 
  useActivePrompts, 
  useTodaysFeedbackResponses,
  logPromptShown 
} from '@/services/feedbackAPI';

interface UseFeedbackTriggerOptions {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  userArchetype?: string;
  activities: ActivityContext[];
  recentCompletedActivity?: ActivityContext;
  enabled?: boolean;
}

interface FeedbackTriggerResult {
  currentPrompt: PromptDisplayContext | null;
  dismissPrompt: () => void;
  completePrompt: () => void;
  checkForPrompts: () => void;
}

export function useFeedbackTrigger({
  tripId,
  destination,
  startDate,
  endDate,
  userArchetype,
  activities,
  recentCompletedActivity,
  enabled = true,
}: UseFeedbackTriggerOptions): FeedbackTriggerResult {
  const [currentPrompt, setCurrentPrompt] = useState<PromptDisplayContext | null>(null);
  const [dismissedPromptIds, setDismissedPromptIds] = useState<Set<string>>(new Set());
  
  const { data: prompts = [] } = useActivePrompts();
  const { data: todaysFeedback = [] } = useTodaysFeedbackResponses(tripId);

  // Calculate trip context
  const tripContext = useMemo((): TripContext => {
    const now = new Date();
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    const currentDayNumber = Math.max(1, differenceInDays(now, start) + 1);
    const totalDays = differenceInDays(end, start);

    return {
      tripId,
      destination,
      startDate,
      endDate,
      currentDayNumber,
      totalDays,
      userArchetype,
      todaysActivities: activities,
      recentActivity: recentCompletedActivity,
    };
  }, [tripId, destination, startDate, endDate, userArchetype, activities, recentCompletedActivity]);

  // Count prompts shown today by type
  const todaysPromptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todaysFeedback.forEach(fb => {
      const key = fb.prompt_type;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [todaysFeedback]);

  // Evaluate if a prompt should trigger
  const evaluatePrompt = useCallback((
    prompt: FeedbackPrompt, 
    context: TripContext
  ): PromptDisplayContext | null => {
    const { trigger_config, archetype_relevance } = prompt;
    const now = new Date();

    // Check archetype relevance
    if (archetype_relevance && archetype_relevance.length > 0) {
      if (!context.userArchetype || !archetype_relevance.includes(context.userArchetype)) {
        return null;
      }
    }

    // Check max prompts today
    const maxToday = trigger_config.conditions?.max_prompts_today;
    if (maxToday !== undefined) {
      const shown = todaysPromptCounts[prompt.prompt_type] || 0;
      if (shown >= maxToday) {
        return null;
      }
    }

    // Evaluate trigger type
    switch (trigger_config.type) {
      case 'time_after_activity': {
        if (!context.recentActivity?.completedAt) return null;
        
        const minutesSince = differenceInMinutes(now, context.recentActivity.completedAt);
        const targetMinutes = trigger_config.value;
        
        // Check if within trigger window (±30 min)
        if (minutesSince < targetMinutes || minutesSince > targetMinutes + 60) {
          return null;
        }

        // Check activity type conditions
        const activityTypes = trigger_config.conditions?.activity_types;
        if (activityTypes && activityTypes.length > 0) {
          const actType = context.recentActivity.category?.toLowerCase() || 
                          context.recentActivity.type?.toLowerCase() || '';
          if (!activityTypes.some(t => actType.includes(t.toLowerCase()))) {
            return null;
          }
        }

        return {
          prompt,
          activity: context.recentActivity,
          destination: context.destination,
        };
      }

      case 'time_of_day': {
        const currentHour = now.getHours();
        if (currentHour !== trigger_config.value) {
          return null;
        }

        // Only show on active trip days
        const tripStart = parseISO(context.startDate);
        const tripEnd = parseISO(context.endDate);
        if (isBefore(now, tripStart) || isAfter(now, tripEnd)) {
          return null;
        }

        return {
          prompt,
          dayNumber: context.currentDayNumber,
          destination: context.destination,
        };
      }

      case 'trip_day': {
        const targetDay = trigger_config.value === -1 
          ? context.totalDays 
          : trigger_config.value;
        
        if (context.currentDayNumber !== targetDay) {
          return null;
        }

        // For departure day, check if it's after a reasonable hour (e.g., 10am)
        if (trigger_config.value === -1 && now.getHours() < 10) {
          return null;
        }

        return {
          prompt,
          dayNumber: context.currentDayNumber,
          destination: context.destination,
        };
      }

      case 'days_after_return': {
        const tripEnd = parseISO(context.endDate);
        const daysSinceEnd = differenceInDays(now, tripEnd);
        
        if (daysSinceEnd !== trigger_config.value) {
          return null;
        }

        return {
          prompt,
          destination: context.destination,
        };
      }

      default:
        return null;
    }
  }, [todaysPromptCounts]);

  // Check for triggerable prompts
  const checkForPrompts = useCallback(() => {
    if (!enabled || prompts.length === 0) return;

    // Sort by priority (highest first)
    const sortedPrompts = [...prompts].sort((a, b) => b.priority - a.priority);

    for (const prompt of sortedPrompts) {
      // Skip if already dismissed this session
      if (dismissedPromptIds.has(prompt.id)) continue;

      const displayContext = evaluatePrompt(prompt, tripContext);
      if (displayContext) {
        setCurrentPrompt(displayContext);
        
        // Log that we showed this prompt
        logPromptShown({
          trip_id: tripId,
          prompt_id: prompt.id,
          prompt_type: prompt.prompt_type,
          activity_id: displayContext.activity?.id,
          day_number: displayContext.dayNumber,
          action: 'shown',
        });
        
        return;
      }
    }
  }, [enabled, prompts, tripContext, dismissedPromptIds, evaluatePrompt, tripId]);

  // Dismiss current prompt
  const dismissPrompt = useCallback(() => {
    if (currentPrompt) {
      setDismissedPromptIds(prev => new Set([...prev, currentPrompt.prompt.id]));
      
      logPromptShown({
        trip_id: tripId,
        prompt_id: currentPrompt.prompt.id,
        prompt_type: currentPrompt.prompt.prompt_type,
        activity_id: currentPrompt.activity?.id,
        day_number: currentPrompt.dayNumber,
        action: 'dismissed',
      });
    }
    setCurrentPrompt(null);
  }, [currentPrompt, tripId]);

  // Complete current prompt
  const completePrompt = useCallback(() => {
    if (currentPrompt) {
      setDismissedPromptIds(prev => new Set([...prev, currentPrompt.prompt.id]));
      
      logPromptShown({
        trip_id: tripId,
        prompt_id: currentPrompt.prompt.id,
        prompt_type: currentPrompt.prompt.prompt_type,
        activity_id: currentPrompt.activity?.id,
        day_number: currentPrompt.dayNumber,
        action: 'completed',
      });
    }
    setCurrentPrompt(null);
  }, [currentPrompt, tripId]);

  // Check for prompts periodically
  useEffect(() => {
    if (!enabled) return;

    // Initial check
    const timer = setTimeout(checkForPrompts, 2000);

    // Check every 15 minutes
    const interval = setInterval(checkForPrompts, 1000 * 60 * 15);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [enabled, checkForPrompts]);

  // Re-check when recent activity changes
  useEffect(() => {
    if (recentCompletedActivity) {
      checkForPrompts();
    }
  }, [recentCompletedActivity, checkForPrompts]);

  return {
    currentPrompt,
    dismissPrompt,
    completePrompt,
    checkForPrompts,
  };
}
