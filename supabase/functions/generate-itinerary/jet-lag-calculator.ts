/**
 * Jet Lag Calculator
 * 
 * Calculates timezone offset between origin and destination cities
 * and applies graduated impact rules for realistic first-day scheduling.
 */

// Common city -> IANA timezone mapping for origin cities
// We use this to resolve origin_city strings to timezones
const CITY_TIMEZONE_MAP: Record<string, string> = {
  // North America
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'denver': 'America/Denver',
  'phoenix': 'America/Phoenix',
  'miami': 'America/New_York',
  'boston': 'America/New_York',
  'atlanta': 'America/New_York',
  'dallas': 'America/Chicago',
  'houston': 'America/Chicago',
  'washington': 'America/New_York',
  'dc': 'America/New_York',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'montreal': 'America/Toronto',
  
  // Europe
  'london': 'Europe/London',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'rome': 'Europe/Rome',
  'madrid': 'Europe/Madrid',
  'barcelona': 'Europe/Madrid',
  'amsterdam': 'Europe/Amsterdam',
  'brussels': 'Europe/Brussels',
  'vienna': 'Europe/Vienna',
  'zurich': 'Europe/Zurich',
  'munich': 'Europe/Berlin',
  'frankfurt': 'Europe/Berlin',
  'dublin': 'Europe/Dublin',
  'lisbon': 'Europe/Lisbon',
  'athens': 'Europe/Athens',
  'stockholm': 'Europe/Stockholm',
  'copenhagen': 'Europe/Copenhagen',
  'oslo': 'Europe/Oslo',
  'helsinki': 'Europe/Helsinki',
  'prague': 'Europe/Prague',
  'budapest': 'Europe/Budapest',
  'warsaw': 'Europe/Warsaw',
  
  // Asia
  'tokyo': 'Asia/Tokyo',
  'seoul': 'Asia/Seoul',
  'beijing': 'Asia/Shanghai',
  'shanghai': 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  'singapore': 'Asia/Singapore',
  'bangkok': 'Asia/Bangkok',
  'kuala lumpur': 'Asia/Kuala_Lumpur',
  'jakarta': 'Asia/Jakarta',
  'manila': 'Asia/Manila',
  'taipei': 'Asia/Taipei',
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'dubai': 'Asia/Dubai',
  'abu dhabi': 'Asia/Dubai',
  'tel aviv': 'Asia/Jerusalem',
  'istanbul': 'Europe/Istanbul',
  
  // Oceania
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Melbourne',
  'brisbane': 'Australia/Brisbane',
  'perth': 'Australia/Perth',
  'auckland': 'Pacific/Auckland',
  
  // South America
  'sao paulo': 'America/Sao_Paulo',
  'rio de janeiro': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'lima': 'America/Lima',
  'bogota': 'America/Bogota',
  'santiago': 'America/Santiago',
  
  // Africa
  'cairo': 'Africa/Cairo',
  'johannesburg': 'Africa/Johannesburg',
  'cape town': 'Africa/Johannesburg',
  'nairobi': 'Africa/Nairobi',
  'lagos': 'Africa/Lagos',
  'casablanca': 'Africa/Casablanca',
};

