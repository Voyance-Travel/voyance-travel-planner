/**
 * Trip Budget Service
 * 
 * Core budget logic for tracking, allocation, and validation.
 * Reads ALL cost data from activity_costs table (single source of truth).
 * Budget settings stored on trips table.
 */

import { supabase } from '@/integrations/supabase/client';
import { resolveCategory } from '@/lib/trip-pricing';

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
  /**
   * Categories the Budget Coach must never propose swaps for. `null` means
   * never set — the UI seeds defaults from trip DNA. Empty array means the
   * user explicitly cleared all protections (do not re-seed).
   */
  coach_protected_categories: string[] | null;
}

/**
 * Shared inclusion rule for activity_costs rows.
 * MUST be used by every total-computing code path so the snapshot, the
 * summary, and the ledger never disagree on which rows to count.
 *
 * Rule: a row tagged hotel/flight is excluded entirely when its corresponding
 * inclusion toggle is off — regardless of day_number. (Previously the
 * snapshot only excluded day_number=0 logistics rows, while the summary
 * excluded all hotel rows; that mismatch was the second source of drift.)
 */
export function shouldCountRow(
  row: { category?: string | null },
  includeHotel: boolean,
  includeFlight: boolean,
): boolean {
  const cat = (row.category || '').toLowerCase();
  if (cat === 'hotel' && !includeHotel) return false;
  if ((cat === 'flight' || cat === 'flights') && !includeFlight) return false;
  return true;
}

/**
 * A ledger entry derived from activity_costs.
 * This replaces the old trip_budget_ledger-backed type.
 */
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
  plannedMiscCents: number;
  
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
  /** 'fixed' = hotel/flight (not part of spend-style allocation); 'discretionary' = food/activities/transit/misc. */
  kind?: 'fixed' | 'discretionary';
  /** True when a fixed cost exceeds the entire trip budget total. */
  exceedsBudget?: boolean;
  /** For fixed rows: committed / budgetTotal as a percent, clamped to 100. */
  shareOfBudgetPercent?: number;
  /** True on every discretionary row when fixed costs have absorbed the full budget. */
  discretionaryUnderwater?: boolean;
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
  const splurgeMultiplier = 1.35;
  const splurge = Math.round(baseline * splurgeMultiplier);
  
  const splurgeDayCount = splurgeDays.length;
  const splurgeExcess = splurgeDayCount * (splurge - baseline);
  const regularDayCount = totalDays - splurgeDayCount;
  const recovery = regularDayCount > 0 
    ? Math.round(baseline - (splurgeExcess / regularDayCount))
    : baseline;
  
  return { baseline, splurge, recovery };
}

/** Check if an allocations object has valid numeric keys (not an empty {}) */
export function isValidAllocations(a: unknown): a is BudgetAllocations {
  return !!a && typeof (a as any).food_percent === 'number' && typeof (a as any).activities_percent === 'number';
}

/**
 * Map an activity_costs category to a BudgetCategory.
 */
function toBudgetCategory(raw: string): BudgetCategory {
  const cat = (raw || '').toLowerCase();
  if (cat === 'hotel' || cat === 'accommodation') return 'hotel';
  if (cat === 'flight') return 'flight';
  if (['food', 'dining', 'restaurant', 'meal', 'breakfast', 'lunch', 'dinner', 'cafe', 'coffee'].includes(cat)) return 'food';
  if (['transport', 'transit', 'transfer', 'taxi'].includes(cat)) return 'transit';
  if (['nightlife', 'bar', 'club', 'shopping', 'misc'].includes(cat)) return 'misc';
  return 'activities';
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
      travelers,
      coach_protected_categories
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
    budget_allocations: isValidAllocations(data.budget_allocations) ? (data.budget_allocations as unknown as BudgetAllocations) : DEFAULT_ALLOCATIONS.balanced,
    travelers: data.travelers || 1,
    coach_protected_categories: (data as any).coach_protected_categories ?? null,
  };
}

/**
 * Update budget settings for a trip
 */
