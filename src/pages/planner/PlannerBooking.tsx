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
  Lock,
  Eye,
  Star,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';

export default function PlannerBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, loadTrip } = useTripPlanner();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tripId = searchParams.get('tripId') || state.tripId;
  const wasCanceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    async function init() {
      if (tripId && !state.basics.destination) {
        await loadTrip(tripId);
      }
      setIsLoading(false);
    }
    init();
  }, [tripId]);

  useEffect(() => {
    if (wasCanceled) toast.info('Payment was canceled. You can try again when ready.');
  }, [wasCanceled]);

  const travelers = state.basics.travelers || 1;
  const outboundFlightBase = (state.flights?.departure?.price || 0) * travelers;
  const returnFlightBase = (state.flights?.return?.price || 0) * travelers;
  const flightSubtotal = outboundFlightBase + returnFlightBase;
  const flightTaxRate = 0.12;
  const flightTaxes = flightSubtotal * flightTaxRate;
  const flightTotal = flightSubtotal + flightTaxes;
  const nights = state.basics.startDate && state.basics.endDate
    ? Math.ceil((new Date(state.basics.endDate).getTime() - new Date(state.basics.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const hotelSubtotal = (state.hotel?.pricePerNight || 0) * nights;
  const hotelTaxRate = 0.15;
  const hotelTaxes = hotelSubtotal * hotelTaxRate;
  const hotelTotal = hotelSubtotal + hotelTaxes;
  const activitiesTotal = state.itinerary.reduce(
    (sum, day) => sum + day.activities.reduce((daySum, act) => daySum + (act.price || 0), 0),
    0
  );
  const serviceFee = 29.99;
  const totalTaxes = flightTaxes + hotelTaxes;
  const grandTotal = flightSubtotal + hotelSubtotal + activitiesTotal + totalTaxes + serviceFee;

  const handleCheckout = async () => {
    if (!tripId) {
      toast.error('No trip found');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please sign in to complete your booking');
      navigate(`/signin?redirect=/planner/booking?tripId=${tripId}`);
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-booking-checkout', {
        body: { tripId, flightTotal, hotelTotal, activitiesTotal },
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
        <section className="pt-24 pb-16 min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </section>
      </MainLayout>
    );
  }

  if (!tripId || !state.basics.destination) {
    return (
      <MainLayout>
        <Head title="Complete Booking | Voyance" />
        <section className="pt-24 pb-16 min-h-screen">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">No Trip Found</h1>
            <p className="text-muted-foreground mb-6">Please start planning a trip first.</p>
            <Button onClick={() => navigate('/planner')}>Start Planning</Button>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head title={`Book Trip to ${state.basics.destination} | Voyance`} />

      <section className="py-10 min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Hero - using destination-specific image */}
            <div className="relative mb-12 rounded-3xl overflow-hidden h-64 md:h-80">
              <DynamicDestinationPhotos 
                destination={state.basics.destination || ''} 
                startDate={state.basics.startDate || ''} 
                endDate={state.basics.endDate || ''} 
                travelers={travelers}
                variant="hero"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 text-foreground">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 backdrop-blur-sm rounded-full text-sm font-medium mb-3"
                >
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Ready to book
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-serif font-normal text-foreground mb-2">{state.basics.destination}</h1>
                <p className="text-lg text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {state.basics.startDate && state.basics.endDate ? (
                      <>
                        {format(new Date(state.basics.startDate), 'MMM d')} – {format(new Date(state.basics.endDate), 'MMM d, yyyy')}
                      </>
                    ) : 'Dates not set'}
                  </span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {travelers} traveler{travelers > 1 ? 's' : ''}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-5 gap-10">
              {/* Left: Details */}
              <div className="lg:col-span-3 space-y-8">
                {/* Flights */}
                {state.flights && (
                  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Plane className="w-4 h-4 text-primary" />
                      <h2 className="font-medium text-muted-foreground uppercase text-xs tracking-wide">Flights</h2>
                    </div>
                    {state.flights.departure && (
                      <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase">Outbound</p>
                            <p className="font-semibold">{state.flights.departure.airline}</p>
                          </div>
                          <div className="h-8 w-px bg-border" />
                          <div>
                            <p className="text-sm text-muted-foreground">{state.flights.departure.cabin && `${state.flights.departure.cabin} class`}</p>
                            <p className="text-xs text-muted-foreground">{state.flights.departure.departureTime} → {state.flights.departure.arrivalTime}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${state.flights.departure.price.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">per person</p>
                        </div>
                      </div>
                    )}
                    {state.flights.return && (
                      <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase">Return</p>
                            <p className="font-semibold">{state.flights.return.airline}</p>
                          </div>
                          <div className="h-8 w-px bg-border" />
                          <div>
                            <p className="text-sm text-muted-foreground">{state.flights.return.cabin && `${state.flights.return.cabin} class`}</p>
                            <p className="text-xs text-muted-foreground">{state.flights.return.departureTime} → {state.flights.return.arrivalTime}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${state.flights.return.price.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">per person</p>
                        </div>
                      </div>
                    )}
                  </motion.section>
                )}

                {/* Hotel */}
                {state.hotel && (
                  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Hotel className="w-4 h-4 text-primary" />
                      <h2 className="font-medium text-muted-foreground uppercase text-xs tracking-wide">Accommodation</h2>
                    </div>
                    <div className="bg-card rounded-2xl border border-border overflow-hidden flex">
                      {state.hotel.imageUrl && (
                        <img src={state.hotel.imageUrl} alt={state.hotel.name} className="w-28 h-28 object-cover shrink-0" />
                      )}
                      <div className="p-5 flex-1">
                        <h3 className="font-semibold text-lg">{state.hotel.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-4 w-4" />
                          {state.hotel.location}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{state.hotel.roomType} • {nights} night{nights > 1 ? 's' : ''}</p>
                      </div>
                      <div className="p-5 text-right flex flex-col justify-between">
                        <p className="text-lg font-bold">${hotelTotal.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">${state.hotel.pricePerNight}/night</p>
                      </div>
                    </div>
                  </motion.section>
                )}
              </div>

              {/* Right: Payment Summary */}
              <div className="lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="sticky top-24 bg-card rounded-2xl border border-border overflow-hidden"
                >
                  <div className="bg-primary p-6">
                    <h2 className="text-xl font-semibold text-primary-foreground">Your Trip Total</h2>
                  </div>

                  <div className="p-6 space-y-5">
                    {flightSubtotal > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flights</p>
                        <div className="space-y-1.5 pl-4 border-l-2 border-primary/20 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Outbound × {travelers}</span><span>${outboundFlightBase.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Return × {travelers}</span><span>${returnFlightBase.toFixed(2)}</span></div>
                          <div className="flex justify-between text-muted-foreground/80"><span>Taxes & carrier fees (est.)</span><span>${flightTaxes.toFixed(2)}</span></div>
                        </div>
                      </div>
                    )}
                    {hotelSubtotal > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accommodation</p>
                        <div className="space-y-1.5 pl-4 border-l-2 border-secondary/20 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">{nights} nights × ${state.hotel?.pricePerNight}/night</span><span>${hotelSubtotal.toFixed(2)}</span></div>
                          <div className="flex justify-between text-muted-foreground/80"><span>Taxes & resort fees (est.)</span><span>${hotelTaxes.toFixed(2)}</span></div>
                        </div>
                      </div>
                    )}
                    {activitiesTotal > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Experiences</p>
                        <div className="pl-4 border-l-2 border-secondary/20 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Activities & tours</span><span>${activitiesTotal.toFixed(2)}</span></div>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-dashed border-border pt-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Total estimated taxes & fees</span><span>${totalTaxes.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Voyance concierge fee</span><span>${serviceFee.toFixed(2)}</span></div>
                    </div>
                    <div className="border-t border-border pt-5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-semibold">Total</span>
                        <div className="text-right">
                          <span className="text-3xl font-bold text-foreground">${grandTotal.toFixed(2)}</span>
                          <p className="text-xs text-muted-foreground">USD • Final price at checkout</p>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                        <p className="text-sm text-destructive flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {error}
                        </p>
                      </div>
                    )}

                    <Button onClick={handleCheckout} disabled={isProcessing} size="lg" className="w-full h-14 text-lg">
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          Complete Booking
                        </>
                      )}
                    </Button>

                    <div className="pt-5 space-y-3 border-t border-border">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0"><Lock className="h-4 w-4" /></div>
                        <span>Secure payment via Stripe</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0"><Shield className="h-4 w-4" /></div>
                        <span>Your data is encrypted and protected</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0"><CheckCircle className="h-4 w-4" /></div>
                        <span>Free cancellation up to 24h before</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-12 flex flex-wrap gap-4">
              <Button variant="outline" onClick={() => navigate(-1)}>← Back to Trip Summary</Button>
              <Button variant="secondary" onClick={() => navigate(`/planner/itinerary?tripId=${tripId}`)} disabled={!tripId}>
                <Eye className="h-4 w-4 mr-2" />
                Preview Itinerary
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
