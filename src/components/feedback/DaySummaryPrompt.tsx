/**
 * DaySummaryPrompt
 * End-of-day reflection UI for active trips
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Moon, Star, Battery, Sparkles, 
  ChevronUp, ChevronDown, Zap, Coffee 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useUpsertDaySummary } from '@/services/feedbackAPI';
import type { ActivityContext } from '@/types/feedback';
import { formatTime12h } from '@/utils/timeFormat';

interface DaySummaryPromptProps {
  tripId: string;
  destination: string;
  dayNumber: number;
  dayDate: string;
  activities: ActivityContext[];
  onClose: () => void;
  onComplete: () => void;
}

const pacingOptions = [
  { value: 'too_rushed', label: 'Too rushed', icon: Zap },
  { value: 'just_right', label: 'Just right', icon: Coffee },
  { value: 'too_slow', label: 'Too slow', icon: Moon },
] as const;

export function DaySummaryPrompt({
  tripId,
  destination,
  dayNumber,
  dayDate,
  activities,
  onClose,
  onComplete,
}: DaySummaryPromptProps) {
  const [step, setStep] = useState(0);
  const [pacing, setPacing] = useState<'too_rushed' | 'just_right' | 'too_slow' | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const upsertMutation = useUpsertDaySummary();

  const handleSubmit = async () => {
    try {
      await upsertMutation.mutateAsync({
        trip_id: tripId,
        day_number: dayNumber,
        day_date: dayDate,
        pacing_rating: pacing || undefined,
        highlight_activity_id: highlightId || undefined,
        energy_level: energyLevel || undefined,
        notes: notes || undefined,
      });
      onComplete();
    } catch (error) {
      console.error('Failed to save day summary:', error);
    }
  };

  const totalSteps = 3;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
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
          <div className="relative p-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-b border-border/50">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Moon className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="font-semibold">Day {dayNumber} wrap-up</h2>
                <p className="text-sm text-muted-foreground">{destination}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex gap-1 mt-4">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all',
                    idx <= step ? 'bg-indigo-500' : 'bg-white/20'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="pacing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-lg font-medium text-center">
                    Was the pacing right today?
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {pacingOptions.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setPacing(value)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                          pacing === value
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600'
                            : 'border-border hover:border-indigo-500/50'
                        )}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="highlight"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-lg font-medium text-center">
                    Best moment?
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {activities.map((activity) => (
                      <button
                        key={activity.id}
                        onClick={() => setHighlightId(activity.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                          highlightId === activity.id
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-border hover:border-amber-500/50'
                        )}
                      >
                        {highlightId === activity.id ? (
                          <Star className="w-5 h-5 text-amber-500 fill-current flex-shrink-0" />
                        ) : (
                          <Star className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{activity.name}</p>
                          {activity.startTime && (
                            <p className="text-xs text-muted-foreground">{activity.startTime}</p>
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => setHighlightId('unplanned')}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                        highlightId === 'unplanned'
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-dashed border-border hover:border-purple-500/50'
                      )}
                    >
                      <Sparkles className={cn(
                        'w-5 h-5 flex-shrink-0',
                        highlightId === 'unplanned' ? 'text-purple-500' : 'text-muted-foreground'
                      )} />
                      <span className="font-medium">Something unplanned</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="energy"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium text-center">
                      Energy level?
                    </h3>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          onClick={() => setEnergyLevel(level)}
                          className={cn(
                            'w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center',
                            energyLevel === level
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : energyLevel && level <= energyLevel
                                ? 'bg-emerald-500/20 border-emerald-500/50'
                                : 'border-border hover:border-emerald-500/50'
                          )}
                        >
                          <Battery className={cn(
                            'w-5 h-5',
                            level <= (energyLevel || 0) ? 'text-emerald-500' : ''
                          )} />
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                      {energyLevel === 1 && 'Running on empty'}
                      {energyLevel === 2 && 'A bit tired'}
                      {energyLevel === 3 && 'Doing okay'}
                      {energyLevel === 4 && 'Feeling good'}
                      {energyLevel === 5 && 'Full of energy!'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Anything else? (optional)
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any thoughts, discoveries, or notes for tomorrow..."
                      className="min-h-[80px] resize-none"
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
                <ChevronUp className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose} className="flex-1">
                Skip
              </Button>
            )}
            
            {step < totalSteps - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} className="flex-1">
                Next
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={upsertMutation.isPending}
                className="flex-1"
              >
                {upsertMutation.isPending ? 'Saving...' : 'Done'}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DaySummaryPrompt;
