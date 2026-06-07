// supabase/functions/_shared/trip-cost.ts
//
// Server-authoritative port of src/lib/tripCostCalculator.ts (C-CRED-4).
// Source of truth for the FORMULA is src/lib/tripCostCalculator.ts — keep in sync.
//
//   tripCredits = roundUpTo10((days*60 + multiCityFee(cityCount)) * complexityMultiplier)
//   total       = tripCredits + (includeHotels ? cityCount*40 : 0)
//
// Complexity factors that are actually collectable in-product (audited):
//   dietary ∈ {vegan, allergy, halal, kosher}; budget === 'strict'; specialOccasion truthy;
//   mustIncludes.length >= 2.
// (travelParty kids/pets, crowdAversion='high', detailLevel='extended' are never collected
//  anywhere in the product and are intentionally omitted — they would always be absent.)
import { extractMustDoVenues } from "./extract-must-dos.ts";

export const BASE_RATE_PER_DAY = 60;
export const HOTEL_PER_CITY = 40;
const COMPLEX_DIETARY = ["vegan", "allergy", "halal", "kosher"];

export interface CostDNA {
  dietary?: string | null;
  budget?: string | null;
  specialOccasion?: string | null;
}

export interface ServerTripCost {
  days: number;
  baseCredits: number;
  multiCityFee: number;
  subtotal: number;
  factorCount: number;
  factors: string[];
  multiplier: number;
  tripCredits: number;
  hotelCredits: number;
  totalCredits: number;
}

export function roundUpTo10(n: number): number {
  return Math.ceil(n / 10) * 10;
}

export function calculateMultiCityFee(cityCount: number): number {
  if (cityCount <= 1) return 0;
  if (cityCount === 2) return 60;
  if (cityCount === 3) return 120;
  return 180; // 4+ (cap)
}

export function computeComplexity(
  dna: CostDNA | null,
  mustIncludesCount: number,
): { factorCount: number; factors: string[]; multiplier: number } {
  const factors: string[] = [];
  const d = dna ?? {};

  if (d.dietary && COMPLEX_DIETARY.includes(String(d.dietary).toLowerCase())) {
    factors.push(String(d.dietary).toLowerCase());
  }
  if (d.budget === "strict") factors.push("strict_budget");
  if (d.specialOccasion) factors.push("special_occasion");
  if (mustIncludesCount >= 2) factors.push("must_includes");

  const factorCount = factors.length;
  let multiplier = 1.0;
  if (factorCount >= 4) multiplier = 1.3;
  else if (factorCount >= 2) multiplier = 1.15;
  return { factorCount, factors, multiplier };
}

export interface ServerTripCostInput {
  days: number;
  cityCount: number;
  includeHotels: boolean;
  mustIncludes: string[];
  dna: CostDNA | null;
}

export function computeServerTripCost(input: ServerTripCostInput): ServerTripCost {
  const days = Math.max(1, input.days || 1);
  const cityCount = Math.max(1, input.cityCount || 1);

  const baseCredits = days * BASE_RATE_PER_DAY;
  const multiCityFee = calculateMultiCityFee(cityCount);
  const subtotal = baseCredits + multiCityFee;

  const { factorCount, factors, multiplier } = computeComplexity(input.dna, input.mustIncludes.length);

  const tripCredits = roundUpTo10(subtotal * multiplier);
  const hotelCredits = input.includeHotels ? cityCount * HOTEL_PER_CITY : 0;

  return {
    days,
    baseCredits,
    multiCityFee,
    subtotal,
    factorCount,
    factors,
    multiplier,
    tripCredits,
    hotelCredits,
    totalCredits: tripCredits + hotelCredits,
  };
}

function daysFromDates(startDate?: string | null, endDate?: string | null): number {
  if (!startDate || !endDate) return 1;
  const s = new Date(startDate + "T00:00:00").getTime();
  const e = new Date(endDate + "T00:00:00").getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 1;
  return Math.floor((e - s) / 86_400_000) + 1; // inclusive
}

/**
 * Authoritative loader. Reads the cost_dna snapshot + trip_cities count +
 * metadata.mustDoActivities + budget_include_hotel + dates from the DB and
 * returns the server-authoritative cost. Missing cost_dna => multiplier 1.0.
 * `supabaseAdmin` is a service-role supabase-js client.
 */
export async function loadServerTripCost(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  tripId: string,
): Promise<ServerTripCost> {
  const { data: trip, error } = await supabaseAdmin
    .from("trips")
    .select("start_date, end_date, budget_include_hotel, metadata, cost_dna")
    .eq("id", tripId)
    .single();
  if (error || !trip) {
    throw new Error(`loadServerTripCost: trip ${tripId} not found`);
  }

  const { count: cityRowCount } = await supabaseAdmin
    .from("trip_cities")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);
  const cityCount = Math.max(1, cityRowCount ?? 1);

  const days = daysFromDates(trip.start_date, trip.end_date);
  const mustIncludes = extractMustDoVenues(trip.metadata);
  const includeHotels = trip.budget_include_hotel === true;
  const dna = (trip.cost_dna as CostDNA | null) ?? null;

  return computeServerTripCost({ days, cityCount, includeHotels, mustIncludes, dna });
}
