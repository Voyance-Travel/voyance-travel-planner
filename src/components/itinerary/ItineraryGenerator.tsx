import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle, MapPin, Clock, DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useItineraryGeneration, GeneratedDay } from '@/hooks/useItineraryGeneration';
import { format, parseISO } from 'date-fns';

interface ItineraryGeneratorProps {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
  userId?: string;
  onComplete: (days: GeneratedDay[]) => void;
  onCancel?: () => void;
}

export function ItineraryGenerator({
  tripId,
  destination,
  destinationCountry,
  startDate,
  endDate,
  travelers,
  tripType,
  budgetTier,
  userId,
  onComplete,
  onCancel,
}: ItineraryGeneratorProps) {
  const {
    isGenerating,
    currentDay,
    totalDays,
    progress,
    days,
    error,
    generateItinerary,
    saveItinerary,
    reset,
  } = useItineraryGeneration();

  const [hasStarted, setHasStarted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    setHasStarted(true);
    try {
      const generatedDays = await generateItinerary({
        tripId,
        destination,
        destinationCountry,
        startDate,
        endDate,
        travelers,
        tripType,
        budgetTier,
        userId,
      });

      // Auto-save after generation
      setIsSaving(true);
      await saveItinerary(tripId, generatedDays);
      setIsSaving(false);

      onComplete(generatedDays);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  const handleRetry = () => {
    reset();
    handleGenerate();
  };

  // Initial state - show generate button
  if (!hasStarted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          
          <h2 className="text-2xl font-serif font-bold mb-3">
            Create Your Personalized Itinerary
          </h2>
          
          <p className="text-muted-foreground mb-8">
            Our AI will craft a day-by-day itinerary tailored to your preferences for {destination}.
          </p>
          
          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={handleGenerate} className="gap-2">
              <Sparkles className="h-5 w-5" />
              Generate Itinerary
            </Button>
            
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16"
      >
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>
          
          <h2 className="text-xl font-semibold mb-2">Generation Failed</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { reset(); setHasStarted(false); }}>
              Go Back
            </Button>
            <Button onClick={handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Generating state
  return (
    <div className="py-8">
      {/* Progress Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">
            {isGenerating ? `Generating Day ${currentDay} of ${totalDays}...` : isSaving ? 'Saving...' : 'Complete!'}
          </span>
        </div>
        
        <h2 className="text-2xl font-serif font-bold mb-2">
          Crafting Your {destination} Adventure
        </h2>
        
        <div className="max-w-md mx-auto mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
        </div>
      </motion.div>

      {/* Generated Days Preview */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-4 max-w-2xl mx-auto">
          {days.map((day, index) => (
            <motion.div
              key={day.dayNumber}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      Day {day.dayNumber}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(day.date), 'EEEE, MMM d')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg">{day.theme}</h3>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>

              <div className="space-y-2">
                {day.activities.slice(0, 4).map((activity, actIdx) => (
                  <div
                    key={activity.id || actIdx}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="text-muted-foreground w-14 shrink-0 font-mono">
                      {activity.startTime}
                    </span>
                    <span className="flex-1 truncate">{activity.name}</span>
                    {activity.estimatedCost?.amount > 0 && (
                      <span className="text-muted-foreground shrink-0">
                        ${activity.estimatedCost.amount}
                      </span>
                    )}
                  </div>
                ))}
                {day.activities.length > 4 && (
                  <p className="text-xs text-muted-foreground pl-14">
                    +{day.activities.length - 4} more activities
                  </p>
                )}
              </div>
            </motion.div>
          ))}

          {/* Placeholder for currently generating day */}
          {isGenerating && currentDay > days.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-dashed border-primary/30 rounded-xl p-5"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground">
                  Generating Day {currentDay}...
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
}
