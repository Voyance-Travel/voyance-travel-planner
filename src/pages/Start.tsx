import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Calendar as CalendarIcon, Users, Loader2, DollarSign, 
  Sparkles, ChevronDown, PartyPopper, ArrowRight, Check, Clock,
  Eye, Gem, Utensils, Building2, Plane, Star, Wifi, Coffee
} from 'lucide-react';
import { format, addDays, isBefore, startOfToday, parseISO, startOfMonth } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DraftLimitBanner, DraftLimitBlocker } from '@/components/common/DraftLimitBanner';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Import destination autocomplete
import { DestinationAutocomplete } from '@/components/planner/shared/DestinationAutocomplete';

// Types
interface LocationSelection {
  display: string;
  cityName: string;
  airportCodes?: string[];
  isMetroArea?: boolean;
}

interface HotelOption {
  id: string;
  name: string;
  neighborhood: string;
  stars: number;
  pricePerNight: number;
  amenities: string[];
  imageUrl: string;
}

// Trip occasions
const tripOccasions = [
  { id: 'leisure', label: 'Leisure' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'honeymoon', label: 'Honeymoon' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'girls-trip', label: "Girls' Trip" },
  { id: 'guys-trip', label: "Guys' Trip" },
  { id: 'family', label: 'Family' },
  { id: 'solo', label: 'Solo' },
  { id: 'friends', label: 'Friends' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'wellness', label: 'Wellness' },
];

const CELEBRATION_TRIP_TYPES = ['birthday', 'anniversary', 'honeymoon'] as const;

// Mock hotel options for quick selection
const mockHotels: HotelOption[] = [
  {
    id: 'hotel-1',
    name: 'The Grand Heritage',
    neighborhood: 'Historic Center',
    stars: 5,
    pricePerNight: 320,
    amenities: ['Free WiFi', 'Breakfast included', 'Pool', 'Spa'],
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80',
  },
  {
    id: 'hotel-2',
    name: 'Boutique Maison',
    neighborhood: 'Arts District',
    stars: 4,
    pricePerNight: 185,
    amenities: ['Free WiFi', 'Breakfast included', 'Gym'],
    imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&q=80',
  },
  {
    id: 'hotel-3',
    name: 'Urban Loft Hotel',
    neighborhood: 'Downtown',
    stars: 3,
    pricePerNight: 120,
    amenities: ['Free WiFi', 'Restaurant'],
    imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400&q=80',
  },
];

// Sample itineraries for sidebar motivation
const sampleItineraries = [
  {
    destination: 'Kyoto',
    duration: '5 days',
    highlight: 'Bamboo forest at dawn',
    tags: ['Culture', 'Hidden Gems'],
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400',
  },
  {
    destination: 'Amalfi Coast',
    duration: '7 days',
    highlight: 'Cliffside dinner in Ravello',
    tags: ['Romance', 'Cuisine'],
    image: 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=400',
  },
  {
    destination: 'Bali',
    duration: '6 days',
    highlight: 'Private temple ceremony',
    tags: ['Wellness', 'Adventure'],
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400',
  },
];

// Budget presets
const budgetPresets = [
  { label: 'Budget', value: 500, description: 'Under $500' },
  { label: 'Moderate', value: 1000, description: '$500–$1.5k' },
  { label: 'Premium', value: 2500, description: '$1.5k–$3.5k' },
  { label: 'Luxury', value: 5000, description: '$3.5k+' },
];

