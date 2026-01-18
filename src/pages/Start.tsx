import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalendarIcon, Users, ArrowRight, Plane, Loader2, Sparkles, Globe, Star } from 'lucide-react';
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

// Airport Autocomplete
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
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <Plane className="h-5 w-5 text-primary/60" />
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
        className="h-14 pl-12 text-lg bg-background border-border focus:border-primary"
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

// Destination Autocomplete
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
      <div className="absolute left-4 top-1/2 -translate-y-1/2">
        <MapPin className="h-5 w-5 text-primary/60" />
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
        className="h-14 pl-12 text-lg bg-background border-border focus:border-primary"
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
  { name: 'Santorini', country: 'Greece', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400', tagline: 'Iconic sunsets' },
  { name: 'Kyoto', country: 'Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400', tagline: 'Ancient temples' },
  { name: 'Marrakech', country: 'Morocco', image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400', tagline: 'Vibrant souks' },
  { name: 'Bali', country: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400', tagline: 'Tropical paradise' },
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
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              AI-Powered Trip Planning
            </motion.div>
            
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Your Next Adventure
              <br />
              <span className="text-primary">Starts Here</span>
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Tell us where you dream of going. We'll craft an itinerary as unique as you are.
            </p>
          </motion.div>

          {/* Planning Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-card/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-8 border border-border"
          >
            <div className="grid md:grid-cols-2 gap-5 mb-5">
              {/* Origin */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Flying from
                </label>
                <AirportAutocomplete
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Your departure city"
                />
              </div>
              
              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Departure
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-between text-left font-normal",
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
              
              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Return
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-between text-left font-normal",
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

              {/* Travelers */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Travelers
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-14 justify-between text-left font-normal"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary/60" />
                        {travelers} {travelers === 1 ? 'Traveler' : 'Travelers'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-4" align="start">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Travelers</span>
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
                        <span className="w-6 text-center font-medium">{travelers}</span>
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
              
              {/* Start Button */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-transparent mb-2">Action</label>
                <Button
                  size="lg"
                  onClick={handleStart}
                  disabled={!isFormValid}
                  className="w-full h-14 text-lg gap-2"
                >
                  Start Planning
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Inspiration */}
            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">Need inspiration? Try one of these:</p>
              <div className="flex flex-wrap gap-3">
                {inspirationDestinations.map((dest) => (
                  <button
                    key={dest.name}
                    onClick={() => selectInspiration(dest)}
                    className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <img 
                      src={dest.image} 
                      alt={dest.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">{dest.name}</p>
                      <p className="text-xs text-muted-foreground">{dest.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Voyance Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Why Voyance?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We combine AI intelligence with human expertise to create unforgettable travel experiences
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Sparkles,
                title: 'AI-Powered Personalization',
                description: 'Our AI learns your preferences and crafts itineraries tailored specifically to you.',
              },
              {
                icon: Globe,
                title: 'Curated Experiences',
                description: 'Hand-picked activities, restaurants, and hidden gems recommended by local experts.',
              },
              {
                icon: Star,
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
                className="text-center p-8 rounded-2xl bg-card border border-border"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
