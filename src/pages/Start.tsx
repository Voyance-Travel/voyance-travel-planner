import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar as CalendarIcon, Users, Plane, Loader2, UserPlus, DollarSign, Info, Sparkles, Globe, Building2, Star, ChevronDown } from 'lucide-react';
import { format, addDays, isBefore, startOfToday, parseISO, startOfMonth } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DraftLimitBanner, DraftLimitBlocker } from '@/components/common/DraftLimitBanner';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import heroItineraryImage from '@/assets/hero-itinerary.jpg';
import heroHotelImage from '@/assets/hero-hotel.jpg';
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
  searchDestinations,
  formatAirportDisplay,
  type Airport,
  type Destination,
} from '@/services/locationSearchAPI';
import { searchHotelsByName, type HotelSearchByNameResult } from '@/services/hotelAPI';
import GuestLinkModal, { type LinkedGuest } from '@/components/planner/GuestLinkModal';
import { FlightDetailsModal, type FlightDetails, type FlightSegment } from '@/components/itinerary/FlightDetailsModal';
import type { ManualFlightEntry } from '@/components/itinerary/AddBookingInline';
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

// City/Destination Autocomplete - For itinerary mode (no airport codes needed)
function DestinationAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (selection: LocationSelection) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
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
      searchDestinations(debouncedQuery, 10)
        .then(setDestinations)
        .finally(() => setLoading(false));
    } else {
      setDestinations([]);
    }
  }, [debouncedQuery]);

  const handleSelect = (destination: Destination) => {
    const display = `${destination.city}, ${destination.country}`;
    setInputValue(display);
    setHasValidSelection(true);
    onChange({
      display,
      cityName: destination.city,
      airportCodes: destination.airport_codes, // May be undefined, that's fine
      isMetroArea: false,
    });
    setIsOpen(false);
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setHasValidSelection(false);
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
        <MapPin className="h-4 w-4 text-muted-foreground" />
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
              <span className="text-sm font-sans">Searching destinations...</span>
            </div>
          ) : destinations.length > 0 ? (
            destinations.map((dest, idx) => (
              <button
                key={dest.id}
                type="button"
                className={cn(
                  "w-full px-4 py-3 text-left hover:bg-secondary/50 flex items-center gap-3 transition-colors",
                  idx < destinations.length - 1 && "border-b border-border/50"
                )}
                onMouseDown={() => handleSelect(dest)}
              >
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-foreground">{dest.city}</p>
                  <p className="text-xs text-muted-foreground">{dest.country}{dest.region ? ` • ${dest.region}` : ''}</p>
                </div>
              </button>
            ))
          ) : inputValue.length >= 2 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm font-sans">
              No destinations found for "{inputValue}"
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

// Hotel selection type for itinerary-only mode
interface HotelSelectionData {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  website?: string;
  googleMapsUrl?: string;
  coordinates?: { lat: number; lng: number };
}

