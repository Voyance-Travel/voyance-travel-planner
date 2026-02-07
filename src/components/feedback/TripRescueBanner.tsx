/**
 * TripRescueBanner
 * Proactive intervention when the trip is going poorly.
 * Offers quick swap suggestions and pace adjustments.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, Sparkles, X, RefreshCw, 
  Clock, ArrowRight, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TripSentiment, SentimentIssue } from '@/hooks/useTripSentiment';

interface TripRescueBannerProps {
  sentiment: TripSentiment;
  destination: string;
  tripId: string;
  dayNumber: number;
  totalDays: number;
  onSwapActivity?: () => void;
  onLightenPace?: () => void;
  onDismiss: () => void;
}

export function TripRescueBanner({
  sentiment,
  destination,
  tripId,
  dayNumber,
  totalDays,
  onSwapActivity,
  onLightenPace,
  onDismiss,
}: TripRescueBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [applyingPace, setApplyingPace] = useState(false);

  if (!sentiment.needsRescue) return null;

  const isLastDay = dayNumber === totalDays;
  const hasPaceIssue = sentiment.interventionType === 'pace' || sentiment.interventionType === 'both';
  const hasSwapIssue = sentiment.interventionType === 'swap' || sentiment.interventionType === 'both';

  const handleLightenPace = async () => {
    setApplyingPace(true);
    try {
      onLightenPace?.();
    } finally {
      setTimeout(() => setApplyingPace(false), 1500);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 overflow-hidden">
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">
                    {hasPaceIssue && hasSwapIssue
                      ? "Let's fix tomorrow"
                      : hasPaceIssue
                        ? "Tomorrow could be lighter"
                        : "We can find better options"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    We noticed a few things didn't go as planned
                  </p>
                </div>
              </div>
              <button onClick={onDismiss} className="p-1 rounded-full hover:bg-muted/80 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Issues summary */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
            >
              {sentiment.issues.length} signal{sentiment.issues.length > 1 ? 's' : ''} detected
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 mt-2">
                    {sentiment.issues.map((issue, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg',
                          issue.severity === 'critical'
                            ? 'bg-red-500/10 text-red-600'
                            : 'bg-amber-500/10 text-amber-700'
                        )}
                      >
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        {issue.message}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            {!isLastDay && (
              <div className="flex gap-2 mt-4">
                {hasSwapIssue && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 h-9 border-amber-500/30 hover:bg-amber-500/10"
                    onClick={onSwapActivity}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Swap activities
                  </Button>
                )}
                {hasPaceIssue && (
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 h-9 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleLightenPace}
                    disabled={applyingPace}
                  >
                    {applyingPace ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    {applyingPace ? 'Adjusting...' : 'Lighten tomorrow'}
                  </Button>
                )}
              </div>
            )}

            {isLastDay && (
              <p className="text-xs text-muted-foreground mt-3 text-center italic">
                It's your last day — make the most of it! We'll use this feedback for future trips.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export default TripRescueBanner;
