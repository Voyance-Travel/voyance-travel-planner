/**
 * DailyBriefing
 * Useful daily intel for active trips: weather, schedule, local highlights, don't-miss tips
 */

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, RefreshCw, MapPin, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
      <div className={cn('space-y-3', className)}>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Today's Briefing
        </h2>
        <div className="space-y-3 animate-pulse">
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
      className={cn('space-y-3', className)}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
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

      {/* Weather */}
      {briefing.weather && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Weather</p>
                <p className="text-base font-semibold">{briefing.weather.condition}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">
                  {briefing.weather.tempHigh}°{briefing.weather.unit}
                </p>
                <p className="text-xs text-muted-foreground">
                  Low {briefing.weather.tempLow}°
                </p>
              </div>
            </div>
            {briefing.weather.tip && (
              <p className="text-xs text-muted-foreground mt-1">{briefing.weather.tip}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      {briefing.todaySchedule && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Your Day</p>
            </div>
            <p className="text-sm">
              {briefing.todaySchedule.activityCount} activities planned
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {briefing.todaySchedule.firstActivity} — {briefing.todaySchedule.lastActivity}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Local Highlights */}
      {briefing.highlights && briefing.highlights.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            Happening Near You
          </p>
          <div className="space-y-2">
            {briefing.highlights.map((highlight, i) => (
              <Card key={i}>
                <CardContent className="py-3 px-4">
                  <p className="text-sm font-medium">{highlight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{highlight.reason}</p>
                  {highlight.timeNote && (
                    <p className="text-xs text-primary mt-1">{highlight.timeNote}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Don't Miss */}
      {briefing.dontMiss && briefing.dontMiss.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Don't Miss
          </p>
          <div className="space-y-2">
            {briefing.dontMiss.map((item, i) => (
              <Card key={i} className="border-primary/20">
                <CardContent className="py-3 px-4">
                  <p className="text-sm">{item.tip}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Refresh */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
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
