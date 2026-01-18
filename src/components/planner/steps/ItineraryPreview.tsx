import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plane, Hotel, MapPin, Clock, Calendar, Loader2, RefreshCw, AlertCircle, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useItinerary, useGenerateItinerary, isItineraryReady, isItineraryGenerating, getStatusMessage } from '@/services/itineraryAPI';
import { convertBackendDay } from '@/types/itinerary';
import type { DayItinerary } from '@/types/itinerary';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import { useEntitlements, canUse, getRemainingQuota, useConsumeUsage } from '@/hooks/useEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { UpgradePrompt } from '@/components/common/UpgradePrompt';
import { Link } from 'react-router-dom';

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

// Generating state component
function ItineraryGeneratingState({ progress, message }: { progress?: number; message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
      
      <h3 className="text-xl font-medium text-foreground mb-2">
        Crafting Your Perfect Itinerary
      </h3>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        {message || 'Our AI is creating personalized recommendations based on your preferences...'}
      </p>
      
      {progress !== undefined && (
        <div className="w-64">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center mt-2">
            {Math.round(progress)}% complete
          </p>
        </div>
      )}
      
      <div className="mt-8 space-y-2">
        {[0, 1, 2].map((i) => (
          <DayCardSkeleton key={i} dayIndex={i} />
        ))}
      </div>
    </motion.div>
  );
}

// Error state component
function ItineraryErrorState({ 
  error, 
  onRetry 
}: { 
  error: string; 
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      
      <h3 className="text-xl font-medium text-foreground mb-2">
        Unable to Generate Itinerary
      </h3>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        {error || 'Something went wrong while creating your itinerary. Please try again.'}
      </p>
      
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Try Again
      </Button>
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
  const { isAuthenticated } = useAuth();
  const { entitlements, isLoading: isLoadingEntitlements, isPaid } = useEntitlements();
  const consumeUsage = useConsumeUsage();
  const [hasConsumedQuota, setHasConsumedQuota] = useState(false);

  // Check entitlements
  const canGenerate = canUse(entitlements, 'ai.itinerary.generate');
  const canRegenerate = canUse(entitlements, 'ai.itinerary.regenerate');
  const remainingGenerations = getRemainingQuota(entitlements, 'ai.itinerary.generate_quota_month');
  const showReasoning = canUse(entitlements, 'ai.itinerary.reasoning');

  // Fetch itinerary from API with auto-polling during generation
  const { 
    data: itineraryResponse, 
    isLoading: isFetching, 
    error: fetchError,
    refetch 
  } = useItinerary(tripId || null, { refetchInterval: 3000 });
  
  const generateMutation = useGenerateItinerary();
  
  // Auto-trigger generation if no itinerary exists AND user has quota
  useEffect(() => {
    if (tripId && itineraryResponse?.status === 'not_started' && canGenerate && !hasConsumedQuota) {
      // Consume quota before generating
      consumeUsage.mutate(
        { metricKey: 'ai.itinerary.generate', amount: 1 },
        {
          onSuccess: () => {
            setHasConsumedQuota(true);
            generateMutation.mutate({ tripId });
          },
        }
      );
    }
  }, [tripId, itineraryResponse?.status, canGenerate, hasConsumedQuota]);

  // Convert API days to frontend format
  const days: DayItinerary[] = itineraryResponse?.itinerary?.days?.map(convertBackendDay) || [];
  
  const status = itineraryResponse?.status;
  const isGenerating = status ? isItineraryGenerating(status) : false;
  const isReady = status ? isItineraryReady(status) : false;
  const progress = itineraryResponse?.progress;
  const statusMessage = status ? getStatusMessage(status, progress) : '';

  // Handle retry/regenerate
  const handleRetry = () => {
    if (!tripId) return;
    
    // For regeneration, check entitlement
    if (isReady && !canRegenerate) {
      return; // Button should be disabled anyway
    }
    
    // Consume quota if regenerating (not initial generation failure)
    if (isReady) {
      consumeUsage.mutate(
        { metricKey: 'ai.itinerary.regenerate', amount: 1 },
        { onSuccess: () => generateMutation.mutate({ tripId }) }
      );
    } else {
      generateMutation.mutate({ tripId });
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

  // Show loading state
  if (isFetching && !itineraryResponse) {
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
            Loading itinerary for {tripDetails.destination}...
          </p>
        </div>
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <DayCardSkeleton key={i} dayIndex={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  // Show generating state
  if (isGenerating || generateMutation.isPending) {
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
            Generating itinerary for {tripDetails.destination}
          </p>
        </div>
        <ItineraryGeneratingState 
          progress={progress} 
          message={statusMessage}
        />
      </motion.div>
    );
  }

  // Show error state
  if (fetchError || status === 'failed' || generateMutation.isError) {
    const errorMessage = 
      fetchError?.message || 
      itineraryResponse?.error || 
      generateMutation.error?.message ||
      'Failed to generate itinerary';
    
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
        <ItineraryErrorState error={errorMessage} onRetry={handleRetry} />
        <div className="flex justify-start mt-8">
          <Button variant="outline" onClick={onBack} className="h-12 px-6">
            Back
          </Button>
        </div>
      </motion.div>
    );
  }

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
          Review your itinerary for {tripDetails.destination}
        </p>
      </div>

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
            <motion.div
              key={day.dayNumber || dayIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dayIndex * 0.1 }}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              {/* Day Header */}
              <div className="bg-muted/50 px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Day {day.dayNumber || dayIndex + 1}
                    </span>
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
                      <p className="capitalize">{day.weather.condition}</p>
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
              </div>
            </motion.div>
          ))
        ) : (
          // Fallback if no days yet but itinerary is "ready"
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-muted-foreground">
              No itinerary data available yet.
            </p>
            <Button 
              onClick={handleRetry} 
              variant="outline" 
              className="mt-4 gap-2"
              disabled={generateMutation.isPending}
            >
              <RefreshCw className="w-4 h-4" />
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
