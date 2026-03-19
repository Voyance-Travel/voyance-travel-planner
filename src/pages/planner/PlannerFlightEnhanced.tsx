import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { prefetchDestinationImages } from '@/utils/imagePrefetch';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import {
  useRoundtripFlightSearch,
  useCreateFlightHold,
  type FlightOption,
  type FlightSearchParams,
} from '@/services/flightAPI';

import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useBudgetAlerts } from '@/hooks/useBudgetAlerts';

// Enhanced components
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';
import EditorialProgressTracker from '@/components/planner/shared/EditorialProgressTracker';
import FlightFilters, { type FlightFiltersState } from '@/components/planner/flight/FlightFilters';
import EnhancedFlightCard, { type EnhancedFlightOption } from '@/components/planner/flight/EnhancedFlightCard';
import { ManualBookingModal, type ManualFlightData } from '@/components/planner/ManualBookingModal';

// User preference types
interface UserFlightPrefs {
  directFlightsOnly: boolean;
  preferredAirlines: string[];
  flightTimePreference: 'morning' | 'afternoon' | 'evening' | 'red-eye' | null;
  seatPreference: string | null;
}

function FlightSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 lg:w-40">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex-1 flex items-center gap-4">
          <Skeleton className="h-12 w-16" />
          <div className="flex-1">
            <Skeleton className="h-0.5 w-full" />
          </div>
          <Skeleton className="h-12 w-16" />
        </div>
        <div className="flex lg:flex-col items-center gap-3 lg:w-32">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  );
}

function cabinMultiplier(cabin: string): number {
  switch (cabin) {
    case 'premium_economy':
      return 1.4;
    case 'business':
      return 2.5;
    case 'first':
      return 3.5;
    case 'economy':
    default:
      return 1;
  }
}

