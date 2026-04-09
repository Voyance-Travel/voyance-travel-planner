/**
 * Auto-Split Logic for Multi-City Journeys
 * 
 * When a trip is 8+ days AND has 2+ cities, splits it into linked trips
 * grouped under a shared journey_id. Each leg becomes its own trip row.
 */

import { supabase } from '@/integrations/supabase/client';

interface Destination {
  city: string;
  country?: string;
  nights: number;
  airportCode?: string;
}

interface HotelData {
  name?: string;
  address?: string;
  neighborhood?: string;
  checkInTime?: string;
  checkOutTime?: string;
  pricePerNight?: number;
  includeInBudget?: boolean;
  accommodationType?: string;
}

interface TransportInfo {
  type?: string;
  fromCity?: string;
  toCity?: string;
  departureTime?: string;
  arrivalTime?: string;
}

interface SplitResult {
  didSplit: boolean;
  firstLegTripId: string;
  journeyId?: string;
  legCount?: number;
}

/**
 * Generates a journey name from destinations.
 * e.g., ["Marrakesh", "Casablanca", "Lisbon"] → "Marrakesh, Casablanca & Lisbon"
 */
function buildJourneyName(cities: string[]): string {
  if (cities.length === 0) return '';
  if (cities.length === 1) return cities[0];
  if (cities.length === 2) return `${cities[0]} & ${cities[1]}`;
  return cities.slice(0, -1).join(', ') + ' & ' + cities[cities.length - 1];
}

/**
 * Adds days to a date string (YYYY-MM-DD) and returns YYYY-MM-DD.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid DST issues
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate total days between two date strings.
 */
function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a trip should be split, and if so, perform the split.
 * Returns the trip ID to navigate to (first leg if split, original if not).
 */
