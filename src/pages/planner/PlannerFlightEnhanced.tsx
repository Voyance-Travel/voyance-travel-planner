import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  useFlightSearch,
  useCreateFlightHold,
  type FlightOption,
  type FlightSearchParams,
} from '@/services/flightAPI';

import { useTripPlanner } from '@/contexts/TripPlannerContext';

// Enhanced components
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';
import EditorialProgressTracker from '@/components/planner/shared/EditorialProgressTracker';
import FlightFilters, { type FlightFiltersState } from '@/components/planner/flight/FlightFilters';
import EnhancedFlightCard, { type EnhancedFlightOption } from '@/components/planner/flight/EnhancedFlightCard';

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

function applyFilters(flights: FlightOption[], filters: FlightFiltersState): FlightOption[] {
  let result = [...flights];

  if (filters.directOnly) result = result.filter((f) => f.stops === 0);

  if (filters.airlines.length > 0) {
    result = result.filter((f) => filters.airlines.includes(f.airline));
  }

  result = result.filter((f) => {
    const basePrice = typeof f.price === 'number' ? f.price : f.price.amount;
    return basePrice <= filters.maxPrice;
  });

  if (filters.bagsIncluded) {
    result = result.filter((f) => !!f.baggageIncluded?.checked);
  }

  // Time windows
  result = result.filter((f) => {
    const depHour = getHour(f.departure);
    const arrHour = getHour(f.arrival);
    return (
      depHour >= filters.departureTimeRange[0] &&
      depHour <= filters.departureTimeRange[1] &&
      arrHour >= filters.arrivalTimeRange[0] &&
      arrHour <= filters.arrivalTimeRange[1]
    );
  });

  // Duration
  result = result.filter((f) => f.duration <= filters.maxDuration);

  // Sort
  result.sort((a, b) => {
    const priceA = typeof a.price === 'number' ? a.price : a.price.amount;
    const priceB = typeof b.price === 'number' ? b.price : b.price.amount;

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
  const { state: plannerState, setBasics, setFlights } = useTripPlanner();

  const [selectedOutboundId, setSelectedOutboundId] = useState<string | null>(plannerState.flights?.id ? null : null);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [selectedOutboundCabin, setSelectedOutboundCabin] = useState<string>('economy');
  const [selectedReturnCabin, setSelectedReturnCabin] = useState<string>('economy');
  const [holdingFlightId, setHoldingFlightId] = useState<string | null>(null);

  const createHold = useCreateFlightHold();

  const destination = searchParams.get('destination') || plannerState.basics.destination || 'Paris';
  const origin = searchParams.get('origin') || plannerState.basics.originCity || 'JFK';
  const startDate = searchParams.get('startDate') || plannerState.basics.startDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = searchParams.get('endDate') || plannerState.basics.endDate || new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const travelers = Number(searchParams.get('travelers') || plannerState.basics.travelers || 1);

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

  const [outboundFilters, setOutboundFilters] = useState<FlightFiltersState>({
    directOnly: false,
    airlines: [],
    maxPrice: 5000,
    departureTimeRange: [0, 24],
    arrivalTimeRange: [0, 24],
    maxDuration: 1440,
    bagsIncluded: false,
    sortBy: 'recommended',
  });

  const [returnFilters, setReturnFilters] = useState<FlightFiltersState>({
    directOnly: false,
    airlines: [],
    maxPrice: 5000,
    departureTimeRange: [0, 24],
    arrivalTimeRange: [0, 24],
    maxDuration: 1440,
    bagsIncluded: false,
    sortBy: 'recommended',
  });

  const outboundParams: FlightSearchParams = useMemo(
    () => ({
      origin,
      destination,
      departureDate: startDate,
      passengers: travelers,
      class: 'economy',
      directOnly: outboundFilters.directOnly,
    }),
    [origin, destination, startDate, travelers, outboundFilters.directOnly]
  );

  const returnParams: FlightSearchParams = useMemo(
    () => ({
      origin: destination,
      destination: origin,
      departureDate: endDate,
      passengers: travelers,
      class: 'economy',
      directOnly: returnFilters.directOnly,
    }),
    [origin, destination, endDate, travelers, returnFilters.directOnly]
  );

  const {
    data: outboundFlights,
    isLoading: outboundLoading,
    error: outboundError,
  } = useFlightSearch(outboundParams);

  const {
    data: returnFlights,
    isLoading: returnLoading,
    error: returnError,
  } = useFlightSearch(returnParams);

  const availableAirlinesOutbound = useMemo(() => {
    if (!outboundFlights) return [];
    return [...new Set(outboundFlights.map((f) => f.airline))];
  }, [outboundFlights]);

  const availableAirlinesReturn = useMemo(() => {
    if (!returnFlights) return [];
    return [...new Set(returnFlights.map((f) => f.airline))];
  }, [returnFlights]);

  const filteredOutbound = useMemo(
    () => applyFilters(outboundFlights || [], outboundFilters),
    [outboundFlights, outboundFilters]
  );

  const filteredReturn = useMemo(
    () => applyFilters(returnFlights || [], returnFilters),
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

  const handleContinue = () => {
    if (!canContinue) {
      toast.error('Please select both an outbound and return flight');
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set('destination', destination);
    params.set('origin', origin);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('travelers', String(travelers));

    if (selectedOutboundId) params.set('outboundFlightId', selectedOutboundId);
    if (selectedReturnId) params.set('returnFlightId', selectedReturnId);
    params.set('outboundCabin', selectedOutboundCabin);
    params.set('returnCabin', selectedReturnCabin);

    navigate(`/planner/hotel?${params.toString()}`);
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
                <Button onClick={handleContinue} disabled={!canContinue} size="lg">
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
                
                {/* Floating Continue Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button 
                    onClick={handleContinue} 
                    disabled={!canContinue} 
                    size="lg"
                    className="w-full h-12"
                  >
                    Continue to Hotels
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
