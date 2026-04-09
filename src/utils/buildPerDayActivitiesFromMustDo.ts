/**
 * Deterministic fallback parser: builds perDayActivities from a flat mustDoActivities string
 * when the AI model omits the structured perDayActivities array.
 *
 * Looks for "Day N" patterns and groups activities by day number.
 */
export interface PerDayActivity {
  dayNumber: number;
  activities: string;
}

/**
 * Parse a flat mustDoActivities string into structured perDayActivities.
 * Returns empty array if no day-number patterns are found.
 */
export function buildPerDayActivitiesFromMustDo(mustDo: string): PerDayActivity[] {
  if (!mustDo) return [];

  // Split on commas that separate "Day N ..." entries
  // We look for "Day <number>" at the start of each entry
  const dayPattern = /\bDay\s+(\d+)\b/gi;

  // First check: does mustDo contain day references at all?
  const dayMatches = mustDo.match(dayPattern);
  if (!dayMatches || dayMatches.length < 2) {
    // Not enough day references to be structured — skip
    return [];
  }

  // Strategy: split the string by "Day N" boundaries
  // and group activities under each day number
  const dayMap = new Map<number, string[]>();

  // Split by comma to get individual entries
  const entries = mustDo.split(/,\s*/);

  let currentDay: number | null = null;
  const pendingEntries: string[] = [];

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Check if this entry starts with or contains "Day N"
    const dayMatch = trimmed.match(/^Day\s+(\d+)\b/i);
    if (dayMatch) {
      // Flush pending entries to previous day
      if (currentDay !== null && pendingEntries.length > 0) {
        const existing = dayMap.get(currentDay) || [];
        existing.push(...pendingEntries);
        dayMap.set(currentDay, existing);
        pendingEntries.length = 0;
      }

      currentDay = parseInt(dayMatch[1], 10);
      // Strip "Day N" prefix and keep the activity text
      const activityText = trimmed.replace(/^Day\s+\d+\s*/i, '').trim();
      if (activityText) {
        pendingEntries.push(activityText);
      }
    } else if (currentDay !== null) {
      // No Day prefix — belongs to the current day
      pendingEntries.push(trimmed);
    }
    // If currentDay is still null and no Day prefix, skip (preamble text)
  }

  // Flush last batch
  if (currentDay !== null && pendingEntries.length > 0) {
    const existing = dayMap.get(currentDay) || [];
    existing.push(...pendingEntries);
    dayMap.set(currentDay, existing);
  }

  // Convert to sorted array
  const result: PerDayActivity[] = [];
  const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b);
  for (const dayNum of sortedDays) {
    const activities = dayMap.get(dayNum)!;
    result.push({
      dayNumber: dayNum,
      activities: activities.join(', '),
    });
  }

  if (result.length > 0) {
    console.log(`[buildPerDayActivities] Built ${result.length} structured days from mustDoActivities fallback`);
  }

  return result;
}
