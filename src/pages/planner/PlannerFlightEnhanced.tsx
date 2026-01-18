import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useFlightSearch, 
  useCreateFlightHold,
  type FlightOption,
  type FlightSearchParams 
} from '@/services/flightAPI';

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

// Convert API flight to enhanced format
function toEnhancedFlight(flight: FlightOption): EnhancedFlightOption {
  const price = typeof flight.price === 'number' ? flight.price : flight.price.amount;
  
  return {
    id: flight.id,
    segments: [{
      departure: flight.departure,
      arrival: flight.arrival,
      departureAirport: flight.origin?.airport || 'DEP',
      arrivalAirport: flight.destination?.airport || 'ARR',
      duration: flight.duration,
      airline: flight.airline,
      flightNumber: flight.flightNumber,
      aircraft: (flight as any).aircraft,
    }],
    cabinOptions: [
      { cabin: 'economy', price: price, features: ['Standard seat'] },
      { cabin: 'premium_economy', price: Math.round(price * 1.4), features: ['Extra legroom', 'Priority boarding'] },
      { cabin: 'business', price: Math.round(price * 2.5), features: ['Lie-flat seat', 'Lounge access', 'Priority boarding'] },
    ],
    totalDuration: flight.duration,
    stops: flight.stops,
    layovers: flight.stopCities?.map((city) => ({
      airport: city,
      city: city,
      duration: 90, // Default layover
    })),
    isRecommended: flight.isRecommended,
    amenities: flight.amenities,
    baggageIncluded: flight.baggageIncluded ? {
      carry: (flight.baggageIncluded as any).carry ?? false,
      checked: (flight.baggageIncluded as any).checked ?? false,
    } : undefined,
    rationale: flight.rationale,
  };
}

