import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, Lock, RefreshCw, Star, 
  ChevronDown, ChevronUp, Sparkles, Play, 
  DollarSign, Sun, Cloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getItineraryBySlug } from '@/data/sampleItineraries';
import { toast } from 'sonner';

const DESTINATIONS = [
  { slug: 'bali-wellness', name: 'Bali', emoji: '🌴', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400' },
  { slug: 'kyoto-culture', name: 'Kyoto', emoji: '⛩️', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400' },
  { slug: 'santorini-romance', name: 'Santorini', emoji: '🏛️', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400' },
  { slug: 'iceland-adventure', name: 'Iceland', emoji: '🏔️', image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=400' },
];

export function DemoPlayground() {
  const [selectedDest, setSelectedDest] = useState(DESTINATIONS[0]);
  const [itinerary, setItinerary] = useState<ReturnType<typeof getItineraryBySlug>>(null);
  const [lockedActivities, setLockedActivities] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const data = getItineraryBySlug(selectedDest.slug);
    setItinerary(data);
    setLockedActivities(new Set());
    setExpandedDay(1);
  }, [selectedDest]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success('Itinerary regenerated!', {
        description: 'This would use AI in the full version.',
      });
    }, 2000);
  };

  const toggleLock = (activityId: string) => {
    setLockedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
        toast('Activity unlocked', { description: 'AI can now swap this activity' });
      } else {
        next.add(activityId);
        toast.success('Activity locked', { description: 'This stays in your itinerary' });
      }
      return next;
    });
  };

  const handleSwap = (activityTitle: string) => {
    toast.info('Finding alternatives...', {
      description: `In the full version, AI suggests replacements for "${activityTitle}"`,
    });
  };

  if (!itinerary) return null;

  return (
    <section id="playground" className="py-20 bg-gradient-to-b from-secondary/20 to-background">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4 px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Interactive Playground
          </Badge>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Try It Yourself
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Explore real AI-generated itineraries. Lock your favorites, swap what doesn't fit.
          </p>
        </div>

        {/* Destination picker - visual cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {DESTINATIONS.map((dest) => (
            <button
              key={dest.slug}
              onClick={() => setSelectedDest(dest)}
              className={cn(
                "relative rounded-xl overflow-hidden transition-all h-24 group",
                selectedDest.slug === dest.slug
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "hover:ring-1 hover:ring-border"
              )}
            >
              <img 
                src={dest.image} 
                alt={dest.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-2 left-3 text-white text-left">
                <span className="text-lg mr-1">{dest.emoji}</span>
                <span className="font-medium">{dest.name}</span>
              </div>
              {selectedDest.slug === dest.slug && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px]">Selected</Badge>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Trip header card */}
        <Card className="mb-6 overflow-hidden">
          <div className="relative h-32 md:h-40">
            <img 
              src={selectedDest.image} 
              alt={itinerary.destination}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="absolute inset-0 p-6 flex items-end">
              <div className="text-white">
                <h3 className="text-2xl md:text-3xl font-serif font-bold">{itinerary.destination}</h3>
                <p className="text-white/80 mt-1">
                  {itinerary.days.length} days • {itinerary.style} • {itinerary.pace} pace
                </p>
              </div>
            </div>
          </div>
          <CardContent className="p-4 flex items-center justify-between bg-card">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-primary" />
                Est. ${itinerary.days.reduce((sum, d) => sum + (d.totalCost || 0), 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-primary" />
                {itinerary.days.reduce((sum, d) => sum + d.activities.length, 0)} activities
              </span>
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              variant="outline"
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </motion.div>
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Regenerate
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Days accordion */}
        <div className="space-y-4">
          {itinerary.days.slice(0, 3).map((day) => (
            <Card key={day.dayNumber} className="overflow-hidden">
              {/* Day header */}
              <button
                onClick={() => setExpandedDay(expandedDay === day.dayNumber ? 0 : day.dayNumber)}
                className="w-full text-left"
              >
                <CardHeader className="p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary text-lg">
                        {day.dayNumber}
                      </div>
                      <div>
                        <h4 className="font-serif text-lg font-medium">{day.theme}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span>{day.activities.length} activities</span>
                          {day.weather && (
                            <span className="flex items-center gap-1">
                              {day.weather.condition === 'sunny' ? (
                                <Sun className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <Cloud className="h-3.5 w-3.5" />
                              )}
                              {day.weather.high}°
                            </span>
                          )}
                          {day.totalCost && (
                            <span className="text-primary font-medium">${day.totalCost}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {day.description && (
                        <p className="text-sm text-muted-foreground max-w-xs hidden lg:block truncate">
                          {day.description}
                        </p>
                      )}
                      {expandedDay === day.dayNumber ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {/* Activities */}
              <AnimatePresence>
                {expandedDay === day.dayNumber && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="pt-0 pb-4 px-4">
                      <div className="border-t border-border pt-4">
                        {day.activities.slice(0, 6).map((activity, idx) => (
                          <DemoActivityRow
                            key={activity.id}
                            activity={activity}
                            isLocked={lockedActivities.has(activity.id)}
                            isLast={idx === Math.min(day.activities.length - 1, 5)}
                            onLock={() => toggleLock(activity.id)}
                            onSwap={() => handleSwap(activity.title)}
                          />
                        ))}
                        {day.activities.length > 6 && (
                          <p className="text-center text-sm text-muted-foreground pt-3 border-t border-border">
                            + {day.activities.length - 6} more activities
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>

        {/* Hint */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            💡 <span className="font-medium">Tip:</span> Click the lock icon to keep activities, or swap icon to find alternatives
          </p>
        </div>
      </div>
    </section>
  );
}

// Activity row that mirrors the real EditorialItinerary style
function DemoActivityRow({ 
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
  const getTypeStyle = (type: string) => {
    const styles: Record<string, { label: string; color: string }> = {
      cultural: { label: 'Cultural', color: 'bg-violet-500/10 text-violet-600' },
      dining: { label: 'Dining', color: 'bg-orange-500/10 text-orange-600' },
      activity: { label: 'Activity', color: 'bg-emerald-500/10 text-emerald-600' },
      relaxation: { label: 'Relaxation', color: 'bg-blue-500/10 text-blue-600' },
      transportation: { label: 'Transport', color: 'bg-slate-500/10 text-slate-600' },
      accommodation: { label: 'Hotel', color: 'bg-amber-500/10 text-amber-600' },
    };
    return styles[type] || { label: type, color: 'bg-secondary text-secondary-foreground' };
  };

  const style = getTypeStyle(activity.type);
  const thumbnail = activity.photos?.[0] || `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=200`;
  const isTransport = activity.type === 'transportation';

  return (
    <motion.div
      layout
      className={cn(
        "flex items-stretch group hover:bg-secondary/20 transition-colors",
        !isLast && "border-b border-border",
        isLocked && "bg-primary/5"
      )}
    >
      {/* Time column */}
      <div className="w-20 shrink-0 p-3 border-r border-border bg-gradient-to-b from-secondary/20 to-secondary/5">
        <span className="text-sm font-medium">{activity.time}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{activity.duration}</p>
      </div>

      {/* Thumbnail */}
      {!isTransport && (
        <div className="w-20 h-20 shrink-0 border-r border-border overflow-hidden bg-muted">
          <img
            src={thumbnail}
            alt={activity.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 border-none", style.color)}>
            {style.label}
          </Badge>
          {activity.rating && (
            <Badge variant="secondary" className="text-[10px] gap-0.5 bg-amber-500/10 text-amber-600 border-none">
              <Star className="h-2.5 w-2.5 fill-amber-500" />
              {activity.rating}
            </Badge>
          )}
          {activity.tags?.slice(0, 1).map(tag => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
          ))}
        </div>
        <h4 className="font-medium text-sm truncate">{activity.title}</h4>
        {activity.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activity.description}</p>
        )}
        {activity.location?.name && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary/60" />
            <span className="truncate">{activity.location.name}</span>
          </div>
        )}
      </div>

      {/* Cost */}
      {activity.cost > 0 && (
        <div className="hidden sm:flex items-center px-3 border-l border-border text-sm text-muted-foreground">
          ${activity.cost}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center border-l border-border">
        <Button
          variant="ghost"
          size="icon"
          className="h-full w-10 rounded-none hover:bg-primary/10"
          onClick={(e) => { e.stopPropagation(); onLock(); }}
        >
          <Lock className={cn(
            "h-4 w-4 transition-colors",
            isLocked ? "text-primary fill-primary/20" : "text-muted-foreground"
          )} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-full w-10 rounded-none hover:bg-secondary"
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          disabled={isLocked}
        >
          <RefreshCw className={cn(
            "h-4 w-4",
            isLocked ? "text-muted-foreground/30" : "text-muted-foreground"
          )} />
        </Button>
      </div>
    </motion.div>
  );
}