// Approximate UTC offsets for when we can't use Intl API
// (These are standard time - DST may vary)
const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5,
  'America/Chicago': -6,
  'America/Denver': -7,
  'America/Los_Angeles': -8,
  'America/Phoenix': -7,
  'America/Toronto': -5,
  'America/Vancouver': -8,
  'Europe/London': 0,
  'Europe/Paris': 1,
  'Europe/Berlin': 1,
  'Europe/Rome': 1,
  'Europe/Madrid': 1,
  'Europe/Amsterdam': 1,
  'Europe/Brussels': 1,
  'Europe/Vienna': 1,
  'Europe/Zurich': 1,
  'Europe/Dublin': 0,
  'Europe/Lisbon': 0,
  'Europe/Athens': 2,
  'Europe/Stockholm': 1,
  'Europe/Copenhagen': 1,
  'Europe/Oslo': 1,
  'Europe/Helsinki': 2,
  'Europe/Prague': 1,
  'Europe/Budapest': 1,
  'Europe/Warsaw': 1,
  'Europe/Istanbul': 3,
  'Asia/Tokyo': 9,
  'Asia/Seoul': 9,
  'Asia/Shanghai': 8,
  'Asia/Hong_Kong': 8,
  'Asia/Singapore': 8,
  'Asia/Bangkok': 7,
  'Asia/Kuala_Lumpur': 8,
  'Asia/Jakarta': 7,
  'Asia/Manila': 8,
  'Asia/Taipei': 8,
  'Asia/Kolkata': 5.5,
  'Asia/Dubai': 4,
  'Asia/Jerusalem': 2,
  'Asia/Makassar': 8,
  'Australia/Sydney': 10,
  'Australia/Melbourne': 10,
  'Australia/Brisbane': 10,
  'Australia/Perth': 8,
  'Pacific/Auckland': 12,
  'Pacific/Honolulu': -10,
  'America/Sao_Paulo': -3,
  'America/Argentina/Buenos_Aires': -3,
  'America/Lima': -5,
  'America/Bogota': -5,
  'America/Santiago': -3,
  'Africa/Cairo': 2,
  'Africa/Johannesburg': 2,
  'Africa/Nairobi': 3,
  'Africa/Lagos': 1,
  'Africa/Casablanca': 1,
};

export interface JetLagImpact {
  hoursDifference: number;
  impact: 'minimal' | 'moderate' | 'significant' | 'severe';
  direction: 'eastward' | 'westward' | 'same';
  pacingModifier: number;
  recoveryDays: number;
  arrivalDayMaxActivities: number;
  constraints: string[];
}

/**
 * Resolve a city name to an IANA timezone string
 */
export function resolveTimezone(cityName: string): string | null {
  if (!cityName) return null;
  
  const normalized = cityName.toLowerCase().trim();
  if (!normalized) return null;
  
  // Direct lookup
  if (CITY_TIMEZONE_MAP[normalized]) {
    return CITY_TIMEZONE_MAP[normalized];
  }
  
  // Whole-word match only — prevents short keys like 'la', 'dc', 'nyc'
  // from substring-matching unrelated input (e.g. "unmappedcityname" contains "dc").
  const tokens = normalized.split(/[\s,.\-_/]+/).filter(Boolean);
  const tokenSet = new Set(tokens);

  for (const [city, tz] of Object.entries(CITY_TIMEZONE_MAP)) {
    const cityTokens = city.split(/\s+/);
    // Forward: every token of the city key appears as a whole token in input.
    if (cityTokens.every(t => tokenSet.has(t))) return tz;
    // Reverse: input is a strict substring of a multi-word key (e.g. "york" → "new york").
    // Only allowed for ≥2-word keys AND input length ≥ 4 chars to avoid 'la'/'dc' false positives.
    if (cityTokens.length >= 2 && normalized.length >= 4 && city.includes(normalized)) {
      return tz;
    }
  }
  
  return null;
}

/**
 * Get UTC offset for a timezone (approximate, doesn't account for DST perfectly)
 */
function getTimezoneOffset(timezone: string): number {
  // Try using Intl API first (more accurate with DST)
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    
    if (tzPart) {
      // Parse "GMT+5:30" or "GMT-8" format
      const match = tzPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3] || '0', 10);
        return sign * (hours + minutes / 60);
      }
    }
  } catch (e) {
    // Fall through to static lookup
  }
  
  // Fallback to static offsets
  return TIMEZONE_OFFSETS[timezone] ?? 0;
}

/**
 * Calculate the timezone difference between origin and destination
 */
