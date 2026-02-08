/**
 * TripChatPlanner — Inline chat UI for "Just Tell Us" trip planning mode.
 * Users describe their trip naturally or paste research, and the AI extracts structured details.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, User, ClipboardPaste, CheckCircle2, MapPin, Calendar as CalendarIcon, Users, DollarSign, Hotel, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface TripDetails {
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  tripType?: string;
  budgetAmount?: number;
  hotelName?: string;
  hotelAddress?: string;
  mustDoActivities?: string;
  additionalNotes?: string;
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

export function TripChatPlanner({ onDetailsExtracted, className }: TripChatPlannerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Welcome to Voyance! ✈️ Tell us about the trip you're planning — where you're headed, when, who's going, what kind of trip it is. Share as much or as little as you'd like.\n\nYou can also paste in your research or notes and we'll take it from there.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractedDetails, setExtractedDetails] = useState<TripDetails | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > updatedMessages.length) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            // Partial JSON, continue
          }
        }
      }

      // Handle tool call result
      if (isToolCall && toolCallArgs) {
        try {
          const details = JSON.parse(toolCallArgs) as TripDetails;
          setExtractedDetails(details);

          // Add a confirmation message if no assistant content was generated
          if (!assistantContent) {
            const confirmMsg = buildConfirmationMessage(details);
            setMessages(prev => [...prev, { role: 'assistant', content: confirmMsg }]);
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

  const handlePaste = () => {
    textareaRef.current?.focus();
    setInput(prev => prev || ''); // Focus the textarea so they can paste
  };

  return (
    <div className={cn('flex flex-col max-w-md mx-auto', className)}>
      {/* Chat messages */}
      <div className="flex-1 space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
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
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Extracted details summary */}
      {extractedDetails && (
        <TripDetailsSummary
          details={extractedDetails}
          onConfirm={() => onDetailsExtracted(extractedDetails)}
          onEdit={() => {
            setExtractedDetails(null);
            sendMessage("I'd like to make some changes to the details.");
          }}
        />
      )}

      {/* Input area */}
      {!extractedDetails && (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell us about your trip, or paste in your research..."
            className="min-h-[60px] max-h-[120px] resize-none pr-20 text-sm"
            disabled={isStreaming}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handlePaste}
              title="Paste your research"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="h-7 w-7"
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
      )}
    </div>
  );
}

function buildConfirmationMessage(details: TripDetails): string {
  const parts: string[] = ["Here's what I've gathered:"];
  if (details.destination) parts.push(`📍 **Destination:** ${details.destination}`);
  if (details.startDate && details.endDate) parts.push(`📅 **Dates:** ${details.startDate} → ${details.endDate}`);
  else if (details.startDate) parts.push(`📅 **Start:** ${details.startDate}`);
  if (details.travelers) parts.push(`👥 **Travelers:** ${details.travelers}`);
  if (details.tripType) parts.push(`✨ **Trip type:** ${details.tripType.replace(/_/g, ' ')}`);
  if (details.budgetAmount) parts.push(`💰 **Budget:** $${details.budgetAmount.toLocaleString()}`);
  if (details.hotelName) parts.push(`🏨 **Hotel:** ${details.hotelName}`);
  if (details.mustDoActivities) parts.push(`⭐ **Must-dos:** ${details.mustDoActivities}`);
  parts.push('\nLook good? Hit **Generate Trip** below to get started, or tell me if you want to change anything.');
  return parts.join('\n');
}

function TripDetailsSummary({
  details,
  onConfirm,
  onEdit,
}: {
  details: TripDetails;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const items = [
    { icon: MapPin, label: 'Destination', value: details.destination },
    { icon: CalendarIcon, label: 'Dates', value: details.startDate && details.endDate ? `${details.startDate} → ${details.endDate}` : details.startDate },
    { icon: Users, label: 'Travelers', value: details.travelers?.toString() },
    { icon: Sparkles, label: 'Trip type', value: details.tripType?.replace(/_/g, ' ') },
    { icon: DollarSign, label: 'Budget', value: details.budgetAmount ? `$${details.budgetAmount.toLocaleString()}` : undefined },
    { icon: Hotel, label: 'Hotel', value: details.hotelName },
  ].filter(item => item.value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-primary/20 rounded-xl bg-primary/5 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Trip Details</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-1.5 text-xs">
            <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground">{label}</span>
              <p className="font-medium text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {details.mustDoActivities && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Must-dos:</span> {details.mustDoActivities}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={onConfirm} className="flex-1 gap-2" size="sm">
          <Sparkles className="h-3.5 w-3.5" />
          Generate Trip
        </Button>
        <Button variant="outline" onClick={onEdit} size="sm" className="gap-1.5">
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </div>
    </motion.div>
  );
}

export default TripChatPlanner;
