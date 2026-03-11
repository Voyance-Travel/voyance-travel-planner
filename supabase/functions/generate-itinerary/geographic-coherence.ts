/**
 * Geographic Coherence Module
 * 
 * Ensures itineraries follow neighborhood-first planning:
 * - Zone clustering for major destinations
 * - Day anchors based on hotel/locked activities
 * - Travel time validation with hard limits
 * - Backtracking detection and prevention
 * - Optimal activity reordering
 */

// =============================================================================
// TYPES
// =============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  center: Coordinates;
  radiusMeters: number;
  neighborhoods: string[];
}

export interface ActivityWithLocation {
  id: string;
  title: string;
  coordinates?: Coordinates;
  neighborhood?: string;
  isLocked?: boolean;
  timeSlot?: string; // e.g., "09:00-11:00"
  category?: string;
  startTime?: string; // HH:MM format for temporal ordering
}

export interface DayAnchor {
  type: 'hotel' | 'locked_activity' | 'district_theme';
  coordinates: Coordinates;
  neighborhood?: string;
  zoneId?: string;
  name: string;
}

export interface TravelTimeConstraints {
  maxHopMinutes: number;       // Hard max per hop
  targetHopMinutes: number;    // Preferred (target) per hop
  maxDailyTransitMinutes: number; // Total budget per day
  maxLongHops: number;         // Long hops (above target) per day
  paceLevel: 'relaxed' | 'balanced' | 'fast-paced';
}

export interface GeographicValidation {
  isValid: boolean;
  score: number; // 0-100
  violations: GeographicViolation[];
  metrics: DayMetrics;
  suggestions: ReorderSuggestion[];
}

export interface GeographicViolation {
  type: 'long_hop' | 'backtracking' | 'zone_scatter' | 'budget_exceeded';
  severity: 'warning' | 'error';
  activityId: string;
  fromActivity?: string;
  toActivity?: string;
  details: string;
  travelMinutes?: number;
}

export interface DayMetrics {
  totalTransitMinutes: number;
  avgHopMinutes: number;
  hopsUnder20Min: number;
  totalHops: number;
  percentUnder20Min: number;
  maxHopMinutes: number;
  backtrackPatterns: number;
  zonesVisited: number;
  primaryZonePercent: number;
}

export interface ReorderSuggestion {
  type: 'reorder' | 'swap' | 'remove';
  activityId: string;
  newPosition?: number;
  alternativeId?: string;
  reason: string;
}

export interface ZoneCluster {
  zoneId: string;
  zoneName: string;
  center: Coordinates;
  activities: ActivityWithLocation[];
  avgDistanceFromCenter: number;
}

// =============================================================================
// CURATED CITY ZONES
// =============================================================================

