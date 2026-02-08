/**
 * TripChatPlanner — Inline chat UI for "Just Tell Us" trip planning mode.
 * Purely conversational — users describe their trip naturally and the AI chats back.
 * When enough details are gathered, the AI extracts them via tool calling.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, User, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
      content: "Hey! ✈️ Where are you thinking of going? Tell me anything - a city, a vibe, a dream trip. We'll figure it out together.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
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

      // Handle tool call result — extract details silently and trigger generation
      if (isToolCall && toolCallArgs) {
        try {
          const details = JSON.parse(toolCallArgs) as TripDetails;

          // If the AI didn't produce a text response alongside the tool call,
          // add a friendly confirmation message
          if (!assistantContent) {
            assistantContent = "Got it! I have everything I need - generating your trip now! 🎉";
            setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
          }

          // Small delay so the user sees the confirmation before redirect
          setTimeout(() => onDetailsExtracted(details), 800);
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
    setInput(prev => prev || '');
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

      {/* Input area — always visible */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell us about your trip..."
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
    </div>
  );
}

export default TripChatPlanner;
