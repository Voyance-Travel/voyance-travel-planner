import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, MapPin, Clock, Star, 
  Lock, Unlock, Edit2, Trash2, ArrowUp, ArrowDown,
  Sun, Cloud, CloudRain, Snowflake, Plane, Hotel,
  Utensils, Camera, ShoppingBag, Palmtree, Car,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatEnumDisplay, formatWeatherCondition } from '@/utils/textFormatting';
import { sanitizeActivityName, sanitizeActivityText } from '@/utils/activityNameSanitizer';
import { coerceDurationString } from '@/utils/plannerUtils';
import type { 
  DayItinerary, TripSummary, DestinationInfo, 
  FlightInfo, FlightSegment, HotelInfo, ItineraryActivity, ActivityType, WeatherCondition 
} from '@/types/itinerary';

interface FullItineraryProps {
  days: DayItinerary[];
  tripSummary: TripSummary;
  destinationInfo: DestinationInfo;
  flightInfo: FlightInfo;
  hotelInfo: HotelInfo;
  onActivityLock?: (dayIndex: number, activityId: string, locked: boolean) => void;
  onActivityEdit?: (dayIndex: number, activityId: string) => void;
  onActivityRemove?: (dayIndex: number, activityId: string) => void;
  onActivityMove?: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onActivityReplace?: (dayIndex: number, activityId: string, newActivity: ItineraryActivity) => void;
  onActivityInsert?: (dayIndex: number, afterActivityId: string | null, activity: ItineraryActivity) => void;
  onDayRegenerate?: (dayIndex: number) => void;
  onSaveItinerary?: () => void;
  showHeader?: boolean;
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  transportation: <Car className="h-4 w-4" />,
  accommodation: <Hotel className="h-4 w-4" />,
  dining: <Utensils className="h-4 w-4" />,
  cultural: <Camera className="h-4 w-4" />,
  activity: <Camera className="h-4 w-4" />,
  relaxation: <Palmtree className="h-4 w-4" />,
  shopping: <ShoppingBag className="h-4 w-4" />,
};

const activityColors: Record<ActivityType, string> = {
  transportation: 'bg-blue-100 text-blue-700 border-blue-200',
  accommodation: 'bg-purple-100 text-purple-700 border-purple-200',
  dining: 'bg-amber-100 text-amber-700 border-amber-200',
  cultural: 'bg-rose-100 text-rose-700 border-rose-200',
  activity: 'bg-green-100 text-green-700 border-green-200',
  relaxation: 'bg-teal-100 text-teal-700 border-teal-200',
  shopping: 'bg-pink-100 text-pink-700 border-pink-200',
};

const weatherIcons: Record<WeatherCondition, React.ReactNode> = {
  sunny: <Sun className="h-4 w-4 text-amber-500" />,
  'partly-cloudy': <Cloud className="h-4 w-4 text-slate-400" />,
  cloudy: <Cloud className="h-4 w-4 text-slate-500" />,
  rainy: <CloudRain className="h-4 w-4 text-blue-500" />,
  snowy: <Snowflake className="h-4 w-4 text-blue-300" />,
};

