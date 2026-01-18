import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalendarIcon, Users, ArrowRight, Plane, Loader2, DollarSign, ChevronDown } from 'lucide-react';
import { format, addDays, isBefore, startOfToday } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { 
  searchAirports, 
  searchDestinations, 
  formatAirportDisplay,
  formatDestinationDisplay,
  type Airport,
  type Destination
} from '@/services/locationSearchAPI';

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Airport Autocomplete - Editorial Style
function AirportAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  
  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debouncedQuery.length >= 1) {
      setLoading(true);
      searchAirports(debouncedQuery, 12)
        .then(setAirports)
        .finally(() => setLoading(false));
    } else {
      setAirports([]);
    }
  }, [debouncedQuery]);

  const handleSelect = (airport: Airport) => {
    const display = formatAirportDisplay(airport);
    setInputValue(display);
    onChange(display);
    setIsOpen(false);
  };

  const showDropdown = isOpen && inputValue.length >= 1;

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <Plane className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (inputValue.length >= 1) setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="h-12 pl-8 text-base bg-transparent border-0 border-b border-border rounded-none focus:border-primary focus:ring-0 font-sans"
      />
      {showDropdown && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-elevated z-50 overflow-hidden max-h-72 overflow-y-auto"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm font-sans">Searching...</span>
            </div>
          ) : airports.length > 0 ? (
            airports.map((airport) => (
              <button
                key={airport.id}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-secondary/50 flex items-center gap-3 transition-colors border-b border-border/50 last:border-0"
                onMouseDown={() => handleSelect(airport)}
              >
                <span className="text-xs font-medium text-primary tracking-wide w-10">{airport.code}</span>
                <div className="min-w-0">
                  <p className="font-sans text-sm text-foreground truncate">{airport.name}</p>
                  <p className="text-xs text-muted-foreground">{airport.city}, {airport.country}</p>
                </div>
              </button>
            ))
          ) : inputValue.length >= 1 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm font-sans">
              No airports found
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