function getHour(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

function parseISODuration(duration: string): number {
  // Example: PT7H30M
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours * 60 + minutes;
}

function toEnhancedFlight(flight: FlightOption): EnhancedFlightOption {
  const basePrice = typeof flight.price === 'number' ? flight.price : flight.price.amount;
  const segments = (flight.segments && flight.segments.length > 0)
    ? flight.segments.map((s) => ({
        departure: s.departure.time,
        arrival: s.arrival.time,
        departureAirport: s.departure.airport,
        arrivalAirport: s.arrival.airport,
        duration: s.duration ? parseISODuration(s.duration) || Math.round(flight.duration / Math.max(1, (flight.segments?.length || 1))) : Math.round(flight.duration / Math.max(1, (flight.segments?.length || 1))),
        airline: s.carrier,
        flightNumber: s.flightNumber,
        aircraft: s.aircraft,
      }))
    : [{
        departure: flight.departure,
        arrival: flight.arrival,
        departureAirport: flight.origin?.airport || 'DEP',
        arrivalAirport: flight.destination?.airport || 'ARR',
        duration: flight.duration,
        airline: flight.airline,
        flightNumber: flight.flightNumber,
      }];

  const layovers = segments.length > 1
    ? segments.slice(0, -1).map((seg, idx) => {
        const next = segments[idx + 1];
        const duration = Math.max(30, Math.round((new Date(next.departure).getTime() - new Date(seg.arrival).getTime()) / 60000));
        return {
          airport: seg.arrivalAirport,
          city: seg.arrivalAirport,
          duration,
        };
      })
    : undefined;

  return {
    id: flight.id,
    segments,
    cabinOptions: [
      { cabin: 'economy', price: Math.round(basePrice * cabinMultiplier('economy')) },
      { cabin: 'premium_economy', price: Math.round(basePrice * cabinMultiplier('premium_economy')) },
      { cabin: 'business', price: Math.round(basePrice * cabinMultiplier('business')) },
    ],
    totalDuration: flight.duration,
    stops: flight.stops,
    layovers,
    isRecommended: flight.isRecommended,
    amenities: flight.amenities,
    baggageIncluded: flight.baggageIncluded
      ? {
          carry: !!flight.baggageIncluded.carry_on,
          checked: !!flight.baggageIncluded.checked,
        }
      : undefined,
    rationale: flight.rationale,
  };
}

function isHourInRange(hour: number, range: [number, number]): boolean {
  const [start, end] = range;
  // Normal range (e.g. 8 -> 18)
  if (start <= end) return hour >= start && hour <= end;
  // Wrap-around range (e.g. 22 -> 6)
  return hour >= start || hour <= end;
}

function applyFilters(flights: FlightOption[], filters: FlightFiltersState): FlightOption[] {
  let result = [...flights];

  // Only apply hard filters that the user explicitly chose
  if (filters.directOnly) result = result.filter((f) => f.stops === 0);

  if (filters.bagsIncluded) {
    result = result.filter((f) => !!f.baggageIncluded?.checked);
  }

  // Time windows (supports wrap-around ranges like 22→6 for red-eyes)
  result = result.filter((f) => {
    const depHour = getHour(f.departure);
    const arrHour = getHour(f.arrival);
    return isHourInRange(depHour, filters.departureTimeRange) && isHourInRange(arrHour, filters.arrivalTimeRange);
  });

  // Duration
  result = result.filter((f) => f.duration <= filters.maxDuration);

  // Sort - "airlines" is treated as preference (rank), not a hard filter
  const preferredAirlines = new Set(filters.airlines);
  result.sort((a, b) => {
    const priceA = typeof a.price === 'number' ? a.price : a.price.amount;
    const priceB = typeof b.price === 'number' ? b.price : b.price.amount;

    if (preferredAirlines.size > 0) {
      const prefA = preferredAirlines.has(a.airline) ? 0 : 1;
      const prefB = preferredAirlines.has(b.airline) ? 0 : 1;
      if (prefA !== prefB) return prefA - prefB;
    }

    switch (filters.sortBy) {
      case 'price':
        return priceA - priceB;
      case 'duration':
        return a.duration - b.duration;
      case 'departure':
        return new Date(a.departure).getTime() - new Date(b.departure).getTime();
      case 'arrival':
        return new Date(a.arrival).getTime() - new Date(b.arrival).getTime();
      case 'recommended':
      default:
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        return priceA - priceB;
    }
  });

  return result;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function PlannerFlightEnhanced() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state: plannerState, setBasics, setFlights, saveTrip } = useTripPlanner();
  const { user } = useAuth();
  const { budgetAlertsEnabled } = useBudgetAlerts();

  const [selectedOutboundId, setSelectedOutboundId] = useState<string | null>(plannerState.flights?.id ? null : null);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [selectedOutboundCabin, setSelectedOutboundCabin] = useState<string>('economy');
  const [selectedReturnCabin, setSelectedReturnCabin] = useState<string>('economy');
  const [holdingFlightId, setHoldingFlightId] = useState<string | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserFlightPrefs | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  const createHold = useCreateFlightHold();

  const destination = plannerState.basics.destination || searchParams.get('destination') || 'Paris';
  const origin = plannerState.basics.originCity || searchParams.get('origin') || 'JFK';
  const startDate = plannerState.basics.startDate || searchParams.get('startDate') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = plannerState.basics.endDate || searchParams.get('endDate') || new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const travelers = Number(searchParams.get('travelers') || plannerState.basics.travelers || 1);
  const tripBudget = Number(searchParams.get('budget')) || plannerState.basics.budgetAmount;
  
  // Flight sub-budget: only use explicit user-defined allocation, not hardcoded splits.
  // Passing undefined suppresses per-card "over budget" badges when no real allocation exists.
  const flightBudget: number | undefined = undefined;

  // Load user flight preferences from database
  useEffect(() => {
    async function loadUserPreferences() {
      if (!user) {
        setPrefsLoaded(true);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('direct_flights_only, preferred_airlines, flight_time_preference, seat_preference')
          .eq('user_id', user.id)
          .single();
        
        if (!error && data) {
          setUserPrefs({
            directFlightsOnly: data.direct_flights_only ?? false,
            preferredAirlines: data.preferred_airlines ?? [],
            flightTimePreference: data.flight_time_preference as UserFlightPrefs['flightTimePreference'],
            seatPreference: data.seat_preference,
          });
          // Loaded user flight preferences
        }
      } catch (err) {
        console.error('[PlannerFlight] Error loading preferences:', err);
      } finally {
        setPrefsLoaded(true);
      }
    }
    
    loadUserPreferences();
  }, [user]);

  // Sync basics for refreshes
  useEffect(() => {
    if (!plannerState.basics.destination || plannerState.basics.destination !== destination) {
      setBasics({
        destination,
        originCity: origin,
        startDate,
        endDate,
        travelers,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, origin, startDate, endDate, travelers]);

  // Prefetch destination images for later pages (hotel selection, summary)
  useEffect(() => {
    if (destination) {
      prefetchDestinationImages(destination);
    }
  }, [destination]);

  // Initialize filters broadly.
  // Preferences should *rank* results, not hide them.
  const getInitialFilters = (): FlightFiltersState => {
    return {
      directOnly: false,
      airlines: [],
      maxPrice: 99999, // No price filtering - budget is for guidance only
      departureTimeRange: [0, 24],
      arrivalTimeRange: [0, 24],
      maxDuration: 1440,
      bagsIncluded: false,
      sortBy: flightBudget ? 'price' : 'recommended',
    };
  };

  // NOTE: maxPrice set high - budget is for visual warnings/sorting, not filtering
  const [outboundFilters, setOutboundFilters] = useState<FlightFiltersState>(() => getInitialFilters());

  // NOTE: maxPrice set high - budget is for visual warnings/sorting, not filtering
  const [returnFilters, setReturnFilters] = useState<FlightFiltersState>(() => getInitialFilters());

  // Single roundtrip search - fetches both outbound and return in one call.
  // Keep the backend query broad; apply "tight" constraints client-side via filters.
  const roundtripParams: FlightSearchParams = useMemo(
    () => ({
      origin,
      destination,
      departureDate: startDate,
      returnDate: endDate,
      passengers: travelers,
      class: 'economy',
    }),
    [origin, destination, startDate, endDate, travelers]
  );

  const {
    data: roundtripData,
    isLoading: flightsLoading,
    error: flightsError,
  } = useRoundtripFlightSearch(roundtripParams);

  // Extract outbound and return flights from roundtrip response
  const outboundFlights = roundtripData?.outbound || [];
  const returnFlights = roundtripData?.return || [];
  const outboundLoading = flightsLoading;
  const returnLoading = flightsLoading;
  const outboundError = flightsError;
  const returnError = flightsError;

  const availableAirlinesOutbound = useMemo(() => {
    if (!outboundFlights.length) return [];
    return [...new Set(outboundFlights.map((f) => f.airline))] as string[];
  }, [outboundFlights]);

  const availableAirlinesReturn = useMemo(() => {
    if (!returnFlights.length) return [];
    return [...new Set(returnFlights.map((f) => f.airline))] as string[];
  }, [returnFlights]);

  const filteredOutbound = useMemo(
    () => applyFilters(outboundFlights, outboundFilters),
    [outboundFlights, outboundFilters]
  );

  const filteredReturn = useMemo(
    () => applyFilters(returnFlights, returnFilters),
    [returnFlights, returnFilters]
  );

  const enhancedOutbound = useMemo(
    () => filteredOutbound.map(toEnhancedFlight),
    [filteredOutbound]
  );

  const enhancedReturn = useMemo(
    () => filteredReturn.map(toEnhancedFlight),
    [filteredReturn]
  );

  const persistSelection = (leg: 'outbound' | 'return', flight: FlightOption, cabin: string) => {
    const basePrice = typeof flight.price === 'number' ? flight.price : flight.price.amount;
    const price = Math.round(basePrice * cabinMultiplier(cabin));

    const next = {
      ...(plannerState.flights || {}),
      [leg === 'outbound' ? 'departure' : 'return']: {
        airline: flight.airline,
        flightNumber: flight.flightNumber,
        departureTime: formatTime(flight.departure),
        arrivalTime: formatTime(flight.arrival),
        cabin,
        price,
      },
    };

    setFlights(next);
  };

  const handleSelect = async (leg: 'outbound' | 'return', flightId: string, cabin: string) => {
    const list = leg === 'outbound' ? filteredOutbound : filteredReturn;
    const flight = list.find((f) => f.id === flightId);
    if (!flight) return;

    if (leg === 'outbound') {
      setSelectedOutboundId(flightId);
      setSelectedOutboundCabin(cabin);
    } else {
      setSelectedReturnId(flightId);
      setSelectedReturnCabin(cabin);
    }

    persistSelection(leg, flight, cabin);

    setHoldingFlightId(flightId);
    try {
      const basePrice = typeof flight.price === 'number' ? flight.price : flight.price.amount;
      await createHold.mutateAsync({
        flightId,
        priceAmount: Math.round(basePrice * cabinMultiplier(cabin)),
        currency: flight.currency || 'USD',
      });
      toast.success('Flight selected!');
    } catch {
      toast.info('Flight selected (price lock unavailable)');
    } finally {
      setHoldingFlightId(null);
    }
  };

  const canContinue = !!(plannerState.flights?.departure && plannerState.flights?.return);

  const getNavigationParams = () => {
    const params = new URLSearchParams(searchParams);
    params.set('destination', destination);
    params.set('origin', origin);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('travelers', String(travelers));
    if (tripBudget) {
      params.set('budget', String(tripBudget));
    }
    return params;
  };

  const handleContinue = async () => {
    if (!canContinue) {
      toast.error('Please select both an outbound and return flight');
      return;
    }

    // Save trip to database with flight selection and get the tripId
    let savedTripId: string | null = null;
    try {
      savedTripId = await saveTrip();
      if (savedTripId) {
        // Trip saved with flight selection
      }
    } catch (error) {
      console.error('[PlannerFlight] Failed to save trip:', error);
      // Continue navigation even if save fails - data is still in context
    }

    const params = getNavigationParams();
    // CRITICAL: Pass tripId in URL so it persists across navigation/refresh
    if (savedTripId) {
      params.set('tripId', savedTripId);
    }
    if (selectedOutboundId) params.set('outboundFlightId', selectedOutboundId);
    if (selectedReturnId) params.set('returnFlightId', selectedReturnId);
    params.set('outboundCabin', selectedOutboundCabin);
    params.set('returnCabin', selectedReturnCabin);

    navigate(`/planner/summary?${params.toString()}`);
  };

  const handleSkipFlights = () => {
    setShowSkipModal(true);
  };

  const handleManualFlightSubmit = async (data: { flight?: ManualFlightData }) => {
    if (data.flight) {
      // Store manual flight as a special selection
      setFlights({
        departure: {
          airline: data.flight.airline || 'Manual Entry',
          flightNumber: data.flight.flightNumber || 'N/A',
          departureTime: `${data.flight.departureDate}T${data.flight.departureTime || '09:00'}:00`,
          arrivalTime: `${data.flight.arrivalDate || data.flight.departureDate}T${data.flight.arrivalTime || '18:00'}:00`,
          price: 0,
          cabin: 'economy',
        },
        return: {
          airline: data.flight.airline || 'Manual Entry',
          flightNumber: '',
          departureTime: '',
          arrivalTime: '',
          price: 0,
          cabin: 'economy',
        },
      });
      toast.success('Flight details saved');
    }
    
    const params = getNavigationParams();
    params.set('skippedFlight', 'true');
    if (data.flight) params.set('manualFlight', 'true');
    navigate(`/planner/summary?${params.toString()}`);
  };

  const handleSkipWithoutDetails = () => {
    const params = getNavigationParams();
    params.set('skippedFlight', 'true');
    navigate(`/planner/summary?${params.toString()}`);
  };

  return (
    <MainLayout>
      <Head title="Select Flights | Voyance" description="Choose your outbound and return flights" />

      <section className="py-10 min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <DynamicDestinationPhotos
            destination={destination}
            startDate={startDate}
            endDate={endDate}
            travelers={travelers}
            variant="banner"
            className="mb-8"
          />

          <div className="grid lg:grid-cols-[1fr_340px] gap-10">
            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
                  Select Your Flights
                </h1>
                <p className="text-muted-foreground text-lg">
                  {origin} ↔ {destination} · {travelers} traveler{travelers > 1 ? 's' : ''}
                </p>
                
                {/* Show personalization indicator */}
                {(userPrefs && (userPrefs.directFlightsOnly || userPrefs.preferredAirlines?.length > 0)) || tripBudget ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {userPrefs && (userPrefs.directFlightsOnly || userPrefs.preferredAirlines?.length > 0) && (
                      <Badge variant="secondary" className="gap-1.5 text-xs">
                        <Sparkles className="h-3 w-3" />
                        Personalized for you
                      </Badge>
                    )}
                    {tripBudget && (
                      <Badge variant="outline" className="text-xs bg-primary/5">
                        Budget: ${tripBudget.toLocaleString()} total
                      </Badge>
                    )}
                    {flightBudget && (
                      <Badge variant="outline" className="text-xs">
                        ~${flightBudget.toLocaleString()} for flights
                      </Badge>
                    )}
                    {userPrefs?.directFlightsOnly && (
                      <Badge variant="outline" className="text-xs">Non-stop preferred</Badge>
                    )}
                    {userPrefs?.preferredAirlines && userPrefs.preferredAirlines.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {userPrefs.preferredAirlines.slice(0, 2).join(', ')}
                        {userPrefs.preferredAirlines.length > 2 && ` +${userPrefs.preferredAirlines.length - 2}`}
                      </Badge>
                    )}
                  </div>
                ) : null}
              </motion.div>

              <Tabs defaultValue="outbound" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="outbound">Outbound</TabsTrigger>
                  <TabsTrigger value="return">Return</TabsTrigger>
                </TabsList>

                <TabsContent value="outbound">
                  <FlightFilters
                    filters={outboundFilters}
                    onFiltersChange={setOutboundFilters}
                    availableAirlines={availableAirlinesOutbound}
                    priceRange={[0, 5000]}
                  />

                  <div className="space-y-5">
                    <AnimatePresence mode="wait">
                      {outboundLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          {[...Array(4)].map((_, i) => (
                            <FlightSkeleton key={i} />
                          ))}
                        </motion.div>
                      ) : outboundError ? (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <p className="text-lg font-medium text-foreground mb-2">Failed to load outbound flights</p>
                            <p className="text-muted-foreground">Please try again.</p>
                          </CardContent>
                        </Card>
                      ) : enhancedOutbound.length === 0 ? (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <p className="text-lg font-medium text-foreground mb-2">No outbound flights found</p>
                            <p className="text-muted-foreground">Try adjusting your filters.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <motion.div key="flights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                          {enhancedOutbound.map((flight) => (
                            <EnhancedFlightCard
                              key={flight.id}
                              flight={flight}
                              isSelected={selectedOutboundId === flight.id}
                              selectedCabin={selectedOutboundCabin}
                              onSelect={(cabin) => handleSelect('outbound', flight.id, cabin)}
                              isLoading={holdingFlightId === flight.id}
                              budgetAmount={flightBudget}
                              showBudgetWarnings={budgetAlertsEnabled}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </TabsContent>

                <TabsContent value="return">
                  <FlightFilters
                    filters={returnFilters}
                    onFiltersChange={setReturnFilters}
                    availableAirlines={availableAirlinesReturn}
                    priceRange={[0, 5000]}
                  />

                  <div className="space-y-5">
                    <AnimatePresence mode="wait">
                      {returnLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          {[...Array(4)].map((_, i) => (
                            <FlightSkeleton key={i} />
                          ))}
                        </motion.div>
                      ) : returnError ? (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <p className="text-lg font-medium text-foreground mb-2">Failed to load return flights</p>
                            <p className="text-muted-foreground">Please try again.</p>
                          </CardContent>
                        </Card>
                      ) : enhancedReturn.length === 0 ? (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <p className="text-lg font-medium text-foreground mb-2">No return flights found</p>
                            <p className="text-muted-foreground">Try adjusting your filters.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <motion.div key="flights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                          {enhancedReturn.map((flight) => (
                            <EnhancedFlightCard
                              key={flight.id}
                              flight={flight}
                              isSelected={selectedReturnId === flight.id}
                              selectedCabin={selectedReturnCabin}
                              onSelect={(cabin) => handleSelect('return', flight.id, cabin)}
                              isLoading={holdingFlightId === flight.id}
                              budgetAmount={flightBudget}
                              showBudgetWarnings={budgetAlertsEnabled}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </TabsContent>
              </Tabs>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-8 flex justify-between items-center"
              >
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Back
                </Button>
                <Button onClick={handleContinue} disabled={!canContinue} size="lg" className="lg:hidden">
                  Continue to Hotels
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-24 space-y-4">
                <EditorialProgressTracker
                  destination={destination}
                  startDate={startDate}
                  endDate={endDate}
                  travelers={travelers}
                  currentStep="flights"
                  flightSelected={canContinue}
                  flightDetails={plannerState.flights?.departure ? {
                    airline: plannerState.flights.departure.airline,
                    price: plannerState.flights.departure.price,
                  } : undefined}
                />
                
                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3"
                >
                  <Button 
                    onClick={handleContinue} 
                    disabled={!canContinue || plannerState.isLoading} 
                    size="lg"
                    className="w-full h-12"
                  >
                    {plannerState.isLoading ? 'Saving...' : 'Continue to Hotels'}
                    {!plannerState.isLoading && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                  
                  <button 
                    onClick={handleSkipFlights}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    I'll add my flight later
                  </button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Skip Flight Modal */}
      <ManualBookingModal
        open={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        onSubmit={handleManualFlightSubmit}
        type="flight"
        onSkip={handleSkipWithoutDetails}
      />
    </MainLayout>
  );
}
