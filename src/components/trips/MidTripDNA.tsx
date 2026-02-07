/**
 * MidTripDNA
 * Shows AI-powered Travel DNA predictions based on mid-trip behavior
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dna, TrendingUp, TrendingDown, Minus, Sparkles,
  RefreshCw, Brain, Zap, Eye, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TraitShift {
  trait: string;
  direction: 'up' | 'down' | 'stable';
  insight: string;
}

interface DNAPredictions {
  headline: string;
  travelingAs: string;
  traitShifts: TraitShift[];
  prediction: string;
  surprisingPattern?: string;
  engagementScore: number;
}

interface PredictionMeta {
  currentArchetype: string;
  tripDay: number;
  totalDays: number;
  feedbackCount: number;
  memoriesCount: number;
}

interface MidTripDNAProps {
  tripId: string;
  className?: string;
}

export function MidTripDNA({ tripId, className }: MidTripDNAProps) {
  const [predictions, setPredictions] = useState<DNAPredictions | null>(null);
  const [meta, setMeta] = useState<PredictionMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mid-trip-dna', {
        body: { tripId },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setPredictions(data.predictions);
      setMeta(data.meta);
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to fetch DNA predictions:', err);
      toast.error('Could not generate predictions');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const directionIcon = (dir: string) => {
    switch (dir) {
      case 'up': return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
      case 'down': return <TrendingDown className="w-3.5 h-3.5 text-orange-500" />;
      default: return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  // Initial state - prompt to generate
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
            Travel DNA Predictions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-powered personality insights from your trip so far
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Discover your trip personality</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-5">
              We'll analyze your activity ratings, photos, and behavior to reveal how you're
              really traveling.
            </p>
            <Button onClick={fetchPredictions} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Predictions
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
            Travel DNA Predictions
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Analyzing your travel patterns...</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!predictions || !meta) return null;

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
            Travel DNA Predictions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Day {meta.tripDay} of {meta.totalDays} · {meta.feedbackCount} ratings · {meta.memoriesCount} photos
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={fetchPredictions} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Headline Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-5 pb-4">
          <p className="text-lg font-bold mb-2">{predictions.headline}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <Zap className="w-3 h-3" />
              Traveling as: {predictions.travelingAs}
            </Badge>
            {meta.currentArchetype !== 'unknown' && predictions.travelingAs.toLowerCase() !== meta.currentArchetype.toLowerCase().replace(/_/g, ' ') && (
              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                Profile: {meta.currentArchetype.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Score */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Trip Engagement</span>
            <span className="text-sm font-bold text-primary">{predictions.engagementScore}%</span>
          </div>
          <Progress value={predictions.engagementScore} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Based on ratings, photos, and activity patterns
          </p>
        </CardContent>
      </Card>

      {/* Trait Shifts */}
      {predictions.traitShifts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Trait Shifts Detected
          </h3>
          <div className="space-y-2">
            {predictions.traitShifts.map((shift, idx) => (
              <motion.div
                key={shift.trait}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card>
                  <CardContent className="py-3 px-4 flex items-start gap-3">
                    <div className="mt-0.5">{directionIcon(shift.direction)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{shift.trait.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{shift.insight}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium mb-1">Prediction</p>
              <p className="text-sm text-muted-foreground">{predictions.prediction}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Surprising Pattern */}
      {predictions.surprisingPattern && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2.5">
              <Eye className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium mb-1">Surprise</p>
                <p className="text-sm text-muted-foreground">{predictions.surprisingPattern}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
