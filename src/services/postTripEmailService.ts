/**
 * Post-Trip Email Service
 * 
 * Handles triggering and tracking post-trip follow-up emails
 */

import { supabase } from '@/integrations/supabase/client';

export interface PostTripEmailResult {
  success: boolean;
  message?: string;
  error?: string;
  memories?: number;
}

/**
 * Trigger a post-trip follow-up email for a specific trip
 */
export async function sendPostTripEmail(tripId: string, userId: string): Promise<PostTripEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('post-trip-email', {
      body: { tripId, userId }
    });

    if (error) {
      console.error('Post-trip email error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success || false,
      message: data?.message,
      memories: data?.memories,
    };
  } catch (err) {
    console.error('Post-trip email failed:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Check if a post-trip email was already sent for a trip
 */
export async function wasPostTripEmailSent(tripId: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('trip_notifications')
      .select('id')
      .eq('trip_id', tripId)
      .eq('notification_type', 'post_trip_followup')
      .eq('sent', true)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Check if a trip is eligible for post-trip email (ended 7+ days ago)
 */
export function isTripEligibleForFollowUp(endDate: string): boolean {
  const tripEnd = new Date(endDate);
  const now = new Date();
  const daysSinceEnd = Math.floor((now.getTime() - tripEnd.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysSinceEnd >= 7;
}

/**
 * Get trips that are eligible for post-trip emails
 */
export async function getEligibleTripsForFollowUp(userId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, name, destination, end_date')
    .eq('user_id', userId)
    .lte('end_date', sevenDaysAgo.toISOString().split('T')[0])
    .order('end_date', { ascending: false })
    .limit(10);

  if (error || !trips) {
    return [];
  }

  // Filter out trips that already received follow-up
  const tripIds = trips.map(t => t.id);
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sentNotifs } = await (supabase as any)
      .from('trip_notifications')
      .select('trip_id')
      .in('trip_id', tripIds)
      .eq('notification_type', 'post_trip_followup')
      .eq('sent', true);

    const sentTripIds = new Set<string>(
      (sentNotifs || []).map((n: { trip_id: string }) => n.trip_id)
    );

    return trips.filter(t => !sentTripIds.has(t.id));
  } catch {
    return trips;
  }
}
