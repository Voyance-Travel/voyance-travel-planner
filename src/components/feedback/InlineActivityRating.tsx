/**
 * InlineActivityRating
 * Quick tap-to-rate emoji buttons directly on activity cards
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ThumbsUp, Meh, ThumbsDown, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubmitFeedback, type FeedbackRating } from '@/services/activityFeedbackAPI';

interface InlineActivityRatingProps {
  activityId: string;
  tripId: string;
  activityType?: string;
  activityCategory?: string;
  destination?: string;
  existingRating?: FeedbackRating | null;
  onVoicePress?: () => void;
  compact?: boolean;
}

const ratingOptions: { value: FeedbackRating; icon: typeof Heart; label: string; activeColor: string }[] = [
  { value: 'loved', icon: Heart, label: '🤩', activeColor: 'text-rose-500 bg-rose-500/15' },
  { value: 'liked', icon: ThumbsUp, label: '👍', activeColor: 'text-emerald-500 bg-emerald-500/15' },
  { value: 'neutral', icon: Meh, label: '😐', activeColor: 'text-amber-500 bg-amber-500/15' },
  { value: 'disliked', icon: ThumbsDown, label: '👎', activeColor: 'text-slate-400 bg-slate-400/15' },
];

export function InlineActivityRating({
  activityId,
  tripId,
  activityType,
  activityCategory,
  destination,
  existingRating,
  onVoicePress,
  compact = false,
}: InlineActivityRatingProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(existingRating || null);
  const [justRated, setJustRated] = useState(false);
  const submitFeedback = useSubmitFeedback();

  const handleRate = async (rating: FeedbackRating) => {
    const newRating = selectedRating === rating ? null : rating;
    setSelectedRating(newRating);
    
    if (newRating) {
      setJustRated(true);
      setTimeout(() => setJustRated(false), 2000);
      
      try {
        await submitFeedback.mutateAsync({
          trip_id: tripId,
          activity_id: activityId,
          rating: newRating,
          activity_type: activityType,
          activity_category: activityCategory,
          destination,
        });
      } catch (e) {
        console.error('Failed to submit inline rating:', e);
        setSelectedRating(existingRating || null);
      }
    }
  };

  return (
    <div className="flex items-center gap-1">
      {ratingOptions.map(({ value, label, activeColor }) => (
        <motion.button
          key={value}
          whileTap={{ scale: 1.3 }}
          onClick={() => handleRate(value)}
          className={cn(
            'rounded-full transition-all text-base',
            compact ? 'w-7 h-7' : 'w-8 h-8',
            'flex items-center justify-center',
            selectedRating === value
              ? activeColor
              : 'hover:bg-muted/80 opacity-50 hover:opacity-100'
          )}
          title={value}
        >
          {label}
        </motion.button>
      ))}

      {/* Voice note button */}
      {onVoicePress && (
        <div className="flex items-center ml-1 border-l border-border/50 pl-1">
          <button
            onClick={onVoicePress}
            className="flex items-center gap-1 px-2 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all text-xs"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Note</span>
          </button>
        </div>
      )}

      {/* Confirmation animation */}
      <AnimatePresence>
        {justRated && (
          <motion.span
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-primary font-medium ml-1"
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InlineActivityRating;
