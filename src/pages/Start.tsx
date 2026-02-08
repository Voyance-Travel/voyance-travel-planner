import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Calendar as CalendarIcon, Users, Loader2, DollarSign, 
  Sparkles, ChevronDown, ChevronUp, PartyPopper, ArrowRight, Check, Clock,
  Eye, Gem, Utensils, Building2, Plane, Upload, Hotel, Search, PenLine, Globe, Star, Route, UserPlus, MessageSquareText
} from 'lucide-react';
import { addDays as addDaysUtil } from 'date-fns';
import MultiCitySelector from '@/components/planner/MultiCitySelector';
import { TripDestination, InterCityTransport, calculateTotalNights, generateDestinationDates } from '@/types/multiCity';
import { format, addDays, isBefore, startOfToday, parseISO, startOfMonth } from 'date-fns';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DraftLimitBanner, DraftLimitBlocker } from '@/components/common/DraftLimitBanner';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Import destination autocomplete and airport autocomplete
import { DestinationAutocomplete } from '@/components/planner/shared/DestinationAutocomplete';
import { AirportAutocomplete } from '@/components/common/AirportAutocomplete';
import { HotelAutocomplete } from '@/components/common/HotelAutocomplete';
import { FlightImportModal } from '@/components/itinerary/FlightImportModal';
import type { ManualFlightEntry } from '@/components/itinerary/AddBookingInline';
import GuestLinkModal, { type LinkedGuest } from '@/components/planner/GuestLinkModal';
import { TripChatPlanner } from '@/components/planner/TripChatPlanner';

// Types
interface LocationSelection {
  display: string;
  cityName: string;
  airportCodes?: string[];
  isMetroArea?: boolean;
}

