// =============================================================================
// PRE-BOOKED COMMITMENTS - Calendar-Aware Scheduling
// =============================================================================
// Handles fixed commitments the user has already booked:
// - Concerts, shows, sporting events
// - Restaurant reservations
// - Tours with fixed times
// - Meetings or business events
// 
// The itinerary MUST schedule around these, never conflicting.
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

export interface PreBookedCommitment {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime?: string; // HH:MM (optional, defaults to +2 hours)
  location?: string;
  address?: string;
  confirmationNumber?: string;
  category: 'show' | 'restaurant' | 'tour' | 'event' | 'meeting' | 'other';
  priority: 'required' | 'flexible'; // required = cannot move, flexible = can adjust if needed
  notes?: string;
  /** Buffer time needed before (in minutes) */
  bufferBefore?: number;
  /** Buffer time needed after (in minutes) */
  bufferAfter?: number;
}

export interface TimeBlock {
  date: string;
  startTime: string;
  endTime: string;
  commitment: PreBookedCommitment;
  /** Total blocked time including buffers */
  totalBlockedMinutes: number;
}

export interface DayAvailability {
  date: string;
  dayNumber: number;
  blockedPeriods: TimeBlock[];
  availableSlots: AvailableSlot[];
  totalAvailableMinutes: number;
  hasEvening: boolean;
  hasMorning: boolean;
  hasAfternoon: boolean;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  period: 'morning' | 'afternoon' | 'evening';
}

