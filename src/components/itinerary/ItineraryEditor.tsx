import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, MapPin, Clock, Star, Save,
  Lock, Unlock, Edit2, Trash2, ArrowUp, ArrowDown, Plus,
  Sun, Cloud, CloudRain, Snowflake, Plane, Hotel,
  Utensils, Camera, ShoppingBag, Palmtree, Car, RefreshCw,
  DollarSign, Sparkles, Check, GripVertical, AlertCircle,
  ExternalLink, Globe, Phone, MessageSquare, ThumbsUp,
  ChevronRight, Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { safeFormatDate } from '@/utils/dateUtils';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { mergeAccommodationActivities } from '@/utils/accommodationActivities';
import type { GeneratedDay, GeneratedActivity, TripOverview } from '@/hooks/useItineraryGeneration';

// =============================================================================
// TYPES
// =============================================================================

type ActivityType = 'sightseeing' | 'dining' | 'cultural' | 'shopping' | 'relaxation' | 'transport' | 'accommodation' | 'activity';
type WeatherCondition = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy';

interface FlightLegData {
  airline?: string;
  flightNumber?: string;
  departure?: { time?: string; airport?: string; date?: string };
  arrival?: { time?: string; airport?: string };
  price?: number;
}

interface FlightSelection {
  outbound?: FlightLegData;
  return?: FlightLegData;
  legs?: FlightLegData[];
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
  currency?: string;
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

// Editorial muted color palette - sophisticated, not garish
const activityColors: Record<string, string> = {
  transport: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
  transportation: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
  accommodation: 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700',
  dining: 'bg-amber-50/60 text-amber-800 border-amber-200/60 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  cultural: 'bg-rose-50/50 text-rose-800 border-rose-200/50 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
  sightseeing: 'bg-sky-50/60 text-sky-800 border-sky-200/60 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800',
  activity: 'bg-indigo-50/50 text-indigo-800 border-indigo-200/50 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800',
  relaxation: 'bg-violet-50/50 text-violet-800 border-violet-200/50 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800',
  shopping: 'bg-fuchsia-50/50 text-fuchsia-800 border-fuchsia-200/50 dark:bg-fuchsia-950 dark:text-fuchsia-200 dark:border-fuchsia-800',
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

function formatTime12h(time: string | undefined | null): string {
  if (!time || typeof time !== 'string') return '';
  
  // Handle various time formats
  const cleanTime = time.trim();
  
  // If already in 12h format (contains AM/PM), return as-is
  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(cleanTime)) {
    return cleanTime;
  }
  
  // Parse HH:MM or H:MM format
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return cleanTime; // Return original if can't parse
  
  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  
  if (isNaN(hours)) return cleanTime;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return 'Estimate needed';
  }
  if (amount === 0) {
    return 'Included'; // Zero cost = bundled, not "free"
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getActivityName(activity: GeneratedActivity): string {
  const rawName = activity.title || (activity as { name?: string }).name || 'Activity';
  return sanitizeActivityName(rawName);
}

function getActivityCost(activity: GeneratedActivity): number | null {
  if (activity.cost?.amount !== undefined && activity.cost.amount > 0) return activity.cost.amount;
  if ((activity as { estimatedCost?: { amount: number } }).estimatedCost?.amount !== undefined) {
    const cost = (activity as { estimatedCost: { amount: number } }).estimatedCost.amount;
    if (cost > 0) return cost;
  }
  // Return null for truly free activities so we can display "Free" instead of $0
  return null;
}

function getActivityCostBasis(activity: GeneratedActivity): 'per_person' | 'flat' | 'per_room' {
  const basis = (activity as any).costBasis || (activity as any).cost?.basis || (activity as any).estimatedCost?.basis;
  if (basis === 'flat' || basis === 'per_room') return basis;
  // Default: transport is flat, everything else is per_person
  const cat = (activity as any).category || '';
  if (cat === 'transport' || cat === 'logistics') return 'flat';
  return 'per_person';
}

function formatCostWithBasis(amount: number | null | undefined, basis: 'per_person' | 'flat' | 'per_room', travelers: number): string {
  if (amount === null || amount === undefined) return 'Estimate needed';
  if (amount === 0) return 'Included';
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
  if (travelers <= 1) return formatted;
  if (basis === 'per_person') return `${formatted}/pp`;
  if (basis === 'per_room') return `${formatted}/room`;
  return formatted; // flat — no suffix needed
}

/** Calculate the actual group total for one activity given traveler count */
function getGroupCost(amount: number | null, basis: 'per_person' | 'flat' | 'per_room', travelers: number): number {
  if (!amount) return 0;
  return basis === 'per_person' ? amount * travelers : amount;
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
  currency = 'USD',
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

  // Calculate totals - use group costs (per_person × travelers, flat as-is)
  // Exclude accommodation activities to avoid double-counting hotel costs
  // (hotel cost is already added separately from hotelSelection below)
  const isAccommodationActivity = (act: GeneratedActivity) => {
    const cat = (act as any).category || '';
    const type = (act as any).type || '';
    return cat === 'accommodation' || type === 'accommodation';
  };
  const totalActivityCost = days.reduce((sum, day) => 
    sum + day.activities.reduce((daySum, act) => {
      if (isAccommodationActivity(act)) return daySum; // skip — counted via hotelCost
      const cost = getActivityCost(act);
      const basis = getActivityCostBasis(act);
      return daySum + getGroupCost(cost, basis, travelers);
    }, 0), 0
  );
  const flightCost = (flightSelection as any)?.legs
    ? ((flightSelection as any).legs as any[]).reduce((sum: number, leg: any) => sum + (leg.price || 0), 0)
    : ((flightSelection as any)?.outbound?.price || (flightSelection as any)?.departure?.price || 0) + ((flightSelection as any)?.return?.price || 0);
  const hotelCost = (hotelSelection?.pricePerNight || 0) * (hotelSelection?.nights || Math.max(1, days.length - 1));
  const totalCost = totalActivityCost + flightCost + hotelCost;
  const perPersonCost = travelers > 1 ? Math.round(totalCost / travelers) : totalCost;

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


      const sanitizeRegeneratedDay = (newDay: any) => {
        // Preserve distinct accommodation intents (check-in, freshen-up, return, checkout)
        if (newDay.activities) {
          newDay.activities = mergeAccommodationActivities(day.activities || [], newDay.activities);
        }
        // Preserve original day title/theme
        newDay.title = day.title;
        newDay.theme = day.theme;
        return newDay;
      };

      if (onRegenerateDay) {
        const newDay = await onRegenerateDay(day.dayNumber);
        if (newDay) {
          sanitizeRegeneratedDay(newDay);
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? newDay : d));
          setHasChanges(true);
          toast.success(`Day ${day.dayNumber} regenerated!`);
        }
      } else {
        // Collect current day's activity names to exclude from regeneration
        const currentDayActivities = day.activities
          ?.map(a => a.title || a.name)
          .filter(Boolean) || [];
        
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
            previousDayActivities: currentDayActivities,
            variationNonce: Date.now(),
          }
        });

        if (error) throw error;
        if (data?.day) {
          sanitizeRegeneratedDay(data.day);
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
      cost: activity.cost || { amount: 0, currency: currency },
      bookingRequired: activity.bookingRequired || false,
      tags: activity.tags || [],
      transportation: activity.transportation || { method: 'walk', duration: '10 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' }
    };

    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      const activities = [...day.activities];
      const newTime = newActivity.startTime || '23:59';
      let insertIndex = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const existingTime = activities[i].startTime || '23:59';
        if (newTime <= existingTime) {
          insertIndex = i;
          break;
        }
      }
      activities.splice(insertIndex, 0, newActivity);
      return { ...day, activities };
    }));
    setHasChanges(true);
    setAddActivityModal(null);
    toast.success('Activity added!');
  }, [currency]);

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
                {travelers > 1 && (
                  <p className="text-xs text-slate-400">{formatCurrency(perPersonCost)}/person</p>
                )}
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
              travelers={travelers}
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
              {(() => {
                const legs = flightSelection?.legs && flightSelection.legs.length > 0
                  ? flightSelection.legs
                  : [flightSelection?.outbound, flightSelection?.return].filter(Boolean);
                return legs.length > 0 ? (
                <div className="space-y-4">
                  {legs.map((leg, idx) => (
                    <FlightSegment key={idx} segment={leg!} label={legs.length <= 2 ? (idx === 0 ? 'Outbound' : 'Return') : `Leg ${idx + 1}`} />
                  ))}
                  <div className="pt-4 border-t flex justify-between">
                    <span className="font-medium">Flight Total</span>
                    <span className="text-lg font-bold">{formatCurrency(flightCost)}</span>
                  </div>
                </div>
                ) : (
                  <p className="text-muted-foreground">No flight selected</p>
                );
              })()}
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
                      {hotelSelection.nights || Math.max(1, days.length - 1)} nights @ {formatCurrency(hotelSelection.pricePerNight || 0)}/night
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
        currency={currency}
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
  travelers: number;
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
  travelers,
  isExpanded,
  isRegenerating,
  onToggle,
  onActivityLock,
  onActivityMove,
  onActivityRemove,
  onDayRegenerate,
  onAddActivity,
}: DayCardProps) {
  // Calculate total cost using group costs (per_person × travelers)
  // Exclude accommodation activities — hotel cost is tracked separately at trip level
  const totalCost = day.activities.reduce((sum, act) => {
    const cat = (act as any).category || '';
    const type = (act as any).type || '';
    if (cat === 'accommodation' || type === 'accommodation') return sum;
    const cost = getActivityCost(act);
    const basis = getActivityCostBasis(act);
    return sum + getGroupCost(cost, basis, travelers);
  }, 0);
  const perPersonCost = travelers > 1 ? Math.round(totalCost / travelers) : 0;
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
                {safeFormatDate(day.date, 'EEEE, MMM d', `Day ${day.dayNumber}`)}
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
          <div className="text-right">
            <span className="text-sm font-medium">
              {formatCurrency(totalCost > 0 ? totalCost : null)}
            </span>
            {travelers > 1 && perPersonCost > 0 && (
              <span className="block text-xs text-muted-foreground">
                {formatCurrency(perPersonCost)}/pp
              </span>
            )}
          </div>
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
                <div key={activity.id}>
                  <ActivityCard
                    activity={activity}
                    dayIndex={dayIndex}
                    activityIndex={activityIndex}
                    totalActivities={day.activities.length}
                    travelers={travelers}
                    onLock={onActivityLock}
                    onMove={onActivityMove}
                    onRemove={onActivityRemove}
                  />
                  {/* Transportation indicator between activities */}
                  {activityIndex < day.activities.length - 1 && activity.transportation && (
                    <div className="flex items-center gap-2 py-2 px-4 text-xs text-muted-foreground">
                      <div className="flex-1 border-t border-dashed border-border"></div>
                      <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-full">
                        <Car className="h-3 w-3" />
                        <span className="capitalize">{activity.transportation.method}</span>
                        {activity.transportation.duration && (
                          <span>• {activity.transportation.duration}</span>
                        )}
                      </div>
                      <div className="flex-1 border-t border-dashed border-border"></div>
                    </div>
                  )}
                </div>
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
  travelers: number;
  onLock: (dayIndex: number, activityId: string) => void;
  onMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onRemove: (dayIndex: number, activityId: string) => void;
}

