/**
 * Trip Date Version History Service
 * Handles saving and restoring trip-level date snapshots for undo functionality
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface TripDateSnapshot {
  startDate: string;
  endDate: string;
  dayCount: number;
  itineraryData?: Record<string, unknown>;
  hotelSelection?: unknown;
}

export interface TripDateVersion {
  id: string;
  trip_id: string;
  start_date: string;
  end_date: string;
  day_count: number;
  itinerary_data: Record<string, unknown> | null;
  hotel_selection: unknown;
  created_at: string;
  created_by_action: string | null;
}

/**
 * Save a trip-level date snapshot before making date changes
 */
export async function saveTripDateVersion(
  tripId: string,
  snapshot: TripDateSnapshot
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('trip_date_versions')
      .insert({
        trip_id: tripId,
        start_date: snapshot.startDate,
        end_date: snapshot.endDate,
        day_count: snapshot.dayCount,
        itinerary_data: (snapshot.itineraryData ?? null) as unknown as Json,
        hotel_selection: (snapshot.hotelSelection ?? null) as unknown as Json,
        created_by_action: 'date_change',
      });

    if (error) {
      console.error('[TripDateVersion] Save error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[TripDateVersion] Save exception:', err);
    return { success: false, error: 'Failed to save date version' };
  }
}

/**
 * Get the most recent trip date version (for undo)
 */
export async function getLastTripDateVersion(
  tripId: string
): Promise<TripDateVersion | null> {
  try {
    const { data, error } = await supabase
      .from('trip_date_versions')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return data as unknown as TripDateVersion;
  } catch {
    return null;
  }
}

/**
 * Restore the most recent trip date version and delete it (pop)
 */
export async function restoreTripDateVersion(
  tripId: string
): Promise<{
  success: boolean;
  snapshot?: TripDateSnapshot;
  error?: string;
}> {
  try {
    const version = await getLastTripDateVersion(tripId);
    if (!version) {
      return { success: false, error: 'No date version to restore' };
    }

    // Delete this version (pop from stack)
    await supabase
      .from('trip_date_versions')
      .delete()
      .eq('id', version.id);

    return {
      success: true,
      snapshot: {
        startDate: version.start_date,
        endDate: version.end_date,
        dayCount: version.day_count,
        itineraryData: version.itinerary_data ?? undefined,
        hotelSelection: version.hotel_selection,
      },
    };
  } catch (err) {
    console.error('[TripDateVersion] Restore exception:', err);
    return { success: false, error: 'Failed to restore date version' };
  }
}

/**
 * Check if there's a trip date version available to undo
 */
export async function canUndoDateChange(tripId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('trip_date_versions')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId);

    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}
