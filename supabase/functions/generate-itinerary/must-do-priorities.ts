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

export interface MustDoPriority {
  id: string;
  title: string;
  /** User's original text describing what they want */
  userDescription: string;
  /** Parsed/normalized activity name */
  activityName: string;
  /** Priority level */
  priority: 'must' | 'high' | 'nice';
  /** Preferred day number (optional) */
  preferredDay?: number;
  /** Preferred time of day */
  preferredTime?: 'morning' | 'afternoon' | 'evening' | 'any';
  /** Location for geographic clustering */
  location?: string;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Whether this typically requires advance booking */
  requiresBooking?: boolean;
  /** Maximum acceptable day (e.g., "before we leave Rome") */
  maxDay?: number;
  /** Minimum day (e.g., "after we're settled") */
  minDay?: number;
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
  destination: string
): MustDoPriority[] {
  const priorities: MustDoPriority[] = [];
  
  // Split by common separators
  const items = userInput
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const item of items) {
    const priority = parseItem(item, destination);
    if (priority) {
      priorities.push(priority);
    }
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
  
  // Try to match known landmarks
  let matchedLandmark: typeof KNOWN_LANDMARKS[string] | null = null;
  let activityName = item.replace(/must|have to|need to|would like to|want to/gi, '').trim();
  
  for (const [key, data] of Object.entries(KNOWN_LANDMARKS)) {
    if (normalized.includes(key)) {
      matchedLandmark = data;
      activityName = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }
  
  return {
    id: `mustdo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: activityName,
    userDescription: item,
    activityName,
    priority,
    preferredTime: matchedLandmark?.bestTime || preferredTime,
    estimatedDuration: matchedLandmark?.duration || 120,
    requiresBooking: matchedLandmark?.bookingRequired || false,
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
  
  // If user specified a day, try that first
  if (priority.preferredDay && priority.preferredDay >= minDay && priority.preferredDay <= maxDay) {
    const dayLoad = dayAssignments.get(priority.preferredDay) || [];
    const totalDuration = dayLoad.reduce((sum, p) => sum + (p.estimatedDuration || 120), 0);
    
    if (totalDuration + (priority.estimatedDuration || 120) <= 480) { // 8 hours max
      return {
        success: true,
        day: priority.preferredDay,
        rationale: `User preferred Day ${priority.preferredDay}`,
      };
    }
  }
  
  // Find day with least load
  let bestDay: number | undefined;
  let lowestLoad = Infinity;
  let backupDay: number | undefined;
  
  for (let d = minDay; d <= maxDay; d++) {
    // Skip first and last day for long activities (travel days)
    if ((d === 1 || d === totalDays) && (priority.estimatedDuration || 120) > 180) {
      continue;
    }
    
    const dayLoad = dayAssignments.get(d) || [];
    const totalDuration = dayLoad.reduce((sum, p) => sum + (p.estimatedDuration || 120), 0);
    
    if (totalDuration < lowestLoad) {
      backupDay = bestDay;
      lowestLoad = totalDuration;
      bestDay = d;
    }
  }
  
  if (bestDay && lowestLoad + (priority.estimatedDuration || 120) <= 480) {
    return {
      success: true,
      day: bestDay,
      backupDay,
      rationale: `Assigned to Day ${bestDay} (lowest load: ${lowestLoad} min)`,
    };
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

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildMustDoPrompt(
  scheduled: ScheduledMustDo[],
  unschedulable: Array<{ priority: MustDoPriority; reason: string }>,
  dayAssignments: Map<number, MustDoPriority[]>
): string {
  if (scheduled.length === 0 && unschedulable.length === 0) return '';
  
  let prompt = `## 🎯 MUST-DO PRIORITIES (USER REQUIREMENTS)

The traveler has specified these as REQUIRED experiences. They MUST appear in the itinerary:

`;

  // Group by priority level
  const mustLevel = scheduled.filter(s => s.priority.priority === 'must');
  const highLevel = scheduled.filter(s => s.priority.priority === 'high');
  const niceLevel = scheduled.filter(s => s.priority.priority === 'nice');
  
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
  
  if (unschedulable.length > 0) {
    prompt += `### ⚠️ SCHEDULING CONFLICTS\n`;
    for (const u of unschedulable) {
      prompt += `- ${u.priority.title}: ${u.reason}\n`;
    }
    prompt += '\n';
  }

  prompt += `### CRITICAL RULES
1. MUST-level items are NON-NEGOTIABLE - they MUST appear on the specified day
2. Build the rest of the day around these anchors
3. If a must-do requires booking, mention this prominently
4. Geographic clustering: schedule nearby activities on the same day as must-dos
5. Never replace a must-do with an alternative, even if "similar"
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