const CURATED_ZONES: Record<string, ZoneDefinition[]> = {
  'paris': [
    { id: 'paris-marais', name: 'Le Marais', center: { lat: 48.8566, lng: 2.3628 }, radiusMeters: 1200, neighborhoods: ['marais', 'bastille', 'république'] },
    { id: 'paris-latin', name: 'Latin Quarter', center: { lat: 48.8494, lng: 2.3444 }, radiusMeters: 1000, neighborhoods: ['latin quarter', 'st-germain', 'saint-germain'] },
    { id: 'paris-montmartre', name: 'Montmartre', center: { lat: 48.8867, lng: 2.3431 }, radiusMeters: 800, neighborhoods: ['montmartre', 'pigalle'] },
    { id: 'paris-louvre', name: 'Louvre-Tuileries', center: { lat: 48.8606, lng: 2.3376 }, radiusMeters: 1000, neighborhoods: ['louvre', 'tuileries', 'palais-royal'] },
    { id: 'paris-eiffel', name: 'Eiffel-Invalides', center: { lat: 48.8584, lng: 2.2945 }, radiusMeters: 1500, neighborhoods: ['eiffel', 'invalides', 'trocadéro', 'champ de mars'] },
    { id: 'paris-opera', name: 'Opéra-Grands Boulevards', center: { lat: 48.8719, lng: 2.3316 }, radiusMeters: 1000, neighborhoods: ['opéra', 'grands boulevards', 'madeleine'] },
  ],
  'rome': [
    { id: 'rome-centro', name: 'Centro Storico', center: { lat: 41.8986, lng: 12.4769 }, radiusMeters: 1200, neighborhoods: ['centro storico', 'pantheon', 'piazza navona', 'campo de fiori'] },
    { id: 'rome-trastevere', name: 'Trastevere', center: { lat: 41.8894, lng: 12.4700 }, radiusMeters: 800, neighborhoods: ['trastevere'] },
    { id: 'rome-vatican', name: 'Vatican Area', center: { lat: 41.9029, lng: 12.4534 }, radiusMeters: 1000, neighborhoods: ['vatican', 'prati', 'borgo'] },
    { id: 'rome-colosseum', name: 'Colosseum-Forum', center: { lat: 41.8902, lng: 12.4922 }, radiusMeters: 1000, neighborhoods: ['colosseum', 'forum', 'monti', 'celio'] },
    { id: 'rome-termini', name: 'Termini-Esquilino', center: { lat: 41.9009, lng: 12.5016 }, radiusMeters: 800, neighborhoods: ['termini', 'esquilino', 'repubblica'] },
    { id: 'rome-testaccio', name: 'Testaccio-Aventino', center: { lat: 41.8777, lng: 12.4763 }, radiusMeters: 1000, neighborhoods: ['testaccio', 'aventino', 'ostiense'] },
  ],
  'london': [
    { id: 'london-westminster', name: 'Westminster', center: { lat: 51.4995, lng: -0.1248 }, radiusMeters: 1500, neighborhoods: ['westminster', 'whitehall', 'st james'] },
    { id: 'london-soho', name: 'Soho-West End', center: { lat: 51.5137, lng: -0.1337 }, radiusMeters: 1000, neighborhoods: ['soho', 'west end', 'covent garden', 'leicester square'] },
    { id: 'london-south-bank', name: 'South Bank', center: { lat: 51.5058, lng: -0.1050 }, radiusMeters: 1200, neighborhoods: ['south bank', 'southwark', 'borough'] },
    { id: 'london-city', name: 'City of London', center: { lat: 51.5155, lng: -0.0922 }, radiusMeters: 1000, neighborhoods: ['city', 'bank', 'monument', 'tower'] },
    { id: 'london-shoreditch', name: 'Shoreditch-East', center: { lat: 51.5230, lng: -0.0777 }, radiusMeters: 1000, neighborhoods: ['shoreditch', 'spitalfields', 'brick lane'] },
    { id: 'london-kensington', name: 'Kensington-Chelsea', center: { lat: 51.4989, lng: -0.1750 }, radiusMeters: 1500, neighborhoods: ['kensington', 'chelsea', 'south kensington', 'knightsbridge'] },
  ],
  'new york': [
    { id: 'nyc-midtown', name: 'Midtown', center: { lat: 40.7549, lng: -73.9840 }, radiusMeters: 1500, neighborhoods: ['midtown', 'times square', 'rockefeller'] },
    { id: 'nyc-lower-manhattan', name: 'Lower Manhattan', center: { lat: 40.7128, lng: -74.0060 }, radiusMeters: 1200, neighborhoods: ['financial district', 'battery park', 'tribeca'] },
    { id: 'nyc-soho', name: 'SoHo-Greenwich', center: { lat: 40.7258, lng: -74.0027 }, radiusMeters: 1000, neighborhoods: ['soho', 'greenwich village', 'west village', 'nolita'] },
    { id: 'nyc-east-village', name: 'East Village-LES', center: { lat: 40.7265, lng: -73.9815 }, radiusMeters: 800, neighborhoods: ['east village', 'lower east side', 'alphabet city'] },
    { id: 'nyc-chelsea', name: 'Chelsea-Meatpacking', center: { lat: 40.7467, lng: -74.0030 }, radiusMeters: 1000, neighborhoods: ['chelsea', 'meatpacking', 'high line'] },
    { id: 'nyc-upper-west', name: 'Upper West Side', center: { lat: 40.7870, lng: -73.9754 }, radiusMeters: 1500, neighborhoods: ['upper west side', 'lincoln center', 'central park west'] },
    { id: 'nyc-upper-east', name: 'Upper East Side', center: { lat: 40.7736, lng: -73.9566 }, radiusMeters: 1500, neighborhoods: ['upper east side', 'museum mile', 'yorkville'] },
  ],
  'tokyo': [
    { id: 'tokyo-shibuya', name: 'Shibuya', center: { lat: 35.6580, lng: 139.7016 }, radiusMeters: 1000, neighborhoods: ['shibuya', 'harajuku', 'omotesando'] },
    { id: 'tokyo-shinjuku', name: 'Shinjuku', center: { lat: 35.6938, lng: 139.7034 }, radiusMeters: 1200, neighborhoods: ['shinjuku', 'kabukicho', 'golden gai'] },
    { id: 'tokyo-asakusa', name: 'Asakusa-Ueno', center: { lat: 35.7147, lng: 139.7966 }, radiusMeters: 1500, neighborhoods: ['asakusa', 'ueno', 'yanaka'] },
    { id: 'tokyo-ginza', name: 'Ginza-Marunouchi', center: { lat: 35.6717, lng: 139.7630 }, radiusMeters: 1000, neighborhoods: ['ginza', 'marunouchi', 'nihonbashi'] },
    { id: 'tokyo-roppongi', name: 'Roppongi-Akasaka', center: { lat: 35.6632, lng: 139.7332 }, radiusMeters: 1000, neighborhoods: ['roppongi', 'akasaka', 'azabu'] },
    { id: 'tokyo-akihabara', name: 'Akihabara-Kanda', center: { lat: 35.6987, lng: 139.7714 }, radiusMeters: 800, neighborhoods: ['akihabara', 'kanda', 'ochanomizu'] },
  ],
  'barcelona': [
    { id: 'bcn-gothic', name: 'Gothic Quarter', center: { lat: 41.3838, lng: 2.1757 }, radiusMeters: 800, neighborhoods: ['gothic', 'barri gòtic', 'el born', 'born'] },
    { id: 'bcn-eixample', name: 'Eixample', center: { lat: 41.3953, lng: 2.1616 }, radiusMeters: 1500, neighborhoods: ['eixample', 'passeig de gràcia'] },
    { id: 'bcn-barceloneta', name: 'Barceloneta-Beach', center: { lat: 41.3784, lng: 2.1896 }, radiusMeters: 1000, neighborhoods: ['barceloneta', 'port olímpic', 'vila olímpica'] },
    { id: 'bcn-gracia', name: 'Gràcia', center: { lat: 41.4017, lng: 2.1559 }, radiusMeters: 1000, neighborhoods: ['gràcia', 'gracia'] },
    { id: 'bcn-raval', name: 'El Raval', center: { lat: 41.3795, lng: 2.1678 }, radiusMeters: 800, neighborhoods: ['raval', 'el raval'] },
    { id: 'bcn-montjuic', name: 'Montjuïc', center: { lat: 41.3635, lng: 2.1572 }, radiusMeters: 1500, neighborhoods: ['montjuïc', 'montjuic', 'poble sec'] },
  ],
  'lisbon': [
    { id: 'lisbon-baixa', name: 'Baixa-Chiado', center: { lat: 38.7101, lng: -9.1398 }, radiusMeters: 800, neighborhoods: ['baixa', 'chiado', 'rossio'] },
    { id: 'lisbon-alfama', name: 'Alfama', center: { lat: 38.7118, lng: -9.1300 }, radiusMeters: 600, neighborhoods: ['alfama', 'castelo', 'mouraria'] },
    { id: 'lisbon-belem', name: 'Belém', center: { lat: 38.6975, lng: -9.2065 }, radiusMeters: 1200, neighborhoods: ['belém', 'belem'] },
    { id: 'lisbon-bairro', name: 'Bairro Alto', center: { lat: 38.7138, lng: -9.1448 }, radiusMeters: 600, neighborhoods: ['bairro alto', 'príncipe real'] },
    { id: 'lisbon-lx', name: 'LX Factory-Alcântara', center: { lat: 38.7043, lng: -9.1758 }, radiusMeters: 800, neighborhoods: ['alcântara', 'lx factory', 'santo amaro'] },
  ],
  'amsterdam': [
    { id: 'ams-centrum', name: 'Centrum', center: { lat: 52.3702, lng: 4.8952 }, radiusMeters: 1000, neighborhoods: ['centrum', 'dam', 'red light'] },
    { id: 'ams-jordaan', name: 'Jordaan', center: { lat: 52.3744, lng: 4.8816 }, radiusMeters: 800, neighborhoods: ['jordaan', 'anne frank'] },
    { id: 'ams-museum', name: 'Museum Quarter', center: { lat: 52.3579, lng: 4.8813 }, radiusMeters: 800, neighborhoods: ['museumplein', 'vondelpark', 'oud-zuid'] },
    { id: 'ams-de-pijp', name: 'De Pijp', center: { lat: 52.3530, lng: 4.8943 }, radiusMeters: 700, neighborhoods: ['de pijp', 'albert cuyp'] },
    { id: 'ams-oost', name: 'Amsterdam Oost', center: { lat: 52.3614, lng: 4.9283 }, radiusMeters: 1000, neighborhoods: ['oost', 'plantage', 'artis'] },
  ],
  'madrid': [
    { id: 'mad-sol', name: 'Sol-Centro', center: { lat: 41.4169, lng: -3.7035 }, radiusMeters: 800, neighborhoods: ['sol', 'gran via', 'centro'] },
    { id: 'mad-la-latina', name: 'La Latina', center: { lat: 41.4052, lng: -3.7113 }, radiusMeters: 600, neighborhoods: ['la latina', 'rastro', 'lavapies'] },
    { id: 'mad-retiro', name: 'Retiro-Prado', center: { lat: 41.4104, lng: -3.6838 }, radiusMeters: 1000, neighborhoods: ['retiro', 'prado', 'atocha'] },
    { id: 'mad-salamanca', name: 'Salamanca', center: { lat: 41.4316, lng: -3.6788 }, radiusMeters: 1000, neighborhoods: ['salamanca', 'recoletos'] },
    { id: 'mad-malasana', name: 'Malasaña-Chueca', center: { lat: 41.4244, lng: -3.7037 }, radiusMeters: 700, neighborhoods: ['malasaña', 'chueca', 'tribunal'] },
  ],
  'prague': [
    { id: 'prg-old-town', name: 'Old Town', center: { lat: 50.0875, lng: 14.4213 }, radiusMeters: 800, neighborhoods: ['old town', 'staré město', 'astronomical clock'] },
    { id: 'prg-mala-strana', name: 'Malá Strana', center: { lat: 50.0872, lng: 14.4038 }, radiusMeters: 700, neighborhoods: ['malá strana', 'lesser town', 'charles bridge'] },
    { id: 'prg-castle', name: 'Castle District', center: { lat: 50.0905, lng: 14.3988 }, radiusMeters: 600, neighborhoods: ['hradčany', 'castle', 'strahov'] },
    { id: 'prg-new-town', name: 'New Town', center: { lat: 50.0785, lng: 14.4282 }, radiusMeters: 1000, neighborhoods: ['nové město', 'new town', 'wenceslas'] },
    { id: 'prg-vinohrady', name: 'Vinohrady', center: { lat: 50.0755, lng: 14.4527 }, radiusMeters: 1000, neighborhoods: ['vinohrady', 'žižkov'] },
  ],
  'vienna': [
    { id: 'vie-innere', name: 'Innere Stadt', center: { lat: 48.2082, lng: 16.3738 }, radiusMeters: 1000, neighborhoods: ['innere stadt', 'stephansplatz', 'graben'] },
    { id: 'vie-museum', name: 'MuseumsQuartier', center: { lat: 48.2033, lng: 16.3588 }, radiusMeters: 600, neighborhoods: ['museumsquartier', 'mq', 'neubau'] },
    { id: 'vie-schonbrunn', name: 'Schönbrunn', center: { lat: 48.1845, lng: 16.3122 }, radiusMeters: 800, neighborhoods: ['schönbrunn', 'hietzing'] },
    { id: 'vie-prater', name: 'Prater-Leopoldstadt', center: { lat: 48.2167, lng: 16.3965 }, radiusMeters: 1000, neighborhoods: ['prater', 'leopoldstadt'] },
  ],
};

