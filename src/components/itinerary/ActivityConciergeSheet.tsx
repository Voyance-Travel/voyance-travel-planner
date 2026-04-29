import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Send, MapPin, DollarSign, Bookmark } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useActivityConcierge, type ConciergeMessage, type AlternativeSuggestion } from '@/hooks/useActivityConcierge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface AISavedNote {
  id: string;
  content: string;
  savedAt: string;
  query?: string;
}

interface ActivityConciergeSheetProps {
  open: boolean;
  onClose: () => void;
  activity: {
    id: string;
    title?: string;
    name?: string;
    description?: string;
    category?: string;
    type?: string;
    startTime?: string;
    start_time?: string;
    endTime?: string;
    end_time?: string;
    time?: string;
    duration?: string | number;
    cost?: number | { amount: number; currency?: string };
    price?: number;
    location?: { name?: string; address?: string } | string;
    venue_name?: string;
    imageUrl?: string;
    image_url?: string;
    bookingRequired?: boolean;
    booking_required?: boolean;
    bookingUrl?: string;
    booking_url?: string;
  };
  dayDate: string;
  dayTitle?: string;
  previousActivity?: string;
  nextActivity?: string;
  destination: string;
  tripType?: string;
  totalDays?: number;
  travelers?: number;
  currency?: string;
  hotelName?: string;
  onActivitySwap?: (activityId: string, newActivity: Record<string, unknown>) => void;
  onSaveNote?: (activityId: string, note: AISavedNote) => void;
  savedNoteContents?: Set<string>;
}

const CHIPS_BY_CATEGORY: Record<string, string[]> = {
  dining: ["What should I order?", "Do I need a reservation?", "What's the dress code?", "Suggest an alternative"],
  restaurant: ["What should I order?", "Do I need a reservation?", "What's the dress code?", "Suggest an alternative"],
  explore: ["What should I not miss?", "How do I skip the line?", "What's nearby after?", "Suggest an alternative"],
  cultural: ["What should I not miss?", "How do I skip the line?", "What's nearby after?", "Suggest an alternative"],
  sightseeing: ["What should I not miss?", "How do I skip the line?", "What's nearby after?", "Suggest an alternative"],
  stay: ["Any insider tips?", "What's near the hotel?", "Best room to request?", "Suggest an alternative"],
  accommodation: ["Any insider tips?", "What's near the hotel?", "Best room to request?", "Suggest an alternative"],
  activity: ["What's the vibe like?", "Do I need a reservation?", "What should I bring?", "Suggest an alternative"],
  wellness: ["What should I order?", "What's the vibe like?", "Do I need a reservation?", "Suggest an alternative"],
  relaxation: ["What should I order?", "What's the vibe like?", "Do I need a reservation?", "Suggest an alternative"],
  shopping: ["What's worth buying?", "Best time to visit?", "Any bargaining tips?", "Suggest an alternative"],
};

const DEFAULT_CHIPS = ["Tell me more", "Any tips?", "What's nearby?", "Suggest an alternative"];

function getDayOfWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return '';
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function ActivityConciergeSheet({
  open,
  onClose,
  activity,
  dayDate,
  dayTitle,
  previousActivity,
  nextActivity,
  destination,
  tripType = 'Explorer',
  totalDays = 1,
  travelers = 1,
  currency = 'USD',
  onActivitySwap,
  onSaveNote,
  savedNoteContents,
}: ActivityConciergeSheetProps) {
  const isMobile = useIsMobile();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openedRef = useRef(false);

  const {
    messages,
    isLoading,
    sendMessage,
    generateOpeningMessage,
    clearHistory,
    cancel,
  } = useActivityConcierge();

  // Derived activity fields
  const actTitle = activity.title || activity.name || 'Activity';
  const venueName = activity.venue_name ||
    (typeof activity.location === 'object' ? activity.location?.name : '') || actTitle;
  const address = (typeof activity.location === 'object' ? activity.location?.address : activity.location as string) || '';
  const category = (activity.category || activity.type || 'activity').toLowerCase();
  const startTime = activity.startTime || activity.start_time || activity.time || '';
  const endTime = activity.endTime || activity.end_time || '';
  const rawCost = activity.cost;
  const cost: number = typeof rawCost === 'object' && rawCost !== null ? (rawCost as { amount: number }).amount : (rawCost as number ?? activity.price ?? 0);
  const imageUrl = activity.imageUrl || activity.image_url || ((activity as any).photos?.[0]?.url ?? (activity as any).photos?.[0]);

  const chips = CHIPS_BY_CATEGORY[category] || DEFAULT_CHIPS;

  // Build contexts for the AI
  const activityContext = {
    title: actTitle,
    venue_name: venueName,
    address,
    category,
    start_time: startTime,
    end_time: endTime,
    date: formatDate(dayDate),
    day_of_week: getDayOfWeek(dayDate),
    cost_per_person: cost,
    description: activity.description || '',
    booking_required: activity.bookingRequired || activity.booking_required || false,
    website: activity.bookingUrl || activity.booking_url,
  };

  const tripContext = {
    city: destination,
    country: '',
    trip_type: tripType,
    total_days: totalDays,
    num_guests: travelers,
    start_date: '',
    end_date: '',
    currency,
  };

  const surroundingContext = {
    previous_activity: previousActivity,
    next_activity: nextActivity,
    day_title: dayTitle || '',
  };

  // Auto-generate opening message on first open
  useEffect(() => {
    if (open && !openedRef.current) {
      openedRef.current = true;
      generateOpeningMessage(activity.id, activityContext, tripContext, surroundingContext);
    }
    if (!open) {
      openedRef.current = false;
      cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(activity.id, text, activityContext, tripContext, surroundingContext);
  };

  const handleChip = async (chip: string) => {
    if (isLoading) return;
    setInput('');
    await sendMessage(activity.id, chip, activityContext, tripContext, surroundingContext);
  };

  const handleSwap = (alt: AlternativeSuggestion) => {
    if (!onActivitySwap) return;
    const newActivity = {
      name: alt.name,
      title: alt.name,
      venue_name: alt.name,
      location: { name: alt.name, address: alt.address },
      address: alt.address,
      cost: alt.price_per_person,
      price: alt.price_per_person,
      category: alt.category || category,
      description: alt.reason,
    };

    // Save for undo
    const prevActivity = { ...activity };

    onActivitySwap(activity.id, newActivity);
    clearHistory(activity.id);
    onClose();

    toast('Activity swapped!', {
      description: `Changed to ${alt.name}`,
      action: {
        label: 'Undo',
        onClick: () => {
          onActivitySwap(activity.id, prevActivity as Record<string, unknown>);
        },
      },
      duration: 10000,
    });
  };

  const handleSaveNote = useCallback((msgIndex: number) => {
    if (!onSaveNote) return;
    const msg = messages[msgIndex];
    if (!msg || msg.role !== 'assistant') return;

    // Find the preceding user message as context
    let query: string | undefined;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        query = messages[i].content;
        break;
      }
    }

    const note: AISavedNote = {
      id: crypto.randomUUID(),
      content: msg.content,
      savedAt: new Date().toISOString(),
      query,
    };

    onSaveNote(activity.id, note);
    toast('Note saved to card', { duration: 2000, className: 'companion-toast' });
  }, [onSaveNote, messages, activity.id]);

  const isNoteSaved = useCallback((content: string) => {
    return savedNoteContents?.has(content) ?? false;
  }, [savedNoteContents]);

  const sheetSide = isMobile ? 'bottom' as const : 'right' as const;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}
        side={sheetSide}
        className={cn(
          'flex flex-col p-0 gap-0',
          isMobile ? 'h-[85vh] rounded-t-2xl' : 'w-[420px] sm:max-w-[420px]'
        )}
      >
        <SheetTitle className="sr-only">{actTitle} - AI Concierge</SheetTitle>
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-border bg-muted/30">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={actTitle}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm leading-tight truncate">
              {actTitle}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(dayDate)} · {startTime}
            </p>
            {address && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {address}
              </p>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {messages.length === 0 && isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 animate-pulse text-primary" />
                <span>Getting insider tips...</span>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[90%] rounded-xl px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ul]:ml-4">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {onSaveNote && (
                        <div className="flex justify-end mt-1">
                          <button
                            onClick={() => handleSaveNote(i)}
                            disabled={isNoteSaved(msg.content)}
                            className={cn(
                              'p-1 rounded transition-colors',
                              isNoteSaved(msg.content)
                                ? 'text-primary cursor-default'
                                : 'text-muted-foreground hover:text-primary'
                            )}
                            title={isNoteSaved(msg.content) ? 'Saved' : 'Save note to card'}
                          >
                            <Bookmark className={cn('w-3.5 h-3.5', isNoteSaved(msg.content) && 'fill-current')} />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p>{msg.content}</p>
                  )}

                  {/* Alternative suggestions */}
                  {msg.alternatives && msg.alternatives.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.alternatives.map((alt, j) => (
                        <div
                          key={j}
                          className="bg-background border border-border rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm">{alt.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{alt.reason}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs flex items-center gap-0.5 text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  {alt.address}
                                </span>
                                <span className="text-xs flex items-center gap-0.5 text-primary font-medium">
                                  <DollarSign className="w-3 h-3" />
                                  {alt.price_per_person} {currency}
                                </span>
                              </div>
                            </div>
                            {onActivitySwap && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 flex-shrink-0"
                                onClick={() => handleSwap(alt)}
                              >
                                Swap
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 animate-pulse text-primary" />
                <span>Thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick chips */}
        {messages.length <= 1 && !isLoading && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Badge
                key={chip}
                variant="outline"
                className="cursor-pointer hover:bg-secondary transition-colors text-xs py-1 px-2.5"
                onClick={() => handleChip(chip)}
              >
                {chip}
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border bg-background">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about this activity..."
              className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
