import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, X, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendChatMessage, getActionDisplayInfo, type ItineraryContext } from '@/services/itineraryChatAPI';
import { executeAction, type ItineraryDay, type ActionExecutionResult } from '@/services/itineraryActionExecutor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InlineModifierProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: ItineraryDay[];
  onItineraryUpdate: (updatedDays: ItineraryDay[]) => void;
  className?: string;
}

interface PendingChange {
  message: string;
  action: {
    type: string;
    params: Record<string, unknown>;
  };
  preview: string;
}

export function InlineModifier({
  tripId,
  destination,
  startDate,
  endDate,
  days,
  onItineraryUpdate,
  className,
}: InlineModifierProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Build itinerary context for the chat API
  const buildContext = useCallback((): ItineraryContext => {
    return {
      tripId,
      destination,
      startDate,
      endDate,
      days: days.map(day => ({
        dayNumber: day.dayNumber,
        date: day.date,
        activities: day.activities.map((act, idx) => ({
          index: idx,
          title: act.title || act.name || '',
          category: act.category,
          time: act.startTime || act.time || '',
          cost: typeof act.cost === 'object' ? act.cost?.amount : undefined,
          isLocked: act.isLocked,
        })),
      })),
    };
  }, [tripId, destination, startDate, endDate, days]);

  // Generate preview text for an action
  const generatePreviewText = (action: { type: string; params: Record<string, unknown> }): string => {
    const info = getActionDisplayInfo(action);
    
    switch (action.type) {
      case 'suggest_activity_swap':
        return `Finding alternatives for "${action.params.target_activity_title}" on Day ${action.params.target_day}`;
      case 'adjust_day_pacing':
        const adj = action.params.adjustment as string;
        return adj === 'more_relaxed' 
          ? `Making Day ${action.params.target_day} more relaxed with fewer activities`
          : `Adding more activities to Day ${action.params.target_day}`;
      case 'regenerate_day':
        return `Regenerating Day ${action.params.target_day}${action.params.new_focus ? ` with focus on ${action.params.new_focus}` : ''}`;
      case 'apply_filter':
        return `Applying ${action.params.filter_type} filter: ${action.params.filter_value}`;
      default:
        return info.description;
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setPendingChange(null);

    try {
      const context = buildContext();
      const response = await sendChatMessage(
        [{ role: 'user', content: input }],
        context
      );

      if (response.actions && response.actions.length > 0) {
        const action = response.actions[0];
        const preview = generatePreviewText(action);
        
        setPendingChange({
          message: response.message,
          action,
          preview,
        });
      } else {
        // No action suggested, just show the message
        toast.info(response.message || "I couldn't find a specific change to make. Try being more specific.");
      }
    } catch (error) {
      console.error('[InlineModifier] Error:', error);
      toast.error('Failed to process your request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, buildContext]);

  const handleApply = useCallback(async () => {
    if (!pendingChange) return;

    setIsApplying(true);

    try {
      const result: ActionExecutionResult = await executeAction(
        {
          type: pendingChange.action.type as 'suggest_activity_swap' | 'adjust_day_pacing' | 'apply_filter' | 'regenerate_day',
          params: pendingChange.action.params,
          status: 'pending',
        },
        tripId,
        days,
        destination
      );

      if (result.success && result.updatedDays) {
        onItineraryUpdate(result.updatedDays);
        toast.success(result.message || 'Changes applied!');
        setPendingChange(null);
        setInput('');
        setIsExpanded(false);
      } else {
        toast.error(result.error || 'Failed to apply changes');
      }
    } catch (error) {
      console.error('[InlineModifier] Apply error:', error);
      toast.error('Failed to apply changes. Please try again.');
    } finally {
      setIsApplying(false);
    }
  }, [pendingChange, tripId, days, destination, onItineraryUpdate]);

  const handleCancel = useCallback(() => {
    setPendingChange(null);
    setInput('');
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Collapsed state - just a button */}
      {!isExpanded && !pendingChange && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <MessageSquare className="h-4 w-4" />
          Modify itinerary...
        </Button>
      )}

      {/* Expanded input */}
      <AnimatePresence>
        {(isExpanded || pendingChange) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Input row */}
            {!pendingChange && (
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder='Try "Make day 3 lighter" or "Add more food spots"'
                  disabled={isProcessing}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                    if (e.key === 'Escape') {
                      setIsExpanded(false);
                      setInput('');
                    }
                  }}
                  className="flex-1"
                  autoFocus
                />
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || !input.trim()}
                  size="icon"
                  className="shrink-0"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsExpanded(false);
                    setInput('');
                  }}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Pending change preview */}
            {pendingChange && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-muted/50 border border-border rounded-lg space-y-3"
              >
                {/* AI message */}
                {pendingChange.message && (
                  <p className="text-sm text-foreground">
                    {pendingChange.message}
                  </p>
                )}

                {/* Preview of what will happen */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 px-3 py-2 rounded-md">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{pendingChange.preview}</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleApply}
                    disabled={isApplying}
                    size="sm"
                    className="gap-2"
                  >
                    {isApplying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isApplying}
                    className="gap-2"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InlineModifier;
