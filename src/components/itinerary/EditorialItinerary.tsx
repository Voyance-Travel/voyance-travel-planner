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

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp, ChevronDown, MapPin, Clock, Star, Save,
  Lock, Unlock, MoveUp, MoveDown, Plus, RefreshCw,
  Plane, Hotel, Utensils, Camera, ShoppingBag, Palmtree, Car, Trash2,
  Sun, Cloud, CloudRain, CloudSun, Snowflake, Edit3, Sparkles, AlertCircle,
  Calendar, Users, ExternalLink, Route, Search, ArrowRightLeft,
  Globe, Wallet, Languages, Train, ChevronLeft, ChevronRight, Info, Images,
  CreditCard, Library, TrendingUp, Share2, Link2, Copy, Check,
  Shield, FileText, HeartPulse, MoreHorizontal, Eye, Coins
} from 'lucide-react';
import { useSpendCredits, canAffordAction, getActionCost } from '@/hooks/useSpendCredits';
import { useCredits } from '@/hooks/useCredits';
import { CREDIT_COSTS } from '@/config/pricing';
import { HotelGalleryModal } from './HotelGalleryModal';
import { DraggableActivityList } from './DraggableActivityList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isToday } from 'date-fns';
import { safeFormatDate } from '@/utils/dateUtils';
import type { ActivityType, ItineraryActivity, WeatherCondition, DayItinerary } from '@/types/itinerary';
import { convertFrontendDayToBackend, convertFrontendActivityToBackend } from '@/types/itinerary';
import { useActivityImage, getActivityPlaceholder } from '@/hooks/useActivityImage';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { useDestinationImages } from '@/hooks/useDestinationImages';
import AirlineLogo from '@/components/planner/shared/AirlineLogo';
import ActivityAlternativesDrawer from '@/components/planner/ActivityAlternativesDrawer';
import { RegenerateGuidedAssistDialog } from './RegenerateGuidedAssistDialog';
import { WeatherForecast } from './WeatherForecast';
import { preloadCostIndex, estimateCostSync } from '@/lib/cost-estimation';
import { VendorBookingLink } from '@/components/booking/VendorBookingLink';
import { InlineBookingActions } from '@/components/booking/InlineBookingActions';
import { PaymentsTab } from './PaymentsTab';
import { BudgetTab } from '@/components/planner/budget/BudgetTab';
import { getTripPayments, type TripPayment } from '@/services/tripPaymentsAPI';
import { useEntitlements } from '@/hooks/useEntitlements';
import { UpgradePrompt } from '@/components/checkout/UpgradePrompt';
import { AddFlightInline, AddHotelInline } from './AddBookingInline';
import { TripCollaboratorsPanel } from './TripCollaboratorsPanel';
import { useTripPermission, useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import type { BookingItemState, TravelerInfo } from '@/services/bookingStateMachine';
import OptimizePreferencesDialog, { type OptimizePreferences } from './OptimizePreferencesDialog';
import ReviewsDrawer from '@/components/reviews/ReviewsDrawer';
import RestaurantSearchDrawer from '@/components/restaurants/RestaurantSearchDrawer';
import { ItineraryOnboardingTour } from './ItineraryOnboardingTour';
import ShareGuideSheet from '@/components/sharing/ShareGuideSheet';
import { preloadAirportCodes, getAirportDisplaySync } from '@/services/locationSearchAPI';
import { InlineModifier } from './InlineModifier';
import type { ItineraryDay } from '@/services/itineraryActionExecutor';
import { ItineraryValueHeader } from './ItineraryValueHeader';
import { ItineraryUtilityBar } from './ItineraryUtilityBar';
import { WhyWeSkippedSection } from './WhyWeSkippedSection';
import { calculateItineraryValueStats, getDestinationSkippedItems } from '@/utils/intelligenceAnalytics';
import { validateItinerary, matchesSkipList, type ValidationIssue } from '@/utils/itineraryValidator';
import { VoyanceInsight } from './VoyanceInsight';
import { TransitBadge } from './TransitBadge';
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
  viatorProductCode?: string; // Viator product code for API bookings
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
  id?: string;
  name?: string;
  address?: string;
  rating?: number;
  pricePerNight?: number;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
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
  tripType?: string;
  celebrationDay?: number; // User-specified celebration day for birthday/anniversary trips
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
  /** Activity IDs to highlight (e.g., from chatbot suggestions) */
  highlightedActivityIds?: string[];
  onSave?: (days: EditorialDay[]) => Promise<void>;
  onRegenerateDay?: (dayNumber: number) => Promise<EditorialDay | null>;
  onBookingAdded?: () => void;
  /** Called when activities are reordered via drag-and-drop */
  onActivityReorder?: (dayIndex: number, activities: EditorialActivity[]) => void;
  /** Called when user requests payment for an activity */
  onPaymentRequest?: (activityId: string) => void;
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

// Exchange rates relative to USD (1 USD = X units of target currency)
// These are approximate rates - updated periodically
const EXCHANGE_RATES_FROM_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CHF: 0.88,
  CAD: 1.36,
  AUD: 1.53,
  NZD: 1.64,
  CNY: 7.24,
  HKD: 7.82,
  SGD: 1.34,
  THB: 35.8,
  MXN: 17.2,
  BRL: 4.97,
  INR: 83.1,
  KRW: 1320,
  ZAR: 18.9,
  SEK: 10.45,
  NOK: 10.62,
  DKK: 6.87,
  PLN: 4.02,
  CZK: 23.1,
  HUF: 358,
  ILS: 3.65,
  AED: 3.67,
  SAR: 3.75,
  TRY: 30.5,
  RUB: 92,
  PHP: 55.8,
  IDR: 15650,
  MYR: 4.72,
  VND: 24500,
  TWD: 31.5,
  ARS: 850,
  CLP: 920,
  COP: 3950,
  PEN: 3.72,
  EGP: 30.9,
  MAD: 10.1,
  NGN: 1200,
  KES: 154,
  PKR: 278,
  BDT: 110,
  UAH: 37.5,
  RON: 4.58,
  BGN: 1.80,
  HRK: 6.93, // Legacy, Croatia uses EUR now
  ISK: 138,
  NIO: 36.7,
  GTQ: 7.82,
  CRC: 530,
  PAB: 1,
  DOP: 57,
  JMD: 155,
  TTD: 6.78,
  BBD: 2,
  BSD: 1,
  BZD: 2,
  XCD: 2.70,
  AWG: 1.79,
  ANG: 1.79,
  BMD: 1,
  KYD: 0.82,
  FJD: 2.23,
  PGK: 3.72,
  WST: 2.72,
  TOP: 2.36,
  VUV: 119,
  SBD: 8.46,
  SCR: 13.5,
  MUR: 45.5,
  MVR: 15.4,
  LKR: 325,
  NPR: 133,
  BND: 1.34,
  KHR: 4100,
  LAK: 20800,
  MMK: 2100,
  MNT: 3450,
  KZT: 450,
  UZS: 12300,
  GEL: 2.65,
  AMD: 405,
  AZN: 1.70,
  BYN: 3.27,
  MDL: 17.8,
  BAM: 1.80,
  MKD: 56.5,
  RSD: 108,
  ALL: 95,
  XOF: 603,
  XAF: 603,
  GHS: 12.5,
  TZS: 2500,
  UGX: 3800,
  ZMW: 23.5,
  BWP: 13.6,
  NAD: 18.9,
  MZN: 63.5,
  AOA: 830,
  ETB: 56.5,
  SOS: 571,
  DJF: 178,
  ERN: 15,
  GMD: 67,
  GNF: 8600,
  LRD: 188,
  SLL: 22500,
  CVE: 101,
  MWK: 1685,
  STN: 22.5,
  SZL: 18.9,
  LSL: 18.9,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.377,
  OMR: 0.385,
  JOD: 0.71,
  LBP: 89500,
  SYP: 13000,
  IQD: 1310,
  YER: 250,
  AFN: 72,
  IRR: 42000,
  TMT: 3.50,
  TJS: 10.9,
  KGS: 89,
};

/**
 * Convert an amount from USD to the target currency
 */
function convertFromUSD(amountInUSD: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES_FROM_USD[targetCurrency.toUpperCase()];
  if (!rate) return amountInUSD; // Fallback to USD if rate not found
  return amountInUSD * rate;
}

/**
 * Convert an amount from the source currency to USD
 */