// Progress Step Indicator
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Trip Details', step: 1 },
    { label: 'Flight & Hotel', step: 2 },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, idx) => (
        <div key={s.step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                currentStep === s.step
                  ? 'bg-primary text-primary-foreground'
                  : currentStep > s.step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {currentStep > s.step ? <Check className="w-4 h-4" /> : s.step}
            </div>
            <span
              className={cn(
                'text-xs mt-1 font-medium',
                currentStep === s.step ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'w-12 h-0.5 mx-2 mt-[-16px]',
                currentStep > s.step ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Sidebar with sample itineraries
function MotivationSidebar() {
  return (
    <div className="hidden lg:block w-80 shrink-0">
      <div className="sticky top-24 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            What you'll get
          </h3>
          <p className="text-xs text-muted-foreground">
            AI-crafted itineraries tailored to your travel DNA
          </p>
        </div>

        <div className="space-y-4">
          {sampleItineraries.map((itinerary) => (
            <motion.div
              key={itinerary.destination}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="aspect-[16/10] overflow-hidden">
                <img
                  src={itinerary.image}
                  alt={itinerary.destination}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center justify-between text-white mb-1">
                  <span className="font-medium text-sm">{itinerary.destination}</span>
                  <span className="text-xs opacity-80">{itinerary.duration}</span>
                </div>
                <p className="text-xs text-white/80 mb-2">{itinerary.highlight}</p>
                <div className="flex gap-1">
                  {itinerary.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[10px] text-white"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Intelligence metrics preview */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Intelligence Included
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Gem className="w-4 h-4 text-emerald-500" />
              <span className="text-foreground">Hidden gems locals love</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-foreground">Best timing for each spot</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Utensils className="w-4 h-4 text-amber-500" />
              <span className="text-foreground">Curated dining picks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 1: Trip Details with inline budget section
function TripDetailsStep({
  destinationSelection,
  setDestinationSelection,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  travelers,
  setTravelers,
  tripType,
  setTripType,
  celebrationDay,
  setCelebrationDay,
  budgetAmount,
  setBudgetAmount,
  onContinue,
}: {
  destinationSelection: LocationSelection;
  setDestinationSelection: (s: LocationSelection) => void;
  startDate: Date | undefined;
  setStartDate: (d: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (d: Date | undefined) => void;
  travelers: number;
  setTravelers: (n: number) => void;
  tripType: string;
  setTripType: (t: string) => void;
  celebrationDay: number | undefined;
  setCelebrationDay: (d: number | undefined) => void;
  budgetAmount: number | undefined;
  setBudgetAmount: (n: number | undefined) => void;
  onContinue: () => void;
}) {
  const today = startOfToday();
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => 
    startDate ? startOfMonth(startDate) : startOfMonth(new Date())
  );
  const [showBudget, setShowBudget] = useState(!!budgetAmount);

  // Auto-set end date when start date changes
  useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(addDays(startDate, 5));
    }
  }, [startDate, endDate, setEndDate]);

  const isValid = destinationSelection.cityName && startDate && endDate;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-2">
          Where are you going?
        </h2>
        <p className="text-muted-foreground">
          Tell us about your trip and we'll tailor the experience
        </p>
      </div>

      <div className="space-y-5 max-w-md mx-auto">
        {/* Destination */}
        <div className="space-y-2">
          <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
            Destination
          </label>
          <DestinationAutocomplete
            value={destinationSelection.display}
            onChange={setDestinationSelection}
            placeholder="Search cities..."
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Arriving
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-12 justify-between text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  {startDate ? format(startDate, 'MMM d, yyyy') : 'Select date'}
                  <CalendarIcon className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  onSelect={setStartDate}
                  disabled={(date) => isBefore(date, today)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Leaving
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-12 justify-between text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  {endDate ? format(endDate, 'MMM d, yyyy') : 'Select date'}
                  <CalendarIcon className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  onSelect={setEndDate}
                  disabled={(date) => (startDate ? isBefore(date, startDate) : isBefore(date, today))}
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
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setTravelers(num);
                  if (num === 1 && tripType !== 'solo') {
                    setTripType('solo');
                  } else if (num > 1 && tripType === 'solo') {
                    setTripType('leisure');
                  }
                }}
                className={cn(
                  'w-12 h-12 rounded-lg border-2 transition-all text-sm font-medium',
                  travelers === num
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTravelers(Math.min(10, travelers + 1))}
              className="w-12 h-12 rounded-lg border-2 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all text-sm"
            >
              {travelers > 4 ? travelers : '5+'}
            </button>
          </div>
        </div>

        {/* Trip Type */}
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
                  'px-3 py-1.5 rounded-full border transition-all text-sm',
                  tripType === occasion.id
                    ? 'bg-primary/10 border-primary text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {occasion.label}
              </button>
            ))}
          </div>
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
                      'px-3 py-1.5 rounded-full border transition-all text-sm',
                      tripType === occasion.id
                        ? 'bg-primary/10 border-primary text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {occasion.label}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Celebration Day */}
        {CELEBRATION_TRIP_TYPES.includes(tripType as typeof CELEBRATION_TRIP_TYPES[number]) && startDate && endDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground flex items-center gap-2">
              <PartyPopper className="h-4 w-4 text-amber-500" />
              Which day is the celebration?
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 },
                (_, i) => i + 1
              ).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setCelebrationDay(day)}
                  className={cn(
                    'w-10 h-10 rounded-full border transition-all text-sm font-medium',
                    celebrationDay === day
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400'
                      : 'border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground'
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Budget Section - Collapsible */}
        <Collapsible open={showBudget} onOpenChange={setShowBudget}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 transition-all"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {budgetAmount ? `Budget: $${budgetAmount.toLocaleString()}` : 'Set budget (optional)'}
                </span>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showBudget && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-4 gap-2">
              {budgetPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setBudgetAmount(preset.value)}
                  className={cn(
                    'p-2 rounded-lg border text-center transition-all',
                    budgetAmount === preset.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <div className="text-xs font-medium text-foreground">{preset.label}</div>
                  <div className="text-[10px] text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-6 max-w-md mx-auto">
        <Button onClick={onContinue} disabled={!isValid} className="gap-2">
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// Step 2: Flight (optional) & Hotel Selection
function FlightHotelStep({
  destination,
  startDate,
  endDate,
  travelers,
  selectedHotel,
  setSelectedHotel,
  flightArrivalTime,
  setFlightArrivalTime,
  onSubmit,
  onBack,
  isSubmitting,
}: {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  selectedHotel: HotelOption | null;
  setSelectedHotel: (h: HotelOption | null) => void;
  flightArrivalTime: string;
  setFlightArrivalTime: (t: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const navigate = useNavigate();
  const nights = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

  const handleBrowseMoreHotels = () => {
    const params = new URLSearchParams({
      destination,
      checkIn: startDate,
      checkOut: endDate,
      guests: travelers.toString(),
    });
    navigate(`/planner/hotel?${params.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-2">
          Flight & Hotel
        </h2>
        <p className="text-muted-foreground">
          Add your travel details for a complete itinerary
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-8">
        {/* Flight Section - Optional */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-muted-foreground" />
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Flight arrival time
              <span className="text-muted-foreground/60 ml-1">(optional)</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Helps us plan Day 1 activities around your arrival
          </p>
          <Input
            type="time"
            value={flightArrivalTime}
            onChange={(e) => setFlightArrivalTime(e.target.value)}
            placeholder="e.g. 14:00"
            className="h-12 max-w-[200px]"
          />
        </div>

        {/* Hotel Section - 3 Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                Where will you stay?
              </label>
            </div>
            <button
              type="button"
              onClick={handleBrowseMoreHotels}
              className="text-xs text-primary hover:underline"
            >
              Browse more hotels →
            </button>
          </div>

          <div className="grid gap-3">
            {mockHotels.map((hotel) => (
              <button
                key={hotel.id}
                type="button"
                onClick={() => setSelectedHotel(selectedHotel?.id === hotel.id ? null : hotel)}
                className={cn(
                  'w-full flex gap-4 p-3 rounded-xl border-2 text-left transition-all',
                  selectedHotel?.id === hotel.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <img
                  src={hotel.imageUrl}
                  alt={hotel.name}
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-foreground text-sm">{hotel.name}</h4>
                      <div className="flex items-center gap-1 mt-0.5">
                        {Array.from({ length: hotel.stars }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1">{hotel.neighborhood}</span>
                      </div>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      selectedHotel?.id === hotel.id
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/30'
                    )}>
                      {selectedHotel?.id === hotel.id && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {hotel.amenities.slice(0, 2).map((amenity) => (
                      <span key={amenity} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {amenity === 'Free WiFi' && <Wifi className="h-3 w-3" />}
                        {amenity === 'Breakfast included' && <Coffee className="h-3 w-3" />}
                        {amenity}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2">
                    <span className="text-sm font-semibold text-foreground">${hotel.pricePerNight}</span>
                    <span className="text-xs text-muted-foreground">/night</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      · ${hotel.pricePerNight * nights} total
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Skip hotel option */}
          <button
            type="button"
            onClick={() => setSelectedHotel(null)}
            className={cn(
              'w-full p-3 rounded-xl border-2 text-center transition-all text-sm',
              !selectedHotel
                ? 'border-primary/50 bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40'
            )}
          >
            I'll add hotel details later
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 max-w-xl mx-auto">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="h-12 px-6 text-base font-medium rounded-xl shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Build My Itinerary
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export default function Start() {
  const { state: plannerState, setBasics } = useTripPlanner();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canCreateDraft } = useDraftLimitCheck();
  const [showLimitBlocker, setShowLimitBlocker] = useState(false);

  // Current step: 1 = Trip Details, 2 = Flight & Hotel
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trip state
  const destinationFromQuery = searchParams.get('destination');
  const [destinationSelection, setDestinationSelection] = useState<LocationSelection>(() => ({
    display: destinationFromQuery || plannerState.basics.destination || '',
    cityName: destinationFromQuery || plannerState.basics.destination || '',
    airportCodes: undefined,
  }));
  const [startDate, setStartDate] = useState<Date | undefined>(
    plannerState.basics.startDate ? parseISO(plannerState.basics.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    plannerState.basics.endDate ? parseISO(plannerState.basics.endDate) : undefined
  );
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || 2);
  const [tripType, setTripType] = useState<string>('leisure');
  const [celebrationDay, setCelebrationDay] = useState<number | undefined>(undefined);
  const [budgetAmount, setBudgetAmount] = useState<number | undefined>(plannerState.basics.budgetAmount);
  
  // Step 2 state
  const [selectedHotel, setSelectedHotel] = useState<HotelOption | null>(null);
  const [flightArrivalTime, setFlightArrivalTime] = useState('');

  // Check draft limit
  useEffect(() => {
    if (!canCreateDraft && user) {
      setShowLimitBlocker(true);
    }
  }, [canCreateDraft, user]);

  // Handle final submission
  const handleSubmit = async () => {
    if (!destinationSelection.cityName || !startDate || !endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save basics to context
      setBasics({
        destination: destinationSelection.cityName,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        travelers,
        budgetAmount,
      });

      // Check if user needs to authenticate
      if (!user) {
        // Store trip data and redirect to sign up
        navigate(ROUTES.SIGNUP + '?redirect=' + ROUTES.PLANNER.ITINERARY);
        return;
      }

      // Navigate to itinerary generation
      navigate(ROUTES.PLANNER.ITINERARY);
    } catch (err) {
      console.error('Error starting trip:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout showFooter={false}>
      <Head
        title="Plan Your Trip | Voyance"
        description="Start planning your personalized travel itinerary with Voyance."
      />

      {/* Draft limit blocker */}
      {showLimitBlocker && <DraftLimitBlocker />}

      <section className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Progress Indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Main content with sidebar */}
          <div className="flex gap-12">
            {/* Main form area */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <TripDetailsStep
                    key="details"
                    destinationSelection={destinationSelection}
                    setDestinationSelection={setDestinationSelection}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    travelers={travelers}
                    setTravelers={setTravelers}
                    tripType={tripType}
                    setTripType={setTripType}
                    celebrationDay={celebrationDay}
                    setCelebrationDay={setCelebrationDay}
                    budgetAmount={budgetAmount}
                    setBudgetAmount={setBudgetAmount}
                    onContinue={() => setCurrentStep(2)}
                  />
                )}

                {currentStep === 2 && startDate && endDate && (
                  <FlightHotelStep
                    key="flight-hotel"
                    destination={destinationSelection.cityName}
                    startDate={format(startDate, 'yyyy-MM-dd')}
                    endDate={format(endDate, 'yyyy-MM-dd')}
                    travelers={travelers}
                    selectedHotel={selectedHotel}
                    setSelectedHotel={setSelectedHotel}
                    flightArrivalTime={flightArrivalTime}
                    setFlightArrivalTime={setFlightArrivalTime}
                    onSubmit={handleSubmit}
                    onBack={() => setCurrentStep(1)}
                    isSubmitting={isSubmitting}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Motivation Sidebar */}
            <MotivationSidebar />
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
