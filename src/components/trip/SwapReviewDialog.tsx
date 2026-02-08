import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, X, Sparkles, Loader2, MapPin, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CREDIT_COSTS } from '@/config/pricing';

export interface SwapSuggestion {
  dayNumber: number;
  activityId: string;
  currentActivity: string;
  currentLocation?: string;
  suggestedActivity: string;
  suggestedLocation?: string;
  reason: string;
}

interface SwapReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: SwapSuggestion[];
  hotelContext: string;
  isApplying: boolean;
  onApproveSelected: (approvedIds: string[]) => void;
  onApproveAll: () => void;
  onSkip: () => void;
}

export function SwapReviewDialog({
  open,
  onOpenChange,
  suggestions,
  hotelContext,
  isApplying,
  onApproveSelected,
  onApproveAll,
  onSkip,
}: SwapReviewDialogProps) {
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const toggleSwap = (activityId: string) => {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const allSelected = approvedIds.size === suggestions.length;
  const noneSelected = approvedIds.size === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Suggested Itinerary Optimizations
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            Based on your stay at {hotelContext}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 py-2">
            {suggestions.map((swap, i) => {
              const isApproved = approvedIds.has(swap.activityId);
              return (
                <motion.div
                  key={swap.activityId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'rounded-lg border p-4 transition-all cursor-pointer',
                    isApproved
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                  onClick={() => toggleSwap(swap.activityId)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                      isApproved
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    )}>
                      {isApproved && <Check className="h-3 w-3" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">
                        Day {swap.dayNumber}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm line-through text-muted-foreground">
                          {swap.currentActivity}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium">
                          {swap.suggestedActivity}
                        </span>
                      </div>

                      {swap.suggestedLocation && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {swap.suggestedLocation}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {swap.reason}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex flex-col gap-2 pt-3 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onSkip}
              disabled={isApplying}
            >
              Skip All
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={onApproveAll}
              disabled={isApplying}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Approve All
                  <span className="text-xs opacity-70 ml-1">
                    ({CREDIT_COSTS.HOTEL_OPTIMIZATION} cr)
                  </span>
                </>
              )}
            </Button>
          </div>

          {!noneSelected && !allSelected && (
            <Button
              variant="secondary"
              className="gap-1.5"
              onClick={() => onApproveSelected(Array.from(approvedIds))}
              disabled={isApplying}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply {approvedIds.size} Selected Swap{approvedIds.size > 1 ? 's' : ''}
                  <span className="text-xs opacity-70 ml-1">
                    ({CREDIT_COSTS.HOTEL_OPTIMIZATION} cr)
                  </span>
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
