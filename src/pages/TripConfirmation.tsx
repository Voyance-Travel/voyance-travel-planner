import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  Plane,
  Hotel,
  ArrowRight,
  Sparkles,
  Share2,
  Download,
  Mail,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';

interface TripData {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  status: string;
  flight_selection: any;
  hotel_selection: any;
}

type DemoConfirmationState = {
  isDemo?: boolean;
  tripId?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
};

function getAnonymousTripFromStorage(tripId: string | undefined): TripData | null {
  if (!tripId) return null;
  try {
    const raw = localStorage.getItem(`trip_${tripId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.destination || !parsed?.startDate || !parsed?.endDate) return null;

    return {
      id: tripId,
      destination: parsed.destination,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      travelers: parsed.travelers || 1,
      status: 'booked',
      flight_selection: null,
      hotel_selection: null,
    };
  } catch {
    return null;
  }
}

export default function TripConfirmation() {
  const { tripId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const demoState = (location.state || {}) as DemoConfirmationState;
  const isDemo = !!demoState.isDemo;

  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [trip, setTrip] = useState<TripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState<number | null>(null);

  useEffect(() => {
    async function verifyPayment() {
      if (!sessionId) {
        await loadTrip();
        setIsVerifying(false);
        setIsVerified(true);
        
        // Trigger confetti for demo/direct access too
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }, 500);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-booking-payment', {
          body: { sessionId },
        });

        if (error) throw error;

        if (data?.success) {
          setIsVerified(true);
          setAmountPaid(data.amountPaid);
          await loadTrip();

          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });

          toast.success('Booking confirmed! Check your email for details.');
        } else {
          setError(data?.error || 'Payment verification failed');
        }
      } catch (err: any) {
        console.error('Verification error:', err);
        setError(err.message || 'Failed to verify payment');
      } finally {
        setIsVerifying(false);
      }
    }

    async function loadTrip() {
      if (!tripId) return;

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (!error && data) {
        setTrip(data as TripData);
        return;
      }

      if (isDemo && demoState.destination && demoState.startDate && demoState.endDate) {
        setTrip({
          id: tripId,
          destination: demoState.destination,
          start_date: demoState.startDate,
          end_date: demoState.endDate,
          travelers: demoState.travelers || 1,
          status: 'booked',
          flight_selection: null,
          hotel_selection: null,
        });
        return;
      }

      const stored = getAnonymousTripFromStorage(tripId);
      if (stored) {
        setTrip(stored);
      }
    }

    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, tripId]);

  const cleanDestination = trip?.destination
    ?.replace(/\s*\(.*?\)\s*/g, '')
    .trim() || 'your destination';

  const nights = trip 
    ? differenceInDays(new Date(trip.end_date), new Date(trip.start_date))
    : 0;

  // Loading state
  if (isVerifying) {
    return (
      <MainLayout>
        <Head title="Verifying Payment | Voyance" />
        <section className="min-h-screen flex items-center justify-center bg-background">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl rounded-full" />
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6 relative" />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-2">Verifying your booking...</h2>
            <p className="text-muted-foreground">This will only take a moment</p>
          </motion.div>
        </section>
      </MainLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <MainLayout>
        <Head title="Payment Issue | Voyance" />
        <section className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-lg mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <h1 className="text-3xl font-serif font-bold mb-4">Payment Verification Failed</h1>
              <p className="text-muted-foreground mb-8">{error}</p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" asChild>
                  <Link to="/trip/dashboard">View My Trips</Link>
                </Button>
                <Button asChild>
                  <Link to={`/planner/booking?tripId=${tripId}`}>Try Again</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head title={`Trip Confirmed - ${cleanDestination} | Voyance`} />

      {/* Hero Section with Destination Image */}
      <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        {trip && (
          <div className="absolute inset-0">
            <DynamicDestinationPhotos
              destination={trip.destination}
              variant="hero"
              hideOverlayText
              className="absolute inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 backdrop-blur-sm border border-green-500/30">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
              <Sparkles className="h-3 w-3 mr-1" />
              Booking Confirmed
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-4">
              You're going to {cleanDestination}!
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Your adventure awaits. We've prepared everything for an unforgettable journey.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Trip Details Section */}
      <section className="py-12 bg-background">
        <div className="max-w-4xl mx-auto px-4">
          {trip && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative"
            >
              {/* Editorial Card */}
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
                {/* Card Header */}
                <div className="p-8 md:p-10 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                      <p className="text-sm uppercase tracking-widest text-muted-foreground mb-2">
                        Your Itinerary
                      </p>
                      <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
                        {cleanDestination}
                      </h2>
                    </div>
                    <Badge className="self-start md:self-auto bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 px-4 py-2">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmed
                    </Badge>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mb-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-wide">Dates</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d')}
                      </p>
                      <p className="text-sm text-muted-foreground">{nights} nights</p>
                    </div>

                    <div className="text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mb-2">
                        <Users className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-wide">Travelers</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {trip.travelers || 1} {(trip.travelers || 1) === 1 ? 'Guest' : 'Guests'}
                      </p>
                    </div>

                    <div className="text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mb-2">
                        <MapPin className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-wide">Confirmation</span>
                      </div>
                      <p className="text-lg font-mono font-semibold text-foreground">
                        #{trip.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>

                    {amountPaid && (
                      <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mb-2">
                          <span className="text-xs uppercase tracking-wide">Total Paid</span>
                        </div>
                        <p className="text-lg font-semibold text-foreground">
                          ${(amountPaid / 100).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bookings Summary */}
                {(trip.flight_selection || trip.hotel_selection) && (
                  <div className="border-t border-border px-8 md:px-10 py-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {trip.flight_selection && (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Plane className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Flights</p>
                            <p className="font-semibold text-foreground">Booked & Confirmed</p>
                          </div>
                        </div>
                      )}
                      {trip.hotel_selection && (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                            <Hotel className="h-5 w-5 text-accent-foreground" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Accommodation</p>
                            <p className="font-semibold text-foreground">
                              {(trip.hotel_selection as any)?.name || 'Booked & Confirmed'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-border px-8 md:px-10 py-6 bg-muted/30">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button size="lg" className="flex-1" asChild>
                      <Link to={`/trip/${tripId}`}>
                        View Full Itinerary
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link to="/trip/dashboard">
                        My Trips
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Email Notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center"
          >
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-muted/50 border border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <p className="text-muted-foreground">
                A confirmation email with all details has been sent to your inbox.
              </p>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            <Button variant="ghost" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share Trip
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
