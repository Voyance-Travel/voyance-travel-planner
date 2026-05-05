import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Clock, MapPin, ChevronDown, ChevronUp, RefreshCw, 
  Search, Lock, LockOpen, Undo2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DayItinerary, ItineraryActivity } from '@/types/itinerary';
import { formatWeatherCondition } from '@/utils/textFormatting';
import { sanitizeActivityName, sanitizeActivityText } from '@/utils/activityNameSanitizer';
import { formatTime12h } from '@/utils/timeFormat';
import ActivityAlternativesDrawer from './ActivityAlternativesDrawer';
import { useVersionHistory } from '@/hooks/useVersionHistory';
import ActivityConciergeSheet, { type AISavedNote } from '@/components/itinerary/ActivityConciergeSheet';
import { AISavedNotes } from '@/components/itinerary/AISavedNotes';

interface CustomerDayCardProps {
  day: DayItinerary;
  dayIndex: number;
  tripId?: string;
  isNew?: boolean;
  onRegenerateDay?: (dayNumber: number, keepActivities?: string[]) => void;
  isRegenerating?: boolean;
  onActivityLock?: (activityId: string, locked: boolean) => void;
  onActivitySwap?: (activityId: string, newActivity: ItineraryActivity) => void;
  onDayRestore?: (dayNumber: number, activities: ItineraryActivity[], metadata?: { title?: string; theme?: string }) => void;
  destination?: string;
  tripType?: string;
  totalDays?: number;
  travelers?: number;
  currency?: string;
  onSaveAINote?: (activityId: string, note: AISavedNote) => void;
  onDeleteAINote?: (activityId: string, noteId: string) => void;
}

