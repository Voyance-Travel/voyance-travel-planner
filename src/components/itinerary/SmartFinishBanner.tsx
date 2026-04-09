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
  Route, Star, MapPin, RefreshCw
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
import { useQueryClient } from '@tanstack/react-query';

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
  { icon: Star, label: 'Hidden gems & local favorites' },
  { icon: Wand2, label: 'DNA-matched experiences' },
  { icon: Route, label: 'Optimized routes & timing' },
  { icon: MapPin, label: 'Verified insider picks' },
];

const categoryLabels: Record<string, string> = {
  hidden_gem: 'Hidden Gem',
  better_alternative: 'Better Option',
  insider_timing: 'Timing Hack',
  experience_upgrade: 'Upgrade',
  local_favorite: 'Local Pick',
  // Keep old categories as fallback
  pacing: 'Pacing',
  meals: 'Meals',
  wellness: 'Wellness',
  timing: 'Timing',
  weather: 'Weather',
};

const categoryIcons: Record<string, React.ReactNode> = {
  hidden_gem: <Star className="h-4 w-4 text-amber-500" />,
  better_alternative: <Zap className="h-4 w-4 text-blue-500" />,
  insider_timing: <Info className="h-4 w-4 text-green-500" />,
  experience_upgrade: <Sparkles className="h-4 w-4 text-purple-500" />,
  local_favorite: <MapPin className="h-4 w-4 text-rose-500" />,
};

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
  const [enrichmentFailed, setEnrichmentFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const spendCredits = useSpendCredits();
  const { data: creditData } = useCredits();
  const queryClient = useQueryClient();
  const totalCredits = creditData?.totalCredits ?? 0;

  // Show banner if: manual & not purchased, OR if purchased but enrichment failed (retry mode)
  const shouldShow = isManualMode && (!smartFinishPurchased || enrichmentFailed) && !dismissed;

  const runAnalysis = useCallback(async () => {
    if (!shouldShow || hasAnalyzed || enrichmentFailed) return;
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
  }, [tripId, shouldShow, hasAnalyzed, enrichmentFailed]);

  useEffect(() => {
    if (!shouldShow || hasAnalyzed || enrichmentFailed) return;
    const timer = setTimeout(runAnalysis, 3000);
    return () => clearTimeout(timer);
  }, [shouldShow, hasAnalyzed, enrichmentFailed, runAnalysis]);

  /**
   * Check whether backend already completed Smart Finish even if client request timed out.
   */
  const checkSmartFinishCompletion = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from('trips')
      .select('smart_finish_purchased, metadata')
      .eq('id', tripId)
      .maybeSingle();

    if (error || !data) return false;

    const metadata = (data.metadata ?? {}) as Record<string, unknown>;
    return Boolean(
      data.smart_finish_purchased &&
      (metadata.smartFinishCompleted === true || typeof metadata.smartFinishCompletedAt === 'string')
    );
  }, [tripId]);

  const waitForSmartFinishCompletion = useCallback(async (source: string): Promise<boolean> => {
    const CHECKS = 60;
    const INTERVAL_MS = 5000;

    for (let i = 1; i <= CHECKS; i++) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
      const completed = await checkSmartFinishCompletion();
      if (completed) {
        console.log(`[SmartFinish ${source}] Backend completed after client-side uncertainty (check ${i}/${CHECKS})`);
        return true;
      }
    }

    return false;
  }, [checkSmartFinishCompletion]);

  /**
   * Poll trips.metadata until smartFinishCompleted or smartFinishFailed.
   */
  const pollForCompletion = async (source: string, maxChecks = 60, intervalMs = 5000): Promise<{ success: boolean; data?: any }> => {
    for (let i = 1; i <= maxChecks; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const { data, error } = await supabase
        .from('trips')
        .select('metadata')
        .eq('id', tripId)
        .maybeSingle();

      if (error || !data) continue;

      const meta = (data.metadata ?? {}) as Record<string, unknown>;

      if (meta.smartFinishCompleted === true) {
        console.log(`[SmartFinish ${source}] Completed (poll ${i}/${maxChecks})`);
        return { success: true, data: { success: true, totalActivities: meta.smartFinishTotalActivities || 0 } };
      }

      if (meta.smartFinishFailed === true) {
        const errorMsg = (meta.smartFinishError as string) || 'Generation failed';
        console.error(`[SmartFinish ${source}] Backend reported failure: ${errorMsg}`);
        return { success: false, data: { error: errorMsg } };
      }
    }

    console.error(`[SmartFinish ${source}] Polling timed out after ${maxChecks} checks`);
    return { success: false };
  };

  /**
   * Kick off enrich-manual-trip (returns immediately) then poll for completion.
   * Issues guaranteed refund if generation fails.
   */
  const callEnrichWithGuaranteedRefund = async (source: string): Promise<{ success: boolean; data?: any }> => {
    if (isGenerating) {
      toast.info('Smart Finish is already running. Please wait…');
      return { success: false };
    }
    setIsGenerating(true);
    try {
      // Kick off — returns immediately with status: "generating"
      const { data, error } = await supabase.functions.invoke('enrich-manual-trip', {
        body: { tripId },
      });

      if (error || !data?.success) {
        const errorMsg = data?.error || error?.message || 'Unknown error';
        console.error(`[SmartFinish ${source}] Kickoff failed:`, errorMsg);
        // Still check if backend completed despite the error
        const recovered = await pollForCompletion(source, 60, 5000);
        if (recovered.success) { setIsGenerating(false); return recovered; }

        await issueGuaranteedRefund(source, errorMsg);
        return { success: false };
      }

      // If already completed (idempotent re-call)
      if (data.status === 'completed' || data.alreadyCompleted) {
        setIsGenerating(false);
        return { success: true, data };
      }

      // Poll for background completion
      const result = await pollForCompletion(source);

      if (!result.success) {
        const errorDetail = result.data?.error || undefined;
        await issueGuaranteedRefund(source, errorDetail);
        return { success: false };
      }

      setIsGenerating(false);
      return result;
    } catch (err: unknown) {
      console.error(`[SmartFinish ${source}] Exception:`, err);
      const recovered = await pollForCompletion(source, 60, 5000);
      if (recovered.success) { setIsGenerating(false); return recovered; }

      await issueGuaranteedRefund(source, err instanceof Error ? err.message : String(err));
      return { success: false };
    }
  };

  const issueGuaranteedRefund = async (source: string, errorDetail?: string) => {
    console.log(`[SmartFinish ${source}] Enrichment not confirmed — issuing guaranteed refund`);
    
    // Humanize the error for the user
    let humanError = 'The enrichment process encountered an issue.';
    if (errorDetail) {
      if (errorDetail.includes('timeout') || errorDetail.includes('504') || errorDetail.includes('408')) {
        humanError = 'The server took too long to respond. This is usually temporary.';
      } else if (errorDetail.includes('DUPLICATE') || errorDetail.includes('VARIETY')) {
        humanError = 'A quality validation issue occurred. This has been softened for retry.';
      } else if (errorDetail.includes('rate') || errorDetail.includes('limit')) {
        humanError = 'AI service rate limit reached. Please wait a moment before retrying.';
      } else if (errorDetail.length < 150) {
        humanError = errorDetail;
      }
    }
    setFailureReason(humanError);

    try {
      const { data: refundData, error: refundError } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: 'REFUND',
          tripId,
          metadata: { reason: `smart_finish_${source}_failed`, originalAction: 'SMART_FINISH' },
        },
      });

      if (refundError || !refundData?.success) {
        console.error(`[SmartFinish ${source}] Guaranteed refund FAILED:`, refundError ?? refundData);
        toast.error('Enrichment failed. Credit refund also failed. Please contact support.', { duration: 8000 });
      } else {
        console.log(`[SmartFinish ${source}] Guaranteed refund OK: +${refundData.refunded} credits`);
        toast.error('Enrichment failed. Your credits have been refunded.', {
          description: humanError,
          duration: 6000,
        });
      }
    } catch (refundErr) {
      console.error(`[SmartFinish ${source}] Guaranteed refund exception:`, refundErr);
      toast.error('Enrichment failed. Credit refund also failed. Please contact support.', { duration: 8000 });
    }

    // Reset purchased flag so banner stays visible
    await supabase
      .from('trips')
      .update({ smart_finish_purchased: false })
      .eq('id', tripId);

    setEnrichmentFailed(true);
    setIsGenerating(false);
    queryClient.invalidateQueries({ queryKey: ['credits'] });
    queryClient.invalidateQueries({ queryKey: ['entitlements'] });
  };

  const handleRetryEnrichment = async () => {
    setIsPurchasing(true);
    try {
      // Step 1: Charge credits — previous attempt was fully refunded
      toast.info('Retrying Smart Finish…', { description: 'Credits will be charged for this attempt.' });
      await spendCredits.mutateAsync({
        action: 'SMART_FINISH',
        tripId,
        metadata: { source: 'smart_finish_retry' },
      });

      // Step 2: Mark as purchased
      await supabase
        .from('trips')
        .update({ smart_finish_purchased: true })
        .eq('id', tripId);

      // Step 3: Call enrichment with guaranteed refund on ANY failure
      const result = await callEnrichWithGuaranteedRefund('retry');

      if (!result.success) return;

      // Success
      toast.success('Smart Finish complete!', {
        description: `Your itinerary has been fully generated by Voyance. ${result.data?.totalActivities || 0} activities, optimized and DNA-matched.`,
      });
      setEnrichmentFailed(false);
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
      onPurchaseComplete?.();
    } catch (err: any) {
      if (!err?.message?.startsWith('Not enough credits')) {
        toast.error('Something went wrong. Please try again later.');
      }
      console.error('Retry enrichment error:', err);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      // Step 1: Deduct credits
      await spendCredits.mutateAsync({
        action: 'SMART_FINISH',
        tripId,
        metadata: { source: 'smart_finish_banner' },
      });

      // Step 2: Mark as purchased
      const { error: updateError } = await supabase
        .from('trips')
        .update({ smart_finish_purchased: true })
        .eq('id', tripId);

      if (updateError) {
        console.error('Failed to mark smart finish purchased:', updateError);
      }

      toast.info('Smart Finish activated!', {
        description: 'Voyance is generating a complete, polished itinerary from your research…',
      });

      // Step 3: Call enrichment with guaranteed refund on ANY failure
      const result = await callEnrichWithGuaranteedRefund('purchase');

      if (!result.success) return;

      // Success!
      toast.success('Smart Finish complete!', {
        description: `Voyance generated ${result.data?.totalActivities || 0} DNA-matched activities for your trip.`,
      });

      setIsDialogOpen(false);
      setEnrichmentFailed(false);
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
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
          enrichmentFailed
            ? "border-red-200/60 dark:border-red-800/40 bg-gradient-to-br from-red-50/80 via-orange-50/50 to-red-50/80 dark:from-red-950/30 dark:via-orange-950/20 dark:to-red-950/30"
            : "border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-amber-50/80 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30",
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
            <div className={cn(
              "shrink-0 p-2.5 rounded-xl shadow-md",
              enrichmentFailed
                ? "bg-gradient-to-br from-red-400 to-orange-500 shadow-red-500/20"
                : "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/20"
            )}>
              {enrichmentFailed ? <RefreshCw className="h-5 w-5 text-white" /> : <Wand2 className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                {enrichmentFailed
                  ? 'Enrichment failed. Retry at no extra cost'
                  : 'This trip has great bones. Want us to finish it?'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {enrichmentFailed
                  ? failureReason 
                    ? `Your credits were refunded. ${failureReason}`
                    : 'Your credits were refunded. Click below to try enriching your itinerary again.'
                  : 'Smart Finish adds insider tips, timing hacks, route optimization, and DNA-matched fixes to your itinerary.'}
              </p>

              {/* Feature pills (only show when not in retry mode) */}
              {!enrichmentFailed && (
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
              )}

              {/* Gap count if analyzed */}
              {!enrichmentFailed && hasAnalyzed && analysis && analysis.gapCount > 0 && (
                <button
                  onClick={() => setIsDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {analysis.gapCount} insider tip{analysis.gapCount !== 1 ? 's' : ''} found: see what you're missing
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
            {enrichmentFailed ? (
              <Button
                onClick={handleRetryEnrichment}
                disabled={isPurchasing || isGenerating}
                className="w-full sm:w-auto gap-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-0 shadow-md shadow-red-500/20 font-semibold"
                size="lg"
              >
                {isPurchasing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Retry Enrichment (Free)
              </Button>
            ) : (
              <Button
                onClick={handlePurchase}
                disabled={isPurchasing || isGenerating}
                className="w-full sm:w-auto gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md shadow-amber-500/20 font-semibold"
                size="lg"
              >
                {isPurchasing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Smart Finish - {CREDIT_COSTS.SMART_FINISH} credits
              </Button>
            )}
            <p className="text-[10px] text-center text-muted-foreground mt-1.5">
              {enrichmentFailed ? 'No additional credits charged.' : 'Your research. Our polish.'}
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
                  What You're Missing
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {analysis?.dnaArchetype && `Based on your ${analysis.dnaArchetype} profile, `}
                  we analyzed your itinerary against local knowledge.
                  {analysis?.gapCount ? ' Here\'s what could make this trip even better:' : ''}
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
                className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                {categoryIcons[gap.category] || severityIcon[gap.severity]}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground leading-snug">{gap.hint}</span>
                  {gap.category && (
                    <Badge variant="outline" className="ml-2 text-[10px] align-middle capitalize">
                      {categoryLabels[gap.category] || gap.category}
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
              Smart Finish - {CREDIT_COSTS.SMART_FINISH} credits
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
