import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plane, Hotel, MapPin, Clock, Calendar, Loader2, RefreshCw, AlertCircle, Sparkles, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { DayItinerary } from '@/types/itinerary';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { useEntitlements, canUse, getRemainingQuota, useConsumeUsage } from '@/hooks/useEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { isQuizCompleted } from '@/utils/quizUtils';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';
import { formatWeatherCondition } from '@/utils/textFormatting';
import { useLovableItinerary, GenerationPreferences } from '@/hooks/useLovableItinerary';
import { AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ItineraryPreviewProps {
  tripId?: string;
  tripDetails: {
    name?: string;
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers: number;
  };
  onComplete: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

// Loading skeleton for day cards
function DayCardSkeleton({ dayIndex }: { dayIndex: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.1 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      <div className="bg-muted/50 px-6 py-4 border-b border-border">
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="flex items-center gap-2 w-24 flex-shrink-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Streaming day card component
function StreamingDayCard({ day, isNew }: { day: DayItinerary; isNew: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`bg-card rounded-xl border overflow-hidden ${isNew ? 'ring-2 ring-primary/50 border-primary/30' : 'border-border'}`}
    >
      {/* Day Header */}
      <div className="bg-muted/50 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Day {day.dayNumber}
              </span>
              {isNew && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Just added
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {day.date ? format(new Date(day.date), 'EEEE, MMMM d') : day.theme}
            </h3>
            {day.theme && day.date && (
              <p className="text-sm text-muted-foreground mt-1">{day.theme}</p>
            )}
          </div>
          {day.weather && (
            <div className="text-right text-sm text-muted-foreground">
              <p>{day.weather.high}°/{day.weather.low}°</p>
              <p>{formatWeatherCondition(day.weather.condition)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Activities */}
      <div className="p-6">
        <div className="space-y-4">
          {day.activities.map((activity, actIndex) => (
            <div key={activity.id || actIndex} className="flex gap-4">
              <div className="flex items-center gap-2 text-muted-foreground w-24 flex-shrink-0">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{activity.time}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{activity.title}</p>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                {activity.location?.name && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {activity.location.name}
                  </p>
                )}
                {activity.cost > 0 && (
                  <p className="text-xs text-primary mt-1">
                    Est. cost: ${activity.cost}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        {day.activities.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm text-muted-foreground">
            <span>{day.estimatedWalkingTime} walking</span>
            <span className="font-medium text-foreground">
              Day total: ${day.totalCost}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ItineraryPreview({
  tripId,
  tripDetails,
  onComplete,
  onBack,
  isLoading: isSubmitting,
}: ItineraryPreviewProps) {
  const { isAuthenticated, user } = useAuth();
  const { entitlements, isLoading: isLoadingEntitlements, isPaid } = useEntitlements();
  const consumeUsage = useConsumeUsage();
  const [hasConsumedQuota, setHasConsumedQuota] = useState(false);
  
  // Check if user has completed the quiz
  const hasCompletedQuiz = user?.quizCompleted || isQuizCompleted();

  // Check entitlements
  const canGenerate = canUse(entitlements, 'ai.itinerary.generate');
  const canRegenerate = canUse(entitlements, 'ai.itinerary.regenerate');
  const remainingGenerations = getRemainingQuota(entitlements, 'ai.itinerary.generate_quota_month');

  // Use new Lovable AI itinerary hook
  const {
    loading,
    progress,
    currentStep,
    currentDay,
    totalDays,
    message,
    days,
    error,
    hasExistingItinerary,
    generationDuration,
    checkExisting,
    generateItinerary,
    regenerate,
    cancel,
    clearError,
  } = useLovableItinerary(tripId || null);

  // Check for existing itinerary on mount, then auto-start if needed
  useEffect(() => {
    if (!tripId) return;
    
    const init = async () => {
      const exists = await checkExisting();
      if (!exists && canGenerate && !hasConsumedQuota) {
        // Consume quota before generating
        consumeUsage.mutate(
          { metricKey: 'ai.itinerary.generate', amount: 1 },
          {
            onSuccess: () => {
              setHasConsumedQuota(true);
              generateItinerary();
            },
          }
        );
      }
    };
    init();
  }, [tripId, canGenerate, hasConsumedQuota]);

  const isReady = currentStep === 'complete' && days.length > 0;
  const isGenerating = loading;

  // Handle retry/regenerate
  const handleRetry = () => {
    if (!tripId) return;
    
    // For regeneration, check entitlement
    if (isReady && !canRegenerate) {
      return;
    }
    
    // Consume quota if regenerating
    if (isReady) {
      consumeUsage.mutate(
        { metricKey: 'ai.itinerary.regenerate', amount: 1 },
        { onSuccess: () => regenerate() }
      );
    } else {
      regenerate();
    }
  };

  // Check if user can generate (has quota)
  if (!isLoadingEntitlements && !canGenerate && !isReady && !isGenerating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            Your Trip Preview
          </h1>
          <p className="text-muted-foreground">
            AI itinerary for {tripDetails.destination}
          </p>
        </div>
        
        <UpgradePrompt
          feature="AI itinerary generations"
          reason={remainingGenerations === 0 ? 'limit_reached' : 'disabled'}
          remaining={remainingGenerations ?? undefined}
          limit={entitlements?.['ai.itinerary.generate_quota_month']?.limit}
        />
        
        <div className="flex justify-start mt-8">
          <Button variant="outline" onClick={onBack} className="h-12 px-6">
            Back
          </Button>
        </div>
      </motion.div>
    );
  }

  // Show error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            Your Trip Preview
          </h1>
        </div>
        
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg text-destructive">Generation Failed</h3>
                <p className="text-muted-foreground mt-1">{message}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { clearError(); onBack(); }}>
                  Go Back
                </Button>
                <Button onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Show generating/streaming state
  if (isGenerating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            Your Trip Preview
          </h1>
          <p className="text-muted-foreground">
            Generating itinerary for {tripDetails.destination}
          </p>
        </div>

        {/* Quiz Not Completed Warning - show during generation too */}
        {!hasCompletedQuiz && (
          <Card className="border-amber-500/30 bg-amber-500/10 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Generating Generic Itinerary</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Since you haven't completed the quiz, this itinerary won't reflect your personal preferences. You can take the quiz later to get more personalized recommendations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{message}</span>
                  <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
            
            {currentStep === 'generating' && totalDays > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Day {currentDay} of {totalDays}</span>
              </div>
            )}

            <div className="flex justify-center mt-4">
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Streaming Day Cards - show as they're generated */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {days.map((day, index) => (
              <StreamingDayCard 
                key={day.dayNumber} 
                day={day} 
                isNew={index === days.length - 1}
              />
            ))}
          </AnimatePresence>

          {/* Placeholder for next day being generated */}
          {currentDay > 0 && currentDay <= totalDays && days.length < currentDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8"
            >
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Day {currentDay}...</span>
              </div>
            </motion.div>
          )}

          {/* Show skeletons for remaining days */}
          {days.length === 0 && [0, 1, 2].map((i) => (
            <DayCardSkeleton key={i} dayIndex={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  // Show complete state with itinerary
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-6">
        <h1 className="text-3xl font-display font-medium text-foreground mb-2">
          Your Trip Preview
        </h1>
        <p className="text-muted-foreground">
          Review your itinerary for {tripDetails.destination}
        </p>
      </div>

      {/* Quiz Not Completed Warning */}
      {!hasCompletedQuiz && (
        <Card className="border-amber-500/30 bg-amber-500/10 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Generic Itinerary</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This itinerary is based on general recommendations. Take the <a href="/quiz" className="text-primary hover:underline font-medium">Travel Quiz</a> to get personalized suggestions tailored to your preferences, dietary needs, and travel style.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Header */}
      {isReady && (
        <Card className="border-primary/20 bg-primary/5 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Your Itinerary is Ready!</h3>
                <p className="text-sm text-muted-foreground">
                  {days.length} days planned
                  {generationDuration && ` • Generated in ${(generationDuration / 1000).toFixed(1)}s`}
                </p>
              </div>
              {canRegenerate && (
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trip Summary Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white mb-8">
        <h2 className="text-2xl font-display font-medium mb-4">
          {tripDetails.name || `Trip to ${tripDetails.destination}`}
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Destination</p>
              <p className="font-medium">{tripDetails.destination}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">From</p>
              <p className="font-medium">{tripDetails.departureCity}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Dates</p>
              <p className="font-medium">
                {format(new Date(tripDetails.startDate), 'MMM d')} -{' '}
                {format(new Date(tripDetails.endDate), 'MMM d')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Travelers</p>
              <p className="font-medium">{tripDetails.travelers} guests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Day-by-Day Itinerary */}
      <div className="space-y-6 mb-10">
        {days.length > 0 ? (
          days.map((day, dayIndex) => (
            <StreamingDayCard key={day.dayNumber || dayIndex} day={day} isNew={false} />
          ))
        ) : (
          // Fallback if no days yet
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground mb-4">
              No itinerary data available yet.
            </p>
            <Button 
              onClick={() => generateItinerary()} 
              variant="default" 
              className="gap-2"
              disabled={loading}
            >
              <Sparkles className="w-4 h-4" />
              Generate Itinerary
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="h-12 px-6">
          Back
        </Button>
        <Button
          onClick={onComplete}
          disabled={isSubmitting || !isReady || days.length === 0}
          className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Trip...
            </span>
          ) : (
            'Confirm & Book'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
