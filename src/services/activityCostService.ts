/**
 * Activity Cost Service
 * 
 * Single source of truth for all trip cost data.
 * All cost reads go through the SQL views; all writes go to activity_costs table.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────

export interface TripTotal {
  trip_id: string;
  activity_count: number;
  total_per_person_usd: number;
  total_all_travelers_usd: number;
  days_with_costs: number;
}

export interface DayTotal {
  trip_id: string;
  day_number: number;
  day_total_per_person_usd: number;
  day_total_all_travelers_usd: number;
  activity_count: number;
}

export interface BudgetByCategory {
  trip_id: string;
  category: string;
  category_total_per_person_usd: number;
  category_total_all_travelers_usd: number;
  item_count: number;
}

export interface PaymentsSummary {
  trip_id: string;
  total_estimated_usd: number;
  total_paid_usd: number;
  total_remaining_usd: number;
  paid_count: number;
  unpaid_count: number;
}

export interface ActivityCostRow {
  id: string;
  trip_id: string;
  activity_id: string;
  day_number: number;
  cost_reference_id: string | null;
  cost_per_person_usd: number;
  cost_per_person_local: number | null;
  local_currency: string | null;
  num_travelers: number;
  total_cost_usd: number;
  category: string;
  source: string;
  confidence: string | null;
  is_paid: boolean;
  paid_amount_usd: number | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostReference {
  id: string;
  destination_city: string;
  destination_country: string;
  category: string;
  subcategory: string | null;
  item_name: string | null;
  cost_low_usd: number;
  cost_mid_usd: number;
  cost_high_usd: number;
  source: string;
  confidence: string;
}

export type BudgetTier = 'saver' | 'moderate' | 'premium' | 'luxury';

// ─── Category caps (frontend validation) ─────────────────────

const CATEGORY_CAPS: Record<string, number> = {
  dining: 500,
  transport: 300,
  activity: 1000,
  nightlife: 200,
  shopping: 5000,
};
const GLOBAL_CAP = 2000;

export function validateCostUpdate(
  category: string,
  costPerPerson: number
): { valid: boolean; message?: string; warning?: string } {
  if (costPerPerson < 0) {
    return { valid: false, message: 'Cost cannot be negative.' };
  }
  const threshold = CATEGORY_CAPS[category] || GLOBAL_CAP;
  if (costPerPerson > threshold) {
    return {
      valid: true,
      warning: `$${costPerPerson}/pp is above the typical range for ${category} ($${threshold}/pp). You can still save it.`,
    };
  }
  return { valid: true };
}

// ─── View Queries (read-only, canonical totals) ──────────────

export async function getTripTotal(tripId: string): Promise<TripTotal | null> {
  const { data, error } = await (supabase as any)
    .from('v_trip_total')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) {
    console.error('getTripTotal error:', error);
    return null;
  }
  return data as TripTotal | null;
}

export async function getDayTotals(tripId: string): Promise<DayTotal[]> {
  const { data, error } = await (supabase as any)
    .from('v_day_totals')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number');

  if (error) {
    console.error('getDayTotals error:', error);
    return [];
  }
  return (data as DayTotal[]) || [];
}

export async function getBudgetByCategory(tripId: string): Promise<BudgetByCategory[]> {
  const { data, error } = await (supabase as any)
    .from('v_budget_by_category')
    .select('*')
    .eq('trip_id', tripId);

  if (error) {
    console.error('getBudgetByCategory error:', error);
    return [];
  }
  return (data as BudgetByCategory[]) || [];
}

export async function getPaymentsSummary(tripId: string): Promise<PaymentsSummary | null> {
  const { data, error } = await (supabase as any)
    .from('v_payments_summary')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) {
    console.error('getPaymentsSummary error:', error);
    return null;
  }
  return data as PaymentsSummary | null;
}

// ─── Activity Costs CRUD ─────────────────────────────────────

export async function getActivityCosts(tripId: string): Promise<ActivityCostRow[]> {
  const { data, error } = await supabase
    .from('activity_costs')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number')
    .order('created_at');

  if (error) {
    console.error('getActivityCosts error:', error);
    return [];
  }
  return (data as unknown as ActivityCostRow[]) || [];
}

export async function getActivityCost(
  tripId: string,
  activityId: string
): Promise<ActivityCostRow | null> {
  const { data, error } = await supabase
    .from('activity_costs')
    .select('*')
    .eq('trip_id', tripId)
    .eq('activity_id', activityId)
    .maybeSingle();

  if (error) {
    console.error('getActivityCost error:', error);
    return null;
  }
  return data as unknown as ActivityCostRow | null;
}

export async function upsertActivityCost(params: {
  trip_id: string;
  activity_id: string;
  day_number: number;
  cost_per_person_usd: number;
  num_travelers?: number;
  category: string;
  source?: string;
  confidence?: string;
  cost_reference_id?: string | null;
  notes?: string;
}): Promise<ActivityCostRow | null> {
  // activity_id is now TEXT — no UUID guard needed

  // Only block truly invalid values (negative costs)
  if (params.cost_per_person_usd < 0) {
    console.error('Cost validation failed: negative cost');
    return null;
  }

  const { data, error } = await supabase
    .from('activity_costs')
    .upsert(
      {
        trip_id: params.trip_id,
        activity_id: params.activity_id,
        day_number: params.day_number,
        cost_per_person_usd: params.cost_per_person_usd,
        num_travelers: params.num_travelers || 1,
        category: params.category,
        source: params.source || 'reference',
        confidence: params.confidence || 'medium',
        cost_reference_id: params.cost_reference_id || null,
        notes: params.notes,
      },
      { onConflict: 'trip_id,activity_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('upsertActivityCost error:', error);
    return null;
  }
  return data as unknown as ActivityCostRow;
}

export async function deleteActivityCost(
  tripId: string,
  activityId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('activity_costs')
    .delete()
    .eq('trip_id', tripId)
    .eq('activity_id', activityId);

  if (error) {
    console.error('deleteActivityCost error:', error);
    return false;
  }
  return true;
}

export async function markActivityPaid(
  tripId: string,
  activityId: string,
  paidAmountUsd: number
): Promise<boolean> {
  const { error } = await supabase
    .from('activity_costs')
    .update({
      is_paid: true,
      paid_amount_usd: paidAmountUsd,
      paid_at: new Date().toISOString(),
    })
    .eq('trip_id', tripId)
    .eq('activity_id', activityId);

  if (error) {
    console.error('markActivityPaid error:', error);
    return false;
  }
  return true;
}

// ─── Cost Reference Lookups ──────────────────────────────────

export async function lookupCostReference(
  destinationCity: string,
  category: string,
  subcategory?: string
): Promise<CostReference | null> {
  let query = supabase
    .from('cost_reference')
    .select('*')
    .ilike('destination_city', destinationCity)
    .eq('category', category);

  if (subcategory) {
    query = query.eq('subcategory', subcategory);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    // Try country-level fallback
    return null;
  }
  return data as unknown as CostReference;
}

export function selectCostByTier(
  ref: CostReference,
  tier: BudgetTier
): number {
  switch (tier) {
    case 'saver':
      return ref.cost_low_usd;
    case 'moderate':
      return ref.cost_mid_usd;
    case 'premium':
    case 'luxury':
      return ref.cost_high_usd;
    default:
      return ref.cost_mid_usd;
  }
}

// ─── Bulk Operations ─────────────────────────────────────────

export async function syncActivitiesToCostTable(
  tripId: string,
  activities: Array<{
    id: string;
    dayNumber: number;
    category: string;
    costPerPersonUsd: number;
    numTravelers?: number;
    source?: string;
    costReferenceId?: string | null;
  }>
): Promise<number> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  const validActivities = activities.filter((a) => UUID_RE.test(a.id));
  if (!validActivities.length) return 0;

  const rows = validActivities.map((a) => ({
    trip_id: tripId,
    activity_id: a.id,
    day_number: a.dayNumber,
    cost_per_person_usd: Math.max(0, a.costPerPersonUsd),
    num_travelers: a.numTravelers || 1,
    category: a.category,
    source: a.source || 'reference',
    cost_reference_id: a.costReferenceId || null,
  }));

  const { data, error } = await supabase
    .from('activity_costs')
    .upsert(rows, { onConflict: 'trip_id,activity_id' })
    .select();

  if (error) {
    console.error('syncActivitiesToCostTable error:', error);
    return 0;
  }
  return data?.length || 0;
}

// ─── Exchange Rates ──────────────────────────────────────────

export async function getExchangeRate(currencyCode: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('rate_to_usd')
    .eq('currency_code', currencyCode.toUpperCase())
    .maybeSingle();

  if (error || !data) return null;
  return (data as any).rate_to_usd as number;
}

export function convertUsdToLocal(amountUsd: number, rateToUsd: number): number {
  if (!rateToUsd || rateToUsd <= 0) return amountUsd;
  return amountUsd / rateToUsd;
}

export function convertLocalToUsd(amountLocal: number, rateToUsd: number): number {
  if (!rateToUsd || rateToUsd <= 0) return amountLocal;
  return amountLocal * rateToUsd;
}

// ─── Trip Cost Repair ────────────────────────────────────────

export interface RepairResult {
  success: boolean;
  repaired: number;
  corrected: number;
  totalActivities: number;
  error?: string;
}

/**
 * Trigger a cost repair for a specific trip via the generate-itinerary edge function.
 * This fixes corrupted/missing activity_costs rows using reference data.
 */
export async function repairTripCosts(tripId: string): Promise<RepairResult> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-itinerary', {
      body: { action: 'repair-trip-costs', tripId },
    });

    if (error) {
      console.error('repairTripCosts error:', error);
      return { success: false, repaired: 0, corrected: 0, totalActivities: 0, error: error.message };
    }

    return data as RepairResult;
  } catch (err) {
    console.error('repairTripCosts exception:', err);
    return { success: false, repaired: 0, corrected: 0, totalActivities: 0, error: (err as Error).message };
  }
}

/**
 * Check if a trip has missing or stale activity_costs rows.
 * Returns true if repair is needed.
 */
export async function needsCostRepair(tripId: string): Promise<boolean> {
  // Check if trip has itinerary_data but no activity_costs rows
  const { count, error } = await supabase
    .from('activity_costs')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId);

  if (error) {
    console.error('needsCostRepair error:', error);
    return false;
  }

  // If there are 0 activity_costs rows, likely needs repair
  return (count || 0) === 0;
}
