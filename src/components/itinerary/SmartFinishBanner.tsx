/**
 * Smart Finish Review Dialog
 * 
 * Shows DNA gap analysis in a popup dialog for manual/imported itineraries.
 * "Your research. Our polish. 50 credits."
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, AlertTriangle, Info, CheckCircle2, 
  Loader2, Zap, Coins
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

export function SmartFinishBanner({
  tripId,
  isManualMode,
  smartFinishPurchased,
  onPurchaseComplete,
}: SmartFinishBannerProps) {
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const spendCredits = useSpendCredits();
  const { data: creditData } = useCredits();
  const totalCredits = creditData?.totalCredits ?? 0;

  const shouldShow = isManualMode && !smartFinishPurchased;

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
        if (data.gapCount > 0) {
          setIsOpen(true);
        }
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
      // Spend credits via the spend-credits edge function
      await spendCredits.mutateAsync({
        action: 'SMART_FINISH',
        tripId,
        metadata: { source: 'smart_finish_banner' },
      });

      // Mark smart_finish_purchased on the trip
      const { error: updateError } = await supabase
        .from('trips')
        .update({ smart_finish_purchased: true })
        .eq('id', tripId);

      if (updateError) {
        console.error('Failed to mark smart finish purchased:', updateError);
      }

      // Trigger enrichment
      supabase.functions.invoke('enrich-manual-trip', {
        body: { tripId },
      }).catch(err => console.error('Enrichment trigger failed:', err));

      toast.success('Smart Finish activated!', {
        description: 'Your itinerary is being enriched with route optimization, reviews, and tips.',
      });

      setIsOpen(false);
      onPurchaseComplete?.();
    } catch (err: any) {
      // useSpendCredits handles insufficient credits via the modal
      if (!err?.message?.startsWith('Not enough credits')) {
        toast.error('Failed to activate Smart Finish. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    setDismissed(true);
  };

  if (!shouldShow) return null;

  const triggerButton = hasAnalyzed && analysis && analysis.gapCount > 0 && !isOpen && (
    <button
      onClick={() => setIsOpen(true)}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
        "border border-amber-200/50 bg-amber-50/50 hover:bg-amber-100/60",
        "dark:border-amber-800/30 dark:bg-amber-950/20 dark:hover:bg-amber-950/40",
        "text-amber-700 dark:text-amber-300"
      )}
    >
      <Sparkles className="h-4 w-4" />
      <span>
        {analysis.gapCount} gap{analysis.gapCount !== 1 ? 's' : ''} found
      </span>
      <Badge variant="outline" className="text-[10px] border-amber-300 dark:border-amber-700">
        Review
      </Badge>
    </button>
  );

  return (
    <>
      {triggerButton}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          Analyzing your itinerary...
        </div>
      )}

      {hasAnalyzed && (!analysis || analysis.gapCount === 0) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Your itinerary aligns well with your Travel DNA.
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
