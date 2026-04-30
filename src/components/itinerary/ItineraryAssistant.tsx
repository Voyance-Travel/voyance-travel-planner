/**
 * Itinerary Assistant Component
 * 
 * A floating chatbot for itinerary customization with:
 * - Constrained actions (swap, pace, filter, regenerate)
 * - Approval mode toggle (approve each action vs. direct apply)
 * - Preference capture for profile improvement
 * - Direct execution of actions using get-activity-alternatives
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, ArrowLeftRight, Gauge, Filter, RefreshCw, Check, ThumbsDown, Settings2, Coins, Pencil, TrendingDown, TrendingUp, Minus, Plus, Mic, MicOff } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  sendChatMessage, 
  generateConversationId, 
  getActionDisplayInfo,
  calculateActionsCreditCost,
  type ChatMessage,
  type ItineraryAction,
  type ItineraryContext,
} from '@/services/itineraryChatAPI';
import { 
  executeAction, 
  updateLocalTripItinerary,
  detectBudgetIntent,
  type ItineraryDay,
  type DiffEntry,
} from '@/services/itineraryActionExecutor';

import { useSpendCredits } from '@/hooks/useSpendCredits';
import { useCredits } from '@/hooks/useCredits';
import { useEntitlements } from '@/hooks/useEntitlements';

import { CREDIT_COSTS } from '@/config/pricing';
import { useQueryClient } from '@tanstack/react-query';

interface ItineraryAssistantProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  currentDayNumber?: number;
  days: ItineraryDay[];
  isLocalTrip?: boolean;
  travelers?: number;
  onItineraryUpdate?: (updatedDays: ItineraryDay[]) => void;
  accommodationInfo?: {
    name: string;
    neighborhood?: string;
    city?: string;
  };
  blendedDna?: {
    blendedTraits: Record<string, number>;
    travelerProfiles: Array<{ userId: string; name: string; archetypeId: string; isOwner: boolean; weight: number }>;
    isBlended: boolean;
  };
}

export function ItineraryAssistant({
  tripId,
  destination,
  startDate,
  endDate,
  currentDayNumber,
  days,
  isLocalTrip = false,
  travelers = 1,
  onItineraryUpdate,
  accommodationInfo,
  blendedDna,
}: ItineraryAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null); // Track which action is executing
  const [approvalMode, setApprovalMode] = useState(true); // Default to approval mode
  const [currentDays, setCurrentDays] = useState<ItineraryDay[]>(days);
  const [conversationId] = useState(generateConversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported: micSupported, toggleListening, interimTranscript } = useSpeechRecognition({
    onResult: (transcript) => {
      setInputValue(prev => (prev ? prev + ' ' : '') + transcript);
    },
  });
  // Credit system hooks
  const queryClient = useQueryClient();
  const { data: creditData } = useCredits();
  const { isPaid } = useEntitlements();
  const spendCredits = useSpendCredits();
  const totalCredits = creditData?.totalCredits ?? 0;
  // ai_message is now free — no cap tracking needed

  // Keep local days in sync with props
  useEffect(() => {
    setCurrentDays(days);
  }, [days]);

  // Build context from props
  const itineraryContext: ItineraryContext = {
    tripId,
    destination,
    startDate,
    endDate,
    currentDayNumber,
    days: currentDays.map(d => ({
      dayNumber: d.dayNumber,
      date: d.date,
      activities: d.activities.map((a, idx) => ({
        index: idx,
        title: a.title || a.name || 'Activity',
        category: a.category,
        time: a.time || a.startTime || '',
        cost: typeof a.cost === 'number' ? a.cost : (a.cost as { amount?: number })?.amount,
        isLocked: a.isLocked,
      })),
    })),
    accommodationInfo,
    blendedDna,
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Build a contextual, proactive greeting based on the actual itinerary
  const buildContextualGreeting = useCallback((): string => {
    const observations: string[] = [];

    // Check for packed days (6+ activities)
    for (const day of currentDays) {
      if (day.activities.length >= 6) {
        observations.push(`I see Day ${day.dayNumber} is packed with ${day.activities.length} activities. Want me to space things out a bit?`);
        break;
      }
    }

    // Check for light days (<3 activities)
    if (observations.length < 2) {
      for (const day of currentDays) {
        if (day.activities.length > 0 && day.activities.length < 3) {
          observations.push(`Day ${day.dayNumber} has some free time. Want me to suggest something fun to fill the gap?`);
          break;
        }
      }
    }

    // Check for missing dinner slots
    if (observations.length < 2) {
      for (const day of currentDays) {
        const hasDinner = day.activities.some(a => {
          const cat = (a.category || '').toLowerCase();
          const title = (a.title || a.name || '').toLowerCase();
          return cat.includes('dinner') || cat.includes('dining') || title.includes('dinner');
        });
        if (!hasDinner && day.activities.length > 0) {
          observations.push(`Day ${day.dayNumber} doesn't have dinner planned yet. Want me to find a spot${accommodationInfo?.neighborhood ? ` near ${accommodationInfo.neighborhood}` : ''}?`);
          break;
        }
      }
    }

    // Accommodation proximity observation
    if (observations.length < 2 && accommodationInfo?.neighborhood) {
      observations.push(`Since you're staying in ${accommodationInfo.neighborhood}, I can suggest walkable spots nearby.`);
    }

    // DNA-based observation
    if (observations.length < 2 && blendedDna?.blendedTraits) {
      const traits = blendedDna.blendedTraits;
      if ((traits.adventure ?? 0) >= 7) {
        observations.push(`Your Travel DNA says you love adventure. I'll keep an eye out for thrill-seeking options!`);
      } else if ((traits.authenticity ?? 0) >= 7) {
        observations.push(`Your DNA leans toward authentic local experiences. Let me know if any activity feels too touristy.`);
      } else if ((traits.comfort ?? 0) >= 7) {
        observations.push(`I see you value comfort. I'll make sure your days have a nice rhythm without too much rushing.`);
      }
    }

    // Build the greeting
    const intro = `Hey! I've been looking over your ${destination} itinerary. `;
    const body = observations.length > 0
      ? observations.slice(0, 2).join('\n\n')
      : `Everything looks solid! Just say the word if you want to swap an activity, adjust the pace, or explore different neighborhoods.`;
    const outro = `\n\n💬 Chat's free — I only use credits when you apply a change.`;

    return intro + body + outro;
  }, [currentDays, destination, accommodationInfo, blendedDna]);

  // Add initial greeting when opened for first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: buildContextualGreeting(),
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, messages.length, buildContextualGreeting]);

  // Max message length to prevent abuse
  const MAX_MESSAGE_LENGTH = 500;

  const handleSend = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isLoading) return;

    // Client-side safety: enforce length limit
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      toast.error('Message too long', {
        description: `Please keep your message under ${MAX_MESSAGE_LENGTH} characters.`,
      });
      return;
    }

    // Chat messages are free — no pre-flight credit check needed.
    // Credits are only charged when the user applies an action (swap, rewrite, etc.).

    // Client-side safety: basic input sanitization
    const sanitizedInput = trimmedInput
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .substring(0, MAX_MESSAGE_LENGTH);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: sanitizedInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build message history for API
      const apiMessages = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));
      apiMessages.push({ role: 'user', content: userMessage.content });

      const response = await sendChatMessage(apiMessages, itineraryContext, conversationId);

      // Chat messages are free — no credit charge for conversation.
      // Credits are only spent when the user clicks "Apply" on an action card.

      // Create assistant message with actions
      const hasActions = response.actions?.length > 0;
      let messageText = response.message?.trim() || '';
      // Strip embedded JSON tool calls that may leak into AI text
      messageText = messageText.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim();
      messageText = messageText.replace(/\{\s*"action"\s*:[\s\S]*?"action_input"\s*:[\s\S]*?\}/g, '').trim();
      messageText = messageText.replace(/\n{3,}/g, '\n\n').trim();
      const isJsonLeak = messageText.startsWith('{') || messageText.startsWith('[');

      const assistantContent = (messageText && !isJsonLeak)
        ? messageText
        : hasActions
          ? "Here's what I'll change:"
          : 'Sorry, something went wrong. Please try again.';

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: assistantContent,
        actions: response.actions?.map(a => ({
          type: a.type as ItineraryAction['type'],
          params: a.params,
          status: 'pending' as const,
        })),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Detect budget intent from the user's message for validation
      const budgetIntent = detectBudgetIntent(response.actions || []);

      // If not in approval mode and there are actions, auto-apply ALL sequentially.
      // EXCEPT: propose_change and record_user_intent are advisory — never auto-applied.
      const NON_AUTO_APPLY = new Set(['propose_change', 'record_user_intent']);
      if (!approvalMode && response.actions?.length > 0) {
        for (let i = 0; i < response.actions.length; i++) {
          const action = response.actions[i];
          if (NON_AUTO_APPLY.has(action.type)) continue;
          await handleActionApply(assistantMessage.id, i, {
            type: action.type as ItineraryAction['type'],
            params: action.params,
            status: 'pending',
          });
        }
      }

      // Show toast ONLY for profile-level preferences (not trip-specific ones)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profilePreferences = (response.capturedPreferences || []).filter(
        (p: any) => p.scope === 'profile'
      );
      if (profilePreferences.length > 0) {
        toast.info('Preference saved to your profile', {
          description: profilePreferences[0].value,
        });
      }

    } catch (error) {
      console.error('[ItineraryAssistant] Error:', error);
      // No credits were charged (charge-on-success pattern), so no refund needed.
      
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: errorMessage.includes('Rate limit') 
          ? "I'm a bit busy right now. Please try again in a moment."
          : errorMessage.includes('Usage limit')
          ? "We've reached our usage limit. Please try again later."
          : "Sorry, I had trouble processing that. Could you try again?",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, itineraryContext, conversationId, approvalMode, spendCredits, tripId]);

  const handleActionApply = async (messageId: string, actionIndex: number, action: ItineraryAction) => {
    const actionId = `${messageId}-${actionIndex}`;
    setIsExecuting(true);
    setExecutingActionId(actionId);
    
    // Show immediate feedback that we're working on it
    toast.loading('Applying changes...', { id: actionId, description: 'This may take a few seconds' });
    
    try {
      // Spend credits for actions that cost credits BEFORE executing
      const creditAction = action.type === 'suggest_activity_swap' ? 'SWAP_ACTIVITY'
        : action.type === 'rewrite_day' ? 'REGENERATE_DAY'
        : action.type === 'regenerate_day' ? 'REGENERATE_DAY'
        : null;

      if (creditAction) {
        console.log(`[ActionExecutor] Spending credits for ${creditAction}`);
        const creditResult = await spendCredits.mutateAsync({
          action: creditAction,
          tripId,
          metadata: {
            source: 'itinerary_assistant',
            target_day: action.params.target_day,
            action_type: action.type,
          },
        });
        console.log('[ActionExecutor] Credit spend result:', creditResult);
        if (!creditResult.success) {
          console.log('[ActionExecutor] Credit spend FAILED — aborting');
          throw new Error('Insufficient credits');
        }
      }

      // Execute the action using the action executor
      const result = await executeAction(action, tripId, currentDays, destination);
      
      // Update action status in message
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId && msg.actions) {
          const newActions = [...msg.actions];
          newActions[actionIndex] = { 
            ...newActions[actionIndex], 
            status: result.success ? 'applied' : 'failed' 
          };
          return { ...msg, actions: newActions };
        }
        return msg;
      }));

      if (result.success) {
        // Sort activities chronologically before updating UI state
        const sortedDays = result.updatedDays?.map(day => ({
          ...day,
          activities: [...day.activities].sort((a, b) => {
            const getMin = (t?: string) => {
              if (!t) return 0;
              const n = t.trim().toUpperCase();
              const m = n.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
              if (!m) return 0;
              let h = parseInt(m[1], 10);
              const min = parseInt(m[2], 10);
              if (m[3] === 'PM' && h !== 12) h += 12;
              if (m[3] === 'AM' && h === 12) h = 0;
              return h * 60 + min;
            };
            return getMin(a.startTime || a.time) - getMin(b.startTime || b.time);
          }),
        }));

        // Update local state with sorted days
        if (sortedDays) {
          setCurrentDays(sortedDays);
          
          // Also update localStorage for local trips
          if (isLocalTrip) {
            updateLocalTripItinerary(tripId, sortedDays);
          }
          
          // Notify parent to update its state
          onItineraryUpdate?.(sortedDays);

          // Explicitly sync budget after chatbot-driven changes
          const daysForSync = sortedDays.map(day => ({
            dayNumber: day.dayNumber,
            date: day.date || '',
            activities: day.activities.map(act => ({
              id: act.id,
              title: act.title || act.name || 'Activity',
              category: String(act.category || act.type || 'activities'),
              cost: act.cost ? (typeof act.cost === 'number'
                ? { amount: act.cost, currency: 'USD' }
                : {
                    amount: act.cost.amount,
                    total: (act.cost as any).total,
                    perPerson: (act.cost as any).perPerson,
                    basis: (act.cost as any).basis,
                    currency: act.cost.currency ?? 'USD',
                  }) : undefined,
            })),
          }));
          // Sync to activity_costs table (single source of truth)
          // Use canonical pricing engine to resolve per-person costs correctly
          import('@/services/activityCostService').then(async ({ syncActivitiesToCostTable, cleanupRemovedActivityCosts }) => {
            const { resolvePerPersonForDb, resolveCategory } = await import('@/lib/trip-pricing');
            const activitiesForCostTable: Array<{
              id: string;
              dayNumber: number;
              category: string;
              costPerPersonUsd: number;
              numTravelers?: number;
              source?: string;
            }> = [];
            const allActivityIds: string[] = [];

            const { isLikelyFreePublicVenue: isFreeVenue } = await import('@/lib/cost-estimation');
            for (const day of sortedDays) {
              for (const act of day.activities) {
                if (act.id) allActivityIds.push(act.id);
                const costPerPerson = resolvePerPersonForDb(act.cost as any, travelers || 1);

                if (costPerPerson >= 0) {
                  // Guard: skip positive rows for free public venues
                  if (costPerPerson > 0 && isFreeVenue({
                    title: act.title || act.name,
                    category: String(act.category || ''),
                    type: String(act.type || ''),
                    venueName: (act as any).venue_name,
                    restaurantName: (act as any).restaurant?.name,
                    placeName: (act as any).place_name,
                    locationName: (act as any).location?.name,
                    description: (act as any).description,
                  })) {
                    console.log(`[ItineraryAssistant] Skipping free venue: "${act.title || act.name}"`);
                    continue;
                  }
                  activitiesForCostTable.push({
                    id: act.id,
                    dayNumber: day.dayNumber,
                    category: resolveCategory(String(act.category || ''), String(act.type || '')),
                    costPerPersonUsd: costPerPerson,
                    numTravelers: travelers || 1,
                    source: 'chat-sync',
                  });
                }
              }
            }

            // Upsert current activities
            if (activitiesForCostTable.length > 0) {
              syncActivitiesToCostTable(tripId, activitiesForCostTable)
                .catch(err => console.error('[ItineraryAssistant] Activity cost sync failed:', err));
            }
            // Remove orphaned cost rows for swapped/removed activities
            if (allActivityIds.length > 0) {
              cleanupRemovedActivityCosts(tripId, allActivityIds)
                .catch(err => console.error('[ItineraryAssistant] Orphan cleanup failed:', err));
            }
            // Notify financial snapshot to refetch
            window.dispatchEvent(new CustomEvent('booking-changed'));
          });
        }

        toast.success('Action applied', {
          id: actionId,
          description: result.message + (result.costDelta != null && result.costDelta !== 0
            ? ` (${result.costDelta > 0 ? '+' : ''}$${result.costDelta.toFixed(0)} cost impact)`
            : ''),
        });

        // Show diff summary in chat
        if (result.diff && result.diff.length > 0) {
          const diffLines = result.diff.map(d => 
            d.type === 'removed' ? `− ${d.activityTitle}${d.costBefore ? ` ($${d.costBefore})` : ''}`
            : `+ ${d.activityTitle}${d.costAfter ? ` ($${d.costAfter})` : ''}`
          ).join('\n');
          const costNote = result.costDelta != null && result.costDelta !== 0
            ? `\n\n💰 Cost impact: ${result.costDelta > 0 ? '+' : ''}$${result.costDelta.toFixed(0)}`
            : '';
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_diff`,
            role: 'assistant',
            content: `**Changes applied:**\n${diffLines}${costNote}`,
            timestamp: new Date(),
          }]);
        }
      } else {
        toast.error('Action failed', {
          id: actionId,
          description: result.message,
        });
      }
    } catch (error) {
      console.error('[ItineraryAssistant] Action execution error:', error);
      
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId && msg.actions) {
          const newActions = [...msg.actions];
          newActions[actionIndex] = { ...newActions[actionIndex], status: 'failed' };
          return { ...msg, actions: newActions };
        }
        return msg;
      }));

      toast.error('Failed to execute action', {
        id: actionId,
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExecuting(false);
      setExecutingActionId(null);
    }
  };

  const handleActionDecline = (messageId: string, actionIndex: number) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.actions) {
        const newActions = [...msg.actions];
        newActions[actionIndex] = { ...newActions[actionIndex], status: 'declined' };
        return { ...msg, actions: newActions };
      }
      return msg;
    }));
  };

  const getActionIcon = (iconType: 'swap' | 'pace' | 'filter' | 'refresh' | 'rewrite') => {
    switch (iconType) {
      case 'swap': return <ArrowLeftRight className="h-4 w-4" />;
      case 'pace': return <Gauge className="h-4 w-4" />;
      case 'filter': return <Filter className="h-4 w-4" />;
      case 'refresh': return <RefreshCw className="h-4 w-4" />;
      case 'rewrite': return <Pencil className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setIsOpen(true)}
            className={cn(
              "fixed bottom-20 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg z-40",
              "bg-primary hover:bg-primary/90 transition-all",
              isOpen && "hidden"
            )}
            size="icon"
            aria-label="Trip Assistant"
            data-tour="chat-bubble"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <span className="text-xs font-medium">Trip Assistant</span>
        </TooltipContent>
      </Tooltip>

      {/* Chat Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:w-[420px] p-0 flex flex-col"
        >
          <SheetHeader className="p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-lg">Trip Assistant</SheetTitle>
                <SheetDescription className="text-xs">
                  Customize your {destination} itinerary
                </SheetDescription>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  💬 Chat is free. Actions cost credits
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Switch
                    id="approval-mode"
                    checked={approvalMode}
                    onCheckedChange={setApprovalMode}
                    className="scale-75"
                  />
                   <Label htmlFor="approval-mode" className="text-muted-foreground cursor-pointer">
                     {approvalMode ? 'Review first' : 'Auto-apply'}
                   </Label>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Action Cards */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.actions.map((action, idx) => {
                          const displayInfo = getActionDisplayInfo(action);
                          const isPending = action.status === 'pending';
                          const isApplied = action.status === 'applied';
                          const isDeclined = action.status === 'declined';
                          const isFailed = action.status === 'failed';
                          const actionId = `${message.id}-${idx}`;
                          const isThisExecuting = executingActionId === actionId;

                          return (
                            <Card 
                              key={idx}
                              className={cn(
                                "transition-all",
                                isApplied && "border-green-500/50 bg-green-500/5",
                                isDeclined && "opacity-50",
                                isFailed && "border-destructive/50 bg-destructive/5",
                                isThisExecuting && "border-primary/50 animate-pulse"
                              )}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "p-2 rounded-lg",
                                    isApplied ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                                  )}>
                                    {isThisExecuting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      getActionIcon(displayInfo.icon)
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{displayInfo.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {isThisExecuting ? 'Applying changes...' : displayInfo.description}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                      <Coins className="h-3 w-3" /> {displayInfo.creditCost} credits
                                    </span>
                                  </div>
                                </div>
                                
                                {isPending && approvalMode && (
                                  <div className="flex gap-2 mt-3">
                                    <Button
                                      size="sm"
                                      onClick={() => handleActionApply(message.id, idx, action)}
                                      className="flex-1 gap-1.5"
                                      disabled={isExecuting}
                                    >
                                      {isThisExecuting ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          Applying...
                                        </>
                                      ) : (
                                        <>
                                          <Check className="h-3.5 w-3.5" />
                                          Apply
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleActionDecline(message.id, idx)}
                                      className="gap-1.5"
                                      disabled={isExecuting}
                                    >
                                      <ThumbsDown className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                                
                                {isApplied && (
                                  <Badge className="mt-2 bg-green-600">Applied</Badge>
                                )}
                                {isDeclined && (
                                  <Badge variant="secondary" className="mt-2">Declined</Badge>
                                )}
                                {isFailed && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="destructive">Failed</Badge>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-xs gap-1"
                                      onClick={() => {
                                        // Reset to pending then retry
                                        setMessages(prev => prev.map(msg => {
                                          if (msg.id === message.id && msg.actions) {
                                            const newActions = [...msg.actions];
                                            newActions[idx] = { ...newActions[idx], status: 'pending' };
                                            return { ...msg, actions: newActions };
                                          }
                                          return msg;
                                        }));
                                        handleActionApply(message.id, idx, { ...action, status: 'pending' });
                                      }}
                                      disabled={isExecuting}
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                      Retry
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-background">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder={isListening ? (interimTranscript || 'Listening...') : 'Ask to swap an activity, adjust pacing...'}
                disabled={isLoading || isExecuting}
                maxLength={MAX_MESSAGE_LENGTH}
                className="flex-1"
              />
              <Button
                type="button"
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={() => {
                  if (!micSupported) {
                    toast.error("Voice input is not supported in this browser. Try Chrome or Edge.");
                    return;
                  }
                  toggleListening();
                }}
                title={isListening ? "Stop listening" : "Voice input"}
                className="relative"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isListening && (
                  <span className="absolute inset-0 rounded-md animate-ping bg-destructive/20 pointer-events-none" />
                )}
              </Button>
              <Button 
                type="submit" 
                size="icon"
                disabled={!inputValue.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              I'll suggest changes you can approve before applying
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default ItineraryAssistant;
