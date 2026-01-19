import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalendarIcon, Users, Plane, Loader2, UserPlus, DollarSign, Info, Sparkles } from 'lucide-react';
import { format, addDays, isBefore, startOfToday, parseISO } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

// Types for structured location data
interface LocationSelection {
  display: string;        // What user sees: "Paris" or "Atlanta (ATL)"
  cityName: string;       // Clean city name: "Paris", "Atlanta"
  airportCodes?: string[]; // All airport codes if metro area selected
  isMetroArea?: boolean;
}

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Airport/Destination Autocomplete - Forces selection of real cities
function AirportAutocomplete({
  value,
  onChange,
  placeholder,
  icon: Icon = Plane,
  required = false,
}: {
  value: string;
  onChange: (selection: LocationSelection) => void;
  placeholder: string;
  icon?: typeof Plane;
  required?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [metroInfo, setMetroInfo] = useState<{ name: string; codes: string[] } | null>(null);
  const [hasValidSelection, setHasValidSelection] = useState(!!value);

  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    if (value !== inputValue && value) {
      setInputValue(value);
      setHasValidSelection(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
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
    setInputValue(metroInfo.name);
    setHasValidSelection(true);
    onChange({
      display: metroInfo.name,
      cityName: metroInfo.name,
      airportCodes: metroInfo.codes,
      isMetroArea: true,
    });
    setIsOpen(false);
  };

  const handleSelect = (airport: Airport) => {
    const display = `${airport.city} (${airport.code})`;
    setInputValue(display);
    setHasValidSelection(true);
    onChange({
      display,
      cityName: airport.city,
      airportCodes: [airport.code],
      isMetroArea: false,
    });
    setIsOpen(false);
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setHasValidSelection(false);
    // Clear the selection when user types - forces them to pick from dropdown
    if (val.length === 0) {
      onChange({
        display: '',
        cityName: '',
        airportCodes: undefined,
        isMetroArea: false,
      });
    }
    setIsOpen(true);
  };

  const showDropdown = isOpen && inputValue.length >= 2;
  const showValidationHint = inputValue.length >= 2 && !hasValidSelection && !isOpen;

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (inputValue.length >= 2) setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className={cn(
          "h-12 pl-8 text-base bg-transparent border-0 border-b rounded-none focus:ring-0 font-sans",
          showValidationHint ? "border-amber-500" : "border-border focus:border-primary"
        )}
      />
      {showValidationHint && (
        <p className="text-xs text-amber-600 mt-1">Please select a city from the dropdown</p>
      )}
      {showDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-elevated z-50 overflow-hidden max-h-80 overflow-y-auto rounded-xl"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm font-sans">Searching...</span>
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
          ) : inputValue.length >= 2 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm font-sans">
              No cities or airports found for "{inputValue}"
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
  const [searchParams] = useSearchParams();
  
  // Check for mode and destination from query params
  const destinationFromQuery = searchParams.get('destination');
  const itineraryOnlyMode = searchParams.get('mode') === 'itinerary';
  
  // Structured location state - stores both display and data
  const [originSelection, setOriginSelection] = useState<LocationSelection>({
    display: plannerState.basics.originCity || '',
    cityName: plannerState.basics.originCity || '',
    airportCodes: undefined,
  });
  const [destinationSelection, setDestinationSelection] = useState<LocationSelection>(() => {
    // Priority: query param > context > empty
    const initialDestination = destinationFromQuery || plannerState.basics.destination || '';
    return {
      display: initialDestination,
      cityName: initialDestination,
      airportCodes: undefined,
    };
  });
  const [startDate, setStartDate] = useState<Date | undefined>(
    plannerState.basics.startDate ? parseISO(plannerState.basics.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    plannerState.basics.endDate ? parseISO(plannerState.basics.endDate) : undefined
  );
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || 2);
  const [tripType, setTripType] = useState<string>('leisure');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
  const [budgetAmount, setBudgetAmount] = useState<number | undefined>(plannerState.basics.budgetAmount);
  const [showBudget, setShowBudget] = useState(!!plannerState.basics.budgetAmount);
  const today = startOfToday();

  // Prefill origin city from user preferences (home_airport)
  useEffect(() => {
    const prefillHomeAirport = async () => {
      // Don't prefill if already set
      if (originSelection.cityName || !user) return;
      
      try {
        // First check user_preferences
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('home_airport')
          .eq('user_id', user.id)
          .single();
        
        if (prefs?.home_airport) {
          setOriginSelection({
            display: prefs.home_airport,
            cityName: prefs.home_airport,
            airportCodes: undefined,
          });
          return;
        }
        
        // Fallback to profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('home_airport')
          .eq('id', user.id)
          .single();
        
        if (profile?.home_airport) {
          setOriginSelection({
            display: profile.home_airport,
            cityName: profile.home_airport,
            airportCodes: undefined,
          });
        }
      } catch (err) {
        console.log('Could not prefill home airport:', err);
      }
    };
    
    prefillHomeAirport();
  }, [user, originSelection.cityName]);

  // Incremental save - debounced to avoid too many writes
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const saveIncrementally = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      // Only save if we have a valid destination selection (with airport codes)
      const hasValidSelection = destinationSelection.cityName && destinationSelection.airportCodes?.length;
      if (hasValidSelection && user) {
        // Determine budget tier from amount
        const getBudgetTier = (amount?: number): string => {
          if (!amount) return 'moderate';
          if (amount < 500) return 'budget';
          if (amount < 1500) return 'moderate';
          if (amount < 3000) return 'premium';
          return 'luxury';
        };
        
        const basics = {
          destination: destinationSelection.cityName, // Clean city name for UX
          originCity: originSelection.cityName,
          startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
          endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
          travelers,
          tripType: tripType as 'solo' | 'couple' | 'family' | 'group',
          budgetTier: getBudgetTier(budgetAmount),
          budgetAmount,
        };
        setBasics(basics);
        
        // Save to database incrementally
        try {
          await saveTrip();
          console.log('[Start] Incremental save completed');
        } catch (err) {
          console.error('[Start] Incremental save failed:', err);
        }
      }
    }, 1500); // Debounce 1.5 seconds
  }, [destinationSelection, originSelection, startDate, endDate, travelers, tripType, budgetAmount, user, setBasics, saveTrip]);

  // Trigger incremental save when data changes
  useEffect(() => {
    if (destinationSelection.cityName) {
      saveIncrementally();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [destinationSelection, originSelection, startDate, endDate, travelers, tripType, budgetAmount, saveIncrementally]);

  useEffect(() => {
    if (plannerState.basics.destination && plannerState.basics.destination !== destinationSelection.cityName) {
      setDestinationSelection({
        display: plannerState.basics.destination,
        cityName: plannerState.basics.destination,
        airportCodes: undefined,
      });
    }
    if (plannerState.basics.originCity && plannerState.basics.originCity !== originSelection.cityName) {
      setOriginSelection({
        display: plannerState.basics.originCity,
        cityName: plannerState.basics.originCity,
        airportCodes: undefined,
      });
    }
    if (plannerState.basics.startDate) {
      const contextDate = parseISO(plannerState.basics.startDate);
      if (!startDate || contextDate.getTime() !== startDate.getTime()) {
        setStartDate(contextDate);
      }
    }
    if (plannerState.basics.endDate) {
      const contextDate = parseISO(plannerState.basics.endDate);
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
    // Validate: destination must be a real selection (has airport codes), not just typed text
    const hasValidDestination = destinationSelection.cityName && destinationSelection.airportCodes?.length;
    if (!hasValidDestination || !startDate || !endDate) {
      if (!hasValidDestination && destinationSelection.display) {
        toast.error('Please select a destination from the dropdown');
      }
      return;
    }

    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');

    // Determine budget tier from amount
    const getBudgetTier = (amount?: number): string => {
      if (!amount) return 'moderate';
      if (amount < 500) return 'budget';
      if (amount < 1500) return 'moderate';
      if (amount < 3000) return 'premium';
      return 'luxury';
    };

    // Store clean city name for UX, airport codes in metadata for API calls
    setBasics({
      destination: destinationSelection.cityName, // Clean name: "Paris" not "Paris (CDG)"
      startDate: start,
      endDate: end,
      travelers,
      originCity: originSelection.cityName,
      budgetTier: getBudgetTier(budgetAmount),
      budgetAmount,
    });

    // Save trip to database before navigating
    if (user) {
      const tripId = await saveTrip();
      if (tripId) {
        console.log('[Start] Trip saved before navigation:', tripId);
        
        // Store airport codes and budget in trip metadata for flight search
        try {
          await supabase.from('trips').update({
            metadata: {
              destinationAirportCodes: destinationSelection.airportCodes,
              originAirportCodes: originSelection.airportCodes,
              isDestinationMetro: destinationSelection.isMetroArea,
              isOriginMetro: originSelection.isMetroArea,
              budgetAmount: budgetAmount,
            },
          }).eq('id', tripId);
        } catch (err) {
          console.error('[Start] Error saving trip metadata:', err);
        }
        
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
    params.set('destination', destinationSelection.cityName);
    if (originSelection.cityName) params.set('origin', originSelection.cityName);
    // Also pass airport codes for flight search
    if (destinationSelection.airportCodes) {
      params.set('destAirports', destinationSelection.airportCodes.join(','));
    }
    if (originSelection.airportCodes) {
      params.set('originAirports', originSelection.airportCodes.join(','));
    }
    params.set('startDate', start);
    params.set('endDate', end);
    params.set('travelers', String(travelers));
    params.set('tripType', tripType);
    if (budgetAmount) {
      params.set('budget', String(budgetAmount));
    }

    // If in itinerary-only mode, skip to itinerary generation
    if (itineraryOnlyMode) {
      const tripId = await saveTrip();
      if (tripId) {
        navigate(`/trip/${tripId}?generate=true`);
      }
      return;
    }

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

  const isFormValid = destinationSelection.cityName && startDate && endDate;


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
                  value={originSelection.display}
                  onChange={setOriginSelection}
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
                  value={destinationSelection.display}
                  onChange={setDestinationSelection}
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
                          console.log('[Calendar] Start date selected:', date, 'ISO:', date?.toISOString(), 'Local:', date?.toLocaleDateString());
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
                        onSelect={(date) => {
                          console.log('[Calendar] End date selected:', date, 'ISO:', date?.toISOString(), 'Local:', date?.toLocaleDateString());
                          setEndDate(date);
                        }}
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

              {/* Optional Budget Section - Collapsible */}
              <Collapsible open={showBudget} onOpenChange={setShowBudget}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>{showBudget ? 'Hide budget options' : 'Set a budget (optional)'}</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans mb-2">
                      Budget Per Person (USD)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="e.g. 2000"
                        value={budgetAmount || ''}
                        onChange={(e) => setBudgetAmount(e.target.value ? Number(e.target.value) : undefined)}
                        className="h-12 pl-9 text-base"
                        min={0}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Your per-person budget for flights + hotel. We'll find options within this range for each traveler.
                    </p>
                  </div>
                  
                  {/* Budget disclaimer for low amounts */}
                  {budgetAmount && budgetAmount < 500 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        For budget trips, we'll prioritize the cheapest options which may include layovers, alternative airports, and basic accommodations.
                      </p>
                    </div>
                  )}
                  
                  {/* Quick budget presets */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Budget', min: 0, max: 500, display: 'Under $500' },
                      { label: 'Moderate', min: 500, max: 1500, display: '$500–$1,500' },
                      { label: 'Premium', min: 1500, max: 3000, display: '$1,500–$3,000' },
                      { label: 'Luxury', min: 3000, max: 10000, display: '$3,000+' },
                    ].map((preset) => {
                      // Check if current budget falls within this range
                      const isInRange = budgetAmount !== undefined && 
                        budgetAmount >= preset.min && 
                        (preset.max === 10000 ? true : budgetAmount <= preset.max);
                      
                      // Set midpoint of range when clicked (or min for budget tier)
                      const targetAmount = preset.label === 'Budget' 
                        ? 500 
                        : preset.label === 'Luxury' 
                          ? 5000 
                          : Math.round((preset.min + preset.max) / 2);
                      
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setBudgetAmount(targetAmount)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                            isInRange
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* CTA Buttons */}
              <div className="space-y-3 mt-2">
                <Button
                  onClick={handleStart}
                  disabled={!isFormValid}
                  className="w-full h-14 text-base font-medium"
                  size="lg"
                >
                  {itineraryOnlyMode ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate My Itinerary
                    </>
                  ) : (
                    'Plan My Trip'
                  )}
                </Button>
                
                {/* Skip to Itinerary Option (only show if not already in itinerary mode) */}
                {!itineraryOnlyMode && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!isFormValid) return;
                      const start = format(startDate!, 'yyyy-MM-dd');
                      const end = format(endDate!, 'yyyy-MM-dd');
                      
                      setBasics({
                        destination: destinationSelection.cityName,
                        startDate: start,
                        endDate: end,
                        travelers,
                        originCity: originSelection.cityName,
                        budgetTier: 'moderate',
                      });
                      
                      const tripId = await saveTrip();
                      if (tripId) {
                        navigate(`/trip/${tripId}?generate=true`);
                      } else {
                        toast.error('Please sign in to generate an itinerary');
                      }
                    }}
                    disabled={!isFormValid}
                    className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />
                    Skip flights & hotels — just build my itinerary
                  </button>
                )}
              </div>
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
                onClick={() => setDestinationSelection({
                  display: `${dest.name}, ${dest.country}`,
                  cityName: dest.name,
                  airportCodes: undefined,
                  isMetroArea: false,
                })}
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
