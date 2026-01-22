/**
 * Editorial Itinerary Component
 * 
 * Unified editorial-style itinerary display with editing capabilities.
 * This component matches the SampleItinerary design while supporting:
 * - Lock/unlock activities
 * - Reorder activities (move up/down)
 * - Regenerate individual days
 * - Add manual activities
 * - Delete activities
 * - Save changes
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp, ChevronDown, MapPin, Clock, Star, Save,
  Lock, Unlock, MoveUp, MoveDown, Plus, RefreshCw,
  Plane, Hotel, Utensils, Camera, ShoppingBag, Palmtree, Car, Trash2,
  Sun, Cloud, CloudRain, CloudSun, Snowflake, Edit3, Sparkles, AlertCircle,
  Calendar, Users, ExternalLink, Route, Search, ArrowRightLeft,
  Globe, Wallet, Languages, Train, ChevronLeft, ChevronRight, Info, Images,
  CreditCard, Library, TrendingUp, Share2, Link2, Copy, Check
} from 'lucide-react';
import { HotelGalleryModal } from './HotelGalleryModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isToday } from 'date-fns';
import type { ActivityType, WeatherCondition } from '@/types/itinerary';
import { useActivityImage, getActivityPlaceholder } from '@/hooks/useActivityImage';
import AirlineLogo from '@/components/planner/shared/AirlineLogo';
import { WeatherForecast } from './WeatherForecast';
import { VendorBookingLink } from '@/components/booking/VendorBookingLink';
import { InlineBookingActions } from '@/components/booking/InlineBookingActions';
import { PaymentsTab } from './PaymentsTab';
import { getTripPayments, type TripPayment } from '@/services/tripPaymentsAPI';
import { useEntitlements } from '@/hooks/useEntitlements';
import { UpgradePrompt } from '@/components/checkout/UpgradePrompt';
import { AddFlightInline, AddHotelInline } from './AddBookingInline';
// SaveToLibraryModal removed - agent features disabled
import type { BookingItemState, TravelerInfo } from '@/services/bookingStateMachine';

// =============================================================================
// TYPES
// =============================================================================

export interface EditorialActivity {
  id: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  time?: string; // For backward compatibility
  duration?: string;
  durationMinutes?: number;
  category?: string;
  type?: ActivityType;
  cost?: { amount: number; currency: string };
  estimatedCost?: { amount: number; currency: string }; // Fallback from AI generation
  location?: { name?: string; address?: string; lat?: number; lng?: number };
  rating?: { value: number; totalReviews: number } | number;
  tags?: string[];
  bookingRequired?: boolean;
  tips?: string;
  photos?: Array<{ url: string } | string>;
  transportation?: {
    method: string;
    duration: string;
    distance?: string;
    estimatedCost?: { amount: number; currency: string };
    instructions?: string;
  };
  timeBlockType?: string;
  isLocked?: boolean;
  website?: string;
  bookingUrl?: string; // External booking URL for affiliate links
  // Booking state fields
  bookingState?: BookingItemState;
  quotePriceCents?: number;
  quoteExpiresAt?: string;
  quoteLocked?: boolean;
  confirmationNumber?: string;
  voucherUrl?: string;
  voucherData?: {
    voucherCode?: string;
    voucherUrl?: string;
    qrCode?: string;
    redemptionInstructions?: string;
  };
  cancellationPolicy?: {
    deadline: string;
    refundPercentage: number;
    description: string;
  };
  travelerData?: TravelerInfo[];
  vendorName?: string;
  bookedAt?: string;
  cancelledAt?: string;
}

export interface EditorialDay {
  dayNumber: number;
  date?: string;
  title?: string;
  theme?: string;
  description?: string;
  activities: EditorialActivity[];
  weather?: {
    condition?: string;
    high?: number;
    low?: number;
  };
  estimatedWalkingTime?: string;
  estimatedDistance?: string;
}

export interface FlightSelection {
  outbound?: {
    airline?: string;
    airlineCode?: string;
    flightNumber?: string;
    departure?: { time?: string; airport?: string; date?: string };
    arrival?: { time?: string; airport?: string };
    price?: number;
    cabinClass?: string;
    seat?: string;
  };
  return?: {
    airline?: string;
    airlineCode?: string;
    flightNumber?: string;
    departure?: { time?: string; airport?: string; date?: string };
    arrival?: { time?: string; airport?: string };
    price?: number;
    cabinClass?: string;
    seat?: string;
  };
}

export interface HotelSelection {
  name?: string;
  address?: string;
  rating?: number;
  pricePerNight?: number;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  imageUrl?: string;
  images?: string[];
  amenities?: string[];
  type?: string;
  reviewCount?: number;
  neighborhood?: string;
  description?: string;
  website?: string;
  googleMapsUrl?: string;
}

export interface EditorialItineraryProps {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budgetTier?: string;
  style?: string;
  pace?: string;
  days: EditorialDay[];
  flightSelection?: FlightSelection | null;
  hotelSelection?: HotelSelection | null;
  destinationInfo?: {
    overview?: string;
    culturalNotes?: string;
    bestTime?: string;
    currency?: string;
    currencySymbol?: string;
    language?: string;
    tips?: string;
    timezone?: string;
    emergency?: string;
    tipping?: string;
    dress?: string;
    transit?: string;
    water?: string;
    voltage?: string;
  };
  heroImageUrl?: string;
  isEditable?: boolean;
  originCity?: string;
  onSave?: (days: EditorialDay[]) => Promise<void>;
  onRegenerateDay?: (dayNumber: number) => Promise<EditorialDay | null>;
  onBookingAdded?: () => void;
}

// =============================================================================
// CONSTANTS & STYLES
// =============================================================================

const activityStyles: Record<string, { icon: React.ReactNode; label: string }> = {
  transportation: { icon: <Plane className="h-4 w-4" />, label: 'Transport' },
  transport: { icon: <Car className="h-4 w-4" />, label: 'Transport' },
  accommodation: { icon: <Hotel className="h-4 w-4" />, label: 'Stay' },
  dining: { icon: <Utensils className="h-4 w-4" />, label: 'Dining' },
  cultural: { icon: <Camera className="h-4 w-4" />, label: 'Culture' },
  sightseeing: { icon: <MapPin className="h-4 w-4" />, label: 'Explore' },
  activity: { icon: <Camera className="h-4 w-4" />, label: 'Activity' },
  relaxation: { icon: <Palmtree className="h-4 w-4" />, label: 'Wellness' },
  shopping: { icon: <ShoppingBag className="h-4 w-4" />, label: 'Shopping' },
};

const weatherIcons: Record<string, React.ReactNode> = {
  sunny: <Sun className="h-4 w-4 text-amber-500" />,
  clear: <Sun className="h-4 w-4 text-amber-500" />,
  'partly-cloudy': <Cloud className="h-4 w-4 text-slate-400" />,
  cloudy: <Cloud className="h-4 w-4 text-slate-500" />,
  rainy: <CloudRain className="h-4 w-4 text-blue-500" />,
  rain: <CloudRain className="h-4 w-4 text-blue-500" />,
  snowy: <Snowflake className="h-4 w-4 text-blue-300" />,
  snow: <Snowflake className="h-4 w-4 text-blue-300" />,
};

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(time: string | undefined): string {
  if (!time || typeof time !== 'string') return '';
  
  const cleanTime = time.trim();
  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(cleanTime)) {
    return cleanTime;
  }
  
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return cleanTime;
  
  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  
  if (isNaN(hours)) return cleanTime;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined) {
    return '-'; // Should never happen with smart estimation
  }
  if (amount === 0) {
    return 'Free';
  }
  // Use the provided currency (from activity data) for proper localization
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}

function normalizeCurrencyCode(input: unknown): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  // Common symbols / names → ISO 4217 codes
  const map: Record<string, string> = {
    '$': 'USD',
    'USD': 'USD',
    'US DOLLAR': 'USD',
    'DOLLAR': 'USD',

    '€': 'EUR',
    'EUR': 'EUR',
    'EURO': 'EUR',

    '£': 'GBP',
    'GBP': 'GBP',
    'POUND': 'GBP',
    'POUNDS': 'GBP',

    '¥': 'JPY',
    'JPY': 'JPY',
    'YEN': 'JPY',
  };

  return map[upper] ?? (upper.length === 3 ? upper : null);
}

function inferCurrencyFromCountry(country?: string): string | null {
  if (!country) return null;
  const c = country.trim().toLowerCase();

  const eurozone = new Set([
    'austria', 'belgium', 'croatia', 'cyprus', 'estonia', 'finland', 'france',
    'germany', 'greece', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg',
    'malta', 'netherlands', 'portugal', 'slovakia', 'slovenia', 'spain',
  ]);

  if (eurozone.has(c)) return 'EUR';
  if (c === 'united kingdom' || c === 'uk' || c === 'england' || c === 'scotland' || c === 'wales' || c === 'northern ireland') return 'GBP';
  if (c === 'united states' || c === 'usa' || c === 'us') return 'USD';
  if (c === 'japan') return 'JPY';

  return null;
}

function inferCurrencyFromDays(days: EditorialDay[]): string | null {
  const counts = new Map<string, number>();

  for (const day of days) {
    for (const act of day.activities ?? []) {
      const cur = normalizeCurrencyCode((act as any)?.cost?.currency);
      if (cur) counts.set(cur, (counts.get(cur) ?? 0) + 1);
    }
  }

  let best: { cur: string; n: number } | null = null;
  for (const [cur, n] of counts.entries()) {
    if (!best || n > best.n) best = { cur, n };
  }
  return best?.cur ?? null;
}

// Smart cost estimation by category when no explicit cost is provided
// Base costs are per-person, will be multiplied by travelers
const CATEGORY_COST_ESTIMATES: Record<string, { base: number; budgetMod: Record<string, number> }> = {
  // Dining
  breakfast: { base: 18, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  brunch: { base: 28, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  lunch: { base: 22, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  dinner: { base: 45, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  dining: { base: 35, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.6, splurge: 2.2 } },
  coffee: { base: 8, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.3, splurge: 1.5 } },
  cafe: { base: 12, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  // Activities
  museum: { base: 20, budgetMod: { budget: 0.8, moderate: 1, luxury: 1.2, splurge: 1.5 } },
  cultural: { base: 25, budgetMod: { budget: 0.7, moderate: 1, luxury: 1.3, splurge: 1.6 } },
  sightseeing: { base: 15, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  tour: { base: 50, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.6, splurge: 2.2 } },
  activity: { base: 30, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  adventure: { base: 75, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.4, splurge: 1.8 } },
  // Relaxation
  spa: { base: 100, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.8, splurge: 3.0 } },
  relaxation: { base: 40, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.6, splurge: 2.5 } },
  beach: { base: 10, budgetMod: { budget: 0.8, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  // Shopping/Entertainment
  shopping: { base: 50, budgetMod: { budget: 0.4, moderate: 1, luxury: 2.0, splurge: 3.5 } },
  entertainment: { base: 40, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  nightlife: { base: 60, budgetMod: { budget: 0.5, moderate: 1, luxury: 1.8, splurge: 2.5 } },
  // Transport/Other
  transportation: { base: 25, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  transport: { base: 20, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } },
  accommodation: { base: 0, budgetMod: { budget: 1, moderate: 1, luxury: 1, splurge: 1 } }, // Usually bundled
};

function estimateCostByCategory(
  category: string | undefined,
  travelers: number = 1,
  budgetTier: string = 'moderate'
): number {
  const cat = (category || 'activity').toLowerCase();
  
  // Find matching category (check for partial matches too)
  let estimate = CATEGORY_COST_ESTIMATES[cat];
  if (!estimate) {
    // Check for partial matches in title keywords
    for (const [key, val] of Object.entries(CATEGORY_COST_ESTIMATES)) {
      if (cat.includes(key) || key.includes(cat)) {
        estimate = val;
        break;
      }
    }
  }
  
  // Default fallback
  if (!estimate) {
    estimate = { base: 25, budgetMod: { budget: 0.6, moderate: 1, luxury: 1.5, splurge: 2.0 } };
  }
  
  const budgetMultiplier = estimate.budgetMod[budgetTier.toLowerCase()] || 1;
  const baseCost = estimate.base * budgetMultiplier;
  
  // Add 20% for tip/tax on dining categories
  const isDining = ['breakfast', 'brunch', 'lunch', 'dinner', 'dining', 'coffee', 'cafe'].includes(cat);
  const withTax = isDining ? baseCost * 1.2 : baseCost;
  
  // Multiply by travelers and round to nearest $5
  const total = withTax * travelers;
  return Math.round(total / 5) * 5;
}

function getActivityCost(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate'
): number {
  // Check cost.amount first, then estimatedCost.amount as fallback
  if (activity.cost?.amount !== undefined && activity.cost.amount >= 0) {
    return activity.cost.amount;
  }
  if (activity.estimatedCost?.amount !== undefined && activity.estimatedCost.amount >= 0) {
    return activity.estimatedCost.amount;
  }
  
  // Smart estimation based on category, travelers, and budget
  const category = activity.category || activity.type || 'activity';
  return estimateCostByCategory(category, travelers, budgetTier);
}

function getActivityType(activity: EditorialActivity): string {
  return activity.category || activity.type || 'activity';
}

function getActivityRating(activity: EditorialActivity): number | null {
  if (typeof activity.rating === 'number') return activity.rating;
  if (typeof activity.rating === 'object' && activity.rating?.value) return activity.rating.value;
  return null;
}

function getActivityPhoto(activity: EditorialActivity): string | null {
  if (!activity.photos || activity.photos.length === 0) return null;
  const photo = activity.photos[0];
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object' && photo.url) return photo.url;
  return null;
}

function getDayTotalCost(activities: EditorialActivity[], travelers: number = 1, budgetTier: string = 'moderate'): number {
  return activities.reduce((sum, act) => sum + getActivityCost(act, travelers, budgetTier), 0);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EditorialItinerary({
  tripId,
  destination,
  destinationCountry,
  startDate,
  endDate,
  travelers,
  budgetTier,
  style,
  pace,
  days: initialDays,
  flightSelection,
  hotelSelection,
  destinationInfo,
  heroImageUrl,
  isEditable = true,
  originCity,
  onSave,
  onRegenerateDay,
  onBookingAdded,
}: EditorialItineraryProps) {
  const [days, setDays] = useState<EditorialDay[]>(initialDays);
  const [expandedDays, setExpandedDays] = useState<number[]>(initialDays.map(d => d.dayNumber));
  const [activeTab, setActiveTab] = useState<'itinerary' | 'payments' | 'weather' | 'overview' | 'needtoknow'>('itinerary');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [addActivityModal, setAddActivityModal] = useState<{ dayIndex: number } | null>(null);
  const [timeEditModal, setTimeEditModal] = useState<{ dayIndex: number; activityIndex: number; activity: EditorialActivity } | null>(null);
  const [hotelGalleryOpen, setHotelGalleryOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [pendingRegenerateDay, setPendingRegenerateDay] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showLocalCurrency, setShowLocalCurrency] = useState(true); // Currency display preference

  // Calculate trip progress for feedback tracking
  const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);
  const feedbackCount = payments.filter(p => p.status === 'paid').length;
  const progressPercent = totalActivities > 0 ? Math.min((feedbackCount / totalActivities) * 100, 100) : 0;

  // Day navigation
  const canGoPrev = selectedDayIndex > 0;
  const canGoNext = selectedDayIndex < days.length - 1;

  // Get entitlements for credit checking
  const { data: entitlements, isPaid } = useEntitlements();

  // Fetch payments on mount
  useEffect(() => {
    async function fetchPayments() {
      const result = await getTripPayments(tripId);
      if (result.success && result.payments) {
        setPayments(result.payments);
      }
    }
    fetchPayments();
  }, [tripId]);

  // Helper to find payment for an item
  const getPaymentForItem = useCallback((itemType: 'flight' | 'hotel' | 'activity', itemId: string): TripPayment | undefined => {
    return payments.find(p => p.item_type === itemType && p.item_id === itemId);
  }, [payments]);

  // Refresh payments after booking
  const refreshPayments = useCallback(async () => {
    const result = await getTripPayments(tripId);
    if (result.success && result.payments) {
      setPayments(result.payments);
    }
  }, [tripId]);

  // Calculate totals with smart estimation
  const totalActivityCost = days.reduce((sum, day) => sum + getDayTotalCost(day.activities, travelers, budgetTier), 0);
  const flightCost = (flightSelection?.outbound?.price || 0) + (flightSelection?.return?.price || 0);
  const hotelCost = (hotelSelection?.pricePerNight || 0) * (hotelSelection?.nights || days.length);
  const totalCost = totalActivityCost + flightCost + hotelCost;
  
  // Derive local currency robustly (destinationInfo is often undefined on TripDetail)
  // IMPORTANT: If the trip is in the Eurozone, prefer EUR even if some upstream metadata is wrong.
  const countryCurrency = inferCurrencyFromCountry(destinationCountry);
  const destinationCurrency =
    normalizeCurrencyCode(destinationInfo?.currency) ||
    normalizeCurrencyCode(destinationInfo?.currencySymbol);
  const daysCurrency = inferCurrencyFromDays(days);

  const localCurrency =
    (countryCurrency && destinationCurrency && countryCurrency !== destinationCurrency
      ? countryCurrency
      : destinationCurrency) ||
    countryCurrency ||
    daysCurrency ||
    'EUR';
  
  // Display currency based on user preference toggle
  const tripCurrency = showLocalCurrency ? localCurrency : 'USD';

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev =>
      prev.includes(dayNumber)
        ? prev.filter(d => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  // Auto-save when there are changes (debounced)
  // Supports both database trips and localStorage demo trips
  useEffect(() => {
    if (!hasChanges || !isEditable) return;
    
    const autoSaveTimer = setTimeout(async () => {
      try {
        const itineraryData = {
          days: JSON.parse(JSON.stringify(days)),
          status: 'ready',
          savedAt: new Date().toISOString(),
        };

        // Try database first
        const { data: existingTrip, error: checkError } = await supabase
          .from('trips')
          .select('id')
          .eq('id', tripId)
          .maybeSingle();

        if (existingTrip && !checkError) {
          // Trip exists in database - save there
          const { error } = await supabase
            .from('trips')
            .update({
              itinerary_data: itineraryData,
              itinerary_status: 'ready',
              updated_at: new Date().toISOString()
            })
            .eq('id', tripId);

          if (!error) {
            setHasChanges(false);
            setLastSaved(new Date());
            console.log('[EditorialItinerary] Auto-saved to database');
          } else {
            console.error('[EditorialItinerary] Database save failed:', error);
          }
        } else {
          // Trip is in localStorage - always persist there so refreshes never re-trigger generation
          const localStorageKey = 'voyance_demo_trips';
          const demoTripsRaw = localStorage.getItem(localStorageKey);
          const demoTrips = demoTripsRaw ? JSON.parse(demoTripsRaw) : {};

          demoTrips[tripId] = {
            ...(demoTrips[tripId] || {}),
            id: tripId,
            itinerary_data: itineraryData,
            itinerary_status: 'ready',
            updated_at: new Date().toISOString(),
          };

          localStorage.setItem(localStorageKey, JSON.stringify(demoTrips));
          setHasChanges(false);
          setLastSaved(new Date());
          console.log('[EditorialItinerary] Auto-saved to localStorage');
        }
      } catch (err) {
        console.error('[EditorialItinerary] Auto-save failed:', err);
      }
    }, 3000); // Auto-save 3 seconds after last change

    return () => clearTimeout(autoSaveTimer);
  }, [hasChanges, days, tripId, isEditable]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const itineraryData = {
        days: JSON.parse(JSON.stringify(days)),
        status: 'ready',
        savedAt: new Date().toISOString(),
      };

      // Check if trip exists in database
      const { data: existingTrip } = await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .maybeSingle();

      let saved = false;

      if (existingTrip) {
        // Save to database
        const { error } = await supabase
          .from('trips')
          .update({
            itinerary_data: itineraryData,
            itinerary_status: 'ready',
            updated_at: new Date().toISOString()
          })
          .eq('id', tripId);

        if (error) throw error;
        saved = true;
      } else {
        // Save to localStorage
        const localStorageKey = 'voyance_demo_trips';
        const demoTripsRaw = localStorage.getItem(localStorageKey);
        const demoTrips = demoTripsRaw ? JSON.parse(demoTripsRaw) : {};
        
        if (demoTrips[tripId]) {
          demoTrips[tripId].itinerary_data = itineraryData;
          demoTrips[tripId].itinerary_status = 'ready';
          demoTrips[tripId].updated_at = new Date().toISOString();
          localStorage.setItem(localStorageKey, JSON.stringify(demoTrips));
          saved = true;
        } else {
          // Try legacy format
          const legacyKey = `trip_${tripId}`;
          const legacyRaw = localStorage.getItem(legacyKey);
          if (legacyRaw) {
            const legacyTrip = JSON.parse(legacyRaw);
            legacyTrip.itinerary_data = itineraryData;
            localStorage.setItem(legacyKey, JSON.stringify(legacyTrip));
            saved = true;
          }
        }
      }

      if (saved) {
        if (onSave) await onSave(days);
        setHasChanges(false);
        setLastSaved(new Date());
        toast.success('Itinerary saved!');
      } else {
        toast.error('Could not find trip to save');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [days, tripId, onSave]);

  // Optimize itinerary: route optimization, real transport, real costs
  const handleOptimize = useCallback(async () => {
    setIsOptimizing(true);
    try {
      toast.info('Optimizing routes and fetching real costs...', { duration: 3000 });
      
      const { data, error } = await supabase.functions.invoke('optimize-itinerary', {
        body: {
          tripId,
          destination,
          days: days.map(d => ({
            dayNumber: d.dayNumber,
            date: d.date,
            activities: d.activities.map(a => ({
              id: a.id,
              title: a.title,
              category: a.category || a.type,
              startTime: a.startTime,
              endTime: a.endTime,
              location: a.location,
              cost: a.cost,
              isLocked: a.isLocked,
              transportation: a.transportation,
            })),
          })),
          enableRouteOptimization: true,
          enableRealTransport: true,
          enableCostLookup: true,
        }
      });

      if (error) throw error;

      if (data?.days) {
        // Update days with optimized data
        setDays(prev => prev.map((day, idx) => {
          const optimizedDay = data.days[idx];
          if (!optimizedDay) return day;
          return {
            ...day,
            activities: optimizedDay.activities.map((optAct: EditorialActivity, actIdx: number) => ({
              ...day.activities[actIdx],
              ...optAct,
            })),
          };
        }));
        setHasChanges(true);
        
        const meta = data.metadata || {};
        toast.success(`Optimized! ${meta.transportCalculated || 0} routes calculated, ${meta.costsLookedUp || 0} prices updated`);
      }
    } catch (err) {
      console.error('Optimize error:', err);
      toast.error('Failed to optimize itinerary');
    } finally {
      setIsOptimizing(false);
    }
  }, [days, tripId, destination]);

  const handleActivityLock = useCallback((dayIndex: number, activityId: string) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.map(act =>
          act.id === activityId ? { ...act, isLocked: !act.isLocked } : act
        )
      };
    }));
    setHasChanges(true);
  }, []);

  const handleActivityMove = useCallback((dayIndex: number, activityId: string, direction: 'up' | 'down') => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      const activities = [...day.activities];
      const actIdx = activities.findIndex(a => a.id === activityId);
      if (actIdx === -1) return day;
      
      const newIdx = direction === 'up' ? actIdx - 1 : actIdx + 1;
      if (newIdx < 0 || newIdx >= activities.length) return day;
      
      [activities[actIdx], activities[newIdx]] = [activities[newIdx], activities[actIdx]];
      return { ...day, activities };
    }));
    setHasChanges(true);
  }, []);

  const handleActivityRemove = useCallback((dayIndex: number, activityId: string) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return { ...day, activities: day.activities.filter(act => act.id !== activityId) };
    }));
    setHasChanges(true);
    toast.success('Activity removed');
  }, []);

  // Check if user can regenerate (is paid subscriber)
  const canRegenerate = useCallback(() => {
    // Paid users always can
    if (isPaid) return true;
    // Free users: check if they have remaining builds
    const freeBuildsRemaining = entitlements?.limits?.freeBuildsRemaining ?? 0;
    return freeBuildsRemaining > 0;
  }, [isPaid, entitlements?.limits?.freeBuildsRemaining]);

  // Request regeneration - checks entitlements first
  const requestDayRegenerate = useCallback((dayIndex: number) => {
    if (canRegenerate()) {
      // Has access - proceed with regeneration
      handleDayRegenerateInternal(dayIndex);
    } else {
      // Show upgrade prompt
      setPendingRegenerateDay(dayIndex);
      setShowCreditPrompt(true);
    }
  }, [canRegenerate]);

  // Internal regenerate handler (after credit check passed)
  const handleDayRegenerateInternal = useCallback(async (dayIndex: number) => {
    const day = days[dayIndex];
    if (!day) return;

    setRegeneratingDay(day.dayNumber);
    try {
      if (onRegenerateDay) {
        const newDay = await onRegenerateDay(day.dayNumber);
        if (newDay) {
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? newDay : d));
          setHasChanges(true);
          toast.success(`Day ${day.dayNumber} regenerated!`);
        }
      } else {
        const { data, error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'generate-day',
            tripId,
            dayNumber: day.dayNumber,
            totalDays: days.length,
            destination,
            destinationCountry,
            date: day.date,
            travelers,
            budgetTier,
          }
        });

        if (error) throw error;
        if (data?.day) {
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? data.day : d));
          setHasChanges(true);
          toast.success(`Day ${day.dayNumber} regenerated!`);
        }
      }
    } catch (err) {
      console.error('Regenerate error:', err);
      toast.error('Failed to regenerate day');
    } finally {
      setRegeneratingDay(null);
    }
  }, [days, tripId, destination, destinationCountry, travelers, budgetTier, onRegenerateDay]);

  // Alias for backwards compatibility
  const handleDayRegenerate = requestDayRegenerate;

  const handleDayLock = useCallback((dayIndex: number) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      const allLocked = day.activities.every(a => a.isLocked);
      return {
        ...day,
        activities: day.activities.map(a => ({ ...a, isLocked: !allLocked }))
      };
    }));
    setHasChanges(true);
  }, []);

  const handleAddActivity = useCallback((dayIndex: number, activity: Partial<EditorialActivity>) => {
    const newActivity: EditorialActivity = {
      id: `manual-${Date.now()}`,
      title: activity.title || 'New Activity',
      description: activity.description || '',
      category: activity.category || 'activity',
      startTime: activity.startTime || '12:00',
      endTime: activity.endTime || '13:00',
      location: activity.location || { name: '', address: '' },
      cost: activity.cost || { amount: 0, currency: 'USD' },
      bookingRequired: activity.bookingRequired || false,
      tags: activity.tags || [],
      isLocked: false,
    };

    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return { ...day, activities: [...day.activities, newActivity] };
    }));
    setHasChanges(true);
    setAddActivityModal(null);
    toast.success('Activity added!');
  }, []);

  // Update activity time
  const handleUpdateActivityTime = useCallback((dayIndex: number, activityIndex: number, startTime: string, endTime: string) => {
    setDays(prev => prev.map((day, dIdx) => {
      if (dIdx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.map((activity, aIdx) => {
          if (aIdx !== activityIndex) return activity;
          return {
            ...activity,
            startTime,
            endTime,
            time: startTime, // Keep backward compatibility
          };
        }),
      };
    }));
    setHasChanges(true);
    setTimeEditModal(null);
    toast.success('Activity time updated');
  }, []);

  // Create and copy invite link
  const handleCreateShareLink = useCallback(async () => {
    setIsCreatingInvite(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to share your trip');
        return;
      }

      // Check if an invite already exists for this trip
      const { data: existingInvite } = await supabase
        .from('trip_invites')
        .select('token')
        .eq('trip_id', tripId)
        .eq('invited_by', user.id)
        .is('email', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      let token = existingInvite?.token;

      if (!token) {
        // Create new invite
        const { data: newInvite, error } = await supabase
          .from('trip_invites')
          .insert({
            trip_id: tripId,
            invited_by: user.id,
            max_uses: travelers - 1, // Allow remaining travelers to join
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          })
          .select('token')
          .single();

        if (error) throw error;
        token = newInvite.token;
      }

      const link = `${window.location.origin}/invite/${token}`;
      setShareLink(link);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
      toast.success('Invite link copied!');
    } catch (err) {
      console.error('Failed to create share link:', err);
      toast.error('Failed to create invite link');
    } finally {
      setIsCreatingInvite(false);
    }
  }, [tripId, travelers]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* Trip Summary Bar - Editorial Style */}
      <div className="py-4 px-4 -mx-4 bg-gradient-to-r from-primary/5 via-background to-accent/5 rounded-xl">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Trip info pills */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border border-border text-sm">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">{days.length} Days</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border border-border text-sm">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">{travelers} {travelers === 1 ? 'Guest' : 'Guests'}</span>
            </div>
          </div>
          
          {/* Right: Cost + Actions */}
          <div className="flex items-center gap-2">
            {isEditable && hasChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/50 animate-pulse text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
            {/* Currency Toggle + Total */}
            <div className="flex items-center gap-0">
              <button
                onClick={() => setShowLocalCurrency((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-l-md bg-secondary/50 border border-r-0 border-border text-xs font-medium hover:bg-secondary transition-colors"
                title={`Switch to ${showLocalCurrency ? 'USD' : localCurrency}`}
              >
                <span className={showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>
                  {localCurrency}
                </span>
                <span className="text-muted-foreground/50">/</span>
                <span className={!showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>
                  USD
                </span>
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-r-md bg-primary/10 border border-primary/20 text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold text-primary">{formatCurrency(totalCost, tripCurrency)}</span>
              </div>
            </div>
            
            {/* Share Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="gap-1.5 h-8 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
            
            {isEditable && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleOptimize} 
                  disabled={isOptimizing || days.length === 0} 
                  className="gap-1.5 h-8 text-xs"
                >
                  {isOptimizing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
                  {isOptimizing ? 'Optimizing...' : 'Optimize'}
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSave} 
                  disabled={isSaving || !hasChanges} 
                  className="gap-1.5 h-8 text-xs"
                >
                  {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {hasChanges ? 'Save' : 'Saved ✓'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Destination Photo Carousel */}
      <DestinationCarousel destination={destination} destinationCountry={destinationCountry} />

      {/* Navigation Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {[
            { id: 'itinerary', label: 'Day-by-Day Itinerary', icon: <Calendar className="h-4 w-4" /> },
            { id: 'payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
            { id: 'weather', label: 'Weather', icon: <CloudSun className="h-4 w-4" /> },
            { id: 'overview', label: 'Flight & Hotel', icon: <Plane className="h-4 w-4" /> },
            { id: 'needtoknow', label: 'Need to Know', icon: <Info className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "px-6 py-3 text-sm font-sans tracking-wide transition-colors relative flex items-center gap-2",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="editorialItineraryTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'itinerary' && (
          <motion.div
            key="itinerary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Flight Sync Warning - Show if flight times don't match Day 1 */}
            {flightSelection?.outbound?.arrival?.time && days[0]?.activities?.[0] && (
              <FlightSyncWarning
                flightArrivalTime={flightSelection.outbound.arrival.time}
                day1FirstActivity={days[0].activities[0]}
                onSyncDay1={() => handleDayRegenerate(0)}
                isRegenerating={regeneratingDay === days[0]?.dayNumber}
              />
            )}

            {/* Airport Game Plan - Show before Day 1 */}
            {flightSelection?.outbound && (
              <AirportGamePlan 
                flightSelection={flightSelection} 
                hotelSelection={hotelSelection}
                destination={destination}
              />
            )}

            {/* Day Navigation Bar */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDayIndex(prev => Math.max(0, prev - 1))}
                disabled={!canGoPrev}
                className="shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-2 justify-center">
                  {days.map((day, index) => {
                    const dayDate = day.date ? parseISO(day.date) : null;
                    const isSelected = index === selectedDayIndex;
                    const isTodayDay = dayDate ? isToday(dayDate) : false;
                    
                    return (
                      <button
                        key={day.dayNumber}
                        onClick={() => {
                          setSelectedDayIndex(index);
                          setExpandedDays([day.dayNumber]);
                        }}
                        className={cn(
                          'flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[60px]',
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted/50 hover:bg-muted',
                          isTodayDay && !isSelected && 'ring-2 ring-primary ring-offset-2'
                        )}
                      >
                        {dayDate && (
                          <>
                            <span className="text-xs font-medium">
                              {format(dayDate, 'EEE')}
                            </span>
                            <span className="text-lg font-bold">
                              {format(dayDate, 'd')}
                            </span>
                          </>
                        )}
                        {!dayDate && (
                          <span className="text-lg font-bold">Day {day.dayNumber}</span>
                        )}
                        {isTodayDay && (
                          <Badge variant="secondary" className="text-[10px] mt-1">
                            Today
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDayIndex(prev => Math.min(days.length - 1, prev + 1))}
                disabled={!canGoNext}
                className="shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Show only selected day */}
            {days[selectedDayIndex] && (
              <DayCard
                key={days[selectedDayIndex].dayNumber}
                day={days[selectedDayIndex]}
                dayIndex={selectedDayIndex}
                travelers={travelers}
                budgetTier={budgetTier}
                tripCurrency={tripCurrency}
                destination={destination}
                isExpanded={expandedDays.includes(days[selectedDayIndex].dayNumber)}
                isRegenerating={regeneratingDay === days[selectedDayIndex].dayNumber}
                isEditable={isEditable}
                tripId={tripId}
                getPaymentForItem={getPaymentForItem}
                refreshPayments={refreshPayments}
                onToggle={() => toggleDay(days[selectedDayIndex].dayNumber)}
                onActivityLock={handleActivityLock}
                onActivityMove={handleActivityMove}
                onActivityRemove={handleActivityRemove}
                onDayLock={handleDayLock}
                onDayRegenerate={() => handleDayRegenerate(selectedDayIndex)}
                onAddActivity={() => setAddActivityModal({ dayIndex: selectedDayIndex })}
                onTimeEdit={(dIdx, aIdx, activity) => setTimeEditModal({ dayIndex: dIdx, activityIndex: aIdx, activity })}
              />
            )}
          </motion.div>
        )}

        {activeTab === 'payments' && (
          <PaymentsTab
            tripId={tripId}
            days={days}
            flightSelection={flightSelection}
            hotelSelection={hotelSelection}
            travelers={travelers}
          />
        )}

        {activeTab === 'weather' && (
          <motion.div
            key="weather"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <WeatherForecast
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              tripDays={days.length}
            />
          </motion.div>
        )}

        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* FLIGHT SECTION - Editorial Style */}
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                    <Plane className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-foreground">Flights</h3>
                    <p className="text-xs text-muted-foreground">
                      {flightSelection?.outbound ? 'Your booked flights' : 'Add your flight details'}
                    </p>
                  </div>
                </div>
                {flightCost > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-serif text-xl font-semibold text-foreground">{formatCurrency(flightCost, tripCurrency)}</p>
                  </div>
                )}
              </div>
              
              {flightSelection?.outbound ? (
                <div className="space-y-3">
                  {/* Outbound Flight */}
                  <div className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-soft transition-shadow">
                    <div className="flex items-stretch">
                      {/* Left accent */}
                      <div className="w-1.5 bg-gradient-to-b from-primary to-primary/50 shrink-0" />
                      
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs font-medium">
                              Outbound
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {flightSelection.outbound.departure?.date || startDate}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AirlineLogo 
                              code={flightSelection.outbound.airlineCode || flightSelection.outbound.airline?.substring(0, 2) || ''} 
                              name={flightSelection.outbound.airline}
                              size="sm"
                            />
                            <span className="text-sm font-medium">{flightSelection.outbound.airline}</span>
                            <span className="text-xs text-muted-foreground">{flightSelection.outbound.flightNumber}</span>
                          </div>
                        </div>
                        
                        {/* Route */}
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[60px]">
                            <p className="text-xl font-semibold tracking-tight">{flightSelection.outbound.departure?.time || '--:--'}</p>
                            <p className="text-xs font-medium text-primary">{flightSelection.outbound.departure?.airport || 'DEP'}</p>
                          </div>
                          
                          <div className="flex-1 flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <div className="flex-1 relative">
                              <div className="h-px bg-gradient-to-r from-primary/60 via-border to-primary/60" />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2">
                                {(flightSelection.outbound as Record<string, unknown>).duration ? (
                                  <span className="text-[10px] text-muted-foreground">{(flightSelection.outbound as Record<string, unknown>).duration as string}</span>
                                ) : (
                                  <Plane className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </div>
                          
                          <div className="text-center min-w-[60px]">
                            <p className="text-xl font-semibold tracking-tight">{flightSelection.outbound.arrival?.time || '--:--'}</p>
                            <p className="text-xs font-medium text-primary">{flightSelection.outbound.arrival?.airport || 'ARR'}</p>
                          </div>
                        </div>
                        
                        {(flightSelection.outbound.cabinClass || flightSelection.outbound.seat) && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                            {flightSelection.outbound.cabinClass && (
                              <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{flightSelection.outbound.cabinClass}</span>
                            )}
                            {flightSelection.outbound.seat && (
                              <span className="text-xs text-muted-foreground">Seat {flightSelection.outbound.seat}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Return Flight */}
                  {flightSelection.return && (
                    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-soft transition-shadow">
                      <div className="flex items-stretch">
                        {/* Left accent */}
                        <div className="w-1.5 bg-gradient-to-b from-accent to-accent/50 shrink-0" />
                        
                        <div className="flex-1 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-medium border-accent/30 text-accent">
                                Return
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {flightSelection.return.departure?.date || endDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <AirlineLogo 
                                code={flightSelection.return.airlineCode || flightSelection.return.airline?.substring(0, 2) || ''} 
                                name={flightSelection.return.airline}
                                size="sm"
                              />
                              <span className="text-sm font-medium">{flightSelection.return.airline}</span>
                              <span className="text-xs text-muted-foreground">{flightSelection.return.flightNumber}</span>
                            </div>
                          </div>
                          
                          {/* Route */}
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <p className="text-xl font-semibold tracking-tight">{flightSelection.return.departure?.time || '--:--'}</p>
                              <p className="text-xs font-medium text-accent">{flightSelection.return.departure?.airport || 'DEP'}</p>
                            </div>
                            
                            <div className="flex-1 flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                              <div className="flex-1 relative">
                                <div className="h-px bg-gradient-to-r from-accent/60 via-border to-accent/60" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2">
                                  {(flightSelection.return as Record<string, unknown>).duration ? (
                                    <span className="text-[10px] text-muted-foreground">{(flightSelection.return as Record<string, unknown>).duration as string}</span>
                                  ) : (
                                    <Plane className="h-3 w-3 text-muted-foreground rotate-180" />
                                  )}
                                </div>
                              </div>
                              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                            </div>
                            
                            <div className="text-center min-w-[60px]">
                              <p className="text-xl font-semibold tracking-tight">{flightSelection.return.arrival?.time || '--:--'}</p>
                              <p className="text-xs font-medium text-accent">{flightSelection.return.arrival?.airport || 'ARR'}</p>
                            </div>
                          </div>
                          
                          {(flightSelection.return.cabinClass || flightSelection.return.seat) && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                              {flightSelection.return.cabinClass && (
                                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{flightSelection.return.cabinClass}</span>
                              )}
                              {flightSelection.return.seat && (
                                <span className="text-xs text-muted-foreground">Seat {flightSelection.return.seat}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty State - Add Flight CTA */
                <div className="rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Plane className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h4 className="font-medium text-foreground mb-1">No flights added yet</h4>
                      <p className="text-sm text-muted-foreground">Book your flight anywhere, then add the details here to sync your itinerary.</p>
                    </div>
                    <Button 
                      onClick={() => {
                        // Trigger the AddFlightInline dialog
                        const btn = document.querySelector('[data-add-flight-trigger]') as HTMLButtonElement;
                        btn?.click();
                      }}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Flight
                    </Button>
                  </div>
                  {/* Hidden AddFlightInline for the dialog */}
                  <div className="hidden">
                    <AddFlightInline
                      tripId={tripId}
                      destination={destination}
                      startDate={startDate}
                      endDate={endDate}
                      travelers={travelers}
                      origin={originCity}
                      onFlightAdded={onBookingAdded}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* HOTEL SECTION - Editorial Style */}
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                    <Hotel className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-foreground">Accommodation</h3>
                    <p className="text-xs text-muted-foreground">
                      {hotelSelection?.name ? `${hotelSelection.nights || days.length} nights` : 'Where you\'ll stay'}
                    </p>
                  </div>
                </div>
                {hotelCost > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-serif text-xl font-semibold text-foreground">{formatCurrency(hotelCost, tripCurrency)}</p>
                  </div>
                )}
              </div>
              
              {hotelSelection?.name ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden group">
                  {/* Hotel Image Header */}
                  <div 
                    className="relative h-48 bg-muted/30 cursor-pointer overflow-hidden" 
                    onClick={() => {
                      if (hotelSelection?.images && hotelSelection.images.length > 0) {
                        setHotelGalleryOpen(true);
                      }
                    }}
                  >
                    {hotelSelection?.imageUrl ? (
                      <img
                        src={hotelSelection.imageUrl}
                        alt={hotelSelection.name || 'Hotel'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { 
                          e.currentTarget.src = `https://source.unsplash.com/800x400/?hotel,${destination}`;
                        }}
                      />
                    ) : hotelSelection?.name ? (
                      <img
                        src={`https://source.unsplash.com/800x400/?hotel,${hotelSelection.name.split(' ')[0]},${destination}`}
                        alt={hotelSelection.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { 
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/50">
                        <Hotel className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    {/* Photo count */}
                    {hotelSelection?.images && hotelSelection.images.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setHotelGalleryOpen(true);
                        }}
                        className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Images className="h-3 w-3" />
                        {hotelSelection.images.length}
                      </button>
                    )}
                    
                    {/* Hotel Name Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h4 className="font-serif text-xl font-semibold text-white mb-1">{hotelSelection.name}</h4>
                      {hotelSelection.rating && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star} 
                                className={cn(
                                  "h-3.5 w-3.5",
                                  star <= Math.floor(hotelSelection.rating || 0) 
                                    ? "text-amber-400 fill-amber-400" 
                                    : "text-white/30"
                                )} 
                              />
                            ))}
                          </div>
                          <span className="text-white/80 text-xs">{hotelSelection.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Hotel Details */}
                  <div className="p-4 space-y-4">
                    {/* Quick Info */}
                    <div className="flex flex-wrap gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
                        <span className="text-muted-foreground">Check-in:</span>
                        <span className="font-medium">{hotelSelection.checkIn || '3:00 PM'}</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
                        <span className="text-muted-foreground">Check-out:</span>
                        <span className="font-medium">{hotelSelection.checkOut || '11:00 AM'}</span>
                      </div>
                      {hotelSelection.pricePerNight && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-sm border border-primary/10">
                          <span className="font-medium text-primary">${hotelSelection.pricePerNight}/night</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Address */}
                    {hotelSelection.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{hotelSelection.address}</span>
                      </div>
                    )}
                    
                    {/* Amenities */}
                    {hotelSelection.amenities && hotelSelection.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {hotelSelection.amenities.slice(0, 6).map((amenity, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs font-normal">
                            {amenity}
                          </Badge>
                        ))}
                        {hotelSelection.amenities.length > 6 && (
                          <Badge variant="outline" className="text-xs font-normal">
                            +{hotelSelection.amenities.length - 6}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Actions */}
                    {(hotelSelection.website || hotelSelection.googleMapsUrl || hotelCost > 0) && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        {(hotelSelection.website || hotelSelection.googleMapsUrl) && (
                          <a
                            href={hotelSelection.website || hotelSelection.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-secondary/50 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {hotelSelection.website ? 'Website' : 'Maps'}
                          </a>
                        )}
                        {hotelCost > 0 && (
                          <VendorBookingLink
                            activityName={hotelSelection.name || 'Hotel'}
                            destination={destination}
                            estimatedPrice={hotelCost}
                            preferredVendor="tripadvisor"
                            className="flex-1 text-xs"
                          >
                            Find Similar
                          </VendorBookingLink>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Empty State - Add Hotel CTA */
                <div className="rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Hotel className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h4 className="font-medium text-foreground mb-1">No accommodation added</h4>
                      <p className="text-sm text-muted-foreground">Find and book a hotel, or add your existing reservation details.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <AddHotelInline
                        tripId={tripId}
                        destination={destination}
                        startDate={startDate}
                        endDate={endDate}
                        travelers={travelers}
                        onHotelAdded={onBookingAdded}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </motion.div>
        )}

        {activeTab === 'needtoknow' && (
          <motion.div
            key="needtoknow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <NeedToKnowSection 
              destination={destination}
              destinationCountry={destinationCountry}
              destinationInfo={destinationInfo}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Activity Modal */}
      <AddActivityModal
        isOpen={!!addActivityModal}
        onClose={() => setAddActivityModal(null)}
        onAdd={(activity) => addActivityModal && handleAddActivity(addActivityModal.dayIndex, activity)}
      />

      {/* Time Edit Modal */}
      <TimeEditModal
        isOpen={!!timeEditModal}
        activity={timeEditModal?.activity || null}
        onClose={() => setTimeEditModal(null)}
        onSave={(startTime, endTime) => {
          if (timeEditModal) {
            handleUpdateActivityTime(timeEditModal.dayIndex, timeEditModal.activityIndex, startTime, endTime);
          }
        }}
      />
      
      {/* Hotel Gallery Modal */}
      <HotelGalleryModal
        isOpen={hotelGalleryOpen}
        onClose={() => setHotelGalleryOpen(false)}
        images={hotelSelection?.images || []}
        hotelName={hotelSelection?.name}
      />

      {/* Share Trip Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share Your Trip
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Invite travel companions to view and collaborate on this trip. They'll be able to see the itinerary and join as group members.
            </p>
            
            {/* Trip Preview */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">{destination}</h4>
                  <p className="text-sm text-muted-foreground">
                    {startDate} • {travelers} {travelers === 1 ? 'traveler' : 'travelers'}
                  </p>
                </div>
              </div>
            </div>

            {/* Invite Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Invite Link</label>
              <div className="flex gap-2">
                <Input
                  value={shareLink || 'Click to generate link...'}
                  readOnly
                  className="flex-1 text-sm"
                  onClick={!shareLink ? handleCreateShareLink : undefined}
                />
                <Button 
                  onClick={async () => {
                    if (shareLink) {
                      await navigator.clipboard.writeText(shareLink);
                      setInviteCopied(true);
                      setTimeout(() => setInviteCopied(false), 2000);
                      toast.success('Link copied!');
                    } else {
                      handleCreateShareLink();
                    }
                  }}
                  disabled={isCreatingInvite}
                  className="gap-1.5"
                >
                  {isCreatingInvite ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : inviteCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {inviteCopied ? 'Copied!' : shareLink ? 'Copy' : 'Generate'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Link expires in 7 days. Up to {travelers - 1} {travelers - 1 === 1 ? 'person' : 'people'} can join.
              </p>
            </div>

            {/* Share Methods */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3">Or share via:</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={async () => {
                    if (!shareLink) await handleCreateShareLink();
                    const link = shareLink || '';
                    const text = `Join me on a trip to ${destination}!`;
                    window.open(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(link)}`, '_blank');
                  }}
                >
                  Email
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={async () => {
                    if (!shareLink) await handleCreateShareLink();
                    const link = shareLink || '';
                    const text = `Join me on a trip to ${destination}! ${link}`;
                    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
                  }}
                >
                  Message
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={async () => {
                    if (!shareLink) await handleCreateShareLink();
                    const link = shareLink || '';
                    const text = `Join me on a trip to ${destination}!`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`, '_blank');
                  }}
                >
                  WhatsApp
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// DESTINATION CAROUSEL COMPONENT
// =============================================================================

interface DestinationCarouselProps {
  destination: string;
  destinationCountry?: string;
}

// Helper to normalize destination strings (remove IATA codes like "(FCO)")
function normalizeDestination(dest: string): string {
  return (dest || '')
    // Remove trailing IATA codes like "(FCO)"
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    // Remove obvious airport keywords (e.g. "Rome Airport")
    .replace(/\b(international\s+)?airport\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function DestinationCarousel({ destination, destinationCountry }: DestinationCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Normalize destination (remove airport codes like "Rome (FCO)" -> "Rome")
  const cleanDestination = normalizeDestination(destination);
  const queryDestination = destinationCountry ? `${cleanDestination}, ${destinationCountry}` : cleanDestination;

  const generateGradientDataUrl = (label: string): string => {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 40) % 360;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1},60%,40%)"/>
          <stop offset="100%" style="stop-color:hsl(${hue2},70%,30%)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" font-family="system-ui" font-size="52" fill="white" fill-opacity="0.28" text-anchor="middle" dy=".35em">${label}</text>
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  // Fetch destination images from the backend
  useEffect(() => {
    async function fetchImages() {
      setIsLoading(true);
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('destination-images', {
          body: {
            destination: queryDestination,
            imageType: 'gallery',
            limit: 6,
          },
        });
        
        if (!error && data?.images?.length > 0) {
          const urls = data.images.map((img: { url: string }) => img.url);
          setImages(urls);
        } else {
          setImages([generateGradientDataUrl(cleanDestination)]);
        }
      } catch (err) {
        console.error('[DestinationCarousel] Failed to fetch images:', err);
        setImages([generateGradientDataUrl(cleanDestination)]);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (cleanDestination) {
      fetchImages();
    }
  }, [cleanDestination, queryDestination]);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % Math.max(1, images.length));
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + Math.max(1, images.length)) % Math.max(1, images.length));

  if (isLoading || images.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl mb-6">
        <div className="relative h-48 md:h-64 bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-serif text-foreground">{cleanDestination}</h2>
            {destinationCountry && (
              <p className="text-muted-foreground text-sm">{destinationCountry}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl mb-6">
      <div className="relative h-48 md:h-64">
        <img
          src={images[currentIndex]}
          alt={`${cleanDestination} photo ${currentIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={(e) => {
            e.currentTarget.src = generateGradientDataUrl(cleanDestination);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif text-white drop-shadow-lg">{cleanDestination}</h2>
            {destinationCountry && (
              <p className="text-white/80 text-sm">{destinationCountry}</p>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              <Button variant="secondary" size="icon" onClick={prevSlide} className="h-8 w-8 bg-white/20 backdrop-blur-sm hover:bg-white/40">
                <ChevronLeft className="h-4 w-4 text-white" />
              </Button>
              <Button variant="secondary" size="icon" onClick={nextSlide} className="h-8 w-8 bg-white/20 backdrop-blur-sm hover:bg-white/40">
                <ChevronRight className="h-4 w-4 text-white" />
              </Button>
            </div>
          )}
        </div>
        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  idx === currentIndex ? "bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// NEED TO KNOW SECTION COMPONENT
// =============================================================================

interface NeedToKnowSectionProps {
  destination: string;
  destinationCountry?: string;
  destinationInfo?: EditorialItineraryProps['destinationInfo'];
}

function NeedToKnowSection({ destination, destinationCountry, destinationInfo }: NeedToKnowSectionProps) {
  const [expandedCards, setExpandedCards] = useState<string[]>([]);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  // Default information for common destinations
  const getDefaultInfo = () => {
    const country = destinationCountry?.toLowerCase() || '';
    const dest = destination.toLowerCase();
    
    // UK / London
    if (country.includes('uk') || country.includes('united kingdom') || country.includes('england') || dest.includes('london')) {
      return {
        currency: 'British Pound (£)',
        currencyTips: [
          'Contactless payments widely accepted everywhere',
          'Tipping 10-15% at restaurants is customary',
          'ATMs available at banks and on high streets',
          'Most places accept major credit cards'
        ],
        language: 'English',
        languageTips: [
          'British English differs from American English',
          '"Cheers" means thanks, goodbye, or a toast',
          '"Queue" means line - respect the queue!',
          'Politeness is highly valued'
        ],
        timezone: 'GMT (UTC+0) / BST (UTC+1 summer)',
        timezoneTips: [
          'Shops typically close 6-7 PM, later in central London',
          'Pubs traditionally close around 11 PM',
          'Sunday trading hours are limited'
        ],
        tipping: '10-15% at restaurants if service not included',
        tippingTips: [
          'Check if service charge is already added',
          'Round up taxi fares',
          'Not expected at pubs for bar service',
          'Hotel porters: £1-2 per bag'
        ],
        transit: 'Tube, buses, Overground. Use Oyster or contactless.',
        transitTips: [
          'Oyster card or contactless for cheaper fares',
          'Stand on right on escalators, walk on left',
          'Buses don\'t accept cash - tap to pay',
          'Night Tube runs on weekends'
        ],
        water: 'Tap water is safe and excellent quality',
        waterTips: [
          'Free tap water available at restaurants',
          'Refill stations at many tube stations',
          'No need to buy bottled water'
        ],
        voltage: '230V, Type G plugs (3-pin)',
        voltageTips: [
          'US/EU devices need UK adapters',
          'Hotels often have shaver sockets',
          'USB charging works without adapters'
        ],
        emergency: '999 (Emergency) / 111 (Non-urgent NHS)',
        emergencyTips: [
          '999 for police, fire, ambulance',
          '111 for non-emergency medical advice',
          'A&E (Emergency Room) at major hospitals',
          'Pharmacies can advise on minor issues'
        ],
      };
    }
    
    // France / Paris
    if (country.includes('france') || dest.includes('paris')) {
      return {
        currency: 'Euro (€)',
        currencyTips: [
          'Cards accepted almost everywhere',
          'Some small shops prefer cash',
          'ATMs available at banks and metro stations',
          'Notify your bank before traveling'
        ],
        language: 'French',
        languageTips: [
          '"Bonjour" (Hello) - always greet first',
          '"Merci" (Thank you) - essential',
          '"Pardon" (Excuse me) - polite interruption',
          'English widely spoken in tourist areas'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Many shops close Sundays',
          'Lunch is typically 12-2 PM',
          'Dinner starts around 8 PM'
        ],
        tipping: 'Service included, rounding up appreciated',
        tippingTips: [
          'Service compris (service included) in bill',
          'Leave small change for good service',
          'Round up taxi fares',
          'Not expected at cafes'
        ],
        transit: 'Metro, RER, buses. Buy tickets at stations.',
        transitTips: [
          'Metro runs 5:30 AM - 1 AM (2 AM weekends)',
          'Keep ticket until you exit',
          'Navigo pass for unlimited weekly travel',
          'Uber and taxis widely available'
        ],
        water: 'Tap water is safe to drink',
        waterTips: [
          '"Carafe d\'eau" for free tap water at restaurants',
          'Wallace fountains provide free drinking water',
          'Bottled water available everywhere'
        ],
        voltage: '230V, Type C/E plugs',
        voltageTips: [
          'US/UK devices need adapters',
          'Most hotels have adapters available',
          'USB charging works without adapters'
        ],
        emergency: '112 (EU Emergency) / 15 (Medical) / 17 (Police)',
        emergencyTips: [
          '112 works EU-wide from any phone',
          'Pharmacies (green cross) can advise on minor issues',
          'SOS Médecins for doctor house calls',
          'Keep embassy contact handy'
        ],
      };
    }
    
    // Spain / Barcelona / Madrid
    if (country.includes('spain') || dest.includes('barcelona') || dest.includes('madrid')) {
      return {
        currency: 'Euro (€)',
        currencyTips: [
          'Cards widely accepted',
          'Cash useful for small purchases',
          'ATMs available at banks',
          'Dynamic currency conversion - always pay in EUR'
        ],
        language: 'Spanish (Catalan in Barcelona)',
        languageTips: [
          '"Hola" (Hello) - friendly greeting',
          '"Gracias" (Thank you)',
          '"Por favor" (Please)',
          'Catalan spoken in Barcelona alongside Spanish'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Siesta: many shops close 2-5 PM',
          'Dinner typically starts 9-10 PM',
          'Nightlife runs very late'
        ],
        tipping: '5-10% appreciated but not expected',
        tippingTips: [
          'Service charge rarely included',
          'Round up at casual places',
          'Leave a few euros at nice restaurants',
          'Not expected at tapas bars'
        ],
        transit: 'Metro, buses, trams. TMB card in Barcelona.',
        transitTips: [
          'T-Casual card for 10 trips in Barcelona',
          'Metro runs until midnight (later weekends)',
          'Taxis are affordable',
          'Walking is great in city centers'
        ],
        water: 'Tap water is safe but tastes mineral',
        waterTips: [
          'Bottled water commonly preferred',
          'Restaurants may charge for water',
          '"Agua del grifo" for tap water'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'Same as rest of Europe',
          'US/UK devices need adapters',
          'USB charging works without adapters'
        ],
        emergency: '112 (All emergencies)',
        emergencyTips: [
          '112 for police, fire, ambulance',
          'Tourist police in major cities',
          'Pharmacies have green cross',
          'Hospitals have 24h emergency'
        ],
      };
    }
    
    // Italy / Rome
    if (country.includes('italy') || dest.includes('rome') || dest.includes('milan') || dest.includes('florence') || dest.includes('venice')) {
      return {
        currency: 'Euro (€)',
        currencyTips: [
          'Credit cards widely accepted in cities',
          'Cash preferred at smaller shops & markets',
          'ATMs (Bancomat) available everywhere',
          'Notify your bank before traveling'
        ],
        language: 'Italian',
        languageTips: [
          '"Buongiorno" (Good morning) - formal greeting',
          '"Grazie" (Thank you) - essential phrase',
          '"Scusi" (Excuse me) - polite way to get attention',
          'English spoken at tourist spots, less in small towns'
        ],
        timezone: 'CET (UTC+1)',
        timezoneTips: [
          'Shops often close 1-4 PM for "riposo"',
          'Dinner typically starts 8-9 PM',
          'Museums may close early on Mondays'
        ],
        tipping: '10% at restaurants is appreciated but not required',
        tippingTips: [
          'Service charge ("coperto") often included',
          'Round up taxi fares',
          'Hotel porters: €1-2 per bag',
          'Not expected at cafes for standing service'
        ],
        transit: 'Metro, buses, trams. Buy tickets before boarding.',
        transitTips: [
          'Validate tickets on buses/trams to avoid fines',
          'Roma Pass includes transport + museum entries',
          'Uber/taxi apps work well in major cities',
          'Walking is often the best way in historic centers'
        ],
        water: 'Tap water is safe to drink',
        waterTips: [
          'Public drinking fountains ("nasoni") everywhere',
          'Free water at restaurants upon request',
          'Bottled water widely available'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'US/UK devices need adapters',
          'Most hotels have adapters available',
          'USB charging works without adapters'
        ],
        emergency: '112 (EU Emergency), 118 (Ambulance)',
        emergencyTips: [
          '112 works from any phone, even without SIM',
          'Pharmacies display green cross, rotate night shifts',
          'Keep copies of passport separate from originals'
        ],
      };
    }
    
    // Germany / Berlin / Munich
    if (country.includes('germany') || dest.includes('berlin') || dest.includes('munich')) {
      return {
        currency: 'Euro (€)',
        currencyTips: [
          'Cash is king - many places don\'t accept cards',
          'Bring enough Euros especially for small purchases',
          'EC cards (debit) more common than credit',
          'ATMs at banks and train stations'
        ],
        language: 'German',
        languageTips: [
          '"Guten Tag" (Hello) - formal greeting',
          '"Danke" (Thank you)',
          '"Bitte" (Please/You\'re welcome)',
          'English widely spoken, especially by young people'
        ],
        timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
        timezoneTips: [
          'Shops closed on Sundays (except tourist areas)',
          'Punctuality is highly valued',
          'Dinner typically 6-8 PM'
        ],
        tipping: '5-10% at restaurants',
        tippingTips: [
          'Round up or add 5-10%',
          'Say the total you want to pay when giving cash',
          'Not expected at counters',
          'Cash tips preferred'
        ],
        transit: 'U-Bahn, S-Bahn, buses, trams. Honor system.',
        transitTips: [
          'Validate ticket before boarding',
          'Heavy fines for no ticket (€60+)',
          'Day passes often good value',
          'Excellent regional train connections'
        ],
        water: 'Tap water is excellent quality',
        waterTips: [
          'Restaurant water is usually bottled (paid)',
          'Ask for "Leitungswasser" for tap water',
          'Sparkling water (Sprudel) very popular'
        ],
        voltage: '230V, Type C/F plugs',
        voltageTips: [
          'Same as rest of Europe',
          'US/UK devices need adapters',
          'USB charging works without adapters'
        ],
        emergency: '112 (Emergency) / 110 (Police)',
        emergencyTips: [
          '112 for fire and ambulance',
          '110 for police',
          'Apotheke (pharmacy) for minor issues',
          'Most pharmacists speak English'
        ],
      };
    }

    // Default fallback
    return {
      currency: destinationInfo?.currency || 'Local currency',
      currencyTips: ['Check current exchange rates before you go', 'ATMs usually offer best rates', 'Notify your bank of travel plans'],
      language: destinationInfo?.language || 'Local language',
      languageTips: ['Learn basic greetings', 'Translation apps work offline', 'Locals appreciate any effort'],
      timezone: destinationInfo?.timezone || 'Local time',
      timezoneTips: ['Adjust sleep schedule a few days before', 'Stay hydrated during flights'],
      tipping: destinationInfo?.tipping || 'Varies by location',
      tippingTips: ['Research local customs', 'Cash tips often preferred'],
      transit: destinationInfo?.transit || 'Various public transport options available',
      transitTips: ['Download local transit apps', 'Consider day passes for savings'],
      water: destinationInfo?.water || 'Check local advisories',
      waterTips: ['When in doubt, use bottled water', 'Ice in drinks may use tap water'],
      voltage: destinationInfo?.voltage || 'Check adapter requirements',
      voltageTips: ['Universal adapters are convenient', 'Check voltage compatibility for hair dryers'],
      emergency: destinationInfo?.emergency || 'Contact local authorities',
      emergencyTips: ['Save emergency numbers in your phone', 'Know your hotel address in local language'],
    };
  };

  const info = getDefaultInfo();

  const infoCategories = [
    {
      id: 'currency',
      icon: <Wallet className="h-5 w-5" />,
      label: 'Currency & Money',
      value: info.currency,
      tips: info.currencyTips,
    },
    {
      id: 'language',
      icon: <Languages className="h-5 w-5" />,
      label: 'Language',
      value: info.language,
      tips: info.languageTips,
    },
    {
      id: 'timezone',
      icon: <Clock className="h-5 w-5" />,
      label: 'Timezone',
      value: info.timezone,
      tips: info.timezoneTips,
    },
    {
      id: 'transit',
      icon: <Train className="h-5 w-5" />,
      label: 'Getting Around',
      value: info.transit,
      tips: info.transitTips,
    },
    {
      id: 'tipping',
      icon: <Utensils className="h-5 w-5" />,
      label: 'Tipping',
      value: info.tipping,
      tips: info.tippingTips,
    },
    {
      id: 'water',
      icon: <Info className="h-5 w-5" />,
      label: 'Water & Safety',
      value: info.water,
      tips: info.waterTips,
    },
    {
      id: 'voltage',
      icon: <Sparkles className="h-5 w-5" />,
      label: 'Electricity',
      value: info.voltage,
      tips: info.voltageTips,
    },
    {
      id: 'emergency',
      icon: <AlertCircle className="h-5 w-5" />,
      label: 'Emergency',
      value: info.emergency,
      tips: info.emergencyTips,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Globe className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-serif">Need to Know</h2>
          <p className="text-sm text-muted-foreground">Essential info for {destination}</p>
        </div>
      </div>

      {/* Interactive Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {infoCategories.map((category) => {
          const isExpanded = expandedCards.includes(category.id);
          return (
            <motion.div key={category.id}>
              <Card
                className={cn(
                  "cursor-pointer transition-all duration-200 overflow-hidden",
                  isExpanded
                    ? "border-primary/30 shadow-md"
                    : "border-border hover:border-primary/15 hover:shadow-sm"
                )}
                onClick={() => toggleCard(category.id)}
              >
                <CardContent className="p-0">
                  {/* Header - Always visible */}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wider font-semibold mb-1 text-muted-foreground">
                          {category.label}
                        </p>
                        <p className="text-sm text-foreground font-medium leading-relaxed">
                          {category.value}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("shrink-0 ml-2", isExpanded ? "text-primary" : "text-muted-foreground")}
                    >
                      <ChevronDown className="h-5 w-5" />
                    </motion.div>
                  </div>

                  {/* Expandable Tips Section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="border-t border-border/60 pt-3 mt-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">
                              Quick Tips
                            </p>
                            <ul className="space-y-2">
                              {category.tips.map((tip, idx) => (
                                <motion.li
                                  key={idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className="flex items-start gap-2 text-sm text-muted-foreground"
                                >
                                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-primary/40" />
                                  <span>{tip}</span>
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Cultural Notes - Full Width */}
      {destinationInfo?.culturalNotes && (
        <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-primary">Cultural Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{destinationInfo.culturalNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expand All / Collapse All */}
      <div className="flex justify-center">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            if (expandedCards.length === infoCategories.length) {
              setExpandedCards([]);
            } else {
              setExpandedCards(infoCategories.map(c => c.id));
            }
          }}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          {expandedCards.length === infoCategories.length ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Collapse All
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Expand All Tips
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// FLIGHT SYNC WARNING COMPONENT
// =============================================================================

interface FlightSyncWarningProps {
  flightArrivalTime: string;
  day1FirstActivity?: EditorialActivity;
  onSyncDay1: () => void;
  isRegenerating: boolean;
}

function FlightSyncWarning({ flightArrivalTime, day1FirstActivity, onSyncDay1, isRegenerating }: FlightSyncWarningProps) {
  // Parse flight arrival time
  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + mins;
  };
  
  const flightMins = parseTimeToMinutes(flightArrivalTime);
  const activityMins = parseTimeToMinutes(day1FirstActivity?.startTime || '');
  
  // If no flight time or first activity, don't show warning
  if (flightMins === null || activityMins === null) return null;
  
  // Check if Day 1's first activity is "Arrival" type - if so, compare times
  const isArrivalActivity = day1FirstActivity?.title?.toLowerCase().includes('arrival') ||
    day1FirstActivity?.category === 'transport';
  
  if (!isArrivalActivity) return null;
  
  // Calculate difference in hours
  const diffMins = Math.abs(flightMins - activityMins);
  const diffHours = diffMins / 60;
  
  // If times differ by more than 1 hour, show warning
  if (diffHours <= 1) return null;
  
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  };
  
  return (
    <div className="border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 rounded-full shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 dark:text-amber-100">
            Flight times don't match your itinerary
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Your flight arrives at <span className="font-semibold">{flightArrivalTime}</span>, 
            but Day 1 shows arrival at <span className="font-semibold">{formatTime(activityMins)}</span>.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            This can happen if you added or changed your flight after generating the itinerary.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncDay1}
            disabled={isRegenerating}
            className="mt-3 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing Day 1...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Day 1 with correct times
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// AIRPORT GAME PLAN COMPONENT
// =============================================================================

interface TransferOption {
  mode: string;
  duration: string;
  durationMinutes: number;
  estimatedCost?: string;
  notes?: string;
}

interface TransferData {
  taxi: { duration: string; cost: string };
  train: { duration: string; cost: string };
}

interface AirportGamePlanProps {
  flightSelection: FlightSelection;
  hotelSelection?: HotelSelection | null;
  destination: string;
}

function AirportGamePlan({ flightSelection, hotelSelection, destination }: AirportGamePlanProps) {
  const outbound = flightSelection.outbound;
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(false);
  
  // Fetch dynamic transfer data from Google Maps Distance Matrix API
  useEffect(() => {
    if (!outbound || !hotelSelection?.name) return;
    
    const fetchTransferData = async () => {
      setIsLoadingTransfer(true);
      try {
        const arrivalAirport = outbound.arrival?.airport || '';
        const arrivalTime = outbound.arrival?.time || '';
        
        // Build origin string (airport)
        const origin = arrivalAirport 
          ? `${arrivalAirport} Airport, ${destination}`
          : `${destination} Airport`;
        
        // Build destination string (hotel or city center)
        const hotelDest = hotelSelection?.address 
          || `${hotelSelection.name}, ${destination}`;
        
        const response = await supabase.functions.invoke('airport-transfers', {
          body: { 
            origin, 
            destination: hotelDest,
            city: destination, // City name for database fare lookup
            airportCode: arrivalAirport || undefined,
            arrivalTime: arrivalTime ? new Date().toISOString() : undefined
          }
        });
        
        if (response.error) {
          console.error('Transfer API error:', response.error);
          return;
        }
        
        const data = response.data;
        if (data?.options) {
          // Map API response to our format
          const taxiOption = data.options.find((o: TransferOption) => 
            o.mode.toLowerCase().includes('taxi') || o.mode.toLowerCase().includes('ride')
          );
          const transitOption = data.options.find((o: TransferOption) => 
            o.mode.toLowerCase().includes('train') || o.mode.toLowerCase().includes('bus')
          );
          
          setTransferData({
            taxi: {
              duration: taxiOption?.duration || '30-50 min',
              cost: taxiOption?.estimatedCost || 'Varies',
            },
            train: {
              duration: transitOption?.duration || 'N/A',
              cost: transitOption?.estimatedCost || 'N/A',
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch transfer data:', error);
      } finally {
        setIsLoadingTransfer(false);
      }
    };
    
    fetchTransferData();
  }, [outbound?.arrival?.airport, hotelSelection?.name, destination]);
  
  if (!outbound) return null;

  // Parse arrival time and calculate recommendations
  const arrivalTime = outbound.arrival?.time || '';
  const arrivalAirport = outbound.arrival?.airport || '';
  const departureTime = outbound.departure?.time || '';
  
  // Calculate recommended airport arrival (2.5 hours before for international, 2 for domestic)
  const getRecommendedAirportArrival = () => {
    if (!departureTime) return null;
    const match = departureTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return departureTime;
    
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const period = match[3]?.toUpperCase();
    
    // Convert to 24h if needed
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    // Subtract 2.5 hours for international
    hours -= 2;
    let finalMins = parseInt(mins, 10) - 30;
    if (finalMins < 0) {
      finalMins += 60;
      hours -= 1;
    }
    if (hours < 0) hours += 24;
    
    // Format back to 12h
    const finalPeriod = hours >= 12 ? 'PM' : 'AM';
    const finalHours = hours % 12 || 12;
    return `${finalHours}:${String(finalMins).padStart(2, '0')} ${finalPeriod}`;
  };

  // Post-landing advice based on arrival time
  const getPostLandingAdvice = () => {
    if (!arrivalTime) return { action: 'Head to hotel', reason: 'Check in and freshen up' };
    const match = arrivalTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return { action: 'Head to hotel', reason: 'Check in and freshen up' };
    
    let hours = parseInt(match[1], 10);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    if (hours >= 21 || hours < 6) {
      return { action: 'Head to hotel & rest', reason: 'Late arrival - get a good night\'s sleep for tomorrow\'s adventures' };
    } else if (hours >= 18) {
      return { action: 'Check in, then dinner nearby', reason: 'Evening arrival - perfect for a local dinner experience' };
    } else if (hours >= 12) {
      return { action: 'Check in, then lunch & explore', reason: 'Afternoon arrival - grab lunch and explore the neighborhood' };
    } else {
      return { action: 'Store luggage, explore immediately', reason: 'Early arrival - make the most of your first day!' };
    }
  };

  // Fallback transfer estimate when API hasn't loaded yet
  const getStaticTransferEstimate = (): TransferData => {
    const transferFallback: Record<string, TransferData> = {
      'rome': { taxi: { duration: '45-60 min', cost: '€48 fixed' }, train: { duration: '32 min', cost: '€14' } },
      'paris': { taxi: { duration: '35-60 min', cost: '€55 fixed' }, train: { duration: '35 min', cost: '€11' } },
      'london': { taxi: { duration: '45-75 min', cost: '£60-90' }, train: { duration: '15 min', cost: '£25' } },
      'tokyo': { taxi: { duration: '60-90 min', cost: '¥25,000+' }, train: { duration: '35 min', cost: '¥3,000' } },
      'new york': { taxi: { duration: '45-75 min', cost: '$55-75' }, train: { duration: '45 min', cost: '$11' } },
      'default': { taxi: { duration: '30-50 min', cost: 'Varies' }, train: { duration: '30-45 min', cost: 'Varies' } },
    };
    
    const destKey = destination.toLowerCase().trim();
    return transferFallback[destKey] || 
      Object.entries(transferFallback).find(([key]) => destKey.includes(key) || key.includes(destKey))?.[1] ||
      transferFallback['default'];
  };

  const recommendedArrival = getRecommendedAirportArrival();
  const postLanding = getPostLandingAdvice();
  const transfer = transferData || getStaticTransferEstimate();

  return (
    <div className="border border-border bg-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <Plane className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-medium">Your Airport Game Plan</h3>
            <p className="text-sm text-muted-foreground">Everything you need to know for departure day</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Recommended Airport Arrival */}
        {recommendedArrival && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Arrive at airport by {recommendedArrival}</p>
              <p className="text-xs text-muted-foreground">
                We recommend 2.5 hours before your {departureTime} departure for international flights
              </p>
            </div>
          </div>
        )}

        {/* Landing Info */}
        {arrivalTime && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">
                Land at {arrivalTime}{arrivalAirport ? ` (${arrivalAirport})` : ''}
              </p>
              <p className="text-xs text-muted-foreground">{postLanding.reason}</p>
            </div>
          </div>
        )}

        {/* Transfer Options */}
        {hotelSelection?.name && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Hotel className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Getting to {hotelSelection.name}</p>
                {isLoadingTransfer && (
                  <span className="text-xs text-muted-foreground animate-pulse">Loading live data...</span>
                )}
                {transferData && !isLoadingTransfer && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                    Live
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-xs p-2 bg-secondary/50 rounded border border-border">
                  <span className="font-medium">🚕 Taxi/Uber</span>
                  <p className="text-muted-foreground">{transfer.taxi.duration} • {transfer.taxi.cost}</p>
                </div>
                <div className="text-xs p-2 bg-secondary/50 rounded border border-border">
                  <span className="font-medium">🚆 Train/Metro</span>
                  <p className="text-muted-foreground">{transfer.train.duration} • {transfer.train.cost}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post-Landing Action */}
        <div className="flex items-start gap-3 pt-3 border-t border-border">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Recommended: {postLanding.action}</p>
            <p className="text-xs text-muted-foreground">{postLanding.reason}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DAY CARD COMPONENT
// =============================================================================

interface DayCardProps {
  day: EditorialDay;
  dayIndex: number;
  travelers: number;
  budgetTier?: string;
  tripCurrency: string; // Currency for cost formatting
  destination: string; // For real photo lookup
  isExpanded: boolean;
  isRegenerating: boolean;
  isEditable: boolean;
  tripId: string;
  getPaymentForItem: (itemType: 'flight' | 'hotel' | 'activity', itemId: string) => TripPayment | undefined;
  refreshPayments: () => void;
  onToggle: () => void;
  onActivityLock: (dayIndex: number, activityId: string) => void;
  onActivityMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onActivityRemove: (dayIndex: number, activityId: string) => void;
  onDayLock: (dayIndex: number) => void;
  onDayRegenerate: () => void;
  onAddActivity: () => void;
  onTimeEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onPaymentRequest?: (activityId: string) => void;
  onBookingStateChange?: (activityId: string, newState: BookingItemState) => void;
}

function DayCard({
  day,
  dayIndex,
  travelers,
  budgetTier,
  tripCurrency,
  destination,
  isExpanded,
  isRegenerating,
  isEditable,
  tripId,
  getPaymentForItem,
  refreshPayments,
  onToggle,
  onActivityLock,
  onActivityMove,
  onActivityRemove,
  onDayLock,
  onDayRegenerate,
  onAddActivity,
  onTimeEdit,
  onPaymentRequest,
  onBookingStateChange,
}: DayCardProps) {
  const allLocked = day.activities.every(a => a.isLocked);
  const totalCost = getDayTotalCost(day.activities, travelers, budgetTier);
  
  // Normalize destination for image lookups
  const cleanDestination = normalizeDestination(destination);
  // Library modal state removed - agent features disabled

  return (
    <div className="border border-border bg-card overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow">
      {/* Day Header - Editorial Style with Color Accent */}
      <div className="relative p-6 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        {/* Decorative accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-accent to-primary/50" />
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="text-5xl font-serif font-light text-primary/40">
                {String(day.dayNumber).padStart(2, '0')}
              </span>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-serif text-xl font-medium text-foreground">{day.title || day.theme || `Day ${day.dayNumber}`}</h3>
                {day.date && (
                  <Badge variant="secondary" className="text-xs font-normal bg-secondary/50">
                    {format(parseISO(day.date), 'EEEE, MMM d')}
                  </Badge>
                )}
              </div>
              {day.description && (
                <p className="text-sm text-muted-foreground italic">{day.description}</p>
              )}
            </div>
          </div>

          {/* Day Actions */}
          <div className="flex items-center gap-2">
            {totalCost > 0 && (
              <Badge variant="outline" className="text-sm font-semibold border-primary/30 bg-primary/5 text-primary">
                {formatCurrency(totalCost, tripCurrency)}
              </Badge>
            )}
            {day.weather && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/50 text-sm">
                {weatherIcons[day.weather.condition?.toLowerCase() || 'sunny']}
                {day.weather.high && <span className="font-medium">{day.weather.high}°</span>}
              </div>
            )}
            {isEditable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDayLock(dayIndex)}
                  className="h-8 w-8 hover:bg-primary/10"
                  title={allLocked ? 'Unlock Day' : 'Lock Day'}
                >
                  {allLocked ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDayRegenerate}
                  disabled={isRegenerating}
                  className="h-8 w-8 hover:bg-accent/10"
                  title="Regenerate Day"
                >
                  <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin text-accent")} />
                </Button>
                {/* Save to Library button removed - agent features disabled */}
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Activities */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="border-t border-border">
              {day.activities.map((activity, activityIndex) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  destination={cleanDestination}
                  dayIndex={dayIndex}
                  activityIndex={activityIndex}
                  totalActivities={day.activities.length}
                  isLast={activityIndex === day.activities.length - 1}
                  isEditable={isEditable}
                  travelers={travelers}
                  budgetTier={budgetTier}
                  tripCurrency={tripCurrency}
                  tripId={tripId}
                  existingPayment={getPaymentForItem('activity', activity.id)}
                  onPaymentSuccess={refreshPayments}
                  onLock={onActivityLock}
                  onMove={onActivityMove}
                  onRemove={onActivityRemove}
                  onTimeEdit={onTimeEdit}
                  onPaymentRequest={onPaymentRequest}
                  onBookingStateChange={onBookingStateChange}
                />
              ))}
            </div>

            {/* Day Footer */}
            <div className="px-6 py-4 bg-gradient-to-r from-secondary/30 via-secondary/20 to-secondary/30 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-6 text-muted-foreground">
                  {day.estimatedWalkingTime && (
                    <span className="flex items-center gap-1.5">
                      <Route className="h-4 w-4" />
                      Walking: {day.estimatedWalkingTime}
                    </span>
                  )}
                  {day.estimatedDistance && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      Distance: {day.estimatedDistance}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {isEditable && (
                    <Button variant="outline" size="sm" onClick={onAddActivity} className="gap-1 bg-background hover:bg-primary/5 hover:border-primary/30">
                      <Plus className="h-4 w-4" />
                      Add Activity
                    </Button>
                  )}
                  <span className="font-medium text-foreground px-3 py-1 rounded-full bg-primary/10 text-primary">
                    Day Total: {formatCurrency(totalCost, tripCurrency)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Library modal removed - agent features disabled */}
    </div>
  );
}

// =============================================================================
// ACTIVITY ROW COMPONENT - Editorial Style
// =============================================================================

interface ActivityRowProps {
  activity: EditorialActivity;
  destination: string; // Add destination for real photo lookup
  dayIndex: number;
  activityIndex: number;
  totalActivities: number;
  isLast: boolean;
  isEditable: boolean;
  travelers: number;
  budgetTier?: string;
  tripCurrency: string; // User's preferred display currency
  tripId: string;
  existingPayment?: TripPayment;
  onPaymentSuccess: () => void;
  onLock: (dayIndex: number, activityId: string) => void;
  onMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onRemove: (dayIndex: number, activityId: string) => void;
  onTimeEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onPaymentRequest?: (activityId: string) => void;
  onBookingStateChange?: (activityId: string, newState: BookingItemState) => void;
}

function ActivityRow({
  activity,
  destination,
  dayIndex,
  activityIndex,
  totalActivities,
  isLast,
  isEditable,
  travelers,
  budgetTier,
  tripCurrency,
  tripId,
  existingPayment,
  onPaymentSuccess,
  onLock,
  onMove,
  onRemove,
  onTimeEdit,
  onPaymentRequest,
  onBookingStateChange,
}: ActivityRowProps) {
  const activityType = getActivityType(activity);
  const style = activityStyles[activityType] || activityStyles.activity;
  const rawRating = getActivityRating(activity);
  const cost = getActivityCost(activity, travelers, budgetTier);
  // Use tripCurrency (user's preferred display currency) instead of activity's native currency
  const existingPhoto = getActivityPhoto(activity);
  const time = activity.startTime || activity.time;
  
  // Normalize title: use title, fallback to name (backend may return either)
  const activityTitle = activity.title || (activity as { name?: string }).name || 'Activity';
  
  // Use placeholder for thumbnail when no photo exists (skip for downtime/transport)
  const titleLower = activityTitle.toLowerCase();
  const isDowntime = activity.timeBlockType === 'downtime' || titleLower.includes('free time');
  const isTransport = activityType === 'transportation' || activityType === 'transport';
  const isCheckIn = titleLower.includes('check-in') || titleLower.includes('check in');
  const isAirport = titleLower.includes('airport') || titleLower.includes('transfer');
  const isAccommodation = activityType === 'accommodation';
  const showThumbnail = !isTransport && !isDowntime;
  
  // Only show ratings for venues that make sense: restaurants, activities, sightseeing, cultural
  // NOT for: transfers, check-in, free time, airport, accommodation
  const ratingEligibleTypes = ['dining', 'cultural', 'sightseeing', 'activity', 'shopping', 'entertainment', 'relaxation'];
  const isRatingEligible = ratingEligibleTypes.includes(activityType) && !isDowntime && !isTransport && !isCheckIn && !isAirport && !isAccommodation;
  const rating = isRatingEligible ? rawRating : null;
  
  // Determine if this is a dining activity that should show venue name prominently
  const isDiningActivity = ['dining', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'].includes(activityType);

  const extractVenueFromText = (text?: string | null): string | null => {
    if (!text) return null;

    const raw = String(text).trim();

    // Prefer explicit patterns
    const patterns: RegExp[] = [
      /\b(?:at|@)\s+([^\n,.;]{3,80})/i,
      /\b(?:restaurant|restaurante|ristorante|trattoria|osteria|cafe|café)\s*[:\-–]\s*([^\n,.;]{3,80})/i,
      /\b(?:we\s+eat\s+at|lunch\s+at|dinner\s+at|breakfast\s+at)\s+([^\n,.;]{3,80})/i,
    ];

    for (const p of patterns) {
      const m = raw.match(p);
      const candidate = m?.[1]?.trim();
      if (!candidate) continue;

      // Guardrails against generic matches
      const lower = candidate.toLowerCase();
      if (
        lower.includes('hotel') ||
        lower.includes('airport') ||
        lower.includes('your hotel') ||
        lower === 'the hotel'
      ) {
        continue;
      }

      // Strip trailing quotes/parens
      return candidate.replace(/["')\]]+$/g, '').trim();
    }

    return null;
  };

  const venueNameForDining = isDiningActivity
    ? (activity.location?.name?.trim() || extractVenueFromText(activityTitle) || extractVenueFromText(activity.description) || null)
    : null;

  // Determine the best search term for images:
  // 1. Dining venue (from location/title/description) if available
  // 2. location.name (actual venue) if available
  // 3. Fall back to activity title
  const imageSearchTerm = (venueNameForDining && venueNameForDining.length > 3)
    ? venueNameForDining
    : (activity.location?.name && activity.location.name.length > 3 ? activity.location.name : activityTitle);

  // Use useActivityImage hook for real place photos with deduplication
  // This fetches from Google Places / TripAdvisor with caching
  const shouldFetchRealPhoto = showThumbnail && !isCheckIn && !isAirport && !isAccommodation;
  const { imageUrl: fetchedImageUrl, loading: imageLoading } = useActivityImage(
    imageSearchTerm,
    activityType,
    existingPhoto,
    shouldFetchRealPhoto ? destination : undefined, // Only pass destination if we want real photos
    activity.id // prevent cache collisions when destination is missing
  );

  const thumbnailUrl = fetchedImageUrl;
  const [thumbnailError, setThumbnailError] = useState(false);
  // Library modal state removed - agent features disabled

  return (
    <div className={cn(
      "flex items-stretch group/activity hover:bg-secondary/10 transition-colors",
      !isLast && "border-b border-border",
      activity.isLocked && "bg-primary/5"
    )}>
      {/* Time Column - Clickable for editing */}
      <div 
        className={cn(
          "w-24 shrink-0 p-4 border-r border-border bg-gradient-to-b from-secondary/20 to-secondary/5",
          isEditable && "cursor-pointer hover:from-primary/10 hover:to-primary/5 transition-colors group"
        )}
        onClick={() => isEditable && onTimeEdit(dayIndex, activityIndex, activity)}
        title={isEditable ? "Click to edit time" : undefined}
      >
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-foreground">{formatTime(time)}</span>
          {isEditable && <Edit3 className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
        {activity.endTime && (
          <p className="text-xs text-muted-foreground mt-0.5">→ {formatTime(activity.endTime)}</p>
        )}
        {activity.duration && (
          <p className="text-xs text-primary/70 mt-0.5 font-medium">{activity.duration}</p>
        )}
      </div>

      {/* Thumbnail Column - Always show for non-transport, non-downtime activities */}
      {showThumbnail && (
        <div className="w-24 h-24 shrink-0 border-r border-border bg-muted/30 overflow-hidden relative">
          {thumbnailUrl && !thumbnailError ? (
            <>
              <img
                src={thumbnailUrl}
                alt={activityTitle}
                className="w-full h-full object-cover transition-transform group-hover/activity:scale-105"
                loading="lazy"
                onError={() => setThumbnailError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/activity:opacity-100 transition-opacity" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary/50 to-secondary/20 text-primary/50">
              {style.icon}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded bg-primary/10 text-primary">{style.icon}</span>
              <span className="text-xs text-primary/80 uppercase tracking-wider font-medium">{style.label}</span>
              {rating && (
                <Badge variant="secondary" className="text-xs gap-0.5 bg-amber-500/10 text-amber-600 border-none">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {rating.toFixed(1)}
                </Badge>
              )}
              {activity.bookingRequired && (
                <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                  Booking Required
                </Badge>
              )}
            </div>
            {(() => {
              const venue = venueNameForDining;
              const address = activity.location?.address?.trim();
              const hasAddress = !!address && address.length > 3;

              // For dining: Restaurant name should replace the generic meal label in the most prominent spot
              if (venue) {
                return (
                  <>
                    <h4 className="font-serif text-lg font-medium text-foreground">{venue}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5 italic">{activityTitle}</p>
                    {hasAddress && address !== venue && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary/60 mt-0.5" />
                        <span className="leading-snug">{address}</span>
                      </div>
                    )}
                  </>
                );
              }

              return (
                <>
                  <h4 className="font-serif text-lg font-medium text-foreground">{activityTitle}</h4>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{activity.description}</p>
                  )}

                  {(activity.location?.name || hasAddress) && (
                    <div className="mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary/60" />
                        <span>{activity.location?.name || address}</span>
                      </div>
                      {activity.location?.name && hasAddress && address !== activity.location?.name && (
                        <div className="pl-5 mt-0.5 text-xs text-muted-foreground/70 leading-snug">
                          {address}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
            {/* Tips */}
            {activity.tips && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-primary/5 rounded-md text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{activity.tips}</span>
              </div>
            )}
            {/* Transportation to next */}
            {activity.timeBlockType !== 'downtime' && activity.transportation && !isLast && (
              <div className="flex flex-col gap-1 mt-2 p-2 bg-secondary/30 rounded border-l-2 border-primary/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Car className="h-3 w-3" />
                  <span className="capitalize font-medium">{activity.transportation.method}</span>
                  {activity.transportation.duration && (
                    <span>• {activity.transportation.duration}</span>
                  )}
                  {activity.transportation.distance && (
                    <span>• {activity.transportation.distance}</span>
                  )}
                  {activity.transportation.estimatedCost?.amount && activity.transportation.estimatedCost.amount > 0 && (
                    <span>• ~{formatCurrency(activity.transportation.estimatedCost.amount, activity.transportation.estimatedCost.currency || tripCurrency)}</span>
                  )}
                </div>
                {activity.transportation.instructions && (
                  <p className="text-xs text-muted-foreground/80 pl-5">
                    {activity.transportation.instructions}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions & Cost */}
          <div className="flex flex-col items-end gap-2 ml-4">
            <span className="font-medium">{formatCurrency(cost, tripCurrency)}</span>
            {/* Booking state actions - replaces static vendor links */}
            <InlineBookingActions
              activity={{
                id: activity.id,
                title: activity.title,
                bookingState: activity.bookingState,
                bookingRequired: activity.bookingRequired,
                quotePriceCents: activity.quotePriceCents,
                quoteExpiresAt: activity.quoteExpiresAt,
                quoteLocked: activity.quoteLocked,
                confirmationNumber: activity.confirmationNumber,
                voucherUrl: activity.voucherUrl,
                voucherData: activity.voucherData,
                cancellationPolicy: activity.cancellationPolicy,
                travelerData: activity.travelerData,
                vendorName: activity.vendorName,
                bookedAt: activity.bookedAt,
                cancelledAt: activity.cancelledAt,
                website: activity.website,
                cost,
                currency: activity.cost?.currency || 'USD',
              }}
              destination={destination}
              estimatedCost={cost}
              onPaymentRequest={onPaymentRequest}
              onStateChange={onBookingStateChange}
              compact
            />
            {isEditable && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onMove(dayIndex, activity.id, 'up')}
                  disabled={activityIndex === 0}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    activityIndex === 0
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-secondary text-muted-foreground"
                  )}
                  title="Move up"
                >
                  <MoveUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onMove(dayIndex, activity.id, 'down')}
                  disabled={activityIndex === totalActivities - 1}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    activityIndex === totalActivities - 1
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-secondary text-muted-foreground"
                  )}
                  title="Move down"
                >
                  <MoveDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onLock(dayIndex, activity.id)}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    activity.isLocked
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-secondary text-muted-foreground"
                  )}
                  title={activity.isLocked ? "Unlock" : "Lock"}
                >
                  {activity.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => toast.info('AI swap: Find similar activities coming soon!')}
                  className="p-1.5 rounded transition-colors hover:bg-primary/10 text-muted-foreground hover:text-primary"
                  title="Find alternative"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onRemove(dayIndex, activity.id)}
                  className="p-1.5 rounded transition-colors hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Library modal removed - agent features disabled */}
      </div>
    </div>
  );
}

// =============================================================================
// ADD ACTIVITY MODAL
// =============================================================================

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (activity: Partial<EditorialActivity>) => void;
}

function AddActivityModal({ isOpen, onClose, onAdd }: AddActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('activity');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [cost, setCost] = useState('0');
  const [locationName, setLocationName] = useState('');

  const handleSubmit = () => {
    onAdd({
      title,
      description,
      category,
      startTime,
      endTime,
      cost: { amount: parseFloat(cost) || 0, currency: 'USD' },
      location: { name: locationName, address: '' },
    });
    setTitle('');
    setDescription('');
    setCategory('activity');
    setStartTime('12:00');
    setEndTime('13:00');
    setCost('0');
    setLocationName('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Activity name" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sightseeing">Sightseeing</SelectItem>
                <SelectItem value="dining">Dining</SelectItem>
                <SelectItem value="cultural">Cultural</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="relaxation">Relaxation</SelectItem>
                <SelectItem value="shopping">Shopping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Location</label>
            <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Venue name" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Cost ($)</label>
            <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title}>Add Activity</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// TIME EDIT MODAL
// =============================================================================

interface TimeEditModalProps {
  isOpen: boolean;
  activity: EditorialActivity | null;
  onClose: () => void;
  onSave: (startTime: string, endTime: string) => void;
}

function TimeEditModal({ isOpen, activity, onClose, onSave }: TimeEditModalProps) {
  const [startTime, setStartTime] = useState(activity?.startTime || activity?.time || '12:00');
  const [endTime, setEndTime] = useState(activity?.endTime || '13:00');

  useEffect(() => {
    if (activity) {
      setStartTime(activity.startTime || activity.time || '12:00');
      setEndTime(activity.endTime || '13:00');
    }
  }, [activity]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Edit Time
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">{activity?.title}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Time</label>
              <Input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)}
                className="text-base"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Time</label>
              <Input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)}
                className="text-base"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(startTime, endTime)}>Save Time</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Credit top-up prompt wrapper for the component
function EditorialItineraryWithCreditPrompt(props: EditorialItineraryProps) {
  return <EditorialItinerary {...props} />;
}

export default EditorialItinerary;
