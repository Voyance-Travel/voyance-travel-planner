import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// TYPES
// =============================================================================

interface ActivityLocation {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface Activity {
  id: string;
  title: string;
  description?: string;
  category?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  location?: ActivityLocation;
  cost?: { amount: number | null; currency: string };
  isLocked?: boolean;
  transportation?: TransportData;
  durationMinutes?: number;
  timeBlockType?: string;
  tags?: string[];
}

interface TransportData {
  method: string;
  duration: string;
  durationMinutes?: number;
  distance?: string;
  distanceMeters?: number;
  estimatedCost?: { amount: number; currency: string };
  instructions?: string;
}

interface Day {
  dayNumber: number;
  date?: string;
  title?: string;
  activities: Activity[];
  metadata?: {
    totalEstimatedCost?: number;
    pacingLevel?: string;
    theme?: string;
  };
}

interface OptimizeRequest {
  tripId: string;
  destination: string;
  days: Day[];
  enableRouteOptimization?: boolean;
  enableRealTransport?: boolean;
  enableCostLookup?: boolean;
  enableGapFilling?: boolean;
  currency?: string;
}

// =============================================================================
// ALGORITHM 1: COST EXTRACTION (from text descriptions)
// Pattern matching for "$25", "€30", "free admission", etc.
// =============================================================================

function extractCost(
  description: string | undefined,
  defaultCurrency: string = 'USD'
): { amount: number; currency: string } | null {
  if (!description) return null;

  const patterns = [
    { regex: /\$(\d+(?:\.\d{2})?)/i, currency: 'USD' },
    { regex: /€(\d+(?:\.\d{2})?)/i, currency: 'EUR' },
    { regex: /£(\d+(?:\.\d{2})?)/i, currency: 'GBP' },
    { regex: /¥(\d+(?:,\d{3})*(?:\.\d{2})?)/i, currency: 'JPY' },
    { regex: /(\d+(?:\.\d{2})?)\s*(USD|EUR|GBP|JPY|AUD|CAD)/i, currency: 'MATCH' },
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern.regex);
    if (match) {
      const amount = parseFloat(match[1].replace(',', ''));
      const currency = pattern.currency === 'MATCH' ? (match[2]?.toUpperCase() || defaultCurrency) : pattern.currency;
      return { amount, currency };
    }
  }

  // Check for "free" keywords
  const freeKeywords = ['free', 'no cost', 'no charge', 'complimentary', 'gratis', 'free admission', 'free entry'];
  const lowercaseDesc = description.toLowerCase();
  for (const keyword of freeKeywords) {
    if (lowercaseDesc.includes(keyword)) {
      return { amount: 0, currency: defaultCurrency };
    }
  }

  return null;
}

// =============================================================================
// ALGORITHM 2: DURATION CALCULATION
// Convert HH:MM times to minutes, with fallbacks
// =============================================================================

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(p => parseInt(p, 10));
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function calculateDuration(
  startTime?: string,
  endTime?: string,
  nextStartTime?: string
): number {
  if (!startTime) return 90; // Default 90 minutes

  const start = timeToMinutes(startTime);

  // Case 1: Valid explicit end time
  if (endTime) {
    const end = timeToMinutes(endTime);
    if (end > start) return end - start;
  }

  // Case 2: Infer from next activity
  if (nextStartTime) {
    const nextStart = timeToMinutes(nextStartTime);
    if (nextStart > start) return nextStart - start;
  }

  // Case 3: Default duration
  return 90;
}

// =============================================================================
// ALGORITHM 3: GAP FILLING
// Insert downtime blocks for gaps > 30 minutes
// =============================================================================

const MIN_GAP_MINUTES = 30;

