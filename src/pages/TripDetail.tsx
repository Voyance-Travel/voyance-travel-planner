import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore, differenceInDays } from 'date-fns';
import { Loader2, Calendar, MapPin, ArrowLeft, Edit, Sparkles } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LiveItineraryView } from '@/components/itinerary/LiveItineraryView';
import { ItineraryGenerator } from '@/components/itinerary/ItineraryGenerator';
import { EditorialItinerary } from '@/components/itinerary/EditorialItinerary';
import type { EditorialDay } from '@/components/itinerary/EditorialItinerary';
import { ItineraryAssistant } from '@/components/itinerary/ItineraryAssistant';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import { TripDebriefModal } from '@/components/trip/TripDebriefModal';
import { TripConfirmationBanner } from '@/components/trip/TripConfirmationBanner';
import type { SwapSuggestion } from '@/components/trip/SwapReviewDialog';
import { supabase } from '@/integrations/supabase/client';
import { useScheduleNotifications } from '@/services/tripNotificationsAPI';
import { useTripLearning } from '@/services/tripLearningsAPI';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { GeneratedDay, TripOverview } from '@/hooks/useItineraryGeneration';
import { enrichHotel } from '@/services/hotelAPI';
import { usePaymentVerification } from '@/hooks/usePaymentVerification';
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';
import TripPhotoGallery from '@/components/trip/TripPhotoGallery';
import { getDestinationByCity, type Destination } from '@/services/supabase/destinations';
import { initiateBooking } from '@/services/tripPaymentsAPI';
import { toast } from 'sonner';
import { normalizeLegacyHotelSelection, type HotelBooking } from '@/utils/hotelValidation';
import { parseEditorialDays, parseAssistantDays } from '@/utils/itineraryParser';
import { cn } from '@/lib/utils';

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
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldAutoGenerate = searchParams.get('generate') === 'true';
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<TripActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [autoStartGeneration, setAutoStartGeneration] = useState(false);
  const [isSyncingTrip, setIsSyncingTrip] = useState(false);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const [destinationMeta, setDestinationMeta] = useState<Destination | null>(null);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [hasCollaborators, setHasCollaborators] = useState(false);
  const scheduleNotifications = useScheduleNotifications();
  const { isManualBuilder } = useManualBuilderStore();
  const isManualMode = tripId ? isManualBuilder(tripId) : false;
  const { user } = useAuth();
  const hotelEnrichmentAttempted = useRef(false);
  const debriefPromptAttempted = useRef(false);
  const autoGenerateTriggered = useRef(false);

  // Check if trip already has a learning submitted
  const { data: existingLearning } = useTripLearning(tripId || '');

  // Payment verification on return from Stripe
  usePaymentVerification({
    onSuccess: () => {
      // Refresh payments display
      setPaymentsRefreshKey(prev => prev + 1);
    },
  });

  // =========================================================================
  // HOTEL ENRICHMENT: Auto-enrich if missing address/website/photos
  // =========================================================================
  const enrichHotelIfNeeded = useCallback(async () => {
    if (!trip || hotelEnrichmentAttempted.current) return;

    // hotel_selection supports array (multi-hotel) and legacy single-object.
    // For enrichment we enrich the primary hotel (first in array).
    const hotelRaw = trip.hotel_selection as unknown;
    const hotels = normalizeLegacyHotelSelection(hotelRaw, trip.start_date, trip.end_date);
    const primaryHotel: HotelBooking | undefined = hotels[0];
    if (!primaryHotel?.name) return; // No hotel selected
    
    // Check if enrichment is needed
    const hasAddress = !!primaryHotel.address;
    const hasWebsite = !!primaryHotel.website;
    const hasPhotos = Array.isArray(primaryHotel.images) && primaryHotel.images.length > 0;
    
    if (hasAddress && hasWebsite && hasPhotos) {
      // Hotel already enriched, skipping
      return;
    }
    
    hotelEnrichmentAttempted.current = true;
    // Enriching hotel data
    
    // Normalize destination (strip IATA codes)
    const cleanDestination = (trip.destination || '')
      .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
      .trim();
    
    const enrichment = await enrichHotel(primaryHotel.name as string, cleanDestination);
    
    if (!enrichment) {
      // Hotel enrichment returned no data
      return;
    }
    
    // Merge enrichment data into hotel selection
    const enrichedHotel = {
      ...primaryHotel,
      address: enrichment.address || primaryHotel.address,
      website: enrichment.website || primaryHotel.website,
      googleMapsUrl: enrichment.googleMapsUrl || primaryHotel.googleMapsUrl,
      images: (enrichment.photos && enrichment.photos.length > 0) 
        ? enrichment.photos 
        : primaryHotel.images,
      placeId: enrichment.placeId || primaryHotel.placeId,
    };
    
    // Enriched hotel data ready
    
    // Rebuild array (preserve other hotels) and update local state
    const updatedHotels = hotels.map((h, idx) => (idx === 0 ? enrichedHotel : h));
    setTrip(prev => (prev ? { ...prev, hotel_selection: updatedHotels as any } : prev));
    
    // Persist to backend
    if (tripId) {
      try {
        const { error } = await supabase
          .from('trips')
          .update({ hotel_selection: updatedHotels as any, updated_at: new Date().toISOString() })
          .eq('id', tripId);
        
        if (error) {
          console.error('[TripDetail] Failed to persist enriched hotel:', error);
        } else {
          // Enriched hotel persisted successfully
        }
      } catch (err) {
        console.error('[TripDetail] Error persisting enriched hotel:', err);
      }
    }
  }, [trip, tripId]);

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
      !hasItineraryData(trip)
    ) {
      autoGenerateTriggered.current = true;
      handleShowGenerator(true);
    }
  }, [shouldAutoGenerate, trip, loading]);

  // Helper to check if trip has itinerary data
  function hasItineraryData(t: Trip | null): boolean {
    if (!t) return false;
    const meta = t.itinerary_data as Record<string, unknown> | null;
    const rawDays = meta?.days as unknown[] | undefined;
    return Array.isArray(rawDays) && rawDays.length > 0;
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
        const startDate = parseISO(tripData.start_date);
        const endDate = parseISO(tripData.end_date);

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
  }, [tripId]);

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
      // Small delay to let UI settle
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
      const start = parseISO(trip.start_date);
      const end = parseISO(trip.end_date);
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
    const start = parseISO(startDate);
    const date = new Date(start);
    date.setDate(date.getDate() + dayOffset);
    return date.toISOString();
  };

  // Check if itinerary has real content
  const hasItinerary = (() => {
    const days = transformToItineraryDays();
    return days.some(d => d.activities.length > 0);
  })();

  // Handle itinerary generation complete - also force-save to backend
  const handleGenerationComplete = useCallback(async (generatedDays: GeneratedDay[], generatedOverview?: TripOverview) => {
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
    
    // Force-save to backend so we never regenerate on refresh
    if (tripId) {
      try {
        console.log('[TripDetail] Force-saving itinerary to backend:', tripId);
        const { error } = await supabase
          .from('trips')
          .update({
            itinerary_data: JSON.parse(JSON.stringify(itineraryPayload)) as any,
            itinerary_status: 'ready',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tripId);
        
        if (error) {
          console.error('[TripDetail] Failed to force-save itinerary:', error);
        } else {
          console.log('[TripDetail] Itinerary force-saved successfully');
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

    // Persist to backend
    supabase
      .from('trips')
      .update({ itinerary_data: newItineraryData as any, updated_at: new Date().toISOString() })
      .eq('id', tripId!)
      .then(({ error }) => {
        if (error) console.error('[TripDetail] Failed to save swaps:', error);
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

  return (
    <MainLayout>
      <Head title={`${trip.name} | Voyance`} />
      
      {/* Hero Destination Image */}
      <div className="relative h-56 md:h-72 -mt-16">
        <DynamicDestinationPhotos
          destination={trip.destination}
          startDate={trip.start_date}
          endDate={trip.end_date}
          travelers={trip.travelers || 1}
          variant="hero"
          hideOverlayText
          className="!rounded-none"
        />
        {/* Back Button - positioned on hero */}
        <div className="absolute top-20 left-4 md:left-8 z-20">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="bg-background/90 backdrop-blur-sm hover:bg-background shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        {/* Subtle bottom fade for content transition */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>
      
      <section className="pb-16 pt-6 relative z-10">
        <div className="max-w-4xl mx-auto px-4">
          {/* Status Badge and Actions for non-active trips */}
          {!isLiveTrip && (
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <Badge 
                variant={
                  trip.status === 'completed' ? 'secondary' : 
                  trip.status === 'booked' ? 'default' : 
                  'outline'
                }
                className="capitalize"
              >
                {trip.status}
              </Badge>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {format(parseISO(trip.start_date), 'MMM d')} - {format(parseISO(trip.end_date), 'MMM d, yyyy')}
              </div>
            </div>
          )}

          {/* Trip Confirmation Banner - ask if draft trip is real */}
          {hasItinerary && (
            <TripConfirmationBanner
              tripId={trip.id}
              destination={trip.destination}
              startDate={trip.start_date}
              endDate={trip.end_date}
              currentStatus={trip.status as string}
              hasFlightSelection={!!trip.flight_selection}
              hasHotelSelection={!!trip.hotel_selection}
              itineraryDays={itineraryDays}
              onStatusUpdate={(status) => setTrip(prev => prev ? { ...prev, status } as any : null)}
              onTripDataUpdate={(data) => setTrip(prev => prev ? { ...prev, ...data } as any : null)}
              onApplySwaps={handleApplySwaps}
              onRegenerateTrip={handleRegenerateTrip}
              className="mb-6"
            />
          )}

          {/* Live Itinerary View for active trips */}
          {isLiveTrip ? (
            <LiveItineraryView
              tripId={trip.id}
              tripName={trip.name}
              destination={trip.destination}
              startDate={trip.start_date}
              endDate={trip.end_date}
              days={itineraryDays}
              onActivityComplete={handleActivityComplete}
              onActivitySkip={handleActivitySkip}
            />
          ) : showGenerator ? (
            /* Itinerary Generator */
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
                      Let our AI create a personalized {differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1}-day itinerary 
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
                          <p className="font-medium">{format(parseISO(day.date), 'EEEE, MMM d')}</p>
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

              // Normalize flight_selection: TripPlannerContext saves with 'departure' key, 
              // but EditorialItinerary expects 'outbound' key
              const rawFlight = trip.flight_selection as Record<string, unknown> | null;
              
              // Helper to safely extract nested properties with multiple format support
              const getFlightLeg = (source: Record<string, unknown> | undefined) => {
                if (!source) return undefined;
                
                // Handle nested format: { departure: { time, airport }, arrival: { time, airport } }
                const nestedDep = source.departure as Record<string, unknown> | undefined;
                const nestedArr = source.arrival as Record<string, unknown> | undefined;
                
                // Handle flat format: { departureTime, arrivalTime } (from TripPlannerContext)
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
                    // CRITICAL: Check flat format first since that's what TripPlannerContext uses
                    time: flatArrivalTime || (nestedArr?.time as string) || undefined,
                    airport: (nestedArr?.airport as string) || undefined,
                  },
                  price: source.price as number | undefined,
                  cabinClass: source.cabin as string | undefined,
                };
              };

              const normalizedFlight = rawFlight ? (() => {
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
              })() : null;

              // hotel_selection can be an array (multi-hotel) or a legacy single object.
              // The editorial itinerary expects a single primary hotel object.
              const primaryHotelSelection = normalizeLegacyHotelSelection(
                trip.hotel_selection as unknown,
                trip.start_date,
                trip.end_date
              )[0] || null;

              return (
                <EditorialItinerary
                  tripId={trip.id}
                  destination={trip.destination}
                  destinationCountry={
                    trip.destination_country ||
                    ((destinationMeta as any)?.country as string | undefined) ||
                    undefined
                  }
                  startDate={trip.start_date}
                  endDate={trip.end_date}
                  travelers={trip.travelers || 1}
                  budgetTier={trip.budget_tier || undefined}
                  tripType={trip.trip_type || undefined}
                  days={editorDays}
                  flightSelection={normalizedFlight}
                  hotelSelection={primaryHotelSelection as any}
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
                  parsedMetadata={(() => {
                    const meta = (trip.itinerary_data as any)?.metadata;
                    if (meta?.source === 'manual_paste') return meta;
                    return undefined;
                  })()}
                  isEditable={true}
                  isPreview={!!(trip.itinerary_data as any)?.isPreview}
                  onBookingAdded={() => window.location.reload()}
                  onUnlockComplete={(enrichedItinerary) => {
                    // Refresh trip with enriched data — reload to re-parse
                    setTrip(prev => prev ? {
                      ...prev,
                      itinerary_data: enrichedItinerary as any,
                    } : prev);
                    // Force full reload to re-parse editorial days
                    window.location.reload();
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
              );
            })()
          )}

          {/* Trip Photo Gallery */}
          <div className="mt-12">
            <TripPhotoGallery tripId={trip.id} />
          </div>

        </div>
      </section>

      {/* Itinerary Assistant - Floating Chatbot */}
      {hasItinerary && !(isManualMode && !trip.smart_finish_purchased) && (
        <ItineraryAssistant
          tripId={trip.id}
          destination={trip.destination}
          startDate={trip.start_date}
          endDate={trip.end_date}
          isLocalTrip={trip.user_id === 'local'}
          days={parseAssistantDays(trip.itinerary_data, trip.start_date)}
          onItineraryUpdate={(updatedDays) => {
            // Refresh trip data to reflect changes - serialize for Json compatibility
            setTrip(prev => prev ? {
              ...prev,
              itinerary_data: JSON.parse(JSON.stringify({
                ...(prev.itinerary_data as Record<string, unknown> || {}),
                days: updatedDays,
              })),
            } : null);
          }}
        />
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
    </MainLayout>
  );
}