export async function updateTripBudgetSettings(
  tripId: string,
  settings: Partial<TripBudgetSettings>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (settings.budget_total_cents !== undefined) updateData.budget_total_cents = settings.budget_total_cents;
  if (settings.budget_currency !== undefined) updateData.budget_currency = settings.budget_currency;
  if (settings.budget_input_mode !== undefined) updateData.budget_input_mode = settings.budget_input_mode;
  if (settings.budget_include_hotel !== undefined) updateData.budget_include_hotel = settings.budget_include_hotel;
  if (settings.budget_include_flight !== undefined) updateData.budget_include_flight = settings.budget_include_flight;
  if (settings.budget_warnings_enabled !== undefined) updateData.budget_warnings_enabled = settings.budget_warnings_enabled;
  if (settings.budget_warning_threshold !== undefined) updateData.budget_warning_threshold = settings.budget_warning_threshold;
  if (settings.budget_allocations !== undefined) updateData.budget_allocations = settings.budget_allocations;
  if (settings.coach_protected_categories !== undefined) updateData.coach_protected_categories = settings.coach_protected_categories;
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
 * Get budget ledger entries for a trip — now reads from activity_costs (single source of truth).
 * Maps activity_costs rows to the BudgetLedgerEntry interface for UI compatibility.
 */
export async function getBudgetLedger(tripId: string): Promise<BudgetLedgerEntry[]> {
  const [costsResult, totalResult, tripResult] = await Promise.all([
    supabase
      .from('activity_costs')
      .select('*')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('v_trip_total')
      .select('total_all_travelers_usd')
      .eq('trip_id', tripId)
      .maybeSingle(),
    supabase
      .from('trips')
      .select('itinerary_data, hotel_selection, flight_selection')
      .eq('id', tripId)
      .maybeSingle(),
  ]);

  if (costsResult.error) {
    console.error('[BudgetService] Error fetching ledger from activity_costs:', costsResult.error);
    return [];
  }

  // Build activity_id → display-name map from the trip's itinerary so we
  // can show real titles instead of raw category enums.
  const nameById = new Map<string, string>();
  const days = ((tripResult.data as any)?.itinerary_data?.days) || [];
  for (const day of days) {
    for (const a of (day?.activities || [])) {
      if (a?.id) {
        const n = (a.title || a.name || '').toString().trim();
        if (n) nameById.set(String(a.id), n);
      }
    }
  }
  const hotelSel: any = (tripResult.data as any)?.hotel_selection;
  const flightSel: any = (tripResult.data as any)?.flight_selection;
  const hotelName: string | undefined = hotelSel?.name || hotelSel?.hotel?.name;
  const flightAirline: string | undefined =
    flightSel?.outbound?.airline || flightSel?.legs?.[0]?.airline || flightSel?.airline;

  // Strip internal pipeline tags like "[Free venue - Tier 1]",
  // "[Repair auto-corrected]", "[Auto-corrected from $X, …]",
  // "[User override: …]" before the notes string is ever shown.
  const sanitizeNotes = (raw: unknown): string => {
    if (typeof raw !== 'string') return '';
    return raw.replace(/\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim();
  };

  // Friendly nouns for the "category (Day N)" fallback so users don't see
  // raw schema like "dining (Day 1)" or "transport (Day 2)".
  const CATEGORY_LABEL: Record<string, string> = {
    dining: 'Meal',
    food: 'Meal',
    activity: 'Activity',
    cultural: 'Activity',
    museum: 'Museum',
    tour: 'Tour',
    transport: 'Local transit',
    transportation: 'Local transit',
    transit: 'Local transit',
    transfer: 'Transfer',
    taxi: 'Taxi',
    hotel: 'Accommodation',
    accommodation: 'Accommodation',
    flight: 'Flight',
    nightlife: 'Nightlife',
    shopping: 'Shopping',
    wellness: 'Wellness',
    other: 'Item',
  };
  const prettyCategory = (cat: string): string => {
    const k = (cat || '').toLowerCase();
    return CATEGORY_LABEL[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Item');
  };

  const rawEntries: BudgetLedgerEntry[] = (costsResult.data || []).map((row: any) => {
    let costPerPerson = Number(row.cost_per_person_usd) || 0;
    const numTravelers = Number(row.num_travelers) || 1;

    // Read-time guard: any row tagged "Free venue" must report $0, even if
    // the underlying DB row is corrupted. Belt-and-suspenders alongside the
    // DB trigger and the edge-function write guard.
    const noteStr = (row.notes || '').toLowerCase();
    if (noteStr.includes('free venue') && costPerPerson !== 0) {
      console.warn(`[BudgetService] Free-venue row ${row.id} has non-zero cost $${costPerPerson} — coercing to $0 at read time`);
      costPerPerson = 0;
    }

    const totalCents = Math.round(costPerPerson * numTravelers * 100);
    const isPaid = row.is_paid === true;
    const isLogistics = row.source === 'logistics-sync';

    // Resolve a human description in priority order:
    //   1. Activity title from the itinerary JSON
    //   2. Hotel name / "Flight (Airline)" for day-0 logistics rows
    //   3. Sanitized notes (with bracketed pipeline tags stripped)
    //   4. Friendly category label + "(Day N)"
    const cat = (row.category || '').toLowerCase();
    let description = (row.activity_id && nameById.get(String(row.activity_id))) || '';
    if (!description && cat === 'hotel' && hotelName) description = hotelName;
    if (!description && cat === 'flight' && flightAirline) description = `Flight (${flightAirline})`;
    if (!description) {
      const cleaned = sanitizeNotes(row.notes);
      if (cleaned) description = cleaned;
    }
    if (!description) {
      description = `${prettyCategory(cat)}${row.day_number != null ? ` (Day ${row.day_number})` : ''}`;
    }

    return {
      id: row.id,
      trip_id: row.trip_id,
      category: toBudgetCategory(row.category),
      entry_type: (isPaid || isLogistics ? 'committed' : 'planned') as EntryType,
      amount_cents: totalCents,
      currency: 'USD',
      description,
      day_number: row.day_number,
      activity_id: row.activity_id,
      external_booking_id: null,
      confidence: (row.confidence || 'medium') as ConfidenceLevel,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    };
  });

  // Collapse exact duplicates (same day + category + amount + description).
  // Repair passes occasionally write twin transit rows on a single day; surfacing
  // both as identical line items just confuses the user.
  const dedupKey = (e: BudgetLedgerEntry) =>
    `${e.day_number}|${e.category}|${e.amount_cents}|${e.description.toLowerCase()}`;
  const seen = new Set<string>();
  const entries: BudgetLedgerEntry[] = [];
  for (const e of rawEntries) {
    const k = dedupKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    entries.push(e);
  }

  // Largest-remainder adjustment: ensure ledger item sum matches a canonical total.
  // Prefer the v_trip_total view, but fall back to the raw activity_costs sum
  // if the view is missing/stale. This guarantees the ledger is ALWAYS reconciled,
  // which prevents per-category drift between renders (Food $1,749 → $1,999, etc.).
  if (entries.length > 0) {
    const rawSum = entries.reduce((s, e) => s + e.amount_cents, 0);
    let canonicalCents: number | null = null;
    if (totalResult.data && totalResult.data.total_all_travelers_usd != null) {
      canonicalCents = Math.round((Number(totalResult.data.total_all_travelers_usd) || 0) * 100);
    }
    // If the view disagrees by more than the rounding tolerance, treat it as stale
    // and use the freshly-summed activity_costs as the canonical total instead.
    if (canonicalCents == null || Math.abs(canonicalCents - rawSum) > entries.length) {
      canonicalCents = rawSum;
    }
    const diff = canonicalCents - rawSum;
    if (diff !== 0) {
      let largestIdx = 0;
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].amount_cents > entries[largestIdx].amount_cents) largestIdx = i;
      }
      entries[largestIdx].amount_cents += diff;
    }
  }

  return entries;
}

