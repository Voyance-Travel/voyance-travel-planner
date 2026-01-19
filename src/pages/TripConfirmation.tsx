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
  metadata?: {
    booking_reference?: string;
    payment_status?: string;
    amount_paid?: number;
    [key: string]: any;
  };
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
    // Primary storage: voyance_local_trips (TripPlannerContext)
    const localTripsRaw = localStorage.getItem('voyance_local_trips');
    if (localTripsRaw) {
      const localTrips = JSON.parse(localTripsRaw);
      if (localTrips?.[tripId]) {
        const parsed = localTrips[tripId];
        return {
          id: tripId,
          destination: parsed.destination,
          start_date: parsed.start_date || parsed.startDate,
          end_date: parsed.end_date || parsed.endDate,
          travelers: parsed.travelers || 1,
          status: 'booked',
          flight_selection: parsed.flight_selection || null,
          hotel_selection: parsed.hotel_selection || null,
        };
      }
    }

    // Fallback: voyance_demo_trips (legacy)
    const demoTripsRaw = localStorage.getItem('voyance_demo_trips');
    if (demoTripsRaw) {
      const demoTrips = JSON.parse(demoTripsRaw);
      if (demoTrips?.[tripId]) {
        const parsed = demoTrips[tripId];
        return {
          id: tripId,
          destination: parsed.destination,
          start_date: parsed.start_date || parsed.startDate,
          end_date: parsed.end_date || parsed.endDate,
          travelers: parsed.travelers || 1,
          status: 'booked',
          flight_selection: parsed.flight_selection || null,
          hotel_selection: parsed.hotel_selection || null,
        };
      }
    }

    // Legacy format: trip_${tripId}
    const raw = localStorage.getItem(`trip_${tripId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.destination || (!parsed?.startDate && !parsed?.start_date) || (!parsed?.endDate && !parsed?.end_date)) return null;

    return {
      id: tripId,
      destination: parsed.destination,
      start_date: parsed.start_date || parsed.startDate,
      end_date: parsed.end_date || parsed.endDate,
      travelers: parsed.travelers || 1,
      status: 'booked',
      flight_selection: parsed.flight_selection || null,
      hotel_selection: parsed.hotel_selection || null,
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

      {/* Full-bleed Hero Section */}
      <section className="relative min-h-[65vh] flex items-end overflow-hidden">
        {/* Background Image with Rich Overlay */}
        {trip && (
          <div className="absolute inset-0">
            <DynamicDestinationPhotos
              destination={trip.destination}
              variant="hero"
              hideOverlayText
              className="absolute inset-0"
            />
            {/* Luxurious gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10" />
          </div>
        )}

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-center md:text-left"
          >
            {/* Success Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center gap-2 mb-6 px-5 py-2.5 rounded-full bg-green-500/15 backdrop-blur-md border border-green-500/25"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Booking Confirmed
              </span>
            </motion.div>

            {/* Destination Title */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-foreground mb-4 tracking-tight">
              {cleanDestination}
            </h1>

            {/* Trip Overview Pills */}
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {format(new Date(trip?.start_date || new Date()), 'MMM d')} – {format(new Date(trip?.end_date || new Date()), 'MMM d')}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {trip?.travelers || 1} {(trip?.travelers || 1) === 1 ? 'Traveler' : 'Travelers'}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{nights} Nights</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="relative -mt-8 pb-20">
        <div className="max-w-5xl mx-auto px-6">
          {trip && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              {/* Primary Card */}
              <div className="relative bg-card rounded-3xl overflow-hidden shadow-2xl border border-border/50">
                {/* Decorative top accent */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

                {/* Card Content */}
                <div className="p-8 md:p-12">
                  {/* Header Row */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-10">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">
                        Booking Reference
                      </p>
                      <p className="text-2xl md:text-3xl font-mono font-bold text-foreground tracking-wide">
                        {trip.metadata?.booking_reference || `VOY-${trip.id.slice(0, 8).toUpperCase()}`}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="font-semibold text-green-600 dark:text-green-400">Confirmed</p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-border my-8" />

                  {/* Trip Details Grid */}
                  <div className="grid md:grid-cols-3 gap-8">
                    {/* Departure */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                        Departure
                      </p>
                      <p className="text-2xl font-serif font-bold text-foreground">
                        {format(new Date(trip.start_date), 'MMMM d')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(trip.start_date), 'EEEE, yyyy')}
                      </p>
                    </div>

                    {/* Duration */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-border" />
                        <div className="px-4 py-2 rounded-full bg-muted border border-border">
                          <span className="text-sm font-medium">{nights} nights</span>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-border via-border to-transparent" />
                      </div>
                    </div>

                    {/* Return */}
                    <div className="space-y-2 md:text-right">
                      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                        Return
                      </p>
                      <p className="text-2xl font-serif font-bold text-foreground">
                        {format(new Date(trip.end_date), 'MMMM d')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(trip.end_date), 'EEEE, yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Bookings Summary */}
                  {(trip.flight_selection || trip.hotel_selection) && (
                    <>
                      <div className="border-t border-dashed border-border my-8" />
                      <div className="grid md:grid-cols-2 gap-4">
                        {trip.flight_selection && (
                          <div className="group relative p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 hover:border-primary/20 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Plane className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Flights</p>
                                <p className="font-semibold text-foreground">Booked & Confirmed</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {trip.hotel_selection && (
                          <div className="group relative p-5 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent border border-accent/10 hover:border-accent/20 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Hotel className="h-5 w-5 text-accent-foreground" />
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Accommodation</p>
                                <p className="font-semibold text-foreground">
                                  {(trip.hotel_selection as any)?.name || 'Booked & Confirmed'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Amount Paid */}
                  {amountPaid && (
                    <>
                      <div className="border-t border-dashed border-border my-8" />
                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground">Total Paid</p>
                        <p className="text-3xl font-serif font-bold text-foreground">
                          ${(amountPaid / 100).toFixed(2)}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-8 md:px-12 py-6 bg-muted/30 border-t border-border">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button size="lg" className="flex-1 h-12 text-base shadow-lg shadow-primary/20" asChild>
                      <Link to={`/trip/${tripId}`}>
                        View Full Itinerary
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="h-12 text-base" asChild>
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-10"
          >
            <div className="flex items-center justify-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary/5 via-transparent to-accent/5 border border-border/50">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <p className="text-muted-foreground text-sm md:text-base">
                A confirmation email with your complete itinerary has been sent to your inbox.
              </p>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-10 flex flex-wrap justify-center gap-2"
          >
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <Share2 className="h-4 w-4" />
              Share Trip
            </Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <Calendar className="h-4 w-4" />
              Add to Calendar
            </Button>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
