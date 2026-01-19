import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, MapPin, Clock, Star, Save,
  Lock, Unlock, Edit2, Trash2, ArrowUp, ArrowDown, Plus,
  Sun, Cloud, CloudRain, Snowflake, Plane, Hotel,
  Utensils, Camera, ShoppingBag, Palmtree, Car, RefreshCw,
  DollarSign, Sparkles, Check, GripVertical, AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import type { GeneratedDay, GeneratedActivity, TripOverview } from '@/hooks/useItineraryGeneration';

// =============================================================================
// TYPES
// =============================================================================

type ActivityType = 'sightseeing' | 'dining' | 'cultural' | 'shopping' | 'relaxation' | 'transport' | 'accommodation' | 'activity';
type WeatherCondition = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy';

interface FlightSelection {
  outbound?: {
    airline?: string;
    flightNumber?: string;
    departure?: { time?: string; airport?: string };
    arrival?: { time?: string; airport?: string };
    price?: number;
  };
  return?: {
    airline?: string;
    flightNumber?: string;
    departure?: { time?: string; airport?: string };
    arrival?: { time?: string; airport?: string };
    price?: number;
  };
}

interface HotelSelection {
  name?: string;
  address?: string;
  rating?: number;
  pricePerNight?: number;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  imageUrl?: string;
  amenities?: string[];
}

interface ItineraryEditorProps {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budgetTier?: string;
  days: GeneratedDay[];
  overview?: TripOverview;
  flightSelection?: FlightSelection | null;
  hotelSelection?: HotelSelection | null;
  onSave?: (days: GeneratedDay[]) => Promise<void>;
  onRegenerateDay?: (dayNumber: number) => Promise<GeneratedDay | null>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const activityIcons: Record<string, React.ReactNode> = {
  transport: <Car className="h-4 w-4" />,
  transportation: <Car className="h-4 w-4" />,
  accommodation: <Hotel className="h-4 w-4" />,
  dining: <Utensils className="h-4 w-4" />,
  cultural: <Camera className="h-4 w-4" />,
  sightseeing: <MapPin className="h-4 w-4" />,
  activity: <Camera className="h-4 w-4" />,
  relaxation: <Palmtree className="h-4 w-4" />,
  shopping: <ShoppingBag className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  transport: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  transportation: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  accommodation: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
  dining: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  cultural: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
  sightseeing: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  activity: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  relaxation: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  shopping: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800',
};

const weatherIcons: Record<WeatherCondition, React.ReactNode> = {
  sunny: <Sun className="h-4 w-4 text-amber-500" />,
  'partly-cloudy': <Cloud className="h-4 w-4 text-slate-400" />,
  cloudy: <Cloud className="h-4 w-4 text-slate-500" />,
  rainy: <CloudRain className="h-4 w-4 text-blue-500" />,
  snowy: <Snowflake className="h-4 w-4 text-blue-300" />,
};

// =============================================================================
// HELPERS
// =============================================================================

function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes?.toString().padStart(2, '0') || '00'} ${period}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getActivityName(activity: GeneratedActivity): string {
  return activity.title || (activity as { name?: string }).name || 'Activity';
}

function getActivityCost(activity: GeneratedActivity): number {
  if (activity.cost?.amount !== undefined) return activity.cost.amount;
  if ((activity as { estimatedCost?: { amount: number } }).estimatedCost?.amount !== undefined) {
    return (activity as { estimatedCost: { amount: number } }).estimatedCost.amount;
  }
  return 0;
}

