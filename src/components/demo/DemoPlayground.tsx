import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, Lock, RefreshCw, Star, 
  ChevronDown, ChevronUp, Sparkles, 
  DollarSign, Sun, Cloud, Utensils, Camera, Compass, Hotel, Car
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getItineraryBySlug } from '@/data/sampleItineraries';
import { toast } from 'sonner';

const DESTINATIONS = [
  { slug: 'bali-wellness', name: 'Bali', subtitle: 'Wellness & Temples', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600' },
  { slug: 'kyoto-culture', name: 'Kyoto', subtitle: 'Culture & Gardens', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600' },
  { slug: 'santorini-romance', name: 'Santorini', subtitle: 'Romance & Sunsets', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600' },
  { slug: 'iceland-adventure', name: 'Iceland', subtitle: 'Adventure & Nature', image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=600' },
];

export function DemoPlayground() {
  const [selectedDest, setSelectedDest] = useState(DESTINATIONS[0]);
  const [itinerary, setItinerary] = useState<ReturnType<typeof getItineraryBySlug>>(null);
  const [lockedActivities, setLockedActivities] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const data = getItineraryBySlug(selectedDest.slug);
    setItinerary(data);
    setLockedActivities(new Set());
    setExpandedDays(new Set([1]));
  }, [selectedDest]);

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) {
        next.delete(dayNumber);
      } else {
        next.add(dayNumber);
      }
      return next;
    });
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success('Itinerary refreshed!', {
        description: 'Activities have been optimized for your preferences.',
      });
    }, 1800);
  };

  const toggleLock = (activityId: string, activityTitle: string) => {
    setLockedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
        toast('Unlocked', { 
          description: `"${activityTitle}" can now be swapped`,
          duration: 2000,
        });
      } else {
        next.add(activityId);
        toast.success('Locked', { 
          description: `"${activityTitle}" will stay in your itinerary`,
          duration: 2000,
        });
      }
      return next;
    });
  };

  const handleSwap = (activityTitle: string) => {
    toast.info('Finding alternatives...', {
      description: 'In the full app, you\'d see curated replacements here.',
      duration: 3000,
    });
  };

  if (!itinerary) return null;

  const totalCost = itinerary.days.reduce((sum, d) => sum + (d.totalCost || 0), 0);
  const totalActivities = itinerary.days.reduce((sum, d) => sum + d.activities.length, 0);

  return (
    <section id="playground" className="py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Interactive Playground
          </Badge>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-3">
            Explore Sample Itineraries
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Lock activities you love. Swap ones that don't fit. This is exactly how our planner works.
          </p>
        </div>

        {/* Destination selector */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {DESTINATIONS.map((dest) => (
            <button
              key={dest.slug}
              onClick={() => setSelectedDest(dest)}
              className={cn(
                "relative rounded-lg overflow-hidden transition-all aspect-[4/3] group",
                selectedDest.slug === dest.slug
                  ? "ring-2 ring-primary shadow-lg"
                  : "opacity-70 hover:opacity-100"
              )}
            >
              <img 
                src={dest.image} 
                alt={dest.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2 text-white text-left">
                <p className="font-medium text-sm leading-tight">{dest.name}</p>
                <p className="text-[10px] text-white/70 hidden sm:block">{dest.subtitle}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Trip overview card */}
        <Card className="mb-4 overflow-hidden border-border/50">
          <div className="relative h-28 sm:h-36">
            <img 
              src={selectedDest.image} 
              alt={itinerary.destination}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />
            <div className="absolute inset-0 p-5 flex flex-col justify-end">
              <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">{itinerary.destination}</h3>
              <div className="flex items-center gap-3 text-white/80 text-sm mt-1">
                <span>{itinerary.days.length} days</span>
                <span className="w-1 h-1 rounded-full bg-white/50" />
                <span className="capitalize">{itinerary.pace} pace</span>
              </div>
            </div>
          </div>
          <div className="p-4 flex items-center justify-between border-t border-border/50 bg-card">
            <div className="flex items-center gap-5 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">${totalCost.toLocaleString()}</span>
                <span className="hidden sm:inline">estimated</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{totalActivities} activities</span>
              </div>
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </motion.div>
                  <span className="hidden sm:inline">Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Days */}
        <div className="space-y-3">
          {itinerary.days.slice(0, 3).map((day) => {
            const isExpanded = expandedDays.has(day.dayNumber);
            
            return (
              <Card key={day.dayNumber} className="overflow-hidden border-border/50">
                {/* Day header */}
                <button
                  onClick={() => toggleDay(day.dayNumber)}
                  className="w-full text-left"
                >
                  <CardHeader className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center font-bold text-primary-foreground shadow-sm">
                        {day.dayNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif text-base font-semibold truncate">{day.theme}</h4>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-0.5">
                          <span>{day.activities.length} activities</span>
                          {day.weather && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                              <span className="flex items-center gap-1">
                                {day.weather.condition === 'sunny' ? (
                                  <Sun className="h-3 w-3 text-amber-500" />
                                ) : (
                                  <Cloud className="h-3 w-3 text-slate-400" />
                                )}
                                {day.weather.high}°
                              </span>
                            </>
                          )}
                          {day.totalCost && day.totalCost > 0 && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                              <span className="text-primary font-medium">${day.totalCost}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronDown className={cn(
                        "h-5 w-5 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    </div>
                  </CardHeader>
                </button>

                {/* Activities */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <CardContent className="p-0">
                        <div className="border-t border-border/50">
                          {day.activities.slice(0, 6).map((activity, idx) => (
                            <ActivityRow
                              key={activity.id}
                              activity={activity}
                              isLocked={lockedActivities.has(activity.id)}
                              isLast={idx === Math.min(day.activities.length - 1, 5)}
                              onLock={() => toggleLock(activity.id, activity.title)}
                              onSwap={() => handleSwap(activity.title)}
                            />
                          ))}
                          {day.activities.length > 6 && (
                            <div className="px-4 py-3 text-center text-xs text-muted-foreground border-t border-border/30 bg-muted/20">
                              + {day.activities.length - 6} more activities
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}

          {itinerary.days.length > 3 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                + {itinerary.days.length - 3} more days in full itinerary
              </p>
            </div>
          )}
        </div>

        {/* Tip */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
            <Lock className="h-3 w-3" />
            Click lock to keep • Click swap to replace
          </p>
        </div>
      </div>
    </section>
  );
}

function ActivityRow({ 
  activity, 
  isLocked, 
  isLast,
  onLock, 
  onSwap 
}: { 
  activity: {
    id: string;
    title: string;
    description?: string;
    time: string;
    duration: string;
    type: string;
    cost: number;
    rating?: number;
    location?: { name?: string; address?: string };
    photos?: string[];
    tags?: string[];
  };
  isLocked: boolean;
  isLast: boolean;
  onLock: () => void;
  onSwap: () => void;
}) {
  const getTypeConfig = (type: string) => {
    const configs: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
      cultural: { label: 'Cultural', icon: <Camera className="h-3 w-3" />, bg: 'bg-violet-500/10', text: 'text-violet-600' },
      dining: { label: 'Dining', icon: <Utensils className="h-3 w-3" />, bg: 'bg-orange-500/10', text: 'text-orange-600' },
      activity: { label: 'Activity', icon: <Compass className="h-3 w-3" />, bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
      relaxation: { label: 'Wellness', icon: <Sparkles className="h-3 w-3" />, bg: 'bg-sky-500/10', text: 'text-sky-600' },
      transportation: { label: 'Transfer', icon: <Car className="h-3 w-3" />, bg: 'bg-slate-500/10', text: 'text-slate-500' },
      accommodation: { label: 'Hotel', icon: <Hotel className="h-3 w-3" />, bg: 'bg-amber-500/10', text: 'text-amber-600' },
    };
    return configs[type] || { label: type, icon: <MapPin className="h-3 w-3" />, bg: 'bg-muted', text: 'text-muted-foreground' };
  };

  const config = getTypeConfig(activity.type);
  const isTransport = activity.type === 'transportation';
  const thumbnail = activity.photos?.[0];

  return (
    <div className={cn(
      "flex items-stretch transition-colors",
      !isLast && "border-b border-border/30",
      isLocked ? "bg-primary/5" : "hover:bg-muted/30"
    )}>
      {/* Time column */}
      <div className="w-[72px] shrink-0 py-3 px-3 border-r border-border/30 bg-muted/20">
        <p className="text-sm font-medium text-foreground">{activity.time}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{activity.duration}</p>
      </div>

      {/* Thumbnail */}
      {!isTransport && thumbnail && (
        <div className="w-16 h-16 shrink-0 m-2 rounded-lg overflow-hidden bg-muted">
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className={cn("flex-1 py-3 min-w-0", thumbnail && !isTransport ? "pl-1 pr-3" : "px-3")}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", config.bg, config.text)}>
            {config.icon}
            {config.label}
          </span>
          {activity.rating && activity.rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
              {activity.rating.toFixed(1)}
            </span>
          )}
        </div>
        <h5 className="text-sm font-medium text-foreground leading-tight line-clamp-1">{activity.title}</h5>
        {activity.location?.name && (
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 line-clamp-1">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {activity.location.name}
          </p>
        )}
      </div>

      {/* Cost */}
      {activity.cost > 0 && (
        <div className="hidden sm:flex items-center justify-end w-16 pr-2 text-sm text-muted-foreground shrink-0">
          ${activity.cost}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center shrink-0 border-l border-border/30">
        <button
          onClick={(e) => { e.stopPropagation(); onLock(); }}
          className={cn(
            "h-full w-10 flex items-center justify-center transition-colors",
            isLocked ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"
          )}
          title={isLocked ? "Unlock activity" : "Lock activity"}
        >
          <Lock className={cn(
            "h-4 w-4 transition-colors",
            isLocked ? "text-primary" : "text-muted-foreground/60"
          )} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          disabled={isLocked}
          className={cn(
            "h-full w-10 flex items-center justify-center transition-colors border-l border-border/30",
            isLocked ? "opacity-30 cursor-not-allowed" : "hover:bg-muted/50"
          )}
          title="Swap activity"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground/60" />
        </button>
      </div>
    </div>
  );
}
