/**
 * Trip Budget Service
 * 
 * Core budget logic for tracking, allocation, and validation.
 * Works with the trip_budget_ledger table and budget fields on trips.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export type BudgetCategory = 'hotel' | 'flight' | 'food' | 'activities' | 'transit' | 'misc';
export type EntryType = 'committed' | 'planned' | 'adjustment';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type BudgetInputMode = 'total' | 'per_person';
export type WarningThreshold = 'yellow' | 'red_only' | 'off';
export type BudgetStatus = 'under' | 'on_track' | 'yellow' | 'red';

export interface BudgetAllocations {
  food_percent: number;
  activities_percent: number;
  transit_percent: number;
  misc_percent: number;
  buffer_percent: number;
}

export interface TripBudgetSettings {
  budget_total_cents: number | null;
  budget_currency: string;
  budget_input_mode: BudgetInputMode;
  budget_include_hotel: boolean;
  budget_include_flight: boolean;
  budget_warnings_enabled: boolean;
  budget_warning_threshold: WarningThreshold;
  budget_allocations: BudgetAllocations;
  travelers: number;
}

export interface BudgetLedgerEntry {
  id: string;
  trip_id: string;
  category: BudgetCategory;
  entry_type: EntryType;
  amount_cents: number;
  currency: string;
  description: string | null;
  day_number: number | null;
  activity_id: string | null;
  external_booking_id: string | null;
  confidence: ConfidenceLevel;
  created_at: string;
  updated_at: string;
}

export interface BudgetSummary {
  tripId: string;
  budgetTotalCents: number;
  budgetPerPersonCents: number;
  currency: string;
  travelers: number;
  
  // Committed (booked/purchased)
  committedHotelCents: number;
  committedFlightCents: number;
  committedOtherCents: number;
  totalCommittedCents: number;
  
  // Planned (itinerary estimates)
  plannedTotalCents: number;
  plannedFoodCents: number;
  plannedActivitiesCents: number;
  plannedTransitCents: number;
  
  // Calculated
  remainingCents: number;
  remainingPerPersonCents: number;
  usedPercent: number;
  status: BudgetStatus;
  
  // Day breakdown
  dailyTargetCents: number;
  dayBreakdown?: DayBudget[];
}

export interface DayBudget {
  dayNumber: number;
  date: string;
  plannedCents: number;
  committedCents: number;
  targetCents: number;
  isSplurgeDay: boolean;
  status: BudgetStatus;
  categories: {
    food: number;
    activities: number;
    transit: number;
    misc: number;
  };
}

export interface CategoryAllocation {
  category: BudgetCategory;
  allocatedCents: number;
  usedCents: number;
  remainingCents: number;
  percent: number;
}

// =============================================================================
// DEFAULT ALLOCATIONS BY SPEND STYLE
// =============================================================================

export const DEFAULT_ALLOCATIONS: Record<string, BudgetAllocations> = {
  value_focused: {
    food_percent: 30,
    activities_percent: 25,
    transit_percent: 10,
    misc_percent: 5,
    buffer_percent: 30,
  },
  balanced: {
    food_percent: 30,
    activities_percent: 30,
    transit_percent: 10,
    misc_percent: 5,
    buffer_percent: 25,
  },
  splurge_forward: {
    food_percent: 35,
    activities_percent: 35,
    transit_percent: 10,
    misc_percent: 5,
    buffer_percent: 15,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate budget status based on usage
 */
export function calculateBudgetStatus(usedPercent: number): BudgetStatus {
  if (usedPercent >= 115) return 'red';
  if (usedPercent >= 105) return 'yellow';
  if (usedPercent >= 95) return 'on_track';
  return 'under';
}

/**
 * Get default allocations based on spend style and preferences
 */
export function getDefaultAllocations(
  spendStyle: 'value_focused' | 'balanced' | 'splurge_forward' = 'balanced',
  preferences?: { foodie?: boolean; adventurous?: boolean }
): BudgetAllocations {
  const base = { ...DEFAULT_ALLOCATIONS[spendStyle] };
  
  // Adjust based on preferences
  if (preferences?.foodie) {
    base.food_percent += 5;
    base.buffer_percent -= 5;
  }
  if (preferences?.adventurous) {
    base.activities_percent += 5;
    base.buffer_percent -= 5;
  }
  
  return base;
}

