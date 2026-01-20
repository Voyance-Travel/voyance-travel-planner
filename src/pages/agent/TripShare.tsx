import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  MapPin, 
  Calendar, 
  Users, 
  Plane, 
  Hotel, 
  Clock,
  Phone,
  Mail,
  Globe
} from 'lucide-react';
import Head from '@/components/common/Head';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { EditorialItinerary, type EditorialDay } from '@/components/itinerary/EditorialItinerary';

interface SharedTrip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  traveler_count: number | null;
  notes: string | null;
  itinerary_data: {
    days?: EditorialDay[];
    status?: string;
  } | null;
}

interface BookingSegment {
  id: string;
  segment_type: string;
  vendor_name: string | null;
  confirmation_number: string | null;
  origin: string | null;
  destination: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  flight_number: string | null;
  room_type: string | null;
  status: string | null;
}

const SEGMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: Hotel,
  default: MapPin,
};

export default function TripShare() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [segments, setSegments] = useState<BookingSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareToken) {
      loadSharedTrip();
    }
  }, [shareToken]);

  const loadSharedTrip = async () => {
    try {
      // Fetch the shared trip by token
      const { data: tripData, error: tripError } = await supabase
        .from('agency_trips')
        .select('id, name, destination, start_date, end_date, traveler_count, notes, itinerary_data')
        .eq('share_token', shareToken)
        .eq('share_enabled', true)
        .maybeSingle();

      if (tripError) throw tripError;
      if (!tripData) {
        setError('Trip not found or sharing is disabled');
        setLoading(false);
        return;
      }

      setTrip(tripData as SharedTrip);

      // Fetch confirmed booking segments (public info only)
      const { data: segmentsData } = await supabase
        .from('agency_booking_segments')
        .select('id, segment_type, vendor_name, confirmation_number, origin, destination, start_date, start_time, end_date, end_time, flight_number, room_type, status')
        .eq('trip_id', tripData.id)
        .in('status', ['confirmed', 'ticketed'])
        .order('start_date', { ascending: true });

      setSegments((segmentsData || []) as BookingSegment[]);
    } catch (err) {
      console.error('Error loading shared trip:', err);
      setError('Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-2xl px-4">
          <div className="h-8 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold mb-2">Trip Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error || 'This trip link may have expired or been disabled.'}
          </p>
          <Link to="/" className="text-primary hover:underline">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  const itineraryDays = (trip.itinerary_data?.days || []) as EditorialDay[];
  const hasItinerary = itineraryDays.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Head 
        title={`${trip.name} | Your Trip Itinerary`}
        description={`View your personalized itinerary for ${trip.destination}`}
      />

      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-display font-bold">{trip.name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
            {trip.destination && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {trip.destination}
              </span>
            )}
            {trip.start_date && trip.end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(parseISO(trip.start_date), 'MMM d')} – {format(parseISO(trip.end_date), 'MMM d, yyyy')}
              </span>
            )}
            {trip.traveler_count && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {trip.traveler_count} travelers
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Confirmed Bookings Summary */}
        {segments.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Your Confirmed Bookings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {segments.map((segment) => {
                const Icon = SEGMENT_ICONS[segment.segment_type] || SEGMENT_ICONS.default;
                return (
                  <Card key={segment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium capitalize">{segment.segment_type.replace('_', ' ')}</p>
                            <Badge variant="outline" className="text-xs">
                              {segment.status}
                            </Badge>
                          </div>
                          {segment.vendor_name && (
                            <p className="text-sm text-muted-foreground">{segment.vendor_name}</p>
                          )}
                          {segment.flight_number && (
                            <p className="text-sm font-mono">{segment.flight_number}</p>
                          )}
                          {segment.confirmation_number && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Confirmation: <span className="font-mono">{segment.confirmation_number}</span>
                            </p>
                          )}
                          {segment.start_date && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(segment.start_date), 'EEE, MMM d')}
                              {segment.start_time && ` at ${segment.start_time}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <Separator />

        {/* Itinerary */}
        {hasItinerary ? (
          <section>
            <h2 className="text-lg font-semibold mb-4">Your Day-by-Day Itinerary</h2>
            <EditorialItinerary
              tripId={trip.id}
              destination={trip.destination || ''}
              startDate={trip.start_date || ''}
              endDate={trip.end_date || ''}
              travelers={trip.traveler_count || 1}
              days={itineraryDays}
              isEditable={false}
            />
          </section>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Your detailed itinerary is being prepared.</p>
            <p className="text-sm">Check back soon for your day-by-day schedule.</p>
          </div>
        )}

        {/* Trip Notes (client-facing only) */}
        {trip.notes && (
          <section>
            <h2 className="text-lg font-semibold mb-2">Notes</h2>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm whitespace-pre-wrap">{trip.notes}</p>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      {/* Footer with agent contact */}
      <footer className="border-t bg-muted/30 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Have questions about your trip? Contact your travel advisor.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Powered by Voyance
          </p>
        </div>
      </footer>
    </div>
  );
}
