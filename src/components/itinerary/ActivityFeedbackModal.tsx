import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ThumbsUp, Meh, ThumbsDown, X, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  useSubmitFeedback, 
  useActivityFeedback,
  FEEDBACK_TAGS,
  type FeedbackRating,
  type CreateFeedbackInput
} from '@/services/activityFeedbackAPI';
import { toast } from 'sonner';

interface ActivityFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: {
    id: string;
    name: string;
    type?: string;
    category?: string;
  };
  tripId: string;
  destination?: string;
}

const ratingOptions: { value: FeedbackRating; icon: React.ReactNode; label: string; color: string }[] = [
  { value: 'loved', icon: <Heart className="w-6 h-6" />, label: 'Loved it!', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20' },
  { value: 'liked', icon: <ThumbsUp className="w-6 h-6" />, label: 'Liked it', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' },
  { value: 'neutral', icon: <Meh className="w-6 h-6" />, label: 'It was okay', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20' },
  { value: 'disliked', icon: <ThumbsDown className="w-6 h-6" />, label: "Didn't enjoy", color: 'text-slate-500 bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/20' }
];

export function ActivityFeedbackModal({
  isOpen,
  onClose,
  activity,
  tripId,
  destination
}: ActivityFeedbackModalProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const { data: existingFeedback } = useActivityFeedback(activity.id);
  const submitFeedback = useSubmitFeedback();

  // Load existing feedback
  useEffect(() => {
    if (existingFeedback) {
      setSelectedRating(existingFeedback.rating);
      setFeedbackText(existingFeedback.feedback_text || '');
      setSelectedTags(existingFeedback.feedback_tags || []);
    }
  }, [existingFeedback]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!selectedRating) {
      toast.error('Please select how you felt about this activity');
      return;
    }

    const input: CreateFeedbackInput = {
      trip_id: tripId,
      activity_id: activity.id,
      rating: selectedRating,
      feedback_text: feedbackText || undefined,
      feedback_tags: selectedTags,
      activity_type: activity.type,
      activity_category: activity.category,
      destination
    };

    try {
      await submitFeedback.mutateAsync(input);
      toast.success('Thanks for your feedback! We\'ll use this to personalize future trips.');
      onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to save feedback. Please try again.');
    }
  };

  const isPositive = selectedRating === 'loved' || selectedRating === 'liked';
  const currentTags = isPositive ? FEEDBACK_TAGS.positive : FEEDBACK_TAGS.negative;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            How was {activity.name}?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating Selection */}
          <div className="grid grid-cols-4 gap-2">
            {ratingOptions.map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedRating(option.value);
                  setSelectedTags([]); // Reset tags when rating changes
                }}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all
                  ${selectedRating === option.value 
                    ? option.color + ' border-current' 
                    : 'border-border bg-muted/30 hover:bg-muted/50'
                  }
                `}
              >
                {option.icon}
                <span className="text-xs font-medium">{option.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Tags Section */}
          <AnimatePresence mode="wait">
            {selectedRating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <p className="text-sm text-muted-foreground">
                  {isPositive ? 'What made it great?' : 'What could have been better?'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                      className={`cursor-pointer transition-all ${
                        selectedTags.includes(tag) 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleTagToggle(tag)}
                    >
                      {selectedTags.includes(tag) && <X className="w-3 h-3 mr-1" />}
                      {tag}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Optional Text Feedback */}
          <AnimatePresence>
            {selectedRating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <label className="text-sm text-muted-foreground">
                  Anything else? (optional)
                </label>
                <Textarea
                  placeholder="Share your thoughts..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Learning Note */}
          <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Your feedback helps us learn your preferences and create better personalized itineraries for your future trips.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedRating || submitFeedback.isPending}
            className="w-full"
          >
            {submitFeedback.isPending ? 'Saving...' : existingFeedback ? 'Update Feedback' : 'Save Feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityFeedbackModal;