interface ManualHotelEntry {
  name: string;
  address: string;
  neighborhood?: string;
  checkInTime?: string;
  checkOutTime?: string;
  pricePerNight?: number;
  includeInBudget?: boolean;
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

// Budget presets
const budgetPresets = [
  { label: 'Budget', value: 500, description: 'Under $500' },
  { label: 'Moderate', value: 1000, description: '$500–$1.5k' },
  { label: 'Premium', value: 2500, description: '$1.5k–$3.5k' },
  { label: 'Luxury', value: 5000, description: '$3.5k+' },
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

// Progress Step Indicator
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Trip Details', step: 1 },
    { label: 'Flight & Hotel', step: 2 },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
      {steps.map((s, idx) => (
        <div key={s.step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all',
                currentStep === s.step
                  ? 'bg-primary text-primary-foreground'
                  : currentStep > s.step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {currentStep > s.step ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : s.step}
            </div>
            <span
              className={cn(
                'text-[10px] sm:text-xs mt-1 font-medium whitespace-nowrap',
                currentStep === s.step ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'w-8 sm:w-12 h-0.5 mx-1.5 sm:mx-2 mt-[-16px]',
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
  onOpenGuestModal,
  linkedGuestCount,
  tripType,
  setTripType,
  celebrationDay,
  setCelebrationDay,
  budgetAmount,
  setBudgetAmount,
  isMultiCity,
  setIsMultiCity,
  destinations,
  setDestinations,
  transports,
  setTransports,
  planMode,
  setPlanMode,
  onChatDetailsExtracted,
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
  onOpenGuestModal: () => void;
  linkedGuestCount: number;
  tripType: string;
  setTripType: (t: string) => void;
  celebrationDay: number | undefined;
  setCelebrationDay: (d: number | undefined) => void;
  budgetAmount: number | undefined;
  setBudgetAmount: (n: number | undefined) => void;
  isMultiCity: boolean;
  setIsMultiCity: (v: boolean) => void;
  destinations: TripDestination[];
  setDestinations: (d: TripDestination[]) => void;
  transports: InterCityTransport[];
  setTransports: (t: InterCityTransport[]) => void;
  planMode: 'single' | 'multi' | 'chat';
  setPlanMode: (m: 'single' | 'multi' | 'chat') => void;
  onChatDetailsExtracted: (details: any) => void;
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

  // Auto-calculate end date for multi-city mode
  useEffect(() => {
    if (isMultiCity && startDate && destinations.length > 0) {
      const totalNights = calculateTotalNights(destinations);
      if (totalNights > 0) {
        setEndDate(addDaysUtil(startDate, totalNights));
      }
    }
  }, [isMultiCity, startDate, destinations, setEndDate]);

  // When switching to multi-city, seed first destination from current selection
  const handleToggleMultiCity = (multi: boolean) => {
    setIsMultiCity(multi);
    if (multi && destinations.length === 0 && destinationSelection.cityName) {
      const seed: TripDestination = {
        id: crypto.randomUUID(),
        city: destinationSelection.cityName,
        nights: 3,
        order: 1,
      };
      setDestinations([seed]);
    }
  };

  const isValid = isMultiCity
    ? destinations.length >= 2 && startDate && endDate
    : destinationSelection.cityName && startDate && endDate;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5 sm:space-y-6"
    >
      <div className="text-center mb-4 sm:mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-foreground mb-1 sm:mb-2">
          Where are you going?
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Tell us about your trip
        </p>
      </div>

      <div className={cn("space-y-4 sm:space-y-5 mx-auto px-1", planMode === 'multi' ? "max-w-xl" : "max-w-md")}>
        {/* Single / Multi-City / Just Tell Us Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mx-auto flex-wrap justify-center">
          <button
            type="button"
            onClick={() => { setPlanMode('single'); handleToggleMultiCity(false); }}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
              planMode === 'single'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            Single City
          </button>
          <button
            type="button"
            onClick={() => { setPlanMode('multi'); handleToggleMultiCity(true); }}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
              planMode === 'multi'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Route className="h-3.5 w-3.5" />
            Multi-City
          </button>
          <button
            type="button"
            onClick={() => setPlanMode('chat')}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
              planMode === 'chat'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            Just Tell Us
          </button>
        </div>

        {/* Chat Mode */}
        {planMode === 'chat' && (
          <TripChatPlanner onDetailsExtracted={onChatDetailsExtracted} />
        )}

        {/* Destination - Single City Mode */}
        {planMode !== 'chat' && !isMultiCity && (
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
            Destination
          </label>
          <DestinationAutocomplete
            value={destinationSelection.display}
            onChange={setDestinationSelection}
            placeholder="Search cities..."
          />
        </div>
        )}

        {/* Multi-City Selector */}
        {planMode !== 'chat' && isMultiCity && (
          <div className="space-y-1.5 sm:space-y-2">
            <MultiCitySelector
              destinations={destinations}
              transports={transports}
              onDestinationsChange={setDestinations}
              onTransportsChange={setTransports}
              startDate={startDate ? format(startDate, 'yyyy-MM-dd') : undefined}
            />
          </div>
        )}

        {/* Dates - mobile optimized */}
        {planMode !== 'chat' && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Arriving
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-11 sm:h-12 justify-between text-left font-normal text-sm',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  {startDate ? format(startDate, 'MMM d') : 'Select'}
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

          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Leaving
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-11 sm:h-12 justify-between text-left font-normal text-sm',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  {endDate ? format(endDate, 'MMM d') : 'Select'}
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
        )}

        {/* Travelers - mobile optimized touch targets */}
        {planMode !== 'chat' && (
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
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
                  'w-11 h-11 sm:w-12 sm:h-12 rounded-lg border-2 transition-all text-sm font-medium min-w-[44px]',
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
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg border-2 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all text-sm min-w-[44px]"
            >
              {travelers > 4 ? travelers : '5+'}
            </button>
        </div>

        {/* Link Friends */}
        {travelers > 1 && (
          <button
            type="button"
            onClick={onOpenGuestModal}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>
              {linkedGuestCount > 0
                ? `${linkedGuestCount} companion${linkedGuestCount > 1 ? 's' : ''} linked`
                : 'Link friends to this trip'}
            </span>
          </button>
        )}
        </div>
        )}

        {/* Trip Type - mobile optimized */}
        {planMode !== 'chat' && (
        <div className="space-y-2 sm:space-y-3">
          <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
            Trip Type
          </label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {tripOccasions.slice(0, 6).map((occasion) => (
              <button
                key={occasion.id}
                type="button"
                onClick={() => setTripType(occasion.id)}
                className={cn(
                  'px-3 py-2 sm:py-1.5 rounded-full border transition-all text-xs sm:text-sm min-h-[40px] sm:min-h-0',
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
        )}

        {/* Celebration Day */}
        {planMode !== 'chat' && CELEBRATION_TRIP_TYPES.includes(tripType as typeof CELEBRATION_TRIP_TYPES[number]) && startDate && endDate && (
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
        {planMode !== 'chat' && (
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
          <CollapsibleContent className="pt-3 space-y-3">
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
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                min={0}
                max={100000}
                placeholder="Or enter your own budget"
                value={budgetAmount && !budgetPresets.some(p => p.value === budgetAmount) ? budgetAmount : ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setBudgetAmount(val > 0 ? val : undefined);
                }}
                onFocus={() => {
                  if (budgetAmount && budgetPresets.some(p => p.value === budgetAmount)) {
                    setBudgetAmount(undefined);
                  }
                }}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
        )}
      </div>

      {/* Navigation — only in form mode */}
      {planMode !== 'chat' && (
        <div className="flex justify-end pt-6 max-w-md mx-auto">
          <Button onClick={onContinue} disabled={!isValid} className="gap-2">
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// Step 2: Flight (optional) & Hotel Selection with full capabilities
function FlightHotelStep({
  destination,
  startDate,
  endDate,
  travelers,
  outboundFlight,
  setOutboundFlight,
  returnFlight,
  setReturnFlight,
  showReturnFlight,
  setShowReturnFlight,
  hotelChoice,
  setHotelChoice,
  manualHotel,
  setManualHotel,
  isFirstTimeVisitor,
  setIsFirstTimeVisitor,
  mustDoActivities,
  setMustDoActivities,
  onSubmit,
  onBack,
  isSubmitting,
}: {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  outboundFlight: ManualFlightEntry;
  setOutboundFlight: (f: ManualFlightEntry) => void;
  returnFlight: ManualFlightEntry;
  setReturnFlight: (f: ManualFlightEntry) => void;
  showReturnFlight: boolean;
  setShowReturnFlight: (s: boolean) => void;
  hotelChoice: 'skip' | 'own' | 'search';
  setHotelChoice: (c: 'skip' | 'own' | 'search') => void;
  manualHotel: ManualHotelEntry;
  setManualHotel: (h: ManualHotelEntry) => void;
  isFirstTimeVisitor: boolean;
  setIsFirstTimeVisitor: (v: boolean) => void;
  mustDoActivities: string;
  setMustDoActivities: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const navigate = useNavigate();
  const [showFlightSection, setShowFlightSection] = useState(false);
  const [showFlightDetails, setShowFlightDetails] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);

  const handleImportFlight = (outbound: ManualFlightEntry, returnFlightData?: ManualFlightEntry) => {
    setOutboundFlight(outbound);
    if (returnFlightData) {
      setReturnFlight(returnFlightData);
      setShowReturnFlight(true);
    }
    setShowFlightSection(true);
    setShowFlightDetails(true);
  };

  const handleSearchHotels = () => {
    const params = new URLSearchParams({
      destination,
      checkIn: startDate,
      checkOut: endDate,
      guests: travelers.toString(),
    });
    navigate(`/planner/hotel?${params.toString()}`);
  };

  const hasFlightData = outboundFlight.arrivalTime || outboundFlight.departureAirport;

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
          Add your travel details for a complete itinerary (both optional)
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-8">
        {/* Flight Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-muted-foreground" />
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Flight Details
              <span className="text-muted-foreground/60 ml-1">(optional)</span>
            </label>
          </div>

          {!showFlightSection && !hasFlightData ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Paste from confirmation
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFlightSection(true)}
                className="flex-1"
              >
                <PenLine className="h-4 w-4 mr-2" />
                Enter manually
              </Button>
            </div>
          ) : (
            <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
              {/* Import button at top */}
              <div className="flex justify-center border-b border-border pb-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setShowImportModal(true)}
                >
                  <Upload className="h-3 w-3 mr-1.5" />
                  Paste from airline confirmation
                </Button>
              </div>

              {/* Outbound Flight */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Outbound Flight
                </h4>
                
                {/* Route */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <AirportAutocomplete
                      value={outboundFlight.departureAirport}
                      onChange={(code) => setOutboundFlight({ ...outboundFlight, departureAirport: code })}
                      placeholder="ATL"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <AirportAutocomplete
                      value={outboundFlight.arrivalAirport}
                      onChange={(code) => setOutboundFlight({ ...outboundFlight, arrivalAirport: code })}
                      placeholder="FCO"
                    />
                  </div>
                </div>

                {/* Date & Times */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      value={outboundFlight.departureDate}
                      onChange={(e) => setOutboundFlight({ ...outboundFlight, departureDate: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Departs</Label>
                    <Input
                      type="time"
                      value={outboundFlight.departureTime}
                      onChange={(e) => setOutboundFlight({ ...outboundFlight, departureTime: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Arrives *</Label>
                    <Input
                      type="time"
                      value={outboundFlight.arrivalTime}
                      onChange={(e) => setOutboundFlight({ ...outboundFlight, arrivalTime: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* More details toggle */}
                <Collapsible open={showFlightDetails} onOpenChange={setShowFlightDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground w-full justify-start px-0">
                      {showFlightDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                      {showFlightDetails ? 'Less details' : 'Add airline & flight number'}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Airline</Label>
                        <Input
                          placeholder="e.g. Delta"
                          value={outboundFlight.airline}
                          onChange={(e) => setOutboundFlight({ ...outboundFlight, airline: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Flight #</Label>
                        <Input
                          placeholder="e.g. DL123"
                          value={outboundFlight.flightNumber}
                          onChange={(e) => setOutboundFlight({ ...outboundFlight, flightNumber: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Return Flight Toggle */}
              <Collapsible open={showReturnFlight} onOpenChange={setShowReturnFlight}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground w-full justify-start">
                    {showReturnFlight ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                    <ArrowRight className="h-4 w-4 rotate-180 mr-2" />
                    {showReturnFlight ? 'Return Flight' : 'Add return flight (optional)'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3 border-t border-border mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <AirportAutocomplete
                        value={returnFlight.departureAirport}
                        onChange={(code) => setReturnFlight({ ...returnFlight, departureAirport: code })}
                        placeholder="FCO"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <AirportAutocomplete
                        value={returnFlight.arrivalAirport}
                        onChange={(code) => setReturnFlight({ ...returnFlight, arrivalAirport: code })}
                        placeholder="ATL"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={returnFlight.departureDate}
                        onChange={(e) => setReturnFlight({ ...returnFlight, departureDate: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Departs *</Label>
                      <Input
                        type="time"
                        value={returnFlight.departureTime}
                        onChange={(e) => setReturnFlight({ ...returnFlight, departureTime: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Arrives</Label>
                      <Input
                        type="time"
                        value={returnFlight.arrivalTime}
                        onChange={(e) => setReturnFlight({ ...returnFlight, arrivalTime: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Clear flight button */}
              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setOutboundFlight({
                      airline: '',
                      flightNumber: '',
                      departureAirport: '',
                      arrivalAirport: '',
                      departureTime: '',
                      arrivalTime: '',
                      departureDate: startDate,
                    });
                    setShowFlightSection(false);
                  }}
                >
                  Clear flight details
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hotel Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Where will you stay?
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* I have my own */}
            <button
              type="button"
              onClick={() => {
                setHotelChoice('own');
                setShowHotelModal(true);
              }}
              className={cn(
                'p-4 rounded-xl border-2 text-center transition-all',
                hotelChoice === 'own'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <PenLine className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">I have my own</div>
              <div className="text-[10px] text-muted-foreground mt-1">Enter details</div>
            </button>

            {/* Search */}
            <button
              type="button"
              onClick={() => {
                setHotelChoice('search');
                handleSearchHotels();
              }}
              className={cn(
                'p-4 rounded-xl border-2 text-center transition-all',
                hotelChoice === 'search'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <Search className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">Search</div>
              <div className="text-[10px] text-muted-foreground mt-1">Browse hotels</div>
            </button>

            {/* Skip */}
            <button
              type="button"
              onClick={() => setHotelChoice('skip')}
              className={cn(
                'p-4 rounded-xl border-2 text-center transition-all',
                hotelChoice === 'skip'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <ArrowRight className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">Skip</div>
              <div className="text-[10px] text-muted-foreground mt-1">Add later</div>
            </button>
          </div>

          {/* Show entered hotel info */}
          {hotelChoice === 'own' && manualHotel.name && (
            <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Hotel className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">{manualHotel.name}</div>
                  {manualHotel.address && (
                    <div className="text-xs text-muted-foreground">{manualHotel.address}</div>
                  )}
                  {manualHotel.pricePerNight && manualHotel.pricePerNight > 0 && (
                    <div className="text-xs text-muted-foreground">
                      ${manualHotel.pricePerNight}/night
                      {manualHotel.includeInBudget && (
                        <span className="ml-1 text-primary">· In budget</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHotelModal(true)}>
                Edit
              </Button>
            </div>
          )}
        </div>

        {/* Personalization Section */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <label className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
              Personalize Your Trip
              <span className="text-muted-foreground/60 ml-1">(optional)</span>
            </label>
          </div>

          {/* First-Time Visitor Toggle */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
            <Checkbox
              id="firstTimeVisitor"
              checked={isFirstTimeVisitor}
              onCheckedChange={(checked) => setIsFirstTimeVisitor(checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <label 
                htmlFor="firstTimeVisitor" 
                className="flex items-center gap-2 text-sm font-medium cursor-pointer"
              >
                <Globe className="w-4 h-4 text-muted-foreground" />
                First time visiting {destination}?
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                {isFirstTimeVisitor 
                  ? "We'll include iconic landmarks and must-see attractions" 
                  : "We'll focus on hidden gems and local favorites"}
              </p>
            </div>
          </div>

          {/* Must-Do Activities */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Star className="w-4 h-4 text-muted-foreground" />
              Must-Do Activities
            </label>
            <Textarea
              value={mustDoActivities}
              onChange={(e) => setMustDoActivities(e.target.value)}
              placeholder={`e.g., Visit the Colosseum, Eat authentic pasta, See the sunset from a rooftop...`}
              className="min-h-[80px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tell us what you absolutely can't miss. We'll make sure it's in your itinerary.
            </p>
          </div>
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

      {/* Flight Import Modal */}
      <FlightImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportFlight}
        tripStartDate={startDate}
        tripEndDate={endDate}
      />

      {/* Manual Hotel Entry Modal */}
      <Dialog open={showHotelModal} onOpenChange={setShowHotelModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-primary" />
              Enter Hotel Details
            </DialogTitle>
            <DialogDescription>
              Add your hotel information for a complete itinerary
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Hotel Name *</Label>
              <HotelAutocomplete
                value={manualHotel.name}
                destination={destination}
                placeholder="Start typing to search hotels..."
                onChange={(hotel) => setManualHotel({ 
                  ...manualHotel, 
                  name: hotel.name, 
                  address: hotel.address || manualHotel.address 
                })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Type to search or enter manually
              </p>
            </div>
            
            <div>
              <Label>Address</Label>
              <Input
                placeholder="e.g. 15 Place Vendôme, 75001 Paris"
                value={manualHotel.address}
                onChange={(e) => setManualHotel({ ...manualHotel, address: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Neighborhood</Label>
              <Input
                placeholder="e.g. 1st Arrondissement"
                value={manualHotel.neighborhood || ''}
                onChange={(e) => setManualHotel({ ...manualHotel, neighborhood: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Check-in Time</Label>
                <Input
                  type="time"
                  value={manualHotel.checkInTime || '15:00'}
                  onChange={(e) => setManualHotel({ ...manualHotel, checkInTime: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Check-out Time</Label>
                <Input
                  type="time"
                  value={manualHotel.checkOutTime || '11:00'}
                  onChange={(e) => setManualHotel({ ...manualHotel, checkOutTime: e.target.value })}
                />
              </div>
            </div>

            {/* Price & Budget Inclusion */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <Label className="text-xs">Price per Night</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 150"
                    className="pl-9"
                    value={manualHotel.pricePerNight || ''}
                    onChange={(e) => setManualHotel({ ...manualHotel, pricePerNight: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={manualHotel.includeInBudget || false}
                  onCheckedChange={(checked) => setManualHotel({ ...manualHotel, includeInBudget: checked === true })}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">Include hotel cost in budget</div>
                  <div className="text-xs text-muted-foreground">Track this expense against your trip budget</div>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHotelModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!manualHotel.name) {
                  toast.error('Please enter the hotel name');
                  return;
                }
                setShowHotelModal(false);
              }}
            >
              Save Hotel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  const DRAFT_STORAGE_KEY = 'voyance_start_draft';

  // Restore draft from sessionStorage (survives auth redirect)
  const savedDraft = (() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  // Current step: 1 = Trip Details, 2 = Flight & Hotel
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showDNAPrompt, setShowDNAPrompt] = useState(false);
  const [planMode, setPlanMode] = useState<'single' | 'multi' | 'chat'>('single');

  // Trip state
  const destinationFromQuery = searchParams.get('destination');
  const [destinationSelection, setDestinationSelection] = useState<LocationSelection>(() => ({
    display: destinationFromQuery || plannerState.basics.destination || savedDraft?.destination || '',
    cityName: destinationFromQuery || plannerState.basics.destination || savedDraft?.destination || '',
    airportCodes: undefined,
  }));
  const [startDate, setStartDate] = useState<Date | undefined>(
    plannerState.basics.startDate ? parseISO(plannerState.basics.startDate)
    : savedDraft?.startDate ? parseISO(savedDraft.startDate)
    : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    plannerState.basics.endDate ? parseISO(plannerState.basics.endDate)
    : savedDraft?.endDate ? parseISO(savedDraft.endDate)
    : undefined
  );
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || savedDraft?.travelers || 2);
  const [tripType, setTripType] = useState<string>(savedDraft?.tripType || 'leisure');
  const [celebrationDay, setCelebrationDay] = useState<number | undefined>(savedDraft?.celebrationDay);
  const [budgetAmount, setBudgetAmount] = useState<number | undefined>(plannerState.basics.budgetAmount || savedDraft?.budgetAmount);
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Multi-city state
  const [isMultiCity, setIsMultiCity] = useState(plannerState.basics.isMultiCity || savedDraft?.isMultiCity || false);
  const [multiCityDestinations, setMultiCityDestinations] = useState<TripDestination[]>(
    plannerState.basics.destinations || savedDraft?.multiCityDestinations || []
  );
  const [multiCityTransports, setMultiCityTransports] = useState<InterCityTransport[]>(
    plannerState.basics.interCityTransports || savedDraft?.multiCityTransports || []
  );
  
  // Flight state
  const [outboundFlight, setOutboundFlight] = useState<ManualFlightEntry>({
    airline: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: '',
    departureTime: '',
    arrivalTime: '',
    departureDate: '',
  });
  const [returnFlight, setReturnFlight] = useState<ManualFlightEntry>({
    airline: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: '',
    departureTime: '',
    arrivalTime: '',
    departureDate: '',
  });
  const [showReturnFlight, setShowReturnFlight] = useState(false);

  // Hotel state
  const [hotelChoice, setHotelChoice] = useState<'skip' | 'own' | 'search'>('skip');
  const [manualHotel, setManualHotel] = useState<ManualHotelEntry>({
    name: '',
    address: '',
    neighborhood: '',
    checkInTime: '15:00',
    checkOutTime: '11:00',
  });

  // Personalization state
  const [isFirstTimeVisitor, setIsFirstTimeVisitor] = useState(true);
  const [mustDoActivities, setMustDoActivities] = useState('');

  // Update flight dates when trip dates change
  useEffect(() => {
    if (startDate && !outboundFlight.departureDate) {
      setOutboundFlight(prev => ({ ...prev, departureDate: format(startDate, 'yyyy-MM-dd') }));
    }
    if (endDate && !returnFlight.departureDate) {
      setReturnFlight(prev => ({ ...prev, departureDate: format(endDate, 'yyyy-MM-dd') }));
    }
  }, [startDate, endDate]);

  // Handle return from quiz — restore step 2 and auto-submit
  useEffect(() => {
    if (searchParams.get('fromQuiz') === 'true' && user?.quizCompleted && savedDraft) {
      // Restore step 2 state from draft
      if (savedDraft.outboundFlight) setOutboundFlight(savedDraft.outboundFlight);
      if (savedDraft.returnFlight) setReturnFlight(savedDraft.returnFlight);
      if (savedDraft.showReturnFlight) setShowReturnFlight(savedDraft.showReturnFlight);
      if (savedDraft.hotelChoice) setHotelChoice(savedDraft.hotelChoice);
      if (savedDraft.manualHotel) setManualHotel(savedDraft.manualHotel);
      if (savedDraft.isFirstTimeVisitor !== undefined) setIsFirstTimeVisitor(savedDraft.isFirstTimeVisitor);
      if (savedDraft.mustDoActivities) setMustDoActivities(savedDraft.mustDoActivities);
      setCurrentStep(savedDraft.currentStep || 2);
      // Clean up the query param
      window.history.replaceState({}, '', '/start');
    }
  }, [searchParams, user]);

  // Check draft limit
  useEffect(() => {
    if (!canCreateDraft && user) {
      setShowLimitBlocker(true);
    }
  }, [canCreateDraft, user]);

  // Handle final submission
  const handleSubmit = async (skipDNACheck = false) => {
    const primaryDestination = isMultiCity
      ? (multiCityDestinations[0]?.city || '')
      : destinationSelection.cityName;

    if (!primaryDestination || !startDate || !endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user needs to authenticate
      if (!user) {
        setBasics({
          destination: destinationSelection.cityName,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          travelers,
          budgetAmount,
        });
        navigate(ROUTES.SIGNUP + '?redirect=' + ROUTES.PLANNER.ITINERARY);
        return;
      }

      // Check if user has Travel DNA — prompt if not
      if (!skipDNACheck && !user.quizCompleted) {
        setIsSubmitting(false);
        setShowDNAPrompt(true);
        return;
      }

      // Build flight selection data
      const flightSelection = outboundFlight.arrivalTime ? {
        departure: {
          airline: outboundFlight.airline,
          flightNumber: outboundFlight.flightNumber,
          departure: { airport: outboundFlight.departureAirport, time: outboundFlight.departureTime },
          arrival: { airport: outboundFlight.arrivalAirport, time: outboundFlight.arrivalTime },
          departureDate: outboundFlight.departureDate,
        },
        return: showReturnFlight && returnFlight.departureTime ? {
          airline: returnFlight.airline,
          flightNumber: returnFlight.flightNumber,
          departure: { airport: returnFlight.departureAirport, time: returnFlight.departureTime },
          arrival: { airport: returnFlight.arrivalAirport, time: returnFlight.arrivalTime },
          departureDate: returnFlight.departureDate,
        } : null,
      } : null;

      // Build hotel selection data
      const hotelSelection = hotelChoice === 'own' && manualHotel.name ? [{
        name: manualHotel.name,
        address: manualHotel.address,
        neighborhood: manualHotel.neighborhood,
        checkInTime: manualHotel.checkInTime,
        checkOutTime: manualHotel.checkOutTime,
        pricePerNight: manualHotel.pricePerNight || undefined,
        source: 'manual',
      }] : null;

      const includeHotelInBudget = manualHotel.includeInBudget && manualHotel.pricePerNight && manualHotel.pricePerNight > 0;

      // Build multi-city name
      const tripName = isMultiCity && multiCityDestinations.length >= 2
        ? multiCityDestinations.map(d => d.city).join(' → ')
        : `Trip to ${primaryDestination}`;

      // Save trip directly to database
      const { data: trip, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          name: tripName,
          destination: primaryDestination,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          travelers,
          trip_type: tripType,
          budget_tier: budgetAmount ? (budgetAmount < 750 ? 'budget' : budgetAmount < 2000 ? 'moderate' : budgetAmount < 4000 ? 'premium' : 'luxury') : 'moderate',
          budget_total_cents: budgetAmount ? budgetAmount * 100 : null,
          flight_selection: flightSelection,
          hotel_selection: hotelSelection,
          budget_include_hotel: includeHotelInBudget || false,
          is_multi_city: isMultiCity || null,
          destinations: isMultiCity ? multiCityDestinations as any : null,
          transportation_preferences: isMultiCity && multiCityTransports.length > 0 ? multiCityTransports as any : null,
          status: 'draft',
          metadata: {
            isFirstTimeVisitor,
            mustDoActivities: mustDoActivities || null,
            celebrationDay: celebrationDay || null,
            lastUpdated: new Date().toISOString(),
          },
        })
        .select('id')
        .single();

      if (error) throw error;

      // Persist per-city rows for multi-city trips
      if (isMultiCity && multiCityDestinations.length >= 2) {
        const datesWithDates = multiCityDestinations.map((d, i) => {
          // Calculate arrival/departure dates sequentially from start
          let arrival = new Date(startDate!);
          for (let j = 0; j < i; j++) {
            arrival.setDate(arrival.getDate() + multiCityDestinations[j].nights);
          }
          const departure = new Date(arrival);
          departure.setDate(departure.getDate() + d.nights);
          return { ...d, arrivalDate: format(arrival, 'yyyy-MM-dd'), departureDate: format(departure, 'yyyy-MM-dd') };
        });

        const cityRows = datesWithDates.map((d, i) => ({
          trip_id: trip.id,
          city_order: i,
          city_name: d.city,
          country: d.country || null,
          arrival_date: d.arrivalDate,
          departure_date: d.departureDate,
          nights: d.nights,
          transport_type: i > 0 && multiCityTransports[i - 1]
            ? multiCityTransports[i - 1].type
            : null,
          transport_details: i > 0 && multiCityTransports[i - 1]
            ? { fromCity: multiCityTransports[i - 1].fromCity, toCity: multiCityTransports[i - 1].toCity }
            : null,
          transition_day_mode: i > 0 && multiCityTransports[i - 1]
            ? multiCityTransports[i - 1].transitionDay || 'half_and_half'
            : null,
          generation_status: 'pending' as const,
          days_total: d.nights,
        }));

        const { error: citiesError } = await supabase.from('trip_cities').insert(cityRows as any[]);
        if (citiesError) {
          console.error('[Start] Failed to persist trip_cities:', citiesError);
          // Non-fatal: edge function can fall back to destinations JSONB
        } else {
          console.log(`[Start] Persisted ${cityRows.length} trip_cities for trip ${trip.id}`);
        }
      }

      // Insert linked guests as trip collaborators
      if (linkedGuests.length > 0) {
        const collabRows = linkedGuests
          .filter((g) => g.isVoyanceUser) // Only insert Voyance users; email invites handled separately
          .map((g) => ({
            trip_id: trip.id,
            user_id: g.id,
            permission: g.permission,
            invited_by: user.id,
            accepted_at: new Date().toISOString(),
            include_preferences: g.includePreferences,
          }));
        if (collabRows.length > 0) {
          const { error: collabError } = await supabase
            .from('trip_collaborators')
            .insert(collabRows);
          if (collabError) {
            console.error('[Start] Failed to insert collaborators:', collabError);
          } else {
            console.log(`[Start] Linked ${collabRows.length} guests to trip ${trip.id}`);
          }
        }
      }

      // Navigate directly to trip page with generate flag
      navigate(`/trip/${trip.id}?generate=true`);
    } catch (err) {
      console.error('Error starting trip:', err);
      toast.error('Something went wrong. Please try again.');
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
                    onOpenGuestModal={() => setShowGuestModal(true)}
                    linkedGuestCount={linkedGuests.length}
                    tripType={tripType}
                    setTripType={setTripType}
                    celebrationDay={celebrationDay}
                    setCelebrationDay={setCelebrationDay}
                    budgetAmount={budgetAmount}
                    setBudgetAmount={setBudgetAmount}
                    isMultiCity={isMultiCity}
                    setIsMultiCity={setIsMultiCity}
                    destinations={multiCityDestinations}
                    setDestinations={setMultiCityDestinations}
                    transports={multiCityTransports}
                    setTransports={setMultiCityTransports}
                    planMode={planMode}
                    setPlanMode={(m) => {
                      setPlanMode(m);
                      if (m === 'single') setIsMultiCity(false);
                      else if (m === 'multi') setIsMultiCity(true);
                    }}
                    onChatDetailsExtracted={(details) => {
                      // Populate form state from chat-extracted details
                      if (details.destination) {
                        setDestinationSelection({ display: details.destination, cityName: details.destination });
                      }
                      if (details.startDate) {
                        try { setStartDate(parseISO(details.startDate)); } catch {}
                      }
                      if (details.endDate) {
                        try { setEndDate(parseISO(details.endDate)); } catch {}
                      }
                      if (details.travelers) setTravelers(details.travelers);
                      if (details.tripType) setTripType(details.tripType);
                      if (details.budgetAmount) setBudgetAmount(details.budgetAmount);
                      if (details.hotelName) {
                        setManualHotel(prev => ({ ...prev, name: details.hotelName, address: details.hotelAddress || '' }));
                      }
                      if (details.mustDoActivities) setMustDoActivities(details.mustDoActivities);
                      // Skip to submission (handleSubmit handles auth + DNA checks)
                      handleSubmit(false);
                    }}
                    onContinue={() => {
                      if (!user) {
                        const dest = isMultiCity
                          ? (multiCityDestinations[0]?.city || '')
                          : destinationSelection.cityName;
                        // Persist draft to sessionStorage so it survives auth redirect
                        const draft = {
                          destination: dest,
                          startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                          endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
                          travelers,
                          budgetAmount,
                          tripType,
                          celebrationDay,
                          isMultiCity,
                          multiCityDestinations,
                          multiCityTransports,
                        };
                        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
                        setBasics({
                          destination: dest,
                          startDate: draft.startDate,
                          endDate: draft.endDate,
                          travelers,
                          budgetAmount,
                          isMultiCity,
                          destinations: multiCityDestinations,
                          interCityTransports: multiCityTransports,
                        });
                        setShowAuthGate(true);
                        return;
                      }
                      // Clear draft — user is authenticated and proceeding
                      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                    }}
                  />
                )}

                {currentStep === 2 && startDate && endDate && (
                  <FlightHotelStep
                    key="flight-hotel"
                    destination={isMultiCity ? (multiCityDestinations[0]?.city || '') : destinationSelection.cityName}
                    startDate={format(startDate, 'yyyy-MM-dd')}
                    endDate={format(endDate, 'yyyy-MM-dd')}
                    travelers={travelers}
                    outboundFlight={outboundFlight}
                    setOutboundFlight={setOutboundFlight}
                    returnFlight={returnFlight}
                    setReturnFlight={setReturnFlight}
                    showReturnFlight={showReturnFlight}
                    setShowReturnFlight={setShowReturnFlight}
                    hotelChoice={hotelChoice}
                    setHotelChoice={setHotelChoice}
                    manualHotel={manualHotel}
                    setManualHotel={setManualHotel}
                    isFirstTimeVisitor={isFirstTimeVisitor}
                    setIsFirstTimeVisitor={setIsFirstTimeVisitor}
                    mustDoActivities={mustDoActivities}
                    setMustDoActivities={setMustDoActivities}
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

      {/* Auth Gate Dialog */}
      <Dialog open={showAuthGate} onOpenChange={setShowAuthGate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create a free account to save your trip
            </DialogTitle>
            <DialogDescription>
              Sign in or create an account to save your trip details, build your itinerary, and access it anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => navigate(ROUTES.SIGNUP + '?redirect=' + encodeURIComponent('/start'))}
              className="w-full gap-2"
            >
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(ROUTES.SIGNIN + '?redirect=' + encodeURIComponent('/start'))}
              className="w-full"
            >
              I already have an account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Travel DNA Prompt Dialog */}
      <Dialog open={showDNAPrompt} onOpenChange={setShowDNAPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              One last thing before we generate this
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              We don't have your Travel DNA yet — we don't know what makes you, <em>you</em>. 
              This trip probably won't be as customized without it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Take a quick 5-minute quiz so we can make this trip truly yours — personalized to your pace, 
            style, and the things you actually care about.
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => {
                // Save draft so it survives the quiz detour
                const dest = isMultiCity
                  ? (multiCityDestinations[0]?.city || destinationSelection.cityName)
                  : destinationSelection.cityName;
                const draft = {
                  destination: dest,
                  startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                  endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
                  travelers,
                  budgetAmount,
                  tripType,
                  celebrationDay,
                  isMultiCity,
                  multiCityDestinations,
                  multiCityTransports,
                  outboundFlight,
                  returnFlight,
                  showReturnFlight,
                  hotelChoice,
                  manualHotel,
                  isFirstTimeVisitor,
                  mustDoActivities,
                  currentStep: 2,
                };
                sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
                sessionStorage.setItem('postQuizRedirect', '/start?fromQuiz=true');
                setShowDNAPrompt(false);
                navigate('/quiz');
              }}
              className="w-full gap-2"
            >
              Take the Quiz
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setShowDNAPrompt(false);
                handleSubmit(true);
              }}
            >
              Continue without personalizing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guest Link Modal */}
      <GuestLinkModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        maxGuests={Math.max(0, travelers - 1) + 1}
        currentTravelers={travelers}
        initialGuests={linkedGuests}
        onGuestsConfirmed={(guests) => {
          setLinkedGuests(guests);
          // Auto-bump traveler count if guests exceed current count
          if (guests.length + 1 > travelers) {
            setTravelers(guests.length + 1);
          }
        }}
      />
    </MainLayout>
  );
}
