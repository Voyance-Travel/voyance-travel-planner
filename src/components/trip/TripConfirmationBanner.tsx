import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hotel, CheckCircle2, PenLine, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TransportModeSelector, EMPTY_TRANSPORT_FORM, buildTransportSelection, type TransportFormData } from './TransportModeSelector';
import { DNAHotelPicks } from './DNAHotelPicks';
import { useDNAHotelRecommendations, type DNARecommendedHotel } from '@/hooks/useDNAHotelRecommendations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SwapReviewDialog, type SwapSuggestion } from './SwapReviewDialog';
import { useSpendCredits } from '@/hooks/useSpendCredits';

interface TripConfirmationBannerProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  currentStatus: string;
  hasFlightSelection: boolean;
  hasHotelSelection: boolean;
  itineraryDays: any[]; // EditorialDay[] - current itinerary for swap analysis
  onStatusUpdate: (status: string) => void;
  onTripDataUpdate: (data: { flight_selection?: any; hotel_selection?: any }) => void;
  onApplySwaps: (swaps: SwapSuggestion[]) => void;
  onRegenerateTrip: () => void;
  className?: string;
}

interface LogisticsFormData {
  hotelName: string;
  hotelNeighborhood: string;
  transport: TransportFormData;
}

export function TripConfirmationBanner({
  tripId,
  destination,
  startDate,
  endDate,
  currentStatus,
  hasFlightSelection,
  hasHotelSelection,
  itineraryDays,
  onStatusUpdate,
  onTripDataUpdate,
  onApplySwaps,
  onRegenerateTrip,
  className,
}: TripConfirmationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showLogisticsDialog, setShowLogisticsDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSwaps, setIsLoadingSwaps] = useState(false);
  const [showSwapReview, setShowSwapReview] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([]);
  const [swapHotelContext, setSwapHotelContext] = useState('');
  const [isApplyingSwaps, setIsApplyingSwaps] = useState(false);
  const spendCredits = useSpendCredits();

  // DNA hotel recommendations (fetched when dialog opens)
  const dnaRecs = useDNAHotelRecommendations({
    destination,
    checkIn: startDate,
    checkOut: endDate,
    enabled: showLogisticsDialog && !hasHotelSelection,
  });

  const [form, setForm] = useState<LogisticsFormData>({
    hotelName: '',
    hotelNeighborhood: '',
    transport: { ...EMPTY_TRANSPORT_FORM },
  });

  const handleSelectDNAHotel = useCallback((hotel: DNARecommendedHotel) => {
    setForm(prev => ({
      ...prev,
      hotelName: hotel.name,
      hotelNeighborhood: hotel.neighborhood || '',
    }));
  }, []);

  // Don't show for non-draft trips or dismissed
  if (currentStatus !== 'draft' || dismissed) return null;

  const handleDrafting = () => {
    setDismissed(true);
  };

  const handleUpcoming = () => {
    if (hasFlightSelection && hasHotelSelection) {
      confirmUpcoming();
      return;
    }
    setShowLogisticsDialog(true);
  };

  const confirmUpcoming = async (logistics?: { flight_selection?: any; hotel_selection?: any }) => {
    setIsSaving(true);
    try {
      const updatePayload: Record<string, any> = {
        status: 'booked',
        updated_at: new Date().toISOString(),
      };

      if (logistics?.flight_selection) {
        updatePayload.flight_selection = logistics.flight_selection;
      }
      if (logistics?.hotel_selection) {
        updatePayload.hotel_selection = logistics.hotel_selection;
      }

      const { error } = await supabase
        .from('trips')
        .update(updatePayload)
        .eq('id', tripId);

      if (error) throw error;

      onStatusUpdate('booked');
      if (logistics) {
        onTripDataUpdate(logistics);
      }

      // If hotel was added, fetch swap suggestions instead of auto-regenerating
      if (logistics?.hotel_selection && itineraryDays.length > 0) {
        setShowLogisticsDialog(false);
        await fetchSwapSuggestions(logistics.hotel_selection);
      } else {
        toast.success('Trip confirmed as upcoming!');
        setDismissed(true);
        setShowLogisticsDialog(false);
      }
    } catch (err) {
      console.error('[TripConfirmationBanner] Failed to update trip:', err);
      toast.error('Failed to update trip status');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchSwapSuggestions = async (hotelSelection: { name: string; neighborhood?: string }) => {
    setIsLoadingSwaps(true);
    try {
      // Build simplified day data for the AI
      const simplifiedDays = itineraryDays.map((day: any) => ({
        dayNumber: day.dayNumber,
        activities: (day.activities || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          type: a.type,
          category: a.category,
          startTime: a.startTime,
          endTime: a.endTime,
          location: a.location,
          isLocked: a.isLocked,
        })),
      }));

      const { data, error } = await supabase.functions.invoke('suggest-hotel-swaps', {
        body: {
          tripId,
          destination,
          hotelName: hotelSelection.name,
          hotelNeighborhood: hotelSelection.neighborhood || '',
          days: simplifiedDays,
        },
      });

      if (error) throw error;

      const suggestions = data?.suggestions || [];
      
      if (suggestions.length === 0) {
        toast.success('Trip confirmed! Your itinerary is already well-suited to your hotel location.');
        setDismissed(true);
        return;
      }

      setSwapSuggestions(suggestions);
      setSwapHotelContext(data?.hotelContext || hotelSelection.name);
      setShowSwapReview(true);
    } catch (err) {
      console.error('[TripConfirmationBanner] Failed to fetch swap suggestions:', err);
      toast.error('Could not analyze itinerary. Trip confirmed as upcoming.');
      setDismissed(true);
    } finally {
      setIsLoadingSwaps(false);
    }
  };

  const handleApplySwaps = async (approvedSwaps: SwapSuggestion[]) => {
    setIsApplyingSwaps(true);
    try {
      // Charge credits
      await spendCredits.mutateAsync({
        action: 'HOTEL_OPTIMIZATION',
        tripId,
      });

      onApplySwaps(approvedSwaps);
      toast.success(`Applied ${approvedSwaps.length} optimization${approvedSwaps.length > 1 ? 's' : ''} to your itinerary!`);
      setShowSwapReview(false);
      setDismissed(true);
    } catch (err: any) {
      // If it's a credit error, the modal handles it
      if (!err?.message?.startsWith('Not enough credits')) {
        toast.error('Failed to apply optimizations');
      }
    } finally {
      setIsApplyingSwaps(false);
    }
  };

  const handleLogisticsSubmit = () => {
    const logistics: { flight_selection?: any; hotel_selection?: any } = {};

    if (form.hotelName.trim()) {
      logistics.hotel_selection = {
        name: form.hotelName.trim(),
        neighborhood: form.hotelNeighborhood.trim() || undefined,
        checkIn: startDate,
        checkOut: endDate,
      };
    }

    const transportSelection = buildTransportSelection(form.transport);
    if (transportSelection) {
      logistics.flight_selection = transportSelection;
    }

    confirmUpcoming(Object.keys(logistics).length > 0 ? logistics : undefined);
  };

  return (
    <>
      {/* Loading overlay for swap analysis */}
      {isLoadingSwaps && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Analyzing your itinerary for your hotel neighborhood...</p>
            <p className="text-xs text-muted-foreground">Finding better nearby alternatives</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'relative rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5 p-5 md:p-6',
            className
          )}
        >
          <button 
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {hasFlightSelection && hasHotelSelection
                  ? 'Ready to confirm this trip?'
                  : 'Is this trip happening?'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {hasFlightSelection && hasHotelSelection
                  ? 'Your flight and hotel are set. Confirm to lock everything in.'
                  : !hasFlightSelection && !hasHotelSelection
                    ? 'Add your flight and hotel details so we can optimize your itinerary.'
                    : !hasHotelSelection
                      ? 'Add your hotel so we can optimize activities around your neighborhood.'
                      : 'Add your flight details so we can plan around your arrival and departure.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleDrafting} className="gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                Just Drafting
              </Button>
              <Button size="sm" onClick={handleUpcoming} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {hasFlightSelection && hasHotelSelection ? 'Confirm Trip' : "It's Happening!"}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Logistics Collection Dialog */}
      <Dialog open={showLogisticsDialog} onOpenChange={setShowLogisticsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Tell us your travel details
            </DialogTitle>
            <DialogDescription>
              We'll suggest optimizations based on your hotel location. Locked activities stay put.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto">
            {!hasHotelSelection && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Hotel className="h-4 w-4 text-primary" />
                  Where are you staying?
                </div>

                {/* DNA Recommendations */}
                {(dnaRecs.isLoading || dnaRecs.recommendations.length > 0) && (
                  <DNAHotelPicks
                    profile={dnaRecs.profile}
                    recommendations={dnaRecs.recommendations}
                    topPick={dnaRecs.topPick}
                    isLoading={dnaRecs.isHotelsLoading}
                    isProfileLoading={dnaRecs.isProfileLoading}
                    onSelectHotel={handleSelectDNAHotel}
                    compact
                  />
                )}

                {/* Manual input (pre-filled if DNA hotel selected) */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {dnaRecs.recommendations.length > 0 ? 'Or enter your own hotel:' : ''}
                  </p>
                  <Input
                    placeholder="Hotel name (e.g., The Ritz Carlton)"
                    value={form.hotelName}
                    onChange={(e) => setForm(prev => ({ ...prev, hotelName: e.target.value }))}
                  />
                  <Input
                    placeholder="Neighborhood (e.g., Shibuya, Trastevere)"
                    value={form.hotelNeighborhood}
                    onChange={(e) => setForm(prev => ({ ...prev, hotelNeighborhood: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {!hasFlightSelection && (
              <TransportModeSelector
                form={form.transport}
                onChange={(transport) => setForm(prev => ({ ...prev, transport }))}
                destination={destination}
              />
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => confirmUpcoming()}
              >
                Skip for now
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleLogisticsSubmit}
                disabled={isSaving || (!form.hotelName.trim() && !form.transport.mode)}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isSaving ? 'Saving...' : 'Confirm & Optimize'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Review Dialog */}
      <SwapReviewDialog
        open={showSwapReview}
        onOpenChange={setShowSwapReview}
        suggestions={swapSuggestions}
        hotelContext={swapHotelContext}
        isApplying={isApplyingSwaps}
        onApproveSelected={(ids) => {
          const selected = swapSuggestions.filter(s => ids.includes(s.activityId));
          handleApplySwaps(selected);
        }}
        onApproveAll={() => handleApplySwaps(swapSuggestions)}
        onSkip={() => {
          setShowSwapReview(false);
          setDismissed(true);
          toast.success('Trip confirmed! Keeping your current itinerary.');
        }}
      />
    </>
  );
}

export default TripConfirmationBanner;
