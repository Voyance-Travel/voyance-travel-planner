// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/lib/schema-compiler/gap-filler.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

export interface GapFillerConfig {
  minGapMinutes: number;
  hotelName?: string;
  hotelLocation?: string;
  budgetTier: 'budget' | 'mid' | 'luxury';
  transportMinutes: number;
}

export interface DetectedGap {
  afterActivity: string;
  beforeActivity: string;
  gapStartTime: string;
  gapEndTime: string;
  gapMinutes: number;
  dayNumber: number;
}

export function detectAndFillGaps(
  activities: any[],
  config: GapFillerConfig,
): { fillerActivities: any[]; gaps: DetectedGap[] } {
  const gaps: DetectedGap[] = [];
  const fillerActivities: any[] = [];

  const sortedActivities = [...activities].sort((a, b) => {
    return (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0);
  });

  for (let i = 0; i < sortedActivities.length - 1; i++) {
    const current = sortedActivities[i];
    const next = sortedActivities[i + 1];

    const currentEnd = getEndTimeMinutes(current);
    const nextStart = timeToMinutes(next.startTime);

    if (currentEnd === null || nextStart === null) continue;

    const gapMinutes = nextStart - currentEnd;

    if (gapMinutes >= config.minGapMinutes) {
      const gap: DetectedGap = {
        afterActivity: current.title || current.name || 'Previous Activity',
        beforeActivity: next.title || next.name || 'Next Activity',
        gapStartTime: minutesToHHMM(currentEnd),
        gapEndTime: minutesToHHMM(nextStart),
        gapMinutes,
        dayNumber: current.dayNumber || 1,
      };
      gaps.push(gap);
      fillerActivities.push(...generateFillerActivities(gap, config));
    }
  }

  return { fillerActivities, gaps };
}

function generateFillerActivities(gap: DetectedGap, config: GapFillerConfig): any[] {
  const fillers: any[] = [];
  const gapStart = timeToMinutes(gap.gapStartTime)!;
  const gapEnd = timeToMinutes(gap.gapEndTime)!;
  const transport = config.transportMinutes || 30;

  if (gap.gapMinutes >= 180) {
    let cursor = gapStart;

    fillers.push({
      title: 'Return to Hotel',
      category: 'transport',
      startTime: minutesToHHMM(cursor),
      endTime: minutesToHHMM(cursor + transport),
      duration: `${transport} minutes`,
      cost: transport <= 20 ? 15 : 35,
      description: `Head back to ${config.hotelName || 'your hotel'} to freshen up before the evening.`,
      location: config.hotelLocation || 'Hotel',
      isGenerated: true,
    });
    cursor += transport;

    const freshenUp = 45;
    fillers.push({
      title: 'Freshen Up at Hotel',
      category: 'wellness',
      startTime: minutesToHHMM(cursor),
      endTime: minutesToHHMM(cursor + freshenUp),
      duration: `${freshenUp} minutes`,
      cost: 0,
      description: 'Quick refresh and change before heading out for the evening.',
      location: config.hotelName || 'Hotel',
      isGenerated: true,
    });
    cursor += freshenUp;

    const dinnerEnd = gapEnd - 15;
    const dinnerMinutes = dinnerEnd - cursor;
    if (dinnerMinutes >= 45) {
      fillers.push({
        title: 'Dinner',
        category: 'dining',
        subcategory: 'dinner',
        startTime: minutesToHHMM(cursor),
        endTime: minutesToHHMM(dinnerEnd),
        duration: `${dinnerMinutes} minutes`,
        cost: costForTier(config.budgetTier, 'dinner'),
        description: 'AI will suggest a restaurant near your next activity.',
        isGenerated: true,
        needsAISuggestion: true,
      });
      cursor = dinnerEnd;
    }

    if (gapEnd - cursor >= 10) {
      fillers.push({
        title: `Transport to ${gap.beforeActivity}`,
        category: 'transport',
        startTime: minutesToHHMM(cursor),
        endTime: minutesToHHMM(gapEnd),
        duration: `${gapEnd - cursor} minutes`,
        cost: 15,
        description: 'Short transfer to your next activity.',
        isGenerated: true,
      });
    }
  } else if (gap.gapMinutes >= 120) {
    const dinnerEnd = gapEnd - 15;
    const dinnerMinutes = dinnerEnd - gapStart;

    fillers.push({
      title: 'Dinner',
      category: 'dining',
      subcategory: 'dinner',
      startTime: minutesToHHMM(gapStart),
      endTime: minutesToHHMM(dinnerEnd),
      duration: `${dinnerMinutes} minutes`,
      cost: costForTier(config.budgetTier, 'dinner'),
      description: 'AI will suggest a restaurant near your next activity.',
      isGenerated: true,
      needsAISuggestion: true,
    });
  } else {
    fillers.push({
      title: 'Dinner',
      category: 'dining',
      subcategory: 'dinner',
      startTime: gap.gapStartTime,
      endTime: minutesToHHMM(gapEnd - 10),
      duration: `${gap.gapMinutes - 10} minutes`,
      cost: costForTier(config.budgetTier, 'quick_dinner'),
      description: 'Quick dinner before your next activity.',
      isGenerated: true,
      needsAISuggestion: true,
    });
  }

  return fillers;
}

function costForTier(tier: string, meal: 'dinner' | 'quick_dinner'): number {
  const map: Record<string, Record<string, number>> = {
    luxury: { dinner: 85, quick_dinner: 65 },
    mid:    { dinner: 50, quick_dinner: 35 },
    budget: { dinner: 25, quick_dinner: 20 },
  };
  return (map[tier] ?? map.mid)[meal];
}

function timeToMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const ampm = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function minutesToHHMM(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getEndTimeMinutes(activity: any): number | null {
  if (activity.endTime) return timeToMinutes(activity.endTime);
  const start = timeToMinutes(activity.startTime);
  if (start === null) return null;
  const durMatch = activity.duration?.match(/(\d+(?:\.\d+)?)\s*(min|hour)/i);
  if (!durMatch) return start + 60;
  const val = parseFloat(durMatch[1]);
  const unit = durMatch[2].toLowerCase();
  return start + (unit.startsWith('hour') ? val * 60 : val);
}
