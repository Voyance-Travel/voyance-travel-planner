/**
 * DepartureReflection
 * Comprehensive trip summary on the last day
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plane, Star, Heart, Sparkles, 
  ChevronRight, ChevronLeft, Check, Send,
  Target, ThumbsUp, HelpCircle, Frown, type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useUpsertDepartureSummary } from '@/services/feedbackAPI';
import type { ActivityContext } from '@/types/feedback';

interface DepartureReflectionProps {
  tripId: string;
  tripName: string;
  destination: string;
  activities: ActivityContext[];
  onClose: () => void;
  onComplete: () => void;
}

const archetypeFitOptions: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'nailed_it', label: 'Nailed it', Icon: Target },
  { value: 'mostly', label: 'Mostly', Icon: ThumbsUp },
  { value: 'somewhat', label: 'Somewhat', Icon: HelpCircle },
  { value: 'missed_the_mark', label: 'Missed the mark', Icon: Frown },
];

const changeOptions = [
  'Less packed days',
  'More food focus',
  'Different neighborhoods',
  'More time alone',
  'More group activities',
  'Higher end accommodations',
  'Lower budget options',
  'More adventure',
  'More relaxation',
  'Nothing—it was perfect',
];

export function DepartureReflection({
  tripId,
  tripName,
  destination,
  activities,
  onClose,
  onComplete,
}: DepartureReflectionProps) {
  const [step, setStep] = useState(0);
  const [archetypeFit, setArchetypeFit] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [wouldChange, setWouldChange] = useState<string[]>([]);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [finalThoughts, setFinalThoughts] = useState('');

  const upsertMutation = useUpsertDepartureSummary();

  const handleSubmit = async () => {
    try {
      await upsertMutation.mutateAsync({
        trip_id: tripId,
        archetype_fit: archetypeFit as 'nailed_it' | 'mostly' | 'somewhat' | 'missed_the_mark' | undefined,
        highlight_activities: highlights,
        would_change: wouldChange,
        overall_trip_rating: overallRating || undefined,
        final_thoughts: finalThoughts || undefined,
      });
      onComplete();
    } catch (error) {
      console.error('Failed to save departure summary:', error);
    }
  };

  const totalSteps = 4;

  const toggleHighlight = (id: string) => {
    setHighlights(prev => 
      prev.includes(id) 
        ? prev.filter(h => h !== id)
        : prev.length < 3 
          ? [...prev, id]
          : prev
    );
  };

  const toggleChange = (option: string) => {
    if (option === 'Nothing—it was perfect') {
      setWouldChange(prev => 
        prev.includes(option) ? [] : [option]
      );
    } else {
      setWouldChange(prev => {
        const filtered = prev.filter(c => c !== 'Nothing—it was perfect');
        return filtered.includes(option)
          ? filtered.filter(c => c !== option)
          : [...filtered, option];
      });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 bg-gradient-to-br from-sky-500/20 via-teal-500/20 to-emerald-500/20 border-b border-border/50">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center">
                <Plane className="w-6 h-6 text-sky-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your {destination} trip is wrapping up</p>
                <h2 className="text-lg font-semibold">{tripName}</h2>
              </div>
            </div>

            {/* Progress */}
            <div className="flex gap-1 mt-4">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all',
                    idx <= step ? 'bg-teal-500' : 'bg-white/20'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="fit"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-xl font-semibold text-center">
                    Did your itinerary feel like <span className="text-primary">you</span>?
                  </h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Did the experiences match your travel style?
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    {archetypeFitOptions.map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        onClick={() => setArchetypeFit(value)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                          archetypeFit === value
                            ? 'border-teal-500 bg-teal-500/10'
                            : 'border-border hover:border-teal-500/50'
                        )}
                      >
                        <Icon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="highlights"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-xl font-semibold text-center">
                    Highlight of the trip?
                  </h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Pick up to 3 that stand out
                  </p>
                  <div className="space-y-2 mt-4 max-h-60 overflow-y-auto">
                    {activities.slice(0, 12).map((activity) => (
                      <button
                        key={activity.id}
                        onClick={() => toggleHighlight(activity.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                          highlights.includes(activity.id)
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-border hover:border-amber-500/50'
                        )}
                      >
                        {highlights.includes(activity.id) ? (
                          <Heart className="w-5 h-5 text-amber-500 fill-current flex-shrink-0" />
                        ) : (
                          <Heart className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{activity.name}</span>
                        {highlights.includes(activity.id) && (
                          <Check className="w-4 h-4 text-amber-500 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => toggleHighlight('unplanned')}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                        highlights.includes('unplanned')
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-dashed border-border hover:border-purple-500/50'
                      )}
                    >
                      <Sparkles className={cn(
                        'w-5 h-5 flex-shrink-0',
                        highlights.includes('unplanned') ? 'text-purple-500' : 'text-muted-foreground'
                      )} />
                      <span className="font-medium">Something unplanned</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="changes"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-xl font-semibold text-center">
                    What would you change?
                  </h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Select all that apply
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {changeOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => toggleChange(option)}
                        className={cn(
                          'px-4 py-2 rounded-full border transition-all text-sm',
                          wouldChange.includes(option)
                            ? option === 'Nothing—it was perfect'
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="final"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-center">
                      Overall, how was it?
                    </h3>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => setOverallRating(rating)}
                          className={cn(
                            'w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center',
                            overallRating && rating <= overallRating
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'border-border hover:border-amber-500/50'
                          )}
                        >
                          <Star className={cn(
                            'w-5 h-5',
                            overallRating && rating <= overallRating && 'fill-current'
                          )} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Any final thoughts?
                    </label>
                    <Textarea
                      value={finalThoughts}
                      onChange={(e) => setFinalThoughts(e.target.value)}
                      placeholder="What will you remember most? Any tips for others visiting?"
                      className="min-h-[100px] resize-none"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 p-4 border-t border-border/50 bg-muted/30">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose} className="flex-1">
                Later
              </Button>
            )}
            
            {step < totalSteps - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} className="flex-1">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={upsertMutation.isPending}
                className="flex-1 gap-2"
              >
                <Send className="w-4 h-4" />
                {upsertMutation.isPending ? 'Saving...' : 'Submit & fly safe ✈️'}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DepartureReflection;
