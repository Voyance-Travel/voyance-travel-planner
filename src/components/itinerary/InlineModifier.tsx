import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, X, Loader2, MessageSquare, Lightbulb, Mic, MicOff } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendChatMessage, getActionDisplayInfo, type ItineraryContext } from '@/services/itineraryChatAPI';
import { executeAction, type ItineraryDay, type ActionExecutionResult } from '@/services/itineraryActionExecutor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSpendCredits } from '@/hooks/useSpendCredits';
import { useCredits } from '@/hooks/useCredits';
import { useEntitlements } from '@/hooks/useEntitlements';
import { CREDIT_COSTS } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface InlineModifierProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: ItineraryDay[];
  onItineraryUpdate: (updatedDays: ItineraryDay[]) => void;
  className?: string;
  /** When true, changes create suggestions instead of applying directly */
  proposeMode?: boolean;
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
  proposeMode = false,
}: InlineModifierProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { isListening, isSupported: micSupported, toggleListening } = useSpeechRecognition({
    onResult: (transcript) => {
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
      if (!isExpanded) setIsExpanded(true);
    },
  });
  const { user } = useAuth();

  // Credit system hooks
  const { data: creditData } = useCredits();
  const { isPaid } = useEntitlements();
  const spendCredits = useSpendCredits();
  const totalCredits = creditData?.totalCredits ?? 0;

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
      case 'rewrite_day':
        return `Rewriting Day ${action.params.target_day}: ${action.params.reason || action.params.instructions || 'based on your instructions'}`;
      case 'apply_filter':
        return `Applying ${action.params.filter_type} filter: ${action.params.filter_value}`;
      default:
        return info.description;
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    // Charge credits for AI messages (skip for paid users)
    if (!isPaid) {
      if (totalCredits < CREDIT_COSTS.AI_MESSAGE) {
        toast.error(`Need ${CREDIT_COSTS.AI_MESSAGE} credits to send a message`);
        return;
      }
      try {
        await spendCredits.mutateAsync({
          action: 'AI_MESSAGE',
          tripId,
          metadata: { source: 'inline_modifier' },
        });
      } catch {
        return;
      }
    }

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
  }, [input, isProcessing, buildContext, isPaid, totalCredits, spendCredits, tripId]);

  /** Direct apply — owner or free_edit guest */
  const handleApplyDirect = useCallback(async () => {
    if (!pendingChange) return;

    setIsApplying(true);

    try {
      // Spend credits for credit-costing actions BEFORE executing
      const creditAction = pendingChange.action.type === 'suggest_activity_swap' ? 'SWAP_ACTIVITY'
        : pendingChange.action.type === 'rewrite_day' ? 'REGENERATE_DAY'
        : pendingChange.action.type === 'regenerate_day' ? 'REGENERATE_DAY'
        : null;

      if (creditAction) {
        const creditResult = await spendCredits.mutateAsync({
          action: creditAction,
          tripId,
          metadata: {
            source: 'inline_modifier',
            target_day: pendingChange.action.params.target_day,
            action_type: pendingChange.action.type,
          },
        });
        if (!creditResult.success) {
          throw new Error('Insufficient credits');
        }
      }

      const result: ActionExecutionResult = await executeAction(
        {
          type: pendingChange.action.type as 'suggest_activity_swap' | 'adjust_day_pacing' | 'apply_filter' | 'regenerate_day' | 'rewrite_day',
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
  }, [pendingChange, tripId, days, destination, onItineraryUpdate, spendCredits]);

  /** Propose as suggestion — propose_approve guest */
  const handleProposeSuggestion = useCallback(async () => {
    if (!pendingChange) return;

    setIsApplying(true);

    try {
      const displayName = user?.name || user?.email?.split('@')[0] || 'Guest';

      const { error } = await supabase
        .from('trip_suggestions')
        .insert({
          trip_id: tripId,
          trip_type: 'consumer',
          user_id: user?.id || null,
          display_name: displayName,
          suggestion_type: 'general',
          title: pendingChange.preview,
          description: `AI-suggested change: ${pendingChange.message}\n\nAction: ${pendingChange.action.type}\nDetails: ${JSON.stringify(pendingChange.action.params)}`,
        });

      if (error) throw error;

      toast.success('Change proposed for approval!');
      setPendingChange(null);
      setInput('');
      setIsExpanded(false);
    } catch (error) {
      console.error('[InlineModifier] Propose error:', error);
      toast.error('Failed to propose change. Please try again.');
    } finally {
      setIsApplying(false);
    }
  }, [pendingChange, tripId, user]);

  const handleApply = proposeMode ? handleProposeSuggestion : handleApplyDirect;

  const handleCancel = useCallback(() => {
    setPendingChange(null);
    setInput('');
  }, []);

  const applyLabel = proposeMode ? 'Propose' : 'Apply';
  const applyIcon = proposeMode ? <Lightbulb className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />;

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
          {proposeMode ? 'Propose a change...' : 'Modify itinerary...'}
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
                  placeholder={proposeMode
                    ? 'Suggest a change, e.g. "Add more food spots"'
                    : 'Try "Make day 3 lighter" or "Add more food spots"'
                  }
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
                {micSupported && (
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "outline"}
                    onClick={toggleListening}
                    title={isListening ? "Stop listening" : "Voice input"}
                    className="shrink-0"
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                )}
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
                className={cn(
                  "p-4 border rounded-lg space-y-3",
                  proposeMode
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-muted/50 border-border"
                )}
              >
                {/* Mode indicator for propose */}
                {proposeMode && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                    <Lightbulb className="h-3 w-3" />
                    This will be submitted as a proposal for approval
                  </div>
                )}

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
                      applyIcon
                    )}
                    {applyLabel}
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