// Extended activity type with new fields
interface ExtendedActivity extends GeneratedActivity {
  rating?: { value: number; totalReviews: number };
  website?: string;
  phoneNumber?: string;
  priceLevel?: number;
  googleMapsUrl?: string;
  reviewHighlights?: string[];
  tips?: string;
}

function ActivityCard({
  activity,
  dayIndex,
  activityIndex,
  totalActivities,
  travelers,
  onLock,
  onMove,
  onRemove,
}: ActivityCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isLocked = (activity as { isLocked?: boolean }).isLocked;
  const category = activity.category || 'activity';
  const location = getActivityLocation(activity);
  const extActivity = activity as ExtendedActivity;

  // Helper for price level display
  const getPriceLevelDisplay = (level?: number) => {
    if (!level) return null;
    return '$'.repeat(level);
  };

  // Generate Google Maps URL from address
  const getMapsUrl = (loc: { name?: string; address?: string }) => {
    if (extActivity.googleMapsUrl) return extActivity.googleMapsUrl;
    const query = encodeURIComponent(`${loc.name || ''} ${loc.address || ''}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          'rounded-lg border transition-all overflow-hidden',
          activityColors[category] || activityColors.activity,
          isLocked && 'ring-2 ring-primary'
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Main Activity Row */}
        <div className="p-4">
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
              
              {/* Rating & Reviews */}
              {extActivity.rating && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-medium">{extActivity.rating.value.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ({extActivity.rating.totalReviews.toLocaleString()} reviews)
                  </span>
                  {extActivity.priceLevel && (
                    <span className="text-xs text-muted-foreground">
                      • {getPriceLevelDisplay(extActivity.priceLevel)}
                    </span>
                  )}
                </div>
              )}

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
                  {activity.bookingRequired && (
                    <Badge variant="secondary" className="text-xs">
                      Booking Required
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              {/* Cost Display with per-person/flat context */}
              <span className={getActivityCost(activity) !== null ? "font-medium" : "text-xs text-muted-foreground italic"}>
                {formatCostWithBasis(getActivityCost(activity), getActivityCostBasis(activity), travelers)}
              </span>
              {travelers > 1 && getActivityCost(activity) !== null && getActivityCostBasis(activity) === 'per_person' && (
                <span className="block text-xs text-muted-foreground">
                  {formatCurrency(getActivityCost(activity)! * travelers)} total
                </span>
              )}
              
              {/* Expand Button */}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 mt-1 gap-1 text-xs"
                >
                  <Info className="h-3 w-3" />
                  {isExpanded ? 'Less' : 'More'}
                  <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                </Button>
              </CollapsibleTrigger>
              
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

        {/* Expanded Details */}
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 pb-4 pt-2 border-t border-border/50 space-y-3"
          >
            {/* Full Address */}
            {location.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">{location.address}</p>
                  <a 
                    href={getMapsUrl(location)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-xs mt-1"
                  >
                    View on Google Maps
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="flex flex-wrap gap-2">
              {extActivity.website && (
                <a 
                  href={extActivity.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 rounded-md text-xs hover:bg-secondary transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {extActivity.phoneNumber && (
                <a 
                  href={`tel:${extActivity.phoneNumber}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 rounded-md text-xs hover:bg-secondary transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {extActivity.phoneNumber}
                </a>
              )}
              {activity.bookingRequired && (
                <a 
                  href={extActivity.website || getMapsUrl(location)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs hover:bg-primary/20 transition-colors font-medium"
                >
                  Book Now
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Review Highlights */}
            {extActivity.reviewHighlights && extActivity.reviewHighlights.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  What visitors are saying
                </div>
                <div className="space-y-1.5">
                  {extActivity.reviewHighlights.map((review, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm bg-secondary/30 rounded-md p-2">
                      <ThumbsUp className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <p className="text-muted-foreground italic">"{review}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insider Tips */}
            {extActivity.tips && (
              <div className="flex items-start gap-2 text-sm bg-primary/5 border border-primary/20 rounded-md p-3">
                <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <span className="font-medium text-primary text-xs">Insider Tip</span>
                  <p className="text-muted-foreground mt-0.5">{extActivity.tips}</p>
                </div>
              </div>
            )}

            {/* Transportation to Next */}
            {activity.transportation && (
              <div className="flex items-start gap-2 text-sm">
                <Car className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-muted-foreground">
                    <span className="font-medium capitalize">{activity.transportation.method}</span>
                    {activity.transportation.duration && ` • ${activity.transportation.duration}`}
                    {activity.transportation.estimatedCost?.amount > 0 && 
                      ` • ${formatCurrency(activity.transportation.estimatedCost.amount)}`
                    }
                  </p>
                  {activity.transportation.instructions && (
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.transportation.instructions}</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
  currency?: string;
}

function AddActivityModal({ isOpen, onClose, onAdd, currency = 'USD' }: AddActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('activity');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [cost, setCost] = useState('0');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter an activity title');
      return;
    }
    onAdd({
      title: title.trim(),
      description,
      category,
      startTime,
      endTime,
      cost: { amount: parseFloat(cost) || 0, currency },
      location: { name: locationName, address: locationAddress },
    });
    // Reset form
    setTitle('');
    setDescription('');
    setCategory('activity');
    setStartTime('12:00');
    setEndTime('13:00');
    setCost('0');
    setLocationName('');
    setLocationAddress('');
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
            <label className="text-sm font-medium mb-1 block">Venue Name</label>
            <Input 
              value={locationName} 
              onChange={(e) => setLocationName(e.target.value)} 
              placeholder="e.g. Eiffel Tower"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Address</label>
            <Input 
              value={locationAddress} 
              onChange={(e) => setLocationAddress(e.target.value)} 
              placeholder="e.g. Champ de Mars, 75007 Paris"
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