// Geohash precision for fallback clustering
const GEOHASH_PRECISION = 5;

// =============================================================================
// DISTANCE & TIME CALCULATIONS
// =============================================================================

/**
 * Calculate haversine distance in meters
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate travel time from distance
 */
export function estimateTravelMinutes(distanceMeters: number, mode: 'walk' | 'transit' = 'transit'): number {
  if (mode === 'walk') {
    return Math.round(distanceMeters / 83.33); // 5km/h = 83.33m/min
  }
  // Transit: assume average 20km/h including wait/transfer
  if (distanceMeters < 1000) {
    return Math.round(distanceMeters / 83.33); // Walk for short distances
  }
  // For transit, add 5 min base wait + travel time
  return Math.round(5 + (distanceMeters / 333.33)); // 20km/h = 333.33m/min
}

// =============================================================================
// ZONE MANAGEMENT
// =============================================================================

/**
 * Get curated zones for a destination
 */
export function getCuratedZones(destination: string): ZoneDefinition[] | null {
  const normalized = destination.toLowerCase()
    .replace(/,.*$/, '') // Remove country
    .trim();
  
  return CURATED_ZONES[normalized] || null;
}

/**
 * Assign activity to a zone
 */
export function assignToZone(
  activity: ActivityWithLocation,
  zones: ZoneDefinition[]
): string | null {
  // Try neighborhood matching first
  if (activity.neighborhood) {
    const neighborhoodLower = activity.neighborhood.toLowerCase();
    for (const zone of zones) {
      if (zone.neighborhoods.some(n => neighborhoodLower.includes(n) || n.includes(neighborhoodLower))) {
        return zone.id;
      }
    }
  }

  if (!activity.coordinates) return null;

  // Find closest zone within radius
  let closestZone: { id: string; distance: number } | null = null;
  
  for (const zone of zones) {
    const distance = haversineDistance(
      activity.coordinates.lat, activity.coordinates.lng,
      zone.center.lat, zone.center.lng
    );
    
    if (distance <= zone.radiusMeters) {
      if (!closestZone || distance < closestZone.distance) {
        closestZone = { id: zone.id, distance };
      }
    }
  }
  
  if (closestZone) return closestZone.id;
  
  // Return nearest zone for outliers
  let nearest: { id: string; distance: number } | null = null;
  for (const zone of zones) {
    const distance = haversineDistance(
      activity.coordinates.lat, activity.coordinates.lng,
      zone.center.lat, zone.center.lng
    );
    if (!nearest || distance < nearest.distance) {
      nearest = { id: zone.id, distance };
    }
  }
  
  return nearest?.id || null;
}

