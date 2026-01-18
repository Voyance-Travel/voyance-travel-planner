import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  MapPin, 
  Calendar, 
  Users, 
  Plane, 
  Hotel,
  Download,
  Share2,
  ArrowRight
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

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

export default function TripConfirmation() {
  const { tripId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [trip, setTrip] = useState<TripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState<number | null>(null);

  useEffect(() => {
    async function verifyPayment() {
      if (!sessionId) {
        // No session ID, just load trip details
        await loadTrip();
        setIsVerifying(false);
        setIsVerified(true);
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
          
          // Trigger confetti
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
      }
    }

    verifyPayment();
  }, [sessionId, tripId]);

  // Loading state
  if (isVerifying) {
    return (
      <MainLayout>
        <Head title="Verifying Payment | Voyance" />
        <section className="pt-24 pb-16 min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verifying your payment...</h2>
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
        <section className="pt-24 pb-16 min-h-screen">
          <div className="max-w-lg mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold mb-4">Payment Verification Failed</h1>
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
      <Head title={`Trip Confirmed - ${trip?.destination || 'Booking'} | Voyance`} />
      
      <section className="pt-24 pb-16 min-h-screen">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            {/* Success icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </motion.div>

            <h1 className="text-3xl font-display font-bold mb-2">
              Your Trip is Confirmed! 🎉
            </h1>
            <p className="text-muted-foreground text-lg">
              Get ready for an amazing adventure to {trip?.destination}
            </p>
          </motion.div>

          {/* Trip Details Card */}
          {trip && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-semibold">{trip.destination}</h2>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                  Confirmed
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs uppercase">Dates</span>
                  </div>
                  <p className="font-medium">
                    {format(new Date(trip.start_date), 'MMM d')} -{' '}
                    {format(new Date(trip.end_date), 'MMM d, yyyy')}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs uppercase">Travelers</span>
                  </div>
                  <p className="font-medium">{trip.travelers || 1} guest(s)</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs uppercase">Reference</span>
                  </div>
                  <p className="font-medium font-mono">{trip.id.slice(0, 8).toUpperCase()}</p>
                </div>

                {amountPaid && (
                  <div>
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <span className="text-xs uppercase">Amount Paid</span>
                    </div>
                    <p className="font-medium">${(amountPaid / 100).toFixed(2)}</p>
                  </div>
                )}
              </div>

              {/* Flight & Hotel summary */}
              <div className="grid md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-700">
                {trip.flight_selection && (
                  <div className="flex items-center gap-3">
                    <Plane className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-400">Flights</p>
                      <p className="font-medium">Booked</p>
                    </div>
                  </div>
                )}
                {trip.hotel_selection && (
                  <div className="flex items-center gap-3">
                    <Hotel className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-400">Hotel</p>
                      <p className="font-medium">{(trip.hotel_selection as any)?.name || 'Booked'}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" asChild>
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
          </motion.div>

          {/* Email notice */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-muted-foreground mt-8"
          >
            📧 A confirmation email has been sent to your inbox with all the details.
          </motion.p>
        </div>
      </section>
    </MainLayout>
  );
}