function getActivityLocation(activity: GeneratedActivity): { name?: string; address?: string } {
  if (typeof activity.location === 'object' && activity.location !== null) {
    return activity.location;
  }
  return { name: String(activity.location || ''), address: '' };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ItineraryEditor({
  tripId,
  destination,
  destinationCountry,
  startDate,
  endDate,
  travelers,
  budgetTier,
  days: initialDays,
  overview,
  flightSelection,
  hotelSelection,
  onSave,
  onRegenerateDay,
}: ItineraryEditorProps) {
  const [days, setDays] = useState<GeneratedDay[]>(initialDays);
  const [expandedDays, setExpandedDays] = useState<number[]>([1]);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'bookings'>('itinerary');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [addActivityModal, setAddActivityModal] = useState<{ dayIndex: number } | null>(null);
  const [editActivityModal, setEditActivityModal] = useState<{ dayIndex: number; activityId: string } | null>(null);

  // Calculate totals
  const totalActivityCost = days.reduce((sum, day) => 
    sum + day.activities.reduce((daySum, act) => daySum + getActivityCost(act), 0), 0
  );
  const flightCost = (flightSelection?.outbound?.price || 0) + (flightSelection?.return?.price || 0);
  const hotelCost = (hotelSelection?.pricePerNight || 0) * (hotelSelection?.nights || days.length);
  const totalCost = totalActivityCost + flightCost + hotelCost;

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev =>
      prev.includes(dayNumber)
        ? prev.filter(d => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save to database - cast to Json for Supabase
      const itineraryData = {
        days: JSON.parse(JSON.stringify(days)),
        status: 'ready',
        savedAt: new Date().toISOString(),
        overview: overview ? JSON.parse(JSON.stringify(overview)) : undefined
      };

      const { error } = await supabase
        .from('trips')
        .update({
          itinerary_data: itineraryData,
          itinerary_status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId);

      if (error) throw error;

      if (onSave) await onSave(days);
      
      setHasChanges(false);
      toast.success('Itinerary saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save itinerary');
    } finally {
      setIsSaving(false);
    }
  }, [days, tripId, overview, onSave]);

  const handleActivityLock = useCallback((dayIndex: number, activityId: string) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.map(act => 
          act.id === activityId 
            ? { ...act, isLocked: !(act as { isLocked?: boolean }).isLocked } as GeneratedActivity
            : act
        )
      };
    }));
    setHasChanges(true);
  }, []);

  const handleActivityMove = useCallback((dayIndex: number, activityId: string, direction: 'up' | 'down') => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      const activities = [...day.activities];
      const actIdx = activities.findIndex(a => a.id === activityId);
      if (actIdx === -1) return day;
      
      const newIdx = direction === 'up' ? actIdx - 1 : actIdx + 1;
      if (newIdx < 0 || newIdx >= activities.length) return day;
      
      [activities[actIdx], activities[newIdx]] = [activities[newIdx], activities[actIdx]];
      return { ...day, activities };
    }));
    setHasChanges(true);
  }, []);

  const handleActivityRemove = useCallback((dayIndex: number, activityId: string) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.filter(act => act.id !== activityId)
      };
    }));
    setHasChanges(true);
    toast.success('Activity removed');
  }, []);

  const handleDayRegenerate = useCallback(async (dayIndex: number) => {
    const day = days[dayIndex];
    if (!day) return;

    setRegeneratingDay(day.dayNumber);
    try {
      if (onRegenerateDay) {
        const newDay = await onRegenerateDay(day.dayNumber);
        if (newDay) {
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? newDay : d));
          setHasChanges(true);
          toast.success(`Day ${day.dayNumber} regenerated!`);
        }
      } else {
        // Call edge function directly
        const { data, error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-day',
            tripId,
            dayNumber: day.dayNumber,
            totalDays: days.length,
            destination,
            destinationCountry,
            date: day.date,
            travelers,
            budgetTier,
          }
        });

        if (error) throw error;
        if (data?.day) {
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? data.day : d));
          setHasChanges(true);
          toast.success(`Day ${day.dayNumber} regenerated!`);
        }
      }
    } catch (err) {
      console.error('Regenerate error:', err);
      toast.error('Failed to regenerate day');
    } finally {
      setRegeneratingDay(null);
    }
  }, [days, tripId, destination, destinationCountry, travelers, budgetTier, onRegenerateDay]);

  const handleAddActivity = useCallback((dayIndex: number, activity: Partial<GeneratedActivity>) => {
    const newActivity: GeneratedActivity = {
      id: `manual-${Date.now()}`,
      title: activity.title || 'New Activity',
      description: activity.description || '',
      category: activity.category || 'activity',
      startTime: activity.startTime || '12:00',
      endTime: activity.endTime || '13:00',
      location: activity.location || { name: '', address: '' },
      cost: activity.cost || { amount: 0, currency: 'USD' },
      bookingRequired: activity.bookingRequired || false,
      tags: activity.tags || [],
      transportation: activity.transportation || { method: 'walk', duration: '10 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' }
    };

    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return { ...day, activities: [...day.activities, newActivity] };
    }));
    setHasChanges(true);
    setAddActivityModal(null);
    toast.success('Activity added!');
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-serif font-bold">{destination}</h1>
          <div className="flex items-center gap-3 text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {days.length} days
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {destinationCountry || destination}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unsaved changes
            </Badge>
          )}
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !hasChanges}
            className="gap-2"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? 'Saving...' : 'Save Itinerary'}
          </Button>
        </div>
      </motion.div>

      {/* Trip Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <span className="text-slate-400 text-sm">Dates</span>
                <p className="font-medium">
                  {format(parseISO(startDate), 'MMM d')} - {format(parseISO(endDate), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Travelers</span>
                <p className="font-medium">{travelers} {travelers === 1 ? 'Guest' : 'Guests'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Budget</span>
                <p className="font-medium capitalize">{budgetTier || 'Standard'}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Total Estimate</span>
                <p className="text-xl font-bold">{formatCurrency(totalCost)}</p>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-white/10 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">Flights: {formatCurrency(flightCost)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">Hotel: {formatCurrency(hotelCost)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">Activities: {formatCurrency(totalActivityCost)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'itinerary' ? 'default' : 'outline'}
          onClick={() => setActiveTab('itinerary')}
        >
          Day-by-Day Itinerary
        </Button>
        <Button
          variant={activeTab === 'bookings' ? 'default' : 'outline'}
          onClick={() => setActiveTab('bookings')}
        >
          Flight & Hotel
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'itinerary' ? (
        <div className="space-y-4">
          {days.map((day, dayIndex) => (
            <DayCard
              key={day.dayNumber}
              day={day}
              dayIndex={dayIndex}
              isExpanded={expandedDays.includes(day.dayNumber)}
              isRegenerating={regeneratingDay === day.dayNumber}
              onToggle={() => toggleDay(day.dayNumber)}
              onActivityLock={handleActivityLock}
              onActivityMove={handleActivityMove}
              onActivityRemove={handleActivityRemove}
              onDayRegenerate={() => handleDayRegenerate(dayIndex)}
              onAddActivity={() => setAddActivityModal({ dayIndex })}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Flight Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Plane className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Flight Details</h3>
              </div>
              {flightSelection?.outbound ? (
                <div className="space-y-4">
                  <FlightSegment segment={flightSelection.outbound} label="Outbound" />
                  {flightSelection.return && (
                    <FlightSegment segment={flightSelection.return} label="Return" />
                  )}
                  <div className="pt-4 border-t flex justify-between">
                    <span className="font-medium">Flight Total</span>
                    <span className="text-lg font-bold">{formatCurrency(flightCost)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No flight selected</p>
              )}
            </CardContent>
          </Card>

          {/* Hotel Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Hotel className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Accommodation</h3>
              </div>
              {hotelSelection?.name ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    {hotelSelection.imageUrl && (
                      <img 
                        src={hotelSelection.imageUrl} 
                        alt={hotelSelection.name}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div>
                      <h4 className="font-medium">{hotelSelection.name}</h4>
                      <p className="text-sm text-muted-foreground">{hotelSelection.address}</p>
                      {hotelSelection.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-4 w-4 text-amber-500 fill-current" />
                          <span className="text-sm font-medium">{hotelSelection.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Check-in:</span>
                      <p className="font-medium">{hotelSelection.checkIn || startDate}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-out:</span>
                      <p className="font-medium">{hotelSelection.checkOut || endDate}</p>
                    </div>
                  </div>
                  {hotelSelection.amenities && hotelSelection.amenities.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Amenities:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {hotelSelection.amenities.map((amenity, i) => (
                          <Badge key={i} variant="secondary">{amenity}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-4 border-t flex justify-between">
                    <span className="font-medium">
                      {hotelSelection.nights || days.length} nights @ {formatCurrency(hotelSelection.pricePerNight || 0)}/night
                    </span>
                    <span className="text-lg font-bold">{formatCurrency(hotelCost)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No hotel selected</p>
              )}
            </CardContent>
          </Card>

          {/* Overview Tips */}
          {overview?.localTips && overview.localTips.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Local Tips</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {overview.localTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add Activity Modal */}
      <AddActivityModal
        isOpen={!!addActivityModal}
        onClose={() => setAddActivityModal(null)}
        onAdd={(activity) => addActivityModal && handleAddActivity(addActivityModal.dayIndex, activity)}
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface DayCardProps {
  day: GeneratedDay;
  dayIndex: number;
  isExpanded: boolean;
  isRegenerating: boolean;
  onToggle: () => void;
  onActivityLock: (dayIndex: number, activityId: string) => void;
  onActivityMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onActivityRemove: (dayIndex: number, activityId: string) => void;
  onDayRegenerate: () => void;
  onAddActivity: () => void;
}

function DayCard({
  day,
  dayIndex,
  isExpanded,
  isRegenerating,
  onToggle,
  onActivityLock,
  onActivityMove,
  onActivityRemove,
  onDayRegenerate,
  onAddActivity,
}: DayCardProps) {
  const totalCost = day.activities.reduce((sum, act) => sum + getActivityCost(act), 0);
  const lockedCount = day.activities.filter(a => (a as { isLocked?: boolean }).isLocked).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.05 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      {/* Day Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Badge variant="secondary">Day {day.dayNumber}</Badge>
            {day.date && (
              <span className="text-sm text-muted-foreground">
                {format(parseISO(day.date), 'EEEE, MMM d')}
              </span>
            )}
            {lockedCount > 0 && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                {lockedCount} locked
              </Badge>
            )}
          </div>
          <p className="font-medium">{day.title || day.theme}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{formatCurrency(totalCost)}</span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Day Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 space-y-3">
              {day.activities.map((activity, activityIndex) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  dayIndex={dayIndex}
                  activityIndex={activityIndex}
                  totalActivities={day.activities.length}
                  onLock={onActivityLock}
                  onMove={onActivityMove}
                  onRemove={onActivityRemove}
                />
              ))}
              
              {/* Day Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddActivity}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Activity
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onDayRegenerate}
                  disabled={isRegenerating}
                  className="gap-1"
                >
                  <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
                  {isRegenerating ? 'Regenerating...' : 'Regenerate Day'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ActivityCardProps {
  activity: GeneratedActivity;
  dayIndex: number;
  activityIndex: number;
  totalActivities: number;
  onLock: (dayIndex: number, activityId: string) => void;
  onMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onRemove: (dayIndex: number, activityId: string) => void;
}

function ActivityCard({
  activity,
  dayIndex,
  activityIndex,
  totalActivities,
  onLock,
  onMove,
  onRemove,
}: ActivityCardProps) {
  const [showActions, setShowActions] = useState(false);
  const isLocked = (activity as { isLocked?: boolean }).isLocked;
  const category = activity.category || 'activity';
  const location = getActivityLocation(activity);

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        activityColors[category] || activityColors.activity,
        isLocked && 'ring-2 ring-primary'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{activityIcons[category] || activityIcons.activity}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono">{formatTime12h(activity.startTime)}</span>
            <span className="text-xs">→</span>
            <span className="text-xs font-mono">{formatTime12h(activity.endTime)}</span>
            {activity.durationMinutes && (
              <span className="text-xs text-muted-foreground">
                ({Math.floor(activity.durationMinutes / 60)}h {activity.durationMinutes % 60}m)
              </span>
            )}
          </div>
          <h4 className="font-medium mb-1">{getActivityName(activity)}</h4>
          {location.name && (
            <p className="text-sm flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3" />
              {location.name}
            </p>
          )}
          {activity.description && (
            <p className="text-sm opacity-80 line-clamp-2">{activity.description}</p>
          )}
          {activity.tags && activity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {activity.tags.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="font-medium">{formatCurrency(getActivityCost(activity))}</span>
          
          {/* Action Buttons */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-1 mt-2 justify-end"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onMove(dayIndex, activity.id, 'up'); }}
                  disabled={activityIndex === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onMove(dayIndex, activity.id, 'down'); }}
                  disabled={activityIndex === totalActivities - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onLock(dayIndex, activity.id); }}
                >
                  {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={(e) => { e.stopPropagation(); onRemove(dayIndex, activity.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface FlightSegmentProps {
  segment: FlightSelection['outbound'];
  label: string;
}

function FlightSegment({ segment, label }: FlightSegmentProps) {
  if (!segment) return null;
  
  return (
    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
      <div>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <p className="font-medium">{segment.airline} {segment.flightNumber}</p>
        <p className="text-sm text-muted-foreground">
          {segment.departure?.airport} → {segment.arrival?.airport}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm">{segment.departure?.time} - {segment.arrival?.time}</p>
        <p className="font-medium">{formatCurrency(segment.price || 0)}</p>
      </div>
    </div>
  );
}

// =============================================================================
// ADD ACTIVITY MODAL
// =============================================================================

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (activity: Partial<GeneratedActivity>) => void;
}

function AddActivityModal({ isOpen, onClose, onAdd }: AddActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('activity');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [cost, setCost] = useState('0');
  const [locationName, setLocationName] = useState('');

  const handleSubmit = () => {
    onAdd({
      title,
      description,
      category,
      startTime,
      endTime,
      cost: { amount: parseFloat(cost) || 0, currency: 'USD' },
      location: { name: locationName, address: '' },
    });
    // Reset form
    setTitle('');
    setDescription('');
    setCategory('activity');
    setStartTime('12:00');
    setEndTime('13:00');
    setCost('0');
    setLocationName('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Activity name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sightseeing">Sightseeing</SelectItem>
                <SelectItem value="dining">Dining</SelectItem>
                <SelectItem value="cultural">Cultural</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="relaxation">Relaxation</SelectItem>
                <SelectItem value="shopping">Shopping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Time</label>
              <Input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Location</label>
            <Input 
              value={locationName} 
              onChange={(e) => setLocationName(e.target.value)} 
              placeholder="Venue or place name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Estimated Cost ($)</label>
            <Input 
              type="number" 
              value={cost} 
              onChange={(e) => setCost(e.target.value)} 
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Brief description..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title}>Add Activity</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItineraryEditor;
