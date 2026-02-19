/**
 * Post-Generation CTAs
 * 
 * Three co-equal buttons after generating a trip: Customize, Share, Book
 * Same size, same visual weight, no hierarchy.
 * Track clicks from Day 1 to determine winner.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Share2, CreditCard, ChevronDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TripShareModal from '@/components/sharing/TripShareModal';
import { trackInteraction } from '@/hooks/useAnalyticsTracker';

interface PostGenerationCTAProps {
  tripId: string;
  tripName: string;
  destination: string;
  onCustomize: () => void;
  onBook: () => void;
  onShareLinkCreate?: () => Promise<string>;
  className?: string;
}

export function PostGenerationCTA({
  tripId,
  tripName,
  destination,
  onCustomize,
  onBook,
  onShareLinkCreate,
  className,
}: PostGenerationCTAProps) {
  const [showShareModal, setShowShareModal] = useState(false);

  // Track CTA clicks for future optimization
  const trackClick = (action: 'customize' | 'share' | 'book') => {
    trackInteraction('post_gen_cta_click', `cta-${action}`, action, {
      trip_id: tripId,
      cta_type: action,
      destination,
    });
  };

  const handleCustomize = () => {
    trackClick('customize');
    onCustomize();
  };

  const handleShare = () => {
    trackClick('share');
    setShowShareModal(true);
  };

  const handleBook = () => {
    trackClick('book');
    onBook();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3",
          className
        )}
      >
        {/* Customize - Equal weight */}
        <Button
          size="lg"
          variant="outline"
          onClick={handleCustomize}
          className="flex-1 sm:flex-none gap-2 h-12 px-6 rounded-xl border-2 hover:bg-primary/5"
        >
          <Palette className="h-5 w-5" />
          <span>Customize</span>
        </Button>

        {/* Share - Equal weight */}
        <Button
          size="lg"
          variant="outline"
          onClick={handleShare}
          className="flex-1 sm:flex-none gap-2 h-12 px-6 rounded-xl border-2 hover:bg-primary/5"
        >
          <Share2 className="h-5 w-5" />
          <span>Share</span>
        </Button>

        {/* Book - Equal weight */}
        <Button
          size="lg"
          variant="outline"
          onClick={handleBook}
          className="flex-1 sm:flex-none gap-2 h-12 px-6 rounded-xl border-2 hover:bg-primary/5"
        >
          <CreditCard className="h-5 w-5" />
          <span>Book</span>
        </Button>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center mt-6"
      >
        <button 
          onClick={() => {
            document.getElementById('day-1')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-xs mb-1">Explore your itinerary</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </button>
      </motion.div>

      {/* Share Modal with Referral */}
      <TripShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        tripId={tripId}
        tripName={tripName}
        destination={destination}
        onCreateShareLink={onShareLinkCreate}
      />
    </>
  );
}

export default PostGenerationCTA;
