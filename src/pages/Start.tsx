import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Calendar as CalendarIcon, Users, Loader2, DollarSign, 
  Sparkles, ChevronDown, ChevronUp, PartyPopper, ArrowRight, Check, Clock,
  Eye, Gem, Utensils, Building2, Plane, Upload, Hotel, Search, PenLine, Globe, Star, Route, UserPlus, MessageSquareText, Plus, Trash2
} from 'lucide-react';
import { addDays as addDaysUtil } from 'date-fns';
import MultiCitySelector from '@/components/planner/MultiCitySelector';
import { InterCityTransportComparison, type CityTransition } from '@/components/planner/InterCityTransportComparison';
import type { TransportOption } from '@/components/itinerary/EditorialItinerary';
import MultiLegFlightEditor from '@/components/planner/flight/MultiLegFlightEditor';
import { TripDestination, InterCityTransport, calculateTotalNights, generateDestinationDates } from '@/types/multiCity';
import { format, addDays, isBefore, startOfToday, startOfMonth, differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
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
import { Switch } from '@/components/ui/switch';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { splitJourneyIfNeeded } from '@/utils/splitJourneyIfNeeded';

// Import destination autocomplete and airport autocomplete
import { DestinationAutocomplete } from '@/components/planner/shared/DestinationAutocomplete';
import { AirportAutocomplete } from '@/components/common/AirportAutocomplete';
import { AirlineAutocomplete } from '@/components/common/AirlineAutocomplete';
import { HotelAutocomplete } from '@/components/common/HotelAutocomplete';
import { FlightImportModal } from '@/components/itinerary/FlightImportModal';
import type { ManualFlightEntry } from '@/components/itinerary/AddBookingInline';
import { buildFlightSelectionFromLegs, type FlightLeg } from '@/utils/normalizeFlightSelection';
import GuestLinkModal, { type LinkedGuest } from '@/components/planner/GuestLinkModal';
import { TripChatPlanner } from '@/components/planner/TripChatPlanner';
import { MustSeeLandmarkPicker } from '@/components/planner/MustSeeLandmarkPicker';
import { GenerationRules, type GenerationRule } from '@/components/planner/GenerationRules';
import { ManualTripPasteEntry } from '@/components/planner/ManualTripPasteEntry';
import { TripCostEstimate } from '@/components/planner/TripCostEstimate';
import { resolveCities } from '@/utils/cityNormalization';
import logger from '@/lib/logger';

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
  checkInDate?: string;
  checkOutDate?: string;
  pricePerNight?: number;
  includeInBudget?: boolean;
  accommodationType?: 'hotel' | 'airbnb' | 'rental' | 'hostel' | 'other';
}

interface ChatCityInput {
  name: string;
  country?: string;
  nights: number;
}

// Note: City normalization logic has been centralized in src/utils/cityNormalization.ts
// Both TripChatPlanner (UI) and Start.tsx (persistence) use the same resolveCities() function.

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

// Pacing options
const pacingOptions = [
  { id: 'relaxed' as const, label: 'Relaxed', description: '2-3 activities/day', emoji: '🌿' },
  { id: 'balanced' as const, label: 'Balanced', description: '4-5 activities/day', emoji: '⚖️' },
  { id: 'packed' as const, label: 'Full Day', description: '6+ activities/day', emoji: '🔥' },
];

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
    image: toSiteImageUrlFromPhotoId('photo-1493976040374-85c8e12f0c0e'),
  },
  {
    destination: 'Amalfi Coast',
    duration: '7 days',
    highlight: 'Cliffside dinner in Ravello',
    tags: ['Romance', 'Cuisine'],
    image: toSiteImageUrlFromPhotoId('photo-1534113414509-0eec2bfb493f'),
  },
  {
    destination: 'Bali',
    duration: '6 days',
    highlight: 'Private temple ceremony',
    tags: ['Wellness', 'Adventure'],
    image: toSiteImageUrlFromPhotoId('photo-1537996194471-e657df975ab4'),
  },
];

