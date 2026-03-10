// =============================================================================
// MUST-DO PRIORITIES - Hard Requirement Injection for User-Specified Activities
// =============================================================================
// When users say "We HAVE to see the Colosseum" or "Don't miss Tsukiji Market",
// these become non-negotiable requirements that MUST appear in the itinerary.
// 
// Priority levels:
// - MUST: Guaranteed to appear, scheduled on best day
// - HIGH: Will appear unless major conflict
// - NICE: Will try to include if time/location allows
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

export type ActivityType = 'all_day_event' | 'half_day_event' | 'standard' | 'quick_stop';

export interface MustDoPriority {
  id: string;
  title: string;
  /** User's original text describing what they want */
  userDescription: string;
  /** Parsed/normalized activity name */
  activityName: string;
  /** Priority level */
  priority: 'must' | 'high' | 'nice';
  /** Activity type classification for duration-aware scheduling */
  activityType?: ActivityType;
  /** Preferred day number (optional) */
  preferredDay?: number;
  /** Preferred time of day */
  preferredTime?: 'morning' | 'afternoon' | 'evening' | 'any';
  /** Location for geographic clustering */
  location?: string;
  /** Venue/location name from cross-referenced event data */
  venueName?: string;
  /** Event dates from cross-referenced local events */
  eventDates?: string;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Whether this typically requires advance booking */
  requiresBooking?: boolean;
  /** Maximum acceptable day (e.g., "before we leave Rome") */
  maxDay?: number;
  /** Minimum day (e.g., "after we're settled") */
  minDay?: number;
  /** Explicit start time parsed from user text (e.g., "9am-5pm" → "09:00") */
  explicitStartTime?: string;
  /** Explicit end time parsed from user text (e.g., "9am-5pm" → "17:00") */
  explicitEndTime?: string;
}

export interface ScheduledMustDo {
  priority: MustDoPriority;
  assignedDay: number;
  assignedTime: string;
  rationale: string;
  /** Whether a backup day exists if conflict arises */
  hasBackup: boolean;
  backupDay?: number;
}

export interface MustDoAnalysis {
  /** All must-do items with scheduling suggestions */
  scheduled: ScheduledMustDo[];
  /** Items that couldn't be scheduled (conflicts) */
  unschedulable: Array<{ priority: MustDoPriority; reason: string }>;
  /** Day assignments summary */
  dayAssignments: Map<number, MustDoPriority[]>;
  /** Pre-built prompt section */
  promptSection: string;
}

// =============================================================================
// EVENT TYPE PATTERNS — classifies activities by keyword into scheduling types
// =============================================================================

interface EventPattern {
  type: ActivityType;
  duration: number; // minutes
  bestTime: 'morning' | 'afternoon' | 'evening' | 'any';
  bookingRequired: boolean;
}