function createDowntimeBlock(startTime: string, endTime: string, durationMinutes: number): Activity {
  return {
    id: `downtime-${startTime}-${endTime}`,
    title: 'Free Time',
    description: `${durationMinutes} minutes of free time to explore, rest, or grab a snack`,
    startTime,
    endTime,
    category: 'relaxation',
    type: 'downtime',
    location: {
      name: 'Flexible',
      address: 'Your choice',
    },
    cost: { amount: 0, currency: 'USD' },
    timeBlockType: 'downtime',
    durationMinutes,
    tags: ['free-time', 'flexible', 'downtime', 'rest'],
    transportation: {
      method: 'walk',
      duration: '0 min',
      estimatedCost: { amount: 0, currency: 'USD' },
      instructions: 'No transportation needed',
    },
  };
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function fillGaps(activities: Activity[]): Activity[] {
  if (activities.length === 0) return [];

  const result: Activity[] = [];

  for (let i = 0; i < activities.length; i++) {
    const current = activities[i];
    result.push(current);

    if (i < activities.length - 1) {
      const next = activities[i + 1];

      if (current.endTime && next.startTime) {
        const currentEnd = timeToMinutes(current.endTime);
        const nextStart = timeToMinutes(next.startTime);
        const gap = nextStart - currentEnd;

        if (gap >= MIN_GAP_MINUTES) {
          const downtime = createDowntimeBlock(
            current.endTime,
            next.startTime,
            gap
          );
          result.push(downtime);
          console.log(`[optimize-itinerary] Inserted ${gap}min downtime between "${current.title}" and "${next.title}"`);
        } else if (gap < 0) {
          console.warn(`[optimize-itinerary] Activity overlap: "${current.title}" ends at ${current.endTime}, "${next.title}" starts at ${next.startTime}`);
        }
      }
    }
  }

  return result;
}

// =============================================================================
// ALGORITHM 4: PACING LEVEL CALCULATION
// ≤3 = relaxed, 4-5 = moderate, ≥6 = packed
// =============================================================================

function calculatePacingLevel(activityCount: number): 'relaxed' | 'moderate' | 'packed' {
  if (activityCount <= 3) return 'relaxed';
  if (activityCount <= 5) return 'moderate';
  return 'packed';
}

// =============================================================================
// ALGORITHM 5: ROUTE OPTIMIZATION (Nearest Neighbor TSP)
// Minimize total travel distance while respecting locked activities
// =============================================================================

function getHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build distance matrix for all activities with coordinates
function buildDistanceMatrix(activities: Activity[]): number[][] {
  const n = activities.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        const a = activities[i];
        const b = activities[j];
        if (a.location?.lat && a.location?.lng && b.location?.lat && b.location?.lng) {
          matrix[i][j] = getHaversineDistance(
            a.location.lat, a.location.lng,
            b.location.lat, b.location.lng
          );
        } else {
          matrix[i][j] = Infinity; // No coordinates
        }
      }
    }
  }

  return matrix;
}

function optimizeDayRoute(activities: Activity[]): Activity[] {
  // Identify locked activities (meals, specific timed events)
  const lockedWithIndex = activities
    .map((act, idx) => ({ act, idx, isLocked: act.isLocked || false }))
    .filter(item => item.isLocked);

  const unlocked = activities.filter(act => !act.isLocked);

  // If ≤1 unlocked activities or no coordinates, return as-is
  if (unlocked.length <= 1) return activities;

  const hasCoords = unlocked.every(a => a.location?.lat && a.location?.lng);
  if (!hasCoords) {
    console.log("[optimize-itinerary] Missing coordinates, skipping route optimization");
    return activities;
  }

  // Build distance matrix for unlocked activities
  const distMatrix = buildDistanceMatrix(unlocked);

  // Nearest Neighbor TSP
  const optimizedIndices: number[] = [];
  const visited = new Set<number>();

  // Start from first activity
  let current = 0;
  visited.add(current);
  optimizedIndices.push(current);

  while (visited.size < unlocked.length) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < unlocked.length; i++) {
      if (!visited.has(i) && distMatrix[current][i] < nearestDist) {
        nearestDist = distMatrix[current][i];
        nearestIdx = i;
      }
    }

    if (nearestIdx >= 0) {
      visited.add(nearestIdx);
      optimizedIndices.push(nearestIdx);
      current = nearestIdx;
    } else {
      break;
    }
  }

  const optimized = optimizedIndices.map(i => unlocked[i]);

  // Calculate improvement
  let originalDist = 0;
  let optimizedDist = 0;
  for (let i = 1; i < unlocked.length; i++) {
    originalDist += distMatrix[i - 1][i];
  }
  for (let i = 1; i < optimizedIndices.length; i++) {
    optimizedDist += distMatrix[optimizedIndices[i - 1]][optimizedIndices[i]];
  }
  const improvement = originalDist > 0 ? ((originalDist - optimizedDist) / originalDist * 100).toFixed(1) : '0';
  console.log(`[optimize-itinerary] Route optimized: ${improvement}% distance reduction`);

  // Merge locked activities back at their original positions
  const result: Activity[] = [];
  let optimizedIdx = 0;

  for (let i = 0; i < activities.length; i++) {
    const lockedItem = lockedWithIndex.find(l => l.idx === i);
    if (lockedItem) {
      result.push(lockedItem.act);
    } else if (optimizedIdx < optimized.length) {
      result.push(optimized[optimizedIdx++]);
    }
  }

  while (optimizedIdx < optimized.length) {
    result.push(optimized[optimizedIdx++]);
  }

  return result;
}

