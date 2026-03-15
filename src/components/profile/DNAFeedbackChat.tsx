/**
 * DNA Feedback Chat Component
 * 
 * An AI-powered mini-chatbot for users to conversationally refine their Travel DNA.
 * Uses the dna-feedback-chat edge function for intelligent responses.
 * Charges 10 credits per message (AI_MESSAGE cost).
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  Bot,
  User,
  X,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { recalculateDNAFromPreferences } from '@/utils/quizMapping';
import { useSpendCredits } from '@/hooks/useSpendCredits';
import { useCredits } from '@/hooks/useCredits';
import { useEntitlements } from '@/hooks/useEntitlements';
import { CREDIT_COSTS } from '@/config/pricing';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DNAFeedbackChatProps {
  userId: string;
  currentArchetype?: string;
  currentTraits?: Record<string, number>;
  onFeedbackApplied?: () => void;
  className?: string;
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  role: 'assistant',
  content: "Hi! I'm here to help refine your Travel DNA. Tell me what feels off about your profile, or what we got wrong. For example: \"I'm actually more adventurous than this suggests\" or \"I prefer solo travel, not groups.\"",
  timestamp: new Date(),
};

const SUGGESTED_PROMPTS = [
  "The pace feels too fast for me",
  "I'm more adventurous than this shows",
  "I actually prefer budget travel",
  "I'm more of a solo traveler",
];

export default function DNAFeedbackChat({
  userId,
  currentArchetype,
  currentTraits = {},
  onFeedbackApplied,
  className,
}: DNAFeedbackChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Credit system hooks
  const { data: creditData } = useCredits();
  const { isPaid } = useEntitlements();
  const spendCredits = useSpendCredits();
  const totalCredits = creditData?.totalCredits ?? 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Pre-flight credit check (don't charge yet — charge on success)
    if (totalCredits < CREDIT_COSTS.AI_MESSAGE) {
      toast.error(`Need ${CREDIT_COSTS.AI_MESSAGE} credits to send a message`);
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build conversation history for the edge function
      const apiMessages = messages
        .filter(m => m.id !== 'initial')
        .map(m => ({ role: m.role, content: m.content }));
      apiMessages.push({ role: 'user' as const, content: userMessage.content });

      // Call the AI edge function
      const { data: response, error } = await supabase.functions.invoke('dna-feedback-chat', {
        body: {
          messages: apiMessages,
          currentArchetype,
          currentTraits,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message || "I've updated your profile based on your feedback.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Charge credits AFTER successful AI response (charge-on-success pattern)
      // No tripId — DNAFeedbackChat is profile-level, free caps don't apply (by design)
      try {
        await spendCredits.mutateAsync({
          action: 'AI_MESSAGE',
          metadata: { source: 'dna_feedback_chat' },
        });
      } catch {
        console.warn('[DNAFeedbackChat] Credit charge failed post-response');
      }

      // If AI suggested trait adjustments, apply them as overrides and recalculate
      if (response.suggestedTraits && Object.keys(response.suggestedTraits).length > 0) {
        // Merge with existing overrides
        const { data: profileData } = await supabase
          .from('profiles')
          .select('travel_dna_overrides')
          .eq('id', userId)
          .maybeSingle();

        const existingOverrides = (profileData?.travel_dna_overrides as Record<string, number>) || {};
        const mergedOverrides = { ...existingOverrides, ...response.suggestedTraits };

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ travel_dna_overrides: mergedOverrides })
          .eq('id', userId);

        if (!updateError) {
          // Trigger full DNA recalculation
          await recalculateDNAFromPreferences(userId);
          
          toast.success('Profile updated!', {
            description: response.explanation || 'Your Travel DNA has been refined.',
          });
          onFeedbackApplied?.();
        }
      }

    } catch (error) {
      console.error('Failed to process feedback:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I had trouble processing that. Could you try rephrasing?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn("gap-2", className)}
      >
        <MessageCircle className="h-4 w-4" />
        Chat to refine your DNA
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={cn(
        "rounded-xl border border-border bg-card shadow-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">Refine Your DNA</h4>
            <p className="text-xs text-muted-foreground">
              AI-powered • {CREDIT_COSTS.AI_MESSAGE} credits/message (after 20 free)
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close feedback chat">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "flex gap-3",
                message.role === 'user' && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === 'assistant' 
                  ? "bg-primary/10" 
                  : "bg-muted"
              )}>
                {message.role === 'assistant' ? (
                  <Bot className="h-4 w-4 text-primary" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                message.role === 'assistant'
                  ? "bg-muted/50 text-foreground"
                  : "bg-primary text-primary-foreground"
              )}>
                {message.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted/50 rounded-xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2">Quick suggestions:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-background">
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tell me what feels wrong..."
            rows={1}
            className="min-h-[40px] max-h-24 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            size="icon" 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export type { DNAFeedbackChatProps };