/**
 * Delete a ledger entry — deletes from activity_costs.
 */
export async function deleteLedgerEntry(entryId: string): Promise<boolean> {
  const { error } = await supabase
    .from('activity_costs')
    .delete()
    .eq('id', entryId);
  
  if (error) {
    console.error('[BudgetService] Error deleting entry:', error);
    return false;
  }
  
  return true;
}

/**
 * Get full budget summary for a trip — derived from activity_costs.
 */
export async function getBudgetSummary(tripId: string, totalDays?: number): Promise<BudgetSummary | null> {
  const settings = await getTripBudgetSettings(tripId);
  if (!settings || !settings.budget_total_cents || settings.budget_total_cents <= 0) {
    return null;
  }
  
  // Read from activity_costs directly
  const ledger = await getBudgetLedger(tripId);
  
  let committedHotel = 0;
  let committedFlight = 0;
  let committedOther = 0;
  let plannedFood = 0;
  let plannedActivities = 0;
  let plannedTransit = 0;
  let plannedMisc = 0;
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
      else if (entry.category === 'misc') plannedMisc += entry.amount_cents;
    }
  }
  
  let totalCommitted = committedOther;
  if (settings.budget_include_hotel) totalCommitted += committedHotel;
  if (settings.budget_include_flight) totalCommitted += committedFlight;
  
  const totalUsed = totalCommitted + plannedTotal;
  const budgetTotal = settings.budget_total_cents || 0;
  const remaining = budgetTotal - totalUsed;
  const usedPercent = budgetTotal > 0 ? (totalUsed / budgetTotal) * 100 : 0;
  
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
    plannedMiscCents: plannedMisc,
    
    remainingCents: remaining,
    remainingPerPersonCents: Math.round(remaining / settings.travelers),
    usedPercent,
    status: calculateBudgetStatus(usedPercent),
    
    dailyTargetCents: dailyTarget.baseline,
  };
}

/**
 * Record a committed expense as an activity_costs row.
 */
