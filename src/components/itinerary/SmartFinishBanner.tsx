/**
 * Smart Finish Banner + Review Dialog
 * 
 * Prominent CTA banner for manual/imported itineraries.
 * "This trip has great bones — want us to finish it?"
 * Shows gap analysis in a dialog when user clicks to review.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, AlertTriangle, Info, CheckCircle2, 
  Loader2, Zap, Coins, Wand2, X, ChevronRight,
  Route, Star, Clock, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSpendCredits } from '@/hooks/useSpendCredits';
import { useCredits } from '@/hooks/useCredits';
import { CREDIT_COSTS } from '@/config/pricing';

interface Gap {
  hint: string;
  severity: 'warning' | 'info';
  category: string;
}

interface GapAnalysis {
  gapCount: number;
  gaps: Gap[];
  dnaArchetype?: string;
  analyzedAt?: string;
}

interface SmartFinishBannerProps {
  tripId: string;
  isManualMode: boolean;
  smartFinishPurchased: boolean;
  className?: string;
  onPurchaseComplete?: () => void;
}

const severityIcon = {
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-blue-400" />,
};

const ENRICHMENT_FEATURES = [
  { icon: Star, label: 'Insider tips & local picks' },
  { icon: Route, label: 'Route optimization' },
  { icon: Clock, label: 'Timing hacks' },
  { icon: MapPin, label: 'DNA-matched fixes' },
];

export function SmartFinishBanner({
  tripId,
  isManualMode,
  smartFinishPurchased,
  onPurchaseComplete,
  className,
}: SmartFinishBannerProps) {
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const spendCredits = useSpendCredits();
  const { data: creditData } = useCredits();
  const totalCredits = creditData?.totalCredits ?? 0;

  const shouldShow = isManualMode && !smartFinishPurchased && !dismissed;

  const runAnalysis = useCallback(async () => {
    if (!shouldShow || hasAnalyzed) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-trip-gaps', {
        body: { tripId },
      });
      if (error) throw error;
      if (data) {
        setAnalysis(data);
        setHasAnalyzed(true);
      }
    } catch (err) {
      console.error('Gap analysis failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tripId, shouldShow, hasAnalyzed]);

  useEffect(() => {
    if (!shouldShow || hasAnalyzed) return;
    const timer = setTimeout(runAnalysis, 3000);
    return () => clearTimeout(timer);
  }, [shouldShow, hasAnalyzed, runAnalysis]);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      await spendCredits.mutateAsync({
        action: 'SMART_FINISH',
        tripId,
        metadata: { source: 'smart_finish_banner' },
      });

      const { error: updateError } = await supabase
        .from('trips')
        .update({ smart_finish_purchased: true })
        .eq('id', tripId);

      if (updateError) {
        console.error('Failed to mark smart finish purchased:', updateError);
      }

      supabase.functions.invoke('enrich-manual-trip', {
        body: { tripId },
      }).catch(err => console.error('Enrichment trigger failed:', err));

      toast.success('Smart Finish activated!', {
        description: 'Your itinerary is being enriched with route optimization, reviews, and tips.',
      });

      setIsDialogOpen(false);
      onPurchaseComplete?.();
    } catch (err: any) {
      if (!err?.message?.startsWith('Not enough credits')) {
        toast.error('Failed to activate Smart Finish. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  if (!shouldShow) return null;

  return (
    <>
      {/* ── Persistent Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-xl border",
          "border-amber-200/60 dark:border-amber-800/40",
          "bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-amber-50/80",
          "dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30",
          "p-4 sm:p-5",
          className
        )}
      >
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Decorative sparkle */}
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-amber-400/10 dark:bg-amber-400/5 blur-2xl" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Icon + Text */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/20">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                This trip has great bones — want us to finish it?
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Smart Finish adds insider tips, timing hacks, route optimization, and DNA-matched fixes to your itinerary.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {ENRICHMENT_FEATURES.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
              </div>

              {/* Gap count if analyzed */}
              {hasAnalyzed && analysis && analysis.gapCount > 0 && (
                <button
                  onClick={() => setIsDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {analysis.gapCount} gap{analysis.gapCount !== 1 ? 's' : ''} found — review details
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}

              {isLoading && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing your itinerary…
                </div>
              )}
            </div>
          </div>

          {/* CTA Button */}
          <div className="shrink-0 sm:self-center">
            <Button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full sm:w-auto gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md shadow-amber-500/20 font-semibold"
              size="lg"
            >
              {isPurchasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Smart Finish — {CREDIT_COSTS.SMART_FINISH} credits
            </Button>
            <p className="text-[10px] text-center text-muted-foreground mt-1.5">
              Your research. Our polish.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Gap Analysis Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-base">
                  Here's what we found
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {analysis?.dnaArchetype && `Based on your ${analysis.dnaArchetype} profile, `}
                  we spotted{' '}
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {analysis?.gapCount ?? 0} potential gap{(analysis?.gapCount ?? 0) !== 1 ? 's' : ''}
                  </span>{' '}
                  in your itinerary.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2">
            {analysis?.gaps.map((gap, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50"
              >
                {severityIcon[gap.severity]}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground leading-snug">{gap.hint}</span>
                  {gap.category && (
                    <Badge variant="outline" className="ml-2 text-[10px] align-middle">
                      {gap.category}
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md"
            >
              {isPurchasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Coins className="h-4 w-4" />
              )}
              Smart Finish — {CREDIT_COSTS.SMART_FINISH} credits
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Your research. Our polish. Route optimization, reviews, tips & DNA fixes.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setIsDialogOpen(false)}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
