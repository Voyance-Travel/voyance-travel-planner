/**
 * TripChat — Real-time chat for trip collaborators and shared trip viewers.
 * Supports both authenticated users (consumer/agency trips) and
 * anonymous users (via share token on agency trips).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { registerSubscription, unregisterSubscription } from '@/lib/realtimeSubscriptionManager';
import { Send, MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  display_name: string;
  avatar_url: string | null;
  message: string;
  user_id: string | null;
  created_at: string;
}

interface TripChatProps {
  tripId: string;
  tripType: 'consumer' | 'agency';
  /** Required for anonymous posting on shared agency trips */
  shareToken?: string;
  className?: string;
}

const ANON_NAME_KEY = 'voyance_chat_name';

export default function TripChat({ tripId, tripType, shareToken, className }: TripChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [anonName, setAnonName] = useState(() => {
    try { return sessionStorage.getItem(ANON_NAME_KEY) || ''; } catch { return ''; }
  });
  const [showNameInput, setShowNameInput] = useState(!user && !anonName);
  const scrollRef = useRef<HTMLDivElement>(null);
  const justSentRef = useRef(false);

  const isAnon = !user;
  const displayName = user
    ? (user.name || user.email?.split('@')[0] || 'Traveler')
    : anonName;

  // Load existing messages
  useEffect(() => {
    loadMessages();
  }, [tripId]);

  // Subscribe to realtime updates via the subscription manager
  useEffect(() => {
    const key = `trip-chat-${tripId}`;
    registerSubscription(key, () =>
      supabase
        .channel(key)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'trip_chat_messages',
            filter: `trip_id=eq.${tripId}`,
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        )
        .subscribe()
    );

    return () => {
      unregisterSubscription(key);
    };
  }, [tripId]);

  // Auto-scroll to bottom only when user just sent or is near bottom
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;
    const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 150;
    if (justSentRef.current || isNearBottom) {
      viewport.scrollTop = viewport.scrollHeight;
      justSentRef.current = false;
    }
  }, [messages]);

  const loadMessages = async () => {
    // For authenticated users, use direct query
    // For anon, the SELECT policy allows reading if share_enabled
    const { data, error } = await supabase
      .from('trip_chat_messages')
      .select('id, display_name, avatar_url, message, user_id, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!error && data) {
      setMessages(data as ChatMessage[]);
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;
    if (isAnon && !anonName.trim()) {
      setShowNameInput(true);
      return;
    }

    setSending(true);
    try {
      // Optimistic update: show message immediately
      const optimisticMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        display_name: isAnon ? anonName.trim() : displayName,
        avatar_url: null,
        message: trimmed,
        user_id: user?.id ?? null,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimisticMsg]);
      setNewMessage('');

      if (isAnon && shareToken) {
        // Anonymous: use edge function
        const { error } = await supabase.functions.invoke('trip-chat', {
          body: {
            tripId,
            shareToken,
            displayName: anonName.trim(),
            message: trimmed,
          },
        });
        if (error) throw error;
      } else if (user) {
        // Authenticated: direct insert
        const { data: inserted, error } = await supabase
          .from('trip_chat_messages')
          .insert({
            trip_id: tripId,
            trip_type: tripType,
            user_id: user.id,
            display_name: displayName,
            message: trimmed,
          })
          .select('id')
          .single();
        if (error) throw error;
        // Replace optimistic ID with real ID
        if (inserted) {
          setMessages(prev => prev.map(m =>
            m.id === optimisticMsg.id ? { ...m, id: inserted.id } : m
          ));
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, isAnon, anonName, shareToken, tripId, tripType, user, displayName]);

  const handleSetName = () => {
    if (!anonName.trim()) return;
    try { sessionStorage.setItem(ANON_NAME_KEY, anonName.trim()); } catch {}
    setShowNameInput(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Name input for anonymous users
  if (showNameInput) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <MessageCircle className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-1">Join the conversation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your name to start chatting about this trip.
        </p>
        <div className="flex gap-2 w-full max-w-xs">
          <Input
            placeholder="Your name"
            value={anonName}
            onChange={(e) => setAnonName(e.target.value)}
            maxLength={50}
            onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
          />
          <Button onClick={handleSetName} disabled={!anonName.trim()}>
            Join
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs">Start the conversation about this trip!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isOwn = user?.id === msg.user_id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2.5",
                    isOwn ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className={cn(
                      "text-xs",
                      isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {msg.user_id ? getInitials(msg.display_name) : <User className="h-3.5 w-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("max-w-[75%]", isOwn ? "items-end" : "items-start")}>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-medium">{msg.display_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted rounded-tl-sm"
                      )}
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            maxLength={2000}
            disabled={sending}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
