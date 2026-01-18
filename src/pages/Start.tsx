import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalendarIcon, Users, ArrowRight, Sparkles, Plane, ArrowRightLeft } from 'lucide-react';
import { format, addDays, isBefore, startOfToday } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { ROUTES } from '@/config/routes';
import { destinations } from '@/lib/destinations';
import { cn } from '@/lib/utils';

// Create searchable locations from destinations
const searchableLocations = destinations.map(d => ({
  id: d.id,
  city: d.city,
  country: d.country,
  display: `${d.city}, ${d.country}`,
  type: 'destination' as const,
}));

// Add some common origin cities/airports
const originCities = [
  { id: 'atlanta', city: 'Atlanta', country: 'United States', display: 'Atlanta, GA (ATL)', type: 'origin' as const },
  { id: 'los-angeles', city: 'Los Angeles', country: 'United States', display: 'Los Angeles, CA (LAX)', type: 'origin' as const },
  { id: 'new-york-jfk', city: 'New York', country: 'United States', display: 'New York, NY (JFK)', type: 'origin' as const },
  { id: 'chicago', city: 'Chicago', country: 'United States', display: 'Chicago, IL (ORD)', type: 'origin' as const },
  { id: 'miami', city: 'Miami', country: 'United States', display: 'Miami, FL (MIA)', type: 'origin' as const },
  { id: 'san-francisco', city: 'San Francisco', country: 'United States', display: 'San Francisco, CA (SFO)', type: 'origin' as const },
  { id: 'seattle', city: 'Seattle', country: 'United States', display: 'Seattle, WA (SEA)', type: 'origin' as const },
  { id: 'boston', city: 'Boston', country: 'United States', display: 'Boston, MA (BOS)', type: 'origin' as const },
  { id: 'denver', city: 'Denver', country: 'United States', display: 'Denver, CO (DEN)', type: 'origin' as const },
  { id: 'dallas', city: 'Dallas', country: 'United States', display: 'Dallas, TX (DFW)', type: 'origin' as const },
  { id: 'phoenix', city: 'Phoenix', country: 'United States', display: 'Phoenix, AZ (PHX)', type: 'origin' as const },
  { id: 'london', city: 'London', country: 'United Kingdom', display: 'London, UK (LHR)', type: 'origin' as const },
  { id: 'toronto', city: 'Toronto', country: 'Canada', display: 'Toronto, ON (YYZ)', type: 'origin' as const },
  ...searchableLocations.map(l => ({ ...l, type: 'origin' as const, display: l.display })),
];

interface LocationSuggestion {
  id: string;
  city: string;
  country: string;
  display: string;
  type: 'origin' | 'destination';
}

function LocationAutocomplete({
  value,
  onChange,
  placeholder,
  locations,
  icon: Icon,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  locations: LocationSuggestion[];
  icon: typeof MapPin;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const filteredLocations = useMemo(() => {
    if (!inputValue.trim()) return locations.slice(0, 8);
    const search = inputValue.toLowerCase();
    return locations
      .filter(l => 
        l.city.toLowerCase().includes(search) || 
        l.country.toLowerCase().includes(search) ||
        l.display.toLowerCase().includes(search)
      )
      .slice(0, 8);
  }, [inputValue, locations]);

  const handleSelect = (location: LocationSuggestion) => {
    setInputValue(location.display);
    onChange(location.display);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="pl-11 h-12 text-base"
      />
      {isOpen && filteredLocations.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
          {filteredLocations.map((location) => (
            <button
              key={`${location.type}-${location.id}`}
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
              onMouseDown={() => handleSelect(location)}
            >
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-sm">{location.city}</p>
                <p className="text-xs text-muted-foreground">{location.country}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const isFormValid = destination && startDate && endDate;

  return (
    <MainLayout>
      <Head
        title="Start Planning | Voyance"
        description="Start planning your dream trip with Voyance's AI-powered travel planner."
      />
      
      {/* Hero */}
      <section className="pt-32 pb-12 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Planning
            </div>
            
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Where To Next?
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Tell us about your dream trip and we'll create a personalized itinerary just for you.
            </p>
          </motion.div>
        </div>
      </section>
      
      {/* Form */}
      <section className="py-12">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm"
          >
            <div className="space-y-6">
              {/* Origin & Destination */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Plane className="h-4 w-4" />
                  Flight Route
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      From
                    </label>
                    <LocationAutocomplete
                      value={origin}
                      onChange={setOrigin}
                      placeholder="Departure city"
                      locations={originCities}
                      icon={Plane}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      To
                    </label>
                    <LocationAutocomplete
                      value={destination}
                      onChange={setDestination}
                      placeholder="Where do you want to go?"
                      locations={searchableLocations}
                      icon={MapPin}
                    />
                  </div>
                </div>
              </div>
              
              {/* Dates */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <CalendarIcon className="h-4 w-4" />
                  Travel Dates
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Departure
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-12 justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            setStartDate(date);
                            // Auto-set end date if not set or if it's before new start date
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
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Return
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-12 justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "MMM d, yyyy") : "Select date"}
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
              </div>
              
              {/* Travelers */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  Travelers
                </div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Number of travelers
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setTravelers(Math.max(1, travelers - 1))}
                    disabled={travelers <= 1}
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-semibold text-lg">{travelers}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setTravelers(Math.min(20, travelers + 1))}
                    disabled={travelers >= 20}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground ml-2">
                    {travelers === 1 ? 'traveler' : 'travelers'}
                  </span>
                </div>
              </div>
              
              {/* Submit */}
              <Button
                onClick={handleStart}
                size="lg"
                className="w-full gap-2 h-14 text-base"
                disabled={!isFormValid}
              >
                Start Planning My Trip
                <ArrowRight className="h-5 w-5" />
              </Button>
              
              <p className="text-center text-xs text-muted-foreground">
                No account required. Create an account later to save your trip.
              </p>
            </div>
          </motion.div>
          
          {/* Quick suggestions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-muted-foreground mb-4">Popular destinations</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Paris, France', 'Tokyo, Japan', 'Bali, Indonesia', 'Santorini, Greece'].map((dest) => (
                <button
                  key={dest}
                  onClick={() => setDestination(dest)}
                  className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors"
                >
                  {dest}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}