const activityTypeStyles: Record<string, { bg: string; text: string; border: string }> = {
  transportation: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20' },
  accommodation: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20' },
  dining: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
  cultural: { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/20' },
  activity: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/20' },
  relaxation: { bg: 'bg-teal-500/10', text: 'text-teal-600', border: 'border-teal-500/20' },
  shopping: { bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-500/20' },
};

export default function CustomerDayCard({
  day,
  dayIndex,
  tripId,
  isNew = false,
  onRegenerateDay,
  isRegenerating = false,
  onActivityLock,
  onActivitySwap,
  onDayRestore,
  destination,
  tripType,
  totalDays,
  travelers,
  currency,
  onSaveAINote,
  onDeleteAINote,
}: CustomerDayCardProps) {
  const [isExpanded, setIsExpanded] = useState(dayIndex < 2);
  const [selectedActivityForSwap, setSelectedActivityForSwap] = useState<ItineraryActivity | null>(null);
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);
  const [conciergeActivity, setConciergeActivity] = useState<ItineraryActivity | null>(null);

  const conciergeSavedNoteContents = useMemo(() => {
    if (!conciergeActivity) return new Set<string>();
    const notes: AISavedNote[] = (conciergeActivity as any).aiNotes || [];
    return new Set(notes.map((n) => n.content));
  }, [conciergeActivity]);

  // Version history for undo
  const { canUndoDay, isUndoing, handleUndo } = useVersionHistory({
    tripId,
    dayNumber: day.dayNumber,
    onRestore: (activities, metadata) => {
      onDayRestore?.(day.dayNumber, activities, metadata);
    },
  });

  const handleRegenerateDay = () => {
    if (onRegenerateDay) {
      // Keep locked activities
      const lockedActivityIds = day.activities
        .filter(a => a.isLocked)
        .map(a => a.id);
      onRegenerateDay(day.dayNumber, lockedActivityIds);
    }
  };

  const handleSwapActivity = (newActivity: ItineraryActivity) => {
    if (selectedActivityForSwap && onActivitySwap) {
      onActivitySwap(selectedActivityForSwap.id, newActivity);
      setSelectedActivityForSwap(null);
    }
  };

  const getActivityStyle = (type: string) => {
    return activityTypeStyles[type] || activityTypeStyles.activity;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, delay: dayIndex * 0.05 }}
        className={cn(
          'bg-card rounded-xl border overflow-hidden transition-shadow hover:shadow-md',
          isNew ? 'ring-2 ring-primary/50 border-primary/30' : 'border-border'
        )}
      >
        {/* Day Header */}
        <div className="bg-muted/50 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-1 flex items-center gap-4 text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-medium">
                    Day {day.dayNumber}
                  </Badge>
                  {isNew && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      Just added
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground mt-1">
                  {day.date ? format(new Date(day.date), 'EEEE, MMMM d') : day.theme}
                </h3>
                {day.theme && day.date && (
                  <p className="text-sm text-muted-foreground mt-0.5">{day.theme}</p>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {/* Day Actions */}
            <div className="flex items-center gap-2 ml-4">
              {day.weather && (
                <div className="text-right text-sm text-muted-foreground hidden sm:block">
                  <p className="font-medium">{day.weather.high}°/{day.weather.low}°</p>
                  <p>{formatWeatherCondition(day.weather.condition)}</p>
                </div>
              )}
              
              {/* Undo Button */}
              {canUndoDay && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUndo}
                        disabled={isUndoing || isRegenerating}
                        className="gap-2"
                      >
                        <Undo2 className={cn("h-4 w-4", isUndoing && "animate-pulse")} />
                        <span className="hidden sm:inline">Undo</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Restore previous version</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {onRegenerateDay && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateDay}
                  disabled={isRegenerating}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
                  <span className="hidden sm:inline">
                    {isRegenerating ? 'Updating...' : 'Refresh'}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Activities */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-6">
                <div className="space-y-4">
                  {day.activities.map((activity, actIndex) => {
                    const style = getActivityStyle(activity.type);
                    const isHovered = hoveredActivity === activity.id;
                    
                    return (
                      <motion.div
                        key={activity.id || actIndex}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: actIndex * 0.05 }}
                        className={cn(
                          'relative p-4 rounded-lg border transition-all',
                          style.bg,
                          style.border,
                          activity.isLocked && 'ring-2 ring-accent',
                          'hover:shadow-sm'
                        )}
                        onMouseEnter={() => setHoveredActivity(activity.id)}
                        onMouseLeave={() => setHoveredActivity(null)}
                      >
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2 text-muted-foreground w-20 flex-shrink-0">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-mono">{formatTime12h(activity.time)}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className={cn("font-medium", style.text)}>{sanitizeActivityName(activity.title)}</p>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {sanitizeActivityText(activity.description)}
                                </p>
                              </div>

                              {/* Activity Actions */}
                              <div className="flex items-center gap-1">
                                {(() => {
                                  const cat = (activity.type || '').toUpperCase();
                                  const hideAI = ['TRANSPORTATION', 'TRANSPORT', 'TRAVEL', 'LOGISTICS', 'TRANSIT'].includes(cat) ||
                                    /Return to Your Hotel|Freshen Up|Arrival Flight|Departure/i.test(activity.title);
                                  return !hideAI ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setConciergeActivity(activity)}
                                      title="Ask AI concierge"
                                    >
                                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  ) : null;
                                })()}
                                {onActivitySwap && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setSelectedActivityForSwap(activity)}
                                    title="Find alternatives"
                                  >
                                    <Search className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {onActivityLock && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onActivityLock(activity.id, !activity.isLocked)}
                                    title={activity.isLocked ? "Unlock activity" : "Lock activity"}
                                  >
                                    {activity.isLocked ? (
                                      <Lock className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <LockOpen className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {activity.location && (
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {typeof activity.location === 'string' 
                                  ? activity.location 
                                  : activity.location.name || activity.location.address}
                              </p>
                            )}

                            <div className="flex items-center gap-3 mt-2">
                              {activity.duration && (
                                <Badge variant="outline" className="text-xs">
                                  {activity.duration}
                                </Badge>
                              )}
                              {activity.cost > 0 && (
                                <span className="text-xs text-primary font-medium">
                                  Est. ${activity.cost}
                                </span>
                              )}
                              {activity.isLocked && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  Locked
                                </Badge>
                              )}
                            </div>
                            {/* AI Saved Notes */}
                            {(activity as any).aiNotes && (activity as any).aiNotes.length > 0 && (
                              <AISavedNotes
                                notes={(activity as any).aiNotes}
                                onDeleteNote={onDeleteAINote ? (noteId) => onDeleteAINote(activity.id, noteId) : undefined}
                              />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Day Footer */}
                {day.activities.length > 0 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{day.estimatedWalkingTime} walking</span>
                      <span>{day.estimatedDistance}</span>
                    </div>
                    <span className="font-semibold text-foreground">
                      Day total: ${day.totalCost}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Activity Alternatives Drawer */}
      <ActivityAlternativesDrawer
        open={!!selectedActivityForSwap}
        onClose={() => setSelectedActivityForSwap(null)}
        activity={selectedActivityForSwap}
        destination={destination}
        onSelectAlternative={handleSwapActivity}
      />

      {/* AI Concierge Sheet */}
      {conciergeActivity && (
        <ActivityConciergeSheet
          open={!!conciergeActivity}
          onClose={() => setConciergeActivity(null)}
          activity={conciergeActivity}
          dayDate={day.date}
          dayTitle={day.theme}
          previousActivity={
            (() => {
              const idx = day.activities.findIndex(a => a.id === conciergeActivity.id);
              return idx > 0 ? day.activities[idx - 1].title : undefined;
            })()
          }
          nextActivity={
            (() => {
              const idx = day.activities.findIndex(a => a.id === conciergeActivity.id);
              return idx < day.activities.length - 1 ? day.activities[idx + 1].title : undefined;
            })()
          }
          destination={destination || ''}
          tripType={tripType}
          totalDays={totalDays}
          travelers={travelers}
          currency={currency}
          onActivitySwap={onActivitySwap ? (activityId, newData) => {
            onActivitySwap(activityId, newData as unknown as ItineraryActivity);
          } : undefined}
          onSaveNote={onSaveAINote}
          savedNoteContents={conciergeSavedNoteContents}
        />
      )}
    </>
  );
}
