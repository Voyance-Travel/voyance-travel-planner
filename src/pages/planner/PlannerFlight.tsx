import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, 
  Clock, 
  ArrowRight, 
  Check, 
  Star, 
  Loader2,
  Filter,
  SlidersHorizontal,
  Briefcase,
  Wifi,
  Zap,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  useFlightSearch, 
  useCreateFlightHold,
  type FlightOption,
  type FlightSearchParams 
} from '@/services/flightAPI';

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getPrice(price: FlightOption['price']): number {
  return typeof price === 'number' ? price : price.amount;
}

function FlightCard({ 
  flight, 
  isSelected, 
  onSelect,
  isLoading 
}: { 
  flight: FlightOption; 
  isSelected: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const price = getPrice(flight.price);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        relative bg-card rounded-xl border-2 transition-all duration-200 overflow-hidden
        ${isSelected 
          ? 'border-primary shadow-lg ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/50 hover:shadow-md'
        }
      `}
    >
      {/* Recommended Badge */}
      {flight.isRecommended && (
        <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-medium py-1 px-3 flex items-center justify-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          Recommended for you
        </div>
      )}
      
      <div className={`p-5 ${flight.isRecommended ? 'pt-10' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Airline Info */}
          <div className="flex items-center gap-3 md:w-32 shrink-0">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-lg">
              {flight.airlineLogo || '✈️'}
            </div>
            <div>
              <p className="font-medium text-foreground">{flight.airline}</p>
              <p className="text-xs text-muted-foreground">{flight.flightNumber}</p>
            </div>
          </div>
          
          {/* Flight Times */}
          <div className="flex-1 flex items-center gap-4">
            <div className="text-center">
              <p className="text-xl font-semibold text-foreground">
                {formatTime(flight.departure)}
              </p>
              <p className="text-sm text-muted-foreground">{flight.origin.airport}</p>
            </div>
            
            <div className="flex-1 flex flex-col items-center px-4">
              <p className="text-xs text-muted-foreground mb-1">
                {formatDuration(flight.duration)}
              </p>
              <div className="relative w-full h-0.5 bg-border">
                <div className="absolute inset-y-0 left-0 w-2 h-2 -mt-[3px] bg-primary rounded-full" />
                <div className="absolute inset-y-0 right-0 w-2 h-2 -mt-[3px] bg-primary rounded-full" />
                {flight.stops === 0 ? (
                  <ArrowRight className="absolute left-1/2 -translate-x-1/2 -mt-2 h-4 w-4 text-primary" />
                ) : (
                  <div className="absolute left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-accent rounded-full" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                {flight.stopCities?.length ? ` (${flight.stopCities.join(', ')})` : ''}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-xl font-semibold text-foreground">
                {formatTime(flight.arrival)}
              </p>
              <p className="text-sm text-muted-foreground">{flight.destination.airport}</p>
            </div>
          </div>
          
          {/* Price & Select */}
          <div className="flex md:flex-col items-center md:items-end gap-3 md:w-36 shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">${price}</p>
              <p className="text-xs text-muted-foreground">per person</p>
            </div>
            <Button
              onClick={onSelect}
              disabled={isLoading}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSelected ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Selected
                </>
              ) : (
                'Select'
              )}
            </Button>
          </div>
        </div>
        
        {/* Amenities & Rationale */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-3 text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4 mr-1" />
              View details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t border-border space-y-3">
              {/* Amenities */}
              {flight.amenities && flight.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {flight.amenities.map((amenity, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {amenity === 'WiFi' && <Wifi className="h-3 w-3" />}
                      {amenity === 'Power' && <Zap className="h-3 w-3" />}
                      {amenity}
                    </Badge>
                  ))}
                  {flight.baggageIncluded?.checked && (
                    <Badge variant="secondary" className="gap-1">
                      <Briefcase className="h-3 w-3" />
                      Checked bag included
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Why this flight */}
              {flight.rationale && flight.rationale.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Why we recommend this:</p>
                  <ul className="text-sm text-foreground space-y-1">
                    {flight.rationale.map((reason, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </motion.div>
  );
}

function FlightSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 md:w-32">
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
        <div className="flex md:flex-col items-center gap-3 md:w-36">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function PlannerFlight() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [directOnly, setDirectOnly] = useState(false);
  const [holdingFlightId, setHoldingFlightId] = useState<string | null>(null);
  
  const createHold = useCreateFlightHold();
  
  // Get search params from URL or use defaults
  const flightParams: FlightSearchParams = useMemo(() => ({
    origin: searchParams.get('origin') || 'JFK',
    destination: searchParams.get('destination') || 'CDG',
    departureDate: searchParams.get('departureDate') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    returnDate: searchParams.get('returnDate') || undefined,
    passengers: parseInt(searchParams.get('passengers') || '1'),
    class: (searchParams.get('class') as 'economy' | 'business') || 'economy',
    directOnly,
  }), [searchParams, directOnly]);
  
  const { data: flights, isLoading, error } = useFlightSearch(flightParams);
  
  const handleSelectFlight = async (flight: FlightOption) => {
    if (selectedFlightId === flight.id) {
      setSelectedFlightId(null);
      return;
    }
    
    setSelectedFlightId(flight.id);
    setHoldingFlightId(flight.id);
    
    try {
      const price = getPrice(flight.price);
      await createHold.mutateAsync({
        flightId: flight.id,
        priceAmount: price,
        currency: flight.currency || 'USD',
      });
      
      toast.success('Flight selected! Price locked for 30 minutes.');
    } catch (error) {
      console.error('Failed to create hold:', error);
      // Still allow selection even if hold fails
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
    
    // Save selection and navigate to hotel selection
    const params = new URLSearchParams(searchParams);
    params.set('flightId', selectedFlightId);
    navigate(`/planner/hotel?${params.toString()}`);
  };

  const filteredFlights = useMemo(() => {
    if (!flights) return [];
    return directOnly ? flights.filter(f => f.stops === 0) : flights;
  }, [flights, directOnly]);

  return (
    <MainLayout>
      <Head 
        title="Select Flights | Voyance" 
        description="Choose the perfect flight for your trip"
      />
      
      <section className="pt-24 pb-16 min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>Trip Setup</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-foreground font-medium">Flights</span>
              <ArrowRight className="h-3 w-3" />
              <span>Hotel</span>
              <ArrowRight className="h-3 w-3" />
              <span>Itinerary</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Select Your Flight
            </h1>
            <p className="text-muted-foreground">
              {flightParams.origin} → {flightParams.destination} · {flightParams.departureDate}
            </p>
          </motion.div>
          
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 flex items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <Switch
                id="direct-only"
                checked={directOnly}
                onCheckedChange={setDirectOnly}
              />
              <Label htmlFor="direct-only" className="text-sm">
                Direct flights only
              </Label>
            </div>
            
            <div className="flex-1" />
            
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              More filters
            </Button>
          </motion.div>
          
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
                    <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      Failed to load flights
                    </p>
                    <p className="text-muted-foreground mb-4">
                      We couldn't find flights for your search. Please try again.
                    </p>
                    <Button onClick={() => window.location.reload()}>
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredFlights.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      No flights found
                    </p>
                    <p className="text-muted-foreground">
                      {directOnly 
                        ? 'No direct flights available. Try disabling the direct flights filter.'
                        : 'Try adjusting your search criteria.'}
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
                  {filteredFlights.map((flight) => (
                    <FlightCard
                      key={flight.id}
                      flight={flight}
                      isSelected={selectedFlightId === flight.id}
                      onSelect={() => handleSelectFlight(flight)}
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
      </section>
    </MainLayout>
  );
}
