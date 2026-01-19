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

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp, ChevronDown, MapPin, Clock, Star, Save,
  Lock, Unlock, MoveUp, MoveDown, Plus, RefreshCw,
  Plane, Hotel, Utensils, Camera, ShoppingBag, Palmtree, Car, Trash2,
  Sun, Cloud, CloudRain, Snowflake, Edit3, Sparkles, AlertCircle,
  Calendar, Users, ExternalLink, Route
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import type { ActivityType, WeatherCondition } from '@/types/itinerary';

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
    flightNumber?: string;
    departure?: { time?: string; airport?: string; date?: string };
    arrival?: { time?: string; airport?: string };
    price?: number;
  };
  return?: {
    airline?: string;
    flightNumber?: string;
    departure?: { time?: string; airport?: string; date?: string };
    arrival?: { time?: string; airport?: string };
    price?: number;
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
  amenities?: string[];
  type?: string;
  reviewCount?: number;
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
    language?: string;
    tips?: string;
  };
  heroImageUrl?: string;
  isEditable?: boolean;
  onSave?: (days: EditorialDay[]) => Promise<void>;
  onRegenerateDay?: (dayNumber: number) => Promise<EditorialDay | null>;
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

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '—'; // Should never happen with smart estimation
  }
  if (amount === 0) {
    return 'Free';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
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
  onSave,
  onRegenerateDay,
}: EditorialItineraryProps) {
  const [days, setDays] = useState<EditorialDay[]>(initialDays);
  const [expandedDays, setExpandedDays] = useState<number[]>([1]);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'overview' | 'tips'>('itinerary');
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [addActivityModal, setAddActivityModal] = useState<{ dayIndex: number } | null>(null);

  // Calculate totals with smart estimation
  const totalActivityCost = days.reduce((sum, day) => sum + getDayTotalCost(day.activities, travelers, budgetTier), 0);
  const flightCost = (flightSelection?.outbound?.price || 0) + (flightSelection?.return?.price || 0);
  const hotelCost = (hotelSelection?.pricePerNight || 0) * (hotelSelection?.nights || days.length);
  const totalCost = totalActivityCost + flightCost + hotelCost;

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev =>
      prev.includes(dayNumber)
        ? prev.filter(d => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

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

      const { error } = await supabase
        .from('trips')
        .update({
          itinerary_data: itineraryData,
          itinerary_status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId);

      if (error) throw error;
      if (onSave) await onSave(days);
      
      setHasChanges(false);
      toast.success('Itinerary saved!');
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

  const handleDayRegenerate = useCallback(async (dayIndex: number) => {
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

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* Trip Summary Bar */}
      <div className="py-6 border-b border-border">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{days.length} Days</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Travelers:</span>
            <span className="font-medium">{travelers} {travelers === 1 ? 'Guest' : 'Guests'}</span>
          </div>
          {style && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Style:</span>
              <span className="font-medium capitalize">{style}</span>
            </div>
          )}
          {pace && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Pace:</span>
              <span className="font-medium capitalize">{pace}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-4">
            {isEditable && hasChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
            <div>
              <span className="text-muted-foreground">Estimated Total:</span>
              <span className="text-2xl font-serif ml-2">${totalCost.toLocaleString()}</span>
            </div>
            {isEditable && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleOptimize} 
                  disabled={isOptimizing || days.length === 0} 
                  className="gap-2"
                >
                  {isOptimizing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                  {isOptimizing ? 'Optimizing...' : 'Optimize Routes & Prices'}
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !hasChanges} className="gap-2">
                  {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {[
            { id: 'itinerary', label: 'Day-by-Day Itinerary' },
            { id: 'overview', label: 'Flight & Hotel' },
            ...(destinationInfo?.overview ? [{ id: 'tips', label: 'Tips' }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "px-6 py-3 text-sm font-sans tracking-wide transition-colors relative",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
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
            {/* Airport Game Plan - Show before Day 1 */}
            {flightSelection?.outbound && (
              <AirportGamePlan 
                flightSelection={flightSelection} 
                hotelSelection={hotelSelection}
                destination={destination}
              />
            )}
            
            {days.map((day, dayIndex) => (
              <DayCard
                key={day.dayNumber}
                day={day}
                dayIndex={dayIndex}
                travelers={travelers}
                budgetTier={budgetTier}
                isExpanded={expandedDays.includes(day.dayNumber)}
                isRegenerating={regeneratingDay === day.dayNumber}
                isEditable={isEditable}
                onToggle={() => toggleDay(day.dayNumber)}
                onActivityLock={handleActivityLock}
                onActivityMove={handleActivityMove}
                onActivityRemove={handleActivityRemove}
                onDayLock={handleDayLock}
                onDayRegenerate={() => handleDayRegenerate(dayIndex)}
                onAddActivity={() => setAddActivityModal({ dayIndex })}
              />
            ))}
          </motion.div>
        )}

        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid lg:grid-cols-2 gap-6"
          >
            {/* Flight Info */}
            <Card className="bg-card border border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="h-4 w-4 text-primary" />
                  <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Flight</span>
                </div>
                {flightSelection?.outbound ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outbound</span>
                      <span className="font-medium">{flightSelection.outbound.departure?.date || startDate}</span>
                    </div>
                    {flightSelection.outbound.airline && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Airline</span>
                        <span className="font-medium">{flightSelection.outbound.airline} {flightSelection.outbound.flightNumber}</span>
                      </div>
                    )}
                    {flightSelection.return && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Return</span>
                        <span className="font-medium">{flightSelection.return.departure?.date || endDate}</span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-border flex justify-between">
                      <span className="font-medium">Flight Total</span>
                      <span className="font-serif text-lg">${flightCost.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No flight selected</p>
                )}
              </CardContent>
            </Card>

            {/* Hotel Info */}
            <Card className="bg-card border border-border overflow-hidden">
              {hotelSelection?.imageUrl && (
                <div className="relative overflow-hidden h-40">
                  <img
                    src={hotelSelection.imageUrl}
                    alt={hotelSelection.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Hotel className="h-4 w-4 text-primary" />
                  <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Accommodation</span>
                </div>
                {hotelSelection?.name ? (
                  <div className="space-y-3 text-sm">
                    <h3 className="font-serif text-lg">{hotelSelection.name}</h3>
                    {hotelSelection.type && (
                      <p className="text-muted-foreground">{hotelSelection.type}</p>
                    )}
                    {hotelSelection.rating && (
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500 fill-current" />
                        <span className="font-medium">{hotelSelection.rating}</span>
                        {hotelSelection.reviewCount && (
                          <span className="text-muted-foreground">({hotelSelection.reviewCount} reviews)</span>
                        )}
                      </div>
                    )}
                    <div className="pt-3 border-t border-border flex justify-between">
                      <span className="font-medium">{hotelSelection.nights || days.length} nights</span>
                      <span className="font-serif text-lg">${hotelCost.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No hotel selected</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'tips' && destinationInfo && (
          <motion.div
            key="tips"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {destinationInfo.overview && (
              <div>
                <h2 className="text-3xl font-serif mb-4">About {destination}</h2>
                <p className="text-muted-foreground font-sans leading-relaxed">{destinationInfo.overview}</p>
              </div>
            )}
            {destinationInfo.culturalNotes && (
              <div>
                <h3 className="text-xl font-serif mb-3">Cultural Notes</h3>
                <p className="text-muted-foreground">{destinationInfo.culturalNotes}</p>
              </div>
            )}
            {destinationInfo.tips && (
              <div>
                <h3 className="text-xl font-serif mb-3">Travel Tips</h3>
                <p className="text-muted-foreground">{destinationInfo.tips}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Activity Modal */}
      <AddActivityModal
        isOpen={!!addActivityModal}
        onClose={() => setAddActivityModal(null)}
        onAdd={(activity) => addActivityModal && handleAddActivity(addActivityModal.dayIndex, activity)}
      />
    </div>
  );
}

// =============================================================================
// AIRPORT GAME PLAN COMPONENT
// =============================================================================

interface AirportGamePlanProps {
  flightSelection: FlightSelection;
  hotelSelection?: HotelSelection | null;
  destination: string;
}

function AirportGamePlan({ flightSelection, hotelSelection, destination }: AirportGamePlanProps) {
  const outbound = flightSelection.outbound;
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
    
    // Format back
    const displayHours = hours % 12 || 12;
    const displayPeriod = hours >= 12 ? 'PM' : 'AM';
    return `${displayHours}:${String(finalMins).padStart(2, '0')} ${displayPeriod}`;
  };

  // Determine post-landing recommendation based on arrival time
  const getPostLandingAdvice = () => {
    if (!arrivalTime) return { action: 'Check in & explore', reason: 'Get settled and start exploring!' };
    
    const match = arrivalTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return { action: 'Check in & explore', reason: 'Get settled and start exploring!' };
    
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

  // Estimate airport to hotel transfer
  const getTransferEstimate = () => {
    // Generic estimates - in reality would use Google Maps API
    return {
      taxi: { duration: '30-45 min', cost: '$40-60' },
      shuttle: { duration: '45-60 min', cost: '$15-25' },
      train: { duration: '40-55 min', cost: '$10-15' },
      rideshare: { duration: '30-45 min', cost: '$35-55' },
    };
  };

  const recommendedArrival = getRecommendedAirportArrival();
  const postLanding = getPostLandingAdvice();
  const transfer = getTransferEstimate();

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-primary/20 bg-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-full">
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
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-amber-600" />
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
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-sm">You land at {arrivalTime} ({arrivalAirport})</p>
              <p className="text-xs text-muted-foreground">{postLanding.reason}</p>
            </div>
          </div>
        )}

        {/* Transfer Options */}
        {hotelSelection?.name && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Hotel className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Getting to {hotelSelection.name}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-xs p-2 bg-background rounded border">
                  <span className="font-medium">🚕 Taxi/Uber</span>
                  <p className="text-muted-foreground">{transfer.taxi.duration} • {transfer.taxi.cost}</p>
                </div>
                <div className="text-xs p-2 bg-background rounded border">
                  <span className="font-medium">🚆 Train/Metro</span>
                  <p className="text-muted-foreground">{transfer.train.duration} • {transfer.train.cost}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post-Landing Action */}
        <div className="flex items-start gap-3 pt-2 border-t border-primary/20">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-purple-600" />
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
  isExpanded: boolean;
  isRegenerating: boolean;
  isEditable: boolean;
  onToggle: () => void;
  onActivityLock: (dayIndex: number, activityId: string) => void;
  onActivityMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onActivityRemove: (dayIndex: number, activityId: string) => void;
  onDayLock: (dayIndex: number) => void;
  onDayRegenerate: () => void;
  onAddActivity: () => void;
}

function DayCard({
  day,
  dayIndex,
  travelers,
  budgetTier,
  isExpanded,
  isRegenerating,
  isEditable,
  onToggle,
  onActivityLock,
  onActivityMove,
  onActivityRemove,
  onDayLock,
  onDayRegenerate,
  onAddActivity,
}: DayCardProps) {
  const allLocked = day.activities.every(a => a.isLocked);
  const totalCost = getDayTotalCost(day.activities, travelers, budgetTier);

  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* Day Header - Editorial Style */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-serif text-muted-foreground/30">
              {String(day.dayNumber).padStart(2, '0')}
            </span>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-serif text-xl">{day.title || day.theme || `Day ${day.dayNumber}`}</h3>
                {day.date && (
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(day.date), 'EEEE, MMM d')}
                  </span>
                )}
              </div>
              {day.description && (
                <p className="text-sm text-muted-foreground">{day.description}</p>
              )}
            </div>
          </div>

          {/* Day Actions */}
          <div className="flex items-center gap-1">
            {totalCost > 0 && (
              <span className="text-sm font-medium mr-3">${totalCost.toLocaleString()}</span>
            )}
            {day.weather && (
              <div className="flex items-center gap-1 mr-3 text-sm text-muted-foreground">
                {weatherIcons[day.weather.condition?.toLowerCase() || 'sunny']}
                {day.weather.high && <span>{day.weather.high}°</span>}
              </div>
            )}
            {isEditable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDayLock(dayIndex)}
                  className="h-8 w-8"
                  title={allLocked ? 'Unlock Day' : 'Lock Day'}
                >
                  {allLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDayRegenerate}
                  disabled={isRegenerating}
                  className="h-8 w-8"
                  title="Regenerate Day"
                >
                  <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
                </Button>
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
                  dayIndex={dayIndex}
                  activityIndex={activityIndex}
                  totalActivities={day.activities.length}
                  isLast={activityIndex === day.activities.length - 1}
                  isEditable={isEditable}
                  travelers={travelers}
                  budgetTier={budgetTier}
                  onLock={onActivityLock}
                  onMove={onActivityMove}
                  onRemove={onActivityRemove}
                />
              ))}
            </div>

            {/* Day Footer */}
            <div className="px-6 py-4 bg-secondary/20 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-6 text-muted-foreground">
                  {day.estimatedWalkingTime && <span>Walking: {day.estimatedWalkingTime}</span>}
                  {day.estimatedDistance && <span>Distance: {day.estimatedDistance}</span>}
                </div>
                <div className="flex items-center gap-4">
                  {isEditable && (
                    <Button variant="outline" size="sm" onClick={onAddActivity} className="gap-1">
                      <Plus className="h-4 w-4" />
                      Add Activity
                    </Button>
                  )}
                  <span className="font-medium text-foreground">
                    Day Total: {totalCost > 0 ? `$${totalCost.toLocaleString()}` : 'Free'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// ACTIVITY ROW COMPONENT - Editorial Style
// =============================================================================

interface ActivityRowProps {
  activity: EditorialActivity;
  dayIndex: number;
  activityIndex: number;
  totalActivities: number;
  isLast: boolean;
  isEditable: boolean;
  travelers: number;
  budgetTier?: string;
  onLock: (dayIndex: number, activityId: string) => void;
  onMove: (dayIndex: number, activityId: string, direction: 'up' | 'down') => void;
  onRemove: (dayIndex: number, activityId: string) => void;
}

function ActivityRow({
  activity,
  dayIndex,
  activityIndex,
  totalActivities,
  isLast,
  isEditable,
  travelers,
  budgetTier,
  onLock,
  onMove,
  onRemove,
}: ActivityRowProps) {
  const activityType = getActivityType(activity);
  const style = activityStyles[activityType] || activityStyles.activity;
  const rating = getActivityRating(activity);
  const cost = getActivityCost(activity, travelers, budgetTier);
  const photo = getActivityPhoto(activity);
  const showPhoto = activityType !== 'transportation' && activityType !== 'transport' && photo;
  const time = activity.startTime || activity.time;

  return (
    <div className={cn("flex items-stretch", !isLast && "border-b border-border")}>
      {/* Time Column */}
      <div className="w-24 shrink-0 p-4 border-r border-border bg-secondary/10">
        <span className="text-sm font-sans">{formatTime(time)}</span>
        {activity.endTime && (
          <p className="text-xs text-muted-foreground mt-0.5">→ {formatTime(activity.endTime)}</p>
        )}
        {activity.duration && (
          <p className="text-xs text-muted-foreground mt-0.5">{activity.duration}</p>
        )}
      </div>

      {/* Photo Column (if available) */}
      {showPhoto && (
        <div className="w-24 h-24 shrink-0 border-r border-border">
          <img
            src={photo}
            alt={activity.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-muted-foreground">{style.icon}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{style.label}</span>
              {rating && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                </span>
              )}
            </div>
            <h4 className="font-medium text-foreground">{activity.title}</h4>
            {activity.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{activity.description}</p>
            )}
            {activity.location?.name && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {activity.location.name}
                {activity.location.address && activity.location.address !== activity.location.name && (
                  <span className="text-muted-foreground/70 truncate max-w-[200px]">
                    , {activity.location.address}
                  </span>
                )}
              </div>
            )}
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
                    <span>• ~${activity.transportation.estimatedCost.amount}</span>
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
            <span className="font-medium">{formatCurrency(cost)}</span>
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

export default EditorialItinerary;
