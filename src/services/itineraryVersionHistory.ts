/**
 * Itinerary Version History Service
 * Handles saving and restoring day versions for undo functionality
 */

import { supabase } from '@/integrations/supabase/client';
import type { ItineraryActivity } from '@/types/itinerary';
import type { Json } from '@/integrations/supabase/types';

interface VersionMetadata {
  title?: string;
  theme?: string;
  narrative?: {
    theme?: string;
    highlights?: string[];
  };
}

export interface ItineraryVersion {
  id: string;
  trip_id: string;
  day_number: number;
  version_number: number;
  activities: ItineraryActivity[];
  day_metadata: VersionMetadata | null;
  created_at: string;
  created_by_action: string | null;
  is_current: boolean;
}

interface DayData {
  dayNumber: number;
  title?: string;
  theme?: string;
  narrative?: {
    theme?: string;
    highlights?: string[];
  };
  activities: ItineraryActivity[];
}

/**
 * Save a day's current state as a version (for manual saves before changes)
 */
export async function saveDayVersion(
  tripId: string,
  day: DayData,
  action: string = 'manual_save'
): Promise<{ success: boolean; version?: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('itinerary_versions')
      .insert({
        trip_id: tripId,
        day_number: day.dayNumber,
        activities: day.activities as unknown as Json,
        day_metadata: {
          title: day.title,
          theme: day.theme,
          narrative: day.narrative,
        } as Json,
        created_by_action: action,
      })
      .select('version_number')
      .single();

    if (error) {
      console.error('[VersionHistory] Save error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, version: data?.version_number };
  } catch (err) {
    console.error('[VersionHistory] Save exception:', err);
    return { success: false, error: 'Failed to save version' };
  }
}

/**
 * Get version history for a specific day
 */
export async function getDayVersionHistory(
  tripId: string,
  dayNumber: number
): Promise<ItineraryVersion[]> {
  try {
    const { data, error } = await supabase
      .from('itinerary_versions')
      .select('*')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .order('version_number', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[VersionHistory] Fetch error:', error);
      return [];
    }

    return (data || []) as unknown as ItineraryVersion[];
  } catch (err) {
    console.error('[VersionHistory] Fetch exception:', err);
    return [];
  }
}

/**
 * Get the previous version (for quick undo)
 */
export async function getPreviousVersion(
  tripId: string,
  dayNumber: number
): Promise<ItineraryVersion | null> {
  try {
    const { data, error } = await supabase
      .from('itinerary_versions')
      .select('*')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .order('version_number', { ascending: false })
      .limit(2); // Get current and previous

    if (error || !data || data.length < 2) {
      return null;
    }

    // Return the second one (previous version)
    return data[1] as unknown as ItineraryVersion;
  } catch (err) {
    console.error('[VersionHistory] Get previous error:', err);
    return null;
  }
}

/**
 * Restore a specific version
 */
export async function restoreVersion(
  tripId: string,
  dayNumber: number,
  versionNumber: number
): Promise<{ 
  success: boolean; 
  activities?: ItineraryActivity[]; 
  metadata?: VersionMetadata;
  error?: string;
}> {
  try {
    // Fetch the version to restore
    const { data: version, error: fetchError } = await supabase
      .from('itinerary_versions')
      .select('*')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .eq('version_number', versionNumber)
      .single();

    if (fetchError || !version) {
      return { success: false, error: 'Version not found' };
    }

    // Save current state as a new version before restoring (so user can undo the undo)
    // This is done automatically by the trigger when we insert

    // Mark this as the restored version
    await supabase
      .from('itinerary_versions')
      .insert({
        trip_id: tripId,
        day_number: dayNumber,
        activities: version.activities as unknown as Json,
        day_metadata: version.day_metadata as Json,
        created_by_action: `restored_from_v${versionNumber}`,
      });

    return {
      success: true,
      activities: version.activities as unknown as ItineraryActivity[],
      metadata: version.day_metadata as VersionMetadata | undefined,
    };
  } catch (err) {
    console.error('[VersionHistory] Restore exception:', err);
    return { success: false, error: 'Failed to restore version' };
  }
}

/**
 * Quick undo - restore to the previous version
 */
export async function undoLastChange(
  tripId: string,
  dayNumber: number
): Promise<{
  success: boolean;
  activities?: ItineraryActivity[];
  metadata?: VersionMetadata;
  restoredVersion?: number;
  error?: string;
}> {
  const previousVersion = await getPreviousVersion(tripId, dayNumber);
  
  if (!previousVersion) {
    return { success: false, error: 'No previous version available' };
  }

  const result = await restoreVersion(tripId, dayNumber, previousVersion.version_number);
  
  if (result.success) {
    return {
      ...result,
      restoredVersion: previousVersion.version_number,
    };
  }

  return result;
}

/**
 * Check if undo is available for a day
 */
export async function canUndo(tripId: string, dayNumber: number): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('itinerary_versions')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber);

    if (error) {
      return false;
    }

    // Need at least 2 versions to undo (current + previous)
    return (count || 0) >= 2;
  } catch {
    return false;
  }
}

/**
 * Get the latest non-empty version snapshot for a day.
 * Used by TripDetail self-heal to restore data instead of destructive regeneration.
 */
export async function getLatestNonEmptyVersion(
  tripId: string,
  dayNumber: number
): Promise<ItineraryVersion | null> {
  try {
    const { data, error } = await supabase
      .from('itinerary_versions')
      .select('*')
      .eq('trip_id', tripId)
      .eq('day_number', dayNumber)
      .order('version_number', { ascending: false })
      .limit(10);

    if (error || !data) return null;

    for (const row of data) {
      const version = row as unknown as ItineraryVersion;
      if (Array.isArray(version.activities) && version.activities.length > 0) {
        return version;
      }
    }
    return null;
  } catch (err) {
    console.error('[VersionHistory] getLatestNonEmptyVersion error:', err);
    return null;
  }
}

/**
 * Format version for display
 */
export function formatVersionLabel(version: ItineraryVersion): string {
  const date = new Date(version.created_at);
  const time = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true,
  });
  
  let actionLabel = '';
  switch (version.created_by_action) {
    case 'regenerate':
      actionLabel = 'Regenerated';
      break;
    case 'generate':
      actionLabel = 'Generated';
      break;
    case 'swap':
      actionLabel = 'Activity swapped';
      break;
    case 'manual_save':
      actionLabel = 'Saved';
      break;
    default:
      if (version.created_by_action?.startsWith('restored_from_v')) {
        actionLabel = 'Restored';
      } else {
        actionLabel = 'Modified';
      }
  }

  return `${actionLabel} at ${time}`;
}
