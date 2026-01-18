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
  Eye
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

  // Calculate costs with detailed breakdown
  const travelers = state.basics.travelers || 1;
  const outboundFlightBase = (state.flights?.departure?.price || 0) * travelers;
  const returnFlightBase = (state.flights?.return?.price || 0) * travelers;
  const flightSubtotal = outboundFlightBase + returnFlightBase;
  
  // Estimated taxes (typically 10-15% for flights)
  const flightTaxRate = 0.12;
  const flightTaxes = flightSubtotal * flightTaxRate;
  const flightTotal = flightSubtotal + flightTaxes;
  
  const nights = state.basics.startDate && state.basics.endDate 
    ? Math.ceil((new Date(state.basics.endDate).getTime() - new Date(state.basics.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const hotelSubtotal = (state.hotel?.pricePerNight || 0) * nights;
  
  // Hotel taxes (typically 12-18% including resort fees)
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
      
      <section className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Editorial Header */}
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-4"
              >
                <CheckCircle className="h-4 w-4" />
                Your trip is ready to book
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-3">
                {state.basics.destination}
              </h1>
              <p className="text-lg text-muted-foreground flex items-center justify-center gap-2">
                <Calendar className="h-5 w-5" />
                {state.basics.startDate && state.basics.endDate ? (
                  <>
                    {format(new Date(state.basics.startDate), 'MMM d')} - {format(new Date(state.basics.endDate), 'MMM d, yyyy')}
                  </>
                ) : 'Dates not set'} 
                <span className="text-muted-foreground/50">•</span>
                <Users className="h-5 w-5" />
                {travelers} traveler{travelers > 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid lg:grid-cols-5 gap-8">
              {/* Trip Details - 3 columns */}
              <div className="lg:col-span-3 space-y-6">
                {/* Flights Card */}
                {state.flights && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-card rounded-2xl border border-border overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-primary/5 to-transparent p-5 border-b border-border">
                      <h2 className="text-lg font-semibold flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Plane className="h-5 w-5 text-primary" />
                        </div>
                        Flights
                      </h2>
                    </div>
                    <div className="p-5 space-y-4">
                      {state.flights.departure && (
                        <div className="flex justify-between items-center py-3 px-4 bg-muted/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground uppercase">Outbound</p>
                              <p className="font-semibold">{state.flights.departure.airline}</p>
                            </div>
                            <div className="h-8 w-px bg-border" />
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {state.flights.departure.cabin && `${state.flights.departure.cabin} class`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {state.flights.departure.departureTime} → {state.flights.departure.arrivalTime}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">${state.flights.departure.price.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">per person</p>
                          </div>
                        </div>
                      )}
                      {state.flights.return && (
                        <div className="flex justify-between items-center py-3 px-4 bg-muted/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground uppercase">Return</p>
                              <p className="font-semibold">{state.flights.return.airline}</p>
                            </div>
                            <div className="h-8 w-px bg-border" />
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {state.flights.return.cabin && `${state.flights.return.cabin} class`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {state.flights.return.departureTime} → {state.flights.return.arrivalTime}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">${state.flights.return.price.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">per person</p>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-muted-foreground">Flights subtotal ({travelers} travelers)</span>
                        <span className="font-semibold">${flightTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Hotel Card */}
                {state.hotel && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card rounded-2xl border border-border overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-primary/5 to-transparent p-5 border-b border-border">
                      <h2 className="text-lg font-semibold flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Hotel className="h-5 w-5 text-primary" />
                        </div>
                        Accommodation
                      </h2>
                    </div>
                    <div className="p-5">
                      <div className="flex gap-4">
                        {state.hotel.imageUrl && (
                          <img 
                            src={state.hotel.imageUrl} 
                            alt={state.hotel.name}
                            className="w-24 h-24 rounded-xl object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{state.hotel.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-4 w-4" />
                            {state.hotel.location}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {state.hotel.roomType} • {nights} night{nights > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${hotelTotal.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            ${state.hotel.pricePerNight}/night
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Payment Summary - 2 columns */}
              <div className="lg:col-span-2">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-card rounded-2xl border border-border overflow-hidden sticky top-24"
                >
                  <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 border-b border-border">
                    <h2 className="text-xl font-semibold">Your Trip Total</h2>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    {/* Flight breakdown */}
                    {flightSubtotal > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flights</p>
                        <div className="space-y-1.5 pl-3 border-l-2 border-primary/20">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Outbound × {travelers}</span>
                            <span>${outboundFlightBase.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Return × {travelers}</span>
                            <span>${returnFlightBase.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground/80">
                            <span>Taxes & carrier fees (est.)</span>
                            <span>${flightTaxes.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Hotel breakdown */}
                    {hotelSubtotal > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accommodation</p>
                        <div className="space-y-1.5 pl-3 border-l-2 border-accent/20">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{nights} nights × ${state.hotel?.pricePerNight}/night</span>
                            <span>${hotelSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground/80">
                            <span>Taxes & resort fees (est.)</span>
                            <span>${hotelTaxes.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Activities */}
                    {activitiesTotal > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Experiences</p>
                        <div className="pl-3 border-l-2 border-secondary/20">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Activities & tours</span>
                            <span>${activitiesTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Taxes summary */}
                    <div className="border-t border-dashed border-border pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total estimated taxes & fees</span>
                        <span>${totalTaxes.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Voyance concierge fee</span>
                        <span>${serviceFee.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {/* Grand total */}
                    <div className="border-t border-border pt-4 mt-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-semibold">Total</span>
                        <div className="text-right">
                          <span className="text-3xl font-bold text-primary">${grandTotal.toFixed(2)}</span>
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

                    <Button
                      onClick={handleCheckout}
                      disabled={isProcessing}
                      size="lg"
                      className="w-full h-14 text-lg shadow-lg shadow-primary/20"
                    >
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

                    {/* Trust badges */}
                    <div className="pt-4 space-y-3 border-t border-border">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Lock className="h-4 w-4" />
                        </div>
                        <span>Secure payment via Stripe</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Shield className="h-4 w-4" />
                        </div>
                        <span>Your data is encrypted and protected</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        <span>Free cancellation up to 24h before</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-10 flex flex-wrap gap-4">
              <Button variant="outline" onClick={() => navigate(-1)}>
                ← Back to Trip Summary
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => navigate(`/planner/itinerary?tripId=${tripId}`)}
                disabled={!tripId}
              >
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
