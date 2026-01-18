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
  Star,
  ArrowRight,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    
    // Check if user is authenticated - for demo/anonymous users, save to localStorage and show preview
    const { data: { session } } = await supabase.auth.getSession();
    const isAnonymous = !session;
    
    // For anonymous users, show a demo confirmation instead of real checkout
    if (isAnonymous) {
      toast.success('Demo booking confirmed! In production, you would sign in to complete payment.');
      navigate('/trip-confirmation', { 
        state: { 
          tripId, 
          destination: state.basics.destination,
          isDemo: true 
        } 
      });
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

      <section className="min-h-screen bg-background">
        {/* Full-width Hero */}
        <div className="relative h-[40vh] min-h-[320px] overflow-hidden">
        <DynamicDestinationPhotos 
            destination={state.basics.destination || ''} 
            startDate={state.basics.startDate || ''} 
            endDate={state.basics.endDate || ''} 
            travelers={travelers}
            variant="hero"
            className="!rounded-none !h-full"
            hideOverlayText={true}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Hero Content */}
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Badge variant="secondary" className="mb-4 gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Ready to book
                </Badge>
                <h1 className="text-4xl md:text-6xl font-serif font-light text-foreground mb-3">
                  {state.basics.destination}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {state.basics.startDate && state.basics.endDate ? (
                      <>
                        {format(new Date(state.basics.startDate), 'MMM d')} – {format(new Date(state.basics.endDate), 'MMM d, yyyy')}
                      </>
                    ) : 'Dates not set'}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {travelers} traveler{travelers > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {nights} nights
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Column - Trip Details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Flights Section */}
              {state.flights && (state.flights.departure || state.flights.return) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plane className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="text-lg font-medium">Flights</h2>
                  </div>
                  
                  <div className="space-y-3">
                    {state.flights.departure && (
                      <div className="group relative bg-gradient-to-r from-muted/50 to-transparent rounded-xl p-5 hover:from-muted transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <div className="text-center">
                              <p className="text-2xl font-light">{state.flights.departure.departureTime}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{state.basics.originCity?.split(' ')[0] || 'Origin'}</p>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="w-12 h-px bg-border" />
                              <ArrowRight className="w-4 h-4" />
                              <div className="w-12 h-px bg-border" />
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-light">{state.flights.departure.arrivalTime}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{state.basics.destination?.split(' ')[0] || 'Destination'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{state.flights.departure.airline}</p>
                            <Badge variant="outline" className="mt-1 text-xs font-normal">
                              {state.flights.departure.cabin?.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-lg font-semibold">${state.flights.departure.price}</span>
                          <span className="text-xs text-muted-foreground">/person</span>
                        </div>
                      </div>
                    )}
                    
                    {state.flights.return && (
                      <div className="group relative bg-gradient-to-r from-muted/50 to-transparent rounded-xl p-5 hover:from-muted transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <div className="text-center">
                              <p className="text-2xl font-light">{state.flights.return.departureTime}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{state.basics.destination?.split(' ')[0] || 'Destination'}</p>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="w-12 h-px bg-border" />
                              <ArrowRight className="w-4 h-4" />
                              <div className="w-12 h-px bg-border" />
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-light">{state.flights.return.arrivalTime}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{state.basics.originCity?.split(' ')[0] || 'Origin'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{state.flights.return.airline}</p>
                            <Badge variant="outline" className="mt-1 text-xs font-normal">
                              {state.flights.return.cabin?.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-lg font-semibold">${state.flights.return.price}</span>
                          <span className="text-xs text-muted-foreground">/person</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Hotel Section */}
              {state.hotel && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
                      <Hotel className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <h2 className="text-lg font-medium">Accommodation</h2>
                  </div>
                  
                  <div className="group relative bg-gradient-to-r from-muted/50 to-transparent rounded-xl p-5 hover:from-muted transition-colors">
                    <div className="flex gap-5">
                      {state.hotel.imageUrl && (
                        <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0">
                          <img src={state.hotel.imageUrl} alt={state.hotel.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-medium mb-1">{state.hotel.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {state.hotel.location}
                          </span>
                          <span className="flex items-center gap-0.5">
                            {[...Array(Math.round(state.hotel.rating / 2) || 4)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                            ))}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{state.hotel.roomType}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-light">${state.hotel.pricePerNight}</p>
                        <p className="text-xs text-muted-foreground">per night</p>
                        <p className="text-sm text-muted-foreground mt-2">{nights} nights total</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Trust Signals */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-6 pt-4"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Encrypted data</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  <span>Free cancellation 24h before</span>
                </div>
              </motion.div>
            </div>

            {/* Right Column - Payment Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="sticky top-24"
              >
                <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-lg">
                  {/* Summary Header */}
                  <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
                    <h2 className="text-lg font-medium mb-1">Trip Total</h2>
                    <p className="text-4xl font-light">${grandTotal.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${(grandTotal / travelers).toFixed(2)} per person
                    </p>
                  </div>

                  {/* Breakdown */}
                  <div className="p-6 space-y-4 text-sm">
                    {flightSubtotal > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Flights ({travelers}×)</span>
                          <span>${flightSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground/70">
                          <span>Taxes & fees</span>
                          <span>${flightTaxes.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    {hotelSubtotal > 0 && (
                      <div className="space-y-2 pt-3 border-t border-border/50">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hotel ({nights} nights)</span>
                          <span>${hotelSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground/70">
                          <span>Taxes & fees</span>
                          <span>${hotelTaxes.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    {activitiesTotal > 0 && (
                      <div className="pt-3 border-t border-border/50">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Activities</span>
                          <span>${activitiesTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t border-border/50">
                      <div className="flex justify-between text-muted-foreground/70">
                        <span>Service fee</span>
                        <span>${serviceFee.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="p-6 pt-0 space-y-4">
                    {error && (
                      <div className="p-3 bg-destructive/10 rounded-lg">
                        <p className="text-sm text-destructive flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {error}
                        </p>
                      </div>
                    )}

                    <Button onClick={handleCheckout} disabled={isProcessing} size="lg" className="w-full h-14 text-lg gap-2">
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5" />
                          Complete Booking
                        </>
                      )}
                    </Button>
                    
                    <p className="text-xs text-center text-muted-foreground">
                      Secure checkout powered by Stripe
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