export default function PlannerFlightEnhanced() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedCabin, setSelectedCabin] = useState<string>('economy');
  const [holdingFlightId, setHoldingFlightId] = useState<string | null>(null);
  
  const createHold = useCreateFlightHold();
  
  // Filter state
  const [filters, setFilters] = useState<FlightFiltersState>({
    directOnly: false,
    airlines: [],
    maxPrice: 5000,
    departureTimeRange: [0, 24],
    arrivalTimeRange: [0, 24],
    maxDuration: 1440,
    bagsIncluded: false,
    sortBy: 'recommended',
  });
  
  // Get search params from URL
  const destination = searchParams.get('destination') || 'Paris';
  const origin = searchParams.get('origin') || 'JFK';
  const startDate = searchParams.get('startDate') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = searchParams.get('endDate') || new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const travelers = parseInt(searchParams.get('travelers') || '1');
  
  const flightParams: FlightSearchParams = useMemo(() => ({
    origin,
    destination,
    departureDate: startDate,
    returnDate: endDate,
    passengers: travelers,
    class: 'economy',
    directOnly: filters.directOnly,
  }), [origin, destination, startDate, endDate, travelers, filters.directOnly]);
  
  const { data: flights, isLoading, error } = useFlightSearch(flightParams);
  
  // Get available airlines from results
  const availableAirlines = useMemo(() => {
    if (!flights) return [];
    return [...new Set(flights.map(f => f.airline))];
  }, [flights]);

  // Apply filters and sorting
  const filteredFlights = useMemo(() => {
    if (!flights) return [];
    
    let result = [...flights];
    
    // Filter by direct only
    if (filters.directOnly) {
      result = result.filter(f => f.stops === 0);
    }
    
    // Filter by airlines
    if (filters.airlines.length > 0) {
      result = result.filter(f => filters.airlines.includes(f.airline));
    }
    
    // Filter by price
    result = result.filter(f => {
      const price = typeof f.price === 'number' ? f.price : f.price.amount;
      return price <= filters.maxPrice;
    });
    
    // Filter by bags
    if (filters.bagsIncluded) {
      result = result.filter(f => f.baggageIncluded?.checked);
    }
    
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
  }, [flights, filters]);

  const enhancedFlights = useMemo(() => 
    filteredFlights.map(toEnhancedFlight), 
    [filteredFlights]
  );
  
  const handleSelectFlight = async (flightId: string, cabin: string) => {
    if (selectedFlightId === flightId && selectedCabin === cabin) {
      setSelectedFlightId(null);
      return;
    }
    
    setSelectedFlightId(flightId);
    setSelectedCabin(cabin);
    setHoldingFlightId(flightId);
    
    try {
      const flight = filteredFlights.find(f => f.id === flightId);
      if (flight) {
        const price = typeof flight.price === 'number' ? flight.price : flight.price.amount;
        await createHold.mutateAsync({
          flightId,
          priceAmount: price,
          currency: flight.currency || 'USD',
        });
        toast.success('Flight selected! Price locked for 30 minutes.');
      }
    } catch (error) {
      console.error('Failed to create hold:', error);
      toast.info('Flight selected (price lock unavailable)');
    } finally {
      setHoldingFlightId(null);
    }
  };
  
  const handleContinue = () => {
    if (!selectedFlightId) {
      toast.error('Please select a flight first');
      return;
    }
    
    const params = new URLSearchParams(searchParams);
    params.set('flightId', selectedFlightId);
    params.set('cabin', selectedCabin);
    navigate(`/planner/hotel?${params.toString()}`);
  };

  return (
    <MainLayout>
      <Head 
        title="Select Flights | Voyance" 
        description="Choose the perfect flight for your trip"
      />
      
      <section className="py-8 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Destination Teaser */}
          <DynamicDestinationPhotos 
            destination={destination}
            startDate={startDate}
            endDate={endDate}
            travelers={travelers}
            variant="banner"
            className="mb-6"
          />
          
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            {/* Main Content */}
            <div>
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Select Your Flights
                </h1>
                <p className="text-muted-foreground">
                  {origin} → {destination} · {travelers} traveler{travelers > 1 ? 's' : ''}
                </p>
              </motion.div>
              
              {/* Filters */}
              <FlightFilters 
                filters={filters}
                onFiltersChange={setFilters}
                availableAirlines={availableAirlines}
                priceRange={[0, 5000]}
              />
              
              {/* Flight List */}
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {[...Array(4)].map((_, i) => (
                        <FlightSkeleton key={i} />
                      ))}
                    </motion.div>
                  ) : error ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="text-lg font-medium text-foreground mb-2">
                          Failed to load flights
                        </p>
                        <p className="text-muted-foreground mb-4">
                          Please try again or adjust your search.
                        </p>
                        <Button onClick={() => window.location.reload()}>
                          Try Again
                        </Button>
                      </CardContent>
                    </Card>
                  ) : enhancedFlights.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="text-lg font-medium text-foreground mb-2">
                          No flights found
                        </p>
                        <p className="text-muted-foreground">
                          Try adjusting your filters or search criteria.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <motion.div
                      key="flights"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      {enhancedFlights.map((flight) => (
                        <EnhancedFlightCard
                          key={flight.id}
                          flight={flight}
                          isSelected={selectedFlightId === flight.id}
                          selectedCabin={selectedCabin}
                          onSelect={(cabin) => handleSelectFlight(flight.id, cabin)}
                          isLoading={holdingFlightId === flight.id}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-8 flex justify-between items-center"
              >
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Back
                </Button>
                <Button 
                  onClick={handleContinue}
                  disabled={!selectedFlightId}
                  size="lg"
                >
                  Continue to Hotels
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            </div>
            
            {/* Sidebar - Progress Tracker */}
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <EditorialProgressTracker
                  destination={destination}
                  startDate={startDate}
                  endDate={endDate}
                  travelers={travelers}
                  currentStep="flights"
                  flightSelected={!!selectedFlightId}
                  flightDetails={selectedFlightId ? {
                    airline: filteredFlights.find(f => f.id === selectedFlightId)?.airline,
                    price: (() => {
                      const f = filteredFlights.find(f => f.id === selectedFlightId);
                      return f ? (typeof f.price === 'number' ? f.price : f.price.amount) : undefined;
                    })(),
                  } : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
