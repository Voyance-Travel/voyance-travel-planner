import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTripCities } from '@/services/tripCitiesService';
import type { TripCity } from '@/types/tripCity';
import { checkRedistributionNeeded, applyNightsRedistribution, type NightsRedistribution } from '@/utils/syncTripCitiesNights';
import { NightsRedistributionModal } from '@/components/trip/NightsRedistributionModal';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format, isAfter, isBefore, differenceInDays, addDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Loader2, MapPin, ArrowLeft, Sparkles, CheckCircle } from 'lucide-react';
import { GenerationPhases } from '@/components/planner/shared/GenerationPhases';
import { TripDateEditor, type DateChangeResult } from '@/components/trip/TripDateEditor';
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

import type { SwapSuggestion } from '@/components/trip/SwapReviewDialog';
import { VersionConflictDialog } from '@/components/trip/VersionConflictDialog';
import { supabase } from '@/integrations/supabase/client';
import { setCachedVersion, clearCachedVersion, saveItineraryOptimistic, fetchAndCacheVersion } from '@/services/itineraryOptimisticUpdate';
import { useScheduleNotifications } from '@/services/tripNotificationsAPI';
import { useScrollLockCleanup } from '@/hooks/useScrollLockCleanup';
import { useTripLearning } from '@/services/tripLearningsAPI';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { GeneratedDay, TripOverview } from '@/hooks/useItineraryGeneration';
import { enrichHotel } from '@/services/hotelAPI';
import { usePaymentVerification } from '@/hooks/usePaymentVerification';
import { useStalePendingChargeRefund } from '@/hooks/useStalePendingChargeRefund';
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';
import TripPhotoGallery from '@/components/trip/TripPhotoGallery';
import { getDestinationByCity, type Destination } from '@/services/supabase/destinations';
import { initiateBooking } from '@/services/tripPaymentsAPI';
import { toast } from 'sonner';
import { normalizeLegacyHotelSelection, type HotelBooking } from '@/utils/hotelValidation';
import { parseEditorialDays, parseAssistantDays } from '@/utils/itineraryParser';
import { normalizeFlightSelection } from '@/utils/normalizeFlightSelection';
import { injectHotelActivitiesIntoDays, injectMultiHotelActivities } from '@/utils/injectHotelActivities';
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
  const [autoStartGeneration, setAutoStartGeneration] = useState(false);
  const [isSyncingTrip, setIsSyncingTrip] = useState(false);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const [destinationMeta, setDestinationMeta] = useState<Destination | null>(null);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [hasCollaborators, setHasCollaborators] = useState(false);
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

  // Entitlements — gate premium features like chat assistant
  const { data: entitlements, refresh: refreshEntitlements } = useEntitlements(tripId);
  // Premium access = paid purchase, smart finish, OR this trip has unlocked days
  // First-trip free days (1-2) do NOT grant chat/swap access on locked days
  const hasPremiumAccess = entitlements?.has_completed_purchase || entitlements?.trip_has_smart_finish || 
    // If can_view_photos is true but NOT from first-trip, it means trip has been unlocked
    (entitlements?.can_view_photos && !entitlements?.is_first_trip) || false;

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

  // =========================================================================
  // SERVER-SIDE GENERATION: Poll for background generation progress
  // =========================================================================
  const [itineraryDaysCount, setItineraryDaysCount] = useState<number>(0);
  const [itineraryDaysSummaries, setItineraryDaysSummaries] = useState<Array<{ day_number: number; title: string; theme: string }>>([]);
  const isServerGenerating = trip?.itinerary_status === 'generating' || trip?.itinerary_status === 'queued' || (itineraryDaysCount > 0 && !trip?.itinerary_data && trip?.itinerary_status !== 'ready' && (trip?.itinerary_status as string) !== 'generated');
  const [generationStalled, setGenerationStalled] = useState(false);
  const [resumingGeneration, setResumingGeneration] = useState(false);
  const onReadyCalledRef = useRef(false);

  const generationPoller = useGenerationPoller({
    tripId: tripId || null,
    enabled: isServerGenerating && !generationStalled,
    interval: 3000,
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
    onFailed: (err) => {
      setGenerationStalled(false);
      toast.error(`Generation failed: ${err}. Credits for ungenerated days have been refunded.`, { duration: 6000 });
      if (tripId) {
        supabase.from('trips').select('*').eq('id', tripId).single().then(({ data }) => {
          if (data) setTrip(data);
        });
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
    if (!tripId || !trip) return;
    setResumingGeneration(true);
    setGenerationStalled(false);

    const meta = (trip.metadata as Record<string, unknown>) || {};
    const completedDays = (meta.generation_completed_days as number) || 0;
    const totalDays = (meta.generation_total_days as number) || 0;

    try {
      // Reset status to generating with fresh heartbeat
      await supabase.from('trips').update({
        itinerary_status: 'generating',
        metadata: {
          ...meta,
          generation_error: null,
          generation_heartbeat: new Date().toISOString(),
          generation_started_at: new Date().toISOString(),
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
          destination: trip.destination,
          destinationCountry: (trip as any).destination_country,
          startDate: trip.start_date,
          endDate: trip.end_date,
          travelers: trip.travelers || 1,
          tripType: trip.trip_type,
          budgetTier: (trip as any).budget_tier,
          isMultiCity: !!(trip as any).is_multi_city,
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
      setResumingGeneration(false);
    }
  }, [tripId, trip, supabase]);
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
      handleShowGenerator(true);
    }
    // If we returned to the page while generation is in progress, clean up the URL param
    if (shouldAutoGenerate && trip && (isServerGenerating || trip.itinerary_status === 'generating' || trip.itinerary_status === 'queued')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('generate');
        return next;
      }, { replace: true });
    }
  }, [shouldAutoGenerate, trip, loading, isServerGenerating]);

  // Helper to check if trip has itinerary data
  function hasItineraryData(t: Trip | null): boolean {
    if (!t) return false;
    const meta = t.itinerary_data as Record<string, unknown> | null;
    if (!meta) return false;
    // Check canonical top-level days first
    const rawDays = meta.days as unknown[] | undefined;
    if (Array.isArray(rawDays) && rawDays.length > 0) return true;
    // Fallback: check nested itinerary.days (backward compat with older saves)
    const nested = meta.itinerary as Record<string, unknown> | undefined;
    return Array.isArray(nested?.days) && (nested.days as unknown[]).length > 0;
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
        const { data: tripData, error: tripError } = await supabase
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
        try {
          const { data: daysSummary, count: daysCount } = await supabase
            .from('itinerary_days')
            .select('day_number, title, theme', { count: 'exact' })
            .eq('trip_id', tripId)
            .order('day_number');
          setItineraryDaysCount(daysCount || 0);
          setItineraryDaysSummaries((daysSummary || []).map((d: any) => ({
            day_number: d.day_number,
            title: d.title || `Day ${d.day_number}`,
            theme: d.theme || '',
          })));
        } catch (e) {
          console.warn('[TripDetail] itinerary_days check failed:', e);
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
    };
  }, [tripId]);

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
            toast.success(`Trip pricing synced: ${result.repaired} activities updated`);
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
      const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
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
        
        // Fetch current unlocked_day_count to ensure we never decrease it
        const { data: currentTrip } = await supabase
          .from('trips')
          .select('unlocked_day_count')
          .eq('id', tripId)
          .maybeSingle();
        const existingUnlocked = (currentTrip as any)?.unlocked_day_count ?? 0;
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
          ? 'Trip dates shifted — use "Refresh Day" to check for scheduling issues'
          : daysAdded > 0
            ? `${daysAdded} day${daysAdded > 1 ? 's' : ''} added${insertPosition === 'before' ? ' at the start' : ' at the end'}`
            : `${Math.abs(daysAdded)} day${Math.abs(daysAdded) > 1 ? 's' : ''} removed${archivedDays ? ' (archived)' : ''}`;
        toast.success(msg);

        // Sync trip_cities nights/dates
        await syncCitiesAfterDateChange(result);
      }
    } catch (err) {
      console.error('[TripDetail] Date change error:', err);
      toast.error('Failed to update dates');
    }
  }, [trip, tripId, syncCitiesAfterDateChange]);

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
      activities[actIdx] = {
        ...activities[actIdx],
        name: swap.suggestedActivity,
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
  const itineraryDays = transformToItineraryDays();

  // Compute effective end date: if itinerary has more days than start_date→end_date suggests,
  // derive end_date from start_date + (numDays - 1) to fix stale/incorrect end_date values
  const effectiveEndDate = (() => {
    const storedDayCount = differenceInDays(parseLocalDate(trip.end_date), parseLocalDate(trip.start_date));
    const itineraryDayCount = itineraryDays.length;
    if (itineraryDayCount > 1 && itineraryDayCount > storedDayCount) {
      const start = parseLocalDate(trip.start_date);
      const corrected = new Date(start);
      corrected.setDate(corrected.getDate() + itineraryDayCount);
      return format(corrected, 'yyyy-MM-dd');
    }
    return trip.end_date;
  })();

  return (
    <MainLayout>
      <Head title={`${trip.name} | Voyance`} />
      
      {/* Hero Destination Image — compact on mobile, taller on desktop */}
      <div className="relative h-40 sm:h-56 md:h-72 -mt-16">
        <ErrorBoundary>
        <DynamicDestinationPhotos
          destination={trip.destination}
          startDate={trip.start_date}
          endDate={effectiveEndDate}
          travelers={trip.travelers || 1}
          variant="hero"
          hideOverlayText
          className="!rounded-none"
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

      <section className="pb-16 pt-8 sm:pt-10 relative z-10">
        <div className="max-w-4xl mx-auto px-4">
          {(() => {
            const isPastTrip = isAfter(new Date(), parseLocalDate(effectiveEndDate));
            const statusLabel = isLiveTrip ? 'Active' : isPastTrip && trip.status === 'draft' ? 'Past' : (trip.status || 'draft');
            return (
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">{trip.name}</h1>
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
              </div>
            );
          })()}


          {/* Live Itinerary View for active trips */}
          {isLiveTrip ? (
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
              {generationStalled ? (
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
                  totalDays={generationPoller.totalDays || differenceInDays(parseLocalDate(effectiveEndDate), parseLocalDate(trip.start_date))}
                  tripId={trip.id}
                  completedDays={generationPoller.completedDays}
                  generatedDaysList={generationPoller.generatedDaysList}
                  isComplete={generationPoller.isReady}
                  progress={generationPoller.progress}
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
                      days={parseEditorialDays({ days: generationPoller.partialDays }, trip.start_date) as EditorialDay[]}
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
          ) : showGenerator ? (
            /* Itinerary Generator */
            <ErrorBoundary>
            <ItineraryGenerator
              tripId={trip.id}
              destination={trip.destination}
              destinationCountry={trip.destination_country || undefined}
              startDate={trip.start_date}
              endDate={effectiveEndDate}
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
                      Let our AI create a personalized {differenceInDays(parseLocalDate(effectiveEndDate), parseLocalDate(trip.start_date))}-day itinerary 
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
              const editorDays: EditorialDay[] = parseEditorialDays(trip.itinerary_data, trip.start_date) as EditorialDay[];

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
                if (!isMultiCity) return [];

                // When is_multi_city is true but tripCities hasn't loaded yet, skip the
                // destination-string fallback (which often produces only 1 city) and wait
                // for tripCities to load on the next render cycle.
                if (tripCities.length === 0) return [];

                // Prefer trip_cities from DB (authoritative source)
                if (tripCities.length >= 1) {
                  return tripCities.map((city, idx) => {
                    const hotelRaw = city.hotel_selection as any;
                    // hotel_selection in trip_cities can be an array [{name:...}] or object {name:...}
                    const hotelData = Array.isArray(hotelRaw) && hotelRaw.length > 0 ? hotelRaw[0] : hotelRaw;
                    const normalizedHotel = allNormalizedHotels[idx];
                    const hotel = hotelData?.name ? hotelData : normalizedHotel;
                    return {
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
                      // Transport to this city
                      transportType: city.transport_type || undefined,
                      transportDetails: city.transport_details || undefined,
                      transportCostCents: city.transport_cost_cents || 0,
                      transportCurrency: city.transport_currency || 'USD',
                      arrivalTransfer: (city as any).arrival_transfer || null,
                      departureTransfer: (city as any).departure_transfer || null,
                    };
                  });
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
                  {/* Mobile: Collapsed Trip Overview wrapping Health + Travel Intel */}
                  <div className="sm:hidden mb-4">
                    <MobileTripOverview
                      tripHealthPanel={
                        <ErrorBoundary>
                          <TripHealthPanel
                            days={editorDays}
                            totalDaysExpected={editorDays.length}
                            hasFlights={!!trip.flight_selection}
                            hasHotel={
                              !!trip.hotel_selection || 
                              (tripCities.length > 0 && tripCities.every(c => {
                                const h = c.hotel_selection as any;
                                const hotel = Array.isArray(h) && h.length > 0 ? h[0] : h;
                                return !!hotel?.name;
                              }))
                            }
                            isMultiCity={!!(trip as any).is_multi_city || tripCities.length > 1}
                            hasInterCityTransport={editorDays.some((d: any) => d.isTransitionDay)}
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
                              } else if (action === 'generate_day' || action === 'refresh_day') {
                                toast.info(`Use the day toolbar to ${action === 'generate_day' ? 'generate' : 'refresh'} Day ${ctx?.dayNumber || ''}`);
                              } else if (action === 'generate_missing_days' || action === 'generate_all') {
                                setShowGenerator(true);
                              }
                            }}
                          />
                        </ErrorBoundary>
                      }
                      travelIntelCards={
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
                  </div>

                  {/* Desktop: Original layout — Health + Travel Intel separately */}
                  <div className="hidden sm:block">
                    <ErrorBoundary>
                    <TripHealthPanel
                      days={editorDays}
                      totalDaysExpected={editorDays.length}
                      hasFlights={!!trip.flight_selection}
                      hasHotel={
                        !!trip.hotel_selection || 
                        (tripCities.length > 0 && tripCities.every(c => {
                          const h = c.hotel_selection as any;
                          const hotel = Array.isArray(h) && h.length > 0 ? h[0] : h;
                          return !!hotel?.name;
                        }))
                      }
                      isMultiCity={!!(trip as any).is_multi_city || tripCities.length > 1}
                      hasInterCityTransport={editorDays.some((d: any) => d.isTransitionDay)}
                      className="mb-4"
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
                        } else if (action === 'generate_day' || action === 'refresh_day') {
                          toast.info(`Use the day toolbar to ${action === 'generate_day' ? 'generate' : 'refresh'} Day ${ctx?.dayNumber || ''}`);
                        } else if (action === 'generate_missing_days' || action === 'generate_all') {
                          setShowGenerator(true);
                        }
                      }}
                    />
                    </ErrorBoundary>
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
                          className="mb-4"
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
                        className="mb-4"
                      />
                    )}
                    </ErrorBoundary>
                  </div>

                  {/* Subtle edit-dates link */}
                  <div className="mb-3 flex justify-end">
                    <TripDateEditor
                      startDate={trip.start_date}
                      endDate={effectiveEndDate}
                      hasItinerary={hasItinerary}
                      flightSelection={trip.flight_selection as Record<string, unknown> | null}
                      onDateChange={handleDateChange}
                      days={editorDays}
                      cities={tripCities}
                      compact
                    />
                  </div>

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
                  itineraryStatus={trip.itinerary_status}
                  journeyId={trip.journey_id}
                  journeyName={trip.journey_name}
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
                        try {
                          const itData = updatedTrip.itinerary_data as Record<string, any> | null;
                          const currentDays = parseEditorialDays(itData, updatedTrip.start_date);
                          if (currentDays.length > 0) {
                            let injectedDays = currentDays;

                            // Multi-city: inject from trip_cities hotel selections
                            if (updatedCities.length > 0) {
                              const cityHotels = updatedCities
                                .filter((c: any) => c.hotel_selection)
                                .map((c: any) => {
                                  const hs = Array.isArray(c.hotel_selection) ? c.hotel_selection[0] : c.hotel_selection;
                                  return hs;
                                })
                                .filter(Boolean);
                              if (cityHotels.length > 0) {
                                injectedDays = injectMultiHotelActivities(injectedDays as any[], cityHotels) as typeof injectedDays;
                              }
                            }

                            // Single-city: inject from trips.hotel_selection
                            const hotelRaw = updatedTrip.hotel_selection as any;
                            if (hotelRaw && updatedCities.length <= 1) {
                              const hotels = normalizeLegacyHotelSelection(hotelRaw, updatedTrip.start_date, updatedTrip.end_date);
                              if (hotels.length > 0) {
                                injectedDays = injectHotelActivitiesIntoDays(injectedDays as any[], hotels[0]) as typeof injectedDays;
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
                  }}
                  onUnlockComplete={(enrichedItinerary) => {
                    refreshEntitlements();
                    setTrip(prev => prev ? {
                      ...prev,
                      itinerary_data: enrichedItinerary as any,
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

          {/* Trip Photo Gallery */}
          <div className="mt-12">
            <ErrorBoundary>
            <TripPhotoGallery tripId={trip.id} />
            </ErrorBoundary>
          </div>

          {/* Journey "Up Next" portal — only for linked journey trips */}
          {trip.journey_id && trip.journey_order && trip.journey_total_legs && (
            <JourneyUpNext
              journeyId={trip.journey_id}
              journeyName={trip.journey_name}
              journeyOrder={trip.journey_order}
              journeyTotalLegs={trip.journey_total_legs}
            />
          )}

        </div>
      </section>

      {/* Itinerary Assistant - Floating Chatbot */}
      {hasItinerary && !(isManualMode && !trip.smart_finish_purchased) && hasPremiumAccess && (
        <ErrorBoundary fallback={null}>
        <ItineraryAssistant
          tripId={trip.id}
          destination={trip.destination}
          startDate={trip.start_date}
          endDate={effectiveEndDate}
          isLocalTrip={trip.user_id === 'local'}
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
            toast.error('Failed to save — please try again.');
          }
        }}
        onCancel={() => {
          setConflictState({ open: false, localData: null });
          toast('Local changes discarded.');
        }}
      />
    </MainLayout>
  );
}
