/**
 * Consumer Trip Share Page
 * 
 * Public read-only view of a consumer trip, accessed via /trip-share/:token.
 * Uses get_consumer_shared_trip() to fetch sanitized trip data.
 * Completely separate from agency /share/:shareToken route.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { MapPin, Calendar, Users, Clock, Compass } from 'lucide-react';
import Head from '@/components/common/Head';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { getActivityFallbackImage } from '@/utils/activityFallbackImages';

interface SharedActivity {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  duration?: string;
  location?: { name?: string; address?: string };
  address?: string;
  category?: string;
  type?: string;
  cost?: { amount?: number; currency?: string } | number;
  booking_required?: boolean;
  bookingRequired?: boolean;
  booking_url?: string;
  bookingUrl?: string;
  image_url?: string;
  imageUrl?: string;
  venue_name?: string;
  rating?: number;
}

interface SharedDay {
  dayNumber: number;
  date?: string;
  theme?: string;
  description?: string;
  activities: SharedActivity[];
}

interface SharedTripData {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  travelers: number | null;
  itinerary_data: { days: SharedDay[] };
}

const CATEGORY_COLORS: Record<string, string> = {
  dining: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  restaurant: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  sightseeing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  explore: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  activity: 'bg-green-500/10 text-green-700 dark:text-green-400',
  culture: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  wellness: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  transport: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  accommodation: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  stay: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
};

export default function ConsumerTripShare() {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchTrip = async () => {
      setLoading(true);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_consumer_shared_trip', {
          p_share_token: token,
        });

        if (rpcError) throw rpcError;

        const result = data as unknown as SharedTripData & { error?: string };
        if (result.error) {
          setError(result.error);
        } else {
          setTrip(result);
        }
      } catch (e) {
        console.error('[ConsumerTripShare] fetch failed:', e);
        setError('Unable to load trip. The link may be invalid or sharing may be disabled.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading trip...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <Compass className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Trip Not Found</h2>
            <p className="text-muted-foreground text-sm">
              {error || 'This trip link is invalid or sharing has been disabled.'}
            </p>
            <Button asChild variant="outline">
              <Link to="/">Plan Your Own Trip</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const days = trip.itinerary_data?.days || [];

  return (
    <>
      <Head
        title={`${trip.name || trip.destination || 'Trip'} — Voyance`}
        description={`Check out this trip to ${trip.destination || 'an amazing destination'}`}
      />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
            <Badge variant="secondary" className="mb-3">Shared Trip</Badge>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {trip.name || `Trip to ${trip.destination}`}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {trip.destination && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {trip.destination}
                </span>
              )}
              {trip.start_date && trip.end_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(parseLocalDate(trip.start_date), 'MMM d')} – {format(parseLocalDate(trip.end_date), 'MMM d, yyyy')}
                </span>
              )}
              {trip.travelers && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {trip.travelers} traveler{trip.travelers > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Days */}
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
          {days.map((day) => (
            <div key={day.dayNumber}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                  {day.dayNumber}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {day.theme || `Day ${day.dayNumber}`}
                  </h2>
                  {day.date && (
                    <p className="text-xs text-muted-foreground">
                      {format(parseLocalDate(day.date), 'EEEE, MMMM d')}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 ml-4 border-l-2 border-border pl-6">
                {day.activities.map((activity) => {
                  const title = activity.title || activity.name || 'Activity';
                  const time = activity.startTime || activity.start_time;
                  const cat = (activity.category || activity.type || '').toLowerCase();
                  const costVal = typeof activity.cost === 'number' ? activity.cost : (activity.cost as any)?.amount;
                  const isBookable = activity.bookingRequired || activity.booking_required;
                  const bookUrl = activity.bookingUrl || activity.booking_url;
                  const colorClass = CATEGORY_COLORS[cat] || 'bg-muted text-muted-foreground';

                  return (
                    <Card key={activity.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {time && (
                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {time}
                                </span>
                              )}
                              {cat && (
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', colorClass)}>
                                  {cat}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-medium text-foreground text-sm">{title}</h3>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{activity.description}</p>
                            )}
                            {activity.location?.address && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{activity.location.address}</span>
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {costVal != null && costVal > 0 && (
                                <span className="text-xs font-medium text-foreground">
                                  ~${costVal}/pp
                                </span>
                              )}
                              {costVal === 0 && (
                                <span className="text-xs font-medium text-green-600">Free</span>
                              )}
                              {isBookable && bookUrl && (
                                <a
                                  href={bookUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  Book →
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {/* CTA */}
          <Separator />
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground text-sm">
              Want to plan your own trip?
            </p>
            <Button asChild size="lg">
              <Link to="/">Plan with Voyance</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
