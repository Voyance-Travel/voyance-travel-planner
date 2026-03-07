import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
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
  UserCircle,
  Bookmark,
  Sparkles,
  Info,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';

export default function PlannerBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, loadTrip, saveTrip } = useTripPlanner();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [travelerNames, setTravelerNames] = useState<string[]>([]);
  const [userIsTraveling, setUserIsTraveling] = useState(true); // Default: user is traveling

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

  const travelerInfoStorageKey = useMemo(() => {
    return tripId ? `voyance_traveler_info_${tripId}` : null;
  }, [tripId]);

  // Load persisted traveler info (localStorage first; DB metadata if signed in)
  useEffect(() => {
    async function loadTravelerInfo() {
      if (!tripId) return;

      // 1) Try localStorage (fast)
      if (travelerInfoStorageKey) {
        try {
          const raw = localStorage.getItem(travelerInfoStorageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { travelerNames?: string[]; userIsTraveling?: boolean };
            if (typeof parsed.userIsTraveling === 'boolean') setUserIsTraveling(parsed.userIsTraveling);
            if (Array.isArray(parsed.travelerNames)) setTravelerNames(parsed.travelerNames);
            return;
          }
        } catch {
          // ignore
        }
      }

      // 2) If signed in, try DB metadata
      if (user?.id) {
        const { data, error } = await supabase
          .from('trips')
          .select('metadata')
          .eq('id', tripId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data?.metadata && typeof data.metadata === 'object') {
          const meta = data.metadata as Record<string, unknown>;
          const travelerInfo = meta.travelerInfo as { travelerNames?: string[]; userIsTraveling?: boolean } | undefined;

          if (travelerInfo) {
            if (typeof travelerInfo.userIsTraveling === 'boolean') setUserIsTraveling(travelerInfo.userIsTraveling);
            if (Array.isArray(travelerInfo.travelerNames)) setTravelerNames(travelerInfo.travelerNames);
          }
        }
      }
    }

    loadTravelerInfo();
  }, [tripId, travelerInfoStorageKey, user?.id]);

  // Always persist traveler info locally (so refresh/back/forward keeps it)
  useEffect(() => {
    if (!travelerInfoStorageKey) return;
    try {
      localStorage.setItem(
        travelerInfoStorageKey,
        JSON.stringify({ travelerNames, userIsTraveling, savedAt: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
  }, [travelerInfoStorageKey, travelerNames, userIsTraveling]);

  // Get user's full name from profile for pre-filling
  const userFullName = useMemo(() => {
    if (!user?.name) return '';
    return user.name;
  }, [user?.name]);
  
  // Initialize traveler names array when travelers count changes or user data loads
  useEffect(() => {
    if (travelers > 0) {
      setTravelerNames(prev => {
        const newNames = [...prev];
        // Extend or trim array to match travelers count
        while (newNames.length < travelers) {
          newNames.push('');
        }
        const trimmed = newNames.slice(0, travelers);
        
        // Pre-fill first traveler with user's name if they're traveling and name is empty
        if (userIsTraveling && userFullName && (!trimmed[0] || trimmed[0] === '')) {
          trimmed[0] = userFullName;
        }
        
        return trimmed;
      });
    }
  }, [travelers, userIsTraveling, userFullName]);

  // Handle toggle change - pre-fill or clear the first traveler name
  const handleUserTravelingChange = (isTraveling: boolean) => {
    setUserIsTraveling(isTraveling);
    setTravelerNames(prev => {
      const updated = [...prev];
      if (isTraveling && userFullName) {
        updated[0] = userFullName;
      } else if (!isTraveling) {
        updated[0] = ''; // Clear when user is not traveling
      }
      return updated;
    });
  };

  const updateTravelerName = (index: number, name: string) => {
    setTravelerNames(prev => {
      const updated = [...prev];
      updated[index] = name;
      return updated;
    });
  };

  // Check if all traveler names are filled (required when flights are selected)
  const hasFlights = !!(state.flights?.departure || state.flights?.return);
  const allTravelerNamesProvided = useMemo(() => {
    if (!hasFlights) return true; // Names only required if flights selected
    return travelerNames.length === travelers && 
           travelerNames.every(name => name.trim().length >= 2);
  }, [hasFlights, travelerNames, travelers]);

  const outboundFlightBase = (state.flights?.departure?.price || 0) * travelers;
  const returnFlightBase = (state.flights?.return?.price || 0) * travelers;
  const flightSubtotal = outboundFlightBase + returnFlightBase;
  const flightTaxRate = 0.12;
  const flightTaxes = flightSubtotal * flightTaxRate;
  const flightTotal = flightSubtotal + flightTaxes;
  const nights = state.basics.startDate && state.basics.endDate
    ? Math.ceil((parseLocalDate(state.basics.endDate).getTime() - parseLocalDate(state.basics.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const hotelSubtotal = (state.hotel?.pricePerNight || 0) * nights;
  const hotelTaxRate = 0.15;
  const hotelTaxes = hotelSubtotal * hotelTaxRate;
  const hotelTotal = hotelSubtotal + hotelTaxes;
  const activitiesTotal = state.itinerary.reduce(
    (sum, day) => sum + day.activities.reduce((daySum, act) => daySum + (act.price || 0), 0),
    0
  );
  // No service fee - removed as per user feedback
  const totalTaxes = flightTaxes + hotelTaxes;
  const grandTotal = flightSubtotal + hotelSubtotal + activitiesTotal + totalTaxes;
  
  // Trip Pass price (flat fee to lock in prices)
  const TRIP_PASS_PRICE = 9.99;
  const persistTravelerInfoToDb = async (persistTripId: string) => {
    if (!user?.id) return;

    const travelerInfo = {
      travelerNames,
      userIsTraveling,
      updatedAt: new Date().toISOString(),
    };

    const { data: existing, error: fetchError } = await supabase
      .from('trips')
      .select('metadata')
      .eq('id', persistTripId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const existingMeta = (existing?.metadata && typeof existing.metadata === 'object')
      ? (existing.metadata as Record<string, unknown>)
      : {};

    const nextMeta = {
      ...existingMeta,
      travelerInfo,
    };

    const { error: updateError } = await supabase
      .from('trips')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('id', persistTripId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;
  };

  const handleCheckout = async () => {
    if (!tripId) {
      toast.error('No trip found');
      return;
    }

    // Validate traveler names if flights are selected
    if (hasFlights && !allTravelerNamesProvided) {
      toast.error('Please enter names for all travelers (minimum 2 characters each)');
      return;
    }
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    const isAnonymous = !session;
    
    // For anonymous users, ensure trip is saved to localStorage before navigating
    if (isAnonymous) {
      const savedTripId = await saveTrip();
      // Saved trip before checkout

      // Persist traveler info locally
      try {
        const key = savedTripId ? `voyance_traveler_info_${savedTripId}` : travelerInfoStorageKey;
        if (key) {
          localStorage.setItem(key, JSON.stringify({ travelerNames, userIsTraveling, savedAt: new Date().toISOString() }));
        }
      } catch {
        // ignore
      }
      
      toast.success('Demo confirmation shown. Sign in to run a real payment test.');
      navigate(`/trips/${savedTripId || tripId}/confirmation`, {
        state: {
          tripId: savedTripId || tripId,
          destination: state.basics.destination,
          startDate: state.basics.startDate,
          endDate: state.basics.endDate,
          travelers,
          isDemo: true,
        },
      });
      return;
    }

    // Authenticated checkout: make sure the trip is actually saved first
    const ensuredTripId = await saveTrip();
    if (!ensuredTripId) {
      toast.error('Unable to save your trip. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      // Persist traveler info to DB (so it survives refresh/device changes)
      await persistTravelerInfoToDb(ensuredTripId);

      // Use purchase-trip-pass edge function for Trip Pass checkout
      const { data, error } = await supabase.functions.invoke('purchase-trip-pass', {
        body: { trip_id: ensuredTripId },
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

  // Handle "Save & Build" - free option, no price guarantee
  const handleSaveAndBuild = async () => {
    if (!tripId) {
      toast.error('No trip found');
      return;
    }

    setIsSaving(true);
    try {
      const savedTripId = await saveTrip();
      if (!savedTripId) {
        toast.error('Unable to save your trip. Please try again.');
        return;
      }

      // Persist traveler info if user is logged in
      if (user?.id) {
        await persistTravelerInfoToDb(savedTripId);
      }

      toast.success('Trip saved! Building your itinerary...');
      navigate(`/trip/${savedTripId}?generate=true`);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Failed to save trip. Please try again.');
    } finally {
      setIsSaving(false);
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
            <Button onClick={() => navigate('/start')}>Start Planning</Button>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head title={`Book Trip to ${state.basics.destination} | Voyance`} />

      <section className="min-h-screen bg-background">
        {/* Full-width Hero (photo-only) */}
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
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/70 to-transparent" />
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              Ready to book
            </Badge>
            <h1 className="text-3xl md:text-4xl font-serif font-light text-foreground mb-3">
              {state.basics.destination}
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {state.basics.startDate && state.basics.endDate ? (
                  <>
                    {format(parseLocalDate(state.basics.startDate), 'MMM d')} – {format(parseLocalDate(state.basics.endDate), 'MMM d, yyyy')}
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

              {/* Traveler Names Section - Required when flights are selected */}
              {hasFlights && travelers > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.17 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-accent/50 flex items-center justify-center">
                      <UserCircle className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <h2 className="text-lg font-medium">Traveler Information</h2>
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  </div>

                  {/* "Are you traveling?" toggle - only show if user is logged in */}
                  {user && (
                    <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            id="user-traveling"
                            checked={userIsTraveling}
                            onCheckedChange={handleUserTravelingChange}
                          />
                          <Label htmlFor="user-traveling" className="text-sm font-medium cursor-pointer">
                            I'm traveling on this trip
                          </Label>
                        </div>
                        {userIsTraveling && userFullName && (
                          <span className="text-xs text-muted-foreground">
                            Using: {userFullName}
                          </span>
                        )}
                      </div>
                      {!userIsTraveling && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Booking this trip for someone else? Enter their names below.
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {Array.from({ length: travelers }).map((_, index) => (
                      <div 
                        key={index}
                        className="bg-gradient-to-r from-muted/50 to-transparent rounded-xl p-4"
                      >
                        <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                          Traveler {index + 1} {index === 0 && userIsTraveling && user ? '(You)' : index === 0 ? '(Primary)' : ''}
                        </Label>
                        <Input
                          type="text"
                          placeholder="Full name as it appears on ID"
                          value={travelerNames[index] || ''}
                          onChange={(e) => updateTravelerName(index, e.target.value)}
                          disabled={index === 0 && userIsTraveling && !!userFullName}
                          className={`bg-background ${
                            travelerNames[index]?.trim().length >= 2 
                              ? 'border-emerald-500/50 focus:border-emerald-500' 
                              : ''
                          } ${index === 0 && userIsTraveling && userFullName ? 'bg-muted/50' : ''}`}
                        />
                        {travelerNames[index]?.trim().length > 0 && travelerNames[index]?.trim().length < 2 && (
                          <p className="text-xs text-destructive mt-1">Name must be at least 2 characters</p>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Enter traveler names exactly as they appear on government-issued ID for flight booking.
                    </p>
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
                            {typeof state.hotel.location === 'string' 
                              ? state.hotel.location 
                              : (state.hotel.location as { name?: string; address?: string })?.name || 
                                (state.hotel.location as { name?: string; address?: string })?.address || ''}
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
                  <span>Review policies before booking</span>
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
                    <h2 className="text-lg font-medium mb-1">Estimated Trip Cost</h2>
                    <p className="text-4xl font-light">${grandTotal.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${(grandTotal / travelers).toFixed(2)} per person
                    </p>
                  </div>

                  {/* Breakdown */}
                  <div className="p-6 space-y-4 text-sm">
                    {flightSubtotal > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between font-medium">
                          <span className="flex items-center gap-2">
                            <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                            Flights ({travelers} traveler{travelers > 1 ? 's' : ''})
                          </span>
                          <span>${(flightSubtotal + flightTaxes).toFixed(2)}</span>
                        </div>
                        <div className="pl-5 space-y-1 text-muted-foreground/80">
                          {state.flights?.departure && (
                            <div className="flex justify-between text-xs">
                              <span>Outbound: {state.flights.departure.airline}</span>
                              <span>${(state.flights.departure.price * travelers).toFixed(2)}</span>
                            </div>
                          )}
                          {state.flights?.return && (
                            <div className="flex justify-between text-xs">
                              <span>Return: {state.flights.return.airline}</span>
                              <span>${(state.flights.return.price * travelers).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span>Taxes & fees</span>
                            <span>${flightTaxes.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {hotelSubtotal > 0 && (
                      <div className="space-y-2 pt-3 border-t border-border/50">
                        <div className="flex justify-between font-medium">
                          <span className="flex items-center gap-2">
                            <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
                            {state.hotel?.name?.substring(0, 20)}{(state.hotel?.name?.length || 0) > 20 ? '...' : ''}
                          </span>
                          <span>${(hotelSubtotal + hotelTaxes).toFixed(2)}</span>
                        </div>
                        <div className="pl-5 space-y-1 text-muted-foreground/80">
                          <div className="flex justify-between text-xs">
                            <span>${state.hotel?.pricePerNight}/night × {nights} nights</span>
                            <span>${hotelSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Taxes & fees (15%)</span>
                            <span>${hotelTaxes.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {activitiesTotal > 0 && (
                      <div className="pt-3 border-t border-border/50">
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">Planned activities</span>
                          <span>${activitiesTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t border-border">
                      <div className="flex justify-between font-semibold text-base">
                        <span>Total</span>
                        <span>${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Booking Options */}
                  <div className="p-6 pt-0 space-y-4">
                    {error && (
                      <div className="p-3 bg-destructive/10 rounded-lg">
                        <p className="text-sm text-destructive flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {error}
                        </p>
                      </div>
                    )}

                    {/* Option 1: Buy Trip Pass */}
                    <div className="space-y-2">
                      <Button 
                        onClick={handleCheckout} 
                        disabled={isProcessing || isSaving} 
                        size="lg" 
                        className="w-full h-14 text-base gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-5 w-5" />
                            Buy Trip Pass - ${TRIP_PASS_PRICE}
                          </>
                        )}
                      </Button>
                      <div className="flex items-start gap-2 px-1">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Lock in today's prices • Full AI itinerary • Priority support
                        </p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">or</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Option 2: Save & Build */}
                    <div className="space-y-2">
                      <Button 
                        onClick={handleSaveAndBuild} 
                        disabled={isProcessing || isSaving} 
                        variant="outline"
                        size="lg" 
                        className="w-full h-12 text-base gap-2"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-5 w-5" />
                            Save & Build Itinerary
                          </>
                        )}
                      </Button>
                      <div className="flex items-start gap-2 px-1">
                        <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Free • Prices may change • Book later at your own risk
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      <Lock className="h-3 w-3 inline mr-1" />
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
