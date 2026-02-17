/**
 * FindMyHotelsDrawer
 * 
 * Credit-gated AI hotel recommendation feature.
 * Uses Travel DNA + trip preferences to generate a Top 10 hotel list
 * sorted by match score with external booking links.
 */

import { useState, useCallback, useRef } from 'react';
import { 
  Sparkles, Star, MapPin, Heart, ExternalLink, Loader2, Dna, 
  Hotel, CreditCard, X, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSpendCredits } from '@/hooks/useSpendCredits';
import { useDNAHotelRecommendations, type DNARecommendedHotel, type IdealHotelProfile } from '@/hooks/useDNAHotelRecommendations';
import { CREDIT_COSTS } from '@/config/pricing';

interface FindMyHotelsDrawerProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType?: string;
  className?: string;
}

export function FindMyHotelsDrawer({
  tripId,
  destination,
  startDate,
  endDate,
  travelers,
  tripType,
  className,
}: FindMyHotelsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [isSpending, setIsSpending] = useState(false);
  const { user } = useAuth();
  const { mutateAsync: spendCredits } = useSpendCredits();

  // Only fetch recommendations after user pays credits
  const {
    profile,
    recommendations,
    topPick,
    isLoading,
    isProfileLoading,
    error,
  } = useDNAHotelRecommendations({
    destination,
    checkIn: startDate,
    checkOut: endDate,
    guests: travelers,
    tripType,
    enabled: hasPaid && isOpen,
  });

  const creditCost = CREDIT_COSTS.HOTEL_SEARCH;

  const spendAttemptedRef = useRef(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const handleOpenAndPay = useCallback(async () => {
    if (hasPaid) {
      setIsOpen(true);
      return;
    }

    // Idempotency guard: prevent duplicate spend calls
    if (spendAttemptedRef.current) return;
    spendAttemptedRef.current = true;

    setIsSpending(true);
    try {
      const result = await spendCredits({
        action: 'HOTEL_SEARCH',
        tripId,
        creditsAmount: creditCost,
        metadata: { destination, idempotencyKey },
      });

      setHasPaid(true);
      setIsOpen(true);
      
      if (result.freeCapUsed) {
        toast.success(`Finding your perfect hotels (free - ${result.usageCount}/${result.freeCap} used)`);
      } else {
        toast.success(`Finding your perfect hotels (${result.spent ?? creditCost} credits used)`);
      }
    } catch (err: any) {
      // Reset ref on error so user can retry
      spendAttemptedRef.current = false;
      console.error('[FindMyHotels] Credit spend failed:', err);
      if (!err?.message?.startsWith('Not enough credits')) {
        toast.error(err?.message || 'Failed to start hotel search. Please try again.');
      }
    } finally {
      setIsSpending(false);
    }
  }, [hasPaid, spendCredits, tripId, destination, creditCost, idempotencyKey]);

  // Top 10 sorted by match score (already sorted by the hook)
  const displayHotels = recommendations.slice(0, 10);

  return (
    <>
      <Button
        onClick={handleOpenAndPay}
        disabled={isSpending}
        className={cn(
          'gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70',
          className
        )}
      >
        {isSpending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {hasPaid ? 'View My Hotels' : `Find My Hotels`}
        {!hasPaid && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 bg-background/20 text-primary-foreground border-0">
            {creditCost} credits
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="rounded-full bg-primary/10 p-2">
                <Dna className="h-4 w-4 text-primary" />
              </div>
              Hotels Matched to Your DNA
            </DialogTitle>
            <DialogDescription>
              {destination} - AI-curated from your Travel DNA profile and trip preferences
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[65vh]">
            <div className="px-6 pb-6 space-y-4">
              {/* AI Profile Summary */}
              {profile && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5 p-4"
                >
                  <p className="text-xs font-medium text-primary flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3 w-3" />
                    Your ideal stay
                  </p>
                  {profile.styleDescription && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {profile.styleDescription}
                    </p>
                  )}
                  {profile.idealNeighborhoods.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {profile.idealNeighborhoods.slice(0, 4).map(n => (
                        <Badge key={n} variant="secondary" className="text-[10px] px-1.5 py-0">
                          <MapPin className="h-2.5 w-2.5 mr-0.5" />
                          {n}
                        </Badge>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Loading States */}
              {(isProfileLoading || isLoading) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <div>
                    <p className="text-sm font-medium">
                      {isProfileLoading ? 'Analyzing your Travel DNA...' : 'Finding matching hotels...'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isProfileLoading 
                        ? 'Building your ideal hotel profile' 
                        : 'Scoring hotels against your preferences'}
                    </p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                  <p className="text-xs text-muted-foreground mt-1">Try again later or add your hotel manually</p>
                </div>
              )}

              {/* Hotel Results */}
              {!isLoading && displayHotels.length > 0 && (
                <AnimatePresence>
                  {displayHotels.map((hotel, index) => (
                    <motion.div
                      key={hotel.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                    >
                      <HotelRecommendationCard
                        hotel={hotel}
                        rank={index + 1}
                        destination={destination}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {/* Empty State */}
              {!isLoading && !error && displayHotels.length === 0 && hasPaid && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <Hotel className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">No hotels found for these dates</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your trip dates or add a hotel manually
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              {displayHotels.length > 0 && !isLoading && (
                <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
                  Prices are estimates. Click any hotel to see current rates and book directly.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Hotel Recommendation Card with External Booking Links
// ============================================================================

function HotelRecommendationCard({
  hotel,
  rank,
  destination,
}: {
  hotel: DNARecommendedHotel;
  rank: number;
  destination: string;
}) {
  const matchColor = hotel.dnaMatchScore >= 80 ? 'text-green-600' 
    : hotel.dnaMatchScore >= 60 ? 'text-amber-600' 
    : 'text-muted-foreground';

  // Generate external booking URL
  const bookingUrl = generateBookingUrl(hotel.name, destination);

  return (
    <div
      className={cn(
        'rounded-xl border transition-all group',
        hotel.isTopPick
          ? 'border-primary/30 bg-primary/[0.03]'
          : 'border-border',
      )}
    >
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="shrink-0">
          {hotel.imageUrl ? (
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
              <img
                src={hotel.imageUrl}
                alt={hotel.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
              <Hotel className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {hotel.isTopPick && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 gap-0.5">
                    <Heart className="h-2.5 w-2.5 fill-current" />
                    Top Pick
                  </Badge>
                )}
                <span className="font-semibold text-sm truncate">{hotel.name}</span>
              </div>

              {hotel.neighborhood && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{hotel.neighborhood}</span>
                </p>
              )}
            </div>

            {/* Match score */}
            <div className="text-right shrink-0">
              <div className={cn('text-lg font-bold', matchColor)}>
                {hotel.dnaMatchScore}%
              </div>
              <div className="text-[10px] text-muted-foreground">match</div>
            </div>
          </div>

          {/* Stars + Price row */}
          <div className="flex items-center gap-3 mt-1.5">
            {hotel.stars > 0 && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: hotel.stars }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 text-amber-500 fill-amber-500" />
                ))}
              </div>
            )}
            {hotel.pricePerNight > 0 && (
              <span className="text-sm font-semibold text-foreground">
                ${hotel.pricePerNight}<span className="text-xs text-muted-foreground font-normal">/night</span>
              </span>
            )}
          </div>

          {/* Match reasons */}
          {hotel.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hotel.matchReasons.map((reason, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {reason}
                </span>
              ))}
            </div>
          )}

          {/* External Booking Link */}
          <div className="mt-3">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Book on Booking.com
              <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate external booking URL for a hotel
 */
function generateBookingUrl(hotelName: string, destination: string): string {
  const query = encodeURIComponent(`${hotelName} ${destination}`);
  return `https://www.booking.com/search.html?ss=${query}`;
}

export default FindMyHotelsDrawer;