// =============================================================================
// ALGORITHM 6: GOOGLE DISTANCE MATRIX API
// Real transport times with automatic mode selection
// =============================================================================

interface TransportResult {
  method: string;
  duration: string;
  durationMinutes: number;
  distance: string;
  distanceMeters: number;
  estimatedCost: { amount: number; currency: string };
  instructions: string;
}

async function getGoogleTransport(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  destinationName: string,
  mode: 'walking' | 'driving' | 'transit' = 'walking'
): Promise<TransportResult | null> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=${mode}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      return null;
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      return null;
    }

    const distanceMeters = element.distance.value;
    const durationMinutes = Math.round(element.duration.value / 60);

    // Estimate cost based on mode and distance
    let costAmount = 0;
    let displayMethod: string = mode;
    let instructions: string = '';

    if (mode === 'walking') {
      costAmount = 0;
      displayMethod = 'walk';
      instructions = `Walk ${element.distance.text} to ${destinationName}`;
    } else if (mode === 'transit') {
      // Transit cost varies by city, estimate $2-5
      costAmount = Math.min(5, Math.max(2, Math.round(distanceMeters / 5000) + 2));
      displayMethod = 'metro';
      instructions = `Take public transit ${element.distance.text} to ${destinationName}`;
    } else if (mode === 'driving') {
      // Rideshare: base fare + per-km rate
      const basefare = 3;
      const perKmRate = 1.8;
      costAmount = Math.round(basefare + (distanceMeters / 1000) * perKmRate);
      displayMethod = 'uber';
      instructions = `Take a rideshare ${element.distance.text} to ${destinationName} (~$${costAmount})`;
    }

    return {
      method: displayMethod,
      duration: `${durationMinutes} min`,
      durationMinutes,
      distance: element.distance.text,
      distanceMeters,
      estimatedCost: { amount: costAmount, currency: 'USD' },
      instructions,
    };
  } catch (error) {
    console.error("[optimize-itinerary] Google API error:", error);
    return null;
  }
}

// Fallback using Haversine distance estimation
function getHaversineTransport(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  destinationName: string
): TransportResult {
  const distanceMeters = Math.round(getHaversineDistance(
    origin.lat, origin.lng, destination.lat, destination.lng
  ));

  // Determine best mode based on distance
  let method: string;
  let durationMinutes: number;
  let costAmount: number;
  let instructions: string;

  if (distanceMeters < 1500) {
    // Under 1.5km = walk (~5 km/h = 83m/min)
    method = 'walk';
    durationMinutes = Math.round(distanceMeters / 83);
    costAmount = 0;
    instructions = `Walk ${Math.round(distanceMeters)}m to ${destinationName}`;
  } else if (distanceMeters < 5000) {
    // 1.5-5km = metro/bus (~25 km/h + 5min wait)
    method = 'metro';
    durationMinutes = Math.round(distanceMeters / 417) + 5;
    costAmount = 3;
    instructions = `Take public transit ${(distanceMeters / 1000).toFixed(1)}km to ${destinationName}`;
  } else {
    // Over 5km = rideshare (~30 km/h + 3min pickup)
    method = 'uber';
    durationMinutes = Math.round(distanceMeters / 500) + 3;
    costAmount = Math.round(3 + (distanceMeters / 1000) * 1.8);
    instructions = `Take a rideshare ${(distanceMeters / 1000).toFixed(1)}km to ${destinationName} (~$${costAmount})`;
  }

  const distanceText = distanceMeters < 1000 
    ? `${distanceMeters}m` 
    : `${(distanceMeters / 1000).toFixed(1)}km`;

  return {
    method: method,
    duration: `${durationMinutes} min`,
    durationMinutes,
    distance: distanceText,
    distanceMeters,
    estimatedCost: { amount: costAmount, currency: 'USD' },
    instructions,
  };
}

