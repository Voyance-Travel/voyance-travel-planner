import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTripCities } from '@/services/tripCitiesService';
import type { TripCity } from '@/types/tripCity';
import { checkRedistributionNeeded, applyNightsRedistribution, type NightsRedistribution } from '@/utils/syncTripCitiesNights';
import { NightsRedistributionModal } from '@/components/trip/NightsRedistributionModal';
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { format, isAfter, isBefore, differenceInDays, addDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { enforceMealTimeCoherence } from '@/utils/mealTimeCoherence';
import { Loader2, MapPin, ArrowLeft, Sparkles, CheckCircle, PenLine, Coins, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { CREDIT_COSTS } from '@/config/pricing';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { GenerationPhases } from '@/components/planner/shared/GenerationPhases';
import { type DateChangeResult } from '@/components/trip/TripDateEditor';
import MainLayout from '@/components/layout/MainLayout';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LiveItineraryView } from '@/components/itinerary/LiveItineraryView';
import { ItineraryGenerator } from '@/components/itinerary/ItineraryGenerator';
import { useGenerationPoller } from '@/hooks/useGenerationPoller';
import { EditorialItinerary } from '@/components/itinerary/EditorialItinerary';
import type { EditorialDay } from '@/components/itinerary/EditorialItinerary';
import { ItineraryAssistant } from '@/components/itinerary/ItineraryAssistant';
import TravelIntelCard from '@/components/itinerary/TravelIntelCard';
import { MobileTripOverview } from '@/components/trip/MobileTripOverview';
import { TripHealthPanel } from '@/components/trip/TripHealthPanel';
import { useEntitlements, canViewPremiumContentForDay } from '@/hooks/useEntitlements';
import { computeUnlockedDayCount } from '@/lib/voyanceFlowController';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import { TripDebriefModal } from '@/components/trip/TripDebriefModal';
import { GuidePromptBanner } from '@/components/trip/GuidePromptBanner';
import { useTripViewMode } from '@/hooks/useTripViewMode';
import { TripViewModeToggle } from '@/components/trip/TripViewModeToggle';

import type { SwapSuggestion } from '@/components/trip/SwapReviewDialog';
import { VersionConflictDialog } from '@/components/trip/VersionConflictDialog';
import { supabase } from '@/integrations/supabase/client';
import { getTripPermission } from '@/services/tripCollaboratorsAPI';
import { setCachedVersion, clearCachedVersion, saveItineraryOptimistic, fetchAndCacheVersion } from '@/services/itineraryOptimisticUpdate';
import { saveTripDateVersion, restoreTripDateVersion } from '@/services/tripDateVersionHistory';
import { useScheduleNotifications } from '@/services/tripNotificationsAPI';
import { useScrollLockCleanup } from '@/hooks/useScrollLockCleanup';
import { useTripLearning } from '@/services/tripLearningsAPI';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { GeneratedDay, TripOverview } from '@/hooks/useItineraryGeneration';
import { enrichHotel } from '@/services/hotelAPI';
import { usePaymentVerification } from '@/hooks/usePaymentVerification';
import { useStalePendingChargeRefund } from '@/hooks/useStalePendingChargeRefund';
import { useTripHeroImage } from '@/hooks/useTripHeroImage';
import TripPhotoGallery from '@/components/trip/TripPhotoGallery';
import { getDestinationByCity, type Destination } from '@/services/supabase/destinations';
import { initiateBooking } from '@/services/tripPaymentsAPI';
import { toast } from 'sonner';
import { normalizeLegacyHotelSelection, type HotelBooking } from '@/utils/hotelValidation';
import { parseEditorialDays, parseAssistantDays } from '@/utils/itineraryParser';
import { normalizeFlightSelection } from '@/utils/normalizeFlightSelection';
import { injectHotelActivitiesIntoDays, injectMultiHotelActivities } from '@/utils/injectHotelActivities';
import { patchItineraryWithHotel, patchItineraryWithMultipleHotels } from '@/services/hotelItineraryPatch';
import { cn } from '@/lib/utils';
import { JourneyBreadcrumb } from '@/components/trips/JourneyBreadcrumb';
import { JourneyUpNext } from '@/components/trips/JourneyUpNext';

type Trip = Tables<'trips'>;
type TripActivity = Tables<'trip_activities'>;

interface ItineraryDay {
  dayNumber: number;
  date: string;
  theme?: string;
  description?: string;
  activities: {
    id: string;
    name: string;
    description?: string;
    type?: string;
    category?: string;
    startTime?: string;
    endTime?: string;
    location?: {
      name?: string;
      address?: string;
      lat?: number;
      lng?: number;
    };
    imageUrl?: string;
  }[];
  weather?: {
    condition?: string;
    high?: number;
    low?: number;
  };
}

export default function TripDetail() {
  useScrollLockCleanup(); // Safety net: clear stale scroll locks from unmounted modals
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldAutoGenerate = searchParams.get('generate') === 'true';
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<TripActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [navigateToSection, setNavigateToSection] = useState<string | null>(null);
  const [refreshDayRequest, setRefreshDayRequest] = useState<{ dayNumber: number; nonce: number } | null>(null);
  const [fixTimingRequest, setFixTimingRequest] = useState<{ dayNumber: number; nonce: number } | null>(null);
  const [refreshingDayNumber, setRefreshingDayNumber] = useState<number | null>(null);
  const [refreshResultsByDay, setRefreshResultsByDay] = useState<Record<number, { errorCount: number; warningCount: number }>>({});
  const [autoStartGeneration, setAutoStartGeneration] = useState(false);
  const [isSyncingTrip, setIsSyncingTrip] = useState(false);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const [destinationMeta, setDestinationMeta] = useState<Destination | null>(null);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [liveTripViewMode, setLiveTripViewMode] = useState<'active' | 'edit'>('active');
  const [hasCollaborators, setHasCollaborators] = useState(false);
  const [activeDayNumber, setActiveDayNumber] = useState<number>(1);
  const [conflictState, setConflictState] = useState<{
    open: boolean;
    localData: Record<string, unknown> | null;
  }>({ open: false, localData: null });
  const scheduleNotifications = useScheduleNotifications();
  const { isManualBuilder } = useManualBuilderStore();
  const [tripCities, setTripCities] = useState<TripCity[]>([]);
  const [redistributionModal, setRedistributionModal] = useState<{
    open: boolean;
    totalNights: number;
    redistribution: NightsRedistribution[];
    pendingDateResult: DateChangeResult | null;
  }>({ open: false, totalNights: 0, redistribution: [], pendingDateResult: null });
  const isManualMode = tripId ? isManualBuilder(tripId) : false;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hotelEnrichmentAttempted = useRef(false);
  const debriefPromptAttempted = useRef(false);
  const autoGenerateTriggered = useRef(false);
  const tripRef = useRef<Trip | null>(null);

  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  // Mark/unmark flights or hotel as "booked elsewhere" — persists to trip.metadata
  const handleMarkBookedElsewhere = async (
    field: 'flights' | 'hotel' | undefined,
    mark: boolean,
  ) => {
    if (!field || !tripId) return;
    const key = field === 'flights' ? 'flightsBookedElsewhere' : 'hotelBookedElsewhere';
    const prevMeta = (trip?.metadata as Record<string, unknown>) || {};
    const nextMeta = { ...prevMeta, [key]: mark };
    // Optimistic update
    setTrip(prev => (prev ? { ...prev, metadata: nextMeta as any } : prev));
    try {
      const { error } = await supabase
        .from('trips')
        .update({ metadata: nextMeta as any })
        .eq('id', tripId);
      if (error) throw error;
      toast.success(
        mark
          ? `Marked ${field === 'flights' ? 'flights' : 'hotel'} as booked elsewhere`
          : `${field === 'flights' ? 'Flights' : 'Hotel'} no longer marked as booked elsewhere`,
      );
    } catch (e: any) {
      setTrip(prev => (prev ? { ...prev, metadata: prevMeta as any } : prev));
      toast.error(`Could not save: ${e?.message || 'unknown error'}`);
    }
  };

  // Entitlements — gate premium features like chat assistant
  const { data: entitlements, refresh: refreshEntitlements } = useEntitlements(tripId);
  // Premium access = paid purchase, smart finish, OR this trip has unlocked days
  // First-trip free days (1-2) do NOT grant chat/swap access on locked days
  const hasPremiumAccess = entitlements?.has_completed_purchase || entitlements?.trip_has_smart_finish || 
    // If can_view_photos is true but NOT from first-trip, it means trip has been unlocked
    (entitlements?.can_view_photos && !entitlements?.is_first_trip) || false;

  // Edit/Preview mode toggle — owners default to edit, collaborators with edit permission also get edit mode
  const isOwner = !!(user?.id && trip?.user_id && user.id === trip.user_id);
  const [collaboratorCanEdit, setCollaboratorCanEdit] = useState(false);

  useEffect(() => {
    if (!tripId || !user?.id || isOwner) {
      setCollaboratorCanEdit(false);
      return;
    }
    let cancelled = false;
    getTripPermission(tripId).then((perm) => {
      if (!cancelled) setCollaboratorCanEdit(perm.canEdit);
    });
    return () => { cancelled = true; };
  }, [tripId, user?.id, isOwner]);

  const { mode: viewMode, setMode: setViewMode, isPreviewMode, canToggle: canToggleViewMode } = useTripViewMode({ isOwner, canEdit: collaboratorCanEdit });

  // Check if trip already has a learning submitted
  const { data: existingLearning } = useTripLearning(tripId || '');

  // Payment verification on return from Stripe
  usePaymentVerification({
    onSuccess: () => {
      // Refresh payments display
      setPaymentsRefreshKey(prev => prev + 1);
    },
  });

  // Stale pending charge safety net — auto-refund failed Smart Finish charges
  useStalePendingChargeRefund(tripId);

  // Hero image — MUST be called unconditionally (before any early returns) to avoid
  // React hooks-order violation (#310). Uses safe defaults when trip hasn't loaded yet.
  const seededHero = (trip?.metadata as Record<string, unknown>)?.hero_image;
  const seededHeroUrl = typeof seededHero === 'string' && seededHero.length > 0 ? seededHero : null;
  const [activeCity, setActiveCity] = useState<string | null>(null);
  // Use per-city destination for multi-city trips, fall back to overall trip destination
  const heroDestination = activeCity || trip?.destination || '';
  const { imageUrl: heroImageUrl, onError: onHeroError, onLoad: onHeroLoad } = useTripHeroImage({
    destination: heroDestination,
    seededHeroUrl: activeCity ? null : seededHeroUrl, // Don't use seeded hero for per-city resolution
    tripId: activeCity ? undefined : trip?.id, // Don't write-back per-city heroes to trip metadata
  });

  // =========================================================================
  // SERVER-SIDE GENERATION: Poll for background generation progress
  // =========================================================================
  const [itineraryDaysCount, setItineraryDaysCount] = useState<number>(0);
  const [itineraryDaysSummaries, setItineraryDaysSummaries] = useState<Array<{ day_number: number; title: string; theme: string }>>([]);
  const isQueuedJourneyLeg = trip?.itinerary_status === 'queued' && !!trip?.journey_id;
  // Guard: don't treat as generating if itinerary_data already has days (stale status)
  const hasCompletedItineraryData = (() => {
    if (!trip?.itinerary_data) return false;
    const itinData = trip.itinerary_data as { days?: unknown[] };
    return Array.isArray(itinData?.days) && itinData.days.length > 0;
  })();
  const isServerGenerating = !hasCompletedItineraryData && (
    trip?.itinerary_status === 'generating' || (!isQueuedJourneyLeg && trip?.itinerary_status === 'queued') || (itineraryDaysCount > 0 && !trip?.itinerary_data && trip?.itinerary_status !== 'ready' && (trip?.itinerary_status as string) !== 'generated')
  );
  const [generationStalled, setGenerationStalled] = useState(false);
  const [showStalledUI, setShowStalledUI] = useState(false);
  const stalledTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [resumingGeneration, setResumingGeneration] = useState(false);
  const resumeInFlightRef = useRef(false);
  const autoResumeAttemptedRef = useRef(false);
  const emptyDayHealAttemptedRef = useRef(false);
  const onReadyCalledRef = useRef(false);
  const [incompleteDays, setIncompleteDays] = useState<number[]>([]);
  const [generateNewDaysPrompt, setGenerateNewDaysPrompt] = useState<{
    open: boolean;
    daysAdded: number;
    insertPosition: string;
    dayNumbers: number[];
  }>({ open: false, daysAdded: 0, insertPosition: 'after', dayNumbers: [] });

  useEffect(() => {
    if (generationStalled) {
      stalledTimerRef.current = setTimeout(() => setShowStalledUI(true), 5000);
    } else {
      setShowStalledUI(false);
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current);
    }
    return () => { if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current); };
  }, [generationStalled]);

  const generationPoller = useGenerationPoller({
    tripId: tripId || null,
    enabled: isServerGenerating,
    interval: 3000,
    resumeInFlight: resumeInFlightRef.current || resumingGeneration,
    onReady: async () => {
      if (onReadyCalledRef.current) return;
      onReadyCalledRef.current = true;
      // If ItineraryGenerator is active, let it handle the transition via its own poller
      const generatorHandling = showGenerator;
      setGenerationStalled(false);
      // Reload trip data to get completed itinerary
      if (!tripId) return;
      const { data } = await supabase.from('trips').select('*').eq('id', tripId).single();
      if (data) {
        setTrip(data);
        setItineraryDaysCount(0); // Reset — full data is now in itinerary_data
        setShowGenerator(false); // Ensure generator view is dismissed
        setCachedVersion(tripId, (data as any).itinerary_version ?? 1);
        // Only show toast if ItineraryGenerator isn't handling it (avoids duplicate toasts)
        if (!generatorHandling) {
          toast.success('Your itinerary is ready! 🎉');
        }
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
          queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });
        }
      }
    },
    onFailed: async (err) => {
      // NEVER show a "Generation failed" error toast to the user.
      // The backend sometimes sets itinerary_status='failed' due to transient issues
      // (edge function timeouts, AI rate limits, chain breaks) even when generation
      // is partially complete or can be auto-resumed.
      console.warn('[TripDetail] onFailed fired but suppressing error toast. Error:', err);

      if (tripId) {
        try {
          const [tripResult, daysResult] = await Promise.all([
            supabase.from('trips').select('*, itinerary_data').eq('id', tripId).single(),
            supabase.from('itinerary_days').select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
          ]);

          const verifyTrip = tripResult.data;
          const verifyData = verifyTrip?.itinerary_data as { days?: unknown[] } | null;
          const itineraryDaysExist = (daysResult.count ?? 0) > 0;

          if (verifyData?.days?.length && verifyData.days.length > 0) {
            // Check if ALL expected days are present before treating as ready
            const tripMeta = (verifyTrip?.metadata as Record<string, unknown>) || {};
            const expectedTotalDays = (tripMeta.generation_total_days as number) || 0;

            if (expectedTotalDays > 0 && verifyData.days.length >= expectedTotalDays) {
              // ALL days present — genuinely ready
              console.log('[TripDetail] onFailed suppressed — itinerary_data has all', verifyData.days.length, '/', expectedTotalDays, 'days');
              setTrip(verifyTrip);
              setShowGenerator(false);
              setCachedVersion(tripId, (verifyTrip as any).itinerary_version ?? 1);
              toast.success('Your itinerary is ready! 🎉');
              if (user?.id) {
                queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
                queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });
              }
              return;
            }

            // PARTIAL data exists — some days generated but not all.
            // Do NOT treat as ready. Trigger stalled/resume so auto-resume can
            // pick up from where it left off.
            console.log('[TripDetail] onFailed — partial data:', verifyData.days.length, '/', expectedTotalDays, 'days. Triggering resume.');
            if (verifyTrip) setTrip(verifyTrip);
            setGenerationStalled(true);
            return;
          }

          if (itineraryDaysExist) {
            console.log('[TripDetail] onFailed suppressed — itinerary_days has data, triggering resume');
            if (verifyTrip) setTrip(verifyTrip);
            setGenerationStalled(true);
            return;
          }

          console.log('[TripDetail] onFailed — no data found, showing stalled/retry UI');
          if (verifyTrip) setTrip(verifyTrip);
          setGenerationStalled(true);
        } catch (e) {
          console.warn('[TripDetail] onFailed recovery check failed:', e);
          setGenerationStalled(true);
        }
      } else {
        setGenerationStalled(true);
      }

      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
        queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });
      }
    },
    onStalled: () => {
      setGenerationStalled(true);
    },
  });

  // Resume generation from where it left off
  const handleResumeGeneration = useCallback(async () => {
    const currentTrip = tripRef.current;
    if (!tripId || !currentTrip) return;
    if (resumeInFlightRef.current) {
      console.log('[Resume] Already resuming, skipping duplicate');
      return;
    }
    resumeInFlightRef.current = true;
    setResumingGeneration(true);
    setGenerationStalled(false);
    onReadyCalledRef.current = false; // Reset so onReady can fire again for this new attempt

    const meta = (currentTrip.metadata as Record<string, unknown>) || {};
    const completedDays = (meta.generation_completed_days as number) || 0;
    // Recompute expected days from canonical trip dates instead of trusting
    // potentially stale/inflated metadata.generation_total_days
    const canonicalTotalDays = currentTrip.start_date && currentTrip.end_date
      ? differenceInDays(parseLocalDate(currentTrip.end_date), parseLocalDate(currentTrip.start_date)) + 1
      : 0;
    const metaTotalDays = (meta.generation_total_days as number) || 0;
    // Use canonical date-derived count as source of truth; fall back to metadata only if dates are missing
    const totalDays = canonicalTotalDays > 0 ? canonicalTotalDays : metaTotalDays;

    try {
      // Reset status to generating with fresh heartbeat + normalize total days
      await supabase.from('trips').update({
        itinerary_status: 'generating',
        metadata: {
          ...meta,
          generation_total_days: totalDays, // Normalize to canonical count
          generation_error: null,
          generation_heartbeat: new Date().toISOString(),
          generation_started_at: new Date().toISOString(),
          chain_broken_at_day: null,  // Clear chain failure
          chain_error: null,           // Clear chain error message
        },
      }).eq('id', tripId);

      // Reload trip to pick up new status
      const { data: refreshed } = await supabase.from('trips').select('*').eq('id', tripId).single();
      if (refreshed) setTrip(refreshed);

      // Call generate-trip which will resume from completedDays+1
      const { error } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          action: 'generate-trip',
          tripId,
          destination: currentTrip.destination,
          destinationCountry: (currentTrip as any).destination_country,
          startDate: currentTrip.start_date,
          endDate: currentTrip.end_date,
          travelers: currentTrip.travelers || 1,
          tripType: currentTrip.trip_type,
          budgetTier: (currentTrip as any).budget_tier,
          isMultiCity: !!(currentTrip as any).is_multi_city,
          creditsCharged: 0, // Already charged, no new charge
          requestedDays: totalDays,
          resumeFromDay: completedDays + 1, // Signal to backend to skip completed days
        },
      });

      if (error) throw error;
      toast.success('Resuming generation…');
    } catch (err) {
      console.error('[Resume] Failed:', err);
      toast.error('Failed to resume generation. Please try again.');
      setGenerationStalled(true);
    } finally {
      resumeInFlightRef.current = false;
      setResumingGeneration(false);
    }
  }, [tripId]);
  // =========================================================================
  // HOTEL ENRICHMENT: Auto-enrich if missing address/website/photos
  // =========================================================================
  const enrichHotelIfNeeded = useCallback(async () => {
    if (!trip || hotelEnrichmentAttempted.current) return;

    const cleanDestination = (trip.destination || '')
      .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
      .trim();

    // --- Path A: Enrich primary hotel from trips.hotel_selection (single-city) ---
    const hotelRaw = trip.hotel_selection as unknown;
    const hotels = normalizeLegacyHotelSelection(hotelRaw, trip.start_date, trip.end_date);
    const primaryHotel: HotelBooking | undefined = hotels[0];

    if (primaryHotel?.name) {
      const hasAddress = !!primaryHotel.address;
      const hasWebsite = !!primaryHotel.website;
      const hasPhotos = Array.isArray(primaryHotel.images) && primaryHotel.images.length > 0;

      if (!(hasAddress && hasWebsite && hasPhotos)) {
        hotelEnrichmentAttempted.current = true;

        const enrichment = await enrichHotel(primaryHotel.name as string, cleanDestination);
        if (enrichment) {
          const enrichedHotel = {
            ...primaryHotel,
            address: enrichment.address || primaryHotel.address,
            website: enrichment.website || primaryHotel.website,
            googleMapsUrl: enrichment.googleMapsUrl || primaryHotel.googleMapsUrl,
            images: (enrichment.photos && enrichment.photos.length > 0)
              ? enrichment.photos
              : primaryHotel.images,
            placeId: enrichment.placeId || primaryHotel.placeId,
            rating: enrichment.rating || (primaryHotel as any).rating,
          };

          const updatedHotels = hotels.map((h, idx) => (idx === 0 ? enrichedHotel : h));
          setTrip(prev => (prev ? { ...prev, hotel_selection: updatedHotels as any } : prev));

          if (tripId) {
            try {
              await supabase
                .from('trips')
                .update({ hotel_selection: updatedHotels as any, updated_at: new Date().toISOString() })
                .eq('id', tripId);
            } catch (err) {
              console.error('[TripDetail] Error persisting enriched hotel:', err);
            }
          }
        }
        return;
      }
    }

    // --- Path B: Enrich per-city hotels from trip_cities (multi-city) ---
    if (tripCities.length > 0) {
      let anyEnriched = false;
      for (const city of tripCities) {
        const cityHotelRaw = city.hotel_selection as any;
        const cityHotel = Array.isArray(cityHotelRaw) && cityHotelRaw.length > 0 ? cityHotelRaw[0] : cityHotelRaw;
        if (!cityHotel?.name) continue;

        const hasPhotos = Array.isArray(cityHotel.images) && cityHotel.images.length > 0;
        const hasWebsite = !!cityHotel.website;
        if (hasPhotos && hasWebsite) continue;

        const cityDest = (city.city_name || '').replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim();
        const enrichment = await enrichHotel(cityHotel.name, cityDest || cleanDestination);
        if (!enrichment) continue;

        const enrichedCityHotel = {
          ...cityHotel,
          address: enrichment.address || cityHotel.address,
          website: enrichment.website || cityHotel.website,
          googleMapsUrl: enrichment.googleMapsUrl || cityHotel.googleMapsUrl,
          images: (enrichment.photos?.length) ? enrichment.photos : cityHotel.images,
          imageUrl: (enrichment.photos?.length) ? enrichment.photos[0] : cityHotel.imageUrl,
          placeId: enrichment.placeId || cityHotel.placeId,
          rating: enrichment.rating || cityHotel.rating,
        };

        const updatedSelection = Array.isArray(cityHotelRaw)
          ? [enrichedCityHotel, ...cityHotelRaw.slice(1)]
          : [enrichedCityHotel];

        try {
          await supabase
            .from('trip_cities')
            .update({ hotel_selection: updatedSelection as any })
            .eq('id', city.id);
          anyEnriched = true;
        } catch (err) {
          console.error(`[TripDetail] Failed to enrich city hotel for ${city.city_name}:`, err);
        }
      }

      if (anyEnriched) {
        try {
          const updated = await getTripCities(tripId);
          setTripCities(updated);
        } catch { /* non-critical */ }
      }
    }

    hotelEnrichmentAttempted.current = true;
  }, [trip, tripId, tripCities]);

  // Trigger hotel enrichment when trip loads
  useEffect(() => {
    if (trip && !loading) {
      enrichHotelIfNeeded();
    }
  }, [trip, loading, enrichHotelIfNeeded]);

  // Sync local trip to database before generating itinerary
  const syncTripToDatabase = async (localTrip: Trip): Promise<boolean> => {
    if (!user?.id) {
      console.log('[TripDetail] Cannot sync - no authenticated user');
      return false;
    }

    try {
      setIsSyncingTrip(true);
      console.log('[TripDetail] Syncing local trip to database:', localTrip.id);

      const tripData = {
        id: localTrip.id,
        user_id: user.id,
        name: localTrip.name,
        destination: localTrip.destination,
        destination_country: localTrip.destination_country,
        start_date: localTrip.start_date,
        end_date: localTrip.end_date,
        status: localTrip.status || 'draft',
        trip_type: localTrip.trip_type,
        travelers: localTrip.travelers || 1,
        origin_city: localTrip.origin_city,
        budget_tier: localTrip.budget_tier,
        flight_selection: localTrip.flight_selection,
        hotel_selection: localTrip.hotel_selection,
        itinerary_data: localTrip.itinerary_data,
        metadata: localTrip.metadata,
      };

      const { data, error: upsertError } = await supabase
        .from('trips')
        .upsert(tripData as any, { onConflict: 'id' })
        .select()
        .single();

      if (upsertError) {
        console.error('[TripDetail] Failed to sync trip:', upsertError);
        return false;
      }

      console.log('[TripDetail] Trip synced successfully:', data.id);
      // Update local state with synced trip
      setTrip(data);
      return true;
    } catch (err) {
      console.error('[TripDetail] Sync error:', err);
      return false;
    } finally {
      setIsSyncingTrip(false);
    }
  };

  // Handle clicking "Generate Itinerary" - ensure trip is in DB first
  const handleShowGenerator = async (autoStart = false) => {
    if (!trip) return;

    // Check if trip is only in localStorage (user_id is 'local' or missing)
    const isLocalOnly = trip.user_id === 'local' || !trip.user_id;

    if (isLocalOnly) {
      const synced = await syncTripToDatabase(trip);
      if (!synced) {
        console.error('[TripDetail] Could not sync trip to database');
        // Still try to show generator - might work if user is logged in
      }
    }

    setAutoStartGeneration(autoStart);
    setShowGenerator(true);
  };

  // Auto-trigger generation when ?generate=true is in URL
  // Poll for queued → generating transition (journey legs)
  // FIX: Poll BOTH the previous leg readiness AND current leg status continuously
  const queuedLegInvokedRef = useRef(false);
  useEffect(() => {
    if (!isQueuedJourneyLeg || !trip?.id || !trip?.journey_id) return;
    // Reset invoke guard when trip id changes
    queuedLegInvokedRef.current = false;

    let cancelled = false;

    const triggerGeneration = async () => {
      if (queuedLegInvokedRef.current || cancelled) return;
      queuedLegInvokedRef.current = true;

      console.log(`[TripDetail] Previous leg ready — triggering generation for ${trip.id}`);
      try {
        const { data: fullTrip } = await supabase
          .from('trips')
          .select('destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city, user_id')
          .eq('id', trip.id)
          .single();

        if (!fullTrip) {
          console.error('[TripDetail] Could not fetch full trip data for queued leg');
          queuedLegInvokedRef.current = false;
          return;
        }

        const { error: invokeErr } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-trip',
            tripId: trip.id,
            userId: fullTrip.user_id,
            destination: fullTrip.destination,
            destinationCountry: fullTrip.destination_country || '',
            startDate: fullTrip.start_date,
            endDate: fullTrip.end_date,
            travelers: fullTrip.travelers || 1,
            tripType: fullTrip.trip_type || 'vacation',
            budgetTier: fullTrip.budget_tier || 'moderate',
            isMultiCity: fullTrip.is_multi_city || false,
            creditsCharged: 0, // Already charged on leg 1
          },
        });

        if (invokeErr) {
          console.error('[TripDetail] Failed to trigger queued leg generation:', invokeErr);
          queuedLegInvokedRef.current = false;
          return;
        }

        // Direct local state refresh from DB
        const { data: refreshedTrip } = await supabase
          .from('trips')
          .select('*')
          .eq('id', trip.id)
          .single();
        if (refreshedTrip && !cancelled) {
          setTrip(refreshedTrip as Trip);
        }
        queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
        handleShowGenerator(true);
      } catch (err) {
        console.error('[TripDetail] Failed to trigger queued leg generation:', err);
        queuedLegInvokedRef.current = false;
      }
    };

    // Poll both previous leg AND current leg status every 5 seconds
    const pollInterval = setInterval(async () => {
      if (cancelled) return;

      // 1) Check if current leg is no longer queued (backend may have started it via triggerNextJourneyLeg)
      const { data: currentLeg } = await supabase
        .from('trips')
        .select('itinerary_status')
        .eq('id', trip.id)
        .single();

      if (currentLeg && currentLeg.itinerary_status !== 'queued') {
        console.log(`[TripDetail] Queued leg ${trip.id} status changed to: ${currentLeg.itinerary_status}`);
        // Direct local state refresh
        const { data: refreshedTrip } = await supabase
          .from('trips')
          .select('*')
          .eq('id', trip.id)
          .single();
        if (refreshedTrip && !cancelled) {
          setTrip(refreshedTrip as Trip);
        }
        queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
        if (currentLeg.itinerary_status === 'generating') {
          handleShowGenerator(true);
        }
        return;
      }

      // 2) Check if previous leg is ready — if so, trigger generation ourselves
      const prevOrder = (trip.journey_order || 1) - 1;
      if (prevOrder < 1) return;

      const { data: prevLeg } = await supabase
        .from('trips')
        .select('itinerary_status')
        .eq('journey_id', trip.journey_id!)
        .eq('journey_order', prevOrder)
        .single();

      if (prevLeg && (prevLeg.itinerary_status === 'ready' || (prevLeg.itinerary_status as string) === 'complete' || (prevLeg.itinerary_status as string) === 'generated')) {
        await triggerGeneration();
      }
    }, 5000);

    // Immediate check on mount
    (async () => {
      const prevOrder = (trip.journey_order || 1) - 1;
      if (prevOrder < 1) return;

      const { data: prevLeg } = await supabase
        .from('trips')
        .select('itinerary_status')
        .eq('journey_id', trip.journey_id!)
        .eq('journey_order', prevOrder)
        .single();

      if (prevLeg && (prevLeg.itinerary_status === 'ready' || (prevLeg.itinerary_status as string) === 'complete' || (prevLeg.itinerary_status as string) === 'generated')) {
        await triggerGeneration();
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [isQueuedJourneyLeg, trip?.id, trip?.journey_id, trip?.journey_order, queryClient]);

  // ── Stuck journey leg self-heal ──
  // If a journey leg shows itinerary_status='generating' but has no heartbeat,
  // no generation_started_at, and no saved days, it's stuck from a failed handoff.
  // Auto-recover by re-triggering generate-trip with full payload.
  const stuckHealAttempted = useRef(false);
  useEffect(() => {
    if (!trip?.journey_id || !trip?.id || stuckHealAttempted.current) return;
    if (trip.itinerary_status !== 'generating') return;

    const meta = (trip.metadata as Record<string, unknown>) || {};
    const heartbeat = meta.generation_heartbeat as string | undefined;
    const startedAt = meta.generation_started_at as string | undefined;
    const completedDays = (meta.generation_completed_days as number) || 0;

    // Check staleness: no heartbeat or heartbeat older than 3 minutes, no completed days
    const isStale = !heartbeat || (Date.now() - new Date(heartbeat).getTime() > 3 * 60 * 1000);
    const hasNoProgress = completedDays === 0 && !startedAt;

    if (!isStale && !hasNoProgress) return;

    // Extra guard: check if there are any itinerary_days saved
    (async () => {
      const { count } = await supabase
        .from('itinerary_days')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', trip.id);

      if ((count ?? 0) > 0) {
        // Has days in table — check if itinerary_data also has days with REAL activities (not empty placeholders)
        const itinData = (trip.itinerary_data as { days?: any[] }) || {};
        const allDays = Array.isArray(itinData.days) ? itinData.days : [];
        // Only count days that have actual activities (not empty placeholders)
        const realDays = allDays.filter((d: any) => 
          Array.isArray(d?.activities) && d.activities.length > 0 && d.status !== 'placeholder'
        );
        // Compute expected day count from trip dates
        let expectedDayCount = 0;
        if (trip.start_date && trip.end_date) {
          try {
            expectedDayCount = differenceInDays(
              parseLocalDate(trip.end_date),
              parseLocalDate(trip.start_date)
            ) + 1;
          } catch { expectedDayCount = 0; }
        }
        if (!expectedDayCount) {
          expectedDayCount = ((trip.metadata as any)?.generation_total_days) || allDays.length;
        }
        if (realDays.length >= expectedDayCount && expectedDayCount > 0) {
          // All days have real activities — generation truly completed, fix stale status
          console.log(`[TripDetail] Stuck-heal: ${realDays.length}/${expectedDayCount} real days complete — correcting to 'ready'`);
          stuckHealAttempted.current = true;
          await supabase.from('trips').update({
            itinerary_status: 'ready',
            updated_at: new Date().toISOString(),
          }).eq('id', trip.id);
          queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
        } else {
          console.log(`[TripDetail] Stuck-heal: only ${realDays.length}/${expectedDayCount} real days — NOT marking as ready (generation still in progress)`);
        }
        return; // Has progress, not stuck
      }

      stuckHealAttempted.current = true;
      console.log(`[TripDetail] Detected stuck journey leg ${trip.id} — attempting self-heal`);

      try {
        const { data: fullTrip } = await supabase
          .from('trips')
          .select('destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, is_multi_city, user_id')
          .eq('id', trip.id)
          .single();

        if (!fullTrip) return;

        const { error: invokeErr } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-trip',
            tripId: trip.id,
            userId: fullTrip.user_id,
            destination: fullTrip.destination,
            destinationCountry: fullTrip.destination_country || '',
            startDate: fullTrip.start_date,
            endDate: fullTrip.end_date,
            travelers: fullTrip.travelers || 1,
            tripType: fullTrip.trip_type || 'vacation',
            budgetTier: fullTrip.budget_tier || 'moderate',
            isMultiCity: fullTrip.is_multi_city || false,
            creditsCharged: 0,
          },
        });

        if (invokeErr) {
          console.error('[TripDetail] Stuck-leg self-heal invoke failed:', invokeErr);
          return;
        }

        console.log(`[TripDetail] Stuck-leg self-heal triggered for ${trip.id}`);
        queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
        handleShowGenerator(true);
      } catch (err) {
        console.error('[TripDetail] Stuck-leg self-heal error:', err);
      }
    })();
  }, [trip?.id, trip?.journey_id, trip?.itinerary_status, trip?.metadata, queryClient]);

  // Auto-trigger generation only when ?generate=true is present
  useEffect(() => {
    if (
      shouldAutoGenerate &&
      trip && 
      !loading && 
      !autoGenerateTriggered.current &&
      !isServerGenerating &&
      trip.itinerary_status !== 'generating' &&
      trip.itinerary_status !== 'queued' &&
      (!hasItineraryData(trip) || trip.itinerary_status === 'failed')
    ) {
      autoGenerateTriggered.current = true;
      // Clean up URL param immediately to prevent re-trigger
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('generate');
        return next;
      }, { replace: true });
      handleShowGenerator(true);
    }
  }, [shouldAutoGenerate, trip, loading, isServerGenerating]);

  // Separate effect: clean up URL param if generation is already in progress
  useEffect(() => {
    if (shouldAutoGenerate && trip && (isServerGenerating || trip.itinerary_status === 'generating' || trip.itinerary_status === 'queued')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('generate');
        return next;
      }, { replace: true });
    }
  }, [shouldAutoGenerate, trip, isServerGenerating]);

  // Helper to check if trip has itinerary data with real activities (not just shell days)
  function hasItineraryData(t: Trip | null): boolean {
    if (!t) return false;
    const meta = t.itinerary_data as Record<string, unknown> | null;
    if (!meta) return false;
    // Check canonical top-level days first
    const rawDays = meta.days as any[] | undefined;
    if (Array.isArray(rawDays) && rawDays.length > 0) {
      // Verify at least one day has real activities (not just shell/theme data)
      const hasRealActivities = rawDays.some(
        (d: any) => Array.isArray(d.activities) && d.activities.length > 0
      );
      return hasRealActivities;
    }
    // Fallback: check nested itinerary.days (backward compat with older saves)
    const nested = meta.itinerary as Record<string, unknown> | undefined;
    if (Array.isArray(nested?.days) && (nested.days as any[]).length > 0) {
      return (nested.days as any[]).some(
        (d: any) => Array.isArray(d.activities) && d.activities.length > 0
      );
    }
    return false;
  }

  const loadLocalTrip = (id: string): Trip | null => {
    try {
      // Primary storage: voyance_local_trips (TripPlannerContext)
      const localTripsRaw = localStorage.getItem('voyance_local_trips');
      if (localTripsRaw) {
        const localTrips = JSON.parse(localTripsRaw);
        if (localTrips?.[id]) {
          const parsed = localTrips[id];
          return {
            id,
            user_id: parsed.user_id || 'local',
            name: parsed.name || `Trip to ${parsed.destination}`,
            destination: parsed.destination,
            destination_country: parsed.destination_country || null,
            start_date: parsed.start_date || parsed.startDate,
            end_date: parsed.end_date || parsed.endDate,
            status: parsed.status || 'draft',
            trip_type: parsed.trip_type || parsed.tripType || null,
            travelers: parsed.travelers || 1,
            origin_city: parsed.origin_city || parsed.originCity || null,
            budget_tier: parsed.budget_tier || parsed.budgetTier || null,
            flight_selection: parsed.flight_selection || null,
            hotel_selection: parsed.hotel_selection || null,
            itinerary_data: parsed.itinerary_data || null,
            itinerary_status: parsed.itinerary_status || null,
            metadata: parsed.metadata || null,
            price_lock_expires_at: null,
            created_at: parsed.created_at || new Date().toISOString(),
            updated_at: parsed.updated_at || new Date().toISOString(),
          } as unknown as Trip;
        }
      }

      // Fallback: voyance_demo_trips (legacy)
      const demoTripsRaw = localStorage.getItem('voyance_demo_trips');
      if (demoTripsRaw) {
        const demoTrips = JSON.parse(demoTripsRaw);
        if (demoTrips?.[id]) return demoTrips[id] as Trip;
      }

      // Legacy anonymous format: trip_${id}
      const legacyRaw = localStorage.getItem(`trip_${id}`);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed?.destination && (parsed?.startDate || parsed?.start_date) && (parsed?.endDate || parsed?.end_date)) {
          return {
            id,
            user_id: 'local',
            name: parsed.name || `Trip to ${parsed.destination}`,
            destination: parsed.destination,
            destination_country: parsed.destination_country || null,
            start_date: parsed.start_date || parsed.startDate,
            end_date: parsed.end_date || parsed.endDate,
            status: parsed.status || 'draft',
            trip_type: parsed.trip_type || parsed.tripType || null,
            travelers: parsed.travelers || 1,
            origin_city: parsed.origin_city || parsed.originCity || null,
            budget_tier: parsed.budget_tier || parsed.budgetTier || null,
            flight_selection: parsed.flight_selection || parsed.flights || null,
            hotel_selection: parsed.hotel_selection || parsed.hotel || null,
            itinerary_data: parsed.itinerary_data || (parsed.itinerary ? { days: parsed.itinerary } : null),
            itinerary_status: null,
            metadata: parsed.metadata || null,
            price_lock_expires_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as unknown as Trip;
        }
      }
    } catch (err) {
      console.error('[TripDetail] Error loading local trip:', err);
    }

    return null;
  };

  useEffect(() => {
    async function fetchTripData() {
      if (!tripId) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch trip details (don't use .single() to avoid hard failure on 0 rows)
        let { data: tripData, error: tripError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .maybeSingle();

        if (tripError) throw tripError;

        // If backend doesn't have the trip (common for demo/anonymous flows), fall back to local storage
        if (!tripData) {
          const localTrip = loadLocalTrip(tripId);
          if (localTrip) {
            setTrip(localTrip);
            setActivities([]);

            // Fetch destination metadata (currency, etc.) for local trips too
            try {
              const cleanDestination = (localTrip.destination || '')
                .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
                .trim();
              if (cleanDestination) {
                const dest = await getDestinationByCity(cleanDestination);
                setDestinationMeta(dest);
              } else {
                setDestinationMeta(null);
              }
            } catch (e) {
              console.warn('[TripDetail] Destination metadata lookup failed (local trip):', e);
              setDestinationMeta(null);
            }
            return;
          }

          setTrip(null);
          setError('Trip not found');
          return;
        }

        setTrip(tripData);

        // Check itinerary_days count for generation state detection
        let itineraryDaysDbCount = 0;
        try {
          const { data: daysSummary, count: daysCount } = await supabase
            .from('itinerary_days')
            .select('day_number, title, theme', { count: 'exact' })
            .eq('trip_id', tripId)
            .order('day_number');
          itineraryDaysDbCount = daysCount || 0;
          setItineraryDaysCount(itineraryDaysDbCount);
          setItineraryDaysSummaries((daysSummary || []).map((d: any) => ({
            day_number: d.day_number,
            title: d.title || `Day ${d.day_number}`,
            theme: d.theme || '',
          })));
        } catch (e) {
          console.warn('[TripDetail] itinerary_days check failed:', e);
        }

        // Self-heal: auto-correct stale 'generating' status if itinerary_data is complete
        if (tripData.itinerary_status === 'generating') {
          const staleItinData = tripData.itinerary_data as { days?: any[] } | null;
          // Compute canonical expected days from trip dates
          let canonicalExpected = 0;
          if (tripData.start_date && tripData.end_date) {
            try {
              canonicalExpected = differenceInDays(
                parseLocalDate(tripData.end_date),
                parseLocalDate(tripData.start_date)
              ) + 1;
            } catch { canonicalExpected = 0; }
          }
          const effectiveExpected = canonicalExpected > 0 ? canonicalExpected : ((tripData.metadata as any)?.generation_total_days || 0);
          // Only mark ready if we have ALL expected days WITH REAL ACTIVITIES (not empty placeholders)
          const staleAllDays = Array.isArray(staleItinData?.days) ? staleItinData!.days : [];
          const staleRealDays = staleAllDays.filter((d: any) => 
            Array.isArray(d?.activities) && d.activities.length > 0 && d.status !== 'placeholder'
          );
          const realDayCount = Math.max(staleRealDays.length, itineraryDaysDbCount);
          if (effectiveExpected > 0 && realDayCount >= effectiveExpected) {
            console.warn(`[TripDetail] Self-heal: status is 'generating' but ${realDayCount} real days exist (expected ${effectiveExpected}) — correcting to 'ready'`);
            if (tripId) {
              supabase.from('trips').update({
                itinerary_status: 'ready',
                metadata: { ...(tripData.metadata as any || {}), generation_total_days: effectiveExpected },
                updated_at: new Date().toISOString(),
              }).eq('id', tripId).then(() => {});
            }
            tripData = { ...tripData, itinerary_status: 'ready' };
            setTrip(tripData);
          } else if (effectiveExpected > 0) {
            console.log(`[TripDetail] Self-heal: only ${realDayCount}/${effectiveExpected} real days — NOT marking as ready`);
          }
        }

        // Self-heal: detect corrupted ready+partial state
        // If itinerary_status is 'ready' but day count < expected, trigger stalled/resume
        // Also correct inflated metadata.generation_total_days from canonical dates
        // AND rebuild itinerary_data.days from itinerary_days if JSON is truncated
        if (tripData.itinerary_status === 'ready' || (tripData.itinerary_status as string) === 'generated') {
          const itinData = tripData.itinerary_data as { days?: unknown[]; [key: string]: unknown } | null;
          const jsonDayCount = itinData?.days?.length ?? 0;
          const actualDays = Math.max(jsonDayCount, itineraryDaysDbCount);
          const meta = (tripData.metadata as Record<string, unknown>) || {};
          // Always recompute from canonical dates first
          let expectedTotal = 0;
          if (tripData.start_date && tripData.end_date) {
            try {
              expectedTotal = differenceInDays(
                parseLocalDate(tripData.end_date),
                parseLocalDate(tripData.start_date)
              ) + 1;
            } catch { expectedTotal = 0; }
          }
          // Fall back to metadata only if dates don't yield a valid count
          if (expectedTotal <= 0) {
            expectedTotal = (meta.generation_total_days as number) || 0;
          }
          // Correct inflated metadata if it disagrees with canonical dates
          const metaTotal = (meta.generation_total_days as number) || 0;
          if (expectedTotal > 0 && metaTotal > 0 && metaTotal !== expectedTotal && tripId) {
            console.warn(`[TripDetail] Self-heal: correcting metadata.generation_total_days from ${metaTotal} to ${expectedTotal}`);
            supabase.from('trips').update({
              metadata: { ...meta, generation_total_days: expectedTotal },
            }).eq('id', tripId).then(() => {});
          }

          // ── SELF-HEAL: Rebuild itinerary_data.days from itinerary_days table ──
          // Only rebuild if the table has ACTUAL activity data (via itinerary_activities).
          // Never overwrite populated JSON days with empty table-backed days.
          if (jsonDayCount > 0 && itineraryDaysDbCount > jsonDayCount && tripId) {
            console.warn(
              `[TripDetail] Self-heal: itinerary_data.days (${jsonDayCount}) < itinerary_days table (${itineraryDaysDbCount}). Rebuilding from table.`
            );
            try {
              // Rebuild directly from itinerary_days — the table stores embedded activities
              {
                const { data: fullDayRows } = await supabase
                  .from('itinerary_days')
                  .select('day_number, date, title, theme, description, weather, activities')
                  .eq('trip_id', tripId)
                  .order('day_number');

                if (fullDayRows && fullDayRows.length > jsonDayCount) {
                  const jsonDaysByNumber = new Map<number, any>();
                  for (const d of (itinData?.days || []) as any[]) {
                    if (d?.dayNumber) jsonDaysByNumber.set(d.dayNumber, d);
                  }

                  const rebuiltDays = fullDayRows.map((row: any) => {
                    const existingJsonDay = jsonDaysByNumber.get(row.day_number);
                    const jsonActivities = existingJsonDay?.activities;
                    const tableActivities = Array.isArray(row.activities) ? row.activities : [];
                    
                    const hasJsonActivities = Array.isArray(jsonActivities) && jsonActivities.length > 0;
                    const hasTableActivities = tableActivities.length > 0;
                    
                    if (existingJsonDay && hasJsonActivities) {
                      return existingJsonDay;
                    }
                    if (existingJsonDay && !hasJsonActivities && hasTableActivities) {
                      return { ...existingJsonDay, activities: tableActivities };
                    }
                    if (existingJsonDay) {
                      return existingJsonDay;
                    }
                    return {
                      dayNumber: row.day_number,
                      date: row.date,
                      theme: row.theme || row.title || `Day ${row.day_number}`,
                      description: row.description || '',
                      weather: row.weather || undefined,
                      activities: tableActivities,
                    };
                  });

                  const healedItinerary = {
                    ...(itinData || {}),
                    days: rebuiltDays,
                  };

                  console.log(`[TripDetail] Self-heal: persisting rebuilt itinerary_data with ${rebuiltDays.length} days (was ${jsonDayCount})`);
                  await supabase.from('trips').update({
                    itinerary_data: healedItinerary as any,
                    updated_at: new Date().toISOString(),
                  }).eq('id', tripId);

                  const healedTripData = { ...tripData, itinerary_data: healedItinerary as any };
                  setTrip(healedTripData);
                }
              }
            } catch (healErr) {
              console.error('[TripDetail] Self-heal rebuild failed:', healErr);
            }
          }

          if (expectedTotal > 0 && actualDays > 0 && actualDays < expectedTotal) {
            console.warn(`[TripDetail] Self-heal: trip marked ready but only ${actualDays}/${expectedTotal} days. Triggering resume.`);
            // Auto-retry once before showing stalled UI to the user
            if (!autoResumeAttemptedRef.current) {
              autoResumeAttemptedRef.current = true;
              console.log('[TripDetail] Auto-resuming incomplete generation (first attempt)');
              setTimeout(() => {
                handleResumeGeneration();
              }, 1500);
            } else {
              setGenerationStalled(true);
            }
          }

          // ── SELF-HEAL: Detect days that are unplanned ("empty" or missing entirely) ──
          // Fires whenever generation is no longer running, regardless of whether
          // actualDays reached expectedTotal. Previously this was gated on
          // `actualDays >= expectedTotal`, which meant trips that ended early
          // (e.g. 23/25 days produced) silently left days 24 & 25 unplanned forever.
          const generationFinished =
            tripData?.itinerary_status !== 'generating' &&
            tripData?.itinerary_status !== 'queued';

          if (expectedTotal > 0 && generationFinished && !emptyDayHealAttemptedRef.current) {
            const daysList = (itinData?.days || []) as Array<{ dayNumber?: number; activities?: unknown[] }>;
            const presentDayNumbers = new Set<number>();
            const emptyDayNumbers: number[] = [];
            for (const day of daysList) {
              if (day.dayNumber) {
                presentDayNumbers.add(day.dayNumber);
                const acts = Array.isArray(day.activities) ? day.activities : [];
                if (acts.length === 0) emptyDayNumbers.push(day.dayNumber);
              }
            }
            // Days that should exist but are missing entirely from the array
            for (let n = 1; n <= expectedTotal; n++) {
              if (!presentDayNumbers.has(n)) emptyDayNumbers.push(n);
            }
            emptyDayNumbers.sort((a, b) => a - b);

            if (emptyDayNumbers.length > 0 && emptyDayNumbers.length < expectedTotal) {
              emptyDayHealAttemptedRef.current = true;
              console.warn(`[TripDetail] Self-heal: ${emptyDayNumbers.length} unplanned days (days: ${emptyDayNumbers.join(', ')}). Attempting version-history restore first.`);

              setTimeout(async () => {
                try {
                  // Dynamically import to avoid circular deps
                  const { getLatestNonEmptyVersion } = await import('@/services/itineraryVersionHistory');

                  const { data: latestTrip } = await supabase
                    .from('trips')
                    .select('itinerary_data')
                    .eq('id', tripId!)
                    .single();

                  const currentItinData = (latestTrip?.itinerary_data as any) || itinData || {};
                  const currentDays = [...(currentItinData.days || [])] as any[];
                  let restoredCount = 0;
                  const unresolvedDays: number[] = [];

                  for (const dayNum of emptyDayNumbers) {
                    // Step 1: Try restoring from version history
                    const snapshot = await getLatestNonEmptyVersion(tripId!, dayNum);
                    if (snapshot && Array.isArray(snapshot.activities) && snapshot.activities.length > 0) {
                      console.log(`[TripDetail] Self-heal: Restored day ${dayNum} from version history (${snapshot.activities.length} activities, v${snapshot.version_number})`);
                      const idx = currentDays.findIndex((d: any) => d.dayNumber === dayNum);
                      // Compute date for this day from trip start_date
                      let dayDate: string | undefined;
                      try {
                        if (tripData?.start_date) {
                          const start = parseLocalDate(tripData.start_date);
                          const d = new Date(start);
                          d.setDate(start.getDate() + (dayNum - 1));
                          dayDate = d.toISOString().slice(0, 10);
                        }
                      } catch {}

                      if (idx >= 0) {
                        currentDays[idx] = {
                          ...currentDays[idx],
                          activities: snapshot.activities,
                          ...(snapshot.day_metadata?.title ? { theme: snapshot.day_metadata.title } : {}),
                        };
                      } else {
                        // Day was missing entirely — insert it
                        currentDays.push({
                          dayNumber: dayNum,
                          date: dayDate,
                          theme: snapshot.day_metadata?.title || `Day ${dayNum}`,
                          activities: snapshot.activities,
                        });
                      }
                      restoredCount++;
                    } else {
                      unresolvedDays.push(dayNum);
                    }
                  }

                  currentDays.sort((a: any, b: any) => (a.dayNumber || 0) - (b.dayNumber || 0));

                  // Save restored days back if any were recovered
                  if (restoredCount > 0) {
                    const mergedItinerary = { ...currentItinData, days: currentDays };
                    try {
                      await supabase.functions.invoke('generate-itinerary', {
                        body: {
                          action: 'save-itinerary',
                          tripId: tripId!,
                          itinerary: mergedItinerary,
                        },
                      });
                    } catch (saveErr) {
                      console.error('[TripDetail] Backend save after version restore failed, falling back to direct write:', saveErr);
                      await supabase.from('trips').update({
                        itinerary_data: mergedItinerary as any,
                        updated_at: new Date().toISOString(),
                      }).eq('id', tripId!);
                    }
                    queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
                    toast.success(`Restored ${restoredCount} day${restoredCount > 1 ? 's' : ''} from history`);
                  }

                  // Step 2: For days with NO version history, materialize empty placeholders
                  // and surface a banner. NEVER silently auto-regenerate — that hides credit
                  // charges and surprises users. The user must explicitly approve a build.
                  if (unresolvedDays.length > 0) {
                    console.warn(`[TripDetail] Self-heal: ${unresolvedDays.length} unplanned days with no history (days: ${unresolvedDays.join(', ')}). Materializing placeholders.`);
                    const { data: freshTrip } = await supabase
                      .from('trips')
                      .select('itinerary_data')
                      .eq('id', tripId!)
                      .single();
                    const freshItinData = (freshTrip?.itinerary_data as any) || currentItinData;
                    const freshDays = [...(freshItinData.days || [])] as any[];

                    for (const dayNum of unresolvedDays) {
                      let dayDate: string | undefined;
                      try {
                        if (tripData?.start_date) {
                          const start = parseLocalDate(tripData.start_date);
                          const d = new Date(start);
                          d.setDate(start.getDate() + (dayNum - 1));
                          dayDate = d.toISOString().slice(0, 10);
                        }
                      } catch {}
                      const idx = freshDays.findIndex((d: any) => d.dayNumber === dayNum);
                      if (idx < 0) {
                        freshDays.push({
                          dayNumber: dayNum,
                          date: dayDate,
                          theme: '',
                          activities: [],
                          metadata: { heal_origin: 'incomplete_generation' },
                        });
                      }
                    }
                    freshDays.sort((a: any, b: any) => (a.dayNumber || 0) - (b.dayNumber || 0));

                    const mergedFresh = { ...freshItinData, days: freshDays };
                    try {
                      await supabase.functions.invoke('generate-itinerary', {
                        body: { action: 'save-itinerary', tripId: tripId!, itinerary: mergedFresh },
                      });
                    } catch (saveErr) {
                      console.error('[TripDetail] Backend save after placeholder materialization failed:', saveErr);
                      await supabase.from('trips').update({
                        itinerary_data: mergedFresh as any,
                        updated_at: new Date().toISOString(),
                      }).eq('id', tripId!);
                    }
                    queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
                    setIncompleteDays(unresolvedDays);
                  }
                } catch (err) {
                  console.error('[TripDetail] Self-heal (version restore + placeholders) failed:', err);
                  emptyDayHealAttemptedRef.current = false;
                }
              }, 2000);
            }
          }
        }

        // Seed optimistic locking version cache
        if (tripData?.id) {
          setCachedVersion(tripData.id, (tripData as any).itinerary_version ?? 1);
        }

        // Load trip_cities for multi-city detection & per-city hotel/transport display
        try {
          const cities = await getTripCities(tripId);
          setTripCities(cities);
        } catch (e) {
          console.warn('[TripDetail] trip_cities load failed:', e);
          setTripCities([]);
        }

        // Check for collaborators to show chat tab
        if (user?.id) {
          const { count } = await supabase
            .from('trip_collaborators')
            .select('id', { count: 'exact', head: true })
            .eq('trip_id', tripId);
          setHasCollaborators((count || 0) > 0);
        }

        // Fetch destination metadata so itinerary can show correct local currency (EUR for Rome)
        try {
          const cleanDestination = (tripData.destination || '')
            .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
            .trim();
          if (cleanDestination) {
            const dest = await getDestinationByCity(cleanDestination);
            setDestinationMeta(dest);
          } else {
            setDestinationMeta(null);
          }
        } catch (e) {
          console.warn('[TripDetail] Destination metadata lookup failed:', e);
          setDestinationMeta(null);
        }

        // Fetch activities (filter out internal-only activities for client view)
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('trip_activities')
          .select('*')
          .eq('trip_id', tripId)
          .neq('is_client_visible', false) // Exclude internal-only activities
          .order('itinerary_day_id', { ascending: true })
          .order('block_order', { ascending: true });

        if (activitiesError) throw activitiesError;
        setActivities(activitiesData || []);

        // Auto-update trip status if needed
        const now = new Date();
        const startDate = parseLocalDate(tripData.start_date);
        const endDate = parseLocalDate(tripData.end_date);

        if (tripData.status === 'booked' && isAfter(now, startDate) && isBefore(now, endDate)) {
          // Trip should be active - update status and schedule notifications
          await supabase
            .from('trips')
            .update({ status: 'active' })
            .eq('id', tripId);
          setTrip(prev => (prev ? { ...prev, status: 'active' } : null));

          // Schedule notifications for the active trip
          scheduleNotifications.mutate({
            tripId,
            userId: tripData.user_id,
          });
        } else if ((tripData.status === 'active' || tripData.status === 'booked') && isAfter(now, endDate)) {
          // Trip should be completed
          await supabase
            .from('trips')
            .update({ status: 'completed' })
            .eq('id', tripId);
          setTrip(prev => (prev ? { ...prev, status: 'completed' } : null));
        }
      } catch (err) {
        console.error('Error fetching trip:', err);
        setTrip(null);
        setError('Failed to load trip details');
        setDestinationMeta(null);
      } finally {
        setLoading(false);
      }
    }

    fetchTripData();
    return () => {
      if (tripId) clearCachedVersion(tripId);
      autoResumeAttemptedRef.current = false;
      emptyDayHealAttemptedRef.current = false;
    };
  }, [tripId, handleResumeGeneration]);

  // Auto-repair legacy trips with missing activity_costs
  const costRepairAttempted = useRef(false);
  useEffect(() => {
    if (!trip || loading || costRepairAttempted.current || !tripId) return;
    if (!hasItineraryData(trip)) return;
    
    costRepairAttempted.current = true;
    
    // Check if activity_costs rows exist; if not, silently repair
    (async () => {
      try {
        const { needsCostRepair } = await import('@/services/activityCostService');
        const needsRepair = await needsCostRepair(tripId);
        if (needsRepair) {
          console.log('[TripDetail] Legacy trip detected — auto-repairing costs');
          const { repairTripCosts } = await import('@/services/activityCostService');
          const result = await repairTripCosts(tripId);
          if (result.success) {
            console.log(`[TripDetail] Auto-repair complete: ${result.repaired} rows`);
          }
        }
      } catch (err) {
        console.warn('[TripDetail] Auto-repair failed (non-critical):', err);
      }
    })();
  }, [trip, loading, tripId]);

  // Auto-prompt debrief modal for completed trips without feedback
  useEffect(() => {
    if (
      trip?.status === 'completed' &&
      user &&
      !existingLearning &&
      !debriefPromptAttempted.current &&
      !loading
    ) {
      debriefPromptAttempted.current = true;
      const timer = setTimeout(() => {
        setShowDebriefModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [trip?.status, user, existingLearning, loading]);

  // Transform activities into day-based structure
  const transformToItineraryDays = (): ItineraryDay[] => {
    if (!trip) return [];

    // Get itinerary data from trip metadata or activities
    const metadata = trip.itinerary_data as Record<string, unknown> | null;
    const itineraryDays = (metadata?.days as unknown[]) || [];
    
    // If we have structured day data in metadata, use it
    if (itineraryDays.length > 0) {
      return itineraryDays.map((day: unknown, index: number) => {
        const dayData = day as Record<string, unknown>;
        const dayActivities = (dayData.activities as unknown[]) || [];
        
        return {
          dayNumber: index + 1,
          date: (dayData.date as string) || calculateDayDate(trip.start_date, index),
          theme: dayData.theme as string | undefined,
          description: dayData.description as string | undefined,
          activities: dayActivities.map((act: unknown) => {
            const activity = act as Record<string, unknown>;
            const location = activity.location as Record<string, unknown> | undefined;
            return {
              id: (activity.id as string) || crypto.randomUUID(),
              name: (activity.title as string) || (activity.name as string) || 'Activity',
              description: activity.description as string | undefined,
              type: activity.type as string | undefined,
              category: activity.category as string | undefined,
              startTime: activity.startTime as string | undefined || activity.start_time as string | undefined,
              endTime: activity.endTime as string | undefined || activity.end_time as string | undefined,
              location: location ? {
                name: location.name as string | undefined,
                address: location.address as string | undefined,
                lat: location.lat as number | undefined,
                lng: location.lng as number | undefined
              } : undefined,
              imageUrl: activity.imageUrl as string | undefined
            };
          }),
          weather: dayData.weather as { condition?: string; high?: number; low?: number } | undefined
        };
      });
    }

    // Fallback: group activities by day
    const dayMap = new Map<string, TripActivity[]>();
    activities.forEach(act => {
      const dayId = act.itinerary_day_id || 'default';
      if (!dayMap.has(dayId)) {
        dayMap.set(dayId, []);
      }
      dayMap.get(dayId)!.push(act);
    });

    // Convert to array
    const daysArray: ItineraryDay[] = [];
    let dayIndex = 0;
    
    dayMap.forEach((dayActivities) => {
      daysArray.push({
        dayNumber: dayIndex + 1,
        date: calculateDayDate(trip.start_date, dayIndex),
        activities: dayActivities.map(act => ({
          id: act.id,
          name: act.title,
          description: act.description || undefined,
          type: act.type,
          category: (act.metadata as Record<string, unknown>)?.category as string | undefined,
          startTime: act.start_time || undefined,
          endTime: act.end_time || undefined,
          location: {
            name: act.location || undefined,
            address: act.address || undefined,
            lat: act.latitude || undefined,
            lng: act.longitude || undefined
          },
          imageUrl: ((act.photos as string[]) || [])[0]
        }))
      });
      dayIndex++;
    });

    // If no activities, create empty days based on trip dates
    if (daysArray.length === 0) {
      const start = parseLocalDate(trip.start_date);
      const end = parseLocalDate(trip.end_date);
      const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      for (let i = 0; i < dayCount; i++) {
        daysArray.push({
          dayNumber: i + 1,
          date: calculateDayDate(trip.start_date, i),
          activities: []
        });
      }
    }

    return daysArray;
  };

  const calculateDayDate = (startDate: string, dayOffset: number): string => {
    const start = parseLocalDate(startDate);
    const date = new Date(start);
    date.setDate(date.getDate() + dayOffset);
    return format(date, 'yyyy-MM-dd');
  };

  // Check if itinerary has real content
  const hasItinerary = (() => {
    const days = transformToItineraryDays();
    return days.some(d => d.activities.length > 0);
  })();

  // Handle itinerary generation complete - also force-save to backend
  const handleGenerationComplete = useCallback(async (generatedDays: GeneratedDay[], generatedOverview?: TripOverview, isFirstTrip?: boolean) => {
    // Defensive guard: verify all expected days are present before finalizing
    if (tripId) {
      try {
        const { data: currentTrip } = await supabase
          .from('trips')
          .select('metadata, start_date, end_date')
          .eq('id', tripId)
          .maybeSingle();
        const meta = (currentTrip?.metadata as Record<string, unknown>) || {};
        let expectedTotal = (meta.generation_total_days as number) || 0;
        if (expectedTotal <= 0 && currentTrip?.start_date && currentTrip?.end_date) {
          expectedTotal = differenceInDays(
            parseLocalDate(currentTrip.end_date),
            parseLocalDate(currentTrip.start_date)
          ) + 1;
        }
        // If expected is known and days are significantly partial, do NOT finalize — trigger stalled/resume.
        // Allow N-1 tolerance: the backend marks status='ready' when complete, but the JSON blob
        // may lag by one day due to the shrink-guard or write timing. Accepting N-1 prevents
        // infinite resume loops while still catching truly incomplete generations.
        if (expectedTotal > 0 && generatedDays.length < expectedTotal - 1) {
          console.warn(`[TripDetail] handleGenerationComplete called with partial data: ${generatedDays.length}/${expectedTotal} days. Triggering resume instead.`);
          setGenerationStalled(true);
          return;
        }
        if (expectedTotal > 0 && generatedDays.length < expectedTotal) {
          console.info(`[TripDetail] Accepting near-complete itinerary: ${generatedDays.length}/${expectedTotal} days (within N-1 tolerance)`);
        }
      } catch (e) {
        // FAIL-CLOSED: If we can't verify day count, do NOT finalize as ready.
        // Trigger stalled/resume so the user can retry safely.
        console.warn('[TripDetail] handleGenerationComplete guard check failed — failing closed, triggering resume:', e);
        setGenerationStalled(true);
        return;
      }
    }

    // Detect if this is a preview itinerary — only check non-locked days.
    // Locked placeholder days always have isPreview:true but that doesn't mean
    // the actual generated days are previews (e.g., first-trip free 2-day generation).
    const nonLockedDays = generatedDays.filter(d => !(d.metadata as any)?.isLocked);
    const isPreview = nonLockedDays.length > 0
      ? nonLockedDays.every(d => (d.metadata as any)?.isPreview === true)
      : false;
    
    const itineraryPayload = { 
      days: generatedDays,
      overview: generatedOverview,
      status: isPreview ? 'preview' : 'ready',
      isPreview,
      generatedAt: new Date().toISOString(),
    };
    
    // Update local trip state with the new itinerary
    setTrip(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itinerary_data: JSON.parse(JSON.stringify(itineraryPayload)),
        itinerary_status: 'ready' as const,
      };
    });
    setShowGenerator(false);
    
    // Clean up ?generate=true from URL to prevent re-trigger / infinite spinner
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('generate');
      return next;
    }, { replace: true });
    
    // Force-save to backend so we never regenerate on refresh
    // CRITICAL: Never decrease unlocked_day_count — use max of existing vs computed
    if (tripId) {
      try {
        console.log('[TripDetail] Force-saving itinerary to backend:', tripId);
        
        // Fetch current trip data to ensure we never shrink day count or decrease unlocked_day_count
        const { data: currentTrip } = await supabase
          .from('trips')
          .select('unlocked_day_count, itinerary_data')
          .eq('id', tripId)
          .maybeSingle();
        const existingUnlocked = (currentTrip as any)?.unlocked_day_count ?? 0;
        
        // NO-SHRINK GUARD: Never overwrite a larger day array with a smaller one
        const existingDayCount = ((currentTrip as any)?.itinerary_data as any)?.days?.length || 0;
        const incomingDayCount = itineraryPayload?.days?.length || 0;
        if (existingDayCount > incomingDayCount) {
          console.warn(`[TripDetail] SHRINK BLOCKED: existing=${existingDayCount}, incoming=${incomingDayCount}. Skipping force-save.`);
          return;
        }
        const computedUnlocked = isPreview === false 
          ? computeUnlockedDayCount({ isFirstTrip: !!isFirstTrip, isPreview: false, generatedDayCount: nonLockedDays.length }) 
          : undefined;
        // Never write a lower value than what's already stored
        const safeUnlocked = computedUnlocked !== undefined 
          ? Math.max(existingUnlocked, computedUnlocked) 
          : undefined;
        
        const { error } = await supabase
          .from('trips')
          .update({
            itinerary_data: JSON.parse(JSON.stringify(itineraryPayload)) as any,
            itinerary_status: 'ready',
            updated_at: new Date().toISOString(),
            ...(safeUnlocked !== undefined ? { unlocked_day_count: safeUnlocked } : {}),
          })
          .eq('id', tripId);
        
        if (error) {
          console.error('[TripDetail] Failed to force-save itinerary:', error);
        } else {
          console.log('[TripDetail] Itinerary force-saved successfully');
          
          // Invalidate entitlements so UI immediately reflects new unlocked_day_count
          queryClient.invalidateQueries({ queryKey: ['entitlements'] });
          
          // Atomically claim first-trip benefit ONLY after successful save
          if (isFirstTrip) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { error: claimError } = await supabase.rpc('claim_first_trip_benefit', { p_user_id: user.id });
              if (claimError) {
                console.error('[TripDetail] Failed to claim first_trip_used:', claimError);
              } else {
                console.log('[TripDetail] first_trip_used claimed atomically');
              }
            }
          }
        }
      } catch (err) {
        console.error('[TripDetail] Force-save error:', err);
      }
    }
  }, [tripId]);

  // Handle full trip regeneration (from confirmation banner)
  const handleRegenerateTrip = useCallback(() => {
    handleShowGenerator(true);
  }, []);

  // Sync trip_cities after date change is persisted
  const syncCitiesAfterDateChange = useCallback(async (
    result: DateChangeResult,
    redistribution?: NightsRedistribution[]
  ) => {
    if (!tripId || tripCities.length === 0) return;

    const newStart = parseLocalDate(result.newStartDate);
    const newEnd = parseLocalDate(result.newEndDate);
    const newTotalNights = differenceInDays(newEnd, newStart);
    if (newTotalNights <= 0) return;

    const check = checkRedistributionNeeded(tripCities, newTotalNights);
    if (!check.needed) {
      // Still re-date cities even if nights didn't change (shift case)
      await applyNightsRedistribution(tripCities, check.redistribution.length > 0 ? check.redistribution : tripCities.map(c => ({
        cityId: c.id, cityName: c.city_name, oldNights: c.nights || 1, newNights: c.nights || 1,
      })), result.newStartDate);
      // Refresh local state
      const updated = await getTripCities(tripId);
      setTripCities(updated);
      return;
    }

    if (check.isMultiCity && !redistribution) {
      // Show modal for user to adjust
      setRedistributionModal({
        open: true,
        totalNights: newTotalNights,
        redistribution: check.redistribution,
        pendingDateResult: result,
      });
      return;
    }

    // Single-city or user confirmed redistribution
    const finalRedist = redistribution || check.redistribution;
    await applyNightsRedistribution(tripCities, finalRedist, result.newStartDate);
    const updated = await getTripCities(tripId);
    setTripCities(updated);
  }, [tripId, tripCities]);

  // Handle redistribution modal confirm
  const handleRedistributionConfirm = useCallback(async (redistribution: NightsRedistribution[]) => {
    const pending = redistributionModal.pendingDateResult;
    if (!pending || !tripId) return;

    await applyNightsRedistribution(tripCities, redistribution, pending.newStartDate);
    const updated = await getTripCities(tripId);
    setTripCities(updated);
    toast.success('City nights redistributed');
  }, [redistributionModal.pendingDateResult, tripId, tripCities]);

  // Handle trip date changes — shift/extend/shorten itinerary
  const handleDateChange = useCallback(async (result: DateChangeResult) => {
    if (!trip || !tripId) return;

    // Snapshot current trip dates/itinerary before changing for undo support
    const currentDays = ((trip.itinerary_data as Record<string, unknown>)?.days as any[]) || [];
    await saveTripDateVersion(tripId, {
      startDate: trip.start_date,
      endDate: trip.end_date,
      dayCount: currentDays.length,
      itineraryData: trip.itinerary_data as Record<string, unknown> | undefined,
      hotelSelection: trip.hotel_selection,
    });

    const { newStartDate, newEndDate, daysAdded, isShiftOnly, insertPosition, removedDayNumbers } = result;
    const metadata = trip.itinerary_data as Record<string, unknown> | null;
    let days = [...((metadata?.days as any[]) || [])];
    let archivedDays: any[] | undefined;

    if (isShiftOnly) {
      // SHIFT — recalculate all dates, keep activities
      const newStart = parseLocalDate(newStartDate);
      days = days.map((day: any, idx: number) => ({
        ...day,
        date: format(addDays(newStart, idx), 'yyyy-MM-dd'),
      }));
    } else if (daysAdded > 0) {
      // EXTEND — insert new blank days at the specified position
      const newStart = parseLocalDate(newStartDate);
      const blankDays: any[] = [];
      for (let i = 0; i < daysAdded; i++) {
        blankDays.push({
          dayNumber: 0, // renumbered below
          date: '',
          theme: 'Free Day',
          description: 'Open for planning',
          activities: [],
        });
      }

      if (insertPosition === 'before') {
        days = [...blankDays, ...days];
      } else {
        // 'after' or default — append at end
        days = [...days, ...blankDays];
      }

      // Renumber all days and recalculate dates
      days = days.map((day: any, idx: number) => ({
        ...day,
        dayNumber: idx + 1,
        date: format(addDays(newStart, idx), 'yyyy-MM-dd'),
      }));
    } else if (daysAdded < 0) {
      // SHORTEN — remove specific days or from the end
      const newStart = parseLocalDate(newStartDate);

      if (removedDayNumbers && removedDayNumbers.length > 0) {
        // User chose specific days to remove — archive them
        const removeSet = new Set(removedDayNumbers);
        archivedDays = days.filter((d: any) => removeSet.has(d.dayNumber));
        days = days.filter((d: any) => !removeSet.has(d.dayNumber));
      } else {
        // Remove from end (default)
        const newDayCount = days.length + daysAdded;
        const keepCount = Math.max(1, newDayCount);
        archivedDays = days.slice(keepCount);
        days = days.slice(0, keepCount);
      }

      // Renumber and re-date
      days = days.map((day: any, idx: number) => ({
        ...day,
        dayNumber: idx + 1,
        date: format(addDays(newStart, idx), 'yyyy-MM-dd'),
      }));
    }

    // Preserve archived days in metadata for undo
    const updatedItinerary = {
      ...(metadata || {}),
      days,
      ...(archivedDays && archivedDays.length > 0
        ? { archivedDays: [...((metadata?.archivedDays as any[]) || []), ...archivedDays] }
        : {}),
    };

    // Update hotel check-in/check-out dates if present
    let updatedHotelSelection = trip.hotel_selection;
    if (trip.hotel_selection) {
      try {
        const hotels = Array.isArray(trip.hotel_selection) ? [...trip.hotel_selection] : [trip.hotel_selection];
        const updatedHotels = hotels.map((h: any, idx: number) => {
          if (!h || typeof h !== 'object') return h;
          return {
            ...h,
            checkIn: idx === 0 ? newStartDate : h.checkIn,
            check_in: idx === 0 ? newStartDate : h.check_in,
            checkOut: idx === hotels.length - 1 ? newEndDate : h.checkOut,
            check_out: idx === hotels.length - 1 ? newEndDate : h.check_out,
          };
        });
        updatedHotelSelection = Array.isArray(trip.hotel_selection) ? updatedHotels : updatedHotels[0];
      } catch {
        // Ignore hotel update errors — non-critical
      }
    }

    setTrip(prev => prev ? {
      ...prev,
      start_date: newStartDate,
      end_date: newEndDate,
      itinerary_data: updatedItinerary as any,
      hotel_selection: updatedHotelSelection as any,
    } : null);

    try {
      const { error } = await supabase
        .from('trips')
        .update({
          start_date: newStartDate,
          end_date: newEndDate,
          itinerary_data: updatedItinerary as any,
          hotel_selection: updatedHotelSelection as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (error) {
        console.error('[TripDetail] Failed to save date change:', error);
        toast.error('Failed to save date changes');
      } else {
        const msg = isShiftOnly
          ? 'Trip dates shifted. Use "Refresh Day" to check for scheduling issues'
          : daysAdded > 0
            ? `${daysAdded} day${daysAdded > 1 ? 's' : ''} added${insertPosition === 'before' ? ' at the start' : ' at the end'}`
            : `${Math.abs(daysAdded)} day${Math.abs(daysAdded) > 1 ? 's' : ''} removed${archivedDays ? ' (archived)' : ''}`;
        toast.success(msg);

        // Invalidate query cache so all consumers see fresh dates
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });

        // Sync trip_cities nights/dates
        await syncCitiesAfterDateChange(result);

        // After adding days, prompt user to generate content
        if (daysAdded > 0) {
          const totalDaysNow = days.length;
          const newDayNumbers = insertPosition === 'before'
            ? Array.from({ length: daysAdded }, (_, i) => i + 1)
            : Array.from({ length: daysAdded }, (_, i) => totalDaysNow - daysAdded + i + 1);
          setGenerateNewDaysPrompt({
            open: true,
            daysAdded,
            insertPosition: insertPosition || 'after',
            dayNumbers: newDayNumbers,
          });
        }
      }
    } catch (err) {
      console.error('[TripDetail] Date change error:', err);
      toast.error('Failed to update dates');
    }
  }, [trip, tripId, syncCitiesAfterDateChange, queryClient]);

  // Handle undoing a trip date change — restores dates, itinerary, and hotel selection
  const handleUndoDateChange = useCallback(async () => {
    if (!tripId || !trip) return;

    // Save current state before restoring so the undo is meaningful
    await saveTripDateVersion(tripId, {
      startDate: trip.start_date,
      endDate: trip.end_date,
      dayCount: ((trip.itinerary_data as Record<string, unknown>)?.days as any[] || []).length,
      itineraryData: trip.itinerary_data as Record<string, unknown> | undefined,
      hotelSelection: trip.hotel_selection,
    });

    const result = await restoreTripDateVersion(tripId);
    if (!result.success || !result.snapshot) {
      toast.error(result.error || 'No date change to undo');
      return;
    }
    const { startDate, endDate, itineraryData, hotelSelection } = result.snapshot;

    // Update local state
    setTrip(prev => prev ? {
      ...prev,
      start_date: startDate,
      end_date: endDate,
      itinerary_data: (itineraryData ?? prev.itinerary_data) as any,
      hotel_selection: (hotelSelection ?? prev.hotel_selection) as any,
    } : null);

    // Persist to DB
    try {
      const updatePayload: Record<string, unknown> = {
        start_date: startDate,
        end_date: endDate,
        updated_at: new Date().toISOString(),
      };
      if (itineraryData) updatePayload.itinerary_data = itineraryData;
      if (hotelSelection !== undefined) updatePayload.hotel_selection = hotelSelection;

      const { error } = await supabase
        .from('trips')
        .update(updatePayload as any)
        .eq('id', tripId);

      if (error) {
        console.error('[TripDetail] Failed to undo date change:', error);
        toast.error('Failed to undo date change');
      } else {
        toast.success('Date change undone');
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
      }
    } catch (err) {
      console.error('[TripDetail] Undo date change error:', err);
      toast.error('Failed to undo date change');
    }
  }, [tripId, trip, queryClient]);

  // Handle applying hotel-based swap suggestions to itinerary
  const handleApplySwaps = useCallback((swaps: SwapSuggestion[]) => {
    if (!trip) return;
    const metadata = trip.itinerary_data as Record<string, unknown> | null;
    const days = [...((metadata?.days as any[]) || [])];

    for (const swap of swaps) {
      const dayIdx = days.findIndex((d: any) => d.dayNumber === swap.dayNumber);
      if (dayIdx === -1) continue;
      const day = { ...days[dayIdx] };
      const activities = [...(day.activities || [])];
      const actIdx = activities.findIndex((a: any) => a.id === swap.activityId);
      if (actIdx === -1) continue;

      // Replace the activity name/location, keep everything else
      const coherentName = enforceMealTimeCoherence(swap.suggestedActivity, activities[actIdx].startTime || activities[actIdx].time);
      activities[actIdx] = {
        ...activities[actIdx],
        name: coherentName,
        location: {
          ...(activities[actIdx].location || {}),
          name: swap.suggestedLocation || activities[actIdx].location?.name,
        },
        swappedFrom: swap.currentActivity,
        swapReason: swap.reason,
      };
      day.activities = activities;
      days[dayIdx] = day;
    }

    const newItineraryData = { ...(metadata || {}), days };
    
    // Update local state
    setTrip(prev => prev ? { ...prev, itinerary_data: newItineraryData as any } : null);

    // Persist to backend with optimistic locking
    saveItineraryOptimistic(tripId!, newItineraryData).then((result) => {
      if (!result.success && result.error === 'version_conflict') {
        setConflictState({ open: true, localData: newItineraryData });
      } else if (!result.success) {
        console.error('[TripDetail] Failed to save swaps:', result.error);
      }
    });
  }, [trip, tripId]);

  const handleActivityComplete = async (activityId: string) => {
    try {
      // Update activity status in database
      const existingActivity = activities.find(a => a.id === activityId);
      const existingMeta = (existingActivity?.metadata as Record<string, unknown>) || {};
      await supabase
        .from('trip_activities')
        .update({ 
          metadata: { 
            ...existingMeta,
            completed: true,
            completedAt: new Date().toISOString()
          }
        })
        .eq('id', activityId);
    } catch (err) {
      console.error('[TripDetail] Error completing activity:', err);
    }
  };

  const handleActivitySkip = async (activityId: string) => {
    try {
      // Update activity status in database
      const existingActivity = activities.find(a => a.id === activityId);
      const existingMeta = (existingActivity?.metadata as Record<string, unknown>) || {};
      await supabase
        .from('trip_activities')
        .update({ 
          metadata: { 
            ...existingMeta,
            skipped: true,
            skippedAt: new Date().toISOString()
          }
        })
        .eq('id', activityId);
    } catch (err) {
      console.error('[TripDetail] Error skipping activity:', err);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Head title="Loading Trip | Voyance" />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !trip) {
    return (
      <MainLayout>
        <Head title="Trip Not Found | Voyance" />
        <section className="pt-24 pb-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold mb-4">Trip Not Found</h1>
            <p className="text-muted-foreground mb-6">{error || 'This trip does not exist.'}</p>
            <Button onClick={() => navigate('/trip/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </section>
      </MainLayout>
    );
  }

  const isLiveTrip = trip.status === 'active';

  // Redirect active trips (by status OR date window) to the dedicated ActiveTrip page
  const isInDateWindow = (() => {
    if (!trip.start_date || !trip.end_date) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = parseLocalDate(trip.start_date);
    const end = parseLocalDate(trip.end_date);
    return start <= today && end >= today;
  })();

  if ((isLiveTrip || isInDateWindow) 
    && searchParams.get('edit') !== 'true' 
    && !shouldAutoGenerate 
    && !isServerGenerating
    && hasItineraryData(trip)) {
    return <Navigate to={`/trip/${trip.id}/active`} replace />;
  }
  // Detect past trips for read-only mode and hiding Travel Intel
  const itineraryDays = transformToItineraryDays();

  // Compute effective end date: if itinerary has more REAL days than the stored
  // date range, derive end_date from start_date + (numDays - 1).
  // IMPORTANT: Use inclusive day count (differenceInDays + 1) for comparison,
  // and only correct when itinerary has real activities (not placeholder scaffolding).
  const effectiveEndDate = (() => {
    const storedDayCountInclusive = differenceInDays(parseLocalDate(trip.end_date), parseLocalDate(trip.start_date)) + 1;
    // Only count days that have at least one activity (not empty placeholders)
    const realDayCount = itineraryDays.filter(d => d.activities && d.activities.length > 0).length;
    if (realDayCount > 1 && realDayCount > storedDayCountInclusive) {
      const start = parseLocalDate(trip.start_date);
      const corrected = new Date(start);
      corrected.setDate(corrected.getDate() + realDayCount - 1); // -1 because inclusive
      return format(corrected, 'yyyy-MM-dd');
    }
    return trip.end_date;
  })();
  const isPastTripView = isAfter(new Date(), parseLocalDate(effectiveEndDate));

  return (
    <MainLayout>
      <Head title={`${trip.name} | Voyance`} />
      
      {/* Hero Destination Image — compact on mobile, taller on desktop */}
      <div className="relative h-28 sm:h-40 md:h-56 lg:h-72 -mt-16 overflow-hidden">
        <ErrorBoundary>
        <img
          src={heroImageUrl}
          alt={trip.destination || 'Trip destination'}
          onError={onHeroError}
          onLoad={onHeroLoad}
          className="w-full h-full object-cover !rounded-none transition-opacity duration-500"
          key={heroImageUrl}
        />
        </ErrorBoundary>
        {/* Back Button - icon only so hero image stays text-free */}
        <div className="absolute top-20 left-4 md:left-8 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="bg-background/90 backdrop-blur-sm hover:bg-background shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Journey Breadcrumb — only for linked journey trips */}
      {trip.journey_id && trip.journey_order && trip.journey_total_legs && (
        <JourneyBreadcrumb
          journeyId={trip.journey_id}
          journeyName={trip.journey_name}
          journeyOrder={trip.journey_order}
          journeyTotalLegs={trip.journey_total_legs}
          currentTripId={trip.id}
        />
      )}

      <section className="pb-16 pt-8 sm:pt-10 relative z-10 overflow-x-hidden">
        <div className="max-w-4xl mx-auto px-4">
          {(() => {
            const isPastTrip = isAfter(new Date(), parseLocalDate(effectiveEndDate));
            const statusLabel = isLiveTrip ? 'Active' : isPastTrip && trip.status === 'draft' ? 'Past' : (trip.status || 'draft');
            const canToggleStatus = !isLiveTrip && !isPastTrip && (trip.status === 'draft' || trip.status === 'booked');

            const handleStatusToggle = async () => {
              if (!canToggleStatus || !trip.id) return;
              const newStatus = trip.status === 'booked' ? 'draft' : 'booked';
              const { error } = await supabase.from('trips').update({ status: newStatus }).eq('id', trip.id);
              if (!error) {
                setTrip(prev => prev ? { ...prev, status: newStatus } : prev);
              }
            };

            return (
              <div className="flex items-center gap-2 mb-4 sm:mb-6 min-w-0">
                <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">{trip.name}</h1>
                {!isPreviewMode && canToggleStatus ? (
                  <button
                    onClick={handleStatusToggle}
                    className="inline-flex items-center gap-1 shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors cursor-pointer hover:opacity-80"
                    style={{
                      background: trip.status === 'booked' ? 'hsl(var(--primary))' : 'transparent',
                      color: trip.status === 'booked' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                      borderColor: trip.status === 'booked' ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    }}
                  >
                    {trip.status === 'booked' ? <CheckCircle className="w-3 h-3" /> : <PenLine className="w-3 h-3" />}
                    {trip.status === 'booked' ? 'Confirmed' : 'Draft'}
                  </button>
                ) : !isPreviewMode ? (
                  <Badge 
                    variant={
                      isLiveTrip ? 'default' :
                      trip.status === 'completed' ? 'secondary' : 
                      trip.status === 'booked' ? 'default' : 
                      isPastTrip ? 'secondary' : 'outline'
                    }
                    className="capitalize shrink-0 text-[10px] px-1.5 py-0"
                  >
                    {statusLabel}
                  </Badge>
                ) : null}
                {/* Edit/Preview Toggle — only for trip owners */}
                {canToggleViewMode && (
                  <div className="ml-auto shrink-0">
                    <TripViewModeToggle mode={viewMode} onModeChange={setViewMode} />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Active/Edit Toggle for live trips */}
          {isLiveTrip && (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit mb-4">
              <button
                onClick={() => setLiveTripViewMode('active')}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                  liveTripViewMode === 'active'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Active
              </button>
              <button
                onClick={() => setLiveTripViewMode('edit')}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                  liveTripViewMode === 'edit'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Edit
              </button>
            </div>
          )}

          {/* Live Itinerary View for active trips */}
          {isLiveTrip && liveTripViewMode === 'active' ? (
            <ErrorBoundary>
            <LiveItineraryView
              tripId={trip.id}
              tripName={trip.name}
              destination={trip.destination}
              startDate={trip.start_date}
              endDate={effectiveEndDate}
              days={itineraryDays}
              onActivityComplete={handleActivityComplete}
              onActivitySkip={handleActivitySkip}
            />
            </ErrorBoundary>
          ) : isServerGenerating || generationStalled ? (
            /* Server-side generation in progress or stalled — use GenerationPhases for
               consistent animation + progress display (airplane/globe animation) */
            <div className="space-y-6">
              {showStalledUI ? (
                /* Stalled state — show reconnecting with retry button */
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-3 max-w-md">
                    <h3 className="text-xl font-serif font-semibold">Reconnecting...</h3>
                    <p className="text-muted-foreground">
                      Generation paused at Day {generationPoller.completedDays} of {generationPoller.totalDays}.
                      Attempting to resume automatically.
                    </p>
                    {generationPoller.totalDays > 0 && (
                      <div className="w-64 mx-auto">
                        <Progress value={generationPoller.progress} className="h-2" />
                      </div>
                    )}
                    <div className="flex gap-3 justify-center pt-2">
                      <Button variant="outline" size="sm" onClick={handleResumeGeneration} disabled={resumingGeneration}>
                        {resumingGeneration ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Resuming…</>
                        ) : (
                          <>Retry manually</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Active generation — GenerationPhases with airplane animation */
                <GenerationPhases
                  currentStep="preparing"
                  destination={trip.destination || ''}
                  totalDays={generationPoller.totalDays || (differenceInDays(parseLocalDate(effectiveEndDate), parseLocalDate(trip.start_date)) + 1)}
                  tripId={trip.id}
                  completedDays={generationPoller.completedDays}
                  generatedDaysList={generationPoller.generatedDaysList}
                  isComplete={generationPoller.isReady}
                  progress={generationPoller.progress}
                  currentCity={generationPoller.currentCity}
                  isMultiCity={!!(trip as any).is_multi_city || tripCities.length > 1}
                  tripCities={tripCities.map(c => ({ city_name: c.city_name, generation_status: c.generation_status }))}
                />
              )}

              {/* Browse completed days while generating */}
              {generationPoller.generatedDaysList.length === 0 && generationPoller.partialDays.length > 0 && (
                <ErrorBoundary>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Browse your completed days while we finish the rest:
                    </p>
                    <EditorialItinerary
                      tripId={trip.id}
                      days={parseEditorialDays({ days: generationPoller.partialDays }, trip.start_date, trip.end_date, { partial: true }) as EditorialDay[]}
                      destination={trip.destination || ''}
                      startDate={trip.start_date}
                      endDate={effectiveEndDate}
                      travelers={trip.travelers || 1}
                      isEditable={false}
                      isPreview={true}
                      itineraryStatus="generating"
                    />
                  </div>
                </ErrorBoundary>
              )}
            </div>
          ) : isQueuedJourneyLeg ? (
            /* Queued Journey Leg — waiting for previous city to finish */
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-primary/60" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-xs">⏳</span>
                </div>
              </div>
              <h2 className="text-xl font-serif font-bold mb-2">
                {trip.destination} is up next
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Your itinerary will start generating once the previous leg finishes. This usually takes a few minutes.
              </p>
              {trip.journey_id && trip.journey_order && trip.journey_order > 1 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // Navigate to the previous leg
                    const prevOrder = trip.journey_order! - 1;
                    supabase
                      .from('trips')
                      .select('id')
                      .eq('journey_id', trip.journey_id!)
                      .eq('journey_order', prevOrder)
                      .single()
                      .then(({ data }) => {
                        if (data?.id) {
                          navigate(`/trip/${data.id}`);
                        }
                      });
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  View previous city
                </Button>
              )}
            </div>
          ) : showGenerator ? (
            /* Itinerary Generator */
            <ErrorBoundary>
            <ItineraryGenerator
              tripId={trip.id}
              destination={trip.destination}
              destinationCountry={trip.destination_country || undefined}
              startDate={trip.start_date}
              endDate={trip.end_date}
              travelers={trip.travelers || 1}
              tripType={trip.trip_type || undefined}
              budgetTier={trip.budget_tier || undefined}
              userId={user?.id}
              isMultiCity={!!(trip as any).is_multi_city}
              autoStart={autoStartGeneration}
              onComplete={handleGenerationComplete}
              onCancel={() => setShowGenerator(false)}
            />
            </ErrorBoundary>
          ) : !hasItinerary ? (
            /* Empty Itinerary - Auto-trigger generator if shouldAutoGenerate, otherwise show minimal loading */
            shouldAutoGenerate ? (
              // Show loading state while auto-trigger effect kicks in
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Preparing your itinerary...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-serif font-bold">{trip.name}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground mt-2">
                    <MapPin className="w-4 h-4" />
                    <span>{trip.destination}</span>
                    {trip.destination_country && (
                      <span className="text-muted-foreground/60">• {trip.destination_country}</span>
                    )}
                  </div>
                </div>

                {/* Generate Itinerary CTA - only when user navigated here manually without ?generate=true */}
                <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/5 p-8 md:p-12">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="relative max-w-lg">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                      <Sparkles className="h-4 w-4" />
                      AI-Powered
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-serif font-bold mb-3">
                      Ready to plan your adventure?
                    </h2>
                    
                    <p className="text-muted-foreground mb-6">
                      Let our AI create a personalized {differenceInDays(parseLocalDate(effectiveEndDate), parseLocalDate(trip.start_date)) + 1}-day itinerary 
                      for {trip.destination} based on your preferences.
                    </p>
                    
                    <Button 
                      size="lg" 
                      onClick={() => handleShowGenerator(true)} 
                      disabled={isSyncingTrip}
                      className="gap-2 shadow-lg"
                    >
                      {isSyncingTrip ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                      {isSyncingTrip ? 'Preparing...' : 'Generate Itinerary'}
                    </Button>
                  </div>
                </div>

                {/* Empty Day Cards */}
                <div className="space-y-3">
                  {itineraryDays.map((day) => (
                    <div key={day.dayNumber} className="border border-dashed border-border rounded-xl p-4 opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {day.dayNumber}
                        </div>
                        <div>
                          <p className="font-medium">{format(parseLocalDate(day.date), 'EEEE, MMM d')}</p>
                          <p className="text-sm text-muted-foreground">No activities planned yet</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            /* Editorial Itinerary - Same design as SampleItinerary with editing */
            (() => {
              // Use centralized safe parser for editorial days
              const editorDays: EditorialDay[] = parseEditorialDays(trip.itinerary_data, trip.start_date, trip.end_date) as EditorialDay[];

              // Normalize flight_selection using the unified normalizer
              // Supports legs[], {departure, return}, and flat formats
              const rawFlight = trip.flight_selection as Record<string, unknown> | null;
              
              const normalizedFlight = rawFlight ? (() => {
                const normalized = normalizeFlightSelection(rawFlight);
                if (!normalized || normalized.legs.length === 0) {
                  // Fall back to legacy outbound/return extraction
                  const getFlightLeg = (source: Record<string, unknown> | undefined) => {
                    if (!source) return undefined;
                    const nestedDep = source.departure as Record<string, unknown> | undefined;
                    const nestedArr = source.arrival as Record<string, unknown> | undefined;
                    const flatDepartureTime = source.departureTime as string | undefined;
                    const flatArrivalTime = source.arrivalTime as string | undefined;
                    return {
                      airline: source.airline as string | undefined,
                      airlineCode: source.airline as string | undefined,
                      flightNumber: source.flightNumber as string | undefined,
                      departure: {
                        time: (nestedDep?.time as string) || flatDepartureTime || undefined,
                        airport: (nestedDep?.airport as string) || undefined,
                        date: undefined as string | undefined,
                      },
                      arrival: {
                        time: flatArrivalTime || (nestedArr?.time as string) || undefined,
                        airport: (nestedArr?.airport as string) || undefined,
                      },
                      price: source.price as number | undefined,
                      cabinClass: source.cabin as string | undefined,
                    };
                  };
                  const outboundSource = (rawFlight.outbound || rawFlight.departure) as Record<string, unknown> | undefined;
                  const returnSource = rawFlight.return as Record<string, unknown> | undefined;
                  const outbound = getFlightLeg(outboundSource);
                  const returnLeg = getFlightLeg(returnSource);
                  if (outbound) outbound.departure.date = trip.start_date;
                  if (returnLeg) returnLeg.departure.date = trip.end_date;
                  return {
                    outbound: outboundSource ? outbound : undefined,
                    return: returnSource ? returnLeg : undefined,
                  };
                }

                // Convert normalized legs to the FlightSelection display format
                // Preserve isDestinationArrival / isDestinationDeparture flags
                const legs = normalized.legs.map((leg, idx) => ({
                  airline: leg.airline || undefined,
                  airlineCode: leg.airline || undefined,
                  flightNumber: leg.flightNumber || undefined,
                  departure: {
                    time: leg.departure.time || undefined,
                    airport: leg.departure.airport || undefined,
                    date: leg.departure.date || (idx === 0 ? trip.start_date : undefined),
                  },
                  arrival: {
                    time: leg.arrival.time || undefined,
                    airport: leg.arrival.airport || undefined,
                  },
                  price: leg.price || undefined,
                  cabinClass: leg.cabin || undefined,
                  seat: leg.seatNumber || undefined,
                  confirmationCode: leg.confirmationCode || undefined,
                  terminal: leg.terminal || undefined,
                  gate: leg.gate || undefined,
                  baggageInfo: leg.baggageInfo || undefined,
                  boardingPassUrl: leg.boardingPassUrl || undefined,
                  frequentFlyerNumber: leg.frequentFlyerNumber || undefined,
                  isDestinationArrival: leg.isDestinationArrival || undefined,
                  isDestinationDeparture: leg.isDestinationDeparture || undefined,
                }));

                // Use starred legs for outbound/return selection
                const outboundLeg = legs.find(l => l.isDestinationArrival) || legs[0];
                const returnLeg = legs.find(l => l.isDestinationDeparture) || (legs.length >= 2 ? legs[legs.length - 1] : undefined);

                return {
                  outbound: outboundLeg,
                  return: returnLeg,
                  legs, // Pass all legs for multi-city display
                };
              })() : null;

              // hotel_selection can be an array (multi-hotel) or a legacy single object.
              const allNormalizedHotels = normalizeLegacyHotelSelection(
                trip.hotel_selection as unknown,
                trip.start_date,
                trip.end_date
              );
              const primaryHotelSelection = allNormalizedHotels[0] || null;

              // Build per-city hotel info — prefer trip_cities DB data, fallback to string splitting
              const isMultiCity = !!(trip as any).is_multi_city || tripCities.length > 1;
              const cityHotels: import('@/components/itinerary/EditorialItinerary').CityHotelInfo[] = (() => {
                // For single-city trips with multiple hotels (split stays), build cityHotels too
                if (!isMultiCity && allNormalizedHotels.length > 1) {
                  return allNormalizedHotels.map((hotel, idx) => ({
                    cityName: (trip.destination || '').split(/\s*[→→,]\s*/)[0]?.trim() || 'Destination',
                    cityOrder: idx,
                    checkInDate: hotel.checkInDate,
                    checkOutDate: hotel.checkOutDate,
                    nights: hotel.checkInDate && hotel.checkOutDate
                      ? Math.max(1, Math.ceil((new Date(hotel.checkOutDate).getTime() - new Date(hotel.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))
                      : undefined,
                    hotel: {
                      name: hotel.name,
                      address: hotel.address,
                      rating: hotel.rating,
                      imageUrl: hotel.imageUrl,
                      images: hotel.images,
                      website: hotel.website,
                      googleMapsUrl: hotel.googleMapsUrl,
                      checkIn: hotel.checkInTime || '3:00 PM',
                      checkOut: hotel.checkOutTime || '11:00 AM',
                      pricePerNight: hotel.pricePerNight,
                      amenities: (hotel as any)?.amenities,
                    } as any,
                  }));
                }
                if (!isMultiCity) return [];

                // When is_multi_city is true but tripCities hasn't loaded yet, skip the
                // destination-string fallback (which often produces only 1 city) and wait
                // for tripCities to load on the next render cycle.
                if (tripCities.length === 0) return [];

                // Prefer trip_cities from DB (authoritative source)
                if (tripCities.length >= 1) {
                  const entries: import('@/components/itinerary/EditorialItinerary').CityHotelInfo[] = [];
                  for (const city of tripCities) {
                    const hotelRaw = city.hotel_selection as any;
                    const hotelArr = Array.isArray(hotelRaw) ? hotelRaw : (hotelRaw?.name ? [hotelRaw] : []);

                    // Transport info attaches only to the last hotel entry for this city
                    const transportInfo = {
                      transportType: city.transport_type || undefined,
                      transportDetails: city.transport_details || undefined,
                      transportCostCents: city.transport_cost_cents || 0,
                      transportCurrency: city.transport_currency || 'USD',
                      arrivalTransfer: (city as any).arrival_transfer || null,
                      departureTransfer: (city as any).departure_transfer || null,
                    };

                    if (hotelArr.length > 1) {
                      // Split-stay: expand each hotel into its own CityHotelInfo entry
                      hotelArr.forEach((hotel: any, hIdx: number) => {
                        const checkIn = hotel.checkInDate || hotel.checkIn;
                        const checkOut = hotel.checkOutDate || hotel.checkOut;
                        const nights = checkIn && checkOut
                          ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
                          : undefined;
                        entries.push({
                          cityName: city.city_name,
                          cityOrder: city.city_order,
                          cityId: city.id,
                          checkInDate: checkIn || city.arrival_date,
                          checkOutDate: checkOut || city.departure_date,
                          nights,
                          hotel: hotel?.name ? {
                            name: hotel.name,
                            address: hotel.address,
                            rating: hotel.rating,
                            imageUrl: hotel.imageUrl || hotel.image_url,
                            images: hotel.images,
                            website: hotel.website,
                            googleMapsUrl: hotel.googleMapsUrl || hotel.google_maps_url,
                            checkIn: hotel.checkIn || hotel.check_in || '3:00 PM',
                            checkOut: hotel.checkOut || hotel.check_out || '11:00 AM',
                            pricePerNight: hotel.pricePerNight || hotel.price_per_night,
                            amenities: hotel.amenities,
                          } as any : null,
                          // Only attach transport to the last hotel in this city
                          ...(hIdx === hotelArr.length - 1 ? transportInfo : {}),
                        });
                      });
                    } else {
                      // Single hotel (or none) — original behavior
                      const hotel = hotelArr[0] || null;
                      entries.push({
                        cityName: city.city_name,
                        cityOrder: city.city_order,
                        cityId: city.id,
                        checkInDate: city.arrival_date,
                        checkOutDate: city.departure_date,
                        nights: city.nights || (city.arrival_date && city.departure_date
                          ? Math.max(1, Math.ceil((new Date(city.departure_date).getTime() - new Date(city.arrival_date).getTime()) / (1000 * 60 * 60 * 24)))
                          : undefined),
                        hotel: hotel?.name ? {
                          name: hotel.name,
                          address: hotel.address,
                          rating: hotel.rating,
                          imageUrl: hotel.imageUrl || hotel.image_url,
                          images: hotel.images,
                          website: hotel.website,
                          googleMapsUrl: hotel.googleMapsUrl || hotel.google_maps_url,
                          checkIn: hotel.checkIn || hotel.check_in || '3:00 PM',
                          checkOut: hotel.checkOut || hotel.check_out || '11:00 AM',
                          pricePerNight: hotel.pricePerNight || hotel.price_per_night,
                          amenities: hotel.amenities,
                        } as any : null,
                        ...transportInfo,
                      });
                    }
                  }
                  return entries;
                }

                // Fallback: derive from destination string
                const cities = (trip.destination || '').split(/\s*[→→,]\s*/).filter(Boolean);
                return cities.map((cityName, idx) => {
                  const hotel = allNormalizedHotels[idx];
                  return {
                    cityName: cityName.trim(),
                    cityOrder: idx,
                    checkInDate: hotel?.checkInDate,
                    checkOutDate: hotel?.checkOutDate,
                    nights: hotel ? (hotel.checkInDate && hotel.checkOutDate ? 
                      Math.max(1, Math.ceil((new Date(hotel.checkOutDate).getTime() - new Date(hotel.checkInDate).getTime()) / (1000 * 60 * 60 * 24))) : undefined) : undefined,
                    hotel: hotel ? {
                      name: hotel.name,
                      address: hotel.address,
                      rating: hotel.rating,
                      imageUrl: hotel.imageUrl,
                      images: hotel.images,
                      website: hotel.website,
                      googleMapsUrl: hotel.googleMapsUrl,
                      checkIn: hotel.checkInTime || '3:00 PM',
                      checkOut: hotel.checkOutTime || '11:00 AM',
                      pricePerNight: (hotel as any)?.pricePerNight,
                      amenities: (hotel as any)?.amenities,
                    } as any : null,
                  };
                });
              })();

              return (
                <>
                   {/* Mobile: Collapsed Trip Overview wrapping Health + Travel Intel — hidden in preview */}
                   {!isPreviewMode && <div className="sm:hidden mb-4">
                    <MobileTripOverview
                      tripHealthPanel={
                        <ErrorBoundary>
                          <TripHealthPanel
                            days={editorDays}
                            totalDaysExpected={(() => { const m = (trip?.metadata as Record<string, unknown>) || {}; const gen = (m.generation_total_days as number) || 0; return gen > 0 ? Math.max(gen, editorDays.length) : editorDays.length; })()}
                            hasFlights={!!trip.flight_selection}
                            hasHotel={
                              !!trip.hotel_selection || 
                              (tripCities.length > 0 && tripCities.every(c => {
                                const h = c.hotel_selection as any;
                                const hotel = Array.isArray(h) && h.length > 0 ? h[0] : h;
                                return !!hotel?.name;
                              })) ||
                              !!((trip?.metadata as any)?.accommodationNotes?.length) ||
                              editorDays.some((d: any) => d.activities?.some((a: any) =>
                                a.category === 'hotel' || a.category === 'accommodation' ||
                                /check.?in/i.test(a.title || a.name || '')
                              ))
                            }
                            isMultiCity={!!(trip as any).is_multi_city || tripCities.length > 1}
                            hasInterCityTransport={editorDays.some((d: any) => d.isTransitionDay)}
                            flightsBookedElsewhere={!!(trip?.metadata as any)?.flightsBookedElsewhere}
                            hotelBookedElsewhere={!!(trip?.metadata as any)?.hotelBookedElsewhere}
                            className=""
                            onAction={(action, ctx) => {
                              if (action === 'add_flights') {
                                setNavigateToSection('flights');
                                setTimeout(() => setNavigateToSection(null), 500);
                              } else if (action === 'add_hotel') {
                                setNavigateToSection('hotels');
                                setTimeout(() => setNavigateToSection(null), 500);
                              } else if (action === 'add_intercity') {
                                setNavigateToSection('hotels');
                                setTimeout(() => setNavigateToSection(null), 500);
                                } else if (action === 'refresh_day') {
                                  if (ctx?.dayNumber) {
                                    setRefreshDayRequest({ dayNumber: ctx.dayNumber as number, nonce: Date.now() });
                                  }
                                } else if (action === 'fix_timing') {
                                  if (ctx?.dayNumber) {
                                    setFixTimingRequest({ dayNumber: ctx.dayNumber as number, nonce: Date.now() });
                                  }
                                } else if (action === 'generate_day') {
                                  toast.info(`Use the day toolbar to generate Day ${ctx?.dayNumber || ''}`);
                              } else if (action === 'generate_missing_days' || action === 'generate_all') {
                                setShowGenerator(true);
                              } else if (action === 'mark_booked_elsewhere' || action === 'unmark_booked_elsewhere') {
                                handleMarkBookedElsewhere(ctx?.field, action === 'mark_booked_elsewhere');
                              }
                            }}
                          />
                        </ErrorBoundary>
                      }
                      travelIntelCards={
                        !isPastTripView ? (
                        <ErrorBoundary>
                          {tripCities.length > 1 ? (
                            tripCities.map((city) => (
                              <TravelIntelCard
                                key={city.id}
                                city={city.city_name}
                                country={city.country || trip.destination_country || ((destinationMeta as any)?.country as string | undefined)}
                                startDate={city.arrival_date || trip.start_date}
                                endDate={city.departure_date || effectiveEndDate}
                                travelers={trip.travelers || 2}
                                archetype={(trip as any).travel_style || undefined}
                                interests={(trip as any).interests || undefined}
                                tripId={trip.id}
                                className="mb-3"
                              />
                            ))
                          ) : (
                            <TravelIntelCard
                              city={trip.destination}
                              country={trip.destination_country || ((destinationMeta as any)?.country as string | undefined)}
                              startDate={trip.start_date}
                              endDate={effectiveEndDate}
                              travelers={trip.travelers || 2}
                              archetype={(trip as any).travel_style || undefined}
                              interests={(trip as any).interests || undefined}
                              tripId={trip.id}
                              className=""
                            />
                          )}
                        </ErrorBoundary>
                        ) : null
                      }
                      daysPlanned={editorDays.filter((d: any) => {
                        const acts = d.activities || [];
                        return acts.some((a: any) => {
                          const cat = (a.category || a.type || '').toLowerCase();
                          return !['check-in', 'check-out', 'hotel', 'accommodation'].includes(cat);
                        });
                      }).length}
                      totalDays={editorDays.length}
                      cityCount={tripCities.length > 1 ? tripCities.length : 1}
                      tripId={trip.id}
                    />
                   </div>}

                  {/* Desktop: TripHealthPanel now rendered inside EditorialItinerary's unified card */}



                   {/* Guide Prompt Banner — only on past trips, hidden in preview */}
                   {!isPreviewMode && isAfter(new Date(), parseLocalDate(effectiveEndDate)) && (
                     <GuidePromptBanner tripId={trip.id} destination={trip.destination} />
                   )}

                   {/* Incomplete-generation recovery banner */}
                   {incompleteDays.length > 0 && !isPreviewMode && (
                     <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                       <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-medium text-foreground">
                           Generation ended early. {incompleteDays.length} {incompleteDays.length === 1 ? 'day is' : 'days are'} unplanned
                         </p>
                         <p className="text-xs text-muted-foreground mt-0.5">
                           {incompleteDays.length === 1
                             ? `Day ${incompleteDays[0]} didn't finish during generation.`
                             : `Days ${incompleteDays.join(', ')} didn't finish during generation.`}
                           {' '}You can build {incompleteDays.length === 1 ? 'it' : 'them'} now or plan {incompleteDays.length === 1 ? 'it' : 'them'} yourself.
                         </p>
                         <div className="flex flex-wrap gap-2 mt-3">
                           <Button
                             size="sm"
                             onClick={() => {
                               setGenerateNewDaysPrompt({
                                 open: true,
                                 daysAdded: incompleteDays.length,
                                 insertPosition: 'after',
                                 dayNumbers: incompleteDays,
                               });
                             }}
                             className="gap-1.5"
                           >
                             <Sparkles className="h-3.5 w-3.5" />
                             Build {incompleteDays.length === 1 ? 'this day' : `these ${incompleteDays.length} days`}
                           </Button>
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={() => setIncompleteDays([])}
                           >
                             Dismiss
                           </Button>
                         </div>
                       </div>
                     </div>
                   )}

                   <ErrorBoundary>
                  <EditorialItinerary
                  tripId={trip.id}
                  destination={trip.destination}
                  destinationCountry={
                    trip.destination_country ||
                    ((destinationMeta as any)?.country as string | undefined) ||
                    undefined
                  }
                  startDate={trip.start_date}
                  endDate={effectiveEndDate}
                  travelers={trip.travelers || 1}
                  budgetTier={trip.budget_tier || undefined}
                  tripType={trip.trip_type || undefined}
                  days={editorDays}
                  flightSelection={normalizedFlight}
                  hotelSelection={primaryHotelSelection as any}
                  allHotels={cityHotels.length > 0 ? cityHotels : undefined}
                  destinationInfo={
                    destinationMeta
                      ? {
                          currency: ((destinationMeta as any)?.currency_code as string | undefined) ||
                            ((destinationMeta as any)?.currency as string | undefined),
                          currencySymbol: ((destinationMeta as any)?.currency_symbol as string | undefined),
                          bestTime: ((destinationMeta as any)?.best_time_to_visit as string | undefined),
                          timezone: ((destinationMeta as any)?.timezone as string | undefined),
                          overview: ((destinationMeta as any)?.description as string | undefined),
                          tips: ((destinationMeta as any)?.local_tips as string | undefined),
                        }
                      : undefined
                  }
                  initialItineraryData={(trip.itinerary_data as Record<string, unknown>) || null}
                  navigateToSection={navigateToSection}
                  refreshDayRequest={refreshDayRequest}
                  fixTimingRequest={fixTimingRequest}
                  parsedMetadata={(() => {
                    const meta = (trip.itinerary_data as any)?.metadata;
                    if (meta?.source === 'manual_paste') return meta;
                    // For Smart Finish trips, check trip.metadata for preserved notes
                    const tripMeta = trip.metadata as any;
                    if (tripMeta?.accommodationNotes?.length || tripMeta?.practicalTips?.length) {
                      return {
                        accommodationNotes: tripMeta.accommodationNotes || [],
                        practicalTips: tripMeta.practicalTips || [],
                        source: 'smart_finish',
                      };
                    }
                    // For regular AI-generated trips, check top-level itinerary_data
                    const itData = trip.itinerary_data as any;
                    if (itData?.accommodationNotes?.length || itData?.practicalTips?.length) {
                      return {
                        accommodationNotes: itData.accommodationNotes || [],
                        practicalTips: itData.practicalTips || [],
                        source: 'ai_generated',
                      };
                    }
                    return undefined;
                  })()}
                  isEditable={true}
                  isPreview={!!(trip.itinerary_data as any)?.isPreview}
                   creationSource={trip.creation_source}
                   viewMode={viewMode}
                  itineraryStatus={trip.itinerary_status}
                  generationFailureReason={(trip.metadata as Record<string, unknown> | null)?.generation_failure_reason as string | null ?? null}
                  journeyId={trip.journey_id}
                  journeyName={trip.journey_name}
                  onDateChange={handleDateChange}
                  onUndoDateChange={handleUndoDateChange}
                  hasItinerary={hasItinerary}
                  dateEditorFlightSelection={trip.flight_selection as Record<string, unknown> | null}
                  dateEditorCities={tripCities}
                  travelIntelCards={
                    !isPastTripView ? (
                      <ErrorBoundary>
                        {tripCities.length > 1 ? (
                          tripCities.map((city) => (
                            <TravelIntelCard
                              key={city.id}
                              city={city.city_name}
                              country={city.country || trip.destination_country || ((destinationMeta as any)?.country as string | undefined)}
                              startDate={city.arrival_date || trip.start_date}
                              endDate={city.departure_date || effectiveEndDate}
                              travelers={trip.travelers || 2}
                              archetype={(trip as any).travel_style || undefined}
                              interests={(trip as any).interests || undefined}
                              tripId={trip.id}
                              className="mb-3"
                            />
                          ))
                        ) : (
                          <TravelIntelCard
                            city={trip.destination}
                            country={trip.destination_country || ((destinationMeta as any)?.country as string | undefined)}
                            startDate={trip.start_date}
                            endDate={effectiveEndDate}
                            travelers={trip.travelers || 2}
                            archetype={(trip as any).travel_style || undefined}
                            interests={(trip as any).interests || undefined}
                            tripId={trip.id}
                            className="mb-3"
                          />
                        )}
                      </ErrorBoundary>
                    ) : null
                  }
                  tripHealthPanel={
                    <TripHealthPanel
                      days={editorDays}
                      totalDaysExpected={(() => { const m = (trip?.metadata as Record<string, unknown>) || {}; const gen = (m.generation_total_days as number) || 0; return gen > 0 ? Math.max(gen, editorDays.length) : editorDays.length; })()}
                      hasFlights={!!trip.flight_selection}
                      hasHotel={
                        !!trip.hotel_selection || 
                        (tripCities.length > 0 && tripCities.every(c => {
                          const h = c.hotel_selection as any;
                          const hotel = Array.isArray(h) && h.length > 0 ? h[0] : h;
                          return !!hotel?.name;
                        })) ||
                        !!((trip?.metadata as any)?.accommodationNotes?.length) ||
                        editorDays.some((d: any) => d.activities?.some((a: any) =>
                          a.category === 'hotel' || a.category === 'accommodation' ||
                          /check.?in/i.test(a.title || a.name || '')
                        ))
                      }
                      isMultiCity={!!(trip as any).is_multi_city || tripCities.length > 1}
                      hasInterCityTransport={editorDays.some((d: any) => d.isTransitionDay)}
                      flightsBookedElsewhere={!!(trip?.metadata as any)?.flightsBookedElsewhere}
                      hotelBookedElsewhere={!!(trip?.metadata as any)?.hotelBookedElsewhere}
                      className=""
                      onAction={(action, ctx) => {
                        if (action === 'add_flights') {
                          setNavigateToSection('flights');
                          setTimeout(() => setNavigateToSection(null), 500);
                        } else if (action === 'add_hotel') {
                          setNavigateToSection('hotels');
                          setTimeout(() => setNavigateToSection(null), 500);
                        } else if (action === 'add_intercity') {
                          setNavigateToSection('hotels');
                          setTimeout(() => setNavigateToSection(null), 500);
                        } else if (action === 'refresh_day') {
                          if (ctx?.dayNumber) {
                            setRefreshDayRequest({ dayNumber: ctx.dayNumber as number, nonce: Date.now() });
                          }
                        } else if (action === 'fix_timing') {
                          if (ctx?.dayNumber) {
                            setFixTimingRequest({ dayNumber: ctx.dayNumber as number, nonce: Date.now() });
                          }
                        } else if (action === 'generate_day') {
                          toast.info(`Use the day toolbar to generate Day ${ctx?.dayNumber || ''}`);
                        } else if (action === 'generate_missing_days' || action === 'generate_all') {
                          setShowGenerator(true);
                        } else if (action === 'mark_booked_elsewhere' || action === 'unmark_booked_elsewhere') {
                          handleMarkBookedElsewhere(ctx?.field, action === 'mark_booked_elsewhere');
                        }
                      }}
                    />
                  }
                  onDaysChange={(updatedDays) => {
                    // Keep trip state in sync so ItineraryAssistant always sees current days
                    setTrip(prev => prev ? {
                      ...prev,
                      itinerary_data: JSON.parse(JSON.stringify({
                        ...(prev.itinerary_data as Record<string, unknown> || {}),
                        days: updatedDays,
                      })),
                    } : null);
                  }}
                  onActiveDayChange={setActiveDayNumber}
                  onActiveCityChange={setActiveCity}
                  onBookingAdded={async () => {
                    // Refetch trip_cities AND trip to pick up hotel/transfer/flight changes
                    try {
                      const [updatedCities, tripResult] = await Promise.all([
                        getTripCities(tripId),
                        supabase.from('trips').select('*').eq('id', tripId).single(),
                      ]);
                      setTripCities(updatedCities);
                      if (tripResult.data) {
                        const updatedTrip = tripResult.data;

                        // --- Inject hotel check-in/check-out activities into itinerary ---
                        // Guard: only run injection if hotel data actually changed
                        const prevHotelJson = JSON.stringify(trip?.hotel_selection ?? null);
                        const newHotelJson = JSON.stringify(updatedTrip.hotel_selection ?? null);
                        const prevCityHotels = JSON.stringify(tripCities.map((c: any) => c.hotel_selection ?? null));
                        const newCityHotels = JSON.stringify(updatedCities.map((c: any) => c.hotel_selection ?? null));
                        const hotelChanged = prevHotelJson !== newHotelJson || prevCityHotels !== newCityHotels;

                        try {
                          const itData = updatedTrip.itinerary_data as Record<string, any> | null;
                          const currentDays = parseEditorialDays(itData, updatedTrip.start_date, updatedTrip.end_date);
                          if (hotelChanged && currentDays.length > 0) {
                            let injectedDays = currentDays;

                            // Collect all hotels for multi-hotel patching
                            let allHotelsForPatch: Array<{ name: string; address?: string; checkInDate?: string; checkOutDate?: string }> = [];

                            // Multi-city: inject from trip_cities hotel selections
                            if (updatedCities.length > 0) {
                              const cityHotels = updatedCities
                                .filter((c: any) => c.hotel_selection)
                                .flatMap((c: any) => {
                                  const hs = c.hotel_selection;
                                  return Array.isArray(hs) ? hs : [hs];
                                })
                                .filter(Boolean);
                              if (cityHotels.length > 0) {
                                injectedDays = injectMultiHotelActivities(injectedDays as any[], cityHotels) as typeof injectedDays;
                                allHotelsForPatch = cityHotels.map((h: any) => ({
                                  name: h.name,
                                  address: h.address || h.location,
                                  checkInDate: h.checkInDate || h.checkIn,
                                  checkOutDate: h.checkOutDate || h.checkOut,
                                }));
                              }
                            }

                            // Single-city: inject from trips.hotel_selection
                            const hotelRaw = updatedTrip.hotel_selection as any;
                            if (hotelRaw && updatedCities.length <= 1) {
                              const hotels = normalizeLegacyHotelSelection(hotelRaw, updatedTrip.start_date, updatedTrip.end_date);
                              if (hotels.length > 1) {
                                // Split-stay: use multi-hotel injection
                                injectedDays = injectMultiHotelActivities(injectedDays as any[], hotels) as typeof injectedDays;
                                allHotelsForPatch = hotels.map(h => ({
                                  name: h.name,
                                  address: h.address,
                                  checkInDate: h.checkInDate,
                                  checkOutDate: h.checkOutDate,
                                }));
                              } else if (hotels.length === 1) {
                                injectedDays = injectHotelActivitiesIntoDays(injectedDays as any[], hotels[0]) as typeof injectedDays;
                                allHotelsForPatch = [{ name: hotels[0].name, address: hotels[0].address, checkInDate: hotels[0].checkInDate, checkOutDate: hotels[0].checkOutDate }];
                              }
                            }

                            // Apply accommodation title/address patches in-memory on injectedDays
                            // (avoids race condition with saveItineraryOptimistic)
                            if (allHotelsForPatch.length > 0) {
                              const ACCOM_KEYWORDS = ['check-in', 'check in', 'check into', 'checkout', 'check-out', 'check out', 'accommodation', 'settle in', 'settle into', 'your hotel', 'freshen up', 'return to your hotel', 'return to hotel'];
                              const ACCOM_CATS = ['accommodation', 'hotel'];
                              for (const day of injectedDays as any[]) {
                                const dayDate = day.date as string | undefined;
                                const matchingHotel = allHotelsForPatch.length === 1
                                  ? allHotelsForPatch[0]
                                  : allHotelsForPatch.find(h => {
                                      if (!h.checkInDate || !h.checkOutDate || !dayDate) return true;
                                      const d = dayDate.slice(0, 10);
                                      return d >= h.checkInDate.slice(0, 10) && d <= h.checkOutDate.slice(0, 10);
                                    });
                                if (!matchingHotel || !day.activities) continue;
                                for (const act of day.activities as any[]) {
                                  const title = String(act.title || act.name || '');
                                  const lower = title.toLowerCase();
                                  const cat = String(act.category || '').toLowerCase();
                                  const isAccom = ACCOM_CATS.includes(cat) || ACCOM_KEYWORDS.some(k => lower.includes(k));
                                  if (!isAccom) continue;
                                  if (lower.includes('checkout') || lower.includes('check-out') || lower.includes('check out')) {
                                    act.title = `Checkout from ${matchingHotel.name}`;
                                  } else if (lower.includes('freshen up')) {
                                    act.title = `Freshen up at ${matchingHotel.name}`;
                                  } else if (lower.includes('return to') || lower.includes('back to')) {
                                    act.title = `Return to ${matchingHotel.name}`;
                                  } else if (lower.includes('settle in') || lower.includes('settle into')) {
                                    act.title = `Settle in at ${matchingHotel.name}`;
                                  } else {
                                    act.title = `Check-in at ${matchingHotel.name}`;
                                  }
                                  act.name = act.title;
                                  if (matchingHotel.address) {
                                    act.location = { name: matchingHotel.name, address: matchingHotel.address };
                                    act.address = matchingHotel.address;
                                  }
                                }
                              }
                            }

                            // Save injected days back if they changed
                            if (JSON.stringify(injectedDays) !== JSON.stringify(currentDays)) {
                              const newItData = { ...(itData || {}), days: injectedDays, savedAt: new Date().toISOString() };
                              const saveResult = await saveItineraryOptimistic(tripId!, newItData);
                              if (!saveResult.success && saveResult.error === 'version_conflict') {
                                setConflictState({ open: true, localData: newItData });
                              }
                              updatedTrip.itinerary_data = newItData as any;
                            }
                          }
                        } catch (injErr) {
                          console.error('[TripDetail] Hotel activity injection failed:', injErr);
                        }

                        setTrip(updatedTrip);
                      }
                    } catch { /* non-critical */ }
                    // Signal financial snapshot hooks to refresh
                    window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
                  }}
                  onUnlockComplete={(enrichedItinerary) => {
                    refreshEntitlements();
                    setTrip(prev => prev ? {
                      ...prev,
                      itinerary_data: enrichedItinerary as any,
                      itinerary_status: 'ready', // Prevent self-heal from triggering generation
                    } : prev);
                  }}
                  onPaymentRequest={async (activityId) => {
                    // Find the activity across all days
                    const activity = editorDays
                      .flatMap(d => d.activities)
                      .find(a => a.id === activityId);
                    
                    if (!activity) {
                      toast.error('Activity not found');
                      return;
                    }
                    
                    const priceCents = activity.quotePriceCents || Math.round((activity.cost?.amount || 0) * 100);
                    if (priceCents <= 0) {
                      toast.error('No price available for this activity');
                      return;
                    }
                    
                    toast.loading('Preparing checkout...', { id: 'checkout' });
                    
                    const result = await initiateBooking({
                      tripId: trip.id,
                      itemType: 'activity',
                      itemId: activityId,
                      itemName: activity.title,
                      amountCents: priceCents,
                      currency: activity.cost?.currency || 'USD',
                      externalProvider: activity.viatorProductCode ? 'viator' : undefined,
                    });
                    
                    if (result.success && result.checkoutUrl) {
                      toast.success('Redirecting to checkout...', { id: 'checkout' });
                      window.open(result.checkoutUrl, '_blank');
                    } else {
                      toast.error(result.error || 'Failed to start checkout', { id: 'checkout' });
                    }
                  }}
                />
                </ErrorBoundary>
                </>
              );
            })()
          )}

          {/* Journey "Up Next" portal — only for linked journey trips */}
          {trip.journey_id && trip.journey_order && trip.journey_total_legs && (
            <div className="mt-8">
              <JourneyUpNext
                journeyId={trip.journey_id}
                journeyName={trip.journey_name}
                journeyOrder={trip.journey_order}
                journeyTotalLegs={trip.journey_total_legs}
              />
            </div>
          )}

          {/* Trip Photo Gallery */}
          <div className="mt-12">
            <ErrorBoundary>
            <TripPhotoGallery tripId={trip.id} hideUpload={isPreviewMode} />
            </ErrorBoundary>
          </div>

        </div>
      </section>

       {/* Itinerary Assistant - Floating Chatbot — hidden in preview mode */}
       {!isPreviewMode && hasItinerary && !(isManualMode && !trip.smart_finish_purchased) && hasPremiumAccess && (
        <ErrorBoundary fallback={null}>
        <ItineraryAssistant
          tripId={trip.id}
          destination={trip.destination}
          startDate={trip.start_date}
          endDate={effectiveEndDate}
          currentDayNumber={activeDayNumber}
          isLocalTrip={trip.user_id === 'local'}
          travelers={trip.travelers || 1}
          days={parseAssistantDays(trip.itinerary_data, trip.start_date)}
          accommodationInfo={(() => {
            const hotels = normalizeLegacyHotelSelection(
              trip.hotel_selection as unknown,
              trip.start_date,
              trip.end_date
            );
            const h = hotels[0];
            if (h?.name) {
              return {
                name: h.name,
                neighborhood: h.neighborhood || undefined,
                city: trip.destination || undefined,
              };
            }
            return undefined;
          })()}
          blendedDna={(() => {
            const bd = (trip as any).blended_dna;
            if (bd && typeof bd === 'object' && bd.isBlended) {
              return {
                blendedTraits: bd.blendedTraits || bd.blended_traits || {},
                travelerProfiles: (bd.travelerProfiles || bd.travelers || []).map((t: any) => ({
                  userId: t.userId || t.user_id || '',
                  name: t.name || '',
                  archetypeId: t.archetypeId || t.archetype || '',
                  isOwner: t.isOwner ?? false,
                  weight: t.weight ?? 0,
                })),
                isBlended: true,
              };
            }
            return undefined;
          })()}
          onItineraryUpdate={(updatedDays) => {
            setTrip(prev => prev ? {
              ...prev,
              itinerary_data: JSON.parse(JSON.stringify({
                ...(prev.itinerary_data as Record<string, unknown> || {}),
                days: updatedDays,
              })),
            } : null);
          }}
        />
        </ErrorBoundary>
      )}

      {/* Trip Debrief Modal - Post-trip retrospective */}
      {trip && (
        <TripDebriefModal
          isOpen={showDebriefModal}
          onClose={() => setShowDebriefModal(false)}
          tripId={trip.id}
          destination={trip.destination}
          tripName={trip.name}
        />
      )}

      {/* Nights Redistribution Modal for multi-city date changes */}
      <NightsRedistributionModal
        open={redistributionModal.open}
        onOpenChange={(open) => setRedistributionModal(prev => ({ ...prev, open }))}
        totalNights={redistributionModal.totalNights}
        initialRedistribution={redistributionModal.redistribution}
        onConfirm={handleRedistributionConfirm}
        hasItinerary={hasItinerary}
      />

      {/* Version conflict resolution dialog */}
      <VersionConflictDialog
        open={conflictState.open}
        onReloadLatest={async () => {
          setConflictState({ open: false, localData: null });
          // Re-fetch the trip from the server
          const { data } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId!)
            .single();
          if (data) {
            setTrip(data);
            setCachedVersion(tripId!, (data as any).itinerary_version ?? 1);
            toast.success('Loaded the latest version from your collaborator.');
          }
        }}
        onForceKeepMine={async () => {
          const localData = conflictState.localData;
          setConflictState({ open: false, localData: null });
          if (!localData || !tripId) return;
          // Refresh version cache then force-save
          await fetchAndCacheVersion(tripId);
          const result = await saveItineraryOptimistic(tripId, localData);
          if (result.success) {
            toast.success('Your changes have been saved.');
          } else {
            toast.error('Failed to save. Please try again.');
          }
        }}
        onCancel={() => {
          setConflictState({ open: false, localData: null });
          toast('Local changes discarded.');
        }}
      />

      {/* Generate New Days Prompt — shown after extending trip dates */}
      <AlertDialog
        open={generateNewDaysPrompt.open}
        onOpenChange={(open) => setGenerateNewDaysPrompt(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Build your new {generateNewDaysPrompt.daysAdded === 1 ? 'day' : 'days'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You added {generateNewDaysPrompt.daysAdded} new {generateNewDaysPrompt.daysAdded === 1 ? 'day' : 'days'}{' '}
                  {generateNewDaysPrompt.insertPosition === 'before' ? 'at the start' : 'at the end'} of your trip.
                  {generateNewDaysPrompt.daysAdded > 1
                    ? ' These days are currently empty.'
                    : ' This day is currently empty.'}
                </p>
                <p>
                  Want us to build a full itinerary with activities, restaurants, and logistics for{' '}
                  {generateNewDaysPrompt.daysAdded === 1 ? 'this day' : 'these days'}?
                </p>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
                  <Coins className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">
                    {CREDIT_COSTS.UNLOCK_DAY * generateNewDaysPrompt.daysAdded} credits
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({CREDIT_COSTS.UNLOCK_DAY} per day)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This may also affect surrounding days (checkout logistics, flight info, hotel extensions).
                  You can also update flight and hotel details afterward.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>I'll plan it myself</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!tripId || !trip) return;
                setGenerateNewDaysPrompt(prev => ({ ...prev, open: false }));
                // Trigger generation for the new days via the resume path
                // This re-uses the same generation pipeline
                const meta = (trip.metadata as Record<string, unknown>) || {};
                const totalDays = trip.start_date && trip.end_date
                  ? differenceInDays(parseLocalDate(trip.end_date), parseLocalDate(trip.start_date)) + 1
                  : 0;
                try {
                  await supabase.from('trips').update({
                    itinerary_status: 'generating',
                    metadata: {
                      ...meta,
                      generation_total_days: totalDays,
                      generation_error: null,
                      generation_heartbeat: new Date().toISOString(),
                      generation_started_at: new Date().toISOString(),
                      generation_extend_days: generateNewDaysPrompt.dayNumbers,
                    },
                  }).eq('id', tripId);

                  const { data: refreshed } = await supabase.from('trips').select('*').eq('id', tripId).single();
                  if (refreshed) setTrip(refreshed);

                  const { error } = await supabase.functions.invoke('generate-itinerary', {
                    body: {
                      action: 'generate-trip',
                      tripId,
                      destination: trip.destination,
                      destinationCountry: (trip as any).destination_country,
                      startDate: trip.start_date,
                      endDate: trip.end_date,
                      travelers: trip.travelers || 1,
                      tripType: trip.trip_type,
                      budgetTier: (trip as any).budget_tier,
                      isMultiCity: !!(trip as any).is_multi_city,
                      creditsCharged: 0, // Charged via spend-credits separately
                      requestedDays: totalDays,
                      resumeFromDay: generateNewDaysPrompt.dayNumbers[0], // Start from first new day
                      extendDays: generateNewDaysPrompt.dayNumbers,
                    },
                  });

                  if (error) throw error;
                  toast.success(`Generating ${generateNewDaysPrompt.daysAdded} new ${generateNewDaysPrompt.daysAdded === 1 ? 'day' : 'days'}…`);
                } catch (err) {
                  console.error('[TripDetail] Failed to generate new days:', err);
                  toast.error('Failed to start generation. Please try again.');
                }
              }}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Build {generateNewDaysPrompt.daysAdded === 1 ? 'this day' : 'these days'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
