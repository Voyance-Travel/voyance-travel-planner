/**
 * useTripSentiment
 * Detects negative sentiment from activity ratings + day summaries
 * to trigger proactive trip rescue interventions
 */

import { useMemo } from 'react';
import { useTripFeedback, type FeedbackRating } from '@/services/activityFeedbackAPI';

export interface TripSentiment {
  /** Overall sentiment score: -1 (terrible) to 1 (amazing) */
  score: number;
  /** Whether to show rescue intervention */
  needsRescue: boolean;
  /** Number of negative ratings today */
  negativeCount: number;
  /** Number of positive ratings today */
  positiveCount: number;
  /** Specific issues detected */
  issues: SentimentIssue[];
  /** Suggested intervention type */
  interventionType: 'swap' | 'pace' | 'both' | null;
}

export interface SentimentIssue {
  type: 'low_rating' | 'rushed_pace' | 'low_energy' | 'multiple_skips';
  message: string;
  severity: 'warning' | 'critical';
}

const RATING_SCORES: Record<FeedbackRating, number> = {
  loved: 1,
  liked: 0.5,
  neutral: 0,
  disliked: -1,
};

interface UseTripSentimentOptions {
  tripId: string;
  currentDayNumber: number;
  dayPacing?: 'too_rushed' | 'just_right' | 'too_slow' | null;
  energyLevel?: number | null;
  enabled?: boolean;
}

export function useTripSentiment({
  tripId,
  currentDayNumber,
  dayPacing,
  energyLevel,
  enabled = true,
}: UseTripSentimentOptions): TripSentiment {
  const { data: feedback = [] } = useTripFeedback(enabled ? tripId : null);

  return useMemo(() => {
    const issues: SentimentIssue[] = [];
    
    // Analyze today's activity ratings
    const negativeRatings = feedback.filter(f => f.rating === 'disliked' || f.rating === 'neutral');
    const positiveRatings = feedback.filter(f => f.rating === 'loved' || f.rating === 'liked');
    const negativeCount = negativeRatings.length;
    const positiveCount = positiveRatings.length;

    // Calculate overall score
    const totalScore = feedback.reduce((sum, f) => sum + RATING_SCORES[f.rating], 0);
    const score = feedback.length > 0 ? totalScore / feedback.length : 0;

    // Check for multiple negative ratings
    if (negativeCount >= 2) {
      issues.push({
        type: 'multiple_skips',
        message: `${negativeCount} activities didn't hit the mark today`,
        severity: negativeCount >= 3 ? 'critical' : 'warning',
      });
    }

    // Check pacing
    if (dayPacing === 'too_rushed') {
      issues.push({
        type: 'rushed_pace',
        message: 'The day felt too rushed',
        severity: 'warning',
      });
    }

    // Check energy
    if (energyLevel !== null && energyLevel !== undefined && energyLevel <= 2) {
      issues.push({
        type: 'low_energy',
        message: energyLevel === 1 ? 'Running on empty' : 'Energy is low',
        severity: energyLevel === 1 ? 'critical' : 'warning',
      });
    }

    // Determine if rescue is needed
    const hasCritical = issues.some(i => i.severity === 'critical');
    const hasMultipleWarnings = issues.filter(i => i.severity === 'warning').length >= 2;
    const needsRescue = hasCritical || hasMultipleWarnings || negativeCount >= 2;

    // Determine intervention type
    let interventionType: TripSentiment['interventionType'] = null;
    if (needsRescue) {
      const hasPaceIssue = issues.some(i => i.type === 'rushed_pace' || i.type === 'low_energy');
      const hasActivityIssue = issues.some(i => i.type === 'multiple_skips' || i.type === 'low_rating');
      
      if (hasPaceIssue && hasActivityIssue) interventionType = 'both';
      else if (hasPaceIssue) interventionType = 'pace';
      else interventionType = 'swap';
    }

    return {
      score,
      needsRescue,
      negativeCount,
      positiveCount,
      issues,
      interventionType,
    };
  }, [feedback, dayPacing, energyLevel]);
}

export default useTripSentiment;
