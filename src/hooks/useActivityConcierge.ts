import { useState, useRef, useCallback } from 'react';

export interface ConciergeMessage {
  role: 'user' | 'assistant';
  content: string;
  alternatives?: AlternativeSuggestion[];
}

export interface AlternativeSuggestion {
  name: string;
  address: string;
  price_per_person: number;
  reason: string;
  category?: string;
}

interface ActivityContext {
  title: string;
  venue_name: string;
  address: string;
  category: string;
  start_time: string;
  end_time: string;
  date: string;
  day_of_week: string;
  cost_per_person: number;
  description: string;
  booking_required: boolean;
  website?: string;
}

interface TripContext {
  city: string;
  country: string;
  trip_type: string;
  total_days: number;
  num_guests: number;
  start_date: string;
  end_date: string;
  currency: string;
}

interface SurroundingContext {
  previous_activity?: string;
  next_activity?: string;
  day_title: string;
}

const CONCIERGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activity-concierge`;

export function useActivityConcierge() {
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatHistoryRef = useRef<Map<string, ConciergeMessage[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback((activityId: string) => {
    const cached = chatHistoryRef.current.get(activityId);
    setMessages(cached || []);
    return cached && cached.length > 0;
  }, []);

  const clearHistory = useCallback((activityId: string) => {
    chatHistoryRef.current.delete(activityId);
    setMessages([]);
  }, []);

  const streamChat = useCallback(async (
    activityId: string,
    userMessages: ConciergeMessage[],
    activityContext: ActivityContext,
    tripContext: TripContext,
    surroundingContext: SurroundingContext,
  ) => {
    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const apiMessages = userMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch(CONCIERGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          activityContext,
          tripContext,
          surroundingContext,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let toolCallArgs = '';
      let isToolCall = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;

            // Handle tool calls
            if (delta?.tool_calls) {
              isToolCall = true;
              for (const tc of delta.tool_calls) {
                if (tc.function?.arguments) {
                  toolCallArgs += tc.function.arguments;
                }
              }
              continue;
            }

            // Handle text content
            const content = delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantText } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantText }];
              });
            }
          } catch {
            // partial JSON, skip
          }
        }
      }

      // Handle tool call result
      if (isToolCall && toolCallArgs) {
        try {
          const toolResult = JSON.parse(toolCallArgs);
          const alternatives: AlternativeSuggestion[] = toolResult.alternatives || [];
          const introText = toolResult.intro_text || 'Here are some alternatives:';

          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map((m, i) =>
                i === prev.length - 1
                  ? { ...m, content: (m.content ? m.content + '\n\n' : '') + introText, alternatives }
                  : m
              );
            }
            return [...prev, { role: 'assistant', content: introText, alternatives }];
          });
        } catch (e) {
          console.error('Failed to parse tool call args:', e);
        }
      }

      // Save to history
      setMessages(current => {
        chatHistoryRef.current.set(activityId, current);
        return current;
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      console.error('Concierge stream error:', e);
      const errorMsg: ConciergeMessage = {
        role: 'assistant',
        content: `Sorry, I couldn't process that request. ${(e as Error).message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (
    activityId: string,
    content: string,
    activityContext: ActivityContext,
    tripContext: TripContext,
    surroundingContext: SurroundingContext,
  ) => {
    const userMsg: ConciergeMessage = { role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    chatHistoryRef.current.set(activityId, updated);

    await streamChat(activityId, updated, activityContext, tripContext, surroundingContext);
  }, [messages, streamChat]);

  const generateOpeningMessage = useCallback(async (
    activityId: string,
    activityContext: ActivityContext,
    tripContext: TripContext,
    surroundingContext: SurroundingContext,
  ) => {
    const hasHistory = loadHistory(activityId);
    if (hasHistory) return;

    const openingPrompt: ConciergeMessage = {
      role: 'user',
      content: 'Give me a brief insider overview of this venue — what to expect, top tips, and anything I should know for my visit. Keep it concise with bullet points.',
    };

    // Don't show the system-generated user message
    setMessages([]);
    await streamChat(activityId, [openingPrompt], activityContext, tripContext, surroundingContext);
  }, [loadHistory, streamChat]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    generateOpeningMessage,
    loadHistory,
    clearHistory,
    cancel,
  };
}