/**
 * Calculate daily target based on total and trip length
 */
export function calculateDailyTarget(
  remainingCents: number,
  totalDays: number,
  splurgeDays: number[] = []
): { baseline: number; splurge: number; recovery: number } {
  if (totalDays <= 0) return { baseline: 0, splurge: 0, recovery: 0 };
  
  const baseline = Math.round(remainingCents / totalDays);
  const splurgeMultiplier = 1.35; // +35% for splurge days
  const splurge = Math.round(baseline * splurgeMultiplier);
  
  // Calculate recovery needed to compensate for splurge days
  const splurgeDayCount = splurgeDays.length;
  const splurgeExcess = splurgeDayCount * (splurge - baseline);
  const regularDayCount = totalDays - splurgeDayCount;
  const recovery = regularDayCount > 0 
    ? Math.round(baseline - (splurgeExcess / regularDayCount))
    : baseline;
  
  return { baseline, splurge, recovery };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get budget settings for a trip
 */
export async function getTripBudgetSettings(tripId: string): Promise<TripBudgetSettings | null> {
  const { data, error } = await supabase
    .from('trips')
    .select(`
      budget_total_cents,
      budget_currency,
      budget_input_mode,
      budget_include_hotel,
      budget_include_flight,
      budget_warnings_enabled,
      budget_warning_threshold,
      budget_allocations,
      travelers
    `)
    .eq('id', tripId)
    .single();
  
  if (error || !data) {
    console.error('[BudgetService] Error fetching settings:', error);
    return null;
  }
  
  return {
    budget_total_cents: data.budget_total_cents,
    budget_currency: data.budget_currency || 'USD',
    budget_input_mode: (data.budget_input_mode as BudgetInputMode) || 'total',
    budget_include_hotel: data.budget_include_hotel ?? true,
    budget_include_flight: data.budget_include_flight ?? false,
    budget_warnings_enabled: data.budget_warnings_enabled ?? true,
    budget_warning_threshold: (data.budget_warning_threshold as WarningThreshold) || 'yellow',
    budget_allocations: (data.budget_allocations as unknown as BudgetAllocations) || DEFAULT_ALLOCATIONS.balanced,
    travelers: data.travelers || 1,
  };
}

/**
 * Update budget settings for a trip
 */
export async function updateTripBudgetSettings(
  tripId: string,
  settings: Partial<TripBudgetSettings>
): Promise<boolean> {
  // Build update object, casting allocations to avoid TS/JSON type issues
  const updateData: Record<string, unknown> = {};
  if (settings.budget_total_cents !== undefined) updateData.budget_total_cents = settings.budget_total_cents;
  if (settings.budget_currency !== undefined) updateData.budget_currency = settings.budget_currency;
  if (settings.budget_input_mode !== undefined) updateData.budget_input_mode = settings.budget_input_mode;
  if (settings.budget_include_hotel !== undefined) updateData.budget_include_hotel = settings.budget_include_hotel;
  if (settings.budget_include_flight !== undefined) updateData.budget_include_flight = settings.budget_include_flight;
  if (settings.budget_warnings_enabled !== undefined) updateData.budget_warnings_enabled = settings.budget_warnings_enabled;
  if (settings.budget_warning_threshold !== undefined) updateData.budget_warning_threshold = settings.budget_warning_threshold;
  if (settings.budget_allocations !== undefined) updateData.budget_allocations = settings.budget_allocations;
  if ((settings as any).budget_individual_cents !== undefined) updateData.budget_individual_cents = (settings as any).budget_individual_cents;

  const { error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', tripId);
  
  if (error) {
    console.error('[BudgetService] Error updating settings:', error);
    return false;
  }
  
  return true;
}

/**
 * Get budget ledger entries for a trip
 */
export async function getBudgetLedger(tripId: string): Promise<BudgetLedgerEntry[]> {
  const { data, error } = await supabase
    .from('trip_budget_ledger')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('[BudgetService] Error fetching ledger:', error);
    return [];
  }
  
  return data as BudgetLedgerEntry[];
}

/**
 * Add a budget ledger entry
 */
export async function addLedgerEntry(
  entry: Omit<BudgetLedgerEntry, 'id' | 'created_at' | 'updated_at'>
): Promise<BudgetLedgerEntry | null> {
  const { data, error } = await supabase
    .from('trip_budget_ledger')
    .insert(entry)
    .select()
    .single();
  
  if (error) {
    console.error('[BudgetService] Error adding entry:', error);
    return null;
  }
  
  return data as BudgetLedgerEntry;
}

/**
 * Update a ledger entry
 */
export async function updateLedgerEntry(
  entryId: string,
  updates: Partial<BudgetLedgerEntry>
): Promise<boolean> {
  const { error } = await supabase
    .from('trip_budget_ledger')
    .update(updates)
    .eq('id', entryId);
  
  if (error) {
    console.error('[BudgetService] Error updating entry:', error);
    return false;
  }
  
  return true;
}

/**
 * Delete a ledger entry
 */
export async function deleteLedgerEntry(entryId: string): Promise<boolean> {
  const { error } = await supabase
    .from('trip_budget_ledger')
    .delete()
    .eq('id', entryId);
  
  if (error) {
    console.error('[BudgetService] Error deleting entry:', error);
    return false;
  }
  
  return true;
}

/**
 * Get full budget summary for a trip
 */
export async function getBudgetSummary(tripId: string, totalDays?: number): Promise<BudgetSummary | null> {
  // Get settings
  const settings = await getTripBudgetSettings(tripId);
  if (!settings || !settings.budget_total_cents || settings.budget_total_cents <= 0) {
    return null;
  }
  
  // Get ledger entries
  const ledger = await getBudgetLedger(tripId);
  
  // Calculate committed amounts
  let committedHotel = 0;
  let committedFlight = 0;
  let committedOther = 0;
  let plannedFood = 0;
  let plannedActivities = 0;
  let plannedTransit = 0;
  let plannedTotal = 0;
  
  for (const entry of ledger) {
    if (entry.entry_type === 'committed') {
      if (entry.category === 'hotel') committedHotel += entry.amount_cents;
      else if (entry.category === 'flight') committedFlight += entry.amount_cents;
      else committedOther += entry.amount_cents;
    } else if (entry.entry_type === 'planned') {
      plannedTotal += entry.amount_cents;
      if (entry.category === 'food') plannedFood += entry.amount_cents;
      else if (entry.category === 'activities') plannedActivities += entry.amount_cents;
      else if (entry.category === 'transit') plannedTransit += entry.amount_cents;
    }
  }
  
  // Calculate total committed (respecting include flags)
  let totalCommitted = committedOther;
  if (settings.budget_include_hotel) totalCommitted += committedHotel;
  if (settings.budget_include_flight) totalCommitted += committedFlight;
  
  // Include planned amounts in the used total so budget reflects itinerary estimates
  const totalUsed = totalCommitted + plannedTotal;
  
  // Calculate remaining based on committed + planned (with NaN guard)
  const budgetTotal = settings.budget_total_cents || 0;
  const remaining = budgetTotal - totalUsed;
  const usedPercent = budgetTotal > 0 ? (totalUsed / budgetTotal) * 100 : 0;
  
  // Calculate daily target
  const days = totalDays || 7;
  const dailyTarget = calculateDailyTarget(remaining, days);
  
  return {
    tripId,
    budgetTotalCents: settings.budget_total_cents,
    budgetPerPersonCents: Math.round(settings.budget_total_cents / settings.travelers),
    currency: settings.budget_currency,
    travelers: settings.travelers,
    
    committedHotelCents: committedHotel,
    committedFlightCents: committedFlight,
    committedOtherCents: committedOther,
    totalCommittedCents: totalCommitted,
    
    plannedTotalCents: plannedTotal,
    plannedFoodCents: plannedFood,
    plannedActivitiesCents: plannedActivities,
    plannedTransitCents: plannedTransit,
    
    remainingCents: remaining,
    remainingPerPersonCents: Math.round(remaining / settings.travelers),
    usedPercent,
    status: calculateBudgetStatus(usedPercent),
    
    dailyTargetCents: dailyTarget.baseline,
  };
}

/**
 * Sync itinerary costs to budget ledger
 * Called after itinerary generation or updates
 */
export async function syncItineraryToBudget(
  tripId: string,
  days: Array<{
    dayNumber: number;
    date: string;
    activities: Array<{
      id: string;
      title: string;
      category: string;
      cost?: { amount?: number; total?: number; perPerson?: number; currency?: string } | number;
    }>;
  }>,
  travelers: number = 1
): Promise<boolean> {
  // First, delete all existing planned entries for this trip
  const { error: deleteError } = await supabase
    .from('trip_budget_ledger')
    .delete()
    .eq('trip_id', tripId)
    .eq('entry_type', 'planned');
  
  if (deleteError) {
    console.error('[BudgetService] Error clearing planned entries:', deleteError);
    return false;
  }
  
  // Insert new planned entries from itinerary
  const entries: Array<Omit<BudgetLedgerEntry, 'id' | 'created_at' | 'updated_at'>> = [];
  
  for (const day of days) {
    for (const activity of day.activities) {
      const rawCost = activity.cost;
      // Determine cost amount and whether it's already a group total
      let costAmount: number;
      let isGroupTotal = false;
      if (typeof rawCost === 'number') {
        costAmount = rawCost;
      } else if (rawCost?.total) {
        costAmount = rawCost.total;
        isGroupTotal = true; // .total already accounts for all travelers
      } else {
        costAmount = rawCost?.amount || rawCost?.perPerson || 0;
      }
      if (costAmount > 0) {
        // Skip non-payable activities (free time, downtime, transfers)
        const titleLower = (activity.title || '').toLowerCase();
        const catLower = (activity.category || '').toLowerCase();
        const isNonPayable = ['free time', 'downtime', 'leisure time', 'at leisure', 'rest', 'sleep',
          'check-in', 'check-out', 'checkin', 'checkout', 'packing'].some(kw => titleLower.includes(kw)) ||
          ['downtime', 'free_time'].includes(catLower);
        if (isNonPayable) continue;

        // Map activity category to budget category
        let budgetCategory: BudgetCategory = 'activities';
        
        if (catLower.includes('food') || catLower.includes('dining') || catLower.includes('restaurant') || catLower.includes('meal')) {
          budgetCategory = 'food';
        } else if (catLower.includes('transport') || catLower.includes('transfer')) {
          budgetCategory = 'transit';
        } else if (catLower.includes('hotel') || catLower.includes('lodging') || catLower.includes('accommodation')) {
          budgetCategory = 'hotel';
        }
        
        // Multiply per-person costs by traveler count; skip if already a group total
        const baseCents = Math.round(costAmount * 100);
        const totalCents = isGroupTotal ? baseCents : baseCents * Math.max(travelers, 1);
        
        entries.push({
          trip_id: tripId,
          category: budgetCategory,
          entry_type: 'planned',
          amount_cents: totalCents,
          currency: (typeof rawCost === 'object' && rawCost?.currency) ? rawCost.currency : 'USD',
          description: activity.title,
          day_number: day.dayNumber,
          activity_id: activity.id,
          external_booking_id: null,
          confidence: 'medium',
        });
      }
    }
  }
  
  if (entries.length > 0) {
    const { error: insertError } = await supabase
      .from('trip_budget_ledger')
      .insert(entries);
    
    if (insertError) {
      console.error('[BudgetService] Error inserting planned entries:', insertError);
      return false;
    }
  }
  
  console.log(`[BudgetService] Synced ${entries.length} planned entries for trip ${tripId}`);
  return true;
}

/**
 * Record a committed expense (booking/purchase)
 */
export async function recordCommittedExpense(
  tripId: string,
  category: BudgetCategory,
  amountCents: number,
  description: string,
  externalBookingId?: string,
  dayNumber?: number
): Promise<BudgetLedgerEntry | null> {
  return addLedgerEntry({
    trip_id: tripId,
    category,
    entry_type: 'committed',
    amount_cents: amountCents,
    currency: 'USD',
    description,
    day_number: dayNumber || null,
    activity_id: null,
    external_booking_id: externalBookingId || null,
    confidence: 'high',
  });
}

/**
 * Get category allocations with usage
 */
export async function getCategoryAllocations(tripId: string): Promise<CategoryAllocation[]> {
  const settings = await getTripBudgetSettings(tripId);
  const summary = await getBudgetSummary(tripId);
  
  if (!settings || !summary) return [];
  
  const remaining = summary.remainingCents;
  const allocations = settings.budget_allocations;
  
  const budgetTotal = summary.budgetTotalCents || 0;
  const result: CategoryAllocation[] = [];

  // Add hotel/flight as committed categories when included
  if (settings.budget_include_hotel && summary.committedHotelCents > 0) {
    const hotelPercent = budgetTotal > 0 ? Math.round((summary.committedHotelCents / budgetTotal) * 100) : 0;
    result.push({
      category: 'hotel',
      allocatedCents: summary.committedHotelCents,
      usedCents: summary.committedHotelCents,
      remainingCents: 0,
      percent: hotelPercent,
    });
  }

  if (settings.budget_include_flight && summary.committedFlightCents > 0) {
    const flightPercent = budgetTotal > 0 ? Math.round((summary.committedFlightCents / budgetTotal) * 100) : 0;
    result.push({
      category: 'flight',
      allocatedCents: summary.committedFlightCents,
      usedCents: summary.committedFlightCents,
      remainingCents: 0,
      percent: flightPercent,
    });
  }

  // Discretionary categories use remaining budget after committed costs
  const safeRemaining = Math.max(remaining, 0);
  result.push(
    {
      category: 'food',
      allocatedCents: Math.round(safeRemaining * (allocations.food_percent / 100)),
      usedCents: summary.plannedFoodCents,
      remainingCents: Math.round(safeRemaining * (allocations.food_percent / 100)) - summary.plannedFoodCents,
      percent: allocations.food_percent,
    },
    {
      category: 'activities',
      allocatedCents: Math.round(safeRemaining * (allocations.activities_percent / 100)),
      usedCents: summary.plannedActivitiesCents,
      remainingCents: Math.round(safeRemaining * (allocations.activities_percent / 100)) - summary.plannedActivitiesCents,
      percent: allocations.activities_percent,
    },
    {
      category: 'transit',
      allocatedCents: Math.round(safeRemaining * (allocations.transit_percent / 100)),
      usedCents: summary.plannedTransitCents,
      remainingCents: Math.round(safeRemaining * (allocations.transit_percent / 100)) - summary.plannedTransitCents,
      percent: allocations.transit_percent,
    },
    {
      category: 'misc',
      allocatedCents: Math.round(safeRemaining * (allocations.misc_percent / 100)),
      usedCents: 0,
      remainingCents: Math.round(safeRemaining * (allocations.misc_percent / 100)),
      percent: allocations.misc_percent,
    },
  );

  return result;
}

// =============================================================================
// MULTI-CITY BUDGET BREAKDOWN
// =============================================================================

export interface CityBudget {
  cityId: string;
  cityName: string;
  cityOrder: number;
  nights: number;
  allocatedBudgetCents: number;
  spentCents: number;
  remainingCents: number;
  breakdown: {
    hotel: number;
    activities: number;
    dining: number;
    transport: number;
    misc: number;
  };
}

/**
 * Get budget breakdown by city for multi-city trips.
 * Returns null for single-city trips (0 or 1 city rows).
 */
export async function getCityBudgetBreakdown(tripId: string): Promise<CityBudget[] | null> {
  const { data: cities } = await supabase
    .from('trip_cities')
    .select('id, city_name, city_order, nights, allocated_budget_cents, activity_cost_cents, dining_cost_cents, hotel_cost_cents, transport_cost_cents, misc_cost_cents, total_cost_cents')
    .eq('trip_id', tripId)
    .order('city_order', { ascending: true });

  if (!cities || cities.length <= 1) return null;

  return (cities as any[]).map(city => ({
    cityId: city.id,
    cityName: city.city_name,
    cityOrder: city.city_order,
    nights: city.nights || 0,
    allocatedBudgetCents: city.allocated_budget_cents || 0,
    spentCents: city.total_cost_cents || 0,
    remainingCents: (city.allocated_budget_cents || 0) - (city.total_cost_cents || 0),
    breakdown: {
      hotel: city.hotel_cost_cents || 0,
      activities: city.activity_cost_cents || 0,
      dining: city.dining_cost_cents || 0,
      transport: city.transport_cost_cents || 0,
      misc: city.misc_cost_cents || 0,
    },
  }));
}
