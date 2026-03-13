/**
 * InlineActivityRating
 * Quick tap-to-rate emoji buttons directly on activity cards
 * Supports both voice and text notes
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ThumbsUp, Meh, ThumbsDown, Mic, PenLine, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSubmitFeedback, type FeedbackRating } from '@/services/activityFeedbackAPI';

interface InlineActivityRatingProps {
  activityId: string;
  tripId: string;
  activityType?: string;
  activityCategory?: string;
  destination?: string;
  existingRating?: FeedbackRating | null;
  onVoicePress?: () => void;
  onTextNote?: (note: string) => void;
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
  onTextNote,
  compact = false,
}: InlineActivityRatingProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(existingRating || null);
  const [justRated, setJustRated] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textNote, setTextNote] = useState('');
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

  const handleSubmitTextNote = async () => {
    if (!textNote.trim()) return;
    
    try {
      await submitFeedback.mutateAsync({
        trip_id: tripId,
        activity_id: activityId,
        rating: selectedRating || 'neutral',
        activity_type: activityType,
        activity_category: activityCategory,
        destination,
        feedback_text: textNote.trim(),
      });
      onTextNote?.(textNote.trim());
      setTextNote('');
      setShowTextInput(false);
    } catch (e) {
      console.error('Failed to submit text note:', e);
    }
  };

  return (
    <div className="space-y-2">
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

        {/* Note buttons — voice + text */}
        {(onVoicePress || true) && (
          <div className="flex items-center ml-1 border-l border-border/50 pl-1 gap-0.5">
            {onVoicePress && (
              <button
                onClick={onVoicePress}
                className="flex items-center gap-1 px-2 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all text-xs"
                title="Voice note"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className={cn(
                "flex items-center gap-1 px-2 h-7 rounded-full transition-all text-xs",
                showTextInput 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              title="Write a note"
            >
              <PenLine className="w-3.5 h-3.5" />
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

      {/* Inline text note input */}
      <AnimatePresence>
        {showTextInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 items-end">
              <Textarea
                value={textNote}
                onChange={(e) => setTextNote(e.target.value)}
                placeholder="How was it? Any tips for future travelers..."
                className="min-h-[60px] text-sm resize-none flex-1"
                rows={2}
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs rounded-full"
                  onClick={handleSubmitTextNote}
                  disabled={!textNote.trim()}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 rounded-full"
                  onClick={() => { setShowTextInput(false); setTextNote(''); }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InlineActivityRating;
