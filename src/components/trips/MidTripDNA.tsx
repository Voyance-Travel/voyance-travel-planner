/**
 * MidTripDNA
 * Fun, personality-driven trip predictions based on Travel DNA archetype
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Dna, Sparkles, RefreshCw, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TripPrediction {
  emoji: string;
  text: string;
}

interface DNAData {
  headline: string;
  archetypeInsight: string;
  predictions: TripPrediction[];
}

interface PredictionMeta {
  archetype: string;
  tripDay: number;
  totalDays: number;
}

interface MidTripDNAProps {
  tripId: string;
  className?: string;
}

export function MidTripDNA({ tripId, className }: MidTripDNAProps) {
  const [data, setData] = useState<DNAData | null>(null);
  const [meta, setMeta] = useState<PredictionMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('mid-trip-dna', {
        body: { tripId },
      });

      if (error) throw error;
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      setData(res.predictions);
      setMeta(res.meta);
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
      toast.error('Could not generate predictions');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  // Initial state — prompt to generate
  if (!hasLoaded && !loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('space-y-4', className)}
      >
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Dna className="w-5 h-5 text-primary" />
            Your Trip Predictions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            See what your Travel DNA predicts for this trip
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">What will your DNA predict?</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-5">
              Based on your travel personality and destination, we'll predict fun things
              that might happen on your trip.
            </p>
            <Button onClick={fetchPredictions} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Reveal Predictions
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn('space-y-4', className)}
      >
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Dna className="w-5 h-5 text-primary" />
            Your Trip Predictions
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Reading your Travel DNA...</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!data || !meta) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Dna className="w-5 h-5 text-primary" />
            Your Trip Predictions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Day {meta.tripDay} of {meta.totalDays} · {meta.archetype.replace(/_/g, ' ')}
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={fetchPredictions} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Headline Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-5 pb-4">
          <p className="text-lg font-bold mb-1.5">{data.headline}</p>
          <p className="text-sm text-muted-foreground">{data.archetypeInsight}</p>
        </CardContent>
      </Card>

      {/* Prediction Cards */}
      <div className="space-y-2.5">
        {data.predictions.map((prediction, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.12 }}
          >
            <Card>
              <CardContent className="py-3.5 px-4 flex items-start gap-3">
                <span className="text-xl mt-0.5 shrink-0">{prediction.emoji}</span>
                <p className="text-sm text-muted-foreground">{prediction.text}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
