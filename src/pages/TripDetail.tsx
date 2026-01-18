import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Loader2, Calendar, MapPin, ArrowLeft, Edit } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LiveItineraryView } from '@/components/itinerary/LiveItineraryView';
import { supabase } from '@/integrations/supabase/client';
import { useScheduleNotifications } from '@/services/tripNotificationsAPI';
import type { Tables } from '@/integrations/supabase/types';

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
  const scheduleNotifications = useScheduleNotifications();

  useEffect(() => {
    async function fetchTripData() {
      if (!tripId) return;

      try {
        setLoading(true);
        
        // Fetch trip details
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (tripError) throw tripError;
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
          setTrip(prev => prev ? { ...prev, status: 'active' } : null);
          
          // Schedule notifications for the active trip
          scheduleNotifications.mutate({ 
            tripId, 
            userId: tripData.user_id 
          });
        } else if ((tripData.status === 'active' || tripData.status === 'booked') && isAfter(now, endDate)) {
          // Trip should be completed
          await supabase
            .from('trips')
            .update({ status: 'completed' })
            .eq('id', tripId);
          setTrip(prev => prev ? { ...prev, status: 'completed' } : null);
        }

      } catch (err) {
        console.error('Error fetching trip:', err);
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
            <Button onClick={() => navigate('/dashboard')}>
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
          ) : (
            // Static view for non-active trips
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold">{trip.name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground mt-2">
                  <MapPin className="w-4 h-4" />
                  <span>{trip.destination}</span>
                  {trip.destination_country && (
                    <span className="text-muted-foreground/60">• {trip.destination_country}</span>
                  )}
                </div>
              </div>

              {/* Simple itinerary display for non-active trips */}
              <div className="space-y-4">
                {itineraryDays.map((day) => (
                  <div key={day.dayNumber} className="border rounded-xl p-4">
                    <h3 className="font-semibold mb-3">
                      Day {day.dayNumber} - {format(parseISO(day.date), 'EEEE, MMM d')}
                      {day.theme && <span className="text-muted-foreground ml-2">• {day.theme}</span>}
                    </h3>
                    
                    {day.activities.length > 0 ? (
                      <div className="space-y-2">
                        {day.activities.map((activity, idx) => (
                          <div key={activity.id || idx} className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground w-16 flex-shrink-0">
                              {activity.startTime || '--:--'}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{activity.name}</p>
                              {activity.location?.name && (
                                <p className="text-xs text-muted-foreground">{activity.location.name}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No activities planned</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
