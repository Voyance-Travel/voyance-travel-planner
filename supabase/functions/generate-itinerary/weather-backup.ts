/**
 * Weather Backup Enforcement
 * 
 * Ensures outdoor activities have rain/weather alternatives
 * and applies season-specific scheduling rules.
 */

export interface WeatherContext {
  season: 'peak_summer' | 'winter' | 'rainy_season' | 'shoulder_season' | 'dry_season';
  averageTemp?: number; // Celsius
  precipitationChance?: number; // 0-100
  constraints: string[];
  scheduleAdjustments: string[];
}

export interface ActivityWeatherRequirement {
  category: string;
  isOutdoor: boolean;
  requiresBackup: boolean;
  suggestedBackups?: string[];
}

// Categories that are primarily outdoor
const OUTDOOR_CATEGORIES = [
  'nature',
  'adventure',
  'beach',
  'hiking',
  'water sports',
  'outdoor market',
  'park',
  'garden',
  'walking tour',
  'street food',
  'outdoor dining',
  'rooftop',
  'sightseeing',
];

// Categories that work in any weather
const INDOOR_CATEGORIES = [
  'museum',
  'gallery',
  'shopping',
  'spa',
  'wellness',
  'cooking class',
  'indoor market',
  'cinema',
  'theater',
  'restaurant',
  'café',
  'bar',
  'nightclub',
];

/**
 * Determine season based on destination and travel dates
 */
export function determineSeason(
  destination: string,
  startDate: string,
  weatherData?: { avgTemp?: number; precipitation?: number }
): WeatherContext {
  const month = new Date(startDate).getMonth() + 1; // 1-12
  const destLower = destination.toLowerCase();
  
  // Default constraints and adjustments
  const constraints: string[] = [];
  const scheduleAdjustments: string[] = [];
  
  // Southeast Asia rainy season (May-October)
  const seAsiaCountries = ['thailand', 'vietnam', 'indonesia', 'bali', 'cambodia', 'laos', 'myanmar', 'philippines'];
  if (seAsiaCountries.some(c => destLower.includes(c))) {
    if (month >= 5 && month <= 10) {
      return {
        season: 'rainy_season',
        averageTemp: weatherData?.avgTemp,
        precipitationChance: weatherData?.precipitation || 70,
        constraints: [
          '☔ RAINY SEASON: Afternoon showers are common (typically 14:00-17:00)',
          'Every outdoor activity MUST have an indoor backup',
          'Morning activities preferred before rain',
          'Covered restaurant options for all meals',
        ],
        scheduleAdjustments: [
          'Schedule outdoor activities before 13:00',
          'Plan indoor activities for 14:00-17:00 window',
          'Evening outdoor dining usually safe after 18:00',
        ],
      };
    }
  }
  
  // Mediterranean/European summer
  const euroSummerDests = ['spain', 'italy', 'greece', 'portugal', 'southern france', 'croatia', 'turkey'];
  if (euroSummerDests.some(c => destLower.includes(c)) && (month >= 6 && month <= 8)) {
    return {
      season: 'peak_summer',
      averageTemp: weatherData?.avgTemp || 32,
      constraints: [
        '🌡️ PEAK SUMMER HEAT: Midday temperatures can exceed 35°C/95°F',
        'Avoid outdoor activities 12:00-16:00 (hottest hours)',
        'Siesta culture is real - embrace the afternoon break',
        'Hydration is critical - note water bottle refill spots',
      ],
      scheduleAdjustments: [
        'Early morning activities (before 11:00) or late afternoon (after 17:00)',
        '12:00-16:00: Indoor activities, lunch, rest, or pool time',
        'Evening outdoor dining preferred (19:00+)',
        'Consider "split day" format: morning activity → long lunch/rest → evening activity',
      ],
    };
  }
  
  // Winter destinations
  if (month >= 11 || month <= 2) {
    const northernDests = ['europe', 'uk', 'scandinavia', 'canada', 'new york', 'chicago', 'boston', 'japan', 'korea'];
    if (northernDests.some(c => destLower.includes(c))) {
      return {
        season: 'winter',
        averageTemp: weatherData?.avgTemp,
        constraints: [
          '❄️ WINTER: Shorter daylight hours (dark by 16:30-17:00)',
          'Indoor alternatives needed for all activities',
          'Cold weather logistics - layering required',
          'Holiday closures may affect schedules',
        ],
        scheduleAdjustments: [
          'Start activities a bit later (museums often less crowded in winter)',
          'Plan to be indoors or finished outdoor activities before dark',
          'Cozy restaurants and cafés for longer meals',
          'Include warming breaks (hot chocolate, coffee stops)',
        ],
      };
    }
  }
  
  // Shoulder season (general)
  if ((month >= 3 && month <= 5) || (month >= 9 && month <= 10)) {
    return {
      season: 'shoulder_season',
      averageTemp: weatherData?.avgTemp,
      constraints: [
        '🌤️ SHOULDER SEASON: Variable weather possible',
        'Check for seasonal closures',
        'Some outdoor venues may have reduced hours',
      ],
      scheduleAdjustments: [
        'Flexible scheduling recommended',
        'Have indoor backup for outdoor plans',
        'Best balance of weather and crowd levels',
      ],
    };
  }
  
  // Default - dry/good season
  return {
    season: 'dry_season',
    averageTemp: weatherData?.avgTemp,
    constraints: [
      'Generally favorable weather expected',
      'Still have backup plans for unexpected weather',
    ],
    scheduleAdjustments: [],
  };
}

/**
 * Determine if an activity category is primarily outdoor
 */
