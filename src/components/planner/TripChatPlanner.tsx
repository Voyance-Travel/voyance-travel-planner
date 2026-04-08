/**
 * TripChatPlanner — Inline chat UI for "Just Tell Us" trip planning mode.
 * Purely conversational — users describe their trip naturally and the AI chats back.
 * When enough details are gathered, the AI extracts them via tool calling.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, User, ClipboardPaste, Mic, MicOff, AlertCircle } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeAIOutput } from '@/utils/textSanitizer';
import { TripConfirmCard, type InterCityTransportMode } from './TripConfirmCard';
import { resolveCities, type NormalizedCity } from '@/utils/cityNormalization';
import { normalizeChatTripDates } from '@/utils/justTellUsDateGuard';
import { parseLocalDate } from '@/utils/dateUtils';
import { useCredits } from '@/hooks/useCredits';

export interface ChatTripCity {
  name: string;
  country?: string;
  nights: number;
}

export interface TripDetails {
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  tripType?: string;
  budgetAmount?: number;
  hotelName?: string;
  hotelAddress?: string;
  arrivalAirport?: string;
  arrivalTime?: string;
  departureAirport?: string;
  departureTime?: string;
  mustDoActivities?: string;
  additionalNotes?: string;
  flightDetails?: string;
  userConstraints?: Array<{
    type: 'full_day_event' | 'time_block' | 'avoid' | 'preference' | 'flight';
    description: string;
    day?: number;
    time?: string;
    allDay?: boolean;
  }>;
  cities?: ChatTripCity[];
  /** Inter-city transport modes for each leg (length = cities.length - 1) */
  cityTransports?: InterCityTransportMode[];
  /** Trip pacing inferred from conversation */
  pacing?: 'relaxed' | 'balanced' | 'packed';
  /** Whether this is the user's first visit to the destination */
  isFirstTimeVisitor?: boolean;
  /** Interest categories inferred from conversation */
  interestCategories?: string[];
  /** Day number of a special celebration (birthday, anniversary, etc.) */
  celebrationDay?: number;
  /** Per-day activity structure for preserving user's day-by-day plans */
  perDayActivities?: Array<{ dayNumber: number; activities: string }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TripChatPlannerProps {
  onDetailsExtracted: (details: TripDetails) => void;
  className?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-trip-planner`;

/**
 * Normalize multi-city details using the shared utility.
 * This ensures the same logic is used for both the confirm card display
 * and the persistence layer in Start.tsx.
 */
function normalizeMultiCity(details: TripDetails): TripDetails {
  if (!details.startDate || !details.endDate) return details;
  const start = parseLocalDate(details.startDate);
  const end = parseLocalDate(details.endDate);
  const resolved = resolveCities(details, start, end);
  if (resolved.length > 1) {
    details.cities = resolved;
    // Ensure destination reflects all cities
    const destSummary = resolved.map(c => c.name).join(', ');
    if (!details.destination || !details.destination.includes(',')) {
      details.destination = destSummary;
    }
  }
  return details;
}

const CHAT_SESSION_KEY = 'voyance_chat_messages';

export function TripChatPlanner({ onDetailsExtracted, className }: TripChatPlannerProps) {
  const { data: creditData } = useCredits();
  const hasNoCredits = creditData && creditData.totalCredits === 0;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (parsed.length > 1) return parsed;
      }
    } catch {}
    return [
      {
        role: 'assistant',
        content: "Hey! ✈️ Where are you thinking of going? Tell me anything - a city, a vibe, a dream trip. We'll figure it out together.",
      },
    ];
  });
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractedDetails, setExtractedDetails] = useState<TripDetails | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cityTransports, setCityTransports] = useState<InterCityTransportMode[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevExtractedRef = useRef<TripDetails | null>(null);

  // Persist chat messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const { isListening, isSupported: micSupported, toggleListening, interimTranscript } = useSpeechRecognition({
    onResult: (transcript) => {
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    let assistantContent = '';
    let toolCallArgs = '';
    let isToolCall = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to use the trip planner.');
      }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const choice = parsed.choices?.[0];

            // Check for tool calls
            if (choice?.delta?.tool_calls) {
              isToolCall = true;
              for (const tc of choice.delta.tool_calls) {
                if (tc.function?.arguments) {
                  toolCallArgs += tc.function.arguments;
                }
              }
            }

            // Regular content
            const content = choice?.delta?.content;
            if (content) {
              assistantContent += content;

              // Fallback: detect tool-call emitted as plain text instead of structured tool_calls
              const toolCallTextMatch = assistantContent.match(/\{\s*"action"\s*:\s*"extract_trip_details"\s*,\s*"action_input"\s*:\s*"([\s\S]*)"\s*\}\s*$/);
              if (toolCallTextMatch) {
                // Strip the leaked JSON from visible text
                const visibleText = assistantContent.slice(0, assistantContent.indexOf(toolCallTextMatch[0])).trim();
                assistantContent = visibleText;
                // Parse the action_input (it's a JSON string that was escaped)
                try {
                  const unescaped = toolCallTextMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
                  toolCallArgs = unescaped;
                  isToolCall = true;
                  console.warn('[TripChatPlanner] Intercepted tool call emitted as plain text');
                } catch (e) {
                  console.error('[TripChatPlanner] Failed to parse leaked tool call:', e);
                }
              }

              const sanitized = sanitizeAIOutput(assistantContent);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > updatedMessages.length) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: sanitized } : m
                  );
                }
                return [...prev, { role: 'assistant', content: sanitized }];
              });
            }
          } catch {
            // Partial JSON, continue
          }
        }
      }

      // Handle tool call result — extract details and trigger generation
      if (isToolCall && toolCallArgs) {
        try {
          let details = JSON.parse(toolCallArgs) as TripDetails;

          // Merge with previous extraction so "Fix something" corrections don't lose unchanged fields
          const prev = prevExtractedRef.current;
          if (prev) {
            details = { ...prev, ...details, ...(details.cities ? { cities: details.cities } : {}), ...(details.interestCategories ? { interestCategories: details.interestCategories } : {}) };
            prevExtractedRef.current = null;
          }

          // Hard date guard: force dates to 2026+ and never in the past
          if (details.startDate && details.endDate) {
            const normalized = normalizeChatTripDates(details.startDate, details.endDate);
            if (normalized.startDate !== details.startDate || normalized.endDate !== details.endDate) {
              console.warn('[TripChatPlanner] Date guard shifted AI dates:', {
                original: { start: details.startDate, end: details.endDate },
                guarded: normalized,
              });
            }
            details.startDate = normalized.startDate;
            details.endDate = normalized.endDate;
          }

          // Date echo-back validation: check if AI-extracted dates seem plausible
          // by scanning conversation for date-like mentions and comparing durations
          if (details.startDate && details.endDate) {
            const extractedStart = parseLocalDate(details.startDate);
            const extractedEnd = parseLocalDate(details.endDate);
            const extractedDays = Math.round((extractedEnd.getTime() - extractedStart.getTime()) / 86_400_000) + 1;

            // Scan user messages for duration mentions (e.g., "5 nights", "7 days", "a week")
            const userText = messages
              .filter(m => m.role === 'user')
              .map(m => m.content)
              .join(' ')
              .toLowerCase();

            let mentionedDuration: number | null = null;
            const nightsMatch = userText.match(/(\d+)\s*nights?/);
            const daysMatch = userText.match(/(\d+)\s*days?/);
            const weekMatch = userText.match(/(\d+)\s*weeks?|a\s+week/);

            if (nightsMatch) {
              mentionedDuration = parseInt(nightsMatch[1], 10) + 1; // nights → days (inclusive)
            } else if (daysMatch) {
              mentionedDuration = parseInt(daysMatch[1], 10);
            } else if (weekMatch) {
              const weeks = weekMatch[1] ? parseInt(weekMatch[1], 10) : 1;
              mentionedDuration = weeks * 7 + 1;
            }

            if (mentionedDuration !== null && Math.abs(extractedDays - mentionedDuration) >= 2) {
              console.warn('[TripChatPlanner] Duration mismatch — AI extracted', extractedDays,
                'days but user mentioned ~', mentionedDuration, 'days');
              toast.info(
                `I understood ${details.startDate} to ${details.endDate} (${extractedDays - 1} nights). You can adjust dates on the next screen if needed.`,
                { duration: 6000 }
              );
            }
          }

          // Safety net: if AI didn't populate cities[] but destination has multiple cities,
          // try to extract from the conversation history as well
          if ((!details.cities || details.cities.length <= 1) && details.destination) {
            // Check if destination contains separators hinting at multi-city
            const multiCityHint = /[,&]|\band\b|\bthen\b|→|->/.test(details.destination);
            if (multiCityHint) {
              console.warn('[TripChatPlanner] AI returned destination with multi-city hint but empty cities[]. Relying on resolveCities fallback.');
            }
          }

          // Normalize multi-city using shared utility (single source of truth)
          details = normalizeMultiCity(details);

          // Validate required fields before triggering generation
          const hasDest = !!details.destination?.trim();
          const hasDates = !!details.startDate && !!details.endDate;
          const hasTravelers = !!details.travelers;

          if (!hasDest || !hasDates || !hasTravelers) {
            const missing: string[] = [];
            if (!hasDest) missing.push('destination');
            if (!hasDates) missing.push('travel dates');
            if (!hasTravelers) missing.push('number of travelers');

            const followUp = `I still need your ${missing.join(' and ')} to build your trip. What are you thinking?`;
            setMessages(prev => {
              const filtered = prev.filter(m => 
                !(m.role === 'assistant' && m.content.includes('generating'))
              );
              return [...filtered, { role: 'assistant', content: followUp }];
            });
          } else {
            // All required fields present — show summary for confirmation
            if (!assistantContent) {
              const cityList = details.cities && details.cities.length > 1
                ? details.cities.map(c => `${c.name} (${c.nights} nights)`).join(' → ')
                : details.destination;
              assistantContent = `Here's what I've captured for your trip to **${cityList}** - review and confirm when you're ready! 🎉`;
              setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
            }
            setExtractedDetails(details);
            // Initialize transport defaults (one per city gap)
            if (details.cities && details.cities.length > 1) {
              setCityTransports(new Array(details.cities.length - 1).fill('flight'));
            }
          }
        } catch (e) {
          console.error('Failed to parse tool call args:', e);
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong. ${err.message || 'Please try again.'}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(prev => prev ? `${prev}\n${text}` : text);
        textareaRef.current?.focus();
      }
    } catch {
      // Fallback: just focus so user can Ctrl+V
      textareaRef.current?.focus();
    }
  };

  return (
    <div className={cn('flex flex-col max-w-md mx-auto', className)}>
      {/* Chat container — looks like a proper chat window */}
      <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: 'min(420px, calc(100vh - 200px))' }}>
        {/* Chat header */}
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Voyance Travel AI</p>
            <p className="text-[10px] text-muted-foreground">Describe your trip or paste your research</p>
          </div>
        </div>

        {/* Credit warning */}
        {hasNoCredits && (
          <div className="px-3 py-1.5 bg-destructive/10 border-b border-destructive/20 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
            <p className="text-[10px] text-destructive">You have 0 credits. You'll need credits to generate your itinerary.</p>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-1.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {extractedDetails && (
            <TripConfirmCard
              details={extractedDetails}
              isGenerating={isGenerating}
              transports={cityTransports}
              onTransportChange={(index, mode) => {
                setCityTransports(prev => {
                  const next = [...prev];
                  next[index] = mode;
                  return next;
                });
              }}
              onConfirm={() => {
                setIsGenerating(true);
                onDetailsExtracted({ ...extractedDetails, cityTransports });
              }}
              onEdit={() => {
                prevExtractedRef.current = extractedDetails;
                setExtractedDetails(null);
                setCityTransports([]);
                setMessages(prev => [
                  ...prev,
                  { role: 'assistant', content: "No problem - what would you like to change?" },
                ]);
              }}
            />
          )}

          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area — pinned to bottom of chat box */}
        <div className="border-t border-border p-2 bg-background">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? (interimTranscript || 'Listening...') : 'Tell us about your trip...'}
              className="min-h-[44px] max-h-[80px] resize-none pr-16 text-sm border-0 bg-muted/50 focus-visible:ring-1"
              disabled={isStreaming}
            />
            <div className="absolute right-1.5 bottom-1.5 flex items-center gap-1.5 sm:gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn("h-9 w-9 sm:h-7 sm:w-7 relative", isListening && "text-destructive")}
                onClick={() => {
                  if (!micSupported) {
                    toast.error("Voice input is not supported in this browser. Try Chrome or Edge.");
                    return;
                  }
                  toggleListening();
                }}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isListening && (
                  <span className="absolute inset-0 rounded-md animate-ping bg-destructive/20 pointer-events-none" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 sm:h-7 sm:w-7"
                onClick={handlePaste}
                title="Paste your research"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 sm:h-7 sm:w-7"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TripChatPlanner;