// Smart transport mode selection
async function getOptimalTransport(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  destinationName: string
): Promise<TransportResult> {
  const hasApiKey = !!Deno.env.get("GOOGLE_MAPS_API_KEY");

  if (!hasApiKey) {
    return getHaversineTransport(origin, destination, destinationName);
  }

  // Try walking first
  const walkResult = await getGoogleTransport(origin, destination, destinationName, 'walking');

  if (walkResult) {
    // If walk is under 20 minutes, use it
    if (walkResult.durationMinutes <= 20) {
      return walkResult;
    }

    // Try transit for longer distances
    const transitResult = await getGoogleTransport(origin, destination, destinationName, 'transit');
    if (transitResult && transitResult.durationMinutes < walkResult.durationMinutes * 0.6) {
      return transitResult;
    }

    // If walk is 20-35 minutes, still acceptable
    if (walkResult.durationMinutes <= 35) {
      return walkResult;
    }

    // For very long walks, try driving
    const driveResult = await getGoogleTransport(origin, destination, destinationName, 'driving');
    if (driveResult && driveResult.durationMinutes < walkResult.durationMinutes * 0.4) {
      return driveResult;
    }

    return transitResult || walkResult;
  }

  // Fallback to Haversine
  return getHaversineTransport(origin, destination, destinationName);
}

// =============================================================================
// ALGORITHM 7: BATCHED ENRICHMENT
// Process activities in batches to avoid connection pool exhaustion
// =============================================================================

const BATCH_SIZE = 10;

async function batchedCostLookup(
  activities: Activity[],
  destination: string
): Promise<Map<string, { amount: number; currency: string }>> {
  const results = new Map<string, { amount: number; currency: string }>();
  const apiKey = Deno.env.get("FOURSQUARE_API_KEY");

  if (!apiKey) {
    console.warn("[optimize-itinerary] FOURSQUARE_API_KEY not set, using category estimates");
    
    // Fallback: category-based estimates
    const categoryEstimates: Record<string, number> = {
      dining: 40,
      restaurant: 45,
      cultural: 20,
      museum: 18,
      sightseeing: 15,
      attraction: 20,
      activity: 30,
      shopping: 50,
      relaxation: 60,
      spa: 80,
      tour: 65,
      entertainment: 35,
    };

    for (const act of activities) {
      if (act.cost?.amount === null || act.cost?.amount === undefined) {
        const category = (act.category || act.type || '').toLowerCase();
        if (categoryEstimates[category]) {
          results.set(act.id, { amount: categoryEstimates[category], currency: 'USD' });
        }
      }
    }
    
    return results;
  }

  // Filter activities that need cost lookup
  const needsLookup = activities.filter(act => 
    act.cost?.amount === null || 
    act.cost?.amount === undefined ||
    act.cost?.amount === 0
  );

  if (needsLookup.length === 0) return results;

  const totalBatches = Math.ceil(needsLookup.length / BATCH_SIZE);
  console.log(`[optimize-itinerary] Cost lookup: ${needsLookup.length} activities in ${totalBatches} batches`);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batch = needsLookup.slice(batchStart, batchStart + BATCH_SIZE);

    await Promise.all(
      batch.map(async (activity) => {
        try {
          const category = (activity.category || activity.type || '').toLowerCase();
          if (['transport', 'transportation', 'accommodation', 'relaxation', 'downtime'].includes(category)) {
            return; // Skip these categories
          }

          const query = encodeURIComponent(activity.title);
          const near = encodeURIComponent(destination);

          const searchUrl = `https://api.foursquare.com/v3/places/search?query=${query}&near=${near}&limit=1`;
          const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': apiKey, 'Accept': 'application/json' },
          });

          if (!searchRes.ok) return;

          const searchData = await searchRes.json();
          const place = searchData.results?.[0];
          if (!place) return;

          // Get price level from place details
          const detailsUrl = `https://api.foursquare.com/v3/places/${place.fsq_id}?fields=price`;
          const detailsRes = await fetch(detailsUrl, {
            headers: { 'Authorization': apiKey, 'Accept': 'application/json' },
          });

          if (!detailsRes.ok) return;

          const details = await detailsRes.json();
          const priceLevel = details.price;

          // Map Foursquare price level (1-4) to estimated cost
          const priceMappings: Record<number, number> = {
            1: 15,  // $
            2: 35,  // $$
            3: 75,  // $$$
            4: 150, // $$$$
          };

          if (priceLevel && priceMappings[priceLevel]) {
            results.set(activity.id, { amount: priceMappings[priceLevel], currency: 'USD' });
          }
        } catch (error) {
          console.warn(`[optimize-itinerary] Cost lookup failed for "${activity.title}":`, error);
        }
      })
    );
  }

  return results;
}

