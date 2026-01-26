import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle, MapPin, Clock, DollarSign, RefreshCw, Star, Image, Wallet, Lightbulb, AlertCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useItineraryGeneration, GeneratedDay, TripOverview } from '@/hooks/useItineraryGeneration';
import { useEntitlements } from '@/hooks/useEntitlements';
import { UsageLimitNotice } from '@/components/common/UsageLimitNotice';
import { PreferenceNudge, usePreferenceCompletion } from '@/components/common/PreferenceNudge';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { ROUTES } from '@/config/routes';

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
  /** Auto-start generation immediately without showing confirmation */
  autoStart?: boolean;
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
  autoStart = false,
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

  // Get entitlements for usage limits
  const { data: entitlements, isPaid } = useEntitlements();
  const freeBuildsRemaining = entitlements?.limits?.freeBuildsRemaining ?? 1;
  const freeBuildsLimit = entitlements?.limits?.fullBuilds ?? 1;

  // Get auth state
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get preference completion status
  const { data: preferenceStatus } = usePreferenceCompletion();
  const showPreferenceNudge = preferenceStatus && 
    (preferenceStatus.personalizationLevel === 'none' || preferenceStatus.personalizationLevel === 'basic');

  const [hasStarted, setHasStarted] = useState(false);
  const [showNudgeCard, setShowNudgeCard] = useState(true);
  const [showGenericWarning, setShowGenericWarning] = useState(false);
  const autoStartTriggered = useRef(false);

  const handleGenerate = async () => {
    setHasStarted(true);
    setShowGenericWarning(false);
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

  // Auto-start generation if prop is true and user has builds remaining AND is authenticated
  // BUT if user has no personalization, show warning first
  useEffect(() => {
    if (autoStart && !autoStartTriggered.current && user && (isPaid || freeBuildsRemaining > 0)) {
      autoStartTriggered.current = true;
      
      // If user has no/basic personalization, show warning instead of auto-starting
      if (showPreferenceNudge) {
        setShowGenericWarning(true);
      } else {
        handleGenerate();
      }
    }
  }, [autoStart, isPaid, freeBuildsRemaining, user, showPreferenceNudge]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleRetry = () => {
    reset();
    handleGenerate();
  };

  // Get activity name (supports both formats) and sanitize system prefixes
  const getActivityName = (activity: GeneratedDay['activities'][0]) => {
    const rawName = activity.title || (activity as { name?: string }).name || 'Activity';
    return sanitizeActivityName(rawName);
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
    // Show sign-in prompt if not authenticated
    if (!user) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <LogIn className="h-10 w-10 text-primary" />
            </div>
            
            <h2 className="text-2xl font-serif font-bold mb-3">
              Sign In to Generate Your Itinerary
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Create a free account to generate personalized itineraries tailored to your travel style.
              It's free and takes just seconds.
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                onClick={() => navigate(`/signin?redirect=${encodeURIComponent(`/trip/${tripId}?generate=true`)}`)}
                className="gap-2"
              >
                <LogIn className="h-5 w-5" />
                Sign In to Continue
              </Button>
              
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Free accounts get 1 itinerary build per month
            </p>
          </div>
        </motion.div>
      );
    }

    // Show generic itinerary warning for users without personalization
    if (showGenericWarning || (showPreferenceNudge && showNudgeCard)) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="max-w-lg mx-auto">
            {/* Warning icon */}
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-amber-600" />
            </div>
            
            <h2 className="text-2xl font-serif font-bold mb-3">
              Your Itinerary Won't Be Personalized
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Without completing your Travel DNA quiz, we can only generate a <strong className="text-foreground">generic itinerary</strong>. 
              Take 2 minutes to tell us about your travel style and get recommendations that actually match <em>you</em>.
            </p>

            {/* What you're missing */}
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium text-foreground mb-3">With personalization, you'll get:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Restaurants that match your dietary needs & cuisine preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>A pace that fits your energy level (not too rushed, not too slow)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Activities aligned with your interests and travel style</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                onClick={() => navigate(ROUTES.QUIZ)}
                className="gap-2"
              >
                <Sparkles className="h-5 w-5" />
                Take the Quiz (2 min)
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowGenericWarning(false);
                  setShowNudgeCard(false);
                  handleGenerate();
                }}
                className="text-muted-foreground"
              >
                Skip and generate generic itinerary
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              You can always retake the quiz later from your profile
            </p>
          </div>
        </motion.div>
      );
    }

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

          <div className="flex flex-wrap gap-2 justify-center mb-6">
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

          {/* Preference completion nudge */}
          {showPreferenceNudge && showNudgeCard && (
            <div className="mb-6">
              <PreferenceNudge 
                variant="card"
                showProceedButton
                onProceedAnyway={() => setShowNudgeCard(false)}
                onDismiss={() => setShowNudgeCard(false)}
              />
            </div>
          )}

          {/* Usage limit notice for free users */}
          {!isPaid && freeBuildsRemaining > 0 && (
            <div className="mb-6">
              <UsageLimitNotice
                featureName="itinerary build"
                remaining={freeBuildsRemaining}
                limit={freeBuildsLimit}
                isPaid={isPaid}
              />
            </div>
          )}

          {/* No builds remaining warning */}
          {!isPaid && freeBuildsRemaining <= 0 && (
            <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>You have used your free itinerary build this month. Upgrade to continue.</span>
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              onClick={handleGenerate} 
              className="gap-2"
              disabled={!isPaid && freeBuildsRemaining <= 0}
            >
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

  // Error state - check if it's an auth error
  if (error) {
    const isAuthError = error.toLowerCase().includes('unauthorized') || 
                        error.toLowerCase().includes('sign in') ||
                        error.toLowerCase().includes('authentication');

    if (isAuthError || !user) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <LogIn className="h-10 w-10 text-primary" />
            </div>
            
            <h2 className="text-2xl font-serif font-bold mb-3">
              Create Your Free Account
            </h2>
            
            <p className="text-muted-foreground mb-2">
              Sign up in seconds to generate personalized itineraries tailored to your travel style.
            </p>
            
            <p className="text-sm text-muted-foreground mb-6">
              Your first itinerary build is <span className="font-medium text-foreground">completely free</span> - no credit card required.
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                onClick={() => navigate(`/signup?redirect=${encodeURIComponent(`/trip/${tripId}?generate=true`)}`)}
                className="gap-2"
              >
                <Sparkles className="h-5 w-5" />
                Create Free Account
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate(`/signin?redirect=${encodeURIComponent(`/trip/${tripId}?generate=true`)}`)}
                className="gap-2"
              >
                <LogIn className="h-5 w-5" />
                Already have an account? Sign In
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Join thousands of travelers planning smarter trips
            </p>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16"
      >
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2">Something Went Wrong</h2>
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
