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
  restored_at?: string | null;
  times_restored?: number | null;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
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

    // Snapshot the CURRENT trip dates BEFORE applying the restore, so the
    // pre-restore state is preserved as a new history row. Older versions
    // are intentionally NOT deleted — full history is retained for audit.
    try {
      const { data: trip } = await supabase
        .from('trips')
        .select('start_date, end_date, itinerary_data, hotel_selection')
        .eq('id', tripId)
        .single();

      if (trip) {
        const dayCount = Array.isArray((trip.itinerary_data as Record<string, unknown> | null)?.days)
          ? (((trip.itinerary_data as Record<string, unknown>).days) as unknown[]).length
          : 0;
        await supabase.from('trip_date_versions').insert({
          trip_id: tripId,
          start_date: trip.start_date,
          end_date: trip.end_date,
          day_count: dayCount,
          itinerary_data: (trip.itinerary_data ?? null) as unknown as Json,
          hotel_selection: (trip.hotel_selection ?? null) as unknown as Json,
          created_by_action: 'pre_restore_snapshot',
          label: 'Pre-restore snapshot',
          metadata: { auto_snapshot: true, before_restore_of: version.id } as unknown as Json,
        });
      }
    } catch (snapErr) {
      console.warn('[TripDateVersion] Pre-restore snapshot failed (non-fatal):', snapErr);
    }

    // Mark the restored version (keep it in history; bump counter)
    await supabase
      .from('trip_date_versions')
      .update({
        restored_at: new Date().toISOString(),
        times_restored: (version.times_restored ?? 0) + 1,
      })
      .eq('id', version.id);

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