export function calculateTimezoneOffset(
  originTimezone: string | null,
  destinationTimezone: string | null
): { hoursDiff: number; direction: 'eastward' | 'westward' | 'same' } {
  if (!originTimezone || !destinationTimezone) {
    return { hoursDiff: 0, direction: 'same' };
  }
  
  const originOffset = getTimezoneOffset(originTimezone);
  const destOffset = getTimezoneOffset(destinationTimezone);
  
  // Positive difference = traveling east (e.g., NYC to Paris)
  // Negative difference = traveling west (e.g., Paris to NYC)
  const rawDiff = destOffset - originOffset;
  
  // Handle crossing the date line (normalize to -12 to +12)
  let hoursDiff = rawDiff;
  if (hoursDiff > 12) hoursDiff -= 24;
  if (hoursDiff < -12) hoursDiff += 24;
  
  const direction: 'eastward' | 'westward' | 'same' = 
    hoursDiff > 0 ? 'eastward' : 
    hoursDiff < 0 ? 'westward' : 'same';
  
  return { hoursDiff: Math.abs(hoursDiff), direction };
}

/**
 * Calculate jet lag impact based on timezone difference
 */
export function calculateJetLagImpact(
  originCity: string | null,
  destinationTimezone: string | null,
  flightDurationHours?: number,
  jetLagSensitivity: 'low' | 'moderate' | 'high' = 'moderate'
): JetLagImpact {
  const originTimezone = originCity ? resolveTimezone(originCity) : null;
  const { hoursDiff, direction } = calculateTimezoneOffset(originTimezone, destinationTimezone);
  
  // Determine impact level
  let impact: JetLagImpact['impact'];
  let pacingModifier = 0;
  let recoveryDays = 0;
  let arrivalDayMaxActivities = 3;
  const constraints: string[] = [];
  
  if (hoursDiff <= 3) {
    impact = 'minimal';
    arrivalDayMaxActivities = 3;
    recoveryDays = 0;
    constraints.push('Minor timezone adjustment - normal pacing acceptable');
  } else if (hoursDiff <= 6) {
    impact = 'moderate';
    pacingModifier = -1;
    arrivalDayMaxActivities = 2;
    recoveryDays = 0.5;
    constraints.push('Expect early waking or afternoon fatigue');
    constraints.push('Light activities only on arrival day (max 2)');
    constraints.push('Include afternoon rest option on Day 2');
  } else if (hoursDiff <= 9) {
    impact = 'significant';
    pacingModifier = -1;
    arrivalDayMaxActivities = 1;
    recoveryDays = 1;
    constraints.push(`${hoursDiff} hour time difference - significant adjustment needed`);
    constraints.push('Arrival day: 1 light activity maximum, preferably none');
    constraints.push('Day 2 should be lighter than normal');
    constraints.push('Include afternoon nap/rest options for first 2 days');
  } else {
    impact = 'severe';
    pacingModifier = -2;
    arrivalDayMaxActivities = 0;
    recoveryDays = 2;
    constraints.push(`${hoursDiff} hour time difference - body clock fully inverted`);
    constraints.push('Arrival day: REST ONLY, no scheduled activities');
    constraints.push('Days 1-2 significantly reduced pacing');
    constraints.push('Mandatory afternoon rest blocks for first 2-3 days');
  }
  
  // Adjust for direction (eastward is harder)
  if (direction === 'eastward' && hoursDiff > 3) {
    constraints.push('Eastward travel is harder to adjust - expect earlier fatigue');
    if (impact === 'moderate') {
      recoveryDays += 0.5;
    }
  }
  
  // Adjust for flight duration (long flights add fatigue regardless of timezone)
  if (flightDurationHours && flightDurationHours >= 9) {
    constraints.push(`${flightDurationHours}+ hour flight adds physical fatigue`);
    if (impact === 'minimal') {
      impact = 'moderate';
      arrivalDayMaxActivities = Math.min(arrivalDayMaxActivities, 2);
    }
  }
  
  // Adjust for sensitivity
  if (jetLagSensitivity === 'high') {
    pacingModifier -= 1;
    recoveryDays += 0.5;
    constraints.push('High jet lag sensitivity - extra recovery time needed');
  } else if (jetLagSensitivity === 'low' && impact !== 'severe') {
    recoveryDays = Math.max(0, recoveryDays - 0.5);
  }
  
  return {
    hoursDifference: hoursDiff,
    impact,
    direction,
    pacingModifier,
    recoveryDays: Math.ceil(recoveryDays),
    arrivalDayMaxActivities,
    constraints,
  };
}

