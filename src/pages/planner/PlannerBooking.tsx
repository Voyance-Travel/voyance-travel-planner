import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  CreditCard, 
  Plane, 
  Hotel, 
  MapPin, 
  Calendar, 
  Users, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Shield,
  Lock
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PlannerBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, loadTrip, calculateTotal } = useTripPlanner();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tripId = searchParams.get('tripId') || state.tripId;
  const wasCanceled = searchParams.get('canceled') === 'true';

  // Load trip if needed
  useEffect(() => {
    async function init() {
      if (tripId && !state.basics.destination) {
        await loadTrip(tripId);
      }
      setIsLoading(false);
    }
    init();
  }, [tripId]);

  // Show cancel message
  useEffect(() => {
    if (wasCanceled) {
      toast.info('Payment was canceled. You can try again when ready.');
    }
  }, [wasCanceled]);

  // Calculate costs
  const travelers = state.basics.travelers || 1;
  const perPersonFlightTotal = (state.flights?.departure?.price || 0) + (state.flights?.return?.price || 0);
  const flightTotal = perPersonFlightTotal * travelers;
  const nights = state.basics.startDate && state.basics.endDate 
    ? Math.ceil((new Date(state.basics.endDate).getTime() - new Date(state.basics.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const hotelTotal = (state.hotel?.pricePerNight || 0) * nights;
  const activitiesTotal = state.itinerary.reduce(
    (sum, day) => sum + day.activities.reduce((daySum, act) => daySum + (act.price || 0), 0),
    0
  );
  const serviceFee = 29.99;
  const grandTotal = flightTotal + hotelTotal + activitiesTotal + serviceFee;

  // Handle checkout
  const handleCheckout = async () => {
    if (!tripId) {
      toast.error('No trip found');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-booking-checkout', {
        body: {
          tripId,
          flightTotal,
          hotelTotal,
          activitiesTotal,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout');
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <Head title="Complete Booking | Voyance" />
        <section className="pt-24 pb-16 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </section>
      </MainLayout>
    );
  }

  if (!tripId || !state.basics.destination) {
    return (
      <MainLayout>
        <Head title="Complete Booking | Voyance" />
        <section className="pt-24 pb-16 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">No Trip Found</h1>
            <p className="text-muted-foreground mb-6">
              Please start planning a trip first.
            </p>
            <Button onClick={() => navigate('/planner')}>
              Start Planning
            </Button>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head title={`Book Trip to ${state.basics.destination} | Voyance`} />
      
      <section className="pt-24 pb-16 min-h-screen bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Header */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-display font-medium text-foreground mb-2">
                Complete Your Booking
              </h1>
              <p className="text-muted-foreground">
                Review your trip details and proceed to secure payment
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Trip Summary */}
              <div className="lg:col-span-2 space-y-6">
                {/* Destination Card */}
                <div className="bg-card rounded-xl border p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Trip Details
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Destination</p>
                      <p className="font-medium">{state.basics.destination}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Departing From</p>
                      <p className="font-medium">{state.basics.originCity || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dates</p>
                      <p className="font-medium">
                        {state.basics.startDate && state.basics.endDate ? (
                          <>
                            {format(new Date(state.basics.startDate), 'MMM d')} -{' '}
                            {format(new Date(state.basics.endDate), 'MMM d, yyyy')}
                          </>
                        ) : (
                          'Not set'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Travelers</p>
                      <p className="font-medium">{state.basics.travelers || 1} guest(s)</p>
                    </div>
                  </div>
                </div>

                {/* Flights */}
                {state.flights && (
                  <div className="bg-card rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Plane className="h-5 w-5 text-primary" />
                      Flights
                    </h2>
                    <div className="space-y-4">
                      {state.flights.departure && (
                        <div className="flex justify-between items-center py-3 border-b">
                          <div>
                            <p className="font-medium">Outbound Flight</p>
                            <p className="text-sm text-muted-foreground">
                              {state.flights.departure.airline} {state.flights.departure.flightNumber}
                            </p>
                          </div>
                          <p className="font-medium">${state.flights.departure.price.toFixed(2)}</p>
                        </div>
                      )}
                      {state.flights.return && (
                        <div className="flex justify-between items-center py-3">
                          <div>
                            <p className="font-medium">Return Flight</p>
                            <p className="text-sm text-muted-foreground">
                              {state.flights.return.airline} {state.flights.return.flightNumber}
                            </p>
                          </div>
                          <p className="font-medium">${state.flights.return.price.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Hotel */}
                {state.hotel && (
                  <div className="bg-card rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Hotel className="h-5 w-5 text-primary" />
                      Accommodation
                    </h2>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{state.hotel.name}</p>
                        <p className="text-sm text-muted-foreground">{state.hotel.location}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {state.hotel.roomType} • {nights} night(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${hotelTotal.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          ${state.hotel.pricePerNight}/night
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Summary */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-xl border p-6 sticky top-24">
                  <h2 className="text-lg font-semibold mb-4">Payment Summary</h2>
                  
                  <div className="space-y-3 mb-6">
                    {flightTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Flights</span>
                        <span>${flightTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {hotelTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Accommodation ({nights} nights)</span>
                        <span>${hotelTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {activitiesTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Activities</span>
                        <span>${activitiesTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Voyance Service Fee</span>
                      <span>${serviceFee.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span>${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleCheckout}
                    disabled={isProcessing}
                    className="w-full h-12 text-base"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay ${grandTotal.toFixed(2)}
                      </>
                    )}
                  </Button>

                  {/* Trust badges */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span>Secure payment via Stripe</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span>Your data is encrypted and protected</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      <span>Free cancellation up to 24h before</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Back button */}
            <div className="mt-8">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Back to Itinerary
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
