import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle, MapPin, Clock, DollarSign, RefreshCw, Star, Image, Wallet, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useItineraryGeneration, GeneratedDay, TripOverview } from '@/hooks/useItineraryGeneration';
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
  onComplete: (days: GeneratedDay[], overview?: TripOverview) => void;
  onCancel?: () => void;
}

// Status messages for each generation stage
const STATUS_MESSAGES = {
  idle: 'Ready to generate',
  preparing: 'Analyzing your preferences...',
  generating: 'Crafting your perfect itinerary...',
  enriching: 'Adding photos and details...',
  complete: 'Your itinerary is ready!',
  error: 'Something went wrong',
};

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
    overview,
    error,
    status,
    generateItinerary,
    reset,
  } = useItineraryGeneration();

  const [hasStarted, setHasStarted] = useState(false);

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

      onComplete(generatedDays, overview);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  const handleRetry = () => {
    reset();
    handleGenerate();
  };

  // Get activity name (supports both formats)
  const getActivityName = (activity: GeneratedDay['activities'][0]) => {
    return activity.title || (activity as { name?: string }).name || 'Activity';
  };

  // Get activity cost
  const getActivityCost = (activity: GeneratedDay['activities'][0]) => {
    if (activity.cost?.amount !== undefined) {
      return activity.cost.amount;
    }
    if ((activity as { estimatedCost?: { amount: number } }).estimatedCost?.amount !== undefined) {
      return (activity as { estimatedCost: { amount: number } }).estimatedCost.amount;
    }
    return 0;
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
          
          <p className="text-muted-foreground mb-4">
            Our AI will craft a complete day-by-day itinerary tailored to your preferences for{' '}
            <span className="font-medium text-foreground">{destination}</span>.
          </p>

          <div className="flex flex-wrap gap-2 justify-center mb-8">
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" />
              {destination}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
            </Badge>
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {budgetTier || 'Standard'}
            </Badge>
          </div>
          
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

          <p className="text-xs text-muted-foreground mt-6">
            Includes activities, restaurants, transportation, and local tips
          </p>
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
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === 'complete' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">
            {STATUS_MESSAGES[status] || STATUS_MESSAGES.generating}
          </span>
        </div>
        
        <h2 className="text-2xl font-serif font-bold mb-2">
          {status === 'complete' 
            ? `Your ${destination} Adventure` 
            : `Crafting Your ${destination} Adventure`
          }
        </h2>
        
        <div className="max-w-md mx-auto mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {status === 'complete' 
              ? `${days.length} days of adventure ready` 
              : `${progress}% complete`
            }
          </p>
        </div>
      </motion.div>

      {/* Budget Overview (if available) */}
      {status === 'complete' && overview?.budgetBreakdown && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mb-6"
        >
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium">Estimated Trip Budget</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Activities</p>
                  <p className="font-semibold">${overview.budgetBreakdown.activities}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Food</p>
                  <p className="font-semibold">${overview.budgetBreakdown.food}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transport</p>
                  <p className="font-semibold">${overview.budgetBreakdown.transportation}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold text-primary">${overview.budgetBreakdown.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Highlights (if available) */}
      {status === 'complete' && overview?.highlights && overview.highlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto mb-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Trip Highlights</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {overview.highlights.map((highlight, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {highlight}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Local Tips (if available) */}
      {status === 'complete' && overview?.localTips && overview.localTips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto mb-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-primary" />
                <span className="font-medium">Local Tips</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {overview.localTips.slice(0, 3).map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                    {day.metadata?.pacingLevel && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {day.metadata.pacingLevel}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg">{day.title || day.theme}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {day.metadata?.totalEstimatedCost !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      ~${day.metadata.totalEstimatedCost}
                    </span>
                  )}
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>

              <div className="space-y-3">
                {day.activities.slice(0, 4).map((activity, actIdx) => (
                  <div
                    key={activity.id || actIdx}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="text-muted-foreground w-14 shrink-0 font-mono">
                      {activity.startTime}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{getActivityName(activity)}</span>
                        {activity.photos && activity.photos.length > 0 && (
                          <Image className="h-3 w-3 text-muted-foreground" />
                        )}
                        {activity.verified?.isValid && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {activity.category && (
                        <Badge variant="outline" className="text-xs mt-0.5 capitalize">
                          {activity.category}
                        </Badge>
                      )}
                    </div>
                    {getActivityCost(activity) > 0 && (
                      <span className="text-muted-foreground shrink-0">
                        ${getActivityCost(activity)}
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

          {/* Placeholder for generating state */}
          {isGenerating && days.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-dashed border-primary/30 rounded-xl p-8"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">
                    Creating your personalized itinerary...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Analyzing {destination} attractions, dining, and experiences
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Progressive generation placeholder */}
          {isGenerating && days.length > 0 && currentDay > days.length && (
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