export interface CommitmentAnalysis {
  /** Days with commitments mapped by date */
  dayBlocks: Map<string, DayAvailability>;
  /** Total number of commitments */
  totalCommitments: number;
  /** Days with no flexibility */
  tightDays: string[];
  /** Pre-built prompt section */
  promptSection: string;
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

export function analyzePreBookedCommitments(
  commitments: PreBookedCommitment[],
  startDate: string,
  endDate: string
): CommitmentAnalysis {
  console.log(`[Commitments] Analyzing ${commitments.length} pre-booked commitments`);
  
  if (commitments.length === 0) {
    return {
      dayBlocks: new Map(),
      totalCommitments: 0,
      tightDays: [],
      promptSection: '',
    };
  }
  
  const dayBlocks = new Map<string, DayAvailability>();
  const tripDates = getDateRange(startDate, endDate);
  
  // Initialize all days
  tripDates.forEach((date, index) => {
    dayBlocks.set(date, {
      date,
      dayNumber: index + 1,
      blockedPeriods: [],
      availableSlots: [],
      totalAvailableMinutes: calculateFullDayMinutes(),
      hasEvening: true,
      hasMorning: true,
      hasAfternoon: true,
    });
  });
  
  // Process each commitment
  for (const commitment of commitments) {
    const dayAvail = dayBlocks.get(commitment.date);
    if (!dayAvail) {
      console.warn(`[Commitments] Commitment date ${commitment.date} is outside trip range`);
      continue;
    }
    
    const block = createTimeBlock(commitment);
    dayAvail.blockedPeriods.push(block);
  }
  
  // Calculate available slots for each day
  for (const [date, dayAvail] of dayBlocks) {
    if (dayAvail.blockedPeriods.length > 0) {
      dayAvail.availableSlots = calculateAvailableSlots(dayAvail.blockedPeriods);
      dayAvail.totalAvailableMinutes = dayAvail.availableSlots.reduce(
        (sum, slot) => sum + slot.durationMinutes, 0
      );
      
      // Check period availability
      dayAvail.hasMorning = dayAvail.availableSlots.some(
        s => s.period === 'morning' && s.durationMinutes >= 60
      );
      dayAvail.hasAfternoon = dayAvail.availableSlots.some(
        s => s.period === 'afternoon' && s.durationMinutes >= 60
      );
      dayAvail.hasEvening = dayAvail.availableSlots.some(
        s => s.period === 'evening' && s.durationMinutes >= 60
      );
    }
  }
  
  // Identify tight days (less than 4 hours of flexibility)
  const tightDays = [...dayBlocks.entries()]
    .filter(([_, avail]) => avail.totalAvailableMinutes < 240 && avail.blockedPeriods.length > 0)
    .map(([date]) => date);
  
  // Build prompt section
  const promptSection = buildCommitmentsPrompt(dayBlocks, commitments);
  
  return {
    dayBlocks,
    totalCommitments: commitments.length,
    tightDays,
    promptSection,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

function calculateFullDayMinutes(): number {
  // Assume 9 AM to 10 PM = 13 hours = 780 minutes
  return 780;
}

function createTimeBlock(commitment: PreBookedCommitment): TimeBlock {
  const bufferBefore = commitment.bufferBefore ?? getDefaultBuffer(commitment.category, 'before');
  const bufferAfter = commitment.bufferAfter ?? getDefaultBuffer(commitment.category, 'after');
  
  const startMinutes = timeToMinutes(commitment.startTime);
  const endMinutes = commitment.endTime 
    ? timeToMinutes(commitment.endTime) 
    : startMinutes + 120; // Default 2 hours
  
  const effectiveStart = Math.max(0, startMinutes - bufferBefore);
  const effectiveEnd = Math.min(24 * 60, endMinutes + bufferAfter);
  
  return {
    date: commitment.date,
    startTime: minutesToTime(effectiveStart),
    endTime: minutesToTime(effectiveEnd),
    commitment,
    totalBlockedMinutes: effectiveEnd - effectiveStart,
  };
}

function getDefaultBuffer(category: string, type: 'before' | 'after'): number {
  const buffers: Record<string, { before: number; after: number }> = {
    'show': { before: 45, after: 30 },
    'restaurant': { before: 15, after: 30 },
    'tour': { before: 30, after: 15 },
    'event': { before: 45, after: 30 },
    'meeting': { before: 15, after: 15 },
    'other': { before: 30, after: 30 },
  };
  
  return buffers[category]?.[type] ?? 30;
}

function calculateAvailableSlots(blockedPeriods: TimeBlock[]): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  
  // Sort blocks by start time
  const sorted = [...blockedPeriods].sort((a, b) => 
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  
  const dayStart = 9 * 60; // 9 AM
  const dayEnd = 22 * 60; // 10 PM
  
  let currentTime = dayStart;
  
  for (const block of sorted) {
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);
    
    // Gap before this block
    if (blockStart > currentTime && blockStart > dayStart) {
      const slotStart = Math.max(currentTime, dayStart);
      const slotEnd = Math.min(blockStart, dayEnd);
      if (slotEnd > slotStart) {
        slots.push({
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
          durationMinutes: slotEnd - slotStart,
          period: getPeriod(slotStart),
        });
      }
    }
    
    currentTime = Math.max(currentTime, blockEnd);
  }
  
  // Gap after all blocks
  if (currentTime < dayEnd) {
    slots.push({
      startTime: minutesToTime(currentTime),
      endTime: minutesToTime(dayEnd),
      durationMinutes: dayEnd - currentTime,
      period: getPeriod(currentTime),
    });
  }
  
  return slots;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getPeriod(minutes: number): 'morning' | 'afternoon' | 'evening' {
  if (minutes < 12 * 60) return 'morning';
  if (minutes < 17 * 60) return 'afternoon';
  return 'evening';
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildCommitmentsPrompt(
  dayBlocks: Map<string, DayAvailability>,
  commitments: PreBookedCommitment[]
): string {
  const daysWithCommitments = [...dayBlocks.entries()]
    .filter(([_, avail]) => avail.blockedPeriods.length > 0);
  
  if (daysWithCommitments.length === 0) return '';
  
  let prompt = `## 🎫 PRE-BOOKED COMMITMENTS (FIXED - CANNOT CHANGE)

The traveler has already booked the following. These are IMMOVABLE:

`;

  // Group by day
  for (const [date, avail] of daysWithCommitments) {
    prompt += `### Day ${avail.dayNumber} (${formatDate(date)})\n`;
    
    for (const block of avail.blockedPeriods) {
      const c = block.commitment;
      prompt += `- **${c.startTime}${c.endTime ? '-' + c.endTime : ''}**: ${c.title}`;
      if (c.location) prompt += ` @ ${c.location}`;
      if (c.category !== 'other') prompt += ` [${c.category}]`;
      prompt += '\n';
    }
    
    prompt += `\nAvailable time slots on this day:\n`;
    for (const slot of avail.availableSlots) {
      prompt += `- ${slot.startTime}-${slot.endTime} (${slot.durationMinutes} min, ${slot.period})\n`;
    }
    prompt += '\n';
  }

  prompt += `### CRITICAL RULES FOR COMMITTED DAYS
1. NEVER schedule anything that overlaps with pre-booked times
2. Include travel/buffer time to reach commitment locations
3. Keep activities near the commitment location when time is tight
4. If a day has less than 3 hours available, focus on dining and light activities only
5. The commitment IS the anchor for that day - plan around it
`;

  return prompt;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// =============================================================================
// CONFLICT DETECTION
// =============================================================================

export function detectScheduleConflict(
  proposedActivity: { date: string; startTime: string; endTime: string },
  dayAvailability: DayAvailability
): { hasConflict: boolean; conflictsWith?: string } {
  const proposedStart = timeToMinutes(proposedActivity.startTime);
  const proposedEnd = timeToMinutes(proposedActivity.endTime);
  
  for (const block of dayAvailability.blockedPeriods) {
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);
    
    // Check overlap
    if (proposedStart < blockEnd && proposedEnd > blockStart) {
      return {
        hasConflict: true,
        conflictsWith: block.commitment.title,
      };
    }
  }
  
  return { hasConflict: false };
}