export function isOutdoorActivity(category: string, title?: string): boolean {
  const catLower = category.toLowerCase();
  const titleLower = (title || '').toLowerCase();
  
  // Check explicit outdoor indicators
  if (OUTDOOR_CATEGORIES.some(c => catLower.includes(c) || titleLower.includes(c))) {
    return true;
  }
  
  // Check for outdoor keywords in title
  const outdoorKeywords = ['beach', 'hike', 'garden', 'park', 'walk', 'rooftop', 'terrace', 'outdoor', 'lake', 'mountain', 'nature', 'cycling', 'kayak', 'surf', 'sunset'];
  if (outdoorKeywords.some(kw => titleLower.includes(kw))) {
    return true;
  }
  
  // Check explicit indoor indicators
  if (INDOOR_CATEGORIES.some(c => catLower.includes(c))) {
    return false;
  }
  
  // Ambiguous - default to requiring backup
  return false;
}

/**
 * Get suggested indoor alternatives for outdoor activities
 */
export function getSuggestedBackups(category: string, destination: string): string[] {
  const catLower = category.toLowerCase();
  
  const backupMap: Record<string, string[]> = {
    'beach': ['spa/wellness center', 'aquarium', 'indoor pool', 'shopping mall'],
    'nature': ['natural history museum', 'botanical garden (covered areas)', 'nature documentary screening'],
    'hiking': ['gym/fitness center', 'indoor climbing wall', 'spa', 'museum'],
    'garden': ['greenhouse if available', 'flower market', 'botanical museum'],
    'walking tour': ['covered market tour', 'museum district exploration', 'underground/metro tour'],
    'outdoor market': ['covered market', 'food hall', 'department store food floor'],
    'sightseeing': ['museum', 'gallery', 'covered observation deck', 'indoor historic site'],
    'rooftop': ['hotel lobby bar', 'indoor restaurant with view', 'observation deck'],
    'water sports': ['spa', 'indoor pool', 'aquarium', 'maritime museum'],
  };
  
  // Find matching category
  for (const [key, backups] of Object.entries(backupMap)) {
    if (catLower.includes(key)) {
      return backups;
    }
  }
  
  // Generic backups
  return ['museum', 'shopping', 'spa', 'cooking class', 'local café'];
}

/**
 * Build weather backup enforcement prompt
 */
export function buildWeatherBackupPrompt(
  destination: string,
  startDate: string,
  weatherData?: { avgTemp?: number; precipitation?: number }
): string {
  const weather = determineSeason(destination, startDate, weatherData);
  
  if (weather.season === 'dry_season' && weather.constraints.length <= 2) {
    // Minimal prompt for good weather
    return `
═══════════════════════════════════════════════════════════════════════════
WEATHER AWARENESS
═══════════════════════════════════════════════════════════════════════════

Expected conditions: Generally favorable
Still include rain backup note for outdoor activities.

For each outdoor activity, add:
☔ If weather turns: [brief indoor alternative]

═══════════════════════════════════════════════════════════════════════════
`;
  }
  
  return `
═══════════════════════════════════════════════════════════════════════════
WEATHER CONSIDERATIONS: ${weather.season.replace('_', ' ').toUpperCase()}
═══════════════════════════════════════════════════════════════════════════

${weather.averageTemp ? `Expected temperature: ~${weather.averageTemp}°C / ~${Math.round(weather.averageTemp * 9/5 + 32)}°F` : ''}
${weather.precipitationChance ? `Precipitation chance: ${weather.precipitationChance}%` : ''}

CONSTRAINTS:
${weather.constraints.map(c => c).join('\n')}

${weather.scheduleAdjustments.length > 0 ? `
SCHEDULING ADJUSTMENTS:
${weather.scheduleAdjustments.map(s => `• ${s}`).join('\n')}
` : ''}

BACKUP PLAN REQUIREMENT:
For EVERY outdoor activity, include a backup:

✅ CORRECT FORMAT:
"10:00 - Beach time at Playa Norte
 ☔ If rain: Explore Isla Mujeres downtown shops and cafés"

❌ WRONG (no backup):
"10:00 - Beach time at Playa Norte"

${weather.season === 'rainy_season' ? `
⚠️ RAINY SEASON CRITICAL:
- Afternoon rain is EXPECTED, not exceptional
- Morning outdoor, afternoon indoor is the default pattern
- EVERY outdoor activity needs a specific, named alternative
` : ''}

${weather.season === 'peak_summer' ? `
🌡️ HEAT MANAGEMENT:
- 12:00-16:00 is "danger zone" for outdoor activities
- Build in siesta/rest time
- Early starts (before 10:00) for major outdoor attractions
- Evening activities are often more pleasant
` : ''}

═══════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Validate that outdoor activities have weather backups
 */
export function validateWeatherBackups(
  activities: Array<{ title: string; category?: string; description?: string }>,
  season: WeatherContext['season']
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  // Only enforce strictly for rainy/variable seasons
  if (season !== 'rainy_season' && season !== 'shoulder_season') {
    return { valid: true, missing: [] };
  }
  
  for (const activity of activities) {
    if (isOutdoorActivity(activity.category || '', activity.title)) {
      // Check if description includes backup indicator
      const desc = (activity.description || '').toLowerCase();
      const hasBackup = desc.includes('if rain') || 
                        desc.includes('if weather') ||
                        desc.includes('alternative:') ||
                        desc.includes('backup:') ||
                        desc.includes('☔');
      
      if (!hasBackup) {
        missing.push(activity.title);
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}