export async function splitJourneyIfNeeded(
  originalTripId: string,
  destinations: Destination[],
  transports: TransportInfo[],
  startDate: string,
  endDate: string,
  hotelsByCity?: Record<string, HotelData[]>,
): Promise<SplitResult> {
  // Check conditions: 8+ days AND 2+ cities
  const totalDays = daysBetween(startDate, endDate);
  
  if (totalDays < 8 || destinations.length < 2) {
    return { didSplit: false, firstLegTripId: originalTripId };
  }

  console.log(`[splitJourney] Splitting trip ${originalTripId}: ${totalDays} days, ${destinations.length} cities`);

  // Fetch the original trip
  const { data: originalTrip, error: fetchError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', originalTripId)
    .single();

  if (fetchError || !originalTrip) {
    console.error('[splitJourney] Failed to fetch original trip:', fetchError);
    return { didSplit: false, firstLegTripId: originalTripId };
  }

  // Generate journey UUID
  const journeyId = crypto.randomUUID();
  const cities = destinations.map(d => d.city);
  const journeyName = buildJourneyName(cities);
  const totalLegs = destinations.length;
  const metadata = (originalTrip.metadata as Record<string, unknown>) || {};

  // Extract perDayActivities for day-range filtering per leg
  const allPerDayActivities = (metadata.perDayActivities as Array<{ dayNumber: number; activities: string }>) || [];

  // Build leg rows
  const legInserts: any[] = [];
  let currentDate = startDate;
  let dayOffset = 0; // Track cumulative day offset for perDayActivities filtering

  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    const nights = Math.max(dest.nights || 1, 1);
    const legStart = currentDate;
    const legEnd = addDays(legStart, nights);

    // Transport info for this leg (from previous city)
    const transport = i > 0 ? transports[i - 1] : null;

    // === perDayActivities-aware splitting ===
    // Filter perDayActivities to this leg's day range and renumber relative to leg start
    const legStartDay = dayOffset + 1; // 1-indexed
    const legEndDay = dayOffset + nights + 1; // inclusive of departure day
    const legPerDayActivities = allPerDayActivities
      .filter(d => d.dayNumber >= legStartDay && d.dayNumber < legEndDay)
      .map(d => ({ dayNumber: d.dayNumber - dayOffset, activities: d.activities }));

    // Build must-do activities from perDayActivities if available, else use legacy city-name filtering
    let legMustDos: string[];
    if (legPerDayActivities.length > 0) {
      // Build mustDoActivities from this leg's structured day data
      legMustDos = legPerDayActivities.flatMap(d =>
        d.activities.split(/,\s*/).map(a => `Day ${d.dayNumber} ${a.trim()}`).filter(Boolean)
      );
    } else {
      // Legacy fallback: city-name keyword matching
      const allMustDos: string[] = (metadata.mustDoActivities as string[]) || [];
      const cityMustDos = allMustDos.filter(activity => {
        const lower = activity.toLowerCase();
        const cityLower = dest.city.toLowerCase();
        return lower.includes(cityLower);
      });
      // Only first leg gets unassigned generic activities (legacy behavior)
      const unassignedMustDos = i === 0
        ? allMustDos.filter(activity => {
            const lower = activity.toLowerCase();
            return !cities.some(c => lower.includes(c.toLowerCase()));
          })
        : [];
      legMustDos = [...cityMustDos, ...unassignedMustDos];
    }

    const legMetadata: Record<string, unknown> = {
      ...metadata,
      mustDoActivities: legMustDos.length > 0 ? legMustDos : null,
      perDayActivities: legPerDayActivities.length > 0 ? legPerDayActivities : null,
      splitFromTrip: originalTripId,
      journeyLeg: i + 1,
    };

    // First-time visitor per city
    const firstTimePerCity = metadata.firstTimePerCity as Record<string, boolean> | null;
    if (firstTimePerCity && dest.city in firstTimePerCity) {
      legMetadata.isFirstTimeVisitor = firstTimePerCity[dest.city];
    }

    dayOffset += nights; // Advance for next leg

    const legName = `${journeyName}: ${dest.city}`;

    // Proportional budget for this leg
    const legBudgetCents = originalTrip.budget_total_cents
      ? Math.round((originalTrip.budget_total_cents as number) * nights / totalDays)
      : null;

    legInserts.push({
      user_id: originalTrip.user_id,
      name: legName,
      destination: dest.city,
      destination_country: dest.country || null,
      start_date: legStart,
      end_date: legEnd,
      travelers: originalTrip.travelers,
      trip_type: originalTrip.trip_type,
      budget_tier: originalTrip.budget_tier,
      budget_total_cents: legBudgetCents,
      origin_city: i === 0 ? originalTrip.origin_city : destinations[i - 1].city,
      flight_selection: i === 0 ? originalTrip.flight_selection : null,
      hotel_selection: hotelsByCity?.[dest.city]?.length
        ? hotelsByCity[dest.city].filter(h => h.name).map(h => ({
            name: h.name,
            address: h.address || '',
            neighborhood: h.neighborhood || '',
            checkInTime: h.checkInTime || '15:00',
            checkOutTime: h.checkOutTime || '11:00',
            pricePerNight: h.pricePerNight || undefined,
            source: 'manual',
          }))
        : null,
      is_multi_city: false,
      destinations: [dest] as any,
      creation_source: 'journey_split',
      status: 'draft',
      itinerary_status: 'not_started',
      owner_plan_tier: originalTrip.owner_plan_tier,
      metadata: legMetadata as any,
      // Journey fields
      journey_id: journeyId,
      journey_name: journeyName,
      journey_order: i + 1,
      journey_total_legs: totalLegs,
      transition_mode: transport?.type || null,
      transition_departure_time: transport?.departureTime || null,
      transition_arrival_time: transport?.arrivalTime || null,
    });

    currentDate = legEnd;
  }

  // Insert all leg trips
  const { data: legs, error: insertError } = await supabase
    .from('trips')
    .insert(legInserts)
    .select('id, journey_order');

  if (insertError || !legs || legs.length === 0) {
    console.error('[splitJourney] Failed to insert leg trips:', insertError);
    return { didSplit: false, firstLegTripId: originalTripId };
  }

  console.log(`[splitJourney] Created ${legs.length} leg trips for journey ${journeyId}`);

  // Copy trip_collaborators from original trip to all legs
  const { data: originalCollabs } = await supabase
    .from('trip_collaborators')
    .select('user_id, permission, include_preferences, accepted_at, invited_by')
    .eq('trip_id', originalTripId);

  if (originalCollabs?.length) {
    const collabInserts = legs.flatMap(leg =>
      originalCollabs.map(c => ({
        trip_id: leg.id,
        user_id: c.user_id,
        permission: c.permission,
        include_preferences: c.include_preferences,
        accepted_at: c.accepted_at,
        invited_by: c.invited_by,
      }))
    );
    const { error: collabError } = await supabase.from('trip_collaborators').insert(collabInserts);
    if (collabError) {
      console.error('[splitJourney] Failed to copy collaborators to legs:', collabError);
    } else {
      console.log(`[splitJourney] Copied ${originalCollabs.length} collaborators to ${legs.length} legs`);
    }
  }

  // Copy trip_members from original trip to all legs
  const { data: originalMembers } = await supabase
    .from('trip_members')
    .select('user_id, role, email, name')
    .eq('trip_id', originalTripId);

  if (originalMembers?.length) {
    const memberInserts = legs.flatMap(leg =>
      originalMembers.map(m => ({
        trip_id: leg.id,
        user_id: m.user_id,
        role: m.role,
        email: m.email,
        name: m.name,
      }))
    );
    const { error: memberError } = await supabase.from('trip_members').insert(memberInserts as any[]);
    if (memberError) {
      console.error('[splitJourney] Failed to copy members to legs:', memberError);
    } else {
      console.log(`[splitJourney] Copied ${originalMembers.length} members to ${legs.length} legs`);
    }
  }

  // Create trip_cities rows for each leg
  const cityInserts: any[] = [];
  let dateOffset = 0;

  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    const legTrip = legs.find(l => l.journey_order === i + 1);
    if (!legTrip) continue;

    const nights = Math.max(dest.nights || 1, 1);
    const arrivalDate = addDays(startDate, dateOffset);
    const departureDate = addDays(arrivalDate, nights);

    // Get proportional budget from the leg insert
    const legInsert = legInserts[i];
    const allocatedBudget = legInsert?.budget_total_cents ?? null;

    cityInserts.push({
      trip_id: legTrip.id,
      city_order: 0, // Each leg has only one city
      city_name: dest.city,
      country: dest.country || null,
      arrival_date: arrivalDate,
      departure_date: departureDate,
      nights,
      generation_status: 'pending' as const,
      days_total: nights + 1, // Inclusive day count: nights + 1 (matches single-city convention)
      allocated_budget_cents: allocatedBudget,
      transport_type: i > 0 && transports[i - 1] ? transports[i - 1].type : null,
      transport_details: i > 0 && transports[i - 1] ? transports[i - 1] as any : null,
      hotel_selection: hotelsByCity?.[dest.city]?.length
        ? hotelsByCity[dest.city].filter(h => h.name).map(h => ({
            name: h.name,
            address: h.address || '',
            neighborhood: h.neighborhood || '',
            checkInTime: h.checkInTime || '15:00',
            checkOutTime: h.checkOutTime || '11:00',
            pricePerNight: h.pricePerNight || undefined,
            source: 'manual',
          }))
        : null,
    });

    dateOffset += nights;
  }

  if (cityInserts.length > 0) {
    const { error: citiesError } = await supabase
      .from('trip_cities')
      .insert(cityInserts as any[]);
    if (citiesError) {
      console.error('[splitJourney] Failed to insert trip_cities for legs:', citiesError);
    }
  }

  // Mark original trip as cancelled with split metadata (don't delete — keep for audit trail)
  await supabase
    .from('trips')
    .update({
      status: 'cancelled',
      metadata: {
        ...metadata,
        splitIntoJourney: true,
        journeyId,
        splitIntoLegs: legs.map(l => l.id),
      } as any,
    })
    .eq('id', originalTripId);

  // Find first leg
  const firstLeg = legs.find(l => l.journey_order === 1);
  const firstLegId = firstLeg?.id || legs[0].id;

  console.log(`[splitJourney] Journey ${journeyId} created. First leg: ${firstLegId}`);

  return {
    didSplit: true,
    firstLegTripId: firstLegId,
    journeyId,
    legCount: totalLegs,
  };
}
