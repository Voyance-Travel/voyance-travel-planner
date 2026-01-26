import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, DollarSign, Lock, RefreshCw, 
  ChevronDown, ChevronUp, Sparkles, Play, Pause
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getItineraryBySlug } from '@/data/sampleItineraries';
import { toast } from 'sonner';

const DESTINATIONS = [
  { slug: 'bali-wellness', name: 'Bali', emoji: '🌴', days: 5 },
  { slug: 'kyoto-culture', name: 'Kyoto', emoji: '🎎', days: 7 },
  { slug: 'santorini-romance', name: 'Santorini', emoji: '🏛️', days: 4 },
  { slug: 'iceland-adventure', name: 'Iceland', emoji: '🏔️', days: 6 },
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
    <section id="playground" className="py-16">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            Interactive Playground
          </Badge>
          <h2 className="text-3xl font-serif font-bold mb-3">
            Try It Yourself
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Tap activities to lock or swap them. This is exactly how our AI-powered planner works.
          </p>
        </div>

        {/* Destination picker */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {DESTINATIONS.map((dest) => (
            <button
              key={dest.slug}
              onClick={() => setSelectedDest(dest)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                selectedDest.slug === dest.slug
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-secondary hover:bg-secondary/80"
              )}
            >
              <span className="mr-1">{dest.emoji}</span>
              {dest.name}
            </button>
          ))}
        </div>

        {/* Trip summary card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-serif font-bold">{itinerary.destination}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {itinerary.days.length} days • {selectedDest.name}
                </p>
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
                    Regenerate Trip
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Days */}
        <div className="space-y-4">
          {itinerary.days.slice(0, 3).map((day) => (
            <Card key={day.dayNumber} className="overflow-hidden">
              {/* Day header - clickable */}
              <button
                onClick={() => setExpandedDay(expandedDay === day.dayNumber ? 0 : day.dayNumber)}
                className="w-full text-left"
              >
                <CardHeader className="pb-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {day.dayNumber}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{day.theme}</CardTitle>
                        <p className="text-sm text-muted-foreground">{day.activities.length} activities</p>
                      </div>
                    </div>
                    {expandedDay === day.dayNumber ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </button>

              {/* Activities - collapsible */}
              <AnimatePresence>
                {expandedDay === day.dayNumber && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="pt-0 pb-4">
                      <div className="space-y-2">
                        {day.activities.slice(0, 5).map((activity) => (
                          <ActivityCard
                            key={activity.id}
                            activity={activity}
                            isLocked={lockedActivities.has(activity.id)}
                            onLock={() => toggleLock(activity.id)}
                            onSwap={() => handleSwap(activity.title)}
                          />
                        ))}
                        {day.activities.length > 5 && (
                          <p className="text-center text-sm text-muted-foreground pt-2">
                            + {day.activities.length - 5} more activities
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

        {/* Hint text */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          💡 Tip: Click the lock icon to keep activities, or swap icon to replace them
        </p>
      </div>
    </section>
  );
}

function ActivityCard({ 
  activity, 
  isLocked, 
  onLock, 
  onSwap 
}: { 
  activity: {
    id: string;
    title: string;
    time: string;
    duration: string;
    type: string;
    cost: number;
  };
  isLocked: boolean;
  onLock: () => void;
  onSwap: () => void;
}) {
  return (
    <motion.div
      layout
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-all",
        isLocked 
          ? "bg-primary/5 border-primary/30" 
          : "bg-card hover:bg-secondary/30"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="text-xs text-muted-foreground font-mono w-12 shrink-0">
          {activity.time}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{activity.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{activity.duration}</span>
            {activity.cost > 0 && (
              <>
                <span>•</span>
                <DollarSign className="h-3 w-3" />
                <span>${activity.cost}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
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
          className="h-8 w-8"
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