/**
 * Generate geohash for fallback clustering
 */
export function generateGeohash(lat: number, lng: number, precision: number = GEOHASH_PRECISION): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let hash = '';
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isLng = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) {
      hash += base32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

// =============================================================================
// DAY ANCHOR
// =============================================================================

/**
 * Determine anchor point for a day
 * Priority: Hotel > Locked activity > District centroid
 */
export function determineDayAnchor(
  dayActivities: ActivityWithLocation[],
  hotelLocation?: Coordinates,
  hotelNeighborhood?: string,
  zones?: ZoneDefinition[] | null
): DayAnchor | null {
  // Priority 1: Hotel location
  if (hotelLocation) {
    const zoneId = zones ? assignToZone({ 
      id: 'hotel', 
      title: 'Hotel',
      coordinates: hotelLocation,
      neighborhood: hotelNeighborhood
    }, zones) : undefined;
    
    return {
      type: 'hotel',
      coordinates: hotelLocation,
      neighborhood: hotelNeighborhood,
      zoneId: zoneId || undefined,
      name: 'Hotel'
    };
  }

  // Priority 2: First locked activity with coordinates
  const lockedWithCoords = dayActivities.find(a => a.isLocked && a.coordinates);
  if (lockedWithCoords?.coordinates) {
    const zoneId = zones ? assignToZone(lockedWithCoords, zones) : undefined;
    return {
      type: 'locked_activity',
      coordinates: lockedWithCoords.coordinates,
      neighborhood: lockedWithCoords.neighborhood,
      zoneId: zoneId || undefined,
      name: lockedWithCoords.title
    };
  }

  // Priority 3: Centroid of activities
  const activitiesWithCoords = dayActivities.filter(a => a.coordinates);
  if (activitiesWithCoords.length > 0) {
    const centroid = {
      lat: activitiesWithCoords.reduce((sum, a) => sum + a.coordinates!.lat, 0) / activitiesWithCoords.length,
      lng: activitiesWithCoords.reduce((sum, a) => sum + a.coordinates!.lng, 0) / activitiesWithCoords.length
    };
    
    const zoneId = zones ? assignToZone({
      id: 'centroid',
      title: 'Day Area',
      coordinates: centroid
    }, zones) : undefined;
    
    return {
      type: 'district_theme',
      coordinates: centroid,
      zoneId: zoneId || undefined,
      name: 'Day Area'
    };
  }

  return null;
}

// =============================================================================
// TRAVEL CONSTRAINTS
// =============================================================================

/**
 * Derive travel time constraints from pace level
 */
export function deriveTravelTimeConstraints(
  paceLevel: 'relaxed' | 'balanced' | 'fast-paced'
): TravelTimeConstraints {
  switch (paceLevel) {
    case 'relaxed':
      return {
        maxHopMinutes: 35,
        targetHopMinutes: 15,
        maxDailyTransitMinutes: 75,
        maxLongHops: 0,
        paceLevel
      };
    case 'fast-paced':
      return {
        maxHopMinutes: 45,
        targetHopMinutes: 25,
        maxDailyTransitMinutes: 120,
        maxLongHops: 2,
        paceLevel
      };
    default: // balanced
      return {
        maxHopMinutes: 40,
        targetHopMinutes: 20,
        maxDailyTransitMinutes: 90,
        maxLongHops: 1,
        paceLevel
      };
  }
}

// =============================================================================
// BACKTRACKING DETECTION
// =============================================================================

/**
 * Detect backtracking patterns: A → B → C → near A
 */
export function detectBacktracking(
  activities: ActivityWithLocation[],
  anchor: DayAnchor | null
): number {
  if (activities.length < 3 || !anchor) return 0;
  
  const activitiesWithCoords = activities.filter(a => a.coordinates);
  if (activitiesWithCoords.length < 3) return 0;
  
  let patterns = 0;
  
  const distances = activitiesWithCoords.map(a => 
    haversineDistance(
      a.coordinates!.lat, a.coordinates!.lng,
      anchor.coordinates.lat, anchor.coordinates.lng
    )
  );
  
  // Look for V or ^ patterns
  for (let i = 0; i < distances.length - 2; i++) {
    const d1 = distances[i];
    const d2 = distances[i + 1];
    const d3 = distances[i + 2];
    
    const threshold = 500; // 500m significant change
    
    if ((d1 - d2 > threshold && d3 - d2 > threshold) || // V pattern
        (d2 - d1 > threshold && d2 - d3 > threshold)) { // ^ pattern
      patterns++;
    }
  }
  
  return patterns;
}

// =============================================================================
// GEOGRAPHIC VALIDATION
// =============================================================================

/**
 * Validate geographic coherence of a day
 */
export function validateDayGeography(
  activities: ActivityWithLocation[],
  anchor: DayAnchor | null,
  constraints: TravelTimeConstraints,
  zones: ZoneDefinition[] | null
): GeographicValidation {
  const violations: GeographicViolation[] = [];
  const suggestions: ReorderSuggestion[] = [];
  
  const hops: { from: string; to: string; minutes: number }[] = [];
  let totalTransit = 0;
  let longHops = 0;
  let maxHop = 0;
  
  const activitiesWithCoords = activities.filter(a => a.coordinates);
  
  for (let i = 0; i < activitiesWithCoords.length - 1; i++) {
    const from = activitiesWithCoords[i];
    const to = activitiesWithCoords[i + 1];
    
    const distance = haversineDistance(
      from.coordinates!.lat, from.coordinates!.lng,
      to.coordinates!.lat, to.coordinates!.lng
    );
    
    const minutes = estimateTravelMinutes(distance);
    hops.push({ from: from.id, to: to.id, minutes });
    totalTransit += minutes;
    maxHop = Math.max(maxHop, minutes);
    
    // Check violations
    if (minutes > constraints.maxHopMinutes) {
      violations.push({
        type: 'long_hop',
        severity: 'error',
        activityId: to.id,
        fromActivity: from.id,
        toActivity: to.id,
        travelMinutes: minutes,
        details: `${minutes} min travel exceeds max ${constraints.maxHopMinutes} min`
      });
    } else if (minutes > constraints.targetHopMinutes) {
      longHops++;
      if (longHops > constraints.maxLongHops) {
        violations.push({
          type: 'long_hop',
          severity: 'warning',
          activityId: to.id,
          fromActivity: from.id,
          toActivity: to.id,
          travelMinutes: minutes,
          details: `${minutes} min (hop ${longHops} of max ${constraints.maxLongHops})`
        });
      }
    }
  }
  
  // Check daily budget
  if (totalTransit > constraints.maxDailyTransitMinutes) {
    violations.push({
      type: 'budget_exceeded',
      severity: 'error',
      activityId: activities[activities.length - 1]?.id || '',
      travelMinutes: totalTransit,
      details: `Total ${totalTransit} min exceeds budget ${constraints.maxDailyTransitMinutes} min`
    });
  }
  
  // Check backtracking
  const backtrackPatterns = detectBacktracking(activities, anchor);
  if (backtrackPatterns > 0) {
    violations.push({
      type: 'backtracking',
      severity: 'warning',
      activityId: activities[Math.floor(activities.length / 2)]?.id || '',
      details: `${backtrackPatterns} backtracking pattern(s) detected`
    });
  }
  
  // Analyze zone scatter
  let primaryZonePercent = 100;
  let zonesVisited = 1;
  
  if (zones && activitiesWithCoords.length > 0) {
    const zoneAssignments = activitiesWithCoords.map(a => assignToZone(a, zones));
    const zoneCounts = new Map<string, number>();
    
    for (const zoneId of zoneAssignments) {
      if (zoneId) {
        zoneCounts.set(zoneId, (zoneCounts.get(zoneId) || 0) + 1);
      }
    }
    
    zonesVisited = zoneCounts.size;
    const maxCount = Math.max(...zoneCounts.values(), 0);
    primaryZonePercent = activitiesWithCoords.length > 0 
      ? Math.round((maxCount / activitiesWithCoords.length) * 100) 
      : 100;
    
    if (zonesVisited > 2 && primaryZonePercent < 50) {
      violations.push({
        type: 'zone_scatter',
        severity: 'warning',
        activityId: activities[0]?.id || '',
        details: `Scattered across ${zonesVisited} zones (${primaryZonePercent}% in primary)`
      });
    }
  }
  
  // Calculate metrics
  const metrics: DayMetrics = {
    totalTransitMinutes: totalTransit,
    avgHopMinutes: hops.length > 0 ? Math.round(totalTransit / hops.length) : 0,
    hopsUnder20Min: hops.filter(h => h.minutes <= 20).length,
    totalHops: hops.length,
    percentUnder20Min: hops.length > 0 ? Math.round((hops.filter(h => h.minutes <= 20).length / hops.length) * 100) : 100,
    maxHopMinutes: maxHop,
    backtrackPatterns,
    zonesVisited,
    primaryZonePercent
  };
  
  // Calculate score
  let score = 100;
  for (const v of violations) {
    score -= v.severity === 'error' ? 25 : 10;
  }
  score = Math.max(0, score);
  
  // Bonus for good metrics
  if (metrics.percentUnder20Min >= 80) score = Math.min(100, score + 5);
  if (metrics.backtrackPatterns === 0) score = Math.min(100, score + 5);
  if (metrics.primaryZonePercent >= 70) score = Math.min(100, score + 5);
  
  const isValid = violations.filter(v => v.severity === 'error').length === 0;
  
  return { isValid, score, violations, metrics, suggestions };
}

// =============================================================================
// ACTIVITY REORDERING
// =============================================================================

/** Parse HH:MM to minutes since midnight */
function parseTimeToMin(time: string | undefined): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

const ARRIVAL_KEYWORDS = ['arrival', 'land', 'arrive', 'touchdown'];
const DEPARTURE_KEYWORDS = ['departure', 'boarding', 'check-in at airport', 'flight out'];
const TRANSPORT_KEYWORDS = ['transport', 'transfer', 'car to', 'taxi to', 'uber to', 'train to', 'private car'];

function isArrival(title: string): boolean {
  const t = title.toLowerCase();
  return ARRIVAL_KEYWORDS.some(k => t.includes(k));
}

function isDeparture(title: string): boolean {
  const t = title.toLowerCase();
  return DEPARTURE_KEYWORDS.some(k => t.includes(k));
}

function isTransport(act: ActivityWithLocation): boolean {
  const t = (act.title || '').toLowerCase();
  const c = (act.category || '').toLowerCase();
  return c === 'transport' || c === 'transit' || TRANSPORT_KEYWORDS.some(k => t.includes(k));
}

/**
 * Enforce temporal dependency rules:
 * 1. Arrivals must come before any transport from that location
 * 2. Departures must be last
 * 3. Remove transports scheduled before the first arrival
 */
export function enforceTemporalDependencies(activities: ActivityWithLocation[]): ActivityWithLocation[] {
  const arrivals: ActivityWithLocation[] = [];
  const departures: ActivityWithLocation[] = [];
  const transports: ActivityWithLocation[] = [];
  const regular: ActivityWithLocation[] = [];

  for (const act of activities) {
    const title = act.title || '';
    if (isArrival(title)) {
      arrivals.push(act);
    } else if (isDeparture(title)) {
      departures.push(act);
    } else if (isTransport(act)) {
      transports.push(act);
    } else {
      regular.push(act);
    }
  }

  // Sort each group by startTime
  const byTime = (a: ActivityWithLocation, b: ActivityWithLocation) =>
    (parseTimeToMin(a.startTime) ?? 0) - (parseTimeToMin(b.startTime) ?? 0);

  arrivals.sort(byTime);
  transports.sort(byTime);
  regular.sort(byTime);
  departures.sort(byTime);

  // Deduplicate: remove transports scheduled before earliest arrival
  const earliestArrival = arrivals.length > 0 ? (parseTimeToMin(arrivals[0].startTime) ?? Infinity) : -1;
  const validTransports = earliestArrival > 0
    ? transports.filter(t => (parseTimeToMin(t.startTime) ?? 0) >= earliestArrival)
    : transports;

  // Split transports into outbound (before noon) and return (noon+)
  const MIDDAY = 12 * 60;
  const outbound = validTransports.filter(t => (parseTimeToMin(t.startTime) ?? 0) < MIDDAY);
  const returnTransports = validTransports.filter(t => (parseTimeToMin(t.startTime) ?? 0) >= MIDDAY);

  return [
    ...arrivals,
    ...outbound,
    ...regular,
    ...returnTransports,
    ...departures,
  ];
}

/**
 * Remove transport activities that are scheduled before the first arrival.
 * E.g. "Transport to Midtown" at 8:00 AM when "Arrival at LGA" is at 8:15 AM.
 */
export function deduplicateTransports(activities: ActivityWithLocation[]): ActivityWithLocation[] {
  const arrivalActs = activities.filter(a => isArrival(a.title || ''));
  if (arrivalActs.length === 0) return activities;

  const firstArrivalTime = parseTimeToMin(arrivalActs[0].startTime) ?? Infinity;

  return activities.filter(a => {
    if (!isTransport(a)) return true;
    const t = parseTimeToMin(a.startTime) ?? 0;
    return t >= firstArrivalTime;
  });
}

/**
 * Reorder activities using nearest neighbor algorithm,
 * with temporal dependency enforcement for arrivals/departures/transports.
 */
export function reorderActivitiesOptimally(
  activities: ActivityWithLocation[],
  anchor: DayAnchor | null
): ActivityWithLocation[] {
  if (activities.length <= 2 || !anchor) return activities;

  // Step 1: Deduplicate impossible transports (before arrival)
  const deduped = deduplicateTransports(activities);

  // Step 2: Separate pinned vs flexible
  const arrivals = deduped.filter(a => isArrival(a.title || ''));
  const departures = deduped.filter(a => isDeparture(a.title || ''));
  const timeLocked = deduped.filter(a => a.isLocked && !isArrival(a.title || '') && !isDeparture(a.title || ''));

  // Truly flexible: not arrival, not departure, not locked
  const flexible = deduped.filter(a =>
    !a.isLocked && !isArrival(a.title || '') && !isDeparture(a.title || '') && a.coordinates
  );
  const noCoords = deduped.filter(a =>
    !a.isLocked && !isArrival(a.title || '') && !isDeparture(a.title || '') && !a.coordinates
  );

  if (flexible.length <= 1) {
    // Even with few flexible items, enforce arrival/departure ordering
    return enforceTemporalDependencies(deduped);
  }

  // Step 3: Nearest-neighbor sort on flexible activities only
  const ordered: ActivityWithLocation[] = [];
  const remaining = [...flexible];
  let current = anchor.coordinates;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      if (!remaining[i].coordinates) continue;
      const dist = haversineDistance(
        current.lat, current.lng,
        remaining[i].coordinates!.lat, remaining[i].coordinates!.lng
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    if (next.coordinates) current = next.coordinates;
  }

  // Step 4: Assemble with correct ordering
  // arrivals → locked → geo-ordered flexible → no-coords → departures
  return [...arrivals, ...timeLocked, ...ordered, ...noCoords, ...departures];
}

// =============================================================================
// PROMPT BUILDERS
// =============================================================================

/**
 * Build geographic coherence prompt for LLM
 */
export function buildGeographicPrompt(
  destination: string,
  zones: ZoneDefinition[] | null,
  hotelNeighborhood?: string,
  constraints?: TravelTimeConstraints
): string {
  const parts: string[] = [];
  
  parts.push(`\n${'='.repeat(40)}\n🗺️ GEOGRAPHIC COHERENCE REQUIREMENTS\n${'='.repeat(40)}`);
  
  if (zones && zones.length > 0) {
    parts.push(`\n📍 CITY ZONES FOR ${destination.toUpperCase()}:`);
    for (const zone of zones) {
      parts.push(`  • ${zone.name}: ${zone.neighborhoods.join(', ')}`);
    }
  }
  
  if (hotelNeighborhood) {
    parts.push(`\n🏨 HOTEL ANCHOR: ${hotelNeighborhood}`);
    parts.push(`  → Start each day near hotel, end near hotel`);
    parts.push(`  → Most activities should be in same zone or planned as intentional day trip`);
  }
  
  if (constraints) {
    parts.push(`\n⏱️ TRAVEL TIME RULES (${constraints.paceLevel} pace):`);
    parts.push(`  • TARGET: Each hop ≤ ${constraints.targetHopMinutes} min`);
    parts.push(`  • HARD MAX: No hop > ${constraints.maxHopMinutes} min`);
    parts.push(`  • DAILY BUDGET: Total transit ≤ ${constraints.maxDailyTransitMinutes} min/day`);
    parts.push(`  • LONG HOPS ALLOWED: ${constraints.maxLongHops} per day`);
  }
  
  parts.push(`\n🚫 GEOGRAPHIC ANTI-PATTERNS (AVOID):`);
  parts.push(`  • Zig-zagging across city (A far from B, C back near A)`);
  parts.push(`  • More than 2-3 zones per day`);
  parts.push(`  • Long transit for short activities`);
  parts.push(`  • Ending day far from hotel`);
  
  parts.push(`\n✅ GEOGRAPHIC BEST PRACTICES:`);
  parts.push(`  • Cluster morning activities in one zone`);
  parts.push(`  • Single transition midday if visiting 2nd zone`);
  parts.push(`  • Use nearest-neighbor ordering within zones`);
  parts.push(`  • If must-see is far, make it day anchor (dedicate day to that area)`);
  
  return parts.join('\n');
}

/**
 * Build day-specific zone guidance
 */
export function buildDayZonePrompt(
  dayNumber: number,
  suggestedZones: string[],
  anchor: DayAnchor | null
): string {
  if (suggestedZones.length === 0) return '';
  
  const parts: string[] = [];
  parts.push(`\n📍 DAY ${dayNumber} ZONE FOCUS:`);
  
  if (anchor) {
    parts.push(`  Anchor: ${anchor.name} (${anchor.type})`);
  }
  
  parts.push(`  Primary zone(s): ${suggestedZones.slice(0, 2).join(', ')}`);
  
  if (suggestedZones.length > 2) {
    parts.push(`  Available if needed: ${suggestedZones.slice(2).join(', ')}`);
  }
  
  parts.push(`  → Keep 70%+ of activities within primary zone`);
  
  return parts.join('\n');
}

// =============================================================================
// QA METRICS LOGGING
// =============================================================================

/**
 * Log geographic QA metrics for full itinerary
 */
export function logGeographicQAMetrics(
  dayValidations: GeographicValidation[],
  tripId: string
): void {
  const allMetrics = dayValidations.map(d => d.metrics);
  
  const allHopsUnder20 = allMetrics.reduce((sum, m) => sum + m.hopsUnder20Min, 0);
  const totalHops = allMetrics.reduce((sum, m) => sum + m.totalHops, 0);
  const percentUnder20Overall = totalHops > 0 ? Math.round((allHopsUnder20 / totalHops) * 100) : 100;
  const maxHopAcrossDays = Math.max(...allMetrics.map(m => m.maxHopMinutes), 0);
  const totalBacktracks = allMetrics.reduce((sum, m) => sum + m.backtrackPatterns, 0);
  const avgScore = allMetrics.length > 0 
    ? Math.round(dayValidations.reduce((sum, d) => sum + d.score, 0) / dayValidations.length)
    : 0;
  
  console.log(`\n[Geographic QA - Trip ${tripId}]`);
  console.log(`  ├─ % hops under 20 min: ${percentUnder20Overall}% (target >70%)`);
  console.log(`  ├─ Max hop duration: ${maxHopAcrossDays} min (target ≤40)`);
  console.log(`  ├─ Total backtrack patterns: ${totalBacktracks} (target 0)`);
  console.log(`  ├─ Avg geographic score: ${avgScore}/100`);
  console.log(`  └─ Days passing validation: ${dayValidations.filter(d => d.isValid).length}/${dayValidations.length}`);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  getCuratedZones,
  assignToZone,
  generateGeohash,
  determineDayAnchor,
  deriveTravelTimeConstraints,
  detectBacktracking,
  validateDayGeography,
  reorderActivitiesOptimally,
  enforceTemporalDependencies,
  deduplicateTransports,
  buildGeographicPrompt,
  buildDayZonePrompt,
  logGeographicQAMetrics,
  haversineDistance,
  estimateTravelMinutes
};
