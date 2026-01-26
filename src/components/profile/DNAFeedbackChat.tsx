/**
 * DNA Feedback Chat Component
 * 
 * A mini-chatbot for users to conversationally refine their Travel DNA
 * by explaining what feels off in their profile.
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

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
      // Log the feedback event
      await supabase.from('voyance_events').insert({
        user_id: userId,
        event_name: 'dna_chat_feedback',
        properties: {
          message: userMessage.content,
          current_archetype: currentArchetype,
          current_traits: currentTraits,
          timestamp: new Date().toISOString(),
        },
      });

      // Generate a helpful response based on the input
      const response = generateResponse(userMessage.content, currentTraits);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If we detected trait adjustments, apply them
      if (response.suggestedTraits && Object.keys(response.suggestedTraits).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            travel_dna_overrides: {
              ...currentTraits,
              ...response.suggestedTraits,
            }
          })
          .eq('id', userId);

        if (!error) {
          toast.success('Trait adjustments applied!', {
            description: 'Your profile has been updated.',
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
            <p className="text-xs text-muted-foreground">Tell us what feels off</p>
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

// Simple pattern-based response generator
function generateResponse(
  input: string, 
  currentTraits: Record<string, number>
): { message: string; suggestedTraits?: Record<string, number> } {
  const lowerInput = input.toLowerCase();
  const suggestedTraits: Record<string, number> = {};

  // Pace adjustments
  if (lowerInput.includes('too fast') || lowerInput.includes('slower') || lowerInput.includes('relaxed pace')) {
    suggestedTraits.pace = Math.max((currentTraits.pace ?? 0) - 4, -10);
    return {
      message: `Got it! I've adjusted your pace preference to be more relaxed (${suggestedTraits.pace > 0 ? '+' : ''}${suggestedTraits.pace}). Your future itineraries will include more downtime and fewer rushed activities.`,
      suggestedTraits,
    };
  }

  if (lowerInput.includes('too slow') || lowerInput.includes('faster') || lowerInput.includes('more activities')) {
    suggestedTraits.pace = Math.min((currentTraits.pace ?? 0) + 4, 10);
    return {
      message: `Understood! I've increased your pace preference (${suggestedTraits.pace > 0 ? '+' : ''}${suggestedTraits.pace}). Expect more packed itineraries with exciting activities throughout the day.`,
      suggestedTraits,
    };
  }

  // Adventure adjustments
  if (lowerInput.includes('more adventurous') || lowerInput.includes('thrill') || lowerInput.includes('adrenaline')) {
    suggestedTraits.adventure = Math.min((currentTraits.adventure ?? 0) + 4, 10);
    return {
      message: `Adventure mode activated! I've boosted your adventure score to ${suggestedTraits.adventure > 0 ? '+' : ''}${suggestedTraits.adventure}. Get ready for more thrilling experiences in your trips!`,
      suggestedTraits,
    };
  }

  if (lowerInput.includes('less adventurous') || lowerInput.includes('too risky') || lowerInput.includes('safer')) {
    suggestedTraits.adventure = Math.max((currentTraits.adventure ?? 0) - 4, -10);
    return {
      message: `No problem! I've adjusted for a more comfortable adventure level (${suggestedTraits.adventure > 0 ? '+' : ''}${suggestedTraits.adventure}). Your itineraries will focus on enjoyable experiences without the extreme activities.`,
      suggestedTraits,
    };
  }

  // Budget adjustments
  if (lowerInput.includes('budget') || lowerInput.includes('frugal') || lowerInput.includes('save money') || lowerInput.includes('cheaper')) {
    suggestedTraits.budget = Math.min((currentTraits.budget ?? 0) + 4, 10);
    suggestedTraits.comfort = Math.max((currentTraits.comfort ?? 0) - 3, -10);
    return {
      message: `Budget-conscious mode enabled! I've adjusted your spending style to be more frugal. You'll see more value-focused recommendations without compromising on great experiences.`,
      suggestedTraits,
    };
  }

  if (lowerInput.includes('luxury') || lowerInput.includes('splurge') || lowerInput.includes('premium') || lowerInput.includes('fancy')) {
    suggestedTraits.budget = Math.max((currentTraits.budget ?? 0) - 4, -10);
    suggestedTraits.comfort = Math.min((currentTraits.comfort ?? 0) + 4, 10);
    return {
      message: `Luxury preferences updated! I've adjusted your profile for more premium experiences. Expect recommendations for upscale accommodations and exclusive activities.`,
      suggestedTraits,
    };
  }

  // Social adjustments
  if (lowerInput.includes('solo') || lowerInput.includes('alone') || lowerInput.includes('by myself') || lowerInput.includes('not social')) {
    suggestedTraits.social = Math.max((currentTraits.social ?? 0) - 5, -10);
    return {
      message: `Solo traveler preferences saved! I've adjusted your social score (${suggestedTraits.social > 0 ? '+' : ''}${suggestedTraits.social}). Your itineraries will emphasize independent exploration and personal reflection time.`,
      suggestedTraits,
    };
  }

  if (lowerInput.includes('group') || lowerInput.includes('social') || lowerInput.includes('meet people') || lowerInput.includes('friends')) {
    suggestedTraits.social = Math.min((currentTraits.social ?? 0) + 5, 10);
    return {
      message: `Social butterfly mode on! I've boosted your social preference (${suggestedTraits.social > 0 ? '+' : ''}${suggestedTraits.social}). Expect more group activities and opportunities to connect with fellow travelers.`,
      suggestedTraits,
    };
  }

  // Planning adjustments
  if (lowerInput.includes('spontaneous') || lowerInput.includes('flexible') || lowerInput.includes('go with the flow')) {
    suggestedTraits.planning = Math.max((currentTraits.planning ?? 0) - 5, -10);
    return {
      message: `Flexibility is key! I've adjusted your planning style to be more spontaneous (${suggestedTraits.planning > 0 ? '+' : ''}${suggestedTraits.planning}). Your itineraries will include more free time and flexible options.`,
      suggestedTraits,
    };
  }

  if (lowerInput.includes('planned') || lowerInput.includes('organized') || lowerInput.includes('structured') || lowerInput.includes('detailed')) {
    suggestedTraits.planning = Math.min((currentTraits.planning ?? 0) + 5, 10);
    return {
      message: `Organization mode activated! I've increased your planning preference (${suggestedTraits.planning > 0 ? '+' : ''}${suggestedTraits.planning}). Expect well-structured itineraries with clear timelines and reservations.`,
      suggestedTraits,
    };
  }

  // Authenticity adjustments
  if (lowerInput.includes('local') || lowerInput.includes('authentic') || lowerInput.includes('off the beaten path') || lowerInput.includes('hidden gems')) {
    suggestedTraits.authenticity = Math.min((currentTraits.authenticity ?? 0) + 5, 10);
    return {
      message: `Local explorer mode! I've boosted your authenticity preference (${suggestedTraits.authenticity > 0 ? '+' : ''}${suggestedTraits.authenticity}). You'll discover more hidden gems and local favorites in your trips.`,
      suggestedTraits,
    };
  }

  if (lowerInput.includes('tourist') || lowerInput.includes('famous') || lowerInput.includes('popular') || lowerInput.includes('landmarks')) {
    suggestedTraits.authenticity = Math.max((currentTraits.authenticity ?? 0) - 5, -10);
    return {
      message: `Got it! I've adjusted your profile to include more popular attractions (${suggestedTraits.authenticity > 0 ? '+' : ''}${suggestedTraits.authenticity}). Your itineraries will feature must-see landmarks and well-known experiences.`,
      suggestedTraits,
    };
  }

  // Default response if no pattern matched
  return {
    message: "Thanks for sharing! Could you be more specific about which aspect of your travel style we got wrong? For example, is it about pace, adventure level, budget preference, social style, or how planned vs spontaneous you like your trips?",
  };
}

export type { DNAFeedbackChatProps };
