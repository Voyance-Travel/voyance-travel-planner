/**
 * Preview Converter
 * 
 * Converts FullPreview data (from generate-full-preview) into
 * GeneratedDay[] format used by the itinerary display system.
 * 
 * Preview activities include an `isPreview: true` flag and null
 * gated fields (address, photos, tips) so the UI can show locked state.
 */

import type { FullPreview, PreviewDay, PreviewActivity } from '@/services/fullPreviewService';
import type { GeneratedDay, GeneratedActivity } from '@/hooks/useItineraryGeneration';

/**
 * Convert a full preview response into the standard GeneratedDay[] format.
 * Each activity is marked with isPreview metadata so the display layer
 * can render locked/gated UI elements.
 */
export function convertPreviewToGeneratedDays(preview: FullPreview): GeneratedDay[] {
  return preview.days.map((day: PreviewDay) => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    theme: day.theme,
    activities: day.activities.map((act: PreviewActivity, index: number) => 
      convertPreviewActivity(act, day.dayNumber, index)
    ),
    metadata: {
      theme: day.theme,
      totalEstimatedCost: 0, // Not available in preview
      mealsIncluded: day.activities.filter(a => a.venueType === 'dining').length,
      pacingLevel: 'moderate' as const,
      // Flag entire day as preview
      isPreview: true,
    },
  }));
}

function convertPreviewActivity(
  act: PreviewActivity,
  dayNumber: number,
  index: number
): GeneratedActivity {
  // Parse time to create approximate endTime
  const startTime = act.time;
  const endTime = calculateEndTime(startTime, act.durationMinutes);

  return {
    id: `preview-d${dayNumber}-${index}`,
    title: act.venueName,
    name: act.venueName,
    description: act.reasoning,
    category: mapVenueTypeToCategory(act.venueType),
    startTime,
    endTime,
    durationMinutes: act.durationMinutes,
    location: {
      name: act.venueName,
      address: '', // GATED
    },
    bookingRequired: false,
    tags: [act.venueType, act.neighborhood],
    // Preview metadata — signals to the UI to show locked state
    type: act.venueType,
    // Gated fields are explicitly absent
  };
}

function mapVenueTypeToCategory(venueType: string): string {
  const map: Record<string, string> = {
    dining: 'Food & Drink',
    cultural: 'Culture & History',
    nature: 'Nature & Outdoors',
    shopping: 'Shopping',
    entertainment: 'Entertainment',
    transport: 'Transportation',
    accommodation: 'Accommodation',
  };
  return map[venueType] || 'Experience';
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  // Parse "9:00 AM" format
  const match = startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return startTime;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const totalMinutes = hours * 60 + minutes + durationMinutes;
  let endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;

  const endPeriod = endHours >= 12 ? 'PM' : 'AM';
  if (endHours > 12) endHours -= 12;
  if (endHours === 0) endHours = 12;

  return `${endHours}:${endMinutes.toString().padStart(2, '0')} ${endPeriod}`;
}