function convertToUSD(amount: number, sourceCurrency: string): number {
  const rate = EXCHANGE_RATES_FROM_USD[sourceCurrency.toUpperCase()];
  if (!rate || rate === 0) return amount; // Fallback if rate not found
  return amount / rate;
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
      maximumFractionDigits: currency.toUpperCase() === 'JPY' || currency.toUpperCase() === 'KRW' ? 0 : 0,
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

interface CostInfo {
  amount: number;
  isEstimated: boolean;
  estimateReason?: string;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * Get activity cost with defensible estimation using destination_cost_index
 * Uses synchronous version for immediate rendering - cache preloaded on component mount
 */
// Categories that should NEVER show as "Free" - always estimate if cost is 0
const NEVER_FREE_CATEGORIES = [
  'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee',
  'cruise', 'boat', 'tour', 'activity', 'experience', 'spa', 'massage', 'show',
  'performance', 'concert', 'theater', 'theatre', 'nightlife', 'bar', 'club',
  // Transport categories - airport transfers, taxis, etc. are never free
  'transfer', 'transport', 'transportation', 'airport', 'taxi', 'uber', 'rideshare'
];

function isNeverFreeCategory(category: string, title: string): boolean {
  const cat = category.toLowerCase();
  const titleLower = title.toLowerCase();
  
  // Check category
  if (NEVER_FREE_CATEGORIES.some(nfc => cat.includes(nfc))) return true;
  
  // Check title for dining/meal keywords
  const neverFreeKeywords = [
    'breakfast', 'brunch', 'lunch', 'dinner', 'cruise', 'tour',
    'restaurant', 'café', 'cafe', 'transfer', 'airport', 'taxi',
    'uber', 'private car', 'shuttle', 'train to', 'bus to'
  ];
  if (neverFreeKeywords.some(kw => titleLower.includes(kw))) {
    return true;
  }
  
  return false;
}

function getActivityCostInfo(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string
): CostInfo {
  const category = activity.category || activity.type || 'activity';
  const title = activity.title || '';
  const shouldNeverBeFree = isNeverFreeCategory(category, title);
  
  // Check cost.amount first - this is explicit pricing from venue data
  // BUT if it's 0 and the category should never be free, fall through to estimation
  if (activity.cost?.amount !== undefined && activity.cost.amount > 0) {
    return { amount: activity.cost.amount, isEstimated: false, confidence: 'high' };
  }
  
  // If cost is explicitly 0 but category should never be free, skip to estimation
  if (activity.cost?.amount === 0 && shouldNeverBeFree) {
    // Fall through to estimation engine below
  } else if (activity.cost?.amount === 0) {
    // Truly free activity (parks, viewpoints, walking tours, etc.)
    return { amount: 0, isEstimated: false, confidence: 'high' };
  }
  
  // Check estimatedCost - AI-provided estimate during generation
  if (activity.estimatedCost?.amount !== undefined && activity.estimatedCost.amount > 0) {
    return { 
      amount: activity.estimatedCost.amount, 
      isEstimated: true,
      estimateReason: 'AI-estimated based on venue type',
      confidence: 'medium'
    };
  }
  
  // If estimatedCost is 0 but should never be free, fall through
  if (activity.estimatedCost?.amount === 0 && shouldNeverBeFree) {
    // Fall through to estimation engine below
  } else if (activity.estimatedCost?.amount === 0) {
    return { amount: 0, isEstimated: true, estimateReason: 'No cost expected', confidence: 'medium' };
  }
  
  // Use defensible cost estimation engine
  const priceLevel = (activity as any).priceLevel || (activity as any).price_level;
  
  const result = estimateCostSync({
    category,
    title, // Pass title for meal type inference (breakfast vs dinner)
    city: destinationCity,
    country: destinationCountry,
    travelers,
    budgetTier: budgetTier as 'budget' | 'moderate' | 'luxury',
    priceLevel: priceLevel ? Number(priceLevel) : undefined,
  });
  
  return { 
    amount: result.amount, 
    isEstimated: result.isEstimated,
    estimateReason: result.reason,
    confidence: result.confidence
  };
}

function getActivityCost(
  activity: EditorialActivity,
  travelers: number = 1,
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string
): number {
  return getActivityCostInfo(activity, travelers, budgetTier, destinationCity, destinationCountry).amount;
}

function getActivityType(activity: EditorialActivity): string {
  return activity.category || activity.type || 'activity';
}

function getActivityRating(activity: EditorialActivity): number | null {
  if (typeof activity.rating === 'number') return activity.rating;
  if (typeof activity.rating === 'object' && activity.rating?.value) return activity.rating.value;
  return null;
}

function getActivityReviewCount(activity: EditorialActivity): number | null {
  if (typeof activity.rating === 'object' && activity.rating?.totalReviews) {
    return activity.rating.totalReviews;
  }
  return null;
}

function getActivityPhoto(activity: EditorialActivity): string | null {
  if (!activity.photos || activity.photos.length === 0) return null;
  const photo = activity.photos[0];
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object' && photo.url) return photo.url;
  return null;
}

function getDayTotalCost(
  activities: EditorialActivity[], 
  travelers: number = 1, 
  budgetTier: string = 'moderate',
  destinationCity?: string,
  destinationCountry?: string
): number {
  return activities.reduce((sum, act) => sum + getActivityCost(act, travelers, budgetTier, destinationCity, destinationCountry), 0);
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
  tripType,
  celebrationDay,
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
  onPaymentRequest,
}: EditorialItineraryProps) {
  const [days, setDays] = useState<EditorialDay[]>(initialDays);
  const [expandedDays, setExpandedDays] = useState<number[]>(initialDays.map(d => d.dayNumber));
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'payments' | 'details' | 'needtoknow'>('itinerary');
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    // Auto-select "Today" if trip is active
    const todayIndex = initialDays.findIndex(d => d.date && isToday(parseISO(d.date)));
    return todayIndex >= 0 ? todayIndex : 0;
  });
  const dayButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [addActivityModal, setAddActivityModal] = useState<{ dayIndex: number } | null>(null);
  const [editActivityModal, setEditActivityModal] = useState<{ dayIndex: number; activityIndex: number; activity: EditorialActivity } | null>(null);
  const [timeEditModal, setTimeEditModal] = useState<{ dayIndex: number; activityIndex: number; activity: EditorialActivity } | null>(null);
  const [hotelGalleryOpen, setHotelGalleryOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [pendingRegenerateDay, setPendingRegenerateDay] = useState<number | null>(null);
  
  // Guided assist state - track regeneration attempts per day
  const [dayRegenCounts, setDayRegenCounts] = useState<Record<number, number>>({});
  const [showGuidedAssist, setShowGuidedAssist] = useState(false);
  const [guidedAssistDayIndex, setGuidedAssistDayIndex] = useState<number | null>(null);
  const [pendingGuidedPreferences, setPendingGuidedPreferences] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareGuideSheet, setShowShareGuideSheet] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showLocalCurrency, setShowLocalCurrency] = useState(true); // Currency display preference
  
  // Edit Flight/Hotel modal state
  const [editFlightOpen, setEditFlightOpen] = useState(false);
  const [editHotelOpen, setEditHotelOpen] = useState(false);

  // Optimize preferences dialog state
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);
  const [optimizePrefs, setOptimizePrefs] = useState<OptimizePreferences | null>(null);
  const [showRouteUpgrade, setShowRouteUpgrade] = useState(false);

  // AI Swap (Activity Alternatives) state
  const [swapDrawerOpen, setSwapDrawerOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ dayIndex: number; activityId: string } | null>(null);
  const [swapDrawerActivity, setSwapDrawerActivity] = useState<ItineraryActivity | null>(null);

  // Restaurant Search Drawer state
  const [restaurantDrawerOpen, setRestaurantDrawerOpen] = useState(false);
  const [restaurantDrawerMealType, setRestaurantDrawerMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'any'>('any');

  // Reviews Drawer state
  const [reviewsDrawerOpen, setReviewsDrawerOpen] = useState(false);
  const [reviewsTarget, setReviewsTarget] = useState<{ 
    placeName: string; 
    placeType?: 'restaurant' | 'attraction' | 'hotel' | 'activity';
    activityRating?: number;
    activityReviewCount?: number;
  } | null>(null);

  // Open reviews drawer for an activity
  const openReviewsDrawer = useCallback((activity: EditorialActivity) => {
    const activityType = getActivityType(activity);
    const placeName = activity.location?.name || activity.title || 'Unknown Place';
    
    let placeType: 'restaurant' | 'attraction' | 'hotel' | 'activity' = 'activity';
    if (['dining', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee'].includes(activityType)) {
      placeType = 'restaurant';
    } else if (['cultural', 'sightseeing', 'entertainment'].includes(activityType)) {
      placeType = 'attraction';
    } else if (activityType === 'accommodation') {
      placeType = 'hotel';
    }

    // Extract rating data for consistency between card and drawer
    const activityRating = getActivityRating(activity) ?? undefined;
    const activityReviewCount = getActivityReviewCount(activity) ?? undefined;

    setReviewsTarget({ placeName, placeType, activityRating, activityReviewCount });
    setReviewsDrawerOpen(true);
  }, []);

  const totalActivities = days.reduce((sum, day) => sum + day.activities.length, 0);
  const feedbackCount = payments.filter(p => p.status === 'paid').length;
  const progressPercent = totalActivities > 0 ? Math.min((feedbackCount / totalActivities) * 100, 100) : 0;

  // Day navigation
  const canGoPrev = selectedDayIndex > 0;
  const canGoNext = selectedDayIndex < days.length - 1;

  // Get entitlements for credit checking
  const { data: entitlements, isPaid } = useEntitlements();
  
  // Credit system hooks
  const { data: creditData } = useCredits();
  const spendCredits = useSpendCredits();
  const totalCredits = creditData?.totalCredits ?? 0;
  
  // Get trip permission for current user
  const { data: tripPermission } = useTripPermission(tripId);
  const { data: collaborators = [] } = useTripCollaborators(tripId);
  
  // Determine effective editability based on permission
  const effectiveIsEditable = isEditable && (tripPermission?.isOwner || tripPermission?.canEdit);

  // Calculate intelligence value stats for the itinerary
  const skippedItems = useMemo(() => getDestinationSkippedItems(destination), [destination]);
  const valueStats = useMemo(() => calculateItineraryValueStats(days, skippedItems), [days, skippedItems]);

  // Dynamic itinerary validation - detect skip list violations and other issues
  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const result = validateItinerary(days, {
      destination,
      tripType,
      celebrationDay,
      totalDays: days.length
    });
    return result.issues;
  }, [days, destination, tripType, celebrationDay]);
  
  // Get skip list violation IDs for highlighting in the UI
  const skipListViolationIds = useMemo(() => {
    return new Set(
      validationIssues
        .filter(i => i.type === 'skip_list')
        .map(i => i.activityId)
    );
  }, [validationIssues]);

  // Fetch 2 destination images for hero and mid-page sections
  const { heroImage, midImage, isLoading: imagesLoading } = useDestinationImages(
    destination,
    destinationCountry,
    tripId
  );

  // Scroll selected day button into view
  useEffect(() => {
    const btn = dayButtonRefs.current[selectedDayIndex];
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDayIndex]);

  // Preload cost index cache on mount for destination-aware pricing
  useEffect(() => {
    preloadCostIndex();
  }, []);

  // Safety fix for already-saved itineraries: ensure checkout renders before airport transfer on last day
  useEffect(() => {
    setDays(prev => {
      if (!prev || prev.length === 0) return prev;
      const lastIdx = prev.length - 1;
      const lastDay = prev[lastIdx];
      const activities = lastDay?.activities;
      if (!activities || activities.length < 2) return prev;

      const checkoutIdx = activities.findIndex(a => {
        const t = (a.title || '').toLowerCase();
        return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
      });
      const airportIdx = activities.findIndex(a => {
        const t = (a.title || '').toLowerCase();
        const isAirportish = t.includes('airport') || t.includes('departure transfer');
        const isTransportish = (a.category || '').toLowerCase() === 'transport' || t.includes('transfer') || t.includes('departure');
        return isAirportish && isTransportish;
      });

      // Already correct (or not applicable)
      if (checkoutIdx === -1 || airportIdx === -1 || checkoutIdx < airportIdx) return prev;

      const parseMins = (timeStr?: string): number | null => {
        if (!timeStr) return null;
        const parts = timeStr.split(':');
        if (parts.length !== 2) return null;
        const h = Number(parts[0]);
        const m = Number(parts[1]);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
      };
      const fmt = (mins: number): string => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      const duration = (start?: string, end?: string, fallback = 15): number => {
        const s = parseMins(start);
        const e = parseMins(end);
        if (s === null || e === null) return fallback;
        return Math.max(5, e - s);
      };

      const checkout = { ...activities[checkoutIdx] };
      const airport = { ...activities[airportIdx] };

      const checkoutDur = duration(checkout.startTime || checkout.time, checkout.endTime, 15);
      const transferDur = duration(airport.startTime || airport.time, airport.endTime, 60);

      const airportStart = airport.startTime || airport.time;
      const airportStartMins = parseMins(airportStart);
      if (airportStartMins === null) return prev;

      checkout.startTime = fmt(airportStartMins);
      checkout.endTime = fmt(airportStartMins + checkoutDur);
      airport.startTime = checkout.endTime;
      airport.endTime = fmt(parseMins(airport.startTime) + transferDur);

      const nextActivities = [...activities];
      nextActivities[airportIdx] = checkout;
      nextActivities[checkoutIdx] = airport;
      nextActivities.sort((a, b) => {
        const ta = parseMins(a.startTime || a.time) ?? 99999;
        const tb = parseMins(b.startTime || b.time) ?? 99999;
        return ta - tb;
      });

      return prev.map((d, idx) => (idx === lastIdx ? { ...d, activities: nextActivities } : d));
    });
  }, [tripId]);

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

  // Preload airport codes for display (City + Code format)
  const [airportCacheReady, setAirportCacheReady] = useState(false);
  useEffect(() => {
    const codes: string[] = [];
    if (flightSelection?.outbound?.departure?.airport) codes.push(flightSelection.outbound.departure.airport);
    if (flightSelection?.outbound?.arrival?.airport) codes.push(flightSelection.outbound.arrival.airport);
    if (flightSelection?.return?.departure?.airport) codes.push(flightSelection.return.departure.airport);
    if (flightSelection?.return?.arrival?.airport) codes.push(flightSelection.return.arrival.airport);
    
    if (codes.length > 0) {
      preloadAirportCodes(codes).then(() => setAirportCacheReady(true));
    } else {
      setAirportCacheReady(true);
    }
  }, [flightSelection]);

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

  // Calculate totals with smart estimation using destination-aware pricing
  const totalActivityCost = days.reduce((sum, day) => sum + getDayTotalCost(day.activities, travelers, budgetTier, destination, destinationCountry), 0);
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
  
  // Convert costs from USD to display currency when needed
  // All internal costs are calculated in USD, this converts for display
  const displayCost = useCallback((amountInUSD: number): number => {
    if (!showLocalCurrency || localCurrency === 'USD') {
      return amountInUSD;
    }
    return convertFromUSD(amountInUSD, localCurrency);
  }, [showLocalCurrency, localCurrency]);

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev =>
      prev.includes(dayNumber)
        ? prev.filter(d => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  // Check if an activity is a dining type
  const isDiningActivity = useCallback((activity: EditorialActivity): boolean => {
    const activityType = getActivityType(activity);
    return ['dining', 'breakfast', 'brunch', 'lunch', 'dinner', 'cafe', 'coffee', 'food'].includes(activityType);
  }, []);

  // Get meal type from activity
  const getMealTypeFromActivity = useCallback((activity: EditorialActivity): 'breakfast' | 'lunch' | 'dinner' | 'any' => {
    const activityType = getActivityType(activity);
    const title = (activity.title || '').toLowerCase();
    
    if (activityType === 'breakfast' || title.includes('breakfast') || title.includes('brunch')) {
      return 'breakfast';
    }
    if (activityType === 'lunch' || title.includes('lunch')) {
      return 'lunch';
    }
    if (activityType === 'dinner' || title.includes('dinner')) {
      return 'dinner';
    }
    return 'any';
  }, []);

  // Check if user can swap (has enough credits)
  const canSwap = useCallback(() => {
    if (isPaid) return true;
    return totalCredits >= CREDIT_COSTS.SWAP_ACTIVITY;
  }, [isPaid, totalCredits]);

  // Open the AI swap drawer for an activity
  const openSwapDrawer = useCallback((dayIndex: number, activity: EditorialActivity) => {
    if (activity.isLocked) {
      toast.error('Unlock this activity first to find alternatives');
      return;
    }

    // Check if user can afford swap
    if (!canSwap()) {
      toast.error(`Need ${CREDIT_COSTS.SWAP_ACTIVITY} credits to swap activities`);
      setShowCreditPrompt(true);
      return;
    }

    // Normalize to ItineraryActivity format for the shared drawer component
    const time = activity.time || activity.startTime || '09:00';
    const cost = getActivityCost(activity, travelers, budgetTier);
    const type = (activity.type || (activity.category as ActivityType) || 'activity') as ActivityType;
    const locName = activity.location?.name || activity.location?.address || 'Location';
    const locAddress = activity.location?.address || activity.location?.name || 'Location';
    const ratingVal = typeof activity.rating === 'number' ? activity.rating : (activity.rating as any)?.value;

    setSwapTarget({ dayIndex, activityId: activity.id });
    setSwapDrawerActivity({
      id: activity.id,
      title: activity.title || 'Activity',
      description: activity.description || '',
      time,
      duration: activity.duration || '2 hours',
      type,
      cost,
      location: { name: locName, address: locAddress },
      rating: ratingVal,
      tags: activity.tags || [],
      isLocked: !!activity.isLocked,
    });

    // For dining activities, open the restaurant-specific drawer
    if (isDiningActivity(activity)) {
      setRestaurantDrawerMealType(getMealTypeFromActivity(activity));
      setRestaurantDrawerOpen(true);
    } else {
      setSwapDrawerOpen(true);
    }
  }, [travelers, budgetTier, isDiningActivity, getMealTypeFromActivity, canSwap]);

  // Handle selecting an alternative from the drawer
  const handleSelectSwapAlternative = useCallback(async (newActivity: ItineraryActivity) => {
    // Capture swapTarget at invocation time to avoid stale closure issues
    const target = swapTarget;
    if (!target) {
      console.warn('[Swap] No swap target available');
      return;
    }

    // Spend credits for the swap (skip for paid users)
    if (!isPaid) {
      try {
        await spendCredits.mutateAsync({
          action: 'SWAP_ACTIVITY',
          tripId,
          activityId: target.activityId,
          dayIndex: target.dayIndex,
        });
      } catch (err) {
        console.error('[Swap] Credit spend failed:', err);
        setSwapDrawerOpen(false);
        setSwapTarget(null);
        setSwapDrawerActivity(null);
        return;
      }
    }

    // Replacing activity with new selection

    setDays(prev => {
      const updatedDays = prev.map((day, dIdx) => {
        if (dIdx !== target.dayIndex) return day;
        
        const updatedActivities = day.activities.map(a => {
          if (a.id !== target.activityId) return a;

          const preservedTime = a.time || a.startTime || newActivity.time;
          const preservedStartTime = a.startTime || preservedTime;

          return {
            ...a,
            id: newActivity.id, // Use new activity ID
            title: newActivity.title,
            description: newActivity.description,
            category: newActivity.type,
            type: newActivity.type,
            time: preservedTime,
            startTime: preservedStartTime,
            duration: newActivity.duration,
            cost: { amount: newActivity.cost, currency: tripCurrency },
            location: {
              name: newActivity.location?.name,
              address: newActivity.location?.address,
            },
            rating: newActivity.rating ?? a.rating,
            tags: newActivity.tags,
            isLocked: false,
            // Clear old enrichment data so it can be re-fetched
            photos: undefined,
            website: undefined,
            viatorProductCode: undefined,
          } satisfies EditorialActivity;
        });
        
        return { ...day, activities: updatedActivities };
      });
      
      // Updated days with swapped activity
      return updatedDays;
    });

    setHasChanges(true);
    setSwapDrawerOpen(false);
    setSwapTarget(null);
    setSwapDrawerActivity(null);
    toast.success(`Swapped activity (${CREDIT_COSTS.SWAP_ACTIVITY} credits used)`);
  }, [swapTarget, tripCurrency, isPaid, spendCredits, tripId]);

  // Supports both database trips and localStorage demo trips
  useEffect(() => {
    if (!hasChanges || !effectiveIsEditable) return;
    
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
            // Auto-saved to database
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
          // Auto-saved to localStorage
        }
      } catch (err) {
        console.error('[EditorialItinerary] Auto-save failed:', err);
      }
    }, 3000); // Auto-save 3 seconds after last change

    return () => clearTimeout(autoSaveTimer);
  }, [hasChanges, days, tripId, effectiveIsEditable]);

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

  // Open the optimize preferences dialog
  const openOptimizeDialog = useCallback(() => {
    setShowOptimizeDialog(true);
  }, []);

  // Optimize itinerary: route optimization, real transport, real costs
  const handleOptimize = useCallback(async (prefs: OptimizePreferences) => {
    setOptimizePrefs(prefs);
    setShowOptimizeDialog(false);
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
          // Pass user transport preferences
          transportPreferences: {
            allowedModes: prefs.transportModes,
            distanceUnit: prefs.distanceUnit,
          },
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

  // Handle activity lock toggle - persists immediately to normalized itinerary_activities table
  const handleActivityLock = useCallback(async (dayIndex: number, activityId: string) => {
    // Find current lock state and activity details
    const currentDay = days[dayIndex];
    const currentActivity = currentDay?.activities.find(a => a.id === activityId);
    if (!currentActivity) return;
    
    const newLockedState = !currentActivity.isLocked;
    
    // Update local state immediately for responsive UI
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.map(act =>
          act.id === activityId ? { ...act, isLocked: newLockedState } : act
        )
      };
    }));
    setHasChanges(true);
    toast.success(newLockedState ? 'Activity locked' : 'Activity unlocked');
    
    // Persist lock state directly to itinerary_activities table
    if (tripId) {
      try {
        const activityStartTime = (currentActivity as any).startTime ?? (currentActivity as any).time;
        const { error } = await supabase.functions.invoke('generate-itinerary', {
          body: {
            action: 'toggle-activity-lock',
            tripId,
            activityId,
            isLocked: newLockedState,
            // Include fallback matching info for non-UUID IDs
            dayNumber: currentDay.dayNumber,
            activityTitle: currentActivity.title,
            startTime: activityStartTime,
          },
        });
        if (error) {
          console.error('[EditorialItinerary] Failed to persist lock state:', error);
          // Revert on error
          setDays(prev => prev.map((day, idx) => {
            if (idx !== dayIndex) return day;
            return {
              ...day,
              activities: day.activities.map(act =>
                act.id === activityId ? { ...act, isLocked: !newLockedState } : act
              )
            };
          }));
          toast.error('Failed to save lock state');
        }
      } catch (err) {
        console.error('[EditorialItinerary] Lock persist error:', err);
      }
    }
  }, [tripId, days]);

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

  // Handle drag-and-drop reorder of activities within a day
  const handleActivityReorder = useCallback((dayIndex: number, reorderedActivities: EditorialActivity[]) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return { ...day, activities: reorderedActivities };
    }));
    setHasChanges(true);
  }, []);

  // Move activity to a different day
  const handleMoveToDay = useCallback((fromDayIndex: number, activityId: string, toDayIndex: number) => {
    if (fromDayIndex === toDayIndex) return;
    
    setDays(prev => {
      const fromDay = prev[fromDayIndex];
      const toDay = prev[toDayIndex];
      if (!fromDay || !toDay) return prev;
      
      const activity = fromDay.activities.find(a => a.id === activityId);
      if (!activity) return prev;
      
      // Helper to parse time string to minutes for comparison
      const parseTimeToMinutes = (timeStr?: string): number => {
        if (!timeStr) return 9999; // No time = end of day
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) return 9999;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3]?.toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      
      const activityTime = parseTimeToMinutes(activity.startTime || activity.time);
      
      return prev.map((day, idx) => {
        if (idx === fromDayIndex) {
          // Remove from source day
          return { ...day, activities: day.activities.filter(a => a.id !== activityId) };
        }
        if (idx === toDayIndex) {
          // Insert at correct chronological position based on startTime
          const newActivities = [...day.activities];
          let insertIndex = newActivities.length; // Default to end
          
          for (let i = 0; i < newActivities.length; i++) {
            const existingTime = parseTimeToMinutes(newActivities[i].startTime || newActivities[i].time);
            if (activityTime < existingTime) {
              insertIndex = i;
              break;
            }
          }
          
          newActivities.splice(insertIndex, 0, activity);
          return { ...day, activities: newActivities };
        }
        return day;
      });
    });
    setHasChanges(true);
    toast.success(`Moved to Day ${toDayIndex + 1}`);
  }, []);

  const handleActivityRemove = useCallback((dayIndex: number, activityId: string) => {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day;
      return { ...day, activities: day.activities.filter(act => act.id !== activityId) };
    }));
    setHasChanges(true);
    toast.success('Activity removed');
  }, []);

  // Check if user can regenerate (has enough credits)
  const canRegenerate = useCallback(() => {
    // Paid users always can (legacy entitlement check for backwards compat)
    if (isPaid) return true;
    // Credit-based check: need REGENERATE_DAY credits
    return totalCredits >= CREDIT_COSTS.REGENERATE_DAY;
  }, [isPaid, totalCredits]);

  // Request regeneration - checks credits and regeneration count
  const requestDayRegenerate = useCallback(async (dayIndex: number) => {
    if (!canRegenerate()) {
      // Show upgrade prompt
      setPendingRegenerateDay(dayIndex);
      setShowCreditPrompt(true);
      return;
    }
    
    // Check regeneration count for this day - after 3 regenerations, show guided assist
    const currentCount = dayRegenCounts[dayIndex] || 0;
    const REGEN_THRESHOLD = 3;
    
    if (currentCount >= REGEN_THRESHOLD) {
      // Show guided assist dialog
      setGuidedAssistDayIndex(dayIndex);
      setShowGuidedAssist(true);
    } else {
      // Spend credits before regenerating (skip for paid users who have unlimited)
      if (!isPaid) {
        try {
          await spendCredits.mutateAsync({
            action: 'REGENERATE_DAY',
            tripId,
            dayIndex,
          });
        } catch (err) {
          // Credit deduction failed - don't proceed
          console.error('[Regenerate] Credit spend failed:', err);
          return;
        }
      }
      
      // Increment count and proceed with regeneration
      setDayRegenCounts(prev => ({ ...prev, [dayIndex]: currentCount + 1 }));
      handleDayRegenerateInternal(dayIndex);
    }
  }, [canRegenerate, dayRegenCounts, isPaid, spendCredits, tripId]);

  // Handle guided assist submission
  const handleGuidedAssistSubmit = useCallback(async (preferences: string) => {
    if (guidedAssistDayIndex === null) return;
    
    // Spend credits before regenerating (skip for paid users who have unlimited)
    if (!isPaid) {
      try {
        await spendCredits.mutateAsync({
          action: 'REGENERATE_DAY',
          tripId,
          dayIndex: guidedAssistDayIndex,
        });
      } catch (err) {
        console.error('[GuidedAssist] Credit spend failed:', err);
        setShowGuidedAssist(false);
        setGuidedAssistDayIndex(null);
        return;
      }
    }
    
    // Reset count for this day after guided assist
    setDayRegenCounts(prev => ({ ...prev, [guidedAssistDayIndex]: 0 }));
    
    // Store preferences and trigger regeneration with them
    if (preferences) {
      setPendingGuidedPreferences(preferences);
    }
    handleDayRegenerateInternal(guidedAssistDayIndex, preferences || undefined);
    setShowGuidedAssist(false);
    setGuidedAssistDayIndex(null);
  }, [guidedAssistDayIndex, isPaid, spendCredits, tripId]);

  // Internal regenerate handler (after credit check passed)
  const handleDayRegenerateInternal = useCallback(async (dayIndex: number, guidedPreferences?: string) => {
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
        // Collect current day's activity names to exclude from regeneration
        const currentDayActivities = day.activities
          ?.map(a => a.title || (a as { name?: string }).name)
          .filter(Boolean) || [];

        // CRITICAL: Preserve locked activities by passing both:
        // - keepActivities: IDs of locked activities
        // - currentActivities: full activity objects in BACKEND format so backend can merge them back
        const keepActivities = (day.activities || [])
          .filter(a => a.isLocked)
          .map(a => a.id)
          .filter(Boolean);
        
        // Convert to backend format with proper field names (startTime, isLocked, etc.)
        const backendActivities = day.activities.map(a => ({
          id: a.id,
          name: a.title,
          title: a.title,
          description: a.description,
          category: a.category,
          startTime: a.startTime || a.time,
          endTime: a.endTime,
          location: a.location,
          cost: a.cost,
          estimatedCost: a.cost,
          isLocked: a.isLocked, // CRITICAL: Backend checks this field
          durationMinutes: a.durationMinutes,
          tags: a.tags,
        }));
        
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
            tripType,
            previousDayActivities: currentDayActivities, // Force different venues
            keepActivities,
            currentActivities: backendActivities, // Backend format with isLocked
            variationNonce: Date.now(), // Force new randomness
            // Pass guided preferences if provided (from guided assist dialog)
            ...(guidedPreferences && { userGuidance: guidedPreferences }),
          }
        });

        if (error) throw error;
        if (data?.day) {
          setDays(prev => prev.map((d, idx) => idx === dayIndex ? data.day : d));
          setHasChanges(true);
          if (guidedPreferences) {
            toast.success(`Day ${day.dayNumber} regenerated with your preferences!`);
          } else {
            toast.success(`Day ${day.dayNumber} regenerated!`);
          }
        }
      }
    } catch (err) {
      console.error('Regenerate error:', err);
      toast.error('Failed to regenerate day');
    } finally {
      setRegeneratingDay(null);
      setPendingGuidedPreferences(null);
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
      cost: activity.cost || { amount: 0, currency: tripCurrency },
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
  }, [tripCurrency]);

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

  // Update existing activity (full edit)
  const handleUpdateActivity = useCallback((dayIndex: number, activityIndex: number, updates: Partial<EditorialActivity>) => {
    setDays(prev => prev.map((day, dIdx) => {
      if (dIdx !== dayIndex) return day;
      return {
        ...day,
        activities: day.activities.map((activity, aIdx) => {
          if (aIdx !== activityIndex) return activity;
          return {
            ...activity,
            ...updates,
            time: updates.startTime || activity.startTime || activity.time,
          };
        }),
      };
    }));
    setHasChanges(true);
    setEditActivityModal(null);
    toast.success('Activity updated');
  }, []);

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
      {/* Onboarding Tour for first-time visitors */}
      <ItineraryOnboardingTour tripId={tripId} />
      {/* Trip Summary Bar - Editorial Style - Sticky for visibility */}
      <div className="py-3 sm:py-4 px-3 sm:px-4 bg-gradient-to-r from-primary/5 via-background to-accent/5 rounded-xl sticky top-16 z-30 backdrop-blur-sm border border-border/50 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Left: Trip info pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-background border border-border text-xs sm:text-sm shrink-0">
              <Calendar className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
              <span className="font-medium text-foreground">{days.length} Days</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-background border border-border text-xs sm:text-sm shrink-0">
              <Users className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-primary" />
              <span className="font-medium text-foreground">{travelers} {travelers === 1 ? 'Guest' : 'Guests'}</span>
            </div>
          </div>
          
          {/* Right: Cost + Actions */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            {effectiveIsEditable && hasChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/50 animate-pulse text-xs shrink-0">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
            {/* Currency Toggle + Total */}
            <div className="flex items-center gap-0 shrink-0">
              <button
                onClick={() => setShowLocalCurrency((v) => !v)}
                data-tour="currency-toggle"
                className="flex items-center gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-l-md bg-secondary/50 border border-r-0 border-border text-xs font-medium hover:bg-secondary transition-colors"
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
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-r-md bg-primary/10 border border-primary/20 text-xs sm:text-sm">
                <span className="text-muted-foreground hidden sm:inline">Total:</span>
                <span className="font-semibold text-primary">{formatCurrency(displayCost(totalCost), tripCurrency)}</span>
              </div>
            </div>
            
            {/* Share Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowShareModal(true)}
              data-tour="share-button"
              className="gap-1 sm:gap-1.5 h-7 sm:h-8 text-xs px-2 sm:px-3 shrink-0"
            >
              <Share2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            
            {effectiveIsEditable && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (entitlements?.can_optimize_routes) {
                          openOptimizeDialog();
                        } else {
                          setShowRouteUpgrade(true);
                        }
                      }} 
                      disabled={isOptimizing || days.length === 0} 
                      data-tour="optimize-button"
                      className="gap-1 sm:gap-1.5 h-7 sm:h-8 text-xs px-2 sm:px-3 shrink-0"
                    >
                      {isOptimizing ? <RefreshCw className="h-3 sm:h-3.5 w-3 sm:w-3.5 animate-spin" /> : <Route className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
                      <span className="hidden sm:inline">{isOptimizing ? 'Optimizing...' : 'Optimize'}</span>
                      {!entitlements?.can_optimize_routes && <Lock className="h-3 w-3 ml-0.5 opacity-60" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reorders activities to minimize transit time (saves ~30 mins)</p>
                  </TooltipContent>
                </Tooltip>
                <Button 
                  size="sm"
                  onClick={handleSave} 
                  disabled={isSaving || !hasChanges} 
                  className="gap-1 sm:gap-1.5 h-7 sm:h-8 text-xs px-2 sm:px-3 shrink-0"
                  data-tour="save-button"
                >
                  {isSaving ? <RefreshCw className="h-3 sm:h-3.5 w-3 sm:w-3.5 animate-spin" /> : <Save className="h-3 sm:h-3.5 w-3 sm:w-3.5" />}
                  <span className="hidden sm:inline">{hasChanges ? 'Save' : 'Saved ✓'}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* View-Only Mode Indicator */}
      {isEditable && !effectiveIsEditable && tripPermission && (
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">View Only</p>
            <p className="text-xs text-muted-foreground">
              You have viewer access to this trip. Contact the owner to request edit permissions.
            </p>
          </div>
        </div>
      )}

      {/* Destination Hero Image */}
      <DestinationHeroImage 
        destination={destination} 
        destinationCountry={destinationCountry} 
        imageUrl={heroImage}
        isLoading={imagesLoading}
      />

      {/* Navigation Tabs - Horizontally scrollable on mobile */}
      <div className="border-b border-border overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 min-w-max">
          {[
            { id: 'itinerary', label: 'Itinerary', fullLabel: 'Day-by-Day Itinerary', icon: <Calendar className="h-4 w-4" /> },
            { id: 'budget', label: 'Budget', fullLabel: 'Budget', icon: <Wallet className="h-4 w-4" /> },
            { id: 'payments', label: 'Payments', fullLabel: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
            { id: 'details', label: 'Details', fullLabel: 'Trip Details', icon: <Plane className="h-4 w-4" /> },
            { id: 'needtoknow', label: 'Info', fullLabel: 'Need to Know', icon: <Info className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-sans tracking-wide transition-colors relative flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              <span className="sm:hidden">{tab.label}</span>
              <span className="hidden sm:inline">{tab.fullLabel}</span>
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
            {/* Itinerary Value Header - Shows the hidden value */}
            <ItineraryValueHeader
              stats={valueStats}
              destination={destination}
              archetype={style}
            />

            {/* Utility Bar - Share/Save/Export/Print */}
            <ItineraryUtilityBar
              tripId={tripId}
              tripName={`Trip to ${destination}`}
              destination={destination}
              onSave={effectiveIsEditable ? handleSave : undefined}
              isSaving={isSaving}
            />

            {/* What We Skipped - Tourist traps avoided */}
            <WhyWeSkippedSection
              skippedItems={skippedItems}
              destination={destination}
            />

            {/* Skip List Violation Warning - Activities that match our skip list */}
            {validationIssues.filter(i => i.type === 'skip_list').length > 0 && (
              <div className="px-4 py-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      Heads up: {validationIssues.filter(i => i.type === 'skip_list').length} activit{validationIssues.filter(i => i.type === 'skip_list').length === 1 ? 'y matches' : 'ies match'} our skip list
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400/80">
                      These activities appear in "Why We Skipped These" but are still in your itinerary. 
                      Consider swapping them for better alternatives.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {validationIssues.filter(i => i.type === 'skip_list').map((issue, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-amber-500/50 text-amber-700 dark:text-amber-400">
                          Day {issue.dayNumber}: {issue.activityTitle.length > 30 ? issue.activityTitle.slice(0, 30) + '…' : issue.activityTitle}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Flight Sync Warning - Show if flight times don't match Day 1 */}
            {flightSelection?.outbound?.arrival?.time && days[0]?.activities?.[0] && (
              <FlightSyncWarning
                flightArrivalTime={flightSelection.outbound.arrival.time}
                day1FirstActivity={days[0].activities[0]}
                onSyncDay1={() => handleDayRegenerate(0)}
                isRegenerating={regeneratingDay === days[0]?.dayNumber}
              />
            )}


            {/* Inline Modifier - Natural language itinerary changes */}
            {effectiveIsEditable && (
              <InlineModifier
                tripId={tripId}
                destination={destination}
                startDate={startDate}
                endDate={endDate}
                days={days as unknown as ItineraryDay[]}
                onItineraryUpdate={(updatedDays) => {
                  setDays(updatedDays as unknown as EditorialDay[]);
                  setHasChanges(true);
                }}
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
                <div className="flex gap-2 justify-center" data-tour="day-picker">
                  {days.map((day, index) => {
                    const dayDate = day.date ? parseISO(day.date) : null;
                    const isSelected = index === selectedDayIndex;
                    const isTodayDay = dayDate ? isToday(dayDate) : false;
                    
                    return (
                      <button
                        key={day.dayNumber}
                        ref={el => { dayButtonRefs.current[index] = el; }}
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
              <div className="space-y-6">
                {/* Airport Game Plan - Show only on Day 1 */}
                {selectedDayIndex === 0 && (
                  <AirportGamePlan 
                    flightSelection={flightSelection} 
                    hotelSelection={hotelSelection}
                    destination={destination}
                    onNavigateToBookings={() => setActiveTab('details')}
                  />
                )}
                
                <DayCard
                  key={days[selectedDayIndex].dayNumber}
                  day={days[selectedDayIndex]}
                  dayIndex={selectedDayIndex}
                  totalDays={days.length}
                  travelers={travelers}
                  budgetTier={budgetTier}
                  tripCurrency={tripCurrency}
                  displayCost={displayCost}
                  destination={destination}
                  destinationCountry={destinationCountry}
                  isExpanded={expandedDays.includes(days[selectedDayIndex].dayNumber)}
                  isRegenerating={regeneratingDay === days[selectedDayIndex].dayNumber}
                  isEditable={effectiveIsEditable}
                  tripId={tripId}
                  getPaymentForItem={getPaymentForItem}
                  refreshPayments={refreshPayments}
                  onToggle={() => toggleDay(days[selectedDayIndex].dayNumber)}
                  onActivitySwap={openSwapDrawer}
                  onActivityLock={handleActivityLock}
                  onActivityMove={handleActivityMove}
                  onActivityReorder={(reordered) => handleActivityReorder(selectedDayIndex, reordered)}
                  onMoveToDay={handleMoveToDay}
                  onActivityRemove={handleActivityRemove}
                  onDayLock={handleDayLock}
                  onDayRegenerate={() => handleDayRegenerate(selectedDayIndex)}
                  onAddActivity={() => setAddActivityModal({ dayIndex: selectedDayIndex })}
                  onTimeEdit={(dIdx, aIdx, activity) => setTimeEditModal({ dayIndex: dIdx, activityIndex: aIdx, activity })}
                  onActivityEdit={(dIdx, aIdx, activity) => setEditActivityModal({ dayIndex: dIdx, activityIndex: aIdx, activity })}
                  onPaymentRequest={onPaymentRequest}
                  onViewReviews={openReviewsDrawer}
                />
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'budget' && (
          <BudgetTab
            tripId={tripId}
            travelers={travelers}
            totalDays={days.length}
            itineraryDays={days}
          />
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

        {activeTab === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Weather Forecast */}
            <WeatherForecast
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              tripDays={days.length}
            />

            {/* Destination Mid-page Image */}
            <DestinationMidImage 
              destination={destination} 
              destinationCountry={destinationCountry} 
              imageUrl={midImage}
              isLoading={imagesLoading}
            />

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
                <div className="flex items-center gap-3">
                  {flightSelection?.outbound && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditFlightOpen(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {flightCost > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-serif text-xl font-semibold text-foreground">{formatCurrency(displayCost(flightCost), tripCurrency)}</p>
                    </div>
                  )}
                </div>
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
                            <p className="text-xs font-medium text-primary">{getAirportDisplaySync(flightSelection.outbound.departure?.airport || '')}</p>
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
                            <p className="text-xs font-medium text-primary">{getAirportDisplaySync(flightSelection.outbound.arrival?.airport || '')}</p>
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
                              <p className="text-xs font-medium text-accent">{getAirportDisplaySync(flightSelection.return.departure?.airport || '')}</p>
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
                              <p className="text-xs font-medium text-accent">{getAirportDisplaySync(flightSelection.return.arrival?.airport || '')}</p>
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
                <div className="flex items-center gap-3">
                  {hotelSelection?.name && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditHotelOpen(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {hotelCost > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-serif text-xl font-semibold text-foreground">{formatCurrency(displayCost(hotelCost), tripCurrency)}</p>
                    </div>
                  )}
                </div>
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

      {/* Guided Assist Dialog - shows after 3 regenerations */}
      <RegenerateGuidedAssistDialog
        isOpen={showGuidedAssist}
        onClose={() => {
          setShowGuidedAssist(false);
          setGuidedAssistDayIndex(null);
        }}
        onSubmit={handleGuidedAssistSubmit}
        dayNumber={guidedAssistDayIndex !== null ? days[guidedAssistDayIndex]?.dayNumber || guidedAssistDayIndex + 1 : 1}
        destination={destination}
      />

      {/* Add Activity Modal */}
      <AddActivityModal
        isOpen={!!addActivityModal}
        onClose={() => setAddActivityModal(null)}
        onAdd={(activity) => addActivityModal && handleAddActivity(addActivityModal.dayIndex, activity)}
        currency={tripCurrency}
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

      {/* Edit Flight Dialog */}
      {editFlightOpen && (
        <Dialog open={editFlightOpen} onOpenChange={setEditFlightOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                Edit Flight Details
              </DialogTitle>
            </DialogHeader>
            <AddFlightInline
              tripId={tripId}
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              travelers={travelers}
              origin={originCity}
              onFlightAdded={() => {
                setEditFlightOpen(false);
                onBookingAdded?.();
              }}
              editMode={true}
              existingOutbound={flightSelection?.outbound ? {
                airline: flightSelection.outbound.airline || '',
                flightNumber: flightSelection.outbound.flightNumber || '',
                departureAirport: flightSelection.outbound.departure?.airport || '',
                arrivalAirport: flightSelection.outbound.arrival?.airport || '',
                departureTime: flightSelection.outbound.departure?.time || '',
                arrivalTime: flightSelection.outbound.arrival?.time || '',
                departureDate: flightSelection.outbound.departure?.date || startDate,
              } : undefined}
              existingReturn={flightSelection?.return ? {
                airline: flightSelection.return.airline || '',
                flightNumber: flightSelection.return.flightNumber || '',
                departureAirport: flightSelection.return.departure?.airport || '',
                arrivalAirport: flightSelection.return.arrival?.airport || '',
                departureTime: flightSelection.return.departure?.time || '',
                arrivalTime: flightSelection.return.arrival?.time || '',
                departureDate: flightSelection.return.departure?.date || endDate,
              } : undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Hotel Dialog */}
      {editHotelOpen && (
        <Dialog open={editHotelOpen} onOpenChange={setEditHotelOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Hotel className="h-5 w-5 text-primary" />
                Edit Hotel Details
              </DialogTitle>
            </DialogHeader>
            <AddHotelInline
              tripId={tripId}
              destination={destination}
              startDate={startDate}
              endDate={endDate}
              travelers={travelers}
              onHotelAdded={() => {
                setEditHotelOpen(false);
                onBookingAdded?.();
              }}
              editMode={true}
              existingHotel={hotelSelection?.name ? {
                name: hotelSelection.name,
                address: hotelSelection.address || '',
                neighborhood: '',
                checkInTime: hotelSelection.checkIn || '15:00',
                checkOutTime: hotelSelection.checkOut || '11:00',
              } : undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Activity Alternatives Drawer (AI Swap) */}
      <ActivityAlternativesDrawer
        open={swapDrawerOpen}
        onClose={() => {
          setSwapDrawerOpen(false);
          setSwapTarget(null);
          setSwapDrawerActivity(null);
        }}
        activity={swapDrawerActivity}
        destination={destination}
        existingActivities={days.flatMap(day => day.activities.map(a => a.title).filter(Boolean))}
        onSelectAlternative={handleSelectSwapAlternative}
      />

      {/* Reviews Drawer */}
      <ReviewsDrawer
        open={reviewsDrawerOpen}
        onClose={() => {
          setReviewsDrawerOpen(false);
          setReviewsTarget(null);
        }}
        placeName={reviewsTarget?.placeName || ''}
        destination={destination}
        placeType={reviewsTarget?.placeType}
        activityRating={reviewsTarget?.activityRating}
        activityReviewCount={reviewsTarget?.activityReviewCount}
      />

      {/* Restaurant Search Drawer */}
      <RestaurantSearchDrawer
        open={restaurantDrawerOpen}
        onClose={() => {
          setRestaurantDrawerOpen(false);
          setSwapTarget(null);
          setSwapDrawerActivity(null);
        }}
        activity={swapDrawerActivity}
        destination={destination}
        mealType={restaurantDrawerMealType}
        onSelectRestaurant={handleSelectSwapAlternative}
      />

      {/* Share Trip Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share & Manage Trip
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Collaborators Panel */}
            <TripCollaboratorsPanel
              tripId={tripId}
              ownerName={tripPermission?.isOwner ? 'You' : undefined}
              onInviteClick={handleCreateShareLink}
            />

            {/* Invite Link Section - only for owner */}
            {tripPermission?.isOwner && (
              <>
                <div className="pt-4 border-t border-border space-y-2">
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

                {/* Share Guide to Social */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Share your travel guide:</p>
                  <Button 
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setShowShareModal(false);
                      setShowShareGuideSheet(true);
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    Share to Email, Text & Social Media
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Guide Sheet - Email, SMS, Social */}
      <ShareGuideSheet
        open={showShareGuideSheet}
        onClose={() => setShowShareGuideSheet(false)}
        shareLink={shareLink || ''}
        destination={destination}
        onGenerateLink={handleCreateShareLink}
      />

      {/* Optimize Preferences Dialog */}
      <OptimizePreferencesDialog
        open={showOptimizeDialog}
        onOpenChange={setShowOptimizeDialog}
        onConfirm={handleOptimize}
        isOptimizing={isOptimizing}
      />

      {/* Route Optimization Upgrade Prompt */}
      <UpgradePrompt
        isOpen={showRouteUpgrade}
        onClose={() => setShowRouteUpgrade(false)}
        featureName="route optimization"
        context="route"
      />
    </div>
  );
}

// =============================================================================
// DESTINATION IMAGE COMPONENTS (Static images - no carousel)
// =============================================================================

interface DestinationHeroImageProps {
  destination: string;
  destinationCountry?: string;
  imageUrl: string | null;
  isLoading?: boolean;
}

// Helper to normalize destination strings (remove IATA codes like "(FCO)")
function normalizeDestination(dest: string): string {
  return (dest || '')
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .replace(/\b(international\s+)?airport\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function generateGradientDataUrl(label: string): string {
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
}

// Hero image at the top
function DestinationHeroImage({ destination, destinationCountry, imageUrl, isLoading }: DestinationHeroImageProps) {
  const [hasError, setHasError] = useState(false);
  const cleanDestination = normalizeDestination(destination);
  
  const displayUrl = hasError ? generateGradientDataUrl(cleanDestination) : (imageUrl || generateGradientDataUrl(cleanDestination));

  if (isLoading || !imageUrl) {
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
          src={displayUrl}
          alt={`${cleanDestination} hero`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="text-2xl md:text-3xl font-serif text-white drop-shadow-lg">{cleanDestination}</h2>
          {destinationCountry && (
            <p className="text-white/80 text-sm">{destinationCountry}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Mid-page image (second static image)
function DestinationMidImage({ destination, destinationCountry, imageUrl, isLoading }: DestinationHeroImageProps) {
  const [hasError, setHasError] = useState(false);
  const cleanDestination = normalizeDestination(destination);
  
  const displayUrl = hasError ? generateGradientDataUrl(cleanDestination) : (imageUrl || generateGradientDataUrl(cleanDestination));

  if (isLoading || !imageUrl) {
    return (
      <div className="relative overflow-hidden rounded-xl">
        <div className="relative h-40 md:h-48 bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-xl font-serif text-foreground">{cleanDestination}</h3>
            {destinationCountry && (
              <p className="text-muted-foreground text-sm">{destinationCountry}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="relative h-40 md:h-48">
        <img
          src={displayUrl}
          alt={`${cleanDestination} overview`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-serif text-white drop-shadow-lg">{cleanDestination}</h3>
          {destinationCountry && (
            <p className="text-white/80 text-sm">{destinationCountry}</p>
          )}
        </div>
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
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch real destination insights from Perplexity
  useEffect(() => {
    if (fetchedRef.current || !destination) return;
    
    const fetchInsights = async () => {
      setIsLoadingInsights(true);
      setInsightsError(null);
      
      try {
        const { data, error } = await supabase.functions.invoke('lookup-destination-insights', {
          body: { destination, country: destinationCountry }
        });
        
        if (error) throw error;
        
        if (data?.success && data?.data) {
          setAiInsights(data.data);
          fetchedRef.current = true;
        }
      } catch (err) {
        console.error('Failed to fetch destination insights:', err);
        setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        setIsLoadingInsights(false);
      }
    };
    
    fetchInsights();
  }, [destination, destinationCountry]);

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  // Default information for common destinations - prioritize AI insights when available
  const getDefaultInfo = () => {
    // If we have AI-generated insights, use those
    if (aiInsights) {
      return {
        currency: aiInsights.currency?.name || 'Local currency',
        currencyTips: aiInsights.currency?.tips || ['Check current exchange rates'],
        language: aiInsights.language?.primary || 'Local language',
        languageTips: aiInsights.language?.phrases?.map((p: any) => 
          `"${p.phrase}" = "${p.translation}" (${p.pronunciation})`
        ) || ['Learn basic greetings'],
        languageEnglishFriendly: aiInsights.language?.englishFriendly,
        timezone: aiInsights.timezone?.zone || 'Local time',
        timezoneTips: aiInsights.timezone?.tips || ['Check local business hours'],
        tipping: aiInsights.tipping?.custom || 'Varies by location',
        tippingTips: aiInsights.tipping?.tips || ['Research local customs'],
        transit: aiInsights.transit?.overview || 'Various public transport options',
        transitTips: aiInsights.transit?.tips || ['Download local transit apps'],
        water: aiInsights.water?.description || (aiInsights.water?.safe ? 'Tap water is safe' : 'Check local advisories'),
        waterTips: aiInsights.water?.tips || ['When in doubt, use bottled water'],
        voltage: `${aiInsights.voltage?.voltage || '230V'}, ${aiInsights.voltage?.plugType || 'Check adapter requirements'}`,
        voltageTips: aiInsights.voltage?.tips || ['Universal adapters are convenient'],
        emergency: aiInsights.emergency?.number || 'Contact local authorities',
        emergencyTips: aiInsights.emergency?.tips || ['Save emergency numbers in your phone'],
      };
    }

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
      entryRequirements: 'Check visa requirements for your nationality',
      entryTips: ['Passport must be valid 6+ months beyond travel dates', 'Check visa requirements well in advance', 'Some countries require proof of onward travel', 'Keep digital copies of all documents'],
    };
  };

  // Get entry requirements based on destination
  const getEntryRequirements = () => {
    const country = destinationCountry?.toLowerCase() || '';
    const dest = destination.toLowerCase();
    
    // UK
    if (country.includes('uk') || country.includes('united kingdom') || country.includes('england') || dest.includes('london')) {
      return {
        visa: 'US citizens: Visa-free for up to 6 months',
        visaTips: [
          'No visa required for tourism (US/EU citizens)',
          'Must show proof of return/onward travel',
          'May need to show proof of accommodation',
          'Electronic Travel Authorisation (ETA) required from 2024 for some nationalities'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Passport must be valid for entire stay',
          'No minimum validity requirement beyond trip',
          'Blank pages not strictly required',
          'Keep a photo of passport on your phone'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'COVID restrictions may apply - check before travel',
          'NHS available for emergencies (may incur charges)',
          'European Health Insurance Card (EHIC) no longer valid for UK',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // France
    if (country.includes('france') || dest.includes('paris')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'Keep color copies separate from original'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Pharmacies can provide basic medical advice',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Italy / Rome
    if (country.includes('italy') || dest.includes('rome') || dest.includes('florence') || dest.includes('venice') || dest.includes('milan')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Register at local police station if staying 8+ days (handled by hotels)'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'Carry passport when visiting major sites (security checks)'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Tap water is safe to drink',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Spain
    if (country.includes('spain') || dest.includes('barcelona') || dest.includes('madrid')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'National ID card accepted for EU citizens'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'Pharmacies well-stocked and helpful',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Germany
    if (country.includes('germany') || dest.includes('berlin') || dest.includes('munich')) {
      return {
        visa: 'US citizens: Visa-free for up to 90 days (Schengen)',
        visaTips: [
          'Part of Schengen Area - 90 days in any 180-day period',
          'ETIAS authorization required from 2025 for US citizens',
          'No visa required for tourism (US/EU citizens)',
          'Count all Schengen countries toward 90-day limit'
        ],
        passport: 'Valid passport required',
        passportTips: [
          'Must be valid 3+ months beyond planned departure from Schengen',
          'Issued within past 10 years',
          'At least 2 blank pages recommended',
          'National ID card accepted for EU citizens'
        ],
        health: 'No required vaccinations',
        healthTips: [
          'Routine vaccinations should be up to date',
          'European Health Insurance Card (EHIC) valid for EU citizens',
          'High-quality healthcare system',
          'Travel insurance strongly recommended'
        ],
      };
    }
    
    // Default fallback
    return {
      visa: 'Check visa requirements for your nationality',
      visaTips: [
        'Requirements vary by passport/nationality',
        'Apply for visa well in advance if required',
        'Some visas can take weeks to process',
        'Check embassy website for latest requirements'
      ],
      passport: 'Valid passport required',
      passportTips: [
        'Typically must be valid 6+ months beyond travel dates',
        'Check blank page requirements',
        'Keep digital and physical copies separate',
        'Note passport expiration date'
      ],
      health: 'Check health advisories',
      healthTips: [
        'Consult CDC travel health notices',
        'Some destinations require vaccinations',
        'Bring sufficient prescription medications',
        'Travel insurance strongly recommended'
      ],
    };
  };

  const entryInfo = getEntryRequirements();

  const info = getDefaultInfo();

  const infoCategories = [
    // Entry Requirements - Most important first
    {
      id: 'visa',
      icon: <Shield className="h-5 w-5" />,
      label: 'Visa Requirements',
      value: entryInfo.visa,
      tips: entryInfo.visaTips,
    },
    {
      id: 'passport',
      icon: <FileText className="h-5 w-5" />,
      label: 'Passport',
      value: entryInfo.passport,
      tips: entryInfo.passportTips,
    },
    {
      id: 'health',
      icon: <HeartPulse className="h-5 w-5" />,
      label: 'Health & Vaccinations',
      value: entryInfo.health,
      tips: entryInfo.healthTips,
    },
    // General info
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-serif">Need to Know</h2>
            <p className="text-sm text-muted-foreground">Essential info for {destination}</p>
          </div>
        </div>
        {isLoadingInsights && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading local insights...</span>
          </div>
        )}
        {aiInsights && !isLoadingInsights && (
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-powered insights
          </Badge>
        )}
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
  flightSelection?: FlightSelection | null;
  hotelSelection?: HotelSelection | null;
  destination: string;
  onNavigateToBookings?: () => void;
}

function AirportGamePlan({ flightSelection, hotelSelection, destination, onNavigateToBookings }: AirportGamePlanProps) {
  const outbound = flightSelection?.outbound;
  const hasHotel = !!hotelSelection?.name;
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(false);
  
  // Determine flight completeness: need arrival time for game plan to be useful
  const hasAnyFlightData = !!outbound;
  const hasCompleteFlightData = !!(outbound?.arrival?.time || outbound?.departure?.time);
  const hasFlight = hasCompleteFlightData; // Only show game plan if we have times
  
  // Fetch dynamic transfer data from Google Maps Distance Matrix API
  // Runs when hotel exists (flight optional - uses destination airport as fallback)
  useEffect(() => {
    if (!hotelSelection?.name) return;
    
    const fetchTransferData = async () => {
      setIsLoadingTransfer(true);
      try {
        const arrivalAirport = outbound?.arrival?.airport || '';
        const arrivalTime = outbound?.arrival?.time || '';
        
        // Build origin string (airport) - use flight data or fallback to destination airport
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
  }, [outbound?.arrival?.airport, hotelSelection?.name, hotelSelection?.address, destination]);
  
  // Parse arrival time and calculate recommendations (move up to use in all states)
  const arrivalTime = outbound?.arrival?.time || '';
  const arrivalAirport = outbound?.arrival?.airport || '';
  const departureTime = outbound?.departure?.time || '';
  
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

  // Post-landing advice based on arrival time - aware of hotel availability
  const getPostLandingAdvice = (): { action: string; reason: string; isMissing?: boolean } => {
    if (!hasFlight) {
      return { action: 'Add flight for arrival tips', reason: 'We\'ll plan your arrival day activities', isMissing: true };
    }
    
    if (!arrivalTime) {
      return hasHotel 
        ? { action: 'Head to your hotel', reason: 'Check in and settle before exploring' }
        : { action: 'Add hotel for personalized tips', reason: 'We\'ll help plan your arrival day perfectly', isMissing: true };
    }
    
    const match = arrivalTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return hasHotel 
      ? { action: 'Head to your hotel', reason: 'Check in and settle before exploring' }
      : { action: 'Add hotel for personalized tips', reason: 'We\'ll help plan your arrival day perfectly', isMissing: true };
    
    let hours = parseInt(match[1], 10);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    if (!hasHotel) {
      return { action: 'Add hotel for personalized tips', reason: 'We\'ll calculate transfer times and plan your arrival', isMissing: true };
    }
    
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
            <h3 className="font-serif text-lg font-medium">Your Arrival Game Plan</h3>
            <p className="text-sm text-muted-foreground">Everything you need for Day 1</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Flight Section - First */}
        {hasFlight ? (
          <>
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
                    Landing at {arrivalTime}{arrivalAirport ? ` (${arrivalAirport})` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasHotel ? postLanding.reason : 'Add your hotel to see transfer options and personalized arrival tips'}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : hasAnyFlightData ? (
          // Partial flight data - show what we have and prompt to finish
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Plane className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Finish Flight Details</p>
                <p className="text-xs text-muted-foreground">
                  {outbound?.airline ? `${outbound.airline} ` : ''}
                  {outbound?.flightNumber ? `${outbound.flightNumber} • ` : ''}
                  Add times for your personalized game plan
                </p>
              </div>
            </div>
            {onNavigateToBookings && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onNavigateToBookings}
                className="shrink-0"
              >
                Finish Details
              </Button>
            )}
          </div>
        ) : (
          // No flight data at all
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Plane className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Your Flight</p>
                <p className="text-xs text-muted-foreground">We'll plan your arrival day around your landing time</p>
              </div>
            </div>
            {onNavigateToBookings && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onNavigateToBookings}
                className="shrink-0"
              >
                Add Flight
              </Button>
            )}
          </div>
        )}

        {/* Hotel Section - Show hotel details */}
        {hasHotel ? (
          <>
            {/* Hotel Info Block */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Hotel className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{hotelSelection?.name}</p>
                {hotelSelection?.address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{hotelSelection.address}</p>
                )}
                {hotelSelection?.checkInDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Check-in: {safeFormatDate(hotelSelection.checkInDate, 'MMM d', 'Date TBD')}
                    {hotelSelection?.checkInTime && ` at ${hotelSelection.checkInTime}`}
                  </p>
                )}
              </div>
            </div>

            {/* Transfer Options Block */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Car className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">Getting There</p>
                  {isLoadingTransfer && (
                    <span className="text-xs text-muted-foreground animate-pulse">Loading live data...</span>
                  )}
                  {transferData && !isLoadingTransfer && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                      Live
                    </Badge>
                  )}
                </div>
                {/* Always show transfer options when hotel exists (use static fallback if no live data) */}
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
                {!hasFlight && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Add your flight to get personalized arrival day timing
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Hotel className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Your Hotel</p>
                <p className="text-xs text-muted-foreground">Get transfer times and check-in recommendations</p>
              </div>
            </div>
            {onNavigateToBookings && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onNavigateToBookings}
                className="shrink-0"
              >
                Add Hotel
              </Button>
            )}
          </div>
        )}

        {/* Post-Landing Action - only show when both flight and hotel exist */}
        {hasFlight && hasHotel && (
          <div className="flex items-start gap-3 pt-3 border-t border-border">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Recommended: {postLanding.action}</p>
              <p className="text-xs text-muted-foreground">{postLanding.reason}</p>
            </div>
          </div>
        )}
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
  totalDays: number; // Total number of days in itinerary
  travelers: number;
  budgetTier?: string;
  tripCurrency: string; // Currency for cost formatting
  displayCost: (amountInUSD: number) => number; // Convert USD to display currency
  destination: string; // For real photo lookup
  destinationCountry?: string; // For cost estimation
  isExpanded: boolean;
  isRegenerating: boolean;
  isEditable: boolean;
  tripId: string;
  highlightedActivityIds?: string[]; // Activities to highlight (from chatbot)
  getPaymentForItem: (itemType: 'flight' | 'hotel' | 'activity', itemId: string) => TripPayment | undefined;
  refreshPayments: () => void;
  onToggle: () => void;
  onActivitySwap?: (dayIndex: number, activity: EditorialActivity) => void;
  onActivityLock: (dayIndex: number, activityId: string) => void;
  onActivityMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onMoveToDay?: (fromDayIndex: number, activityId: string, toDayIndex: number) => void;
  onActivityRemove: (dayIndex: number, activityId: string) => void;
  onActivityReorder?: (activities: EditorialActivity[]) => void; // Drag-and-drop reorder
  onDayLock: (dayIndex: number) => void;
  onDayRegenerate: () => void;
  onAddActivity: () => void;
  onTimeEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onActivityEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onPaymentRequest?: (activityId: string) => void;
  onBookingStateChange?: (activityId: string, newState: BookingItemState) => void;
  onViewReviews?: (activity: EditorialActivity) => void;
}

function DayCard({
  day,
  dayIndex,
  totalDays,
  travelers,
  budgetTier,
  tripCurrency,
  displayCost,
  destination,
  destinationCountry,
  isExpanded,
  isRegenerating,
  isEditable,
  tripId,
  highlightedActivityIds = [],
  getPaymentForItem,
  refreshPayments,
  onToggle,
  onActivitySwap,
  onActivityLock,
  onActivityMove,
  onMoveToDay,
  onActivityRemove,
  onActivityReorder,
  onDayLock,
  onDayRegenerate,
  onAddActivity,
  onTimeEdit,
  onActivityEdit,
  onPaymentRequest,
  onBookingStateChange,
  onViewReviews,
}: DayCardProps) {
  const allLocked = day.activities.every(a => a.isLocked);
  const totalCost = getDayTotalCost(day.activities, travelers, budgetTier, destination, destinationCountry);
  
  // Transport details toggle - collapsed by default to reduce visual noise
  const [showTransportDetails, setShowTransportDetails] = useState(false);
  
  // Normalize destination for image lookups
  const cleanDestination = normalizeDestination(destination);
  // Library modal state removed - agent features disabled

  return (
    <div className="border border-border bg-card overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-shadow">
      {/* Day Header - Editorial Style with Color Accent */}
      <div className="relative p-4 sm:p-6 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        {/* Decorative accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-accent to-primary/50" />
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <span className="text-3xl sm:text-5xl font-serif font-light text-primary/40">
                {String(day.dayNumber).padStart(2, '0')}
              </span>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-lg sm:text-xl font-medium text-foreground mb-0.5 sm:mb-1 truncate">
                {day.title || day.theme || `Day ${day.dayNumber}`}
              </h3>
              {day.description && (
                <p className="text-xs sm:text-sm text-muted-foreground italic line-clamp-1 sm:line-clamp-none">{day.description}</p>
              )}
            </div>
          </div>

          {/* Day Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pl-10 sm:pl-0">
            {totalCost > 0 && (
              <Badge variant="outline" className="text-xs sm:text-sm font-semibold border-primary/30 bg-primary/5 text-primary shrink-0">
                {formatCurrency(displayCost(totalCost), tripCurrency)}
              </Badge>
            )}
            {day.weather && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-secondary/50 text-xs sm:text-sm shrink-0">
                {weatherIcons[day.weather.condition?.toLowerCase() || 'sunny']}
                {day.weather.high && <span className="font-medium">{day.weather.high}°</span>}
              </div>
            )}
            {/* Transport Details Toggle - now more prominent with text label */}
            <Button
              variant={showTransportDetails ? "default" : "outline"}
              size="sm"
              onClick={() => setShowTransportDetails(prev => !prev)}
              className={cn(
                "h-7 sm:h-8 gap-1 sm:gap-1.5 text-xs font-medium transition-all shrink-0 px-2 sm:px-3",
                showTransportDetails 
                  ? "bg-primary text-primary-foreground" 
                  : "border-primary/30 hover:bg-primary/10 hover:border-primary/50"
              )}
              title={showTransportDetails ? 'Hide route details' : 'Show route details'}
            >
              <Route className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
              <span className="hidden sm:inline">{showTransportDetails ? 'Hide Routes' : 'Show Routes'}</span>
            </Button>
            {isEditable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDayLock(dayIndex)}
                  className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary/10 shrink-0"
                  title={allLocked ? 'Unlock Day' : 'Lock Day'}
                >
                  {allLocked ? <Lock className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-primary" /> : <Unlock className="h-3.5 sm:h-4 w-3.5 sm:w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDayRegenerate}
                  disabled={isRegenerating}
                  className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-accent/10 shrink-0"
                  title="Regenerate Day"
                  data-tour="regenerate-button"
                >
                  <RefreshCw className={cn("h-3.5 sm:h-4 w-3.5 sm:w-4", isRegenerating && "animate-spin text-accent")} />
                </Button>
                {/* Save to Library button removed - agent features disabled */}
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> : <ChevronDown className="h-3.5 sm:h-4 w-3.5 sm:w-4" />}
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
              <DraggableActivityList
                items={day.activities}
                onReorder={(reordered) => onActivityReorder?.(reordered)}
                highlightedIds={highlightedActivityIds}
                disabled={!isEditable}
                renderItem={(activity, activityIndex, isDragging, isHighlighted) => (
                  <div className={cn(
                    "transition-all duration-300",
                    isHighlighted && "bg-primary/5"
                  )}>
                    <ActivityRow
                      activity={activity}
                      destination={cleanDestination}
                      destinationCountry={destinationCountry}
                      dayIndex={dayIndex}
                      activityIndex={activityIndex}
                      totalActivities={day.activities.length}
                      totalDays={totalDays}
                      isLast={activityIndex === day.activities.length - 1}
                      isEditable={isEditable}
                      travelers={travelers}
                      budgetTier={budgetTier}
                      tripCurrency={tripCurrency}
                      displayCost={displayCost}
                      tripId={tripId}
                      showTransportDetails={showTransportDetails}
                      existingPayment={getPaymentForItem('activity', activity.id)}
                      onPaymentSuccess={refreshPayments}
                      onLock={onActivityLock}
                      onSwap={onActivitySwap}
                      onMove={onActivityMove}
                      onMoveToDay={onMoveToDay}
                      onRemove={onActivityRemove}
                      onTimeEdit={onTimeEdit}
                      onEdit={onActivityEdit}
                      onPaymentRequest={onPaymentRequest}
                      onBookingStateChange={onBookingStateChange}
                      onViewReviews={onViewReviews}
                    />
                  </div>
                )}
              />
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
                    Day Total: {formatCurrency(displayCost(totalCost), tripCurrency)}
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
  destinationCountry?: string; // For cost estimation
  dayIndex: number;
  activityIndex: number;
  totalActivities: number;
  totalDays: number; // Total number of days in itinerary
  isLast: boolean;
  isEditable: boolean;
  travelers: number;
  budgetTier?: string;
  tripCurrency: string; // User's preferred display currency
  displayCost: (amountInUSD: number) => number; // Convert USD to display currency
  tripId: string;
  showTransportDetails: boolean; // Whether to show expanded transport info
  existingPayment?: TripPayment;
  onPaymentSuccess: () => void;
  onLock: (dayIndex: number, activityId: string) => void;
  onSwap?: (dayIndex: number, activity: EditorialActivity) => void;
  onMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onMoveToDay?: (fromDayIndex: number, activityId: string, toDayIndex: number) => void;
  onRemove: (dayIndex: number, activityId: string) => void;
  onTimeEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onEdit: (dayIndex: number, activityIndex: number, activity: EditorialActivity) => void;
  onPaymentRequest?: (activityId: string) => void;
  onBookingStateChange?: (activityId: string, newState: BookingItemState) => void;
  onViewReviews?: (activity: EditorialActivity) => void;
}

function ActivityRow({
  activity,
  destination,
  destinationCountry,
  dayIndex,
  activityIndex,
  totalActivities,
  totalDays,
  isLast,
  isEditable,
  travelers,
  budgetTier,
  tripCurrency,
  displayCost,
  tripId,
  showTransportDetails,
  existingPayment,
  onPaymentSuccess,
  onLock,
  onSwap,
  onMove,
  onMoveToDay,
  onRemove,
  onTimeEdit,
  onEdit,
  onPaymentRequest,
  onBookingStateChange,
  onViewReviews,
}: ActivityRowProps) {
  const activityType = getActivityType(activity);
  const style = activityStyles[activityType] || activityStyles.activity;
  const rawRating = getActivityRating(activity);
  const reviewCount = getActivityReviewCount(activity);
  const costInfo = getActivityCostInfo(activity, travelers, budgetTier, destination, destinationCountry);
  const cost = costInfo.amount;
  // Use tripCurrency (user's preferred display currency) instead of activity's native currency
  const existingPhoto = getActivityPhoto(activity);
  const time = activity.startTime || activity.time;
  
  // Normalize title: use title, fallback to name (backend may return either), and strip system prefixes
  const activityTitle = sanitizeActivityName(activity.title || (activity as { name?: string }).name);
  
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

  // For link lookups we want the best venue name even if the activity type was misclassified.
  // This prevents generic titles like "Traditional Fado Dinner Experience" being sent to the URL lookup.
  const venueNameForLink =
    activity.location?.name?.trim() ||
    extractVenueFromText(activityTitle) ||
    extractVenueFromText(activity.description) ||
    null;

  // Determine the best search term for images:
  // 1. Dining venue (from location/title/description) if available
  // 2. location.name (actual venue) if available
  // 3. Fall back to activity title
  const imageSearchTerm = (venueNameForDining && venueNameForDining.length > 3)
    ? venueNameForDining
    : (activity.location?.name && activity.location.name.length > 3 ? activity.location.name : activityTitle);

  // Use useActivityImage hook for real place photos with deduplication
  // This fetches from Google Places / TripAdvisor with caching
  // For hotels: Extract hotel name from title/location and fetch real photo
  const isHotelActivity = isCheckIn || isAccommodation;
  const hotelName = isHotelActivity 
    ? (activity.location?.name || activityTitle.replace(/check[\-\s]?(in|out)/gi, '').replace(/at\s+/gi, '').trim())
    : null;
  
  // Detect if this is a dining activity AT a hotel (breakfast at hotel, etc.)
  // These should use the hotel image instead of searching for a "restaurant"
  const locationName = activity.location?.name?.toLowerCase() || '';
  const isHotelDiningActivity = isDiningActivity && (
    locationName.includes('hotel') ||
    locationName.includes('hyatt') ||
    locationName.includes('hilton') ||
    locationName.includes('marriott') ||
    locationName.includes('sheraton') ||
    locationName.includes('ritz') ||
    locationName.includes('intercontinental') ||
    locationName.includes('resort') ||
    locationName.includes('inn') ||
    activityTitle.toLowerCase().includes('breakfast at hotel') ||
    activityTitle.toLowerCase().includes('breakfast at the hotel') ||
    activityTitle.toLowerCase().includes('lunch at hotel') ||
    activityTitle.toLowerCase().includes('dinner at hotel')
  );
  
  // For hotel dining activities, use accommodation category and hotel search term
  const effectiveSearchTerm = isHotelDiningActivity
    ? `${activity.location?.name || 'hotel'} hotel`
    : imageSearchTerm;
  
  const effectiveCategory = isHotelDiningActivity
    ? 'accommodation'
    : (isHotelActivity ? 'accommodation' : activityType);
  
  // Fetch real photos for most activities, including hotels (but not generic check-ins without hotel name)
  const hasHotelName = hotelName && hotelName.length > 3 && !hotelName.toLowerCase().includes('hotel check');
  const shouldFetchRealPhoto = showThumbnail && !isAirport && (hasHotelName || (!isCheckIn && !isAccommodation));
  
  const { imageUrl: fetchedImageUrl, loading: imageLoading } = useActivityImage(
    isHotelActivity && hasHotelName ? `${hotelName} hotel` : effectiveSearchTerm,
    effectiveCategory,
    existingPhoto,
    shouldFetchRealPhoto ? destination : undefined,
    activity.id
  );

  const thumbnailUrl = fetchedImageUrl;
  const [thumbnailError, setThumbnailError] = useState(false);
  // Library modal state removed - agent features disabled

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-stretch group/activity hover:bg-secondary/10 transition-colors",
      !isLast && "border-b border-border",
      activity.isLocked && "bg-primary/5"
    )}>
      {/* Mobile: Compact header with time + icon */}
      <div className="sm:hidden flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-gradient-to-r from-secondary/20 to-transparent">
        <span className="p-1 rounded bg-primary/10 text-primary">{style.icon}</span>
        <span className="text-xs font-medium text-foreground">{formatTime(time)}</span>
        {activity.duration && (
          <span className="text-xs text-muted-foreground">• {activity.duration}</span>
        )}
        {activity.isLocked && <Lock className="h-3 w-3 text-primary ml-auto" />}
      </div>

      {/* Time Column - Hidden on mobile, visible on desktop */}
      <div 
        className={cn(
          "hidden sm:block w-24 shrink-0 p-4 border-r border-border bg-gradient-to-b from-secondary/20 to-secondary/5",
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

      {/* Thumbnail Column - Hidden on mobile, visible on desktop */}
      {showThumbnail && (
        <div className="hidden sm:block w-24 h-24 shrink-0 border-r border-border bg-muted/30 overflow-hidden relative">
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
      <div className="flex-1 p-3 sm:p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="hidden sm:flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded bg-primary/10 text-primary">{style.icon}</span>
              <span className="text-xs text-primary/80 uppercase tracking-wider font-medium">{style.label}</span>
              {/* Rating badge - clickable to view reviews (only for reviewable activity types) */}
              {(() => {
                // Types that should NOT show reviews
                const nonReviewableTypes = [
                  'downtime', 'transport', 'accommodation', 'flight', 'hotel', 
                  'check-in', 'check-out', 'checkin', 'checkout', 'transfer', 
                  'airport', 'arrival', 'departure', 'travel', 'transit',
                  'packing', 'rest', 'sleep', 'free time', 'leisure'
                ];
                const activityTypeLower = activityType.toLowerCase();
                const titleLower = (activity.title || '').toLowerCase();
                
                // Check if this is a non-reviewable activity
                const isNonReviewable = nonReviewableTypes.some(t => 
                  activityTypeLower.includes(t) || titleLower.includes(t)
                ) || titleLower.includes('check in') || titleLower.includes('check out');
                
                if (isNonReviewable) return null;
                
                // Show rating badge if we have a rating, otherwise show "See Reviews" button
                // Always allow viewing reviews for reviewable activities - the edge function fetches them on-demand
                if (rating) {
                  return (
                    <Badge 
                      variant="secondary" 
                      className="text-xs gap-1 bg-amber-500/10 text-amber-600 border-none cursor-pointer hover:bg-amber-500/20 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReviews?.(activity);
                      }}
                      title="View reviews"
                    >
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {rating.toFixed(1)}
                      {reviewCount && reviewCount > 0 && (
                        <span className="text-amber-600/70">({reviewCount > 999 ? `${(reviewCount / 1000).toFixed(1)}k` : reviewCount})</span>
                      )}
                    </Badge>
                  );
                }
                
                // Always show "See Reviews" for reviewable activities - reviews are fetched on-demand
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReviews?.(activity);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    title="View reviews and details"
                  >
                    <Star className="h-3 w-3" />
                    See Reviews
                  </button>
                );
              })()}
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
            {/* Voyance Insight - Local knowledge for this activity */}
            {activity.tips && !isDowntime && !isTransport && !isCheckIn && (
              <VoyanceInsight tip={activity.tips} />
            )}
            {/* Transportation to next - Enhanced with distance/time */}
            {activity.timeBlockType !== 'downtime' && activity.transportation && !isLast && (
              <TransitBadge 
                transportation={activity.transportation}
                tripCurrency={tripCurrency}
                displayCost={displayCost}
                showDetails={showTransportDetails}
              />
            )}
          </div>

          {/* Actions & Cost */}
          <div className="flex flex-col items-end gap-2 ml-4">
            {costInfo.isEstimated ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium cursor-help border-b border-dashed border-muted-foreground/40">
                    ~{formatCurrency(displayCost(cost), tripCurrency)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px] text-xs">
                  <p>{costInfo.estimateReason}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-medium">{formatCurrency(displayCost(cost), tripCurrency)}</span>
            )}
            {/* Booking state actions - replaces static vendor links */}
            <InlineBookingActions
              activity={{
                id: activity.id,
                title: activity.title,
                // Ensure restaurant lookup gets the best venue name (not the generic meal title)
                location: venueNameForLink
                  ? { ...(activity.location || {}), name: venueNameForLink }
                  : activity.location,
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
                bookingUrl: activity.bookingUrl,
                viatorProductCode: activity.viatorProductCode,
                externalBookingUrl: activity.bookingUrl, // Pass actual URL for vendor links
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
              <div className="flex flex-col gap-2">
                {/* Primary Actions Row - Find Alternative ALWAYS visible */}
                <div className="flex items-center gap-1.5">
                  {!activity.isLocked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSwap?.(dayIndex, activity)}
                      className="gap-1.5 h-7 text-xs font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      data-tour="find-alternative"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Find Alternative
                    </Button>
                  )}
                  
                  {/* Lock button */}
                  <button
                    onClick={() => onLock(dayIndex, activity.id)}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      activity.isLocked
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary text-muted-foreground"
                    )}
                    title={activity.isLocked ? "Unlock to edit" : "Lock"}
                    data-tour="lock-button"
                  >
                    {activity.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                  
                  {/* More actions overflow - Move, Remove, Save */}
                  {!activity.isLocked && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1.5 rounded transition-colors hover:bg-secondary text-muted-foreground"
                          aria-label="More actions"
                          data-tour="more-actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50 min-w-[160px]">
                        <DropdownMenuItem
                          onClick={() => onMove(dayIndex, activity.id, 'up')}
                          disabled={activityIndex === 0}
                          className={cn("cursor-pointer gap-2", activityIndex === 0 && "opacity-50")}
                        >
                          <MoveUp className="h-4 w-4" />
                          Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onMove(dayIndex, activity.id, 'down')}
                          disabled={activityIndex === totalActivities - 1}
                          className={cn("cursor-pointer gap-2", activityIndex === totalActivities - 1 && "opacity-50")}
                        >
                          <MoveDown className="h-4 w-4" />
                          Move down
                        </DropdownMenuItem>
                        {totalDays > 1 && onMoveToDay && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="gap-2">
                                <Calendar className="h-4 w-4" />
                                Move to day
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-background border shadow-lg">
                                {Array.from({ length: totalDays }, (_, i) => i).filter(i => i !== dayIndex).map(targetDay => (
                                  <DropdownMenuItem
                                    key={targetDay}
                                    onClick={() => onMoveToDay(dayIndex, activity.id, targetDay)}
                                    className="cursor-pointer"
                                  >
                                    Day {targetDay + 1}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onRemove(dayIndex, activity.id)}
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
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
  currency?: string;
}

function AddActivityModal({ isOpen, onClose, onAdd, currency = 'USD' }: AddActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('activity');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [cost, setCost] = useState('0');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');

  const handleSubmit = () => {
    onAdd({
      title,
      description,
      category,
      startTime,
      endTime,
      cost: { amount: parseFloat(cost) || 0, currency },
      location: { name: locationName, address: locationAddress },
    });
    setTitle('');
    setDescription('');
    setCategory('activity');
    setStartTime('12:00');
    setEndTime('13:00');
    setCost('0');
    setLocationName('');
    setLocationAddress('');
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
            <label className="text-sm font-medium mb-1 block">Venue Name</label>
            <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Eiffel Tower" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Address</label>
            <Input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="e.g. Champ de Mars, 75007 Paris" />
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