// Destination Autocomplete - Editorial Style
function DestinationAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  
  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debouncedQuery.length >= 1) {
      setLoading(true);
      searchDestinations(debouncedQuery, 12)
        .then(setDestinations)
        .finally(() => setLoading(false));
    } else {
      setDestinations([]);
    }
  }, [debouncedQuery]);

  const handleSelect = (dest: Destination) => {
    const display = formatDestinationDisplay(dest);
    setInputValue(display);
    onChange(display);
    setIsOpen(false);
  };

  const showDropdown = isOpen && inputValue.length >= 1;

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (inputValue.length >= 1) setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="h-12 pl-8 text-base bg-transparent border-0 border-b border-border rounded-none focus:border-primary focus:ring-0 font-sans"
      />
      {showDropdown && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-elevated z-50 overflow-hidden max-h-72 overflow-y-auto"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm font-sans">Searching...</span>
            </div>
          ) : destinations.length > 0 ? (
            destinations.map((dest) => (
              <button
                key={dest.id}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-secondary/50 flex items-center gap-3 transition-colors border-b border-border/50 last:border-0"
                onMouseDown={() => handleSelect(dest)}
              >
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-sans text-sm text-foreground truncate">{dest.city}</p>
                    {dest.featured && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary font-sans tracking-wide uppercase">Popular</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{dest.country}{dest.region ? ` • ${dest.region}` : ''}</p>
                </div>
              </button>
            ))
          ) : inputValue.length >= 1 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm font-sans">
              No destinations found
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

// Featured destinations with editorial imagery
const featuredDestinations = [
  { name: 'Kyoto', country: 'Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600' },
  { name: 'Santorini', country: 'Greece', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600' },
  { name: 'Marrakech', country: 'Morocco', image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=600' },
  { name: 'Bali', country: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600' },
  { name: 'Amalfi', country: 'Italy', image: 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=600' },
  { name: 'Reykjavik', country: 'Iceland', image: 'https://images.unsplash.com/photo-1520769945061-0a448c463865?w=600' },
];

export default function Start() {
  const { state: plannerState, setBasics } = useTripPlanner();
  const navigate = useNavigate();
  
  const [origin, setOrigin] = useState(plannerState.basics.originCity || '');
  const [destination, setDestination] = useState(plannerState.basics.destination || '');
  const [startDate, setStartDate] = useState<Date | undefined>(
    plannerState.basics.startDate ? new Date(plannerState.basics.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    plannerState.basics.endDate ? new Date(plannerState.basics.endDate) : undefined
  );
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || 2);
  const [budget, setBudget] = useState<string>(plannerState.basics.budgetTier || '');
  const today = startOfToday();

  useEffect(() => {
    if (plannerState.basics.destination && plannerState.basics.destination !== destination) {
      setDestination(plannerState.basics.destination);
    }
    if (plannerState.basics.originCity && plannerState.basics.originCity !== origin) {
      setOrigin(plannerState.basics.originCity);
    }
    if (plannerState.basics.startDate) {
      const contextDate = new Date(plannerState.basics.startDate);
      if (!startDate || contextDate.getTime() !== startDate.getTime()) {
        setStartDate(contextDate);
      }
    }
    if (plannerState.basics.endDate) {
      const contextDate = new Date(plannerState.basics.endDate);
      if (!endDate || contextDate.getTime() !== endDate.getTime()) {
        setEndDate(contextDate);
      }
    }
    if (plannerState.basics.travelers && plannerState.basics.travelers !== travelers) {
      setTravelers(plannerState.basics.travelers);
    }
    if (plannerState.basics.budgetTier && plannerState.basics.budgetTier !== budget) {
      setBudget(plannerState.basics.budgetTier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerState.basics]);

  const handleStart = () => {
    if (!destination || !startDate || !endDate) return;

    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    setBasics({
      destination,
      startDate: start,
      endDate: end,
      travelers,
      originCity: origin,
      budgetTier: budget || 'moderate',
    });

    const params = new URLSearchParams();
    params.set('destination', destination);
    if (origin) params.set('origin', origin);
    params.set('startDate', start);
    params.set('endDate', end);
    params.set('travelers', String(travelers));
    if (budget) params.set('budget', budget);

    navigate(`${ROUTES.PLANNER.FLIGHT}?${params.toString()}`);
  };

  const selectDestination = (dest: typeof featuredDestinations[0]) => {
    setDestination(`${dest.name}, ${dest.country}`);
  };

  const isFormValid = destination && startDate && endDate;

  return (
    <MainLayout>
      <Head
        title="Start Planning | Voyance"
        description="Start planning your dream trip with Voyance's AI-powered travel planner."
      />
      
      {/* Hero Section - Editorial Magazine Style */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate/40 via-slate/60 to-slate/90" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-8 md:px-16 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-white"
          >
            {/* Eyebrow */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-8 h-px bg-white/40" />
              <span className="text-xs tracking-[0.3em] uppercase text-white/60 font-sans">
                Plan Your Journey
              </span>
              <div className="w-8 h-px bg-white/40" />
            </div>
            
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-normal mb-6 leading-[0.95]">
              Where to <em className="font-normal italic">next?</em>
            </h1>
            
            <p className="text-lg text-white/70 font-sans font-light leading-relaxed max-w-lg mx-auto">
              Tell us your destination and dates. We'll craft an itinerary that's thoughtfully planned down to every detail.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Planning Form - Centered Below Hero */}
      <section className="relative -mt-16 pb-24">
        <div className="max-w-2xl mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-card p-8 md:p-10 shadow-elevated rounded-xl border border-border"
          >
            <div className="space-y-6">
              {/* Origin */}
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
                  Departing from
                </label>
                <AirportAutocomplete
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Your city or airport"
                />
              </div>
              
              {/* Destination */}
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
                  Destination
                </label>
                <AirportAutocomplete
                  value={destination}
                  onChange={setDestination}
                  placeholder="Where do you want to go?"
                />
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
                    Departure
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full h-12 justify-between text-left font-sans border-0 border-b border-border rounded-none hover:bg-transparent hover:border-primary px-0",
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
                        onSelect={(date) => {
                          setStartDate(date);
                          if (date && (!endDate || isBefore(endDate, date))) {
                            setEndDate(addDays(date, 7));
                          }
                        }}
                        disabled={(date) => isBefore(date, today)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
                    Return
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full h-12 justify-between text-left font-sans border-0 border-b border-border rounded-none hover:bg-transparent hover:border-primary px-0",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        {endDate ? format(endDate, "MMM d, yyyy") : "Select date"}
                        <CalendarIcon className="h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => 
                          isBefore(date, today) || 
                          (startDate ? isBefore(date, startDate) : false)
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Travelers & Budget Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
                    Travelers
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full h-12 justify-between text-left font-sans border-0 border-b border-border rounded-none hover:bg-transparent hover:border-primary px-0"
                      >
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {travelers} {travelers === 1 ? 'guest' : 'guests'}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-4" align="start">
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-sm">Travelers</span>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setTravelers(Math.max(1, travelers - 1))}
                            disabled={travelers <= 1}
                          >
                            -
                          </Button>
                          <span className="w-6 text-center font-sans">{travelers}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setTravelers(Math.min(10, travelers + 1))}
                            disabled={travelers >= 10}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
                    Budget
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full h-12 justify-between text-left font-sans border-0 border-b border-border rounded-none hover:bg-transparent hover:border-primary px-0",
                          !budget && "text-muted-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          {budget ? budget.charAt(0).toUpperCase() + budget.slice(1) : 'Any'}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <div className="space-y-1">
                        {[
                          { value: '', label: 'Any budget' },
                          { value: 'budget', label: 'Budget' },
                          { value: 'moderate', label: 'Moderate' },
                          { value: 'premium', label: 'Premium' },
                          { value: 'luxury', label: 'Luxury' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setBudget(option.value)}
                            className={cn(
                              'w-full px-3 py-2 text-left text-sm font-sans rounded transition-colors',
                              budget === option.value ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* CTA Button */}
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!isFormValid}
                className="w-full h-14 text-base font-sans font-medium tracking-wide mt-4"
              >
                Plan My Trip
                <ArrowRight className="ml-3 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Destinations - Editorial Grid */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-8 md:px-16">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-start justify-between mb-12"
          >
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-8 h-px bg-primary" />
                <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
                  Inspiration
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-serif font-normal text-foreground">
                Popular <em className="font-normal">destinations</em>
              </h2>
            </div>
          </motion.div>

          {/* Destinations Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredDestinations.map((dest, index) => (
              <motion.button
                key={dest.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                onClick={() => selectDestination(dest)}
                className="group relative aspect-[3/4] overflow-hidden"
              >
                <img 
                  src={dest.image} 
                  alt={dest.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-left text-white">
                  <p className="font-serif text-lg">{dest.name}</p>
                  <p className="text-xs text-white/70 font-sans tracking-wide">{dest.country}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Why Voyance - Editorial Style */}
      <section className="py-24 bg-secondary/30 border-t border-border">
        <div className="max-w-6xl mx-auto px-8 md:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-8 h-px bg-primary" />
              <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
                Why Voyance
              </span>
              <div className="w-8 h-px bg-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-normal text-foreground">
              Travel planning, <em className="font-normal">refined</em>
            </h2>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-px bg-border">
            {[
              {
                number: '01',
                title: 'Intelligent Personalization',
                description: 'Our AI learns your preferences to craft itineraries tailored specifically to how you travel.',
              },
              {
                number: '02',
                title: 'Curated Experiences',
                description: 'Hand-picked activities, restaurants, and hidden gems recommended by local experts.',
              },
              {
                number: '03',
                title: 'Seamless Booking',
                description: 'Book flights, hotels, and activities all in one place with best-price guarantees.',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-background p-10 relative group"
              >
                <span className="text-6xl font-serif text-muted/15 absolute top-6 right-6 group-hover:text-primary/15 transition-colors">
                  {feature.number}
                </span>
                <h3 className="text-xl font-serif text-foreground mb-4">{feature.title}</h3>
                <p className="text-sm text-muted-foreground font-sans leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}