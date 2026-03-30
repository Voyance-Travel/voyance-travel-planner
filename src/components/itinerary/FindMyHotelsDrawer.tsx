/**
 * FindMyHotelsDrawer
 * 
 * Credit-gated AI hotel recommendation feature.
 * Uses Travel DNA + trip preferences to generate a Top 10 hotel list
 * sorted by match score with external booking links.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sparkles, Star, MapPin, Heart, ExternalLink, Loader2, Dna, 
  Hotel, CreditCard, X, ChevronRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { toFriendlyError } from '@/utils/friendlyErrors';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSpendCredits } from '@/hooks/useSpendCredits';
import { useDNAHotelRecommendations, type DNARecommendedHotel, type IdealHotelProfile } from '@/hooks/useDNAHotelRecommendations';
import { CREDIT_COSTS } from '@/config/pricing';
import { saveHotelSelection } from '@/services/supabase/trips';
import { syncHotelToLedger, syncMultiCityHotelsToLedger } from '@/services/budgetLedgerSync';
import { patchItineraryWithHotel } from '@/services/hotelItineraryPatch';

interface FindMyHotelsDrawerProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType?: string;
  className?: string;
  onHotelSelected?: () => void;
  // Multi-city: when set, hotel is saved to trip_cities instead of trips
  cityId?: string;
}


export function FindMyHotelsDrawer({
  tripId,
  destination,
  startDate,
  endDate,
  travelers,
  tripType,
  className,
  onHotelSelected,
  cityId,
}: FindMyHotelsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [isSpending, setIsSpending] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [isSavingHotel, setIsSavingHotel] = useState(false);
  const { user } = useAuth();
  const { mutateAsync: spendCredits } = useSpendCredits();

  // Auto-open support (used after handleOpenAndPay is defined)
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenTriggered = useRef(false);

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

    // Idempotency: ref guard prevents double-spend per component instance
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
      
      // Credits charged silently — no toast needed
    } catch (err: any) {
      // Reset guards on error so user can retry
      spendAttemptedRef.current = false;
      console.error('[FindMyHotels] Credit spend failed:', err);
      if (!err?.message?.startsWith('Not enough credits') && err?.message !== 'Duplicate spend request blocked') {
        toast.error(toFriendlyError(err?.message));
      }
    } finally {
      setIsSpending(false);
      // Success keeps ref locked to prevent re-spend; error handler resets it for retry
    }
  }, [hasPaid, spendCredits, tripId, destination, creditCost, idempotencyKey]);

  // Auto-open when navigated from profile with ?openHotelSearch=true
  useEffect(() => {
    if (searchParams.get('openHotelSearch') === 'true' && !autoOpenTriggered.current && !hasPaid) {
      autoOpenTriggered.current = true;
      searchParams.delete('openHotelSearch');
      setSearchParams(searchParams, { replace: true });
      handleOpenAndPay();
    }
  }, [searchParams, handleOpenAndPay, hasPaid, setSearchParams]);

  const handleSelectHotel = useCallback(async (hotel: DNARecommendedHotel) => {
    if (isSavingHotel) return;
    setIsSavingHotel(true);
    try {
      // Calculate nights for total price
      const nights = (() => {
        if (startDate && endDate) {
          return Math.max(1, Math.ceil(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
          ));
        }
        return 1;
      })();

      const hotelData = {
        id: hotel.id,
        name: hotel.name,
        address: hotel.neighborhood || undefined,
        starRating: hotel.stars || undefined,
        pricePerNight: hotel.pricePerNight || undefined,
        totalPrice: hotel.pricePerNight ? hotel.pricePerNight * nights : undefined,
        imageUrl: hotel.imageUrl || undefined,
        checkIn: startDate || undefined,
        checkOut: endDate || undefined,
      };

      if (cityId) {
        // Multi-city: save to trip_cities table, preserving existing split-stay hotels
        const { supabase } = await import('@/integrations/supabase/client');

        // 1. Fetch existing hotel_selection array from this city
        const { data: cityRow } = await supabase
          .from('trip_cities')
          .select('hotel_selection')
          .eq('id', cityId)
          .maybeSingle();

        const existing = (() => {
          const sel = (cityRow as any)?.hotel_selection;
          if (Array.isArray(sel)) return sel;
          if (sel && typeof sel === 'object') return [sel];
          return [];
        })();

        // 2. Append new hotel (or replace if same id)
        const newHotel = { ...hotelData, checkInDate: startDate, checkOutDate: endDate };
        const idx = existing.findIndex((h: any) => h.id === newHotel.id);
        const updatedHotels = idx >= 0
          ? existing.map((h: any, i: number) => i === idx ? newHotel : h)
          : [...existing, newHotel];

        // 3. Aggregate cost across ALL hotels in the city
        const aggregatedCostCents = updatedHotels.reduce((sum: number, h: any) => {
          const ppn = h.pricePerNight || 0;
          const ci = h.checkInDate || h.checkIn;
          const co = h.checkOutDate || h.checkOut;
          let n = 1;
          if (ci && co) {
            const diff = new Date(co).getTime() - new Date(ci).getTime();
            if (diff > 0) n = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          }
          return sum + Math.round(ppn * n * 100);
        }, 0);

        const { error } = await supabase
          .from('trip_cities')
          .update({
            hotel_selection: JSON.parse(JSON.stringify(updatedHotels)),
            hotel_cost_cents: aggregatedCostCents,
          } as any)
          .eq('id', cityId);
        if (error) throw error;

        // 4. Sync ALL hotels to budget ledger (not just the new one)
        const ledgerHotels = updatedHotels
          .filter((h: any) => (h.totalPrice || ((h.pricePerNight || 0) > 0)))
          .map((h: any) => {
            const ppn = h.pricePerNight || 0;
            const ci = h.checkInDate || h.checkIn;
            const co = h.checkOutDate || h.checkOut;
            let n = 1;
            if (ci && co) {
              const diff = new Date(co).getTime() - new Date(ci).getTime();
              if (diff > 0) n = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            }
            return { name: h.name || 'Hotel', totalPrice: h.totalPrice || ppn * n };
          });
        if (ledgerHotels.length > 0) {
          await syncMultiCityHotelsToLedger(tripId, ledgerHotels);
        }
      } else {
        // Single-city: save to trips table
        await saveHotelSelection(tripId, hotelData);

        // Sync hotel cost to budget ledger
        await syncHotelToLedger(tripId, hotelData);
      }

      // Patch itinerary accommodation activities with hotel name/address
      try {
        await patchItineraryWithHotel(tripId, {
          name: hotel.name,
          address: hotel.address || hotel.neighborhood,
          checkInDate: startDate,
          checkOutDate: endDate,
        });
      } catch (patchErr) {
        console.warn('[FindMyHotels] Hotel itinerary patch skipped:', patchErr);
      }

      setSelectedHotelId(hotel.id);
      toast.success(`${hotel.name} saved to your trip!`);
      onHotelSelected?.();

      // Dispatch booking-changed event for financial snapshot refresh
      window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));

      // Close drawer after short delay
      setTimeout(() => setIsOpen(false), 1200);
    } catch (err) {
      console.error('Failed to save hotel:', err);
      toast.error('Could not save hotel. Please try again.');
    } finally {
      setIsSavingHotel(false);
    }
  }, [tripId, cityId, startDate, endDate, isSavingHotel, onHotelSelected]);

  // Top 10 sorted by match score (already sorted by the hook)
  const displayHotels = recommendations.slice(0, 10);

  return (
    <>
      <Button
        onClick={handleOpenAndPay}
        disabled={isSpending || hasPaid}
        style={{ pointerEvents: isSpending ? 'none' : 'auto' }}
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
        {isSpending ? 'Processing...' : hasPaid ? 'View My Hotels' : `Find My Hotels`}
        {!hasPaid && !isSpending && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 bg-background/20 text-primary-foreground border-0">
            {creditCost} credits
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] p-0 gap-0">
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
                        isSelected={selectedHotelId === hotel.id}
                        isSaving={isSavingHotel}
                        onSelect={() => handleSelectHotel(hotel)}
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
  isSelected,
  isSaving,
  onSelect,
}: {
  hotel: DNARecommendedHotel;
  rank: number;
  destination: string;
  isSelected: boolean;
  isSaving: boolean;
  onSelect: () => void;
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
        isSelected
          ? 'border-primary/50 bg-primary/[0.05] ring-1 ring-primary/20'
          : hotel.isTopPick
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
          <div>
            {hotel.isTopPick && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 gap-0.5 mb-1">
                <Heart className="h-2.5 w-2.5 fill-current" />
                Top Pick
              </Badge>
            )}
            <span className="font-semibold text-sm leading-snug block">{hotel.name}</span>

            {hotel.neighborhood && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{hotel.neighborhood}</span>
              </p>
            )}
          </div>

          {/* Stars + Price + Match score row */}
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
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <span className={cn('text-sm font-bold', matchColor)}>
                {hotel.dnaMatchScore}%
              </span>
              <span className="text-[10px] text-muted-foreground">match</span>
            </div>
          </div>

          {/* Match reasons */}
          {hotel.matchReasons.filter(r => r !== 'Good overall match').length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hotel.matchReasons.filter(r => r !== 'Good overall match').map((reason, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {reason}
                </span>
              ))}
            </div>
          )}

          {/* Actions: Select + Booking Link */}
          <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              disabled={isSaving || isSelected}
              className="text-xs h-8 gap-1.5"
            >
              {isSelected ? (
                <>
                  <Check className="h-3 w-3" />
                  Selected
                </>
              ) : (
                <>Select This Hotel</>
              )}
            </Button>

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
 * Generate external booking URL for a hotel.
 * Uses ss= search param with explicit city/state to avoid Booking.com resolving to wrong city.
 */
function generateBookingUrl(hotelName: string, destination: string): string {
  // Strip IATA codes and ensure we use the full city name
  const cleanDest = destination
    .replace(/\s*\([A-Z]{3}\)\s*/g, '') // remove "(AUS)" etc.
    .trim();
  
  // Include both hotel name and full destination for accuracy
  const query = encodeURIComponent(`${hotelName}, ${cleanDest}`);
  return `https://www.booking.com/searchresults.html?ss=${query}&dest_type=city&nflt=`;
}

export default FindMyHotelsDrawer;
