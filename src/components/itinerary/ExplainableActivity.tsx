import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TripActivity } from '@/types/trip';

interface ExplainableActivityProps {
  activity: TripActivity;
  tripContext: {
    destination: string;
    tripType?: string;
    budget?: string;
    travelers?: number;
  };
  children: React.ReactNode;
}

export function ExplainableActivity({ 
  activity, 
  tripContext, 
  children 
}: ExplainableActivityProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const handleExplain = useCallback(async () => {
    if (explanation) {
      setIsVisible(!isVisible);
      return;
    }

    setIsLoading(true);
    setIsVisible(true);

    try {
      const { data, error } = await supabase.functions.invoke('explain-recommendation', {
        body: {
          activity: {
            id: activity.id,
            name: activity.name,
            type: activity.type,
            category: activity.category,
            description: activity.description,
            location: activity.location,
            price: activity.price,
            duration: activity.duration,
          },
          tripContext,
        },
      });

      if (error) throw error;
      setExplanation(data.explanation);
    } catch (err) {
      console.error('Failed to get explanation:', err);
      setExplanation("We couldn't generate an explanation right now. Try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [activity, tripContext, explanation, isVisible]);

  return (
    <div className="relative">
      {children}
      
      {/* Why this? button */}
      <button
        onClick={handleExplain}
        disabled={isLoading}
        className="absolute top-2 right-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full border border-border/50"
      >
        <Sparkles className="w-3 h-3" />
        {isLoading ? 'Thinking...' : isVisible ? 'Hide' : 'Why this?'}
      </button>

      {/* Explanation panel */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isLoading ? (
                  <span className="animate-pulse">Generating personalized explanation...</span>
                ) : (
                  explanation
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExplainableActivity;
