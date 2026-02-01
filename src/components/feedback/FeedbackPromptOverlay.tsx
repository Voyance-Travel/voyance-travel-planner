/**
 * FeedbackPromptOverlay
 * Contextual feedback collection UI that appears during trips
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Star, Heart, ThumbsUp, Meh, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useSubmitFeedback, useDismissFeedback } from '@/services/feedbackAPI';
import type { PromptDisplayContext, FeedbackQuestion } from '@/types/feedback';

interface FeedbackPromptOverlayProps {
  context: PromptDisplayContext;
  tripId: string;
  onClose: () => void;
  onComplete: () => void;
}

// Emoji scale icons
const emojiIcons: Record<string, React.ReactNode> = {
  '😍 Loved it': <Heart className="w-6 h-6 fill-current" />,
  '👍 Good': <ThumbsUp className="w-6 h-6" />,
  '😐 Meh': <Meh className="w-6 h-6" />,
  '👎 Skip it': <ThumbsDown className="w-6 h-6" />,
  'Amazing': <Heart className="w-6 h-6 fill-current" />,
  'Great': <ThumbsUp className="w-6 h-6" />,
  'Good': <ThumbsUp className="w-5 h-5" />,
  'Disappointing': <ThumbsDown className="w-6 h-6" />,
};

const emojiColors: Record<string, string> = {
  '😍 Loved it': 'text-rose-500 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20',
  '👍 Good': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
  '😐 Meh': 'text-amber-500 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
  '👎 Skip it': 'text-slate-500 bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/20',
  'Amazing': 'text-rose-500 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20',
  'Great': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
  'Good': 'text-teal-500 bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20',
  'Disappointing': 'text-slate-500 bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/20',
};

export function FeedbackPromptOverlay({
  context,
  tripId,
  onClose,
  onComplete,
}: FeedbackPromptOverlayProps) {
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [currentStep, setCurrentStep] = useState(0);
  
  const submitMutation = useSubmitFeedback();
  const dismissMutation = useDismissFeedback();

  const { prompt, activity, dayNumber, destination } = context;
  const questions = prompt.questions;
  const currentQuestion = questions[currentStep];

  // Interpolate text with context
  const interpolateText = (text: string) => {
    return text
      .replace('{activity_name}', activity?.name || 'this activity')
      .replace('{destination}', destination || 'your destination')
      .replace('{day_number}', String(dayNumber || 1));
  };

  // Check if current question is answered
  const isCurrentAnswered = useMemo(() => {
    if (!currentQuestion) return false;
    const value = responses[currentQuestion.id];
    if (!currentQuestion.required) return true;
    if (currentQuestion.type === 'multi_select') {
      return Array.isArray(value) && value.length > 0;
    }
    return value !== undefined && value !== '';
  }, [currentQuestion, responses]);

  // Check if all required questions are answered
  const canSubmit = useMemo(() => {
    return questions.every(q => {
      if (!q.required) return true;
      const value = responses[q.id];
      if (q.type === 'multi_select') {
        return Array.isArray(value) && value.length > 0;
      }
      return value !== undefined && value !== '';
    });
  }, [questions, responses]);

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync({
        trip_id: tripId,
        prompt_id: prompt.id,
        prompt_type: prompt.prompt_type,
        activity_id: activity?.id,
        day_number: dayNumber,
        responses,
      });
      onComplete();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissMutation.mutateAsync({
        trip_id: tripId,
        prompt_id: prompt.id,
        prompt_type: prompt.prompt_type,
        activity_id: activity?.id,
        day_number: dayNumber,
      });
      onClose();
    } catch (error) {
      console.error('Failed to dismiss feedback:', error);
      onClose();
    }
  };

  const renderQuestion = (question: FeedbackQuestion) => {
    const value = responses[question.id];

    switch (question.type) {
      case 'emoji_scale':
        return (
          <div className="grid grid-cols-2 gap-2">
            {question.options?.map((option) => {
              const isSelected = value === option;
              const icon = emojiIcons[option];
              const color = emojiColors[option] || 'text-muted-foreground bg-muted border-border';
              const label = option.replace(/^[^\s]+\s/, ''); // Remove emoji prefix
              
              return (
                <button
                  key={option}
                  onClick={() => setResponses(prev => ({ ...prev, [question.id]: option }))}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    isSelected ? color : 'border-border/50 hover:border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {icon}
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        );

      case 'single_select':
        return (
          <div className="flex flex-wrap gap-2">
            {question.options?.map((option) => (
              <button
                key={option}
                onClick={() => setResponses(prev => ({ ...prev, [question.id]: option }))}
                className={cn(
                  'px-4 py-2 rounded-full border transition-all text-sm',
                  value === option
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        );

      case 'multi_select':
        const selected = (value as string[]) || [];
        return (
          <div className="flex flex-wrap gap-2">
            {question.options?.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={option}
                  onClick={() => {
                    setResponses(prev => ({
                      ...prev,
                      [question.id]: isSelected
                        ? selected.filter(s => s !== option)
                        : [...selected, option]
                    }));
                  }}
                  className={cn(
                    'px-4 py-2 rounded-full border transition-all text-sm',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        );

      case 'rating_scale':
        return (
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => setResponses(prev => ({ ...prev, [question.id]: rating }))}
                className={cn(
                  'w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center',
                  value === rating
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-border hover:border-amber-500/50'
                )}
              >
                <Star className={cn('w-5 h-5', value === rating && 'fill-current')} />
              </button>
            ))}
          </div>
        );

      case 'text':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
            placeholder={question.required ? 'Share your thoughts...' : 'Optional'}
            className="min-h-[80px] resize-none"
          />
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">
                {prompt.prompt_type === 'quick_reaction' && 'Quick feedback'}
                {prompt.prompt_type === 'day_summary' && 'End of day'}
                {prompt.prompt_type === 'restaurant_specific' && 'Restaurant feedback'}
                {prompt.prompt_type === 'departure_summary' && 'Trip reflection'}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Progress dots */}
            {questions.length > 1 && (
              <div className="flex justify-center gap-1.5">
                {questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      idx === currentStep 
                        ? 'bg-primary w-4' 
                        : idx < currentStep 
                          ? 'bg-primary/50' 
                          : 'bg-muted'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Question */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-center">
                  {interpolateText(currentQuestion.text)}
                </h3>
                {renderQuestion(currentQuestion)}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 p-4 border-t border-border/50 bg-muted/30">
            {currentStep > 0 ? (
              <Button variant="ghost" onClick={handlePrev} className="flex-1">
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleDismiss} className="flex-1">
                Skip
              </Button>
            )}
            
            {currentStep < questions.length - 1 ? (
              <Button 
                onClick={handleNext} 
                disabled={!isCurrentAnswered && currentQuestion.required}
                className="flex-1"
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={!canSubmit || submitMutation.isPending}
                className="flex-1 gap-2"
              >
                <Send className="w-4 h-4" />
                {submitMutation.isPending ? 'Sending...' : 'Submit'}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default FeedbackPromptOverlay;