export async function recordCommittedExpense(
  tripId: string,
  category: BudgetCategory,
  amountCents: number,
  description: string,
  externalBookingId?: string,
  dayNumber?: number
): Promise<BudgetLedgerEntry | null> {
  const costPerPersonUsd = amountCents / 100; // Store as dollars in activity_costs
  const activityId = externalBookingId || `manual-${Date.now()}`;
  
  const { data, error } = await supabase
    .from('activity_costs')
    .insert({
      trip_id: tripId,
      activity_id: activityId,
      day_number: dayNumber || 0,
      category,
      cost_per_person_usd: costPerPersonUsd,
      num_travelers: 1,
      source: 'manual',
      confidence: 'high',
      is_paid: true,
      notes: description,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[BudgetService] Error recording expense:', error);
    return null;
  }
  
  // Return in BudgetLedgerEntry shape
  return {
    id: (data as any).id,
    trip_id: tripId,
    category,
    entry_type: 'committed',
    amount_cents: amountCents,
    currency: 'USD',
    description,
    day_number: dayNumber || null,
    activity_id: activityId,
    external_booking_id: externalBookingId || null,
    confidence: 'high',
    created_at: (data as any).created_at || new Date().toISOString(),
    updated_at: (data as any).updated_at || new Date().toISOString(),
  };
}

/**
 * Get category allocations with usage — derived from activity_costs.
 */
export async function getCategoryAllocations(tripId: string): Promise<CategoryAllocation[]> {
  const settings = await getTripBudgetSettings(tripId);
  const summary = await getBudgetSummary(tripId);

  if (!settings || !summary) return [];

  const allocations = settings.budget_allocations;
  const budgetTotal = summary.budgetTotalCents || 0;
  const result: CategoryAllocation[] = [];

  if (settings.budget_include_hotel && summary.committedHotelCents > 0) {
    const rawShare = budgetTotal > 0 ? (summary.committedHotelCents / budgetTotal) * 100 : 0;
    const sharePct = Math.min(100, Math.round(rawShare));
    result.push({
      category: 'hotel',
      allocatedCents: summary.committedHotelCents,
      usedCents: summary.committedHotelCents,
      remainingCents: 0,
      percent: 0,
      kind: 'fixed',
      exceedsBudget: budgetTotal > 0 && summary.committedHotelCents > budgetTotal,
      shareOfBudgetPercent: sharePct,
    });
  }

  if (settings.budget_include_flight && summary.committedFlightCents > 0) {
    const rawShare = budgetTotal > 0 ? (summary.committedFlightCents / budgetTotal) * 100 : 0;
    const sharePct = Math.min(100, Math.round(rawShare));
    result.push({
      category: 'flight',
      allocatedCents: summary.committedFlightCents,
      usedCents: summary.committedFlightCents,
      remainingCents: 0,
      percent: 0,
      kind: 'fixed',
      exceedsBudget: budgetTotal > 0 && summary.committedFlightCents > budgetTotal,
      shareOfBudgetPercent: sharePct,
    });
  }

  const committedFixed = (settings.budget_include_hotel ? summary.committedHotelCents : 0)
    + (settings.budget_include_flight ? summary.committedFlightCents : 0);
  const discretionaryRemainder = Math.max(budgetTotal - committedFixed, 0);

  // When fixed costs have swallowed the entire budget, the discretionary
  // remainder is $0 — which makes every category's "allocated" read as $0
  // even though the user clearly intended the saved 35/35/10/5 split. Fall
  // back to the original budget total × saved percentages so the per-category
  // targets stay meaningful, and tag the rows so the UI can explain the state.
  const plannedDiscretionary = summary.plannedFoodCents + summary.plannedActivitiesCents
    + summary.plannedTransitCents + summary.plannedMiscCents;
  const underwater = discretionaryRemainder === 0 && plannedDiscretionary > 0 && budgetTotal > 0;
  const allocBase = underwater ? budgetTotal : discretionaryRemainder;

  const buildDiscretionary = (
    category: BudgetCategory,
    pct: number,
    used: number,
  ): CategoryAllocation => {
    const allocatedCents = Math.round(allocBase * (pct / 100));
    return {
      category,
      allocatedCents,
      usedCents: used,
      remainingCents: allocatedCents - used,
      percent: pct,
      kind: 'discretionary',
      discretionaryUnderwater: underwater || undefined,
    };
  };

  result.push(
    buildDiscretionary('food', allocations.food_percent, summary.plannedFoodCents),
    buildDiscretionary('activities', allocations.activities_percent, summary.plannedActivitiesCents),
    buildDiscretionary('transit', allocations.transit_percent, summary.plannedTransitCents),
    buildDiscretionary('misc', allocations.misc_percent, summary.plannedMiscCents),
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