// Progress Step Indicator
function StepIndicator({ currentStep, isMultiCity }: { currentStep: number; isMultiCity?: boolean }) {
  const steps = [
    { label: 'Trip Details', shortLabel: 'Details', step: 1 },
    { label: isMultiCity ? 'Transport & Hotel' : 'Flight & Hotel', shortLabel: isMultiCity ? 'Transport' : 'Flight', step: 2 },
    { label: 'Fine-Tune', shortLabel: 'Tune', step: 3 },
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
                'text-[10px] sm:text-xs mt-1 font-medium text-center',
                currentStep === s.step ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span className="hidden xs:inline">{s.label}</span>
              <span className="xs:hidden">{s.shortLabel}</span>
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

// Date range picker — single calendar, two-click flow
function DateRangePicker({
  startDate, endDate, setStartDate, setEndDate,
  calendarMonth, setCalendarMonth, today,
}: {
  startDate: Date | undefined;
  endDate: Date | undefined;
  setStartDate: (d: Date | undefined) => void;
  setEndDate: (d: Date | undefined) => void;
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  today: Date;
}) {
  const [open, setOpen] = useState(false);
  // 'start' = next click sets arrival; 'end' = next click sets departure
  const [picking, setPicking] = useState<'start' | 'end'>('start');

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    if (picking === 'start') {
      setStartDate(date);
      // If new start is after current end, clear end
      if (endDate && isBefore(endDate, date)) {
        setEndDate(undefined);
      }
      setPicking('end');
    } else {
      // If picked date is before start, treat it as new start
      if (startDate && isBefore(date, startDate)) {
        setStartDate(date);
        setEndDate(undefined);
        setPicking('end');
        return;
      }
      setEndDate(date);
      setPicking('start');
      setOpen(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // If both dates set, clicking opens in "start" mode to re-pick
      setPicking(startDate && !endDate ? 'end' : 'start');
      if (startDate) setCalendarMonth(startOfMonth(startDate));
    }
  };

  const nightCount = startDate && endDate ? differenceInDays(endDate, startDate) : null;

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
        Dates
      </label>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full h-11 sm:h-12 justify-between text-left font-normal text-sm',
              !startDate && !endDate && 'text-muted-foreground'
            )}
          >
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 opacity-50" />
              {startDate && endDate
                ? `${format(startDate, 'MMM d')} → ${format(endDate, 'MMM d')}${nightCount ? ` (${nightCount} nights)` : ''}`
                : startDate
                  ? `${format(startDate, 'MMM d')} → select end`
                  : 'Select dates'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="px-3 pt-3 pb-1">
            <p className="text-xs text-muted-foreground text-center">
              {picking === 'start' ? 'Pick your arrival date' : 'Now pick your departure date'}
            </p>
          </div>
          <Calendar
            mode="single"
            selected={picking === 'start' ? startDate : endDate}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelect={handleSelect}
            disabled={(date) => isBefore(date, today)}
            initialFocus
            className="p-3 pointer-events-auto"
            modifiers={{
              range_start: startDate ? [startDate] : [],
              range_end: endDate ? [endDate] : [],
              range_middle: startDate && endDate
                ? { after: startDate, before: endDate }
                : [],
            }}
            modifiersClassNames={{
              range_start: 'bg-primary text-primary-foreground rounded-l-md',
              range_end: 'bg-primary text-primary-foreground rounded-r-md',
              range_middle: 'bg-accent text-accent-foreground',
            }}
          />
        </PopoverContent>
      </Popover>
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
  pacing,
  setPacing,
  onChatDetailsExtracted,
  onContinue,
  onManualAuthRequired,
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
  planMode: 'single' | 'multi' | 'chat' | 'manual';
  setPlanMode: (m: 'single' | 'multi' | 'chat' | 'manual') => void;
  pacing: 'relaxed' | 'balanced' | 'packed';
  setPacing: (p: 'relaxed' | 'balanced' | 'packed') => void;
  onChatDetailsExtracted: (details: any) => void;
  onContinue: () => void;
  onManualAuthRequired: () => void;
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

  // Guard: skip forward sync when reverse sync just updated destinations
  const reverseSyncRef = React.useRef(false);
  const [customBudgetActive, setCustomBudgetActive] = useState(false);

  // Auto-calculate end date for multi-city mode (forward sync: destinations → endDate)
  useEffect(() => {
    if (reverseSyncRef.current) {
      reverseSyncRef.current = false;
      return;
    }
    if (isMultiCity && startDate && destinations.length > 0) {
      const totalNights = calculateTotalNights(destinations);
      if (totalNights > 0) {
        setEndDate(addDaysUtil(startDate, totalNights));
      }
    }
  }, [isMultiCity, startDate, destinations, setEndDate]);

  // Reverse sync: when user manually changes endDate in multi-city mode,
  // adjust the last city's nights to match the new total trip length
  const prevEndDateRef = React.useRef<Date | undefined>(endDate);
  useEffect(() => {
    if (!isMultiCity || !startDate || !endDate || destinations.length === 0) {
      prevEndDateRef.current = endDate;
      return;
    }
    const prevEnd = prevEndDateRef.current;
    prevEndDateRef.current = endDate;

    // Only act when endDate actually changed (not from our own forward sync)
    const totalNightsFromDates = differenceInDays(endDate, startDate);
    const currentNightsSum = calculateTotalNights(destinations);
    const delta = totalNightsFromDates - currentNightsSum;

    if (delta === 0 || totalNightsFromDates < destinations.length) return; // can't go below 1/city

    const lastCity = destinations[destinations.length - 1];
    const newNights = Math.max(1, Math.min(14, lastCity.nights + delta));
    if (newNights === lastCity.nights) return;

    const updated = destinations.map((d, i) =>
      i === destinations.length - 1 ? { ...d, nights: newNights } : d
    );
    reverseSyncRef.current = true; // prevent forward sync from overwriting endDate
    setDestinations(updated);
    toast.info(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} night${Math.abs(delta) !== 1 ? 's' : ''} ${delta > 0 ? 'to' : 'from'} ${lastCity.city}`);
  }, [endDate]);

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
        {/* Plan Mode Selection */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {[
            { mode: 'single' as const, icon: MapPin, label: 'Single City', tooltip: 'AI-powered itinerary for one destination. We handle everything.', onClick: () => { setPlanMode('single'); handleToggleMultiCity(false); } },
            { mode: 'multi' as const, icon: Route, label: 'Multi-City', tooltip: 'Plan a trip across multiple cities with smart inter-city logistics.', onClick: () => { setPlanMode('multi'); handleToggleMultiCity(true); } },
            { mode: 'chat' as const, icon: MessageSquareText, label: 'Just Tell Us', tooltip: 'Describe your dream trip or paste research. Our AI builds it for you.', onClick: () => setPlanMode('chat') },
            { mode: 'manual' as const, icon: PenLine, label: 'Build Myself', tooltip: 'Full manual control. Organize your own research without AI generation.', onClick: () => setPlanMode('manual') },
          ].map(({ mode, icon: Icon, label, tooltip, onClick }) => (
            <div key={mode} className="relative group">
              <button
                type="button"
                onClick={onClick}
                className={cn(
                  'w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-center transition-all duration-200',
                  planMode === mode
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/30'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4 transition-colors',
                  planMode === mode ? 'text-primary' : 'text-muted-foreground'
                )} />
                <span className={cn(
                  'text-[11px] sm:text-xs font-medium leading-tight',
                  planMode === mode ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {label}
                </span>
              </button>
              {/* Hover tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 px-3 py-2 rounded-lg bg-foreground text-background text-[11px] leading-snug text-center opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-lg">
                {tooltip}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-foreground" />
              </div>
            </div>
          ))}
        </div>

        {/* Chat Mode */}
        {planMode === 'chat' && (
          <TripChatPlanner onDetailsExtracted={onChatDetailsExtracted} />
        )}

        {/* Manual Build Mode */}
        {planMode === 'manual' && (
          <ManualTripPasteEntry onAuthRequired={onManualAuthRequired} />
        )}

        {/* Destination - Single City Mode */}
        {planMode !== 'chat' && planMode !== 'manual' && !isMultiCity && (
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
        {planMode !== 'chat' && planMode !== 'manual' && isMultiCity && (
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

        {/* Dates - single range picker */}
        {planMode !== 'chat' && planMode !== 'manual' && (
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          today={today}
        />
        )}

        {/* Travelers - mobile optimized touch targets */}
        {planMode !== 'manual' && (
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
            Travelers
          </label>
          <div className="flex items-center gap-2 flex-wrap">
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
            {/* Stepper for 5+ */}
            <div className={cn(
              'flex items-center rounded-lg border-2 transition-all overflow-hidden',
              travelers >= 5 ? 'border-primary' : 'border-border'
            )}>
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(5, travelers - 1);
                  setTravelers(next);
                  if (next === 1 && tripType !== 'solo') setTripType('solo');
                  else if (next > 1 && tripType === 'solo') setTripType('leisure');
                }}
                disabled={travelers <= 5}
                className="w-9 h-11 sm:w-10 sm:h-12 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                −
              </button>
              <span className={cn(
                'w-9 sm:w-10 text-center text-sm font-medium tabular-nums',
                travelers >= 5 ? 'text-primary' : 'text-muted-foreground'
              )}>
                {travelers >= 5 ? travelers : '5'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = travelers >= 5 ? travelers + 1 : 5;
                  setTravelers(Math.min(20, next));
                  if (tripType === 'solo') setTripType('leisure');
                }}
                className="w-9 h-11 sm:w-10 sm:h-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                +
              </button>
            </div>
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
        {planMode !== 'chat' && planMode !== 'manual' && (
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
        {planMode !== 'chat' && planMode !== 'manual' && CELEBRATION_TRIP_TYPES.includes(tripType as typeof CELEBRATION_TRIP_TYPES[number]) && startDate && endDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
             <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground flex items-center gap-1.5">
               <PartyPopper className="h-3.5 w-3.5 text-amber-500" />
              Which day is the celebration?
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) },
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
        {planMode !== 'chat' && planMode !== 'manual' && (
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
                  onClick={() => { setCustomBudgetActive(false); setBudgetAmount(preset.value); }}
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
                value={customBudgetActive ? (budgetAmount ?? '') : (budgetAmount && !budgetPresets.some(p => p.value === budgetAmount) ? budgetAmount : '')}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setBudgetAmount(val > 0 ? val : undefined);
                }}
                onFocus={() => { setCustomBudgetActive(true); }}
                onBlur={() => { setCustomBudgetActive(false); }}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
        )}

        {/* Credit Cost Estimate */}
        {planMode !== 'chat' && planMode !== 'manual' && startDate && endDate && (
          <TripCostEstimate
            tripDays={differenceInDays(endDate, startDate) + 1}
            cities={isMultiCity && destinations.length > 0 ? destinations.map(d => d.city) : undefined}
          />
        )}
      </div>

      {/* Navigation — only in form mode */}
      {planMode !== 'chat' && planMode !== 'manual' && (
        <div className="flex justify-end pt-6 max-w-md mx-auto">
          <Button 
            onClick={() => {
              if (!isValid) {
                const missing: string[] = [];
                if (isMultiCity ? destinations.length < 2 : !destinationSelection.cityName) missing.push('destination');
                if (!startDate || !endDate) missing.push('travel dates');
                toast.error(`Please fill in: ${missing.join(' and ')}`);
                return;
              }
              onContinue();
            }} 
            className="gap-2"
          >
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
  additionalLegs,
  setAdditionalLegs,
   hotelChoice,
   setHotelChoice,
   manualHotel,
   setManualHotel,
   manualHotelList,
   setManualHotelList,
   manualHotels,
   setManualHotels,
  isFirstTimeVisitor,
  setIsFirstTimeVisitor,
  firstTimePerCity,
  setFirstTimePerCity,
  onSubmit,
  onBack,
  isSubmitting,
  isMultiCity,
  multiCityDestinations,
  multiCityTransports,
  setMultiCityTransports,
  transportSelections,
  onTransportSelect,
  onIntelligenceCapture,
  flightIntelligence,
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
  additionalLegs: ManualFlightEntry[];
  setAdditionalLegs: (legs: ManualFlightEntry[]) => void;
  hotelChoice: 'skip' | 'own';
  setHotelChoice: (c: 'skip' | 'own') => void;
  manualHotel: ManualHotelEntry;
  setManualHotel: (h: ManualHotelEntry) => void;
  manualHotelList: ManualHotelEntry[];
  setManualHotelList: (h: ManualHotelEntry[]) => void;
  manualHotels: Record<string, ManualHotelEntry[]>;
  setManualHotels: (h: Record<string, ManualHotelEntry[]>) => void;
  isFirstTimeVisitor: boolean;
  setIsFirstTimeVisitor: (v: boolean) => void;
  firstTimePerCity: Record<string, boolean>;
  setFirstTimePerCity: (v: Record<string, boolean>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  isMultiCity?: boolean;
  multiCityDestinations?: TripDestination[];
  multiCityTransports?: InterCityTransport[];
  setMultiCityTransports?: (transports: InterCityTransport[]) => void;
  transportSelections?: Record<number, { optionId: string; option: TransportOption }>;
  onTransportSelect?: (transitionIndex: number, option: TransportOption) => void;
  onIntelligenceCapture?: (intel: Record<string, unknown>) => void;
  flightIntelligence?: Record<string, unknown> | null;
}) {
  const navigate = useNavigate();
  const hasExistingFlightData = !!(outboundFlight.departureAirport || outboundFlight.arrivalTime || outboundFlight.airline);
  const [showFlightSection, setShowFlightSection] = useState(hasExistingFlightData);
  const [showFlightDetails, setShowFlightDetails] = useState(hasExistingFlightData);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [editingHotelIndex, setEditingHotelIndex] = useState<number | null>(null); // for split-stay editing
  const [editingHotelCity, setEditingHotelCity] = useState<string | null>(null);
  const [newHotelDraft, setNewHotelDraft] = useState<ManualHotelEntry>({
    name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00',
    checkInDate: startDate, checkOutDate: endDate,
  });
  const [lastImportedLegs, setLastImportedLegs] = useState<ManualFlightEntry[]>([]);
  const [importNonce, setImportNonce] = useState(0);

  // Memoize transport selections to avoid new object reference on every render
  const computedTransportSelections = useMemo(() => {
    type LT = 'flight' | 'train' | 'bus' | 'car' | 'ferry';
    const fromSelections: Record<number, { type: LT }> = {};
    if (transportSelections) {
      Object.entries(transportSelections).forEach(([k, v]) => {
        fromSelections[Number(k)] = { type: (v.option?.mode || 'flight') as LT };
      });
    }
    const merged: Record<number, { type: LT }> = {};
    (multiCityTransports || []).forEach((t, i) => {
      merged[i] = { type: (fromSelections[i]?.type || t.type || 'flight') as LT };
    });
    Object.entries(fromSelections).forEach(([k, v]) => {
      if (!(Number(k) in merged)) merged[Number(k)] = v;
    });
    return Object.keys(merged).length > 0 ? merged : undefined;
  }, [transportSelections, multiCityTransports]);

  const normalizeLegs = (legs: ManualFlightEntry[]): ManualFlightEntry[] => {
    const hasContent = (leg: ManualFlightEntry) => Boolean(
      leg.airline ||
      leg.flightNumber ||
      leg.departureAirport ||
      leg.arrivalAirport ||
      leg.departureTime ||
      leg.arrivalTime ||
      leg.price
    );

    const makeKey = (leg: ManualFlightEntry) => [
      leg.airline || '',
      leg.flightNumber || '',
      leg.departureAirport || '',
      leg.arrivalAirport || '',
      leg.departureTime || '',
      leg.arrivalTime || '',
      leg.departureDate || '',
      Number(leg.price || 0),
    ].join('|').toLowerCase();

    const seen = new Set<string>();
    return legs.filter((leg) => {
      if (!hasContent(leg)) return false;
      const key = makeKey(leg);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleImportFlight = (outbound: ManualFlightEntry, returnFlightData?: ManualFlightEntry) => {
    setOutboundFlight(outbound);
    if (returnFlightData) {
      setReturnFlight(returnFlightData);
      setShowReturnFlight(true);
    }
    setShowFlightSection(true);
    setShowFlightDetails(true);
  };

  const handleImportAllLegs = (legs: ManualFlightEntry[]) => {
    const normalizedLegs = normalizeLegs(legs);
    if (normalizedLegs.length === 0) return;

    setLastImportedLegs(normalizedLegs);
    setImportNonce((n) => n + 1);

    // First leg = outbound
    setOutboundFlight(normalizedLegs[0]);
    // Last leg = return (if more than 1)
    if (normalizedLegs.length >= 2) {
      setReturnFlight(normalizedLegs[normalizedLegs.length - 1]);
      setShowReturnFlight(true);
    }
    // Middle legs stored separately
    if (normalizedLegs.length > 2) {
      setAdditionalLegs(normalizedLegs.slice(1, -1));
    } else {
      setAdditionalLegs([]);
    }
    setShowFlightSection(true);
    setShowFlightDetails(true);
    if (normalizedLegs.length > 2) {
      toast.success(`Imported ${normalizedLegs.length} flight segments`, {
        description: `Route: ${normalizedLegs.map(l => l.departureAirport).concat(normalizedLegs[normalizedLegs.length - 1].arrivalAirport).filter(Boolean).join(' → ')}`,
      });
    }
  };

  // Handler for multi-leg editor changes — syncs back to parent state (idempotent)
  const lastMultiLegSig = useRef<string>('');
  const handleMultiLegsChange = (legs: ManualFlightEntry[]) => {
    const normalizedLegs = normalizeLegs(legs);

    // Build a signature to skip no-op updates
    const makeKey = (l: ManualFlightEntry) => [l.airline,l.flightNumber,l.departureAirport,l.arrivalAirport,l.departureTime,l.arrivalTime,l.departureDate,l.price,l.isDestinationArrival,l.isDestinationDeparture].join('|');
    const sig = normalizedLegs.map(makeKey).join('||');
    if (sig === lastMultiLegSig.current) return;
    lastMultiLegSig.current = sig;

    if (normalizedLegs.length > 0) {
      setOutboundFlight(normalizedLegs[0]);
    }
    if (normalizedLegs.length >= 2) {
      setReturnFlight(normalizedLegs[normalizedLegs.length - 1]);
      setShowReturnFlight(true);
    }
    if (normalizedLegs.length > 2) {
      setAdditionalLegs(normalizedLegs.slice(1, -1));
    } else {
      setAdditionalLegs([]);
    }
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
          {isMultiCity ? 'Transportation & Hotel' : 'Flight & Hotel'}
        </h2>
        <p className="text-muted-foreground">
          Add your travel details for a complete itinerary (both optional)
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-6 sm:space-y-8 [&_input]:h-9 sm:[&_input]:h-10 [&_textarea]:min-h-[60px]">
        {/* Flight Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-1.5">
            <Plane className="h-3.5 w-3.5 text-muted-foreground" />
            <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
              {isMultiCity ? 'Transportation Details' : 'Flight Details'}
              <span className="text-muted-foreground/60 ml-1">(optional)</span>
            </label>
          </div>

          {/* Multi-city: show multi-leg flight editor */}
          {isMultiCity && multiCityDestinations && multiCityDestinations.length >= 2 ? (
            <MultiLegFlightEditor
              destinations={multiCityDestinations}
              startDate={startDate}
              endDate={endDate}
              transportSelections={computedTransportSelections}
              onLegsChange={handleMultiLegsChange}
              onTransportModeChange={(transitionIndex, mode) => {
                if (setMultiCityTransports && multiCityTransports) {
                  setMultiCityTransports(multiCityTransports.map((t, i) =>
                    i === transitionIndex ? { ...t, type: mode as InterCityTransport['type'] } : t
                  ));
                }
              }}
              onOpenImport={() => setShowImportModal(true)}
              initialOutbound={outboundFlight}
              initialReturn={returnFlight}
              initialAdditionalLegs={additionalLegs}
              importedLegs={lastImportedLegs}
              importNonce={importNonce}
            />
          ) : (
            /* Single-city: keep current outbound + return layout */
            <>
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
                <div className="space-y-3 p-3 sm:p-4 rounded-xl border border-border bg-card">
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
                    <h4 className="font-medium text-xs sm:text-sm flex items-center gap-1.5">
                      <ArrowRight className="h-4 w-4" />
                      Outbound Flight
                    </h4>
                    
                    {/* Route */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={outboundFlight.departureDate}
                          onChange={(e) => setOutboundFlight({ ...outboundFlight, departureDate: e.target.value })}
                          className="text-xs h-8"
                        />
                      </div>
                      <div className="flex w-full gap-4">
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Departs</Label>
                          <Input
                            type="time"
                            value={outboundFlight.departureTime}
                            onChange={(e) => setOutboundFlight({ ...outboundFlight, departureTime: e.target.value })}
                            className="text-xs h-8 w-full"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Arrives *</Label>
                          <Input
                            type="time"
                            value={outboundFlight.arrivalTime}
                            onChange={(e) => setOutboundFlight({ ...outboundFlight, arrivalTime: e.target.value })}
                            className="text-xs h-8 w-full"
                          />
                        </div>
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
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Airline</Label>
                            <AirlineAutocomplete
                              value={outboundFlight.airline}
                              onChange={(val) => setOutboundFlight({ ...outboundFlight, airline: val })}
                              placeholder="e.g. Delta"
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

                  {/* Connection / Additional Legs */}
                  {additionalLegs.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <h4 className="font-medium text-xs sm:text-sm flex items-center gap-1.5 text-muted-foreground">
                        <Plane className="h-3.5 w-3.5" />
                        Connection Flights ({additionalLegs.length})
                      </h4>
                      {additionalLegs.map((leg, idx) => (
                        <Collapsible key={idx}>
                          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">
                                  {leg.departureAirport || '???'} → {leg.arrivalAirport || '???'}
                                </span>
                                {leg.airline && (
                                  <span className="text-muted-foreground text-xs">
                                    {leg.airline} {leg.flightNumber}
                                  </span>
                                )}
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            {(leg.departureDate || leg.departureTime || leg.arrivalTime) && (
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                {leg.departureDate && <span>{leg.departureDate}</span>}
                                {leg.departureTime && <span>Dep {leg.departureTime}</span>}
                                {leg.arrivalTime && <span>Arr {leg.arrivalTime}</span>}
                              </div>
                            )}
                            <CollapsibleContent className="space-y-3 pt-2">
                               <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">From</Label>
                                  <AirportAutocomplete
                                    value={leg.departureAirport}
                                    onChange={(code) => {
                                      const updated = [...additionalLegs];
                                      updated[idx] = { ...updated[idx], departureAirport: code };
                                      setAdditionalLegs(updated);
                                    }}
                                    placeholder="Airport"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">To</Label>
                                  <AirportAutocomplete
                                    value={leg.arrivalAirport}
                                    onChange={(code) => {
                                      const updated = [...additionalLegs];
                                      updated[idx] = { ...updated[idx], arrivalAirport: code };
                                      setAdditionalLegs(updated);
                                    }}
                                    placeholder="Airport"
                                  />
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Date</Label>
                                  <Input
                                    type="date"
                                    value={leg.departureDate}
                                    onChange={(e) => {
                                      const updated = [...additionalLegs];
                                      updated[idx] = { ...updated[idx], departureDate: e.target.value };
                                      setAdditionalLegs(updated);
                                    }}
                                    className="text-xs h-8"
                                  />
                                </div>
                                <div className="flex w-full gap-4">
                                  <div className="flex-1 min-w-0">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Departs</Label>
                                    <Input
                                      type="time"
                                      value={leg.departureTime}
                                      onChange={(e) => {
                                        const updated = [...additionalLegs];
                                        updated[idx] = { ...updated[idx], departureTime: e.target.value };
                                        setAdditionalLegs(updated);
                                      }}
                                      className="text-xs h-8 w-full"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <Label className="text-xs text-muted-foreground mb-1 block">Arrives</Label>
                                    <Input
                                      type="time"
                                      value={leg.arrivalTime}
                                      onChange={(e) => {
                                        const updated = [...additionalLegs];
                                        updated[idx] = { ...updated[idx], arrivalTime: e.target.value };
                                        setAdditionalLegs(updated);
                                      }}
                                      className="text-xs h-8 w-full"
                                    />
                                  </div>
                                </div>
                              </div>
                               <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Airline</Label>
                                  <AirlineAutocomplete
                                    value={leg.airline}
                                    onChange={(val) => {
                                      const updated = [...additionalLegs];
                                      updated[idx] = { ...updated[idx], airline: val };
                                      setAdditionalLegs(updated);
                                    }}
                                    placeholder="e.g. Delta"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Flight #</Label>
                                  <Input
                                    placeholder="e.g. DL456"
                                    value={leg.flightNumber}
                                    onChange={(e) => {
                                      const updated = [...additionalLegs];
                                      updated[idx] = { ...updated[idx], flightNumber: e.target.value };
                                      setAdditionalLegs(updated);
                                    }}
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setAdditionalLegs(additionalLegs.filter((_, i) => i !== idx));
                                  }}
                                >
                                  Remove leg
                                </Button>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}

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
                       <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Date</Label>
                          <Input
                            type="date"
                            value={returnFlight.departureDate}
                            onChange={(e) => setReturnFlight({ ...returnFlight, departureDate: e.target.value })}
                            className="text-xs h-8"
                          />
                        </div>
                        <div className="flex w-full gap-4">
                          <div className="flex-1 min-w-0">
                            <Label className="text-xs text-muted-foreground mb-1 block">Departs *</Label>
                            <Input
                              type="time"
                              value={returnFlight.departureTime}
                              onChange={(e) => setReturnFlight({ ...returnFlight, departureTime: e.target.value })}
                              className="text-xs h-8 w-full"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Label className="text-xs text-muted-foreground mb-1 block">Arrives</Label>
                            <Input
                              type="time"
                              value={returnFlight.arrivalTime}
                              onChange={(e) => setReturnFlight({ ...returnFlight, arrivalTime: e.target.value })}
                              className="text-xs h-8 w-full"
                            />
                          </div>
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
            </>
          )}
        </div>

        {/* Hotel Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <label className="text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
              {isMultiCity ? 'Where will you stay in each city?' : 'Where will you stay?'}
              <span className="text-muted-foreground/60 ml-1">(optional)</span>
            </label>
          </div>

          {isMultiCity && multiCityDestinations && multiCityDestinations.length >= 2 ? (
            /* Multi-city: per-city hotel entry with split stay support */
            <>
              <div className="space-y-3">
                {multiCityDestinations.map((dest) => {
                  const cityHotels = manualHotels[dest.city] || [];
                  return (
                    <div key={dest.city} className="rounded-lg border border-border bg-card overflow-hidden">
                      {/* City header */}
                      <div className="flex items-center justify-between p-3 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium">{dest.city}</span>
                          {dest.nights && (
                            <span className="text-xs text-muted-foreground">({dest.nights} nights)</span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => {
                            // Smart date default: new hotel check-in = latest checkout of existing hotels in this city
                            const cityArrival = dest.arrivalDate || startDate;
                            const cityDeparture = dest.departureDate || endDate;
                            const latestCheckout = cityHotels.length > 0
                              ? cityHotels.reduce((latest: string, h: any) => {
                                  const co = h.checkOutDate || '';
                                  return co > latest ? co : latest;
                                }, cityArrival)
                              : cityArrival;
                            setEditingHotelCity(dest.city);
                            setEditingHotelIndex(cityHotels.length); // new entry at end
                            setNewHotelDraft({
                              name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00',
                              checkInDate: latestCheckout, checkOutDate: cityDeparture,
                            });
                            setShowHotelModal(true);
                          }
                        >
                          {cityHotels.length === 0 ? 'Add Hotel' : 'Add Another'}
                        </Button>
                      </div>

                      {/* Hotel list for this city */}
                      {cityHotels.length > 0 ? (
                        <div className="divide-y divide-border/50">
                          {cityHotels.map((hotel, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{hotel.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {hotel.checkInDate && hotel.checkOutDate
                                    ? `${new Date(hotel.checkInDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(hotel.checkOutDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                    : hotel.address || 'No dates set'
                                  }
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => {
                                    setEditingHotelCity(dest.city);
                                    setEditingHotelIndex(idx);
                                    setShowHotelModal(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    const updated = { ...manualHotels };
                                    updated[dest.city] = cityHotels.filter((_, i) => i !== idx);
                                    if (updated[dest.city].length === 0) delete updated[dest.city];
                                    setManualHotels(updated);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-xs text-muted-foreground/60">No hotel added</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Single city: support multiple hotels (split stays) */
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* I have my own */}
                <button
                  type="button"
                  onClick={() => {
                    setHotelChoice('own');
                    setEditingHotelCity(null);
                    setEditingHotelIndex(manualHotelList.length === 0 ? null : manualHotelList.length);
                    // If no hotels yet, open modal for first hotel
                    if (manualHotelList.length === 0 && !manualHotel.name) {
                      setEditingHotelIndex(null);
                      setNewHotelDraft({
                        name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00',
                        checkInDate: startDate, checkOutDate: endDate,
                      });
                      setShowHotelModal(true);
                    }
                  }}
                  className={cn(
                    'p-4 rounded-xl border-2 text-center transition-all',
                    hotelChoice === 'own'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <PenLine className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">I have my own stay</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Hotel, Airbnb, etc.</div>
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

              {/* Show entered hotels */}
              {hotelChoice === 'own' && (
                <div className="space-y-2">
                  {/* Legacy single hotel (backward compat) */}
                  {manualHotel.name && manualHotelList.length === 0 && (
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { 
                          // Migrate to list
                          setManualHotelList([manualHotel]);
                          setManualHotel({ name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00' });
                          setEditingHotelIndex(0);
                          setEditingHotelCity(null);
                          setShowHotelModal(true);
                        }}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Multi-hotel list */}
                  {manualHotelList.map((hotel, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Hotel className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium text-sm">{hotel.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {hotel.checkInDate && hotel.checkOutDate
                              ? `${new Date(hotel.checkInDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(hotel.checkOutDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                              : hotel.address || ''}
                          </div>
                          {hotel.pricePerNight && hotel.pricePerNight > 0 && (
                            <div className="text-xs text-muted-foreground">
                              ${hotel.pricePerNight}/night
                              {hotel.includeInBudget && (
                                <span className="ml-1 text-primary">· In budget</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { 
                          setEditingHotelIndex(idx);
                          setEditingHotelCity(null);
                          setShowHotelModal(true);
                        }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                          setManualHotelList(manualHotelList.filter((_, i) => i !== idx));
                        }}>
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Add another hotel button */}
                  {(manualHotel.name || manualHotelList.length > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // If still using legacy single hotel, migrate first
                        if (manualHotel.name && manualHotelList.length === 0) {
                          setManualHotelList([manualHotel]);
                          setManualHotel({ name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00' });
                        }
                        setEditingHotelIndex(null); // null = new hotel
                        setEditingHotelCity(null);
                        // Smart date default: new hotel check-in = latest checkout of existing hotels
                        const existingForDefault = manualHotelList.length > 0
                          ? manualHotelList
                          : (manualHotel.name ? [manualHotel] : []);
                        const latestCheckout = existingForDefault.reduce((latest: string, h: any) => {
                          const co = h.checkOutDate || '';
                          return co > latest ? co : latest;
                        }, startDate);
                        setNewHotelDraft({
                          name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00',
                          checkInDate: latestCheckout, checkOutDate: endDate,
                        });
                        setShowHotelModal(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add another hotel (split stay)
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Inter-City Transport Comparison — only for multi-city trips */}
        {isMultiCity && multiCityDestinations && multiCityDestinations.length >= 2 && (
          <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-border">
            <InterCityTransportComparison
              transitions={multiCityDestinations.slice(0, -1).map((dest, i) => ({
                fromCity: dest.city,
                fromCountry: dest.country,
                toCity: multiCityDestinations[i + 1].city,
                toCountry: multiCityDestinations[i + 1].country,
                index: i,
              }))}
              travelers={travelers}
              travelDate={startDate}
              onSelect={(idx, option) => onTransportSelect?.(idx, option)}
              selections={Object.fromEntries(
                Object.entries(transportSelections || {}).map(([k, v]) => [k, v.optionId])
              )}
              missingLegs={(flightIntelligence?.missingLegs as Array<{ from?: string; fromCity?: string; to?: string; toCity?: string; suggestedDateRange?: { earliest?: string; latest?: string }; priority?: string }>) || undefined}
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 max-w-xl mx-auto">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSubmit} className="gap-2">
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Flight Import Modal */}
      <FlightImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportFlight}
        onImportLegs={handleImportAllLegs}
        onIntelligence={(intel) => onIntelligenceCapture?.(intel as Record<string, unknown>)}
        tripStartDate={startDate}
        tripEndDate={endDate}
        destinations={isMultiCity ? multiCityDestinations.map(d => d.city) : destination ? [destination] : undefined}
        destinationAirports={isMultiCity ? multiCityDestinations.map(d => d.airportCode).filter(Boolean) as string[] : undefined}
        nightsPerCity={isMultiCity ? Object.fromEntries(multiCityDestinations.map(d => [d.city, d.nights])) : undefined}
      />

      {/* Manual Hotel Entry Modal — city-aware for multi-city, index-aware for split stays */}
      {(() => {
        // Determine which hotel entry to edit
        const isListMode = !editingHotelCity && (manualHotelList.length > 0 || editingHotelIndex !== null);
        const isMultiCityEdit = !!editingHotelCity;
        const multiCityHotelsForCity = isMultiCityEdit ? (manualHotels[editingHotelCity!] || []) : [];
        const currentHotel = isMultiCityEdit
          ? (editingHotelIndex !== null && multiCityHotelsForCity[editingHotelIndex]
              ? multiCityHotelsForCity[editingHotelIndex]
              : { name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00', accommodationType: 'hotel' as const })
          : isListMode && editingHotelIndex !== null && manualHotelList[editingHotelIndex]
            ? manualHotelList[editingHotelIndex]
            : (isListMode ? newHotelDraft : manualHotel);
        // For multi-city date bounds, use city arrival/departure dates
        const editingCityDest = isMultiCityEdit && multiCityDestinations
          ? multiCityDestinations.find(d => d.city === editingHotelCity)
          : null;
        const cityDateMin = editingCityDest?.arrivalDate || startDate;
        const cityDateMax = editingCityDest?.departureDate || endDate;
        // Show date fields for multi-city when city has multiple hotels OR adding a new one to a city that already has one
        const showMultiCityDates = isMultiCityEdit && (multiCityHotelsForCity.length > 0 || (editingHotelIndex !== null && editingHotelIndex > 0));
        const setCurrentHotel = (h: ManualHotelEntry) => {
          if (isMultiCityEdit) {
            const cityHotels = [...multiCityHotelsForCity];
            if (editingHotelIndex !== null && editingHotelIndex < cityHotels.length) {
              cityHotels[editingHotelIndex] = h;
            } else {
              cityHotels.push(h);
            }
            setManualHotels({ ...manualHotels, [editingHotelCity!]: cityHotels });
          } else if (isListMode) {
            if (editingHotelIndex !== null && editingHotelIndex < manualHotelList.length) {
              const updated = [...manualHotelList];
              updated[editingHotelIndex] = h;
              setManualHotelList(updated);
            } else {
              // New hotel — update draft state
              setNewHotelDraft(h);
            }
          } else {
            setManualHotel(h);
          }
        };
        const modalDestination = editingHotelCity || destination;
        const accomType = currentHotel.accommodationType || 'hotel';
        const accomLabels: Record<string, string> = {
          hotel: 'Hotel', airbnb: 'Airbnb', rental: 'Vacation Rental', hostel: 'Hostel', other: 'Accommodation'
        };
        const accomLabel = accomLabels[accomType] || 'Hotel';
        const isHotelType = accomType === 'hotel' || accomType === 'hostel';

        return (
          <Dialog open={showHotelModal} onOpenChange={(open) => {
            setShowHotelModal(open);
            if (!open) {
              setEditingHotelCity(null);
              setEditingHotelIndex(null);
            }
          }}>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Hotel className="h-5 w-5 text-primary" />
                  {editingHotelCity ? `${accomLabel} in ${editingHotelCity}` : `Add Accommodation`}
                </DialogTitle>
                <DialogDescription>
                  Enter your stay details: hotel, Airbnb, vacation rental, or any address.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 sm:space-y-4 sm:py-4">
                {/* Accommodation Type Selector */}
                <div>
                  <Label className="text-[10px] sm:text-xs mb-1 block text-muted-foreground">Type of Stay</Label>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { value: 'hotel', label: 'Hotel' },
                      { value: 'airbnb', label: 'Airbnb' },
                      { value: 'rental', label: 'Vacation Rental' },
                      { value: 'hostel', label: 'Hostel' },
                      { value: 'other', label: 'Other' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCurrentHotel({ ...currentHotel, accommodationType: opt.value })}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                          accomType === opt.value 
                            ? "bg-primary text-primary-foreground border-primary" 
                            : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>{accomLabel} Name *</Label>
                  {isHotelType ? (
                    <HotelAutocomplete
                      value={currentHotel.name}
                      destination={modalDestination}
                      placeholder={accomType === 'hostel' ? 'e.g. Generator Hostel' : 'Start typing to search hotels...'}
                      onChange={(hotel) => setCurrentHotel({ 
                        ...currentHotel, 
                        name: hotel.name, 
                        address: hotel.address || currentHotel.address 
                      })}
                    />
                  ) : (
                    <Input
                      placeholder={accomType === 'airbnb' ? 'e.g. Cozy French Quarter Loft' : 'e.g. Beachfront Villa'}
                      value={currentHotel.name}
                      onChange={(e) => setCurrentHotel({ ...currentHotel, name: e.target.value })}
                      className="text-xs h-8"
                    />
                  )}
                  {isHotelType && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Type to search or enter manually
                    </p>
                  )}
                </div>
                
                <div>
                  <Label>Address</Label>
                  <Input
                    placeholder="e.g. 15 Place Vendôme, 75001 Paris"
                    value={currentHotel.address}
                    onChange={(e) => setCurrentHotel({ ...currentHotel, address: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
                
                <div>
                  <Label>Neighborhood</Label>
                  <Input
                    placeholder="e.g. 1st Arrondissement"
                    value={currentHotel.neighborhood || ''}
                    onChange={(e) => setCurrentHotel({ ...currentHotel, neighborhood: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
                
                <div className="flex w-full gap-4">
                  <div className="flex-1 min-w-0">
                    <Label className="text-[10px] sm:text-xs mb-0.5 block text-muted-foreground">Check-in Time</Label>
                    <Input
                      type="time"
                      value={currentHotel.checkInTime || '15:00'}
                      onChange={(e) => setCurrentHotel({ ...currentHotel, checkInTime: e.target.value })}
                      className="text-xs h-8 w-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-[10px] sm:text-xs mb-0.5 block text-muted-foreground">Check-out Time</Label>
                    <Input
                      type="time"
                      value={currentHotel.checkOutTime || '11:00'}
                      onChange={(e) => setCurrentHotel({ ...currentHotel, checkOutTime: e.target.value })}
                      className="text-xs h-8 w-full"
                    />
                  </div>
                </div>

                {/* Stay Dates — shown for split stays (single-city multi-hotel or multi-city multi-hotel) */}
                {(isListMode || showMultiCityDates) && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <Label className="text-xs">Check-in Date</Label>
                      <Input
                        type="date"
                        value={currentHotel.checkInDate || (isMultiCityEdit ? cityDateMin : startDate)}
                        min={isMultiCityEdit ? cityDateMin : startDate}
                        max={isMultiCityEdit ? cityDateMax : endDate}
                        onChange={(e) => setCurrentHotel({ ...currentHotel, checkInDate: e.target.value })}
                        className="text-xs h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Check-out Date</Label>
                      <Input
                        type="date"
                        value={currentHotel.checkOutDate || (isMultiCityEdit ? cityDateMax : endDate)}
                        min={currentHotel.checkInDate || (isMultiCityEdit ? cityDateMin : startDate)}
                        max={isMultiCityEdit ? cityDateMax : endDate}
                        onChange={(e) => setCurrentHotel({ ...currentHotel, checkOutDate: e.target.value })}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                )}

                {/* Price & Budget Inclusion */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div>
                    <Label className="text-[10px] sm:text-xs text-muted-foreground">Price Per Night (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 150"
                        className="pl-9 text-xs h-8"
                        value={currentHotel.pricePerNight || ''}
                        onChange={(e) => setCurrentHotel({ ...currentHotel, pricePerNight: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Enter the nightly rate. We'll calculate the total automatically</p>
                  </div>

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={currentHotel.includeInBudget || false}
                      onCheckedChange={(checked) => setCurrentHotel({ ...currentHotel, includeInBudget: checked === true })}
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
                    if (!currentHotel.name) {
                      toast.error('Please enter the hotel name');
                      return;
                    }
                    // Save to the correct state
                    if (editingHotelCity) {
                      const cityHotels = [...(manualHotels[editingHotelCity] || [])];
                      const hotelWithDates = {
                        ...currentHotel,
                        checkInDate: currentHotel.checkInDate || (editingCityDest?.arrivalDate || startDate),
                        checkOutDate: currentHotel.checkOutDate || (editingCityDest?.departureDate || endDate),
                      };
                      if (editingHotelIndex !== null && editingHotelIndex < cityHotels.length) {
                        cityHotels[editingHotelIndex] = hotelWithDates;
                      } else {
                        cityHotels.push(hotelWithDates);
                      }
                      setManualHotels({ ...manualHotels, [editingHotelCity]: cityHotels });
                      setHotelChoice('own');
                    } else if (isListMode) {
                      if (editingHotelIndex !== null && editingHotelIndex < manualHotelList.length) {
                        // Update existing
                        const updated = [...manualHotelList];
                        updated[editingHotelIndex] = currentHotel;
                        setManualHotelList(updated);
                      } else {
                        // Add new
                        setManualHotelList([...manualHotelList, {
                          ...currentHotel,
                          checkInDate: currentHotel.checkInDate || startDate,
                          checkOutDate: currentHotel.checkOutDate || endDate,
                        }]);
                      }
                      setHotelChoice('own');
                    } else {
                      setManualHotel(currentHotel);
                      setHotelChoice('own');
                    }
                    setShowHotelModal(false);
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </motion.div>
  );
}

export default function Start() {
  const { state: plannerState, setBasics, resetTrip } = useTripPlanner();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canCreateDraft } = useDraftLimitCheck();
  const [showLimitBlocker, setShowLimitBlocker] = useState(false);

  const DRAFT_STORAGE_KEY = 'voyance_start_draft';

  // Current step: 1 = Trip Details, 2 = Personalize (optional), 3 = Flight & Hotel
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDNAPrompt, setShowDNAPrompt] = useState(false);

  // Helper: advance to a specific step and push history
  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
    window.history.pushState({ step }, '', `/start?step=${step}`);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // Shorthand for the common Step 1 → Step 2 transition
  const goToStep2 = useCallback(() => goToStep(2), [goToStep]);

  // Listen for browser back button to navigate between steps
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const targetStep = event.state?.step || 1;
      if (targetStep < currentStep) {
        setCurrentStep(targetStep);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentStep]);
  // Reset stale session state when starting a fresh trip (not from quiz/destination link)
  useEffect(() => {
    const isFromQuiz = searchParams.get('fromQuiz') === 'true';
    const hasDestination = !!searchParams.get('destination');
    if (!isFromQuiz && !hasDestination) {
      resetTrip();
      setDestinationSelection({ display: '', cityName: '', airportCodes: undefined });
      setStartDate(undefined);
      setEndDate(undefined);
      setTravelers(2);
      setBudgetAmount(undefined);
      setIsMultiCity(false);
      setMultiCityDestinations([]);
      setMultiCityTransports([]);
      sessionStorage.removeItem('voyance_chat_messages');
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [planMode, setPlanMode] = useState<'single' | 'multi' | 'chat' | 'manual'>('single');

  // Trip state
  const destinationFromQuery = searchParams.get('destination');
  const [destinationSelection, setDestinationSelection] = useState<LocationSelection>(() => ({
    display: destinationFromQuery || plannerState.basics.destination || '',
    cityName: destinationFromQuery || plannerState.basics.destination || '',
    airportCodes: undefined,
  }));
  const [startDate, setStartDate] = useState<Date | undefined>(
    plannerState.basics.startDate ? parseLocalDate(plannerState.basics.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    plannerState.basics.endDate ? parseLocalDate(plannerState.basics.endDate) : undefined
  );
  const [travelers, setTravelers] = useState(plannerState.basics.travelers || 2);
  const [tripType, setTripType] = useState<string>('leisure');
  const [celebrationDay, setCelebrationDay] = useState<number | undefined>();
  const [budgetAmount, setBudgetAmount] = useState<number | undefined>(plannerState.basics.budgetAmount);
  const [pacing, setPacing] = useState<'relaxed' | 'balanced' | 'packed'>('balanced');
  const [linkedGuests, setLinkedGuests] = useState<LinkedGuest[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Multi-city state
  const [isMultiCity, setIsMultiCity] = useState(plannerState.basics.isMultiCity || false);
  const [multiCityDestinations, setMultiCityDestinations] = useState<TripDestination[]>(
    plannerState.basics.destinations || []
  );
  const [multiCityTransports, setMultiCityTransports] = useState<InterCityTransport[]>(
    plannerState.basics.interCityTransports || []
  );
  const [transportSelections, setTransportSelections] = useState<Record<number, { optionId: string; option: TransportOption }>>({});
  const handleTransportSelect = (idx: number, option: TransportOption) => {
    setTransportSelections(prev => ({ ...prev, [idx]: { optionId: option.id, option } }));
    // Also update the transport type in multiCityTransports for persistence
    setMultiCityTransports(prev => prev.map((t, i) => i === idx ? { ...t, type: option.mode as InterCityTransport['type'], estimatedPrice: option.cost.total, currency: option.cost.currency } : t));
  };
  
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
  const [additionalLegs, setAdditionalLegs] = useState<ManualFlightEntry[]>([]);
  const [flightIntelligence, setFlightIntelligence] = useState<Record<string, unknown> | null>(null);

  // Hotel state
  const [hotelChoice, setHotelChoice] = useState<'skip' | 'own'>('skip');
  const [manualHotel, setManualHotel] = useState<ManualHotelEntry>({
    name: '',
    address: '',
    neighborhood: '',
    checkInTime: '15:00',
    checkOutTime: '11:00',
  });
  // Multi-hotel list for single-city split stays
  const [manualHotelList, setManualHotelList] = useState<ManualHotelEntry[]>([]);
  const [manualHotels, setManualHotels] = useState<Record<string, ManualHotelEntry[]>>({});

  // Personalization state
  const [isFirstTimeVisitor, setIsFirstTimeVisitor] = useState(true);
  const [firstTimePerCity, setFirstTimePerCity] = useState<Record<string, boolean>>({});
   const [mustDoActivities, setMustDoActivities] = useState('');
   const [generationRules, setGenerationRules] = useState<GenerationRule[]>([]);
  const [selectedLandmarks, setSelectedLandmarks] = useState<string[]>([]);
  const [selectedCategories] = useState<string[]>([]); // Kept for backward compat with saved metadata
  const [customMustDos, setCustomMustDos] = useState<string[]>([]);

  // Fetch user's DNA budget preference for smart defaults
  const [dnaBudgetTier, setDnaBudgetTier] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_preferences')
      .select('budget_tier')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.budget_tier) setDnaBudgetTier(data.budget_tier);
      });
  }, [user?.id]);

  // Always sync flight dates from trip dates — ensures Step 2 fields reflect Step 1 selections
  useEffect(() => {
    if (startDate) {
      const formatted = format(startDate, 'yyyy-MM-dd');
      setOutboundFlight(prev => prev.departureDate === formatted ? prev : { ...prev, departureDate: formatted });
    }
    if (endDate) {
      const formatted = format(endDate, 'yyyy-MM-dd');
      setReturnFlight(prev => prev.departureDate === formatted ? prev : { ...prev, departureDate: formatted });
    }
  }, [startDate, endDate]);

  // Handle return from quiz — restore step 2 and auto-submit
  useEffect(() => {
    if (searchParams.get('fromQuiz') === 'true' && user?.quizCompleted) {
      try {
        const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        const savedDraft = raw ? JSON.parse(raw) : null;
        if (savedDraft) {
          if (savedDraft.outboundFlight) setOutboundFlight(savedDraft.outboundFlight);
          if (savedDraft.returnFlight) setReturnFlight(savedDraft.returnFlight);
          if (savedDraft.showReturnFlight) setShowReturnFlight(savedDraft.showReturnFlight);
          if (savedDraft.hotelChoice) setHotelChoice(savedDraft.hotelChoice);
          if (savedDraft.manualHotel) setManualHotel(savedDraft.manualHotel);
          if (savedDraft.isFirstTimeVisitor !== undefined) setIsFirstTimeVisitor(savedDraft.isFirstTimeVisitor);
          if (savedDraft.firstTimePerCity) setFirstTimePerCity(savedDraft.firstTimePerCity);
          if (savedDraft.mustDoActivities) setMustDoActivities(savedDraft.mustDoActivities);
          if (savedDraft.selectedLandmarks) setSelectedLandmarks(savedDraft.selectedLandmarks);
          // selectedCategories removed — interest categories are no longer user-facing
          if (savedDraft.customMustDos) setCustomMustDos(savedDraft.customMustDos);
          if (savedDraft.generationRules) setGenerationRules(savedDraft.generationRules);
          if (savedDraft.destination) setDestinationSelection({ display: savedDraft.destination, cityName: savedDraft.destination });
          if (savedDraft.startDate) setStartDate(parseLocalDate(savedDraft.startDate));
          if (savedDraft.endDate) setEndDate(parseLocalDate(savedDraft.endDate));
          if (savedDraft.travelers) setTravelers(savedDraft.travelers);
          if (savedDraft.tripType) setTripType(savedDraft.tripType);
          if (savedDraft.budgetAmount) setBudgetAmount(savedDraft.budgetAmount);
          if (savedDraft.isMultiCity) setIsMultiCity(savedDraft.isMultiCity);
          if (savedDraft.multiCityDestinations) setMultiCityDestinations(savedDraft.multiCityDestinations);
          if (savedDraft.multiCityTransports) setMultiCityTransports(savedDraft.multiCityTransports);
          const restoredStep = savedDraft.currentStep || 3;
          setCurrentStep(restoredStep);
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
          // Push history so back button works
          if (restoredStep > 1) {
            window.history.replaceState({ step: restoredStep }, '', `/start?step=${restoredStep}`);
          }
        }
      } catch {}
      if (!searchParams.get('step')) {
        window.history.replaceState({}, '', '/start');
      }
    }
  }, [searchParams, user]);

  // Check draft limit
  useEffect(() => {
    if (!canCreateDraft && user) {
      setShowLimitBlocker(true);
    }
  }, [canCreateDraft, user]);

  // Handle final submission
  const handleSubmit = async () => {
    const primaryDestination = isMultiCity
      ? (multiCityDestinations[0]?.city || '')
      : destinationSelection.cityName;

    // Validate all required fields with specific feedback
    const missing: string[] = [];
    if (!primaryDestination) missing.push('destination');
    if (!startDate) missing.push('start date');
    if (!endDate) missing.push('end date');

    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.join(', ')}`, {
        description: 'All highlighted fields are required to create a trip.',
      });
      return;
    }

    if (startDate && endDate && isBefore(endDate, startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setIsSubmitting(true);

    try {
      // DNA check now happens at Step 1→2 transition, not here

      // Build flight selection data — use legs[] format for multi-city support
      const hasLegData = (leg: ManualFlightEntry) =>
        !!(
          leg.departureAirport ||
          leg.arrivalAirport ||
          leg.departureTime ||
          leg.arrivalTime ||
          leg.airline ||
          leg.flightNumber ||
          leg.price
        );

      let flightSelection: Record<string, unknown> | null = null;
      if (hasLegData(outboundFlight)) {
        const allLegs: ManualFlightEntry[] = [outboundFlight];
        if (additionalLegs.length > 0) {
          allLegs.push(...additionalLegs.filter(hasLegData));
        }
        if (showReturnFlight && hasLegData(returnFlight)) {
          allLegs.push(returnFlight);
        }
        const flightLegs: FlightLeg[] = allLegs.map((leg, i) => ({
          legOrder: i + 1,
          airline: leg.airline || '',
          flightNumber: leg.flightNumber || '',
          departure: {
            airport: leg.departureAirport || '',
            time: leg.departureTime || '',
            date: leg.departureDate || '',
          },
          arrival: {
            airport: leg.arrivalAirport || '',
            time: leg.arrivalTime || '',
          },
          price: leg.price || 0,
          cabin: leg.cabinClass || 'economy',
          isDestinationArrival: leg.isDestinationArrival || undefined,
          isDestinationDeparture: leg.isDestinationDeparture || undefined,
        }));
        flightSelection = buildFlightSelectionFromLegs(flightLegs, true);
      }

      // Build hotel selection data — supports split stays (multiple hotels)
      let hotelSelection: any[] | null = null;
      let includeHotelInBudget = false;

      if (hotelChoice === 'own') {
        if (manualHotelList.length > 0) {
          // Multi-hotel (split stay)
          hotelSelection = manualHotelList.map(h => ({
            name: h.name,
            address: h.address,
            neighborhood: h.neighborhood,
            checkInTime: h.checkInTime,
            checkOutTime: h.checkOutTime,
            checkInDate: h.checkInDate,
            checkOutDate: h.checkOutDate,
            pricePerNight: h.pricePerNight || undefined,
            source: 'manual',
          }));
          includeHotelInBudget = manualHotelList.some(h => h.includeInBudget && h.pricePerNight && h.pricePerNight > 0);
        } else if (manualHotel.name) {
          // Single hotel (legacy)
          hotelSelection = [{
            name: manualHotel.name,
            address: manualHotel.address,
            neighborhood: manualHotel.neighborhood,
            checkInTime: manualHotel.checkInTime,
            checkOutTime: manualHotel.checkOutTime,
            pricePerNight: manualHotel.pricePerNight || undefined,
            source: 'manual',
          }];
          includeHotelInBudget = !!(manualHotel.includeInBudget && manualHotel.pricePerNight && manualHotel.pricePerNight > 0);
        }
      }

      // Build multi-city name
      const tripName = isMultiCity && multiCityDestinations.length >= 2
        ? multiCityDestinations.map(d => d.city).join(' → ')
        : `Trip to ${primaryDestination}`;

      // Fetch owner_plan_tier for downstream entitlement checks
      let ownerPlanTier = 'free';
      try {
        const { data: entitlements } = await supabase.functions.invoke('get-entitlements');
        ownerPlanTier = entitlements?.plans?.[0] || 'free';
      } catch (e) {
        console.warn('[Start] Failed to fetch entitlements for owner_plan_tier:', e);
      }

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
          budget_tier: budgetAmount ? (budgetAmount < 750 ? 'budget' : budgetAmount < 2000 ? 'moderate' : budgetAmount < 4000 ? 'premium' : 'luxury') : (dnaBudgetTier || 'moderate'),
          budget_total_cents: budgetAmount ? budgetAmount * 100 : null,
          flight_selection: flightSelection as any,
          hotel_selection: hotelSelection,
          budget_include_hotel: includeHotelInBudget || false,
          flight_intelligence: (flightIntelligence || null) as any,
          is_multi_city: isMultiCity || null,
          destinations: isMultiCity ? multiCityDestinations as any : null,
          transportation_preferences: isMultiCity && multiCityTransports.length > 0 ? multiCityTransports as any : null,
          creation_source: isMultiCity ? 'multi_city' : 'single_city',
          status: 'draft',
          owner_plan_tier: ownerPlanTier,
          metadata: ({
            isFirstTimeVisitor,
            firstTimePerCity: isMultiCity && Object.keys(firstTimePerCity).length > 0 ? firstTimePerCity : null,
            mustDoActivities: [
              ...selectedLandmarks,
              ...customMustDos,
              ...(mustDoActivities ? [mustDoActivities] : []),
            ].filter(Boolean).length > 0
              ? [...selectedLandmarks, ...customMustDos, ...(mustDoActivities ? [mustDoActivities] : [])]
              : null,
            interestCategories: selectedCategories.length > 0 ? selectedCategories : null,
            generationRules: generationRules.length > 0 ? generationRules : null,
            celebrationDay: celebrationDay || null,
            pacing: pacing || 'balanced',
            lastUpdated: new Date().toISOString(),
          }) as any,
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
            ? {
                fromCity: multiCityTransports[i - 1].fromCity,
                toCity: multiCityTransports[i - 1].toCity,
                ...(transportSelections[i - 1]?.option ? {
                  operator: transportSelections[i - 1].option.operator,
                  mode: transportSelections[i - 1].option.mode,
                  inTransitDuration: transportSelections[i - 1].option.inTransitDuration,
                  doorToDoorDuration: transportSelections[i - 1].option.doorToDoorDuration,
                  departureStation: transportSelections[i - 1].option.departure?.point,
                  arrivalStation: transportSelections[i - 1].option.arrival?.point,
                  costPerPerson: transportSelections[i - 1].option.cost?.perPerson,
                  totalCost: transportSelections[i - 1].option.cost?.total,
                  currency: transportSelections[i - 1].option.cost?.currency,
                } : {}),
              }
            : null,
          transport_cost_cents: i > 0 && transportSelections[i - 1]?.option
            ? Math.round((transportSelections[i - 1].option.cost?.total || 0) * 100)
            : 0,
          transport_currency: i > 0 && transportSelections[i - 1]?.option?.cost?.currency
            ? transportSelections[i - 1].option.cost.currency
            : 'USD',
          transition_day_mode: i > 0 && multiCityTransports[i - 1]
            ? multiCityTransports[i - 1].transitionDay || 'half_and_half'
            : null,
          generation_status: 'pending' as const,
          days_total: (d.nights || 1) + 1, // Inclusive day count: nights + 1
          hotel_selection: (manualHotels[d.city] && manualHotels[d.city].length > 0)
            ? manualHotels[d.city].filter(h => h.name).map(h => ({
                name: h.name,
                address: h.address,
                neighborhood: h.neighborhood,
                checkInTime: h.checkInTime,
                checkOutTime: h.checkOutTime,
                checkInDate: h.checkInDate || undefined,
                checkOutDate: h.checkOutDate || undefined,
                pricePerNight: h.pricePerNight || undefined,
                source: 'manual',
              }))
            : null,
        }));

        const { error: citiesError } = await supabase.from('trip_cities').insert(cityRows as any[]);
        if (citiesError) {
          console.error('[Start] Failed to persist trip_cities:', citiesError);
          // Non-fatal: edge function can fall back to destinations JSONB
        } else {
          console.log(`[Start] Persisted ${cityRows.length} trip_cities for trip ${trip.id}`);

          // ─── SPLIT BUDGET ACROSS CITIES ───
          if (budgetAmount) {
            const totalNights = multiCityDestinations.reduce((sum, d) => sum + (d.nights || 1), 0);
            const budgetCents = Math.round(budgetAmount * 100);
            const cityBudgets = multiCityDestinations.map((d, i) => {
              const cityNights = d.nights || 1;
              const share = cityNights / totalNights;
              return { cityOrder: i, allocatedBudgetCents: Math.round(budgetCents * share) };
            });
            // Adjust rounding so the sum matches exactly
            const allocatedSum = cityBudgets.reduce((s, c) => s + c.allocatedBudgetCents, 0);
            if (allocatedSum !== budgetCents) {
              cityBudgets[0].allocatedBudgetCents += (budgetCents - allocatedSum);
            }
            for (const cb of cityBudgets) {
              await supabase
                .from('trip_cities')
                .update({ allocated_budget_cents: cb.allocatedBudgetCents } as any)
                .eq('trip_id', trip.id)
                .eq('city_order', cb.cityOrder);
            }
            console.log('[Start] Budget split:', cityBudgets.map(c => `City ${c.cityOrder}: $${(c.allocatedBudgetCents / 100).toFixed(2)}`).join(', '));
          }
        }
      } else {
        // Single-city trip: also insert one trip_cities row for unified schema
        const nights = differenceInDays(endDate, startDate);
        const days = nights + 1; // Inclusive: Apr 10–13 = 4 days
        const singleCityRow = {
          trip_id: trip.id,
          city_order: 0,
          city_name: primaryDestination,
          country: (primaryDestination.includes(',') ? primaryDestination.split(',').pop()?.trim() : null) || null,
          arrival_date: format(startDate, 'yyyy-MM-dd'),
          departure_date: format(endDate, 'yyyy-MM-dd'),
          nights: nights > 0 ? nights : 1,
          generation_status: 'pending' as const,
          days_total: days > 0 ? days : 1,
          hotel_selection: hotelSelection && hotelSelection.length > 0 ? hotelSelection : null,
        };
        const { error: singleCityError } = await supabase.from('trip_cities').insert(singleCityRow as any);
        if (singleCityError) {
          console.error('[Start] Failed to persist single trip_cities row:', singleCityError);
        } else if (budgetAmount) {
          // Single-city: allocate full budget
          await supabase
            .from('trip_cities')
            .update({ allocated_budget_cents: Math.round(budgetAmount * 100) } as any)
            .eq('trip_id', trip.id)
            .eq('city_order', 0);
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

      // Check if trip should be split into a journey (8+ days, 2+ cities)
      if (isMultiCity && multiCityDestinations.length >= 2) {
        try {
          const splitResult = await splitJourneyIfNeeded(
            trip.id,
            multiCityDestinations.map(d => ({
              city: d.city,
              country: d.country,
              nights: d.nights,
              airportCode: d.airportCode,
            })),
            multiCityTransports.map(t => ({
              type: t.type,
              fromCity: t.fromCity,
              toCity: t.toCity,
              departureTime: t.departureTime,
              arrivalTime: t.arrivalTime,
            })),
            format(startDate, 'yyyy-MM-dd'),
            format(endDate, 'yyyy-MM-dd'),
            manualHotels,
          );

          if (splitResult.didSplit) {
            console.log(`[Start] Trip split into journey with ${splitResult.legCount} legs`);
            toast.success(`Journey created: ${splitResult.legCount} legs`);
            navigate(`/trip/${splitResult.firstLegTripId}?generate=true`);
            return;
          }
        } catch (splitErr) {
          console.warn('[Start] Journey split failed, proceeding as single trip:', splitErr);
          // Fall through to normal navigation
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
          <StepIndicator currentStep={currentStep} isMultiCity={isMultiCity} />

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
                      // 'chat' and 'manual' don't affect multi-city state
                    }}
                    pacing={pacing}
                    setPacing={setPacing}
                    onChatDetailsExtracted={async (details) => {
                      // Create trip directly from extracted details — don't rely on async state updates
                      // Dates are already guarded by TripChatPlanner's normalizeChatTripDates call
                      const dest = details.destination || '';
                      const chatStartDate = details.startDate ? parseLocalDate(details.startDate) : null;
                      const chatEndDate = details.endDate ? parseLocalDate(details.endDate) : null;

                      if (!dest || !chatStartDate || !chatEndDate) {
                        toast.error('Missing trip details - please provide destination and dates');
                        return;
                      }

                      setIsSubmitting(true);
                      try {
                        const chatBudget = details.budgetAmount || budgetAmount;
                        const chatTripType = details.tripType || tripType;
                        const chatTravelers = details.travelers || travelers;
                        // Use shared city normalization (single source of truth)
                        const chatCities = resolveCities(details, chatStartDate, chatEndDate);
                        const isChatMultiCity = chatCities.length > 1;

                        // Prefer AI-extracted city names over raw destination (which may contain descriptive text)
                        const rawCityList = Array.isArray(details.cities) ? details.cities : [];
                        const primaryCityName = rawCityList.length > 0 ? String(rawCityList[0].name || '').trim() : '';
const cleanDest = (primaryCityName && !/^[A-Z]{3}$/i.test(primaryCityName))
                          ? primaryCityName
                          : (!/^[A-Z]{3}$/i.test(dest) ? dest : dest);

                        const destinationSummary = isChatMultiCity
                          ? chatCities.map((city) => city.name).join(', ')
                          : cleanDest;

                        logger.info('[Start] Chat trip city resolution:', {
                          cityCount: chatCities.length,
                          cities: chatCities.map(c => c.name),
                          isMultiCity: isChatMultiCity,
                        });

                        // Sync extracted details back to form state so widgets reflect chat intent
                        if (details.travelers && details.travelers !== travelers) {
                          setTravelers(details.travelers);
                        }
                        if (details.tripType && details.tripType !== tripType) {
                          setTripType(details.tripType);
                        }
                        if (details.budgetAmount && details.budgetAmount !== budgetAmount) {
                          setBudgetAmount(details.budgetAmount);
                        }
                        const hotelSelection = details.hotelName ? [{
                          name: details.hotelName,
                          address: details.hotelAddress || '',
                          source: 'manual',
                        }] : null;

                        // Build flight_selection from chat-extracted flight details
                        const flightSelection = (details.arrivalAirport || details.arrivalTime || details.departureAirport || details.departureTime) ? {
                          departure: {
                            arrival: {
                              time: details.arrivalTime || undefined,
                              airport: details.arrivalAirport || undefined,
                            },
                          },
                          return: {
                            departure: {
                              time: details.departureTime || undefined,
                              airport: details.departureAirport || undefined,
                            },
                          },
                          arrivalAirport: details.arrivalAirport || undefined,
                          departureAirport: details.departureAirport || undefined,
                          source: 'chat',
                        } : null;

                        // Fetch owner_plan_tier for chat path
                        let chatOwnerPlanTier = 'free';
                        try {
                          const { data: chatEntitlements } = await supabase.functions.invoke('get-entitlements');
                          chatOwnerPlanTier = chatEntitlements?.plans?.[0] || 'free';
                        } catch (e) {
                          console.warn('[Start] Failed to fetch entitlements for chat owner_plan_tier:', e);
                        }

                        // Determine budget_include_hotel for chat path
                        const chatIncludeHotelInBudget = !!(hotelSelection && hotelSelection.length > 0 && hotelSelection.some((h: any) => h.pricePerNight && h.pricePerNight > 0));

                        const { data: trip, error } = await supabase
                          .from('trips')
                          .insert({
                            user_id: user.id,
                            name: isChatMultiCity ? `Trip to ${destinationSummary}` : `Trip to ${cleanDest}`,
                            destination: isChatMultiCity ? chatCities[0].name : cleanDest,
                            start_date: format(chatStartDate, 'yyyy-MM-dd'),
                            end_date: format(chatEndDate, 'yyyy-MM-dd'),
                            travelers: chatTravelers,
                            trip_type: chatTripType,
                            budget_tier: chatBudget ? (chatBudget < 750 ? 'budget' : chatBudget < 2000 ? 'moderate' : chatBudget < 4000 ? 'premium' : 'luxury') : (dnaBudgetTier || 'moderate'),
                            budget_total_cents: chatBudget ? chatBudget * 100 : null,
                            hotel_selection: hotelSelection,
                            flight_selection: flightSelection,
                            budget_include_hotel: chatIncludeHotelInBudget,
                            owner_plan_tier: chatOwnerPlanTier,
                            creation_source: isChatMultiCity ? 'multi_city' : 'chat',
                            status: 'draft',
                            is_multi_city: isChatMultiCity ? true : null,
                            destinations: isChatMultiCity ? chatCities.map((c, i) => ({
                              city: c.name,
                              country: c.country || '',
                              nights: c.nights,
                              order: i + 1,
                            })) as any : null,
                            metadata: (() => {
                              // Normalize mustDoActivities to string[] to match form path
                              const mustDo = details.mustDoActivities
                                ? details.mustDoActivities.split(',').map((s: string) => s.trim()).filter(Boolean)
                                : null;

                                // Convert userConstraints → generationRules format the engine reads
                                // Normalize "8:15 AM", "9:00 PM", etc. to "HH:MM" 24-hour format
                                const normalizeTimeTo24h = (timeStr: string): string => {
                                  const cleaned = timeStr.trim();
                                  // Already HH:MM 24h format?
                                  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
                                  if (match24) return `${String(parseInt(match24[1])).padStart(2, '0')}:${match24[2]}`;
                                  // 12-hour format: "9:00 AM", "8:15 PM", "9 AM", etc.
                                  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
                                  if (match12) {
                                    let hour = parseInt(match12[1], 10);
                                    const min = parseInt(match12[2] || '0', 10);
                                    const period = match12[3].toLowerCase();
                                    if (period === 'pm' && hour !== 12) hour += 12;
                                    if (period === 'am' && hour === 12) hour = 0;
                                    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                                  }
                                  // Fallback: return as-is
                                  return cleaned;
                                };

                                const addMinsToTime = (time: string, minutes: number): string => {
                                  const normalized = normalizeTimeTo24h(time);
                                  const [h, m] = normalized.split(':').map(Number);
                                  if (isNaN(h) || isNaN(m)) {
                                    console.warn(`[Start] addMinsToTime: could not parse "${time}" (normalized: "${normalized}") — defaulting to +${minutes}min from 09:00`);
                                    const fallbackTotal = 9 * 60 + minutes;
                                    return `${String(Math.floor(fallbackTotal / 60) % 24).padStart(2, '0')}:${String(fallbackTotal % 60).padStart(2, '0')}`;
                                  }
                                  const totalMins = h * 60 + m + minutes;
                                  const newH = Math.floor(totalMins / 60) % 24;
                                  const newM = totalMins % 60;
                                  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
                                };

                               let generationRules: Array<Record<string, unknown>> | null = null;
                               if (details.userConstraints?.length) {
                                 const rules: Array<Record<string, unknown>> = [];
                                 for (const c of details.userConstraints) {
                                   if (c.type === 'full_day_event' && c.allDay) {
                                     if (c.day) {
                                       rules.push({
                                         type: 'blocked_time',
                                         days: [`day_${c.day}`],
                                         from: '00:00',
                                         to: '23:59',
                                         reason: c.description,
                                       });
                                     } else {
                                       rules.push({
                                         type: 'full_day_event',
                                         reason: c.description,
                                         note: 'User requested this as a full-day event but did not specify which day. The must-do scheduler should assign it.',
                                       });
                                     }
                                    } else if (c.type === 'time_block') {
                                       const normalizedTime = c.time ? normalizeTimeTo24h(c.time) : c.time;
                                       
                                       // Priority 1: explicit endTime from chat planner
                                       let computedEndTime: string | undefined;
                                       const rawEndTime = (c as any).endTime;
                                       if (rawEndTime && typeof rawEndTime === 'string') {
                                         computedEndTime = normalizeTimeTo24h(rawEndTime);
                                       }
                                       
                                       // Priority 2: parse time range from description (e.g. "9am to 5pm")
                                       if (!computedEndTime && c.description) {
                                         const rangeMatch = c.description.match(
                                           /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|[-–—])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i
                                         );
                                         if (rangeMatch) {
                                           let endH = parseInt(rangeMatch[4], 10);
                                           const endM = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
                                           const endMeridiem = rangeMatch[6].toLowerCase();
                                           if (endMeridiem === 'pm' && endH < 12) endH += 12;
                                           if (endMeridiem === 'am' && endH === 12) endH = 0;
                                           computedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                                         }
                                       }
                                       
                                       // Priority 3: fall back to duration math
                                       if (!computedEndTime && normalizedTime) {
                                         const rawDuration = (c as any).duration;
                                         const duration = (typeof rawDuration === 'number' && !isNaN(rawDuration) && rawDuration > 0)
                                           ? rawDuration
                                           : (typeof rawDuration === 'string' ? parseInt(rawDuration, 10) || 120 : 120);
                                         computedEndTime = addMinsToTime(normalizedTime, duration);
                                       }
                                       
                                       const endTime = computedEndTime || normalizedTime;
                                       if (c.day && c.time) {
                                         rules.push({
                                           type: 'blocked_time',
                                           days: [`day_${c.day}`],
                                           from: normalizedTime || c.time,
                                           to: endTime || normalizedTime || c.time,
                                          reason: c.description,
                                        });
                                     } else if (c.time) {
                                        rules.push({
                                          type: 'time_preference',
                                          time: c.time,
                                          duration: (c as any).duration || 120,
                                         reason: c.description,
                                         note: 'User requested this at a specific time but did not specify which day.',
                                       });
                                     }
                                   } else if (c.type === 'avoid') {
                                     rules.push({
                                       type: 'avoid',
                                       reason: c.description,
                                     });
                                   } else if (c.type === 'preference') {
                                     rules.push({
                                       type: 'preference',
                                       reason: c.description,
                                     });
                                   } else if (c.type === 'flight') {
                                     rules.push({
                                       type: 'flight_constraint',
                                       day: c.day ? `day_${c.day}` : undefined,
                                       time: c.time,
                                       reason: c.description,
                                     });
                                   }
                                 }
                                 generationRules = rules.length > 0 ? rules : null;
                               }

                              return {
                                mustDoActivities: mustDo,
                                additionalNotes: details.additionalNotes || null,
                                flightDetails: details.flightDetails || null,
                                userConstraints: details.userConstraints || null,
                                pacing: details.pacing || 'balanced',
                                isFirstTimeVisitor: details.isFirstTimeVisitor ?? true,
                                interestCategories: details.interestCategories?.length ? details.interestCategories : null,
                                celebrationDay: details.celebrationDay || null,
                                generationRules,
                                source: 'chat_planner',
                                lastUpdated: new Date().toISOString(),
                              };
                            })() as any,
                          })
                          .select('id')
                          .single();

                        if (error) throw error;

                        // Insert trip_cities rows — STRICT: must succeed before navigation
                        if (isChatMultiCity) {
                          let currentDate = new Date(chatStartDate);
                          const cityRows = chatCities.map((city, idx) => {
                            const arrivalDate = format(currentDate, 'yyyy-MM-dd');
                            currentDate = new Date(currentDate.getTime() + city.nights * 86400000);
                            const departureDate = format(currentDate, 'yyyy-MM-dd');
                            return {
                              trip_id: trip.id,
                              city_order: idx,
                              city_name: city.name,
                              country: city.country || null,
                              arrival_date: arrivalDate,
                              departure_date: departureDate,
                              nights: city.nights,
                              generation_status: 'pending',
                              days_generated: 0,
                              days_total: (city.nights || 1) + 1, // Inclusive day count: nights + 1
                              transport_type: idx > 0 ? (details.cityTransports?.[idx - 1] || null) : null,
                            };
                          });
                          const { error: citiesErr } = await supabase.from('trip_cities').insert(cityRows as any[]);
                          if (citiesErr) {
                            logger.error('[Start] CRITICAL: trip_cities insert failed for multi-city trip:', citiesErr);
                            toast.error('Failed to save city details. Please try again.');
                            // Clean up the orphaned trip
                            await supabase.from('trips').delete().eq('id', trip.id);
                            return;
                          }
                          logger.info('[Start] trip_cities inserted successfully:', {
                            tripId: trip.id,
                            rowCount: cityRows.length,
                            cities: cityRows.map(r => r.city_name),
                          });

                          // ─── SPLIT BUDGET ACROSS CITIES (chat path) ───
                          if (chatBudget) {
                            const totalChatNights = chatCities.reduce((sum, c) => sum + (c.nights || 1), 0);
                            const chatBudgetCents = Math.round(chatBudget * 100);
                            const chatCityBudgets = chatCities.map((c, i) => {
                              const cityNights = c.nights || 1;
                              const share = cityNights / totalChatNights;
                              return { cityOrder: i, allocatedBudgetCents: Math.round(chatBudgetCents * share) };
                            });
                            // Adjust rounding so the sum matches exactly
                            const chatAllocatedSum = chatCityBudgets.reduce((s, c) => s + c.allocatedBudgetCents, 0);
                            if (chatAllocatedSum !== chatBudgetCents) {
                              chatCityBudgets[0].allocatedBudgetCents += (chatBudgetCents - chatAllocatedSum);
                            }
                            for (const cb of chatCityBudgets) {
                              await supabase
                                .from('trip_cities')
                                .update({ allocated_budget_cents: cb.allocatedBudgetCents } as any)
                                .eq('trip_id', trip.id)
                                .eq('city_order', cb.cityOrder);
                            }
                            logger.info('[Start] Chat budget split:', chatCityBudgets.map(c => `City ${c.cityOrder}: $${(c.allocatedBudgetCents / 100).toFixed(2)}`).join(', '));
                          }
                        } else {
                          // Single-city: insert one trip_cities row for unified schema
                          const startMs = chatStartDate.getTime();
                          const endMs = chatEndDate.getTime();
                          const nights = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
                          const { error: singleErr } = await supabase.from('trip_cities').insert({
                            trip_id: trip.id,
                            city_order: 0,
                            city_name: cleanDest,
                            country: (cleanDest.includes(',') ? cleanDest.split(',').pop()?.trim() : null) || null,
                            arrival_date: format(chatStartDate, 'yyyy-MM-dd'),
                            departure_date: format(chatEndDate, 'yyyy-MM-dd'),
                            nights,
                            generation_status: 'pending',
                            days_generated: 0,
                            days_total: nights + 1, // Inclusive day count: nights + 1
                          } as any);
                          if (singleErr) {
                            logger.error('[Start] trip_cities insert failed for single-city trip:', singleErr);
                          }
                        }

                        // Navigation guard: verify multi-city data was persisted correctly
                        if (isChatMultiCity) {
                          const { data: savedTrip } = await supabase
                            .from('trips')
                            .select('is_multi_city, destinations')
                            .eq('id', trip.id)
                            .single();
                          
                          if (!savedTrip?.is_multi_city) {
                            logger.error('[Start] GUARD: Multi-city trip saved but is_multi_city is falsy!', savedTrip);
                            toast.error('Multi-city trip data mismatch. Please try again.');
                            return;
                          }
                        }

                        // Insert linked guests as trip collaborators (mirrors form path)
                        if (linkedGuests.length > 0) {
                          const collabRows = linkedGuests
                            .filter((g) => g.isVoyanceUser)
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
                              console.error('[Start] Failed to insert collaborators (chat path):', collabError);
                            } else {
                              console.log(`[Start] Linked ${collabRows.length} guests to chat trip ${trip.id}`);
                            }
                          }
                        }

                        // Journey split for multi-city chat trips (mirrors form path)
                        if (isChatMultiCity && chatCities.length >= 2) {
                          try {
                            const totalChatDays = Math.ceil((chatEndDate.getTime() - chatStartDate.getTime()) / 86400000);
                            if (totalChatDays >= 8) {
                              const splitResult = await splitJourneyIfNeeded(
                                trip.id,
                                chatCities.map((c) => ({
                                  city: c.name,
                                  country: c.country || '',
                                  nights: c.nights,
                                })),
                                (details.cityTransports || []).map((t: string, i: number) => ({
                                  type: t,
                                  fromCity: chatCities[i]?.name,
                                  toCity: chatCities[i + 1]?.name,
                                })),
                                format(chatStartDate, 'yyyy-MM-dd'),
                                format(chatEndDate, 'yyyy-MM-dd'),
                              );

                              if (splitResult.didSplit) {
                                toast.success(`Journey created: ${splitResult.legCount} legs`);
                                sessionStorage.removeItem('voyance_chat_messages');
                                navigate(`/trip/${splitResult.firstLegTripId}?generate=true`);
                                return;
                              }
                            }
                          } catch (splitErr) {
                            console.warn('[Start] Chat journey split failed, proceeding as single trip:', splitErr);
                          }
                        }

                        sessionStorage.removeItem('voyance_chat_messages');
                        navigate(`/trip/${trip.id}?generate=true`);
                      } catch (err) {
                        console.error('Error creating chat trip:', err);
                        toast.error('Failed to create trip. Please try again.');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    onContinue={() => {
                      // Show DNA prompt between Step 1 and Step 2 if user hasn't taken quiz
                      if (!user.quizCompleted) {
                        setShowDNAPrompt(true);
                      } else {
                        goToStep2();
                      }
                    }}
                    onManualAuthRequired={() => {
                      // User is already authenticated via ProtectedRoute, no-op
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
                    additionalLegs={additionalLegs}
                    setAdditionalLegs={setAdditionalLegs}
                    hotelChoice={hotelChoice}
                    setHotelChoice={setHotelChoice}
                    manualHotel={manualHotel}
                    setManualHotel={setManualHotel}
                    isFirstTimeVisitor={isFirstTimeVisitor}
                    setIsFirstTimeVisitor={setIsFirstTimeVisitor}
                    firstTimePerCity={firstTimePerCity}
                    setFirstTimePerCity={setFirstTimePerCity}
                    manualHotelList={manualHotelList}
                    setManualHotelList={setManualHotelList}
                    manualHotels={manualHotels}
                    setManualHotels={setManualHotels}
                    onSubmit={() => goToStep(3)}
                    onBack={() => window.history.back()}
                    isSubmitting={false}
                    isMultiCity={isMultiCity}
                    multiCityDestinations={multiCityDestinations}
                    multiCityTransports={multiCityTransports}
                    setMultiCityTransports={setMultiCityTransports}
                    transportSelections={transportSelections}
                    onTransportSelect={handleTransportSelect}
                    onIntelligenceCapture={(intel) => setFlightIntelligence(intel)}
                    flightIntelligence={flightIntelligence}
                  />
                )}

                {currentStep === 3 && (
                  <motion.div
                    key="personalize"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="space-y-1">
                        <h2 className="text-xl font-serif font-semibold">Fine-tune this trip</h2>
                        <p className="text-sm text-muted-foreground">We've got your Travel DNA. Here are a few ways to customize this specific itinerary.</p>
                      </div>
                      <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        variant="outline"
                        className="shrink-0 ml-4"
                      >
                        {isSubmitting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                        ) : (
                          <>Skip & Generate <ArrowRight className="w-4 h-4 ml-1" /></>
                        )}
                      </Button>
                    </div>

                     <div className="space-y-3 sm:space-y-4">
                      {/* First-Time Visitor Toggle(s) */}
                      {isMultiCity && multiCityDestinations && multiCityDestinations.length >= 2 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">We'll tailor each city based on your familiarity.</p>
                          <div className="grid gap-2">
                            {multiCityDestinations.map((dest) => {
                              const isFirst = firstTimePerCity[dest.city] ?? true;
                              return (
                                <div key={dest.city} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-medium truncate">First time in {dest.city}?</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs text-muted-foreground">{isFirst ? 'Yes' : 'No'}</span>
                                    <Switch
                                      checked={isFirst}
                                      onCheckedChange={(checked) => {
                                        setFirstTimePerCity({ ...firstTimePerCity, [dest.city]: checked });
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                          <Checkbox
                            id="firstTimeVisitor"
                            checked={isFirstTimeVisitor}
                            onCheckedChange={(checked) => setIsFirstTimeVisitor(checked === true)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <label htmlFor="firstTimeVisitor" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              First time visiting {destinationSelection.cityName}?
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {isFirstTimeVisitor
                                ? "We'll include iconic landmarks and must-see attractions"
                                : "We'll focus on hidden gems and local favorites"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Must-See Landmarks */}
                      <MustSeeLandmarkPicker
                        cities={isMultiCity && multiCityDestinations.length > 0
                          ? multiCityDestinations.map(d => d.city)
                          : destinationSelection.cityName ? [destinationSelection.cityName] : []
                        }
                        selectedLandmarks={selectedLandmarks}
                        onSelectedLandmarksChange={setSelectedLandmarks}
                        customItems={customMustDos}
                        onCustomItemsChange={setCustomMustDos}
                      />

                      {/* Generation Rules */}
                      <GenerationRules
                        rules={generationRules}
                        onRulesChange={setGenerationRules}
                        startDate={startDate ? format(startDate, 'yyyy-MM-dd') : undefined}
                        endDate={endDate ? format(endDate, 'yyyy-MM-dd') : undefined}
                      />

                      {/* Anything else? */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.2em] uppercase font-medium text-muted-foreground">
                            <MessageSquareText className="w-3.5 h-3.5" />
                            Anything else?
                          </label>
                          <span className="text-xs text-muted-foreground/60">(optional)</span>
                        </div>
                        <Textarea
                          value={mustDoActivities}
                          onChange={(e) => setMustDoActivities(e.target.value)}
                          placeholder="Paste notes, other AI suggestions, skip requests, or special requirements..."
                          className="min-h-[70px] resize-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between pt-4">
                      <Button variant="ghost" onClick={() => window.history.back()}>
                        Back
                      </Button>
                      <Button
                        onClick={handleSubmit}
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
                )}
              </AnimatePresence>
            </div>

            {/* Motivation Sidebar */}
            <MotivationSidebar />
          </div>
        </div>
      </section>


      {/* Travel DNA Prompt Dialog */}
      <Dialog open={showDNAPrompt} onOpenChange={setShowDNAPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Want a personalized trip?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              We don't have your Travel DNA yet - a quick 5-minute quiz lets us tailor 
              every recommendation to your pace, style, and interests.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            You can skip this and still build a great trip, but personalized itineraries 
            are significantly more accurate.
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
                  firstTimePerCity,
                  mustDoActivities,
                  selectedLandmarks,
                  selectedCategories,
                  customMustDos,
                  generationRules,
                  currentStep: 1,
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
                goToStep2();
              }}
            >
              Skip for now
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
            setTravelers(Math.min(20, guests.length + 1));
          }
        }}
      />
    </MainLayout>
  );
}
