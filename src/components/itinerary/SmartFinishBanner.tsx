/**
 * Smart Finish Banner
 * 
 * Shows DNA gap analysis teaser for manual/imported itineraries.
 * "Your research. Our polish. $6.99"
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, AlertTriangle, Info, CheckCircle2, 
  Loader2, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  className,
  onPurchaseComplete,
}: SmartFinishBannerProps) {
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Don't show if not manual mode or already purchased
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

  if (!shouldShow) return null;

  // Show compact teaser while loading or no gaps
  if (isLoading) {
    return (
      <Card className={cn('border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/30', className)}>
        <CardContent className="py-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
          <p className="text-sm text-muted-foreground">Analyzing your itinerary against your Travel DNA...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis || analysis.gapCount === 0) {
    if (hasAnalyzed) {
      return (
        <Card className={cn('border-green-200/50 bg-green-50/30 dark:bg-green-950/20 dark:border-green-800/30', className)}>
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm text-foreground">Your itinerary aligns well with your Travel DNA. Nice work!</p>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card className={cn(
      'border-amber-200/50 bg-gradient-to-r from-amber-50/50 to-orange-50/30',
      'dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800/30',
      'overflow-hidden',
      className
    )}>
      <CardContent className="py-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">
                We analyzed your itinerary against your Travel DNA
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {analysis.dnaArchetype && `As a ${analysis.dnaArchetype}, `}
                we found{' '}
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {analysis.gapCount} potential gap{analysis.gapCount !== 1 ? 's' : ''}
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Gap hints (always show first 2, expand for rest) */}
        <div className="space-y-1.5 pl-[52px]">
          {analysis.gaps.slice(0, isExpanded ? undefined : 2).map((gap, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-2 text-sm"
            >
              {severityIcon[gap.severity]}
              <span className="text-muted-foreground leading-tight">{gap.hint}</span>
            </motion.div>
          ))}
          {!isExpanded && analysis.gaps.length > 2 && (
            <button 
              onClick={() => setIsExpanded(true)}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              +{analysis.gaps.length - 2} more gap{analysis.gaps.length - 2 !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* CTA */}
        <div className="pl-[52px] pt-1">
          <Button
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md"
            size="sm"
          >
            {isPurchasing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Smart Finish — $6.99
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Your research. Our polish. Route optimization, reviews, tips & DNA fixes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
