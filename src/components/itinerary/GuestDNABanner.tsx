/**
 * GuestDNABanner
 * 
 * Shown to collaborators (non-owners) on shared trips.
 * - If guest has no Travel DNA → prompts them to take the quiz
 * - If guest has DNA but itinerary hasn't been regenerated with it → offers regeneration
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, ArrowRight, RefreshCw, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';

interface GuestDNABannerProps {
  tripId: string;
  onRequestRegenerate?: () => void;
  className?: string;
}

const DISMISSED_KEY = 'voyance_guest_dna_dismissed';

export function GuestDNABanner({ tripId, onRequestRegenerate, className }: GuestDNABannerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasDNA, setHasDNA] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Check if dismissed for this trip
    const dismissedTrips = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]');
    if (dismissedTrips.includes(tripId)) {
      setDismissed(true);
      return;
    }

    async function checkContext() {
      // Direct ownership check — don't rely solely on RPC cache
      const { data: trip } = await supabase
        .from('trips')
        .select('user_id')
        .eq('id', tripId)
        .maybeSingle();

      if (trip?.user_id === user!.id) {
        setIsOwner(true);
        return; // Owner — no need to check DNA
      }
      setIsOwner(false);

      // Check if user has Travel DNA
      const { data } = await supabase
        .from('travel_dna_profiles')
        .select('trait_scores')
        .eq('user_id', user!.id)
        .maybeSingle();

      setHasDNA(!!data?.trait_scores);
    }

    checkContext();
  }, [user?.id, tripId]);

  const handleDismiss = () => {
    setDismissed(true);
    const dismissedTrips = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]');
    dismissedTrips.push(tripId);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedTrips));
  };

  const handleTakeQuiz = () => {
    // Store return URL so user comes back after quiz
    sessionStorage.setItem('postQuizRedirect', `/trip/${tripId}`);
    navigate(ROUTES.QUIZ);
  };

  // Don't show if: dismissed, owner, or still loading
  if (dismissed || isOwner === null || isOwner || hasDNA === null) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className={className}
      >
        {!hasDNA ? (
          /* No DNA — prompt to take quiz */
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Dna className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Personalize this trip</p>
                <p className="text-xs text-muted-foreground">
                  Take the 5-min Travel DNA quiz so this itinerary can reflect your style too.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button size="sm" onClick={handleTakeQuiz} className="flex-1 sm:flex-initial gap-1.5">
                Take the Quiz
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Has DNA — offer to regenerate with blended preferences */
          <div className="bg-accent/30 border border-accent/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="shrink-0 w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Your Travel DNA is ready</p>
                <p className="text-xs text-muted-foreground">
                  Ask the trip owner to regenerate the itinerary to blend your preferences in.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onRequestRegenerate && (
                <Button size="sm" variant="outline" onClick={onRequestRegenerate} className="flex-1 sm:flex-initial gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Request Blend
                </Button>
              )}
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
