/**
 * Streaming Itinerary Generator Component
 * 
 * Shows real-time progress as each day is generated using Lovable AI.
 * Provides visual feedback with day cards appearing as they're created.
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Calendar, MapPin, Sparkles, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLovableItinerary, GenerationPreferences, GenerationStep } from '@/hooks/useLovableItinerary';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import type { DayItinerary } from '@/types/itinerary';
import { GenerationPhases } from './shared/GenerationPhases';

interface ItineraryGeneratorStreamingProps {
  tripId: string;
  onComplete?: (days: DayItinerary[]) => void;
  preferences?: GenerationPreferences;
  autoStart?: boolean;
}

export function ItineraryGeneratorStreaming({
  tripId,
  onComplete,
  preferences,
  autoStart = true,
}: ItineraryGeneratorStreamingProps) {
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
  } = useLovableItinerary(tripId);

  // Check for existing itinerary on mount, then auto-start if needed
  useEffect(() => {
    const init = async () => {
      const exists = await checkExisting();
      if (!exists && autoStart) {
        generateItinerary(preferences);
      }
    };
    init();
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent when complete
  useEffect(() => {
    if (currentStep === 'complete' && days.length > 0) {
      onComplete?.(days);
    }
  }, [currentStep, days, onComplete]);

  // Error state
  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div>
              <h3 className="font-semibold text-lg text-destructive">Generation Failed</h3>
              <p className="text-muted-foreground mt-1">{message}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={clearError}>
                Cancel
              </Button>
              <Button onClick={() => regenerate(preferences)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Helper to check if in pre-generation phases
  const isPreGenerationPhase = ['gathering-dna', 'personalizing', 'preparing'].includes(currentStep);

  // Loading/generating state
  if (loading) {
    // Show pre-generation phases
    if (isPreGenerationPhase) {
      return (
        <div className="py-8">
          <GenerationPhases currentStep={currentStep} />
          <div className="flex justify-center mt-6">
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    // Show day-by-day generation progress with engaging visuals
    return (
      <div className="space-y-6">
        {/* Animated Progress Header */}
        <Card className="overflow-hidden">
          <CardContent className="pt-6 relative">
            {/* Background animation */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  {/* Pulsing background ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/20"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                  </motion.div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <motion.span 
                      className="font-semibold text-foreground"
                      key={message}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {message}
                    </motion.span>
                    <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
                  </div>
                  <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                    <motion.div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full"
                      style={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              </div>
              
              {currentStep === 'generating' && totalDays > 0 && (
                <motion.div 
                  className="flex items-center justify-center gap-3 py-2 rounded-lg bg-primary/5"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">
                    Crafting Day {currentDay} of {totalDays}
                  </span>
                  <motion.div
                    className="flex gap-1"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/30" />
                  </motion.div>
                </motion.div>
              )}

              <div className="flex justify-center mt-4">
                <Button variant="ghost" size="sm" onClick={cancel}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streaming Day Cards with enhanced animations */}
        <AnimatePresence mode="popLayout">
          {days.map((day, index) => (
            <motion.div
              key={day.dayNumber}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.15,
                type: 'spring',
                stiffness: 100
              }}
            >
              <StreamingDayCard day={day} isNew={index === days.length - 1} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Enhanced placeholder for next day being generated */}
        {currentDay > 0 && currentDay <= totalDays && days.length < currentDay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative border-2 border-dashed border-primary/30 rounded-xl p-8 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden"
          >
            {/* Animated background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
            
            <div className="relative flex flex-col items-center justify-center gap-4">
              <motion.div
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Creating Day {currentDay}</p>
                <p className="text-sm text-muted-foreground">Finding the perfect activities...</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // Complete state
  if (currentStep === 'complete' && days.length > 0) {
    return (
      <div className="space-y-6">
        {/* Success Header */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Your Itinerary is Ready!</h3>
                <p className="text-sm text-muted-foreground">
                  {days.length} days crafted by Voyance
                  {generationDuration && ` • Generated in ${(generationDuration / 1000).toFixed(1)}s`}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => regenerate(preferences)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Day Cards */}
        <div className="space-y-4">
          {days.map((day) => (
            <StreamingDayCard key={day.dayNumber} day={day} isNew={false} />
          ))}
        </div>
      </div>
    );
  }

  // Idle state - show start button
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center gap-4">
          <Sparkles className="w-12 h-12 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">Generate Your Itinerary</h3>
            <p className="text-muted-foreground mt-1">
              Our AI will create a personalized day-by-day plan for your trip
            </p>
          </div>
          <Button onClick={() => generateItinerary(preferences)} size="lg">
            <Sparkles className="w-4 h-4 mr-2" />
            Start Planning
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Sub-component for day cards
function StreamingDayCard({ day, isNew }: { day: DayItinerary; isNew: boolean }) {
  return (
    <Card className={isNew ? 'ring-2 ring-primary/50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Day {day.dayNumber}: {day.theme}
          </CardTitle>
          {isNew && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
              Just added
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{day.date}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {day.activities.slice(0, 4).map((activity, idx) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="w-12 text-xs text-muted-foreground font-mono">
                {activity.time}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{sanitizeActivityName(activity.title)}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">
                    {typeof activity.location === 'string' 
                      ? activity.location 
                      : activity.location?.name || activity.location?.address || ''}
                  </span>
                </div>
              </div>
              <div className="text-sm font-medium text-primary">
                ${activity.cost}
              </div>
            </div>
          ))}
          {day.activities.length > 4 && (
            <div className="text-sm text-muted-foreground text-center pt-2 border-t">
              +{day.activities.length - 4} more activities
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm text-muted-foreground">
          <span>{day.estimatedWalkingTime} walking</span>
          <span className="font-medium text-foreground">
            Total: ${day.totalCost}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default ItineraryGeneratorStreaming;
