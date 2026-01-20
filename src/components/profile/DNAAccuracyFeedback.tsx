/**
 * DNA Accuracy Feedback Component
 * 
 * "This isn't me" refinement loop with rating and correction chips.
 * Sends feedback events to voyance_events table.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ThumbsUp, 
  ThumbsDown, 
  Star, 
  Check,
  MessageSquare,
  Send,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface CorrectionChip {
  id: string;
  label: string;
  trait: string;
  direction: 'too_high' | 'too_low';
}

interface DNAAccuracyFeedbackProps {
  userId: string;
  dnaVersion?: number;
  topArchetypes?: Array<{ archetype_id: string; name: string; pct: number }>;
  onFeedbackSubmitted?: () => void;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CORRECTION_CHIPS: CorrectionChip[] = [
  { id: 'pace_high', label: 'Pace too fast', trait: 'pace', direction: 'too_high' },
  { id: 'pace_low', label: 'Pace too slow', trait: 'pace', direction: 'too_low' },
  { id: 'comfort_high', label: 'Too luxury-focused', trait: 'comfort', direction: 'too_high' },
  { id: 'comfort_low', label: 'Too budget-focused', trait: 'comfort', direction: 'too_low' },
  { id: 'planning_high', label: 'Too planned', trait: 'planning', direction: 'too_high' },
  { id: 'planning_low', label: 'Too spontaneous', trait: 'planning', direction: 'too_low' },
  { id: 'social_high', label: 'Too social', trait: 'social', direction: 'too_high' },
  { id: 'social_low', label: 'Too solo-focused', trait: 'social', direction: 'too_low' },
  { id: 'adventure_high', label: 'Too adventurous', trait: 'adventure', direction: 'too_high' },
  { id: 'adventure_low', label: 'Too safe', trait: 'adventure', direction: 'too_low' },
  { id: 'authenticity_high', label: 'Too local/authentic', trait: 'authenticity', direction: 'too_high' },
  { id: 'authenticity_low', label: 'Too touristy', trait: 'authenticity', direction: 'too_low' },
];

const RATING_OPTIONS = [
  { value: 1, label: 'Not at all', emoji: '😕' },
  { value: 2, label: 'Slightly', emoji: '🤔' },
  { value: 3, label: 'Somewhat', emoji: '😊' },
  { value: 4, label: 'Very', emoji: '😄' },
  { value: 5, label: 'Perfectly', emoji: '🎯' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function DNAAccuracyFeedback({
  userId,
  dnaVersion = 2,
  topArchetypes = [],
  onFeedbackSubmitted,
  className,
}: DNAAccuracyFeedbackProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [selectedCorrections, setSelectedCorrections] = useState<string[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const toggleCorrection = (chipId: string) => {
    setSelectedCorrections(prev => 
      prev.includes(chipId) 
        ? prev.filter(id => id !== chipId)
        : [...prev, chipId]
    );
  };

  const handleSubmit = async () => {
    if (rating === null) {
      toast.error('Please select an accuracy rating');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build the event properties
      const properties = {
        rating,
        dna_version: dnaVersion,
        selected_corrections: selectedCorrections,
        correction_details: selectedCorrections.map(id => {
          const chip = CORRECTION_CHIPS.find(c => c.id === id);
          return chip ? { trait: chip.trait, direction: chip.direction } : null;
        }).filter(Boolean),
        chosen_archetype_id: selectedArchetype,
        top_matches_snapshot: topArchetypes.slice(0, 3),
        additional_feedback: additionalFeedback || null,
        submitted_at: new Date().toISOString(),
      };

      // Insert into voyance_events table
      const { error } = await supabase
        .from('voyance_events')
        .insert({
          user_id: userId,
          event_name: 'dna_accuracy_rating',
          properties,
        });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success('Thanks for your feedback! We\'ll improve your recommendations.');
      onFeedbackSubmitted?.();

    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "p-6 rounded-xl bg-primary/5 border border-primary/20 text-center",
          className
        )}
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Check className="h-6 w-6 text-primary" />
        </div>
        <h4 className="font-medium text-foreground mb-1">Feedback Received!</h4>
        <p className="text-sm text-muted-foreground">
          We'll use this to refine your recommendations.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-6 p-6 rounded-xl bg-muted/30 border border-border", className)}
    >
      {/* Rating Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          How accurate is your Travel DNA?
        </h4>
        <div className="flex flex-wrap gap-2">
          {RATING_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={rating === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRating(option.value);
                // Show correction options for low ratings
                if (option.value <= 3) {
                  setShowDetails(true);
                }
              }}
              className="gap-1.5"
            >
              <span>{option.emoji}</span>
              <span className="hidden sm:inline">{option.label}</span>
              <span className="sm:hidden">{option.value}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Correction Chips (shown for ratings <= 3 or if manually expanded) */}
      <AnimatePresence>
        {(showDetails || (rating !== null && rating <= 3)) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Quick Corrections */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-muted-foreground" />
                What feels off? (optional)
              </h4>
              <div className="flex flex-wrap gap-2">
                {CORRECTION_CHIPS.map((chip) => (
                  <Badge
                    key={chip.id}
                    variant={selectedCorrections.includes(chip.id) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedCorrections.includes(chip.id) 
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() => toggleCorrection(chip.id)}
                  >
                    {chip.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Better Archetype Selection */}
            {topArchetypes.length > 1 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">
                  Pick a better match? (optional)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {topArchetypes.slice(0, 3).map((archetype) => (
                    <Button
                      key={archetype.archetype_id}
                      variant={selectedArchetype === archetype.archetype_id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedArchetype(
                        selectedArchetype === archetype.archetype_id ? null : archetype.archetype_id
                      )}
                    >
                      {archetype.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Feedback */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Anything else? (optional)
              </h4>
              <Textarea
                placeholder="Tell us more about how we got it wrong..."
                value={additionalFeedback}
                onChange={(e) => setAdditionalFeedback(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      {rating !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Feedback
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Expand button for high ratings */}
      {rating !== null && rating > 3 && !showDetails && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(true)}
          className="w-full text-muted-foreground"
        >
          Want to add more details?
        </Button>
      )}
    </motion.div>
  );
}

export type { DNAAccuracyFeedbackProps };
