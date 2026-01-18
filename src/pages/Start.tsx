import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalendarIcon, Users, ArrowRight, Plane, ChevronDown, Loader2 } from 'lucide-react';
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
  getMajorAirports,
  getFeaturedDestinations,
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

// Airport Autocomplete - connects to Neon DB
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

  // Only search when user has typed something
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

  // Only show dropdown when user is typing and has results
  const showDropdown = isOpen && inputValue.length >= 1;

  return (
    <div className="relative">
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
        className="h-14 text-lg bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/40"
      />
      {showDropdown && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : airports.length > 0 ? (
            airports.map((airport) => (
              <button
                key={airport.id}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-primary/5 flex items-center gap-3 transition-colors border-b border-border/50 last:border-0"
                onMouseDown={() => handleSelect(airport)}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{airport.code}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{airport.name}</p>
                  <p className="text-sm text-muted-foreground">{airport.city}, {airport.country}</p>
                </div>
              </button>
            ))
          ) : inputValue.length >= 1 ? (
            <div className="px-4 py-6 text-center text-muted-foreground">
              No airports found for "{inputValue}"
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

// Destination Autocomplete - connects to Neon DB
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

  // Only search when user has typed something
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

  // Only show dropdown when user is typing and has results
  const showDropdown = isOpen && inputValue.length >= 1;

  return (
    <div className="relative">
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
        className="h-14 text-lg bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/40"
      />
      {showDropdown && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : destinations.length > 0 ? (
            destinations.map((dest) => (
              <button
                key={dest.id}
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-primary/5 flex items-center gap-3 transition-colors border-b border-border/50 last:border-0"
                onMouseDown={() => handleSelect(dest)}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{dest.city}</p>
                    {dest.featured && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Popular</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{dest.country}{dest.region ? ` • ${dest.region}` : ''}</p>
                </div>
              </button>
            ))
          ) : inputValue.length >= 1 ? (
            <div className="px-4 py-6 text-center text-muted-foreground">
              No destinations found for "{inputValue}"
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

// Inspiration destinations
const inspirationDestinations = [
  { name: 'Santorini', country: 'Greece', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400' },
  { name: 'Kyoto', country: 'Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400' },
  { name: 'Marrakech', country: 'Morocco', image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400' },
  { name: 'Bali', country: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400' },
];

export default function Start() {
  const { setBasics } = useTripPlanner();
  const navigate = useNavigate();
  
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [travelers, setTravelers] = useState(2);

  const today = startOfToday();

  const handleStart = () => {
    if (!destination || !startDate || !endDate) return;
    
    setBasics({
      destination,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      travelers,
      originCity: origin,
    });
    
    navigate(ROUTES.PLANNER.ROOT);
  };

  const selectInspiration = (dest: typeof inspirationDestinations[0]) => {
    setDestination(`${dest.name}, ${dest.country}`);
  };

  const isFormValid = destination && startDate && endDate;

  return (
    <MainLayout>
      <Head
        title="Start Planning | Voyance"
        description="Start planning your dream trip with Voyance's AI-powered travel planner."
      />
      
      {/* Hero with background */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Your Next Adventure
              <br />
              <span className="text-primary">Starts Here</span>
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Tell us where you dream of going. We'll craft an itinerary as unique as you are.
            </p>
          </motion.div>

          {/* Planning Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/20"
          >
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Origin */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  <Plane className="inline h-4 w-4 mr-1" />
                  Flying from
                </label>
                <AirportAutocomplete
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Your departure city or airport"
                />
              </div>
              
              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Flying to
                </label>
                <DestinationAutocomplete
                  value={destination}
                  onChange={setDestination}
                  placeholder="Where do you want to explore?"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Departure
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-between text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                        !startDate && "text-white/60"
                      )}
                    >
                      {startDate ? format(startDate, "MMM d") : "When?"}
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
              
              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Return
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-between text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                        !endDate && "text-white/60"
                      )}
                    >
                      {endDate ? format(endDate, "MMM d") : "When?"}
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

              {/* Travelers */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Travelers
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-14 justify-between text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {travelers} {travelers === 1 ? 'Traveler' : 'Travelers'}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48" align="start">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Travelers</span>
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => setTravelers(Math.max(1, travelers - 1))}
                        >
                          -
                        </Button>
                        <span className="w-6 text-center font-semibold">{travelers}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => setTravelers(Math.min(12, travelers + 1))}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Submit */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-white/80 mb-2 opacity-0">
                  Action
                </label>
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="w-full h-14 text-base font-semibold gap-2"
                  disabled={!isFormValid}
                >
                  Let's Go
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <p className="text-center text-white/50 text-sm">
              No account needed. Save your trip anytime.
            </p>
          </motion.div>

          {/* Inspiration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12"
          >
            <p className="text-center text-white/60 text-sm mb-4">Need inspiration?</p>
            <div className="flex flex-wrap justify-center gap-3">
              {inspirationDestinations.map((dest) => (
                <button
                  key={dest.name}
                  onClick={() => selectInspiration(dest)}
                  className="group relative overflow-hidden rounded-full bg-white/10 hover:bg-white/20 transition-all border border-white/20 hover:border-white/40"
                >
                  <div className="flex items-center gap-2 px-4 py-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden">
                      <img src={dest.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-white text-sm font-medium">{dest.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ChevronDown className="h-6 w-6 text-white/40" />
        </motion.div>
      </section>

      {/* Why Voyance - Quick value props */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { 
                title: 'Personalized', 
                desc: 'AI that learns your style and builds trips around your preferences.' 
              },
              { 
                title: 'Effortless', 
                desc: 'From flights to activities, everything curated in one place.' 
              },
              { 
                title: 'Flexible', 
                desc: 'Adjust anything, anytime. Your trip, your way.' 
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <h3 className="text-xl font-display font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}