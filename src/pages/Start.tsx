import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalendarIcon, Users, Plane, Loader2, UserPlus } from 'lucide-react';
import { format, addDays, isBefore, startOfToday } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { 
  searchAirports, 
  formatAirportDisplay,
  type Airport,
} from '@/services/locationSearchAPI';
import GuestLinkModal, { type LinkedGuest } from '@/components/planner/GuestLinkModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Airport Autocomplete - Editorial Style with Metro Area Grouping
function AirportAutocomplete({
  value,
  onChange,
  placeholder,
  icon: Icon = Plane,
}: {
  value: string;
  onChange: (value: string, metroInfo?: { name: string; codes: string[] }) => void;
  placeholder: string;
  icon?: typeof Plane;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [metroInfo, setMetroInfo] = useState<{ name: string; codes: string[] } | null>(null);

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
      import('@/services/locationSearchAPI').then(({ getMetroAreaInfo }) => {
        const metro = getMetroAreaInfo(debouncedQuery);
        setMetroInfo(metro);
      });
      searchAirports(debouncedQuery, 12)
        .then(setAirports)
        .finally(() => setLoading(false));
    } else {
      setAirports([]);
      setMetroInfo(null);
    }
  }, [debouncedQuery]);

  const handleSelectMetro = () => {
    if (!metroInfo) return;
    const display = `${metroInfo.name} (All airports)`;
    setInputValue(display);
    onChange(display, metroInfo);
    setIsOpen(false);
  };

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
        <Icon className="h-4 w-4 text-muted-foreground" />
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
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-elevated z-50 overflow-hidden max-h-80 overflow-y-auto rounded-xl"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm font-sans">Searching airports...</span>
            </div>
          ) : airports.length > 0 ? (
            <>
              {/* Metro area "All airports" option */}
              {metroInfo && airports.length > 1 && (
                <>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-primary/10 flex items-center gap-3 transition-colors bg-primary/5 border-b border-primary/20"
                    onMouseDown={handleSelectMetro}
                  >
                    <span className="text-xs font-bold text-primary tracking-wide w-10">ALL</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-sm font-medium text-primary">{metroInfo.name} (All airports)</p>
                      <p className="text-xs text-muted-foreground">Search {metroInfo.codes.join(', ')} for best prices</p>
                    </div>
                  </button>
                  <div className="px-4 py-1.5 bg-muted/50 border-b border-border">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Or choose specific airport</span>
                  </div>
                </>
              )}
              {airports.map((airport, idx) => (
                <button
                  key={airport.id}
                  type="button"
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-secondary/50 flex items-center gap-3 transition-colors",
                    idx < airports.length - 1 && "border-b border-border/50"
                  )}
                  onMouseDown={() => handleSelect(airport)}
                >
                  <span className="text-xs font-semibold text-primary tracking-wide w-10">{airport.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm text-foreground truncate">{airport.name}</p>
                    <p className="text-xs text-muted-foreground">{airport.city}, {airport.country}</p>
                  </div>
                </button>
              ))}
            </>
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