/**
 * Build prompt section for jet lag considerations
 */
export function buildJetLagPrompt(
  originCity: string | null,
  destinationTimezone: string | null,
  flightDurationHours?: number,
  arrivalTime?: string, // "morning" | "afternoon" | "evening" | "night"
  jetLagSensitivity: 'low' | 'moderate' | 'high' = 'moderate'
): string {
  const impact = calculateJetLagImpact(
    originCity,
    destinationTimezone,
    flightDurationHours,
    jetLagSensitivity
  );
  
  if (impact.impact === 'minimal' && !flightDurationHours) {
    return ''; // No significant jet lag guidance needed
  }
  
  const arrivalStrategy = getArrivalTimeStrategy(arrivalTime || 'afternoon', impact.impact);
  
  return `
═══════════════════════════════════════════════════════════════════════════
JET LAG CALCULATION
═══════════════════════════════════════════════════════════════════════════

Origin: ${originCity || 'Unknown'}
Time difference: ${impact.hoursDifference} hours ${impact.direction !== 'same' ? `(${impact.direction})` : ''}
Impact level: ${impact.impact.toUpperCase()}
${flightDurationHours ? `Flight duration: ~${flightDurationHours} hours` : ''}

CONSTRAINTS FOR ARRIVAL PERIOD:
${impact.constraints.map(c => `• ${c}`).join('\n')}

Pacing modifier: ${impact.pacingModifier}
Recovery days needed: ${impact.recoveryDays}
Arrival day max activities: ${impact.arrivalDayMaxActivities}

${arrivalStrategy ? `
ARRIVAL TIME STRATEGY (${arrivalTime || 'afternoon'}):
${arrivalStrategy}
` : ''}

${impact.impact === 'severe' ? `
⚠️ SEVERE JET LAG WARNING:
This traveler's body clock is fully inverted. Day 1 activities should be 
"hotel exploration" and "easy neighborhood walk" at most. Real sightseeing 
starts Day 2 (cautiously) or Day 3 (more normally).
` : ''}

═══════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Get strategy based on arrival time
 */
function getArrivalTimeStrategy(
  arrivalTime: string,
  impact: JetLagImpact['impact']
): string {
  const strategies: Record<string, { strategy: string; danger: string }> = {
    'morning': {
      strategy: 'Power through until evening. Light activities. Early dinner.',
      danger: 'Afternoon crash likely. Schedule nap option around 14:00-15:00.',
    },
    'afternoon': {
      strategy: 'One light activity possible. Dinner and early bed.',
      danger: "Don't nap too late or won't sleep tonight.",
    },
    'evening': {
      strategy: 'Dinner and bed. Tomorrow is real Day 1.',
      danger: "May wake at 3am. That's OK - read or rest quietly.",
    },
    'night': {
      strategy: 'Early hotel check-in critical. Sleep first. Afternoon start.',
      danger: "Don't try to start at 9am after overnight flight.",
    },
  };
  
  const normalized = arrivalTime.toLowerCase();
  const key = normalized.includes('morn') ? 'morning' :
              normalized.includes('after') ? 'afternoon' :
              normalized.includes('even') ? 'evening' :
              normalized.includes('night') || normalized.includes('red') ? 'night' :
              'afternoon';
  
  const strat = strategies[key];
  
  if (impact === 'minimal') {
    return `Strategy: ${strat.strategy}`;
  }
  
  return `Strategy: ${strat.strategy}\n⚠️ Warning: ${strat.danger}`;
}
