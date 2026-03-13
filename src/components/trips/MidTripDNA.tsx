/**
 * DailyBriefing
 * Editorial daily intel for active trips: weather, schedule, local highlights, don't-miss tips
 */

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, RefreshCw, MapPin, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DailyBriefingData {
  weather: {
    condition: string;
    tempHigh: number;
    tempLow: number;
    unit: string;
    tip: string;
  } | null;
  todaySchedule: {
    activityCount: number;
    firstActivity: string;
    lastActivity: string;
  } | null;
  highlights: Array<{
    title: string;
    reason: string;
    timeNote?: string;
  }>;
  dontMiss: Array<{
    tip: string;
    category: string;
  }>;
}

interface DailyBriefingProps {
  tripId: string;
  className?: string;
}

export function MidTripDNA({ tripId, className }: DailyBriefingProps) {
  const [briefing, setBriefing] = useState<DailyBriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mid-trip-dna', {
        body: { tripId, mode: 'daily-briefing' },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setBriefing(data.briefing);
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to fetch daily briefing:', err);
      toast.error("Could not load today's briefing");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (!hasLoaded && !loading) {
      fetchBriefing();
    }
  }, [hasLoaded, loading, fetchBriefing]);

  // Loading / initial state
  if (!hasLoaded || loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Today's Briefing
        </h2>
        <div className="space-y-4 animate-pulse">
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-8', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Today's Briefing
        </h2>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setHasLoaded(false);
            fetchBriefing();
          }}
          disabled={loading}
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Weather — borderless editorial */}
      {briefing.weather && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Weather</p>
              <p className="font-serif text-lg font-semibold mt-0.5">{briefing.weather.condition}</p>
            </div>
            <div className="text-right">
              <p className="font-serif text-3xl font-bold text-foreground/80">
                {briefing.weather.tempHigh}°
              </p>
              <p className="text-xs text-muted-foreground">
                Low {briefing.weather.tempLow}°{briefing.weather.unit}
              </p>
            </div>
          </div>
          {briefing.weather.tip && (
            <p className="font-serif text-sm italic text-muted-foreground">{briefing.weather.tip}</p>
          )}
          <div className="h-px bg-gradient-to-r from-primary/20 via-border/50 to-transparent mt-4" />
        </div>
      )}

      {/* Today's Schedule — left border accent */}
      {briefing.todaySchedule && (
        <div className="pl-4 border-l-2 border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-primary/50" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Your Day</p>
          </div>
          <p className="font-serif text-base font-medium">
            {briefing.todaySchedule.activityCount} activities planned
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {briefing.todaySchedule.firstActivity} — {briefing.todaySchedule.lastActivity}
          </p>
        </div>
      )}

      {/* Local Highlights — pull-quote style */}
      {briefing.highlights && briefing.highlights.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              Happening Near You
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
          </div>
          <div className="space-y-4">
            {briefing.highlights.map((highlight, i) => (
              <div key={i} className="pl-4 border-l-2 border-primary/15">
                <p className="font-serif text-base font-medium">{highlight.title}</p>
                <p className="text-sm italic text-muted-foreground mt-0.5">{highlight.reason}</p>
                {highlight.timeNote && (
                  <p className="text-xs text-primary mt-1 font-medium">{highlight.timeNote}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Don't Miss — accent blocks */}
      {briefing.dontMiss && briefing.dontMiss.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Don't Miss
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
          </div>
          <div className="space-y-3">
            {briefing.dontMiss.map((item, i) => (
              <div key={i} className="pl-4 border-l-2 border-primary/30 py-1">
                <p className="font-serif text-sm leading-relaxed">{item.tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground font-serif italic"
        onClick={() => {
          setHasLoaded(false);
          fetchBriefing();
        }}
      >
        Refresh briefing
      </Button>
    </motion.div>
  );
}

export default MidTripDNA;
