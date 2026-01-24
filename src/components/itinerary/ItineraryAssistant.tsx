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
import { MessageCircle, X, Send, Loader2, ArrowLeftRight, Gauge, Filter, RefreshCw, Check, ThumbsDown, Settings2 } from 'lucide-react';
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
  type ChatMessage,
  type ItineraryAction,
  type ItineraryContext,
} from '@/services/itineraryChatAPI';
import { 
  executeAction, 
  updateLocalTripItinerary,
  type ItineraryDay,
} from '@/services/itineraryActionExecutor';

interface ItineraryAssistantProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: ItineraryDay[];
  isLocalTrip?: boolean;
  onItineraryUpdate?: (updatedDays: ItineraryDay[]) => void;
}

export function ItineraryAssistant({
  tripId,
  destination,
  startDate,
  endDate,
  days,
  isLocalTrip = false,
  onItineraryUpdate,
}: ItineraryAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [approvalMode, setApprovalMode] = useState(true); // Default to approval mode
  const [currentDays, setCurrentDays] = useState<ItineraryDay[]>(days);
  const [conversationId] = useState(generateConversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Add initial greeting when opened for first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hi! I'm here to help you customize your ${destination} itinerary. You can ask me to:\n\n• Swap activities for something different\n• Adjust the pacing of any day\n• Filter for dietary needs or accessibility\n• Find budget-friendly alternatives\n\nWhat would you like to change?`,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, messages.length, destination]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
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

      // Create assistant message with actions
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: response.message || '',
        actions: response.actions?.map(a => ({
          type: a.type as ItineraryAction['type'],
          params: a.params,
          status: 'pending' as const,
        })),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If not in approval mode and there are actions, auto-apply the first one
      if (!approvalMode && response.actions?.length > 0) {
        const action = response.actions[0];
        handleActionApply(assistantMessage.id, 0, {
          type: action.type as ItineraryAction['type'],
          params: action.params,
          status: 'pending',
        });
      }

      // Show toast for captured preferences
      if (response.capturedPreferences?.length > 0) {
        toast.info('Preference noted', {
          description: `Saved: ${response.capturedPreferences[0].value}`,
        });
      }

    } catch (error) {
      console.error('[ItineraryAssistant] Error:', error);
      
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
  }, [inputValue, isLoading, messages, itineraryContext, conversationId, approvalMode]);

  const handleActionApply = async (messageId: string, actionIndex: number, action: ItineraryAction) => {
    setIsExecuting(true);
    
    try {
      // Execute the action using the action executor
      const result = await executeAction(action, tripId, currentDays, destination);
      
      // Update action status in message
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId && msg.actions) {
          const newActions = [...msg.actions];
          newActions[actionIndex] = { 
            ...newActions[actionIndex], 
            status: result.success ? 'applied' : 'declined' 
          };
          return { ...msg, actions: newActions };
        }
        return msg;
      }));

      if (result.success) {
        // Update local state with new days
        if (result.updatedDays) {
          setCurrentDays(result.updatedDays);
          
          // Also update localStorage for local trips
          if (isLocalTrip) {
            updateLocalTripItinerary(tripId, result.updatedDays);
          }
          
          // Notify parent to update its state
          onItineraryUpdate?.(result.updatedDays);
        }

        toast.success('Action applied', {
          description: result.message,
        });
      } else {
        toast.error('Action failed', {
          description: result.message,
        });
      }
    } catch (error) {
      console.error('[ItineraryAssistant] Action execution error:', error);
      
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId && msg.actions) {
          const newActions = [...msg.actions];
          newActions[actionIndex] = { ...newActions[actionIndex], status: 'declined' };
          return { ...msg, actions: newActions };
        }
        return msg;
      }));

      toast.error('Failed to execute action', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExecuting(false);
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

  const getActionIcon = (iconType: 'swap' | 'pace' | 'filter' | 'refresh') => {
    switch (iconType) {
      case 'swap': return <ArrowLeftRight className="h-4 w-4" />;
      case 'pace': return <Gauge className="h-4 w-4" />;
      case 'filter': return <Filter className="h-4 w-4" />;
      case 'refresh': return <RefreshCw className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-primary hover:bg-primary/90 transition-all",
          isOpen && "hidden"
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

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
                    {approvalMode ? 'Approve' : 'Direct'}
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

                          return (
                            <Card 
                              key={idx}
                              className={cn(
                                "transition-all",
                                isApplied && "border-green-500/50 bg-green-500/5",
                                isDeclined && "opacity-50"
                              )}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "p-2 rounded-lg",
                                    isApplied ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                                  )}>
                                    {getActionIcon(displayInfo.icon)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{displayInfo.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {displayInfo.description}
                                    </p>
                                  </div>
                                </div>
                                
                                {isPending && approvalMode && (
                                  <div className="flex gap-2 mt-3">
                                    <Button
                                      size="sm"
                                      onClick={() => handleActionApply(message.id, idx, action)}
                                      className="flex-1 gap-1.5"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Apply
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleActionDecline(message.id, idx)}
                                      className="gap-1.5"
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
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask to swap an activity, adjust pacing..."
                disabled={isLoading}
                className="flex-1"
              />
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