export default function FullItinerary({
  days,
  tripSummary,
  destinationInfo,
  flightInfo,
  hotelInfo,
  onActivityLock,
  onActivityEdit,
  onActivityRemove,
  onActivityMove,
  onDayRegenerate,
  onSaveItinerary,
  showHeader = true,
}: FullItineraryProps) {
  const [expandedDays, setExpandedDays] = useState<number[]>([1, 2]);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'details'>('itinerary');

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev =>
      prev.includes(dayNumber)
        ? prev.filter(d => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Trip Header */}
      {showHeader && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
            <h1 className="text-3xl font-serif font-bold mb-2">{tripSummary.destination}</h1>
            <p className="text-slate-300 mb-6">{destinationInfo.overview}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <span className="text-slate-400 text-sm">Duration</span>
                <p className="font-semibold">{days.length} Days</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Travelers</span>
                <p className="font-semibold">{tripSummary.travelers} Guests</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Style</span>
                <p className="font-semibold">{formatEnumDisplay(tripSummary.style)}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Pace</span>
                <p className="font-semibold">{formatEnumDisplay(tripSummary.pace)}</p>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-300">Total Estimated Cost</span>
                <span className="text-2xl font-bold">{formatCurrency(tripSummary.totalCost)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">Flights: {formatCurrency(tripSummary.flightCost || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">Hotel: {formatCurrency(tripSummary.hotelCost || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">Activities: {formatCurrency(tripSummary.dailyCosts || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'itinerary' ? 'default' : 'outline'}
          onClick={() => setActiveTab('itinerary')}
        >
          Day-by-Day Itinerary
        </Button>
        <Button
          variant={activeTab === 'details' ? 'default' : 'outline'}
          onClick={() => setActiveTab('details')}
        >
          Transportation & Hotel
        </Button>
      </div>

      {activeTab === 'itinerary' ? (
        /* Day-by-Day Itinerary */
        <div className="space-y-4">
          {days.map((day, dayIndex) => (
            <DayCard
              key={day.dayNumber}
              day={day}
              dayIndex={dayIndex}
              isExpanded={expandedDays.includes(day.dayNumber)}
              onToggle={() => toggleDay(day.dayNumber)}
              onActivityLock={onActivityLock}
              onActivityEdit={onActivityEdit}
              onActivityRemove={onActivityRemove}
              onActivityMove={onActivityMove}
              onDayRegenerate={onDayRegenerate}
            />
          ))}
        </div>
      ) : (
        /* Transportation & Hotel Details */
        <div className="space-y-6">
          {/* Flight Info */}
          {(() => {
            const allLegs = flightInfo.legs && flightInfo.legs.length > 0
              ? flightInfo.legs
              : [flightInfo.outbound, flightInfo.return].filter(Boolean);
            const isMultiCity = allLegs.length > 2;

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <div className="bg-primary/10 px-6 py-4 border-b border-border">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    Transportation
                    {allLegs.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {allLegs.length} segment{allLegs.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {/* Route chain summary for multi-city */}
                  {isMultiCity && (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/5 rounded-lg px-4 py-2.5 overflow-x-auto">
                      <Plane className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap">
                        {[allLegs[0]?.departure?.airport || allLegs[0]?.departure?.city || '?',
                          ...allLegs.map(l => l?.arrival?.airport || l?.arrival?.city || '?')
                        ].join(' → ')}
                      </span>
                    </div>
                  )}

                  {allLegs.map((leg, idx) => {
                    const label = isMultiCity
                      ? `Leg ${idx + 1}`
                      : (idx === 0 ? 'Outbound' : 'Return');
                    return <FlightSegmentCard key={idx} segment={leg} label={label} />;
                  })}
                </div>
              </motion.div>
            );
          })()}

          {/* Hotel Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border overflow-hidden"
          >
            <div className="bg-primary/10 px-6 py-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2">
                <Hotel className="h-5 w-5" />
                Accommodation
              </h3>
            </div>
            <div className="p-6">
              <div className="flex gap-4 mb-4">
                {hotelInfo.images.slice(0, 2).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={hotelInfo.name}
                    className="w-32 h-24 object-cover rounded-lg"
                  />
                ))}
              </div>
              <h4 className="text-lg font-semibold">{hotelInfo.name}</h4>
              <p className="text-muted-foreground text-sm mb-2">{hotelInfo.type}</p>
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 text-amber-500 fill-current" />
                <span className="font-medium">{hotelInfo.rating}</span>
                <span className="text-muted-foreground text-sm">({hotelInfo.reviewCount} reviews)</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Check-in:</span>
                  <p className="font-medium">{hotelInfo.checkIn}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Check-out:</span>
                  <p className="font-medium">{hotelInfo.checkOut}</p>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-muted-foreground text-sm">Amenities:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {hotelInfo.amenities.map((amenity, i) => (
                    <Badge key={i} variant="secondary">{amenity}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Destination Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-6"
          >
            <h3 className="font-semibold mb-4">Destination Guide</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="font-medium">Best Time to Visit:</span>
                <p className="text-muted-foreground">{destinationInfo.bestTime}</p>
              </div>
              <div>
                <span className="font-medium">Currency:</span>
                <p className="text-muted-foreground">{destinationInfo.currency}</p>
              </div>
              <div>
                <span className="font-medium">Language:</span>
                <p className="text-muted-foreground">{destinationInfo.language}</p>
              </div>
              <div>
                <span className="font-medium">Cultural Notes:</span>
                <p className="text-muted-foreground">{destinationInfo.culturalNotes}</p>
              </div>
              <div>
                <span className="font-medium">Tips:</span>
                <p className="text-muted-foreground">{destinationInfo.tips}</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Save CTA */}
      {onSaveItinerary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 text-center"
        >
          <Button size="lg" onClick={onSaveItinerary} className="px-8">
            Customize This Itinerary
          </Button>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// DAY CARD COMPONENT
// ============================================================================

interface DayCardProps {
  day: DayItinerary;
  dayIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  onActivityLock?: (dayIndex: number, activityId: string, locked: boolean) => void;
  onActivityEdit?: (dayIndex: number, activityId: string) => void;
  onActivityRemove?: (dayIndex: number, activityId: string) => void;
  onActivityMove?: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onDayRegenerate?: (dayIndex: number) => void;
}

function DayCard({
  day,
  dayIndex,
  isExpanded,
  onToggle,
  onActivityLock,
  onActivityEdit,
  onActivityRemove,
  onActivityMove,
  onDayRegenerate,
}: DayCardProps) {
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
            <span className="text-sm text-muted-foreground">{day.theme}</span>
            <div className="flex items-center gap-1 text-sm">
              {weatherIcons[day.weather.condition]}
              <span className="text-muted-foreground">{day.weather.high}°F</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{day.description}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">${day.totalCost}</span>
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
                  onEdit={onActivityEdit}
                  onRemove={onActivityRemove}
                  onMove={onActivityMove}
                />
              ))}
              
              {/* Day Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Walking: {day.estimatedWalkingTime}</span>
                  <span>Distance: {day.estimatedDistance}</span>
                </div>
                {onDayRegenerate && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onDayRegenerate(dayIndex)}
                  >
                    Regenerate Day
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// ACTIVITY CARD COMPONENT
// ============================================================================

interface ActivityCardProps {
  activity: ItineraryActivity;
  dayIndex: number;
  activityIndex: number;
  totalActivities: number;
  onLock?: (dayIndex: number, activityId: string, locked: boolean) => void;
  onEdit?: (dayIndex: number, activityId: string) => void;
  onRemove?: (dayIndex: number, activityId: string) => void;
  onMove?: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
}

function ActivityCard({
  activity,
  dayIndex,
  activityIndex,
  totalActivities,
  onLock,
  onEdit,
  onRemove,
  onMove,
}: ActivityCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        activityColors[activity.type],
        activity.isLocked && 'ring-2 ring-accent'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{activityIcons[activity.type]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono">{activity.time}</span>
            <span className="text-xs">•</span>
            <span className="text-xs">{activity.duration}</span>
            {activity.rating && (
              <>
                <span className="text-xs">•</span>
                <span className="text-xs flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-current" />
                  {activity.rating}
                </span>
              </>
            )}
          </div>
          <h4 className="font-medium text-sm">{sanitizeActivityName(activity.title)}</h4>
          {(activity as any).closedRisk && (
            <div className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                Hours may vary - {(activity as any).closedRiskReason || 'Verify hours before visiting'}
              </span>
            </div>
          )}
          <p className="text-xs mt-1 opacity-80">{sanitizeActivityText(activity.description)}</p>
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="h-3 w-3 opacity-60" />
            <span className="text-xs opacity-60">
              {typeof activity.location === 'string' 
                ? activity.location 
                : activity.location?.name || activity.location?.address || ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {activity.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-white/50 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {activity.cost > 0 && (
            <span className="text-sm font-semibold">${activity.cost}</span>
          )}
          
          {/* Activity Actions */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1"
              >
                {onLock && (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onLock(dayIndex, activity.id, !activity.isLocked)}
                        className="p-1 hover:bg-white/50 rounded"
                        aria-label={activity.isLocked ? 'Unlock Activity' : 'Lock Activity'}
                      >
                        {activity.isLocked ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span className="text-xs font-medium">{activity.isLocked ? 'Unlock Activity' : 'Lock Activity'}</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {onEdit && (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onEdit(dayIndex, activity.id)}
                        className="p-1 hover:bg-white/50 rounded"
                        aria-label="Edit Activity"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span className="text-xs font-medium">Edit Activity</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {onMove && activityIndex > 0 && (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onMove(dayIndex, activity.id, 'up')}
                        className="p-1 hover:bg-white/50 rounded"
                        aria-label="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span className="text-xs font-medium">Move Up</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {onMove && activityIndex < totalActivities - 1 && (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onMove(dayIndex, activity.id, 'down')}
                        className="p-1 hover:bg-white/50 rounded"
                        aria-label="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span className="text-xs font-medium">Move Down</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                {onRemove && (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onRemove(dayIndex, activity.id)}
                        className="p-1 hover:bg-white/50 rounded text-red-600"
                        aria-label="Remove Activity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span className="text-xs font-medium">Remove Activity</span>
                    </TooltipContent>
                  </Tooltip>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FLIGHT SEGMENT CARD
// ============================================================================

interface FlightSegmentCardProps {
  segment: Partial<FlightSegment>;
  label: string;
}

function FlightSegmentCard({ segment, label }: FlightSegmentCardProps) {
  if (!segment) return null;
  const dep = segment.departure;
  const arr = segment.arrival;

  return (
    <div className="bg-secondary/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <Badge variant="outline">{label}</Badge>
        <span className="text-sm text-muted-foreground">
          {[segment.airline, segment.flightNumber].filter(Boolean).join(' ')}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center">
          <p className="text-2xl font-bold">{dep?.airport || '-'}</p>
          {dep?.city && <p className="text-sm text-muted-foreground">{dep.city}</p>}
          {dep?.time && <p className="text-sm font-medium">{dep.time}</p>}
          {dep?.date && <p className="text-xs text-muted-foreground">{dep.date}</p>}
        </div>
        <div className="flex-1 px-4">
          <div className="flex items-center justify-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <Plane className="h-4 w-4 text-muted-foreground" />
            <div className="h-px flex-1 bg-border" />
          </div>
          {segment.duration && <p className="text-center text-xs text-muted-foreground mt-1">{segment.duration}</p>}
          {segment.stops && <p className="text-center text-xs text-muted-foreground">{segment.stops}</p>}
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{arr?.airport || '-'}</p>
          {arr?.city && <p className="text-sm text-muted-foreground">{arr.city}</p>}
          {arr?.time && <p className="text-sm font-medium">{arr.time}</p>}
          {arr?.date && <p className="text-xs text-muted-foreground">{arr.date}</p>}
        </div>
      </div>
      {(segment.class || (segment.seats && segment.seats.length > 0)) && (
        <div className="flex justify-between mt-3 text-xs text-muted-foreground">
          {segment.class && <span>Class: {segment.class}</span>}
          {segment.seats && segment.seats.length > 0 && <span>Seats: {segment.seats.join(', ')}</span>}
        </div>
      )}
    </div>
  );
}

export type { ItineraryActivity, DayItinerary, TripSummary, DestinationInfo, FlightInfo, HotelInfo };