// =============================================================================
// ALGORITHM 8: BUDGET BREAKDOWN CALCULATION
// =============================================================================

interface BudgetBreakdown {
  activities: number;
  food: number;
  transportation: number;
  accommodations: number;
  total: number;
}

function calculateBudgetBreakdown(days: Day[]): BudgetBreakdown {
  let activitiesCost = 0;
  let foodCost = 0;
  let transportationCost = 0;

  for (const day of days) {
    for (const activity of day.activities) {
      const cost = activity.cost?.amount || 0;
      const category = (activity.category || activity.type || '').toLowerCase();

      if (['dining', 'restaurant', 'food', 'cafe'].includes(category)) {
        foodCost += cost;
      } else if (['transport', 'transportation'].includes(category)) {
        // Skip - handled via transportation field
      } else if (!['accommodation', 'downtime', 'relaxation'].includes(category)) {
        activitiesCost += cost;
      }

      // Add inter-activity transportation costs
      if (activity.transportation?.estimatedCost?.amount) {
        transportationCost += activity.transportation.estimatedCost.amount;
      }
    }
  }

  // Estimate accommodations as 40% of subtotal (industry average)
  const subtotal = activitiesCost + foodCost + transportationCost;
  const accommodations = Math.round(subtotal * 0.4);

  return {
    activities: Math.round(activitiesCost),
    food: Math.round(foodCost),
    transportation: Math.round(transportationCost),
    accommodations,
    total: Math.round(subtotal + accommodations),
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: OptimizeRequest = await req.json();
    const {
      tripId,
      destination,
      days,
      enableRouteOptimization = true,
      enableRealTransport = true,
      enableCostLookup = true,
      enableGapFilling = true,
      currency = 'USD',
    } = body;

    console.log(`[optimize-itinerary] Processing trip ${tripId}: ${days.length} days, destination: ${destination}`);
    console.log(`[optimize-itinerary] Options: route=${enableRouteOptimization}, transport=${enableRealTransport}, cost=${enableCostLookup}, gaps=${enableGapFilling}`);

    const optimizedDays: Day[] = [];
    let totalActivitiesOptimized = 0;
    let transportCalculated = 0;
    let costsLookedUp = 0;
    let gapsInserted = 0;

    // Collect all activities for batched cost lookup
    const allActivities: Activity[] = days.flatMap(d => d.activities);

    // Step 1: Batched cost lookup (if enabled)
    let costLookupResults = new Map<string, { amount: number; currency: string }>();
    if (enableCostLookup) {
      costLookupResults = await batchedCostLookup(allActivities, destination);
      console.log(`[optimize-itinerary] Cost lookup found ${costLookupResults.size} prices`);
    }

    for (const day of days) {
      let activities = [...day.activities];

      // Step 2: Try extracting costs from descriptions
      activities = activities.map(act => {
        // Already has a valid cost
        if (act.cost?.amount !== null && act.cost?.amount !== undefined && act.cost?.amount > 0) {
          return act;
        }

        // Try cost from lookup results
        if (costLookupResults.has(act.id)) {
          costsLookedUp++;
          return { ...act, cost: costLookupResults.get(act.id)! };
        }

        // Try extracting from description
        const extracted = extractCost(act.description, currency);
        if (extracted) {
          costsLookedUp++;
          return { ...act, cost: extracted };
        }

        return act;
      });

      // Step 3: Calculate durations
      activities = activities.map((act, idx) => {
        const nextAct = activities[idx + 1];
        const duration = calculateDuration(act.startTime, act.endTime, nextAct?.startTime);
        return { ...act, durationMinutes: duration };
      });

      // Step 4: Route optimization
      if (enableRouteOptimization && activities.length > 2) {
        console.log(`[optimize-itinerary] Day ${day.dayNumber}: Optimizing route for ${activities.length} activities`);
        activities = optimizeDayRoute(activities);
        totalActivitiesOptimized += activities.length;
      }

      // Step 5: Calculate real transportation between activities
      if (enableRealTransport) {
        for (let i = 1; i < activities.length; i++) {
          const prev = activities[i - 1];
          const curr = activities[i];

          // Skip downtime blocks
          if (curr.timeBlockType === 'downtime') continue;

          if (prev.location?.lat && prev.location?.lng && curr.location?.lat && curr.location?.lng) {
            const origin = { lat: prev.location.lat, lng: prev.location.lng };
            const dest = { lat: curr.location.lat, lng: curr.location.lng };

            const transport = await getOptimalTransport(origin, dest, curr.location.name || curr.title);

            activities[i] = {
              ...curr,
              transportation: {
                method: transport.method,
                duration: transport.duration,
                durationMinutes: transport.durationMinutes,
                distance: transport.distance,
                distanceMeters: transport.distanceMeters,
                estimatedCost: transport.estimatedCost,
                instructions: transport.instructions,
              },
            };
            transportCalculated++;
          }
        }
      }

      // Step 6: Gap filling
      if (enableGapFilling) {
        const beforeCount = activities.length;
        activities = fillGaps(activities);
        gapsInserted += activities.length - beforeCount;
      }

      // Step 7: Calculate day metadata
      const realActivities = activities.filter(a => a.timeBlockType !== 'downtime');
      const totalDayCost = activities.reduce((sum, a) => {
        const actCost = a.cost?.amount || 0;
        const transportCost = a.transportation?.estimatedCost?.amount || 0;
        return sum + actCost + transportCost;
      }, 0);

      const pacingLevel = calculatePacingLevel(realActivities.length);

      optimizedDays.push({
        ...day,
        activities,
        metadata: {
          ...day.metadata,
          totalEstimatedCost: Math.round(totalDayCost),
          pacingLevel,
          theme: day.title || day.metadata?.theme,
        },
      });
    }

    // Calculate overall budget breakdown
    const budgetBreakdown = calculateBudgetBreakdown(optimizedDays);

    console.log(`[optimize-itinerary] Complete:
      - Route optimized: ${totalActivitiesOptimized} activities
      - Transport calculated: ${transportCalculated} legs
      - Costs looked up: ${costsLookedUp}
      - Gaps filled: ${gapsInserted}
      - Budget total: $${budgetBreakdown.total}`);

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .single();

    if (fetchError) {
      console.error("[optimize-itinerary] Failed to fetch trip:", fetchError);
    } else {
      const existingData = (trip?.itinerary_data as Record<string, unknown>) || {};
      const updatedData = {
        ...existingData,
        days: optimizedDays,
        optimizedAt: new Date().toISOString(),
        budgetBreakdown,
        optimizationMetadata: {
          routeOptimized: enableRouteOptimization,
          realTransport: enableRealTransport,
          costLookup: enableCostLookup,
          gapFilling: enableGapFilling,
          stats: {
            activitiesOptimized: totalActivitiesOptimized,
            transportCalculated,
            costsLookedUp,
            gapsInserted,
          },
        },
      };

      const { error: updateError } = await supabase
        .from('trips')
        .update({
          itinerary_data: updatedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (updateError) {
        console.error("[optimize-itinerary] Failed to save optimized itinerary:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tripId,
        days: optimizedDays,
        budgetBreakdown,
        metadata: {
          routeOptimized: enableRouteOptimization,
          realTransport: enableRealTransport,
          costLookup: enableCostLookup,
          gapFilling: enableGapFilling,
          stats: {
            activitiesOptimized: totalActivitiesOptimized,
            transportCalculated,
            costsLookedUp,
            gapsInserted,
          },
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("[optimize-itinerary] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