const EVENT_PATTERNS: Array<{ keywords: string[]; pattern: EventPattern }> = [
  // ── All-day sporting events ──
  { keywords: ['us open', 'u.s. open'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['wimbledon'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['french open', 'roland garros'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['australian open'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['super bowl'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'afternoon', bookingRequired: true } },
  { keywords: ['world cup'], pattern: { type: 'all_day_event', duration: 360, bestTime: 'any', bookingRequired: true } },
  { keywords: ['olympics', 'olympic games'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['formula 1', 'f1 grand prix', 'grand prix'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['world series'], pattern: { type: 'half_day_event', duration: 240, bestTime: 'evening', bookingRequired: true } },
  { keywords: ['nba finals', 'nfl game', 'nba game', 'nhl game', 'mlb game', 'mls game'], pattern: { type: 'half_day_event', duration: 240, bestTime: 'evening', bookingRequired: true } },
  { keywords: ['champions league', 'premier league', 'la liga', 'serie a', 'bundesliga'], pattern: { type: 'half_day_event', duration: 240, bestTime: 'evening', bookingRequired: true } },
  { keywords: ['rugby world cup', 'cricket world cup', 'tour de france'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: true } },
  
  // ── All-day festivals & conventions ──
  { keywords: ['coachella'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'afternoon', bookingRequired: true } },
  { keywords: ['burning man'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'any', bookingRequired: true } },
  { keywords: ['lollapalooza', 'glastonbury', 'bonnaroo', 'tomorrowland', 'ultra music'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'afternoon', bookingRequired: true } },
  { keywords: ['comic-con', 'comic con', 'comiccon'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['sxsw', 'south by southwest'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['ces ', 'consumer electronics show'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['oktoberfest'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: false } },
  { keywords: ['carnival', 'carnaval', 'mardi gras'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: false } },
  { keywords: ['festival'], pattern: { type: 'half_day_event', duration: 240, bestTime: 'afternoon', bookingRequired: false } },
  { keywords: ['convention', 'expo', 'trade show', 'fan expo'], pattern: { type: 'all_day_event', duration: 360, bestTime: 'morning', bookingRequired: true } },

  // ── Theme parks ──
  { keywords: ['disneyland', 'disney world', 'magic kingdom', 'disney'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['universal studios', 'universal orlando', 'islands of adventure'], pattern: { type: 'all_day_event', duration: 480, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['six flags', 'cedar point', 'legoland', 'seaworld', 'busch gardens'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['theme park', 'amusement park', 'water park'], pattern: { type: 'all_day_event', duration: 420, bestTime: 'morning', bookingRequired: true } },
  
  // ── Half-day events ──
  { keywords: ['broadway', 'west end', 'musical', 'theater show', 'theatre show'], pattern: { type: 'half_day_event', duration: 180, bestTime: 'evening', bookingRequired: true } },
  { keywords: ['concert'], pattern: { type: 'half_day_event', duration: 210, bestTime: 'evening', bookingRequired: true } },
  { keywords: ['opera', 'ballet', 'symphony', 'philharmonic'], pattern: { type: 'half_day_event', duration: 180, bestTime: 'evening', bookingRequired: true } },
  { keywords: ['comedy show', 'stand-up', 'standup', 'improv show'], pattern: { type: 'half_day_event', duration: 150, bestTime: 'evening', bookingRequired: true } },
  { keywords: ['guided tour', 'walking tour', 'food tour', 'bike tour'], pattern: { type: 'half_day_event', duration: 210, bestTime: 'morning', bookingRequired: true } },
  { keywords: ['cooking class', 'wine tasting', 'beer tasting'], pattern: { type: 'half_day_event', duration: 180, bestTime: 'afternoon', bookingRequired: true } },
  { keywords: ['spa day', 'hammam', 'onsen', 'thermal bath'], pattern: { type: 'half_day_event', duration: 210, bestTime: 'afternoon', bookingRequired: true } },
  { keywords: ['game', 'match', 'bout', 'fight night'], pattern: { type: 'half_day_event', duration: 210, bestTime: 'evening', bookingRequired: true } },
  
  // ── Quick stops ──
  { keywords: ['statue', 'monument', 'memorial'], pattern: { type: 'quick_stop', duration: 45, bestTime: 'any', bookingRequired: false } },
  { keywords: ['bridge', 'viewpoint', 'lookout', 'overlook'], pattern: { type: 'quick_stop', duration: 30, bestTime: 'any', bookingRequired: false } },
  { keywords: ['photo op', 'photo spot', 'instagram'], pattern: { type: 'quick_stop', duration: 20, bestTime: 'any', bookingRequired: false } },
  { keywords: ['fountain', 'plaza', 'square', 'piazza'], pattern: { type: 'quick_stop', duration: 30, bestTime: 'any', bookingRequired: false } },
];

function matchEventPattern(text: string): EventPattern | null {
  const lower = text.toLowerCase();
  for (const { keywords, pattern } of EVENT_PATTERNS) {
    if (keywords.some(kw => lower.includes(kw))) {
      return pattern;
    }
  }
  return null;
}

// =============================================================================
// COMMON LANDMARKS DATABASE (for smart parsing)
// =============================================================================

const KNOWN_LANDMARKS: Record<string, {
  city: string;
  duration: number;
  bestTime: 'morning' | 'afternoon' | 'evening' | 'any';
  bookingRequired: boolean;
  neighborhood?: string;
}> = {
  // Rome
  'colosseum': { city: 'rome', duration: 180, bestTime: 'morning', bookingRequired: true },
  'vatican': { city: 'rome', duration: 300, bestTime: 'morning', bookingRequired: true },
  'vatican museums': { city: 'rome', duration: 240, bestTime: 'morning', bookingRequired: true },
  'sistine chapel': { city: 'rome', duration: 60, bestTime: 'morning', bookingRequired: true },
  'trevi fountain': { city: 'rome', duration: 30, bestTime: 'evening', bookingRequired: false },
  'pantheon': { city: 'rome', duration: 60, bestTime: 'any', bookingRequired: false },
  
  // Paris
  'eiffel tower': { city: 'paris', duration: 180, bestTime: 'evening', bookingRequired: true },
  'louvre': { city: 'paris', duration: 300, bestTime: 'morning', bookingRequired: true },
  'notre dame': { city: 'paris', duration: 60, bestTime: 'morning', bookingRequired: false },
  'montmartre': { city: 'paris', duration: 180, bestTime: 'afternoon', bookingRequired: false },
  'versailles': { city: 'paris', duration: 360, bestTime: 'morning', bookingRequired: true },
  
  // Tokyo
  'tsukiji': { city: 'tokyo', duration: 180, bestTime: 'morning', bookingRequired: false },
  'tsukiji market': { city: 'tokyo', duration: 180, bestTime: 'morning', bookingRequired: false },
  'senso-ji': { city: 'tokyo', duration: 120, bestTime: 'morning', bookingRequired: false },
  'shibuya crossing': { city: 'tokyo', duration: 30, bestTime: 'evening', bookingRequired: false },
  'teamlab': { city: 'tokyo', duration: 180, bestTime: 'any', bookingRequired: true },
  'meiji shrine': { city: 'tokyo', duration: 90, bestTime: 'morning', bookingRequired: false },
  
  // London
  'tower of london': { city: 'london', duration: 180, bestTime: 'morning', bookingRequired: true },
  'big ben': { city: 'london', duration: 30, bestTime: 'any', bookingRequired: false },
  'british museum': { city: 'london', duration: 240, bestTime: 'morning', bookingRequired: false },
  'buckingham palace': { city: 'london', duration: 60, bestTime: 'morning', bookingRequired: false },
  
  // New York
  'statue of liberty': { city: 'new york', duration: 240, bestTime: 'morning', bookingRequired: true },
  'empire state': { city: 'new york', duration: 120, bestTime: 'evening', bookingRequired: true },
  'central park': { city: 'new york', duration: 180, bestTime: 'morning', bookingRequired: false },
  'times square': { city: 'new york', duration: 60, bestTime: 'evening', bookingRequired: false },
  'met': { city: 'new york', duration: 240, bestTime: 'any', bookingRequired: false },
  'metropolitan museum': { city: 'new york', duration: 240, bestTime: 'any', bookingRequired: false },
};

// =============================================================================
// PARSING USER INPUT
// =============================================================================

export function parseMustDoInput(
  userInput: string,
  destination: string,
  forceAllMust: boolean = false,
  tripStartDate?: string,
  totalDays?: number
): MustDoPriority[] {
  const priorities: MustDoPriority[] = [];

  const lines = userInput
    .split(/\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Smart Finish research context includes many instructional lines.
  // When this marker exists, only parse bullet entries as candidate anchors.
  const hasStructuredResearchSection = lines.some(line =>
    line.toLowerCase().includes("user's researched places & activities")
  );

  const items: Array<{ text: string; preferredDay?: number }> = [];
  let currentDay: number | undefined;

  for (const line of lines) {
    const normalized = line.toLowerCase();

    const dayMatch = line.match(/^\s*day\s+(\d+)\s*:/i);
    if (dayMatch) {
      currentDay = Number(dayMatch[1]);
      continue;
    }

    // Skip headings/meta lines
    if (
      normalized.startsWith("user's ") ||
      normalized.startsWith('user preferences:') ||
      normalized.startsWith('trip vibe/intent:') ||
      normalized.startsWith('trip priorities:') ||
      normalized.startsWith('smart_finish_source_notes') ||
      normalized.startsWith('practical tips from') ||
      normalized.startsWith('accommodation notes') ||
      normalized.includes('════════')
    ) {
      continue;
    }

    // In structured Smart Finish text, only bullets are actual user anchors.
    if (hasStructuredResearchSection && !/^\s*-\s+/.test(line)) {
      continue;
    }

    const subItems = line.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    for (const sub of subItems) {
      const cleaned = sub.replace(/^\s*-\s*/, '').trim();
      if (!cleaned || cleaned.length < 2) continue;
      items.push({ text: cleaned, preferredDay: currentDay });
    }
  }

  // ── Day-of-week resolution: map "Friday", "Saturday" etc. to trip day numbers ──
  if (tripStartDate) {
    try {
      const startDate = new Date(tripStartDate + 'T00:00:00');
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      for (const item of items) {
        if (item.preferredDay) continue; // already has a day assignment
        const lower = item.text.toLowerCase();

        for (let dow = 0; dow < 7; dow++) {
          if (lower.includes(dayNames[dow])) {
            const startDow = startDate.getDay();
            let dayOffset = dow - startDow;
            if (dayOffset < 0) dayOffset += 7;
            const tripDay = dayOffset + 1; // 1-indexed
            if (!totalDays || tripDay <= totalDays) {
              item.preferredDay = tripDay;
              console.log(`[MustDo] Day-of-week resolution: "${item.text}" → Day ${tripDay} (${dayNames[dow]})`);
            }
            break;
          }
        }
      }
    } catch (e) {
      console.warn(`[MustDo] Failed to parse tripStartDate "${tripStartDate}":`, e);
    }
  }

  // ── Multi-day expansion: "both days" / "every day" / "all N days" ──
  const effectiveTotalDays = totalDays || 7; // fallback
  const expandedItems: typeof items = [];
  for (const item of items) {
    const lower = item.text.toLowerCase();
    const isMultiDay = /both days|every day|all \d+ days|each day|all days/i.test(lower);

    if (isMultiDay && effectiveTotalDays > 1) {
      const dayCountMatch = lower.match(/all (\d+) days/);
      const numDays = dayCountMatch ? parseInt(dayCountMatch[1]) : Math.max(1, effectiveTotalDays - 1);

      for (let d = 1; d <= Math.min(numDays, effectiveTotalDays); d++) {
        expandedItems.push({ text: item.text, preferredDay: d });
      }
      console.log(`[MustDo] Multi-day expansion: "${item.text}" → ${Math.min(numDays, effectiveTotalDays)} entries`);
    } else {
      expandedItems.push(item);
    }
  }

  for (const item of expandedItems) {
    const priority = parseItem(item.text, destination);
    if (!priority) continue;

    if (forceAllMust) {
      priority.priority = 'must';
    }

    if (item.preferredDay && !priority.preferredDay) {
      priority.preferredDay = item.preferredDay;
    }

    priorities.push(priority);
  }

  return priorities;
}

function parseItem(item: string, destination: string): MustDoPriority | null {
  const normalized = item.toLowerCase();
  
  // Detect priority level from language
  let priority: 'must' | 'high' | 'nice' = 'high';
  if (normalized.includes('must') || normalized.includes('have to') || normalized.includes('need to')) {
    priority = 'must';
  } else if (normalized.includes('would like') || normalized.includes('if possible') || normalized.includes('nice to')) {
    priority = 'nice';
  }
  
  // Detect time preferences
  let preferredTime: 'morning' | 'afternoon' | 'evening' | 'any' = 'any';
  if (normalized.includes('morning') || normalized.includes('sunrise') || normalized.includes('early')) {
    preferredTime = 'morning';
  } else if (normalized.includes('afternoon')) {
    preferredTime = 'afternoon';
  } else if (normalized.includes('evening') || normalized.includes('night') || normalized.includes('sunset')) {
    preferredTime = 'evening';
  }
  
  // Strip conversational prefixes before event matching for better pattern detection
  const strippedForMatching = normalized
    .replace(/^(attending|going to|visit|see|watch|go to|here for|tickets?\s+(to|for))\s+(the\s+)?/i, '')
    .trim();

  // Try to match event patterns FIRST (sporting events, festivals, etc.)
  const eventMatch = matchEventPattern(strippedForMatching) || matchEventPattern(normalized);
  
  // Try to match known landmarks
  let matchedLandmark: typeof KNOWN_LANDMARKS[string] | null = null;
  let activityName = item
    .replace(/^\s*-\s*/, '')
    .replace(/must|have to|need to|would like to|want to/gi, '')
    .replace(/\[link:[^\]]+\]/gi, '')
    .replace(/\s+—\s+.*$/, '')
    .replace(/\s+@\s+.*$/, '')
    .replace(/\s+at\s+\d{1,2}:\d{2}(\s*[AP]M)?/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!activityName) return null;

  for (const [key, data] of Object.entries(KNOWN_LANDMARKS)) {
    if (normalized.includes(key)) {
      matchedLandmark = data;
      activityName = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // Determine activity type & duration: event pattern > landmark > default
  let activityType: ActivityType = 'standard';
  let estimatedDuration = 120;
  let requiresBooking = false;
  let bestTime = preferredTime;

  if (eventMatch) {
    activityType = eventMatch.type;
    estimatedDuration = eventMatch.duration;
    requiresBooking = eventMatch.bookingRequired;
    bestTime = eventMatch.bestTime;
    // Event matches get promoted to 'must' priority — the user explicitly named this
    priority = 'must';
    console.log(`[MustDo] Event pattern matched: "${activityName}" → ${activityType} (${estimatedDuration}min)`);
  } else if (matchedLandmark) {
    estimatedDuration = matchedLandmark.duration;
    requiresBooking = matchedLandmark.bookingRequired;
    bestTime = matchedLandmark.bestTime;
  }
  
  return {
    id: `mustdo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: activityName,
    userDescription: item,
    activityName,
    priority,
    activityType,
    preferredTime: bestTime,
    estimatedDuration,
    requiresBooking,
    location: matchedLandmark?.neighborhood,
  };
}

// =============================================================================
// SCHEDULING ALGORITHM
// =============================================================================

export function scheduleMustDos(
  priorities: MustDoPriority[],
  totalDays: number,
  destinationZones?: Map<string, string[]> // zone -> neighborhoods
): MustDoAnalysis {
  console.log(`[MustDo] Scheduling ${priorities.length} priorities across ${totalDays} days`);
  
  if (priorities.length === 0) {
    return {
      scheduled: [],
      unschedulable: [],
      dayAssignments: new Map(),
      promptSection: '',
    };
  }
  
  const scheduled: ScheduledMustDo[] = [];
  const unschedulable: Array<{ priority: MustDoPriority; reason: string }> = [];
  const dayAssignments = new Map<number, MustDoPriority[]>();
  
  // Initialize day assignments
  for (let d = 1; d <= totalDays; d++) {
    dayAssignments.set(d, []);
  }
  
  // Sort by priority (must > high > nice), then by duration (longest first)
  const sorted = [...priorities].sort((a, b) => {
    const priorityOrder = { must: 0, high: 1, nice: 2 };
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return (b.estimatedDuration || 120) - (a.estimatedDuration || 120);
  });
  
  // Schedule each priority
  for (const priority of sorted) {
    const result = findBestDay(priority, dayAssignments, totalDays);
    
    if (result.success) {
      scheduled.push({
        priority,
        assignedDay: result.day!,
        assignedTime: getTimeForPreference(priority.preferredTime),
        rationale: result.rationale!,
        hasBackup: result.backupDay !== undefined,
        backupDay: result.backupDay,
      });
      
      dayAssignments.get(result.day!)!.push(priority);
    } else {
      // For 'must' priorities, this is a failure
      if (priority.priority === 'must') {
        unschedulable.push({
          priority,
          reason: result.reason || 'No available day',
        });
      }
      // For 'nice' priorities, we just skip
    }
  }
  
  // Build prompt section
  const promptSection = buildMustDoPrompt(scheduled, unschedulable, dayAssignments);
  
  return {
    scheduled,
    unschedulable,
    dayAssignments,
    promptSection,
  };
}

function findBestDay(
  priority: MustDoPriority,
  dayAssignments: Map<number, MustDoPriority[]>,
  totalDays: number
): { success: boolean; day?: number; backupDay?: number; rationale?: string; reason?: string } {
  const minDay = priority.minDay ?? 1;
  const maxDay = priority.maxDay ?? totalDays;
  const isAllDay = priority.activityType === 'all_day_event';
  
  // If user specified a day, try that first
  if (priority.preferredDay && priority.preferredDay >= minDay && priority.preferredDay <= maxDay) {
    const dayLoad = dayAssignments.get(priority.preferredDay) || [];
    
    // All-day events need an EMPTY day (no other must-dos assigned)
    if (isAllDay) {
      const hasOtherAllDay = dayLoad.some(p => p.activityType === 'all_day_event');
      if (!hasOtherAllDay) {
        return {
          success: true,
          day: priority.preferredDay,
          rationale: `User preferred Day ${priority.preferredDay} (all-day event, day dedicated)`,
        };
      }
    } else {
      const totalDuration = dayLoad.reduce((sum, p) => sum + (p.estimatedDuration || 120), 0);
      if (totalDuration + (priority.estimatedDuration || 120) <= 480) {
        return {
          success: true,
          day: priority.preferredDay,
          rationale: `User preferred Day ${priority.preferredDay}`,
        };
      }
    }
  }
  
  // Find best day
  let bestDay: number | undefined;
  let lowestLoad = Infinity;
  let backupDay: number | undefined;
  
  for (let d = minDay; d <= maxDay; d++) {
    // Skip first and last day for long activities (travel days) — BUT respect user's explicit day preference
    if ((d === 1 || d === totalDays) && (priority.estimatedDuration || 120) > 180) {
      if (!priority.preferredDay || priority.preferredDay !== d) {
        continue;
      }
    }
    
    const dayLoad = dayAssignments.get(d) || [];
    
    // All-day events: prefer completely empty days, skip days with other all-day events
    if (isAllDay) {
      const hasOtherAllDay = dayLoad.some(p => p.activityType === 'all_day_event');
      if (hasOtherAllDay) continue;
      const totalDuration = dayLoad.reduce((sum, p) => sum + (p.estimatedDuration || 120), 0);
      // Prefer emptier days for all-day events
      if (totalDuration < lowestLoad) {
        backupDay = bestDay;
        lowestLoad = totalDuration;
        bestDay = d;
      }
    } else {
      const totalDuration = dayLoad.reduce((sum, p) => sum + (p.estimatedDuration || 120), 0);
      // Skip days that have all-day events — don't pile activities onto event days
      // EXCEPTION: Evening activities (comedy shows, dinner events, etc.) can coexist
      // with daytime all-day events since they don't overlap
      const hasAllDayEvent = dayLoad.some(p => p.activityType === 'all_day_event');
      if (hasAllDayEvent && priority.activityType !== 'quick_stop') {
        const isEveningActivity = priority.preferredTime === 'evening' ||
          (priority.activityType === 'half_day_event' && priority.preferredTime === 'evening');
        if (!isEveningActivity) {
          continue;
        }
        // Evening activity on an all-day event day — allowed (e.g., comedy show after US Open)
      }
      
      if (totalDuration < lowestLoad) {
        backupDay = bestDay;
        lowestLoad = totalDuration;
        bestDay = d;
      }
    }
  }
  
  if (bestDay !== undefined) {
    // All-day events always succeed if we found an available day
    if (isAllDay) {
      return {
        success: true,
        day: bestDay,
        backupDay,
        rationale: `ALL-DAY EVENT assigned to Day ${bestDay} (day dedicated to this event)`,
      };
    }
    if (lowestLoad + (priority.estimatedDuration || 120) <= 480) {
      return {
        success: true,
        day: bestDay,
        backupDay,
        rationale: `Assigned to Day ${bestDay} (lowest load: ${lowestLoad} min)`,
      };
    }
  }
  
  return {
    success: false,
    reason: 'All days are too full to accommodate this activity',
  };
}

function getTimeForPreference(pref?: 'morning' | 'afternoon' | 'evening' | 'any'): string {
  switch (pref) {
    case 'morning': return '09:00';
    case 'afternoon': return '14:00';
    case 'evening': return '18:00';
    default: return '10:00';
  }
}

/** Compute the blocked start/end times for an all-day or half-day event */
export function getBlockedTimeRange(s: ScheduledMustDo): { blockedStart: string; blockedEnd: string } {
  const startTime = s.assignedTime || getTimeForPreference(s.priority.preferredTime);
  const durationMins = s.priority.estimatedDuration || (s.priority.activityType === 'all_day_event' ? 480 : 180);
  const startMins = parseHHMM(startTime);
  const endMins = Math.min(startMins + durationMins, 23 * 60 + 30); // cap at 23:30
  return { blockedStart: startTime, blockedEnd: minsToHHMM(endMins) };
}

function parseHHMM(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function subtractMinutes(time: string, mins: number): string {
  return minsToHHMM(Math.max(parseHHMM(time) - mins, 0));
}

function addMinutes(time: string, mins: number): string {
  return minsToHHMM(Math.min(parseHHMM(time) + mins, 23 * 60 + 59));
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildMustDoPrompt(
  scheduled: ScheduledMustDo[],
  unschedulable: Array<{ priority: MustDoPriority; reason: string }>,
  dayAssignments: Map<number, MustDoPriority[]>
): string {
  if (scheduled.length === 0 && unschedulable.length === 0) return '';
  
  let prompt = `## 🚨 MANDATORY USER-SPECIFIED VENUES & ACTIVITIES

⚠️ CRITICAL: The traveler has PERSONALLY RESEARCHED and CHOSEN these specific venues/restaurants.
You MUST include ALL of them in the itinerary BY THEIR EXACT NAME.
Do NOT substitute AI-generated alternatives. Only fill REMAINING empty slots with your own recommendations.
FAILURE TO INCLUDE ANY OF THESE IS A HARD FAILURE.

`;

  // ── ALL-DAY & HALF-DAY EVENT SECTIONS (highest priority, separate from standard must-dos) ──
  const allDayEvents = scheduled.filter(s => s.priority.activityType === 'all_day_event');
  const halfDayEvents = scheduled.filter(s => s.priority.activityType === 'half_day_event');
  const quickStops = scheduled.filter(s => s.priority.activityType === 'quick_stop');
  const standardItems = scheduled.filter(s => !s.priority.activityType || s.priority.activityType === 'standard');
  
  if (allDayEvents.length > 0) {
    prompt += `### 🏟️ ALL-DAY EVENTS (Day is DEDICATED to this event)\n`;
    for (const s of allDayEvents) {
      const venue = s.priority.venueName ? ` at ${s.priority.venueName}` : '';
      const dates = s.priority.eventDates ? ` (confirmed: ${s.priority.eventDates})` : '';
      const durationHours = Math.round((s.priority.estimatedDuration || 480) / 60);
      const { blockedStart, blockedEnd } = getBlockedTimeRange(s);
      prompt += `\n**${s.priority.title}** → Day ${s.assignedDay}${venue}${dates}
⏰ BLOCKED TIME: ${blockedStart}–${blockedEnd} (${durationHours} hours)

YOU MUST CREATE AN ACTIVITY ENTRY for "${s.priority.title}" with:
- title: "${s.priority.title}"
- startTime: "${blockedStart}"
- endTime: "${blockedEnd}"
- This MUST appear as a real activity card in the itinerary JSON output.

Do NOT schedule any OTHER activities between ${blockedStart} and ${blockedEnd} — this time belongs to "${s.priority.title}".

Day structure:
- Breakfast before ${subtractMinutes(blockedStart, 30)}
- Transit to venue ~${subtractMinutes(blockedStart, 30)}
- "${s.priority.title}" from ${blockedStart} to ${blockedEnd} (MANDATORY ACTIVITY ENTRY)
- Transit from venue after ${blockedEnd}
- Dinner/evening activities after ${addMinutes(blockedEnd, 30)}

Any OTHER activity overlapping ${blockedStart}–${blockedEnd} is a HARD FAILURE. But the event itself MUST be present.
${s.priority.requiresBooking ? '⚠️ TICKETS/BOOKING REQUIRED — mention this prominently\n' : ''}`;
    }
    prompt += '\n';
  }
  
  if (halfDayEvents.length > 0) {
    prompt += `### 🎭 HALF-DAY EVENTS (Block ${halfDayEvents.length > 1 ? 'respective' : 'the'} half of the day)\n`;
    for (const s of halfDayEvents) {
      const durationHours = Math.round((s.priority.estimatedDuration || 180) / 60);
      const { blockedStart, blockedEnd } = getBlockedTimeRange(s);
      const timeBlock = s.priority.preferredTime === 'evening' ? 'evening (leave afternoon free for sightseeing)' 
        : s.priority.preferredTime === 'morning' ? 'morning (leave afternoon/evening free)' 
        : `${s.priority.preferredTime || 'assigned time'} block`;
      prompt += `- **${s.priority.title}** → Day ${s.assignedDay}, ${timeBlock} (~${durationHours}h)\n`;
      prompt += `  ⏰ BLOCKED TIME: ${blockedStart}–${blockedEnd}. YOU MUST create an activity entry for "${s.priority.title}" in this window. Do NOT schedule any OTHER activities here.\n`;
      if (s.priority.requiresBooking) prompt += `  ⚠️ BOOKING REQUIRED\n`;
    }
    prompt += `→ Fill the OTHER half of these days with sightseeing/activities.\n\n`;
  }

  // Group standard items by priority level
  const mustLevel = standardItems.filter(s => s.priority.priority === 'must');
  const highLevel = standardItems.filter(s => s.priority.priority === 'high');
  const niceLevel = standardItems.filter(s => s.priority.priority === 'nice');
  
  if (mustLevel.length > 0) {
    prompt += `### 🔴 MUST HAVE (Non-negotiable)\n`;
    for (const s of mustLevel) {
      prompt += `- **${s.priority.title}** → Day ${s.assignedDay}, ${s.priority.preferredTime || 'any time'}`;
      if (s.priority.requiresBooking) prompt += ` ⚠️ BOOKING REQUIRED`;
      prompt += `\n`;
    }
    prompt += '\n';
  }
  
  if (highLevel.length > 0) {
    prompt += `### 🟡 HIGH PRIORITY\n`;
    for (const s of highLevel) {
      prompt += `- **${s.priority.title}** → Day ${s.assignedDay}\n`;
    }
    prompt += '\n';
  }
  
  if (niceLevel.length > 0) {
    prompt += `### 🟢 NICE TO HAVE\n`;
    for (const s of niceLevel) {
      prompt += `- ${s.priority.title} → Day ${s.assignedDay}\n`;
    }
    prompt += '\n';
  }
  
  if (quickStops.length > 0) {
    prompt += `### 📸 QUICK STOPS (Weave into nearest convenient day)\n`;
    for (const s of quickStops) {
      prompt += `- ${s.priority.title} → Day ${s.assignedDay} (~${s.priority.estimatedDuration || 30} min, fit between activities)\n`;
    }
    prompt += '\n';
  }
  
  if (unschedulable.length > 0) {
    prompt += `### ⚠️ SCHEDULING CONFLICTS\n`;
    for (const u of unschedulable) {
      prompt += `- ${u.priority.title}: ${u.reason}\n`;
    }
    prompt += '\n';
  }

  prompt += `### CRITICAL RULES (VIOLATION = ITINERARY REJECTION)
1. ALL listed items are NON-NEGOTIABLE — they MUST appear using their EXACT NAME
2. Build the rest of the day around these user-specified anchors
3. If a venue requires booking, mention this prominently
4. Geographic clustering: schedule nearby user venues on the same day
5. NEVER replace a user-specified venue with an AI alternative, even if "similar"
6. Only use AI recommendations to fill REMAINING empty slots after ALL user venues are placed
7. If you cannot fit all user venues, ADD more activity slots — do NOT drop user venues

### 🧭 SMART FINISH ENRICHMENT — TRANSFORM A ROUGH PLAN INTO A PREMIUM ITINERARY
The user's list is a STARTING POINT with 3-4 venues per day. You MUST produce a COMPLETE, polished plan with 10-14 entries per day.

8. **FILL EVERY GAP WITH REAL ENTRIES**: Between every user venue, add:
   - A transit entry (category: "transport") with mode, duration, cost, and directions
   - Meals they didn't specify: breakfast café near hotel, lunch spot near morning activities, dinner restaurant
   - Coffee/snack stops for long gaps (> 2 hours between activities)
   - Each of these MUST be a full JSON activity object with id, title, startTime, endTime, category, location, cost

9. **SPECIFIC TIMES ON EVERYTHING**: Every activity MUST have a startTime in "HH:MM" 24-hour format (e.g., "09:30", "14:00").
   Do NOT use labels like "Morning", "Afternoon", "Before Departure". Those are NOT valid times.
   Breakfast: 08:00-09:30 range. Lunch: 12:00-13:30 range. Dinner: 18:30-20:30 range.

10. **ADD LOGISTICS**: For EVERY activity (user-specified AND AI-added), provide:
   - Exact street address (real, verifiable) in location.address
   - Opening hours context in tips field
   - Realistic transit instructions FROM the previous activity
   - Estimated cost per person in cost.amount
   - Booking URL or official website link in website field

11. **EXPAND WITH DNA-MATCHED ACTIVITIES**: Add 2-4 NEW activities per day that match the traveler's DNA:
   - Hidden gems, local favorites, scenic walks, cultural stops
   - These are IN ADDITION to the user's picks, not replacements
   - Each new activity needs full details: times, location, cost, description

12. **ADD PRACTICAL TIPS**: For each user-specified venue, add an insider tip
13. **MINIMUM OUTPUT PER DAY**: At least 8 activity entries per full day (experiences + meals + transit)

### 🚩 DNA MISMATCH FLAGGING
14. If ANY user-specified activity does NOT align with the traveler's DNA profile, include a "dnaFlag" field:
    - "dnaFlag": "This doesn't match your usual style — but you chose it, so we've kept it! Consider [DNA-aligned alternative] nearby."
15. DNA-flagged activities stay in the itinerary — they are NOT removed. The flag is informational only.

`;

  return prompt;
}


// =============================================================================
// VALIDATION
// =============================================================================

export function validateMustDosInItinerary(
  itineraryDays: Array<{ dayNumber: number; activities: Array<{ title: string }> }>,
  mustDos: MustDoPriority[]
): { 
  allPresent: boolean; 
  missing: MustDoPriority[]; 
  found: Array<{ priority: MustDoPriority; dayNumber: number }> 
} {
  const found: Array<{ priority: MustDoPriority; dayNumber: number }> = [];
  const missing: MustDoPriority[] = [];
  
  for (const mustDo of mustDos) {
    if (mustDo.priority !== 'must') continue;
    
    let wasFound = false;
    const searchTerms = mustDo.activityName.toLowerCase().split(' ');
    
    for (const day of itineraryDays) {
      for (const activity of day.activities) {
        const titleLower = activity.title.toLowerCase();
        if (searchTerms.every(term => titleLower.includes(term))) {
          found.push({ priority: mustDo, dayNumber: day.dayNumber });
          wasFound = true;
          break;
        }
      }
      if (wasFound) break;
    }
    
    if (!wasFound) {
      missing.push(mustDo);
    }
  }
  
  return {
    allPresent: missing.length === 0,
    missing,
    found,
  };
}

// =============================================================================
// MUST-HAVES CONSTRAINT PROMPT BUILDER
// =============================================================================
// Converts the structured mustHaves checklist (from trip.metadata.mustHaves)
// into a categorized prompt section that the AI must respect.
// Unlike mustDoActivities (venue names), mustHaves can contain schedule
// constraints, hotel preferences, group logistics, etc.
// =============================================================================

interface MustHaveItem {
  label: string;
  notes?: string;
  checked?: boolean;
}

type MustHaveCategory = 'schedule' | 'accommodation' | 'group_logistics' | 'venue';

function categorizeMustHave(item: MustHaveItem): MustHaveCategory {
  const text = `${item.label} ${item.notes || ''}`.toLowerCase();

  // Schedule constraint patterns
  if (
    /\b(not available|unavailable|until|after|before|from \d|by \d|no earlier|no later|only after|only before|wake|sleep|nap|school|class|meeting|appointment)\b/.test(text) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/i.test(text) ||
    /\b(morning|afternoon|evening|night)\s+(off|free|busy|unavailable)\b/.test(text)
  ) {
    return 'schedule';
  }

  // Accommodation patterns
  if (
    /\b(hotel|stay at|riad|hostel|airbnb|resort|accommodation|lodging|check.?in|check.?out|room|suite|villa)\b/.test(text)
  ) {
    return 'accommodation';
  }

  // Group logistics patterns
  if (
    /\b(family|friend|arrive|arriving|joining|leaving|depart|group|party size|kids|children|baby|toddler|elderly|wheelchair|mobility)\b/.test(text)
  ) {
    return 'group_logistics';
  }

  return 'venue';
}

export function buildMustHavesConstraintPrompt(
  mustHaves: MustHaveItem[],
  totalDays: number
): string {
  if (!mustHaves || mustHaves.length === 0) return '';

  const categorized: Record<MustHaveCategory, MustHaveItem[]> = {
    schedule: [],
    accommodation: [],
    group_logistics: [],
    venue: [],
  };

  for (const item of mustHaves) {
    const cat = categorizeMustHave(item);
    categorized[cat].push(item);
  }

  const parts: string[] = [];
  parts.push(`\n${'='.repeat(60)}`);
  parts.push(`## 🚨 TRAVELER'S NON-NEGOTIABLE REQUIREMENTS (MUST-HAVES)`);
  parts.push(`${'='.repeat(60)}`);
  parts.push(`The traveler has explicitly listed these requirements. They are NOT suggestions — they are HARD CONSTRAINTS. Violating ANY of them = itinerary rejection.\n`);

  if (categorized.schedule.length > 0) {
    parts.push(`### ⏰ HARD SCHEDULING CONSTRAINTS`);
    parts.push(`These override default scheduling. Respect them on EVERY applicable day:\n`);
    for (const item of categorized.schedule) {
      parts.push(`- "${item.label}"${item.notes ? ` — ${item.notes}` : ''}`);
    }
    parts.push(`\n→ Do NOT schedule ANY activities that conflict with these time constraints.`);
    parts.push('');
  }

  if (categorized.accommodation.length > 0) {
    parts.push(`### 🏨 ACCOMMODATION REQUIREMENTS`);
    parts.push(`Use these as geographic anchors for daily planning:\n`);
    for (const item of categorized.accommodation) {
      parts.push(`- "${item.label}"${item.notes ? ` — ${item.notes}` : ''}`);
    }
    parts.push(`\n→ Plan activities radiating from this accommodation location.`);
    parts.push('');
  }

  if (categorized.group_logistics.length > 0) {
    parts.push(`### 👥 GROUP & LOGISTICS CONSTRAINTS`);
    parts.push(`Adjust group dynamics and activity selection accordingly:\n`);
    for (const item of categorized.group_logistics) {
      parts.push(`- "${item.label}"${item.notes ? ` — ${item.notes}` : ''}`);
    }
    parts.push('');
  }

  if (categorized.venue.length > 0) {
    parts.push(`### 📍 MUST-VISIT VENUES & ACTIVITIES`);
    parts.push(`These MUST appear in the itinerary by name:\n`);
    for (const item of categorized.venue) {
      parts.push(`- "${item.label}"${item.notes ? ` — ${item.notes}` : ''}`);
    }
    parts.push(`\n→ Schedule these on the most logical day and do NOT substitute with alternatives.`);
    parts.push('');
  }

  parts.push(`VIOLATION OF ANY REQUIREMENT ABOVE = ITINERARY REJECTION\n`);

  return parts.join('\n');
}