// Hotel Autocomplete for itinerary-only mode
function HotelAutocomplete({
  value,
  onChange,
  destination,
  placeholder = "Where are you staying? (optional)",
}: {
  value: HotelSelectionData | null;
  onChange: (hotel: HotelSelectionData | null) => void;
  destination: string;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value?.name || '');
  const [hotels, setHotels] = useState<HotelSearchByNameResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(inputValue, 400);

  useEffect(() => {
    if (value?.name !== inputValue && value?.name) {
      setInputValue(value.name);
    }
  }, [value?.name]);

  useEffect(() => {
    if (debouncedQuery.length >= 2 && destination) {
      setLoading(true);
      searchHotelsByName(debouncedQuery, destination)
        .then(setHotels)
        .finally(() => setLoading(false));
    } else {
      setHotels([]);
    }
  }, [debouncedQuery, destination]);

  const handleSelect = (hotel: HotelSearchByNameResult) => {
    setInputValue(hotel.name);
    onChange({
      placeId: hotel.placeId,
      name: hotel.name,
      address: hotel.address,
      rating: hotel.rating,
      reviewCount: hotel.reviewCount,
      website: hotel.website,
      googleMapsUrl: hotel.googleMapsUrl,
      coordinates: hotel.coordinates,
    });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        placeholder={destination ? placeholder : "Select destination first"}
        value={inputValue}
        onChange={(e) => { setInputValue(e.target.value); if (!e.target.value) onChange(null); setIsOpen(true); }}
        onFocus={() => { if (inputValue.length >= 2 && destination) setIsOpen(true); }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        disabled={!destination}
        className={cn(
          "h-12 pl-8 text-base bg-transparent border-0 border-b rounded-none focus:ring-0 font-sans",
          !destination ? "opacity-50 cursor-not-allowed" : "border-border focus:border-primary"
        )}
      />
      {isOpen && inputValue.length >= 2 && destination && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-elevated z-50 overflow-hidden max-h-80 overflow-y-auto rounded-xl"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Searching hotels...</span>
            </div>
          ) : hotels.length > 0 ? (
            hotels.map((hotel, idx) => (
              <button
                key={hotel.placeId}
                type="button"
                className={cn("w-full px-4 py-3 text-left hover:bg-secondary/50 flex items-center gap-3", idx < hotels.length - 1 && "border-b border-border/50")}
                onMouseDown={() => handleSelect(hotel)}
              >
                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{hotel.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{hotel.address}</p>
                  {hotel.rating && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs text-muted-foreground">{hotel.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">No hotels found</div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Trip occasion options - what's the purpose of this trip?
const tripOccasions = [
  { id: 'leisure', label: 'Leisure' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'honeymoon', label: 'Honeymoon' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'girls-trip', label: "Girls' Trip" },
  { id: 'guys-trip', label: "Guys' Trip" },
  { id: 'family', label: 'Family' },
  { id: 'adult-family', label: 'Adult Family' },
  { id: 'solo', label: 'Solo' },
  { id: 'friends', label: 'Friends' },
  { id: 'business', label: 'Business' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'wellness', label: 'Wellness' },
];

// Featured destinations
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
  const { canCreateDraft, isFreeUser } = useDraftLimitCheck();
  const [showLimitBlocker, setShowLimitBlocker] = useState(false);
  
  // Check for mode and destination from query params
  const destinationFromQuery = searchParams.get('destination');
  const itineraryOnlyMode = searchParams.get('mode') === 'itinerary';
  
  // Show blocker if at limit
  useEffect(() => {
    if (!canCreateDraft && user) {
      setShowLimitBlocker(true);
    }
  }, [canCreateDraft, user]);
  
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
  // Shared calendar month state - syncs both date pickers
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (plannerState.basics.startDate) {
      return startOfMonth(parseISO(plannerState.basics.startDate));
    }
    return startOfMonth(new Date());
  });
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || 2);
  const [tripType, setTripType] = useState<string>('leisure');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
  const [hotelSelection, setHotelSelection] = useState<HotelSelectionData | null>(null);
  const [budgetAmount, setBudgetAmount] = useState<number | undefined>(plannerState.basics.budgetAmount);
  const [showBudget, setShowBudget] = useState(!!plannerState.basics.budgetAmount);
  // Flight details for itinerary-only mode
  const [flightDetails, setFlightDetails] = useState<FlightDetails | null>(null);
  const [showFlightDetailsModal, setShowFlightDetailsModal] = useState(false);
  const today = startOfToday();

  // Prefill origin city from user preferences (home_airport or flight_preferences)
  useEffect(() => {
    const prefillHomeAirport = async () => {
      // Don't prefill if already set
      if (originSelection.cityName || !user) return;
      
      try {
        // First check user_preferences for home_airport and flight_preferences
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('home_airport, flight_preferences')
          .eq('user_id', user.id)
          .single();
        
        // Check flight_preferences.airport_code first (most specific)
        const flightPrefs = prefs?.flight_preferences as { airport_code?: string; home_airport?: string } | null;
        const airportCode = flightPrefs?.airport_code || flightPrefs?.home_airport;
        
        if (airportCode) {
          // Look up airport details to get proper display name
          const { data: airport } = await supabase
            .from('airports')
            .select('code, name, city')
            .eq('code', airportCode.toUpperCase())
            .single();
          
          if (airport) {
            setOriginSelection({
              display: `${airport.city} (${airport.code})`,
              cityName: airport.city,
              airportCodes: [airport.code],
            });
            return;
          }
        }
        
        // Fallback to home_airport text field
        if (prefs?.home_airport) {
          // Check if it's an airport code (3 letters)
          if (prefs.home_airport.length === 3) {
            const { data: airport } = await supabase
              .from('airports')
              .select('code, name, city')
              .eq('code', prefs.home_airport.toUpperCase())
              .single();
            
            if (airport) {
              setOriginSelection({
                display: `${airport.city} (${airport.code})`,
                cityName: airport.city,
                airportCodes: [airport.code],
              });
              return;
            }
          }
          
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
          // Check if it's an airport code (3 letters)
          if (profile.home_airport.length === 3) {
            const { data: airport } = await supabase
              .from('airports')
              .select('code, name, city')
              .eq('code', profile.home_airport.toUpperCase())
              .single();
            
            if (airport) {
              setOriginSelection({
                display: `${airport.city} (${airport.code})`,
                cityName: airport.city,
                airportCodes: [airport.code],
              });
              return;
            }
          }
          
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
      // First update basics so saveTrip has correct context
      setBasics({
        destination: destinationSelection.cityName,
        startDate: start,
        endDate: end,
        travelers,
        originCity: originSelection.cityName,
        budgetTier: getBudgetTier(budgetAmount),
        budgetAmount,
      });
      
      const tripId = await saveTrip();
      if (tripId) {
        // Build comprehensive update payload with ALL trip data
        // This ensures destination persists even if context hadn't fully updated
        const updatePayload: Record<string, unknown> = {
          // Core trip fields - ensure destination is saved
          name: `Trip to ${destinationSelection.cityName}`,
          destination: destinationSelection.cityName,
          start_date: start,
          end_date: end,
          travelers,
          origin_city: originSelection.cityName,
          budget_tier: getBudgetTier(budgetAmount),
          trip_type: tripType || 'vacation',
        };
        
        // Save hotel selection if provided (as array for multi-hotel support)
        if (hotelSelection) {
          updatePayload.hotel_selection = [{
            id: `manual-${Date.now()}`,
            name: hotelSelection.name,
            address: hotelSelection.address,
            location: hotelSelection.address,
            rating: hotelSelection.rating || 0,
            website: hotelSelection.website,
            googleMapsUrl: hotelSelection.googleMapsUrl,
            placeId: hotelSelection.placeId,
            coordinates: hotelSelection.coordinates,
            checkIn: start,
            checkOut: end,
            isManualEntry: true,
          }];
        }
        
        // Save flight times with origin/destination for itinerary generation
        // Build flight selection from flightDetails or origin/destination
        // IMPORTANT: Structure must match what getFlightHotelContext reads:
        //   - departure.arrival.time for Day 1 arrival
        //   - return.departure.time for last day departure
        const originAirport = flightDetails?.outbound?.departureAirport || originSelection.airportCodes?.[0] || originSelection.cityName;
        const destAirport = flightDetails?.outbound?.arrivalAirport || destinationSelection.airportCodes?.[0] || destinationSelection.cityName;
        const hasOriginInfo = originAirport || flightDetails?.outbound?.departureAirport;
        
        if (flightDetails || hasOriginInfo) {
          updatePayload.flight_selection = {
            // Use 'departure' key (not 'outbound') to match backend reader
            departure: {
              departureAirport: originAirport,
              departureCity: originSelection.cityName || flightDetails?.outbound?.departureAirport,
              departureTime: flightDetails?.outbound?.departureTime,
              departureDate: start, // Include date for persistence
              arrivalAirport: destAirport,
              arrivalCity: destinationSelection.cityName,
              arrivalTime: flightDetails?.outbound?.arrivalTime || undefined,
              arrivalDate: start, // Same day arrival
              // Nested structure for backend compatibility
              arrival: {
                airport: destAirport,
                city: destinationSelection.cityName,
                time: flightDetails?.outbound?.arrivalTime || undefined,
                date: start,
              },
              connections: flightDetails?.outboundLayovers?.map(l => ({
                departureAirport: l.departureAirport,
                arrivalAirport: l.arrivalAirport,
                departureTime: l.departureTime,
                arrivalTime: l.arrivalTime,
              })),
            },
            // Use 'return' key to match backend reader
            return: flightDetails?.return ? {
              departureAirport: flightDetails.return.departureAirport || destAirport,
              departureCity: destinationSelection.cityName,
              departureTime: flightDetails.return.departureTime || undefined,
              departureDate: end, // Include date for persistence
              arrivalAirport: flightDetails.return.arrivalAirport || originAirport,
              arrivalCity: originSelection.cityName || flightDetails.return.arrivalAirport,
              arrivalTime: flightDetails.return.arrivalTime,
              arrivalDate: end,
              // Nested structure for backend compatibility
              departure: {
                airport: flightDetails.return.departureAirport || destAirport,
                city: destinationSelection.cityName,
                time: flightDetails.return.departureTime || undefined,
                date: end,
              },
              connections: flightDetails?.returnLayovers?.map(l => ({
                departureAirport: l.departureAirport,
                arrivalAirport: l.arrivalAirport,
                departureTime: l.departureTime,
                arrivalTime: l.arrivalTime,
              })),
            } : undefined,
            // Also keep flat format for legacy/display compatibility
            arrivalTime: flightDetails?.outbound?.arrivalTime,
            returnDepartureTime: flightDetails?.return?.departureTime,
            departureAirport: originAirport,
            arrivalAirport: destAirport,
            // Multi-city transfers
            interCityTransfers: flightDetails?.interCityTransfers?.map(t => ({
              mode: t.mode,
              fromCity: t.fromCity,
              toCity: t.toCity,
              departureDate: t.departureDate,
              departureTime: t.departureTime,
              arrivalTime: t.arrivalTime,
              carrier: t.carrier,
            })),
            isMultiCity: flightDetails?.isMultiCity,
          };
        }
        
        // Save metadata with airport codes
        updatePayload.metadata = {
          destinationAirportCodes: destinationSelection.airportCodes,
          originAirportCodes: originSelection.airportCodes,
          isDestinationMetro: destinationSelection.isMetroArea,
          isOriginMetro: originSelection.isMetroArea,
          budgetAmount: budgetAmount,
        };
        
        await supabase.from('trips').update(updatePayload).eq('id', tripId);
        
        navigate(`/trip/${tripId}?generate=true`);
      }
      return;
    }

    navigate(`${ROUTES.PLANNER.HOTEL}?${params.toString()}`);
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
      
      {/* Draft limit blocker modal */}
      {showLimitBlocker && (
        <DraftLimitBlocker onClose={() => setShowLimitBlocker(false)} />
      )}
      
      {/* Scrapbook Photo Collage Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-100 via-amber-50/50 to-stone-100 dark:from-stone-900 dark:via-stone-800 dark:to-stone-900">
        {/* Photo Collage Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Scattered polaroid-style photos */}
          <div className="absolute -top-8 -left-12 w-48 h-64 rotate-[-12deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute top-16 left-[15%] w-40 h-52 rotate-[8deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -top-4 right-[20%] w-44 h-56 rotate-[-6deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute top-8 -right-8 w-52 h-64 rotate-[15deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute bottom-[20%] -left-6 w-44 h-56 rotate-[10deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute bottom-12 left-[12%] w-36 h-48 rotate-[-8deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute bottom-[15%] right-[10%] w-48 h-60 rotate-[6deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-4 right-[25%] w-40 h-52 rotate-[-14deg] shadow-xl rounded-sm overflow-hidden border-[6px] border-white dark:border-stone-700">
            <img src="https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&q=80" alt="" className="w-full h-full object-cover" />
          </div>
          
          {/* Soft center fade for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-stone-100/80 to-stone-100 dark:via-stone-900/80 dark:to-stone-900" />
          <div className="absolute inset-0 bg-radial-gradient from-stone-100/90 via-stone-100/60 to-transparent dark:from-stone-900/90 dark:via-stone-900/60" style={{ background: 'radial-gradient(ellipse at center, hsl(var(--background) / 0.85) 0%, transparent 70%)' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-2xl mx-auto px-6 py-16">
          {/* Editorial Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <p className={`text-[10px] tracking-[0.35em] uppercase font-semibold mb-4 ${
              itineraryOnlyMode ? 'text-amber-600' : 'text-sky-600'
            }`}>
              {itineraryOnlyMode ? 'Flight Booked' : 'Need Accommodation'}
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight">
              {itineraryOnlyMode ? (
                <>Build My <em className="italic">Itinerary</em></>
              ) : (
                <>Find My <em className="italic">Hotel</em></>
              )}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-lg mx-auto">
              {itineraryOnlyMode
                ? "You've got your flights and hotel sorted. We'll craft the perfect daily activities."
                : "Tell us where you're headed, and we'll find the ideal place to stay."}
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 md:p-8"
          >
            <div className="space-y-5">
              {/* Destination - Both flows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                    Destination
                  </label>
                  <Link 
                    to={ROUTES.PLANNER.MULTI_CITY}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Multiple cities?
                  </Link>
                </div>
                {itineraryOnlyMode ? (
                  <DestinationAutocomplete
                    value={destinationSelection.display}
                    onChange={setDestinationSelection}
                    placeholder="Where are you going?"
                  />
                ) : (
                  <AirportAutocomplete
                    value={destinationSelection.display}
                    onChange={setDestinationSelection}
                    placeholder="Where do you want to go?"
                    icon={MapPin}
                  />
                )}
              </div>

              {/* Flight Details - Both flows */}
              <div className="space-y-3">
                <span className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                  Flight Details {!itineraryOnlyMode && <span className="normal-case text-muted-foreground/70">(optional)</span>}
                </span>
                
                {flightDetails ? (
                  <div 
                    className="p-4 rounded-lg border border-border bg-muted/30 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setShowFlightDetailsModal(true)}
                  >
                    {/* Outbound summary */}
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-primary rotate-[-45deg]" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {flightDetails.outbound.departureAirport || originSelection.cityName || 'Home'} → {flightDetails.outbound.arrivalAirport || destinationSelection.cityName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {flightDetails.outbound.departureTime && `Departs ${flightDetails.outbound.departureTime}`}
                          {flightDetails.outbound.departureTime && flightDetails.outbound.arrivalTime && ' · '}
                          {flightDetails.outbound.arrivalTime && `Arrives ${flightDetails.outbound.arrivalTime}`}
                          {startDate && ` on ${format(startDate, 'MMM d')}`}
                        </div>
                        {flightDetails.outboundLayovers && flightDetails.outboundLayovers.length > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            + {flightDetails.outboundLayovers.length} connection(s)
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Return summary */}
                    {flightDetails.return && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Plane className="h-4 w-4 text-primary rotate-45" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {flightDetails.return.departureAirport || destinationSelection.cityName} → {flightDetails.return.arrivalAirport || originSelection.cityName || 'Home'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {flightDetails.return.departureTime && `Departs ${flightDetails.return.departureTime}`}
                            {flightDetails.return.departureTime && flightDetails.return.arrivalTime && ' · '}
                            {flightDetails.return.arrivalTime && `Arrives ${flightDetails.return.arrivalTime}`}
                            {endDate && ` on ${format(endDate, 'MMM d')}`}
                          </div>
                          {flightDetails.returnLayovers && flightDetails.returnLayovers.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              + {flightDetails.returnLayovers.length} connection(s)
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Inter-city transfers summary */}
                    {flightDetails.interCityTransfers && flightDetails.interCityTransfers.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <div className="h-4 w-4 flex items-center justify-center text-primary">
                          🚄
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {flightDetails.interCityTransfers.length} inter-city transfer{flightDetails.interCityTransfers.length > 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {flightDetails.interCityTransfers.map((t, i) => (
                              <span key={i}>
                                {i > 0 && ' · '}
                                {t.fromCity} → {t.toCity}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-[10px] text-primary text-center pt-1">
                      Click to edit flight details
                    </p>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 justify-start text-muted-foreground"
                    onClick={() => setShowFlightDetailsModal(true)}
                  >
                    <Plane className="h-4 w-4 mr-2 rotate-[-45deg]" />
                    {itineraryOnlyMode ? 'Add flight details' : 'Add flight details (helps plan your trip)'}
                  </Button>
                )}
                
                {startDate && !flightDetails && (
                  <p className="text-[10px] text-muted-foreground">
                    {itineraryOnlyMode 
                      ? 'Arrival time plans Day 1, departure time plans your last day'
                      : 'Adding flights helps us find hotels near your arrival and plan your itinerary'}
                  </p>
                )}
              </div>


              {/* Hotel Input - Available for BOTH flows */}
              <div className="space-y-2">
                <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                  {itineraryOnlyMode ? 'Staying at' : 'Already have a hotel?'}{' '}
                  <span className="normal-case text-muted-foreground/70">(optional)</span>
                </label>
                <HotelAutocomplete
                  value={hotelSelection}
                  onChange={setHotelSelection}
                  destination={destinationSelection.cityName}
                  placeholder={itineraryOnlyMode ? "Search your hotel..." : "Add your hotel if already booked..."}
                />
                {!itineraryOnlyMode && hotelSelection && (
                  <p className="text-[10px] text-muted-foreground">
                    Great! We'll still show hotel options, but can focus on activities near your stay.
                  </p>
                )}
              </div>

              {/* Dates - Side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                    {itineraryOnlyMode ? 'Arriving' : 'Depart'}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-between text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                        <CalendarIcon className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        onSelect={(date) => {
                          setStartDate(date);
                          if (date && (!endDate || isBefore(endDate, date))) {
                            setEndDate(addDays(date, 7));
                          }
                        }}
                        disabled={(date) => isBefore(date, today)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                    {itineraryOnlyMode ? 'Leaving' : 'Return'}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-between text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        {endDate ? format(endDate, "MMM d, yyyy") : "Select date"}
                        <CalendarIcon className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        onSelect={(date) => setEndDate(date)}
                        disabled={(date) => startDate ? isBefore(date, startDate) : isBefore(date, today)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Travelers */}
              <div className="space-y-2">
                <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                  Travelers
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setTravelers(num)}
                        className={cn(
                          "w-12 h-12 rounded-lg border-2 transition-all text-sm font-medium",
                          travelers === num
                            ? itineraryOnlyMode 
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-sky-500 text-white border-sky-500"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  {travelers > 1 && (
                    <button 
                      onClick={handleAddGuest}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <UserPlus className="h-4 w-4" />
                      {linkedGuests.length > 0 
                        ? `${linkedGuests.length} linked` 
                        : 'Link guests'}
                    </button>
                  )}
                </div>
              </div>

              {/* Trip Occasion - Compact */}
              <div className="space-y-3">
                <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                  Trip Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {tripOccasions.slice(0, 6).map((occasion) => (
                    <button
                      key={occasion.id}
                      type="button"
                      onClick={() => setTripType(occasion.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border transition-all text-sm",
                        tripType === occasion.id
                          ? itineraryOnlyMode 
                            ? "bg-amber-500/10 border-amber-500 text-amber-700 font-medium"
                            : "bg-primary/10 border-primary text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {occasion.label}
                    </button>
                  ))}
                </div>
                
                {/* Show more occasions */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ChevronDown className="h-3 w-3" />
                      More options
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="flex flex-wrap gap-2">
                      {tripOccasions.slice(6).map((occasion) => (
                        <button
                          key={occasion.id}
                          type="button"
                          onClick={() => setTripType(occasion.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-full border transition-all text-sm",
                            tripType === occasion.id
                              ? itineraryOnlyMode 
                                ? "bg-amber-500/10 border-amber-500 text-amber-700 font-medium"
                                : "bg-primary/10 border-primary text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          {occasion.label}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Optional Budget Section */}
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
                    <label className="block text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2">
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
                  </div>
                  
                  {budgetAmount && budgetAmount < 500 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        For budget trips, we'll prioritize the cheapest options.
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
                      const isInRange = budgetAmount !== undefined && 
                        budgetAmount >= preset.min && 
                        (preset.max === 10000 ? true : budgetAmount <= preset.max);
                      
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
                              ? itineraryOnlyMode 
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-sky-500 text-white border-sky-500"
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
            </div>

            {/* CTA Button */}
            <div className="pt-6 space-y-4">
              <Button
                onClick={handleStart}
                disabled={!isFormValid}
                className={cn(
                  "w-full h-14 text-base font-medium rounded-xl shadow-lg transition-all",
                  itineraryOnlyMode 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25' 
                    : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/25'
                )}
                size="lg"
              >
                {itineraryOnlyMode ? (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Build My Itinerary
                  </>
                ) : (
                  <>
                    <Building2 className="h-5 w-5 mr-2" />
                    Find My Hotel
                  </>
                )}
              </Button>
              
              {/* Cross-sell to other flow */}
              {!itineraryOnlyMode && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!destinationSelection.cityName) {
                      toast.error('Please select a destination');
                      return;
                    }
                    if (!startDate || !endDate) {
                      toast.error('Please select your travel dates');
                      return;
                    }
                    
                    const start = format(startDate, 'yyyy-MM-dd');
                    const end = format(endDate, 'yyyy-MM-dd');
                    
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
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Already have your hotel? <span className="text-amber-600 font-medium hover:underline">Build itinerary only →</span>
                </button>
              )}
              
              {itineraryOnlyMode && (
                <Link
                  to="/start"
                  className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Need a hotel too? <span className="text-sky-600 font-medium hover:underline">Find accommodations →</span>
                </Link>
              )}
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

      {/* Flight Details Modal */}
      <FlightDetailsModal
        open={showFlightDetailsModal}
        onOpenChange={setShowFlightDetailsModal}
        onSave={(details) => {
          setFlightDetails(details);
          toast.success('Flight details saved!');
        }}
        initialDetails={flightDetails || undefined}
        tripStartDate={startDate ? format(startDate, 'yyyy-MM-dd') : undefined}
        tripEndDate={endDate ? format(endDate, 'yyyy-MM-dd') : undefined}
        destination={destinationSelection.cityName}
      />
    </MainLayout>
  );
}