// Trip type options - text only, no icons
const tripTypes = [
  { id: 'romantic', label: 'Romantic', description: 'Couples getaway' },
  { id: 'business', label: 'Business', description: 'Work travel' },
  { id: 'adventure', label: 'Adventure', description: 'Explore & discover' },
  { id: 'leisure', label: 'Leisure', description: 'Relax & unwind' },
];

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
  const { state: plannerState, setBasics, saveTrip } = useTripPlanner();
  const { user } = useAuth();
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
  const [tripType, setTripType] = useState<string>('leisure');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerState.basics]);

  const handleStart = async () => {
    if (!destination || !startDate || !endDate) return;

    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    setBasics({
      destination,
      startDate: start,
      endDate: end,
      travelers,
      originCity: origin,
      budgetTier: 'moderate',
    });

    // Save trip to database before navigating
    if (user) {
      const tripId = await saveTrip();
      if (tripId) {
        console.log('[Start] Trip saved before navigation:', tripId);
        
        // Save linked guests as collaborators if we have a trip ID
        if (linkedGuests.length > 0) {
          for (const guest of linkedGuests) {
            if (guest.isVoyanceUser) {
              try {
                await supabase.from('trip_collaborators').insert({
                  trip_id: tripId,
                  user_id: guest.id,
                  permission: 'contributor',
                  invited_by: user.id,
                  accepted_at: new Date().toISOString(),
                });
              } catch (err) {
                console.error('[Start] Error adding collaborator:', err);
              }
            }
          }
          toast.success(`Trip saved with ${linkedGuests.length} companion${linkedGuests.length > 1 ? 's' : ''}`);
        }
      }
    }

    const params = new URLSearchParams();
    params.set('destination', destination);
    if (origin) params.set('origin', origin);
    params.set('startDate', start);
    params.set('endDate', end);
    params.set('travelers', String(travelers));
    params.set('tripType', tripType);

    navigate(`${ROUTES.PLANNER.FLIGHT}?${params.toString()}`);
  };

  // Guest link modal state
  const [guestModalOpen, setGuestModalOpen] = useState(false);

  const handleAddGuest = () => {
    setGuestModalOpen(true);
  };

  const handleGuestsConfirmed = (guests: LinkedGuest[]) => {
    setLinkedGuests(guests);
  };

  const isFormValid = destination && startDate && endDate;


  return (
    <MainLayout>
      <Head
        title="Start Planning | Voyance"
        description="Start planning your dream trip with Voyance's AI-powered travel planner."
      />
      
      {/* Hero Section - Full width background image */}
      <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate/40 via-slate/60 to-background" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-8 md:px-16 py-16 text-center">
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
            
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal mb-4 leading-[0.95]">
              Where to <em className="font-normal italic">next?</em>
            </h1>
            
            <p className="text-base text-white/70 font-sans font-light leading-relaxed max-w-lg mx-auto">
              Tell us your destination and dates. We'll craft an itinerary thoughtfully planned to every detail.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Planning Form - Centered Below Hero */}
      <section className="relative pb-16 -mt-8">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-card p-6 md:p-8 shadow-elevated rounded-2xl border border-border"
          >
            <div className="space-y-5">
              {/* Origin */}
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-2">
                  Departing from
                </label>
                <AirportAutocomplete
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Your city or airport"
                  icon={Plane}
                />
              </div>
              
              {/* Destination */}
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-2">
                  Destination
                </label>
                <AirportAutocomplete
                  value={destination}
                  onChange={setDestination}
                  placeholder="Where do you want to go?"
                  icon={MapPin}
                />
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-2">
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
                  <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-2">
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
                        disabled={(date) => startDate ? isBefore(date, startDate) : isBefore(date, today)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Travelers Row */}
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-2">
                  Travelers
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2 border-b border-border pb-2 flex-1">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTravelers(num)}
                          className={cn(
                            "w-10 h-10 rounded-full border transition-all font-sans text-sm",
                            travelers === num
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {num}
                        </button>
                      ))}
                      <span className="text-sm text-muted-foreground ml-2">
                        {travelers > 1 && (
                          <button 
                            onClick={handleAddGuest}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            {linkedGuests.length > 0 
                              ? `${linkedGuests.length} linked` 
                              : 'Link guests'}
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip Type Selection */}
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-3">
                  Trip Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {tripTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setTripType(type.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all min-h-[60px]",
                        tripType === type.id
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>


              {/* CTA Button */}
              <Button
                onClick={handleStart}
                disabled={!isFormValid}
                className="w-full h-14 text-base font-medium mt-2"
                size="lg"
              >
                Plan My Trip
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Popular Destinations Section */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-2">
              Popular Destinations
            </h2>
            <p className="text-muted-foreground">
              Get inspired by trending travel destinations
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredDestinations.map((dest, index) => (
              <motion.button
                key={dest.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setDestination(`${dest.name}, ${dest.country}`)}
                className="group relative aspect-[4/5] rounded-xl overflow-hidden"
              >
                <img
                  src={dest.image}
                  alt={dest.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate/80 via-slate/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-left">
                  <p className="font-medium text-sm">{dest.name}</p>
                  <p className="text-xs text-white/70">{dest.country}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Guest Link Modal */}
      <GuestLinkModal
        open={guestModalOpen}
        onOpenChange={setGuestModalOpen}
        maxGuests={travelers}
        currentTravelers={travelers}
        onGuestsConfirmed={handleGuestsConfirmed}
      />
    </MainLayout>
  );
}
