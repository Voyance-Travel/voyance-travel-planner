/**
 * Multi-City Trip Planner
 * 
 * Dedicated page for planning trips that span multiple cities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, addDays, isBefore, startOfToday, differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { MapPin, Calendar as CalendarIcon, Users, Plane, ArrowRight, Sparkles, ArrowLeft } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import MultiCitySelector from '@/components/planner/MultiCitySelector';
import { TripDestination, InterCityTransport, calculateTotalNights, generateDestinationDates } from '@/types/multiCity';
import { searchAirports, type Airport } from '@/services/locationSearchAPI';

// Simple airport autocomplete for origin
function OriginInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (city: string, codes?: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (inputValue.length >= 2) {
      searchAirports(inputValue, 8).then(setAirports);
    } else {
      setAirports([]);
    }
  }, [inputValue]);

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <Plane className="h-4 w-4 text-muted-foreground" />
      </div>
      <input
        type="text"
        placeholder="Departing from..."
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => inputValue.length >= 2 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="w-full h-12 pl-8 text-base bg-transparent border-0 border-b border-border focus:border-primary focus:outline-none"
      />
      {isOpen && airports.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-lg z-50 rounded-xl max-h-64 overflow-y-auto">
          {airports.map((airport) => (
            <button
              key={airport.code}
              type="button"
              onClick={() => {
                setInputValue(`${airport.city} (${airport.code})`);
                onChange(airport.city, [airport.code]);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="font-medium">{airport.city}</span>
                <span className="text-muted-foreground ml-1">({airport.code})</span>
                {airport.country && (
                  <span className="text-xs text-muted-foreground ml-2">{airport.country}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MultiCityPlanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state: plannerState, setBasics, saveTrip } = useTripPlanner();
  const { user } = useAuth();

  const today = startOfToday();

  // State
  const [originCity, setOriginCity] = useState(plannerState.basics.originCity || '');
  const [originCodes, setOriginCodes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    plannerState.basics.startDate ? parseLocalDate(plannerState.basics.startDate) : undefined
  );
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || 2);
  const [destinations, setDestinations] = useState<TripDestination[]>(
    plannerState.basics.destinations || []
  );
  const [transports, setTransports] = useState<InterCityTransport[]>(
    plannerState.basics.interCityTransports || []
  );

  // Calculate end date based on destinations
  const totalNights = calculateTotalNights(destinations);
  const endDate = startDate && totalNights > 0 
    ? addDays(startDate, totalNights) 
    : undefined;

  // Update destinations with calculated dates when start date changes
  useEffect(() => {
    if (startDate && destinations.length > 0) {
      const dated = generateDestinationDates(destinations, format(startDate, 'yyyy-MM-dd'));
      // Only update if dates have actually changed to avoid infinite loop
      const needsUpdate = dated.some((d, i) => 
        d.arrivalDate !== destinations[i]?.arrivalDate ||
        d.departureDate !== destinations[i]?.departureDate
      );
      if (needsUpdate) {
        setDestinations(dated);
      }
    }
  }, [startDate, destinations.length]);

  // Form validation
  const isValid = originCity && startDate && destinations.length >= 2 && totalNights > 0;

  const handleOriginChange = useCallback((city: string, codes?: string[]) => {
    setOriginCity(city);
    if (codes) setOriginCodes(codes);
  }, []);

  const handleContinue = async () => {
    if (!isValid) {
      toast.error('Please add at least 2 cities and select your dates');
      return;
    }

    // Get the first destination as the "primary" for legacy compatibility
    const primaryDestination = destinations[0]?.city || '';

    // Update context with multi-city data
    setBasics({
      destination: primaryDestination,
      originCity,
      startDate: format(startDate!, 'yyyy-MM-dd'),
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      travelers,
      isMultiCity: true,
      destinations,
      interCityTransports: transports,
    });

    // Save trip
    const tripId = await saveTrip();
    
    if (tripId) {
      toast.success('Multi-city trip created!');
      // Navigate to planner with multi-city context
      navigate(`/trip/${tripId}`);
    }
  };

  return (
    <MainLayout>
      <Head
        title="Multi-City Trip Planner | Voyance"
        description="Plan your multi-city adventure across Europe, Asia, and beyond with Voyance."
      />

      {/* Hero Section */}
      <section className="relative min-h-[40vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={toSiteImageUrlFromPhotoId('photo-1488085061387-422e29b40080')}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate/40 via-slate/60 to-background" />
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto px-8 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white"
          >
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-8 h-px bg-white/40" />
              <span className="text-xs tracking-[0.3em] uppercase text-white/60">
                Multi-City Adventure
              </span>
              <div className="w-8 h-px bg-white/40" />
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal mb-4">
              One trip, <em className="italic">many cities</em>
            </h1>

            <p className="text-base text-white/70 font-light max-w-lg mx-auto">
              Build your perfect multi-destination journey. Add cities, allocate nights, 
              and we'll create a seamless itinerary with travel days included.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Planning Form */}
      <section className="relative pb-16 -mt-8">
        <div className="max-w-3xl mx-auto px-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-card p-6 md:p-8 shadow-elevated rounded-2xl border border-border space-y-8"
          >
            {/* Destinations First - This is what users care about */}
            <MultiCitySelector
              destinations={destinations}
              transports={transports}
              onDestinationsChange={setDestinations}
              onTransportsChange={setTransports}
              startDate={startDate ? format(startDate, 'yyyy-MM-dd') : undefined}
            />

            {/* Separator */}
            <div className="border-t border-border" />

            {/* Trip Details - Secondary */}
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2">
                  Trip starts
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full h-12 justify-between text-left border-0 border-b border-border rounded-none hover:bg-transparent hover:border-primary px-0",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                      <CalendarIcon className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(date) => isBefore(date, today)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2">
                  Departing from
                </label>
                <OriginInput value={originCity} onChange={handleOriginChange} />
              </div>

              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2">
                  Travelers
                </label>
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setTravelers(num)}
                        className={cn(
                          "w-10 h-10 rounded-full border transition-all text-sm",
                          travelers === num
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Summary & CTA */}
            {destinations.length >= 2 && startDate && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-6 border-t border-border"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Your Journey</p>
                    <p className="text-lg font-semibold">
                      {format(startDate, 'MMM d')} – {endDate && format(endDate, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{destinations.length} cities</p>
                    <p className="text-lg font-semibold">{totalNights} nights</p>
                  </div>
                </div>

                <Button
                  onClick={handleContinue}
                  disabled={!isValid}
                  size="lg"
                  className="w-full gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Continue to Plan Trip
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
