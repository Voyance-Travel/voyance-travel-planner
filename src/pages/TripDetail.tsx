import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';
import { useScheduleNotifications } from '@/services/tripNotificationsAPI';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { GeneratedDay, TripOverview } from '@/hooks/useItineraryGeneration';
import { enrichHotel } from '@/services/hotelAPI';
import { usePaymentVerification } from '@/hooks/usePaymentVerification';

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
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<TripActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [isSyncingTrip, setIsSyncingTrip] = useState(false);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const scheduleNotifications = useScheduleNotifications();
  const { user } = useAuth();
  const hotelEnrichmentAttempted = useRef(false);

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
    
    const hotelSel = trip.hotel_selection as Record<string, unknown> | null;
    if (!hotelSel?.name) return; // No hotel selected
    
    // Check if enrichment is needed
    const hasAddress = !!hotelSel.address;
    const hasWebsite = !!hotelSel.website || !!hotelSel.googleMapsUrl;
    const hasPhotos = Array.isArray(hotelSel.images) && hotelSel.images.length > 0;
    
    if (hasAddress && hasWebsite && hasPhotos) {
      console.log('[TripDetail] Hotel already enriched, skipping');
      return;
    }
    
    hotelEnrichmentAttempted.current = true;
    console.log('[TripDetail] Enriching hotel:', hotelSel.name);
    
    // Normalize destination (strip IATA codes)
    const cleanDestination = (trip.destination || '')
      .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
      .trim();
    
    const enrichment = await enrichHotel(hotelSel.name as string, cleanDestination);
    
    if (!enrichment) {
      console.log('[TripDetail] Hotel enrichment returned no data');
      return;
    }
    
    // Merge enrichment data into hotel selection
    const enrichedHotel = {
      ...hotelSel,
      address: enrichment.address || hotelSel.address,
      website: enrichment.website || hotelSel.website,
      googleMapsUrl: enrichment.googleMapsUrl || hotelSel.googleMapsUrl,
      images: (enrichment.photos && enrichment.photos.length > 0) 
        ? enrichment.photos 
        : hotelSel.images,
      placeId: enrichment.placeId || hotelSel.placeId,
    };
    
    console.log('[TripDetail] Enriched hotel data:', enrichedHotel);
    
    // Update local state
    setTrip(prev => prev ? { ...prev, hotel_selection: enrichedHotel as any } : prev);
    
    // Persist to backend
    if (tripId) {
      try {
        const { error } = await supabase
          .from('trips')
          .update({ hotel_selection: enrichedHotel as any, updated_at: new Date().toISOString() })
          .eq('id', tripId);
        
        if (error) {
          console.error('[TripDetail] Failed to persist enriched hotel:', error);
        } else {
          console.log('[TripDetail] Enriched hotel persisted successfully');
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
  const handleShowGenerator = async () => {
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

    setShowGenerator(true);
  };

  const loadLocalTrip = (id: string): Trip | null => {
    try {
      // Preferred demo/local storage format (TripPlannerContext)
      const demoTripsRaw = localStorage.getItem('voyance_demo_trips');
      if (demoTripsRaw) {
        const demoTrips = JSON.parse(demoTripsRaw);
        if (demoTrips?.[id]) return demoTrips[id] as Trip;
      }

      // Legacy anonymous format used in some planner flows
      const legacyRaw = localStorage.getItem(`trip_${id}`);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed?.destination && parsed?.startDate && parsed?.endDate) {
          return {
            id,
            user_id: 'local',
            name: parsed.name || `Trip to ${parsed.destination}`,
            destination: parsed.destination,
            destination_country: parsed.destination_country || null,
            start_date: parsed.startDate,
            end_date: parsed.endDate,
            status: parsed.status || 'draft',
            trip_type: parsed.tripType || null,
            travelers: parsed.travelers || 1,
            origin_city: parsed.originCity || null,
            budget_tier: parsed.budgetTier || null,
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
    } catch {
      // ignore
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
            return;
          }

          setTrip(null);
          setError('Trip not found');
          return;
        }

        setTrip(tripData);

        // Fetch activities
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('trip_activities')
          .select('*')
          .eq('trip_id', tripId)
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
      } finally {
        setLoading(false);
      }
    }

    fetchTripData();
  }, [tripId]);

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
    const itineraryPayload = { 
      days: generatedDays,
      overview: generatedOverview,
      status: 'ready',
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

  const handleActivityComplete = async (activityId: string) => {
    // Update activity status in database
    await supabase
      .from('trip_activities')
      .update({ 
        metadata: { 
          ...(activities.find(a => a.id === activityId)?.metadata as Record<string, unknown> || {}),
          completed: true,
          completedAt: new Date().toISOString()
        }
      })
      .eq('id', activityId);
  };

  const handleActivitySkip = async (activityId: string) => {
    // Update activity status in database
    await supabase
      .from('trip_activities')
      .update({ 
        metadata: { 
          ...(activities.find(a => a.id === activityId)?.metadata as Record<string, unknown> || {}),
          skipped: true,
          skippedAt: new Date().toISOString()
        }
      })
      .eq('id', activityId);
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
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Status Badge for non-active trips */}
          {!isLiveTrip && (
            <div className="flex items-center gap-4 mb-6">
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

              {trip.status === 'draft' || trip.status === 'planning' ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/planner?tripId=${trip.id}`)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Continue Planning
                </Button>
              ) : null}
            </div>
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
              onComplete={handleGenerationComplete}
              onCancel={() => setShowGenerator(false)}
            />
          ) : !hasItinerary ? (
            /* Empty Itinerary - Show Generate CTA */
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

              {/* Generate Itinerary CTA */}
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
                    onClick={handleShowGenerator} 
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
          ) : (
            /* Editorial Itinerary - Same design as SampleItinerary with editing */
            (() => {
              const metadata = trip.itinerary_data as Record<string, unknown> | null;
              const rawDays = (metadata?.days as unknown[]) || [];
              
              const editorDays: EditorialDay[] = rawDays.map((day: unknown, idx: number) => {
                const d = day as Record<string, unknown>;
                const activities = (d.activities as unknown[]) || [];
                return {
                  dayNumber: (d.dayNumber as number) || idx + 1,
                  date: (d.date as string) || calculateDayDate(trip.start_date, idx),
                  title: (d.title as string) || (d.theme as string) || undefined,
                  theme: d.theme as string | undefined,
                  description: d.description as string | undefined,
                  estimatedWalkingTime: d.estimatedWalkingTime as string | undefined,
                  estimatedDistance: d.estimatedDistance as string | undefined,
                  weather: d.weather as { condition?: string; high?: number; low?: number } | undefined,
                  activities: activities.map((act: unknown, actIdx: number) => {
                    const a = act as Record<string, unknown>;
                    const loc = a.location as Record<string, unknown> | string | undefined;
                    return {
                      id: (a.id as string) || `act-${idx}-${actIdx}`,
                      title: (a.title as string) || (a.name as string) || 'Activity',
                      description: (a.description as string) || undefined,
                      category: (a.category as string) || 'activity',
                      startTime: (a.startTime as string) || (a.start_time as string) || undefined,
                      endTime: (a.endTime as string) || (a.end_time as string) || undefined,
                      time: a.time as string | undefined,
                      duration: a.duration as string | undefined,
                      durationMinutes: a.durationMinutes as number | undefined,
                      location: typeof loc === 'object' && loc !== null 
                        ? { name: loc.name as string, address: loc.address as string }
                        : { name: String(loc || '') },
                      cost: a.cost as { amount: number; currency: string } | undefined,
                      bookingRequired: (a.bookingRequired as boolean) || false,
                      tags: (a.tags as string[]) || [],
                      transportation: a.transportation as { method: string; duration: string; estimatedCost?: { amount: number; currency: string }; instructions?: string } | undefined,
                      isLocked: (a.isLocked as boolean) || false,
                      rating: a.rating as { value: number; totalReviews: number } | number | undefined,
                      website: a.website as string | undefined,
                      tips: a.tips as string | undefined,
                      photos: a.photos as Array<{ url: string } | string> | undefined,
                    };
                  }),
                };
              });

              // Normalize flight_selection: TripPlannerContext saves with 'departure' key, 
              // but EditorialItinerary expects 'outbound' key
              const rawFlight = trip.flight_selection as Record<string, unknown> | null;
              
              // Helper to safely extract nested properties
              const getFlightLeg = (source: Record<string, unknown> | undefined) => {
                if (!source) return undefined;
                const dep = source.departure as Record<string, unknown> | undefined;
                const arr = source.arrival as Record<string, unknown> | undefined;
                return {
                  airline: source.airline as string | undefined,
                  flightNumber: source.flightNumber as string | undefined,
                  departure: {
                    time: (dep?.time as string) || (source.departureTime as string) || undefined,
                    airport: dep?.airport as string | undefined,
                    date: undefined as string | undefined,
                  },
                  arrival: {
                    time: (arr?.time as string) || (source.arrivalTime as string) || undefined,
                    airport: arr?.airport as string | undefined,
                  },
                  price: source.price as number | undefined,
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

              return (
                <EditorialItinerary
                  tripId={trip.id}
                  destination={trip.destination}
                  destinationCountry={trip.destination_country || undefined}
                  startDate={trip.start_date}
                  endDate={trip.end_date}
                  travelers={trip.travelers || 1}
                  budgetTier={trip.budget_tier || undefined}
                  days={editorDays}
                  flightSelection={normalizedFlight}
                  hotelSelection={trip.hotel_selection as Record<string, unknown> | null}
                  isEditable={true}
                />
              );
            })()
          )}
        </div>
      </section>
    </MainLayout>
  );
}
