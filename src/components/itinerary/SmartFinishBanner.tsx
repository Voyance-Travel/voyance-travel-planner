/**
 * Smart Finish Review Dialog
 * 
 * Shows DNA gap analysis in a popup dialog for manual/imported itineraries.
 * "Your research. Our polish. $6.99"
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, AlertTriangle, Info, CheckCircle2, 
  Loader2, Zap, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
        // Auto-open dialog if gaps found
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

  // Auto-analyze after a short delay
  useEffect(() => {
    if (!shouldShow || hasAnalyzed) return;
    const timer = setTimeout(runAnalysis, 3000);
    return () => clearTimeout(timer);
  }, [shouldShow, hasAnalyzed, runAnalysis]);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-smart-finish', {
        body: { tripId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      if (err?.message?.includes('already_purchased')) {
        toast.info('Smart Finish already purchased for this trip');
      } else {
        toast.error('Failed to start checkout. Please try again.');
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

  // Small inline trigger button (shown when dialog is closed)
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
      {/* Compact inline trigger */}
      {triggerButton}

      {/* Loading state inline */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          Analyzing your itinerary...
        </div>
      )}

      {/* No gaps — small success note */}
      {hasAnalyzed && (!analysis || analysis.gapCount === 0) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Your itinerary aligns well with your Travel DNA.
        </div>
      )}

      {/* Review Dialog */}
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

          {/* Gap list */}
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
                <Zap className="h-4 w-4" />
              )}
              Smart Finish — $6.99
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
