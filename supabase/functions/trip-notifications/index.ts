import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TripNotification {
  id: string;
  tripId: string;
  userId: string;
  type: 'activity_reminder' | 'weather_alert' | 'feedback_prompt' | 'trip_start' | 'trip_end' | 'activity_change';
  title: string;
  message: string;
  activityId?: string;
  activityName?: string; // Store actual activity name for display
  scheduledFor: string;
  sent: boolean;
  createdAt: string;
}

interface ScheduleRequest {
  tripId: string;
  userId: string;
}

// Check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

// Generate notifications for an active trip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scheduleTripNotifications(
  supabase: any,
  tripId: string,
  userId: string
): Promise<TripNotification[]> {
  console.log(`[trip-notifications] Scheduling notifications for trip ${tripId}`);
  
  // Get trip details
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    console.error('[trip-notifications] Trip not found:', tripError);
    throw new Error('Trip not found');
  }

  const notifications: Omit<TripNotification, 'id' | 'createdAt'>[] = [];
  const now = new Date();
  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.end_date);

  // Trip start notification (morning of first day)
  if (startDate > now) {
    const tripStartTime = new Date(startDate);
    tripStartTime.setHours(7, 0, 0, 0);
    
    notifications.push({
      tripId,
      userId,
      type: 'trip_start',
      title: `Your ${trip.destination} adventure begins! 🎉`,
      message: `Good morning! Today marks the start of your ${trip.name}. Check your itinerary for today's exciting activities.`,
      scheduledFor: tripStartTime.toISOString(),
      sent: false
    });
  }

  // Parse itinerary data for activity reminders
  const itineraryData = trip.itinerary_data as { days?: Array<{ dayNumber: number; date: string; activities?: Array<{ id: string; name?: string; title?: string; startTime?: string; location?: string | { name?: string; address?: string } }> }> } | null;
  
  // Helper to create a readable name from an activity ID (fallback)
  function humanizeActivityId(id: string): string {
    if (!id) return 'Activity';
    return id
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\d+/g, '') // Remove numbers
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim() || 'Activity';
  }
  
  if (itineraryData?.days) {
    for (const day of itineraryData.days) {
      const dayDate = new Date(day.date);
      
      // Skip past days
      if (dayDate < now && !isToday(dayDate)) continue;
      
      if (day.activities) {
        for (const activity of day.activities) {
          if (!activity.startTime) continue;
          
          // Get activity name - support multiple field names, with ID fallback
          const activityName = activity.title || activity.name || humanizeActivityId(activity.id);
          
          // Get location string - handle all possible formats
          let locationStr = '';
          if (activity.location) {
            if (typeof activity.location === 'string') {
              locationStr = activity.location;
            } else if (typeof activity.location === 'object') {
              // Try various property names that might contain the location
              const loc = activity.location as Record<string, unknown>;
              locationStr = (
                loc.name || 
                loc.address || 
                loc.venue || 
                loc.place || 
                loc.formatted_address ||
                ''
              ) as string;
            }
          }
          
          // Parse activity time
          const [hours, minutes] = activity.startTime.split(':').map(Number);
          const activityTime = new Date(dayDate);
          activityTime.setHours(hours, minutes, 0, 0);
          
          // Skip past activities
          if (activityTime < now) continue;
          
          // 30-minute reminder before activity
          const reminderTime = new Date(activityTime.getTime() - 30 * 60 * 1000);
          
          if (reminderTime > now) {
            notifications.push({
              tripId,
              userId,
              type: 'activity_reminder',
              title: `Coming up: ${activityName}`,
              message: locationStr 
                ? `Your next activity starts in 30 minutes at ${locationStr}. Time to get ready!`
                : `Your next activity "${activityName}" starts in 30 minutes. Time to get ready!`,
              activityId: activity.id,
              activityName, // Store for later use
              scheduledFor: reminderTime.toISOString(),
              sent: false
            });
          }
          
          // Feedback prompt 30 minutes after activity end (estimate 2 hours duration)
          const feedbackTime = new Date(activityTime.getTime() + 150 * 60 * 1000);
          
          if (feedbackTime > now) {
            notifications.push({
              tripId,
              userId,
              type: 'feedback_prompt',
              title: `How was ${activityName}?`,
              message: `We'd love to hear about your experience! Your feedback helps us personalize your future trips.`,
              activityId: activity.id,
              activityName, // Store for later use
              scheduledFor: feedbackTime.toISOString(),
              sent: false
            });
          }
        }
      }
    }
  }

  // Trip end notification (evening of last day)
  const tripEndTime = new Date(endDate);
  tripEndTime.setHours(20, 0, 0, 0);
  
  if (tripEndTime > now) {
    notifications.push({
      tripId,
      userId,
      type: 'trip_end',
      title: `What an amazing trip! 🌟`,
      message: `Your ${trip.destination} adventure is coming to an end. Don't forget to share your feedback to help us create even better trips for you!`,
      scheduledFor: tripEndTime.toISOString(),
      sent: false
    });
  }

  console.log(`[trip-notifications] Created ${notifications.length} notification entries`);
  
  // Store notifications in database (using trip metadata for now)
  const { error: updateError } = await supabase
    .from('trips')
    .update({
      metadata: {
        ...(trip.metadata || {}),
        scheduledNotifications: notifications
      }
    })
    .eq('id', tripId);

  if (updateError) {
    console.error('[trip-notifications] Failed to store notifications:', updateError);
  }

  return notifications.map((n, i) => ({
    ...n,
    id: `notif-${tripId}-${i}`,
    createdAt: new Date().toISOString()
  }));
}

// Get due notifications (for cron job or polling)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDueNotifications(
  supabase: any
): Promise<{ tripId: string; notification: TripNotification }[]> {
  const now = new Date().toISOString();
  
  // Get all active trips with scheduled notifications
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, user_id, metadata')
    .eq('status', 'active');

  if (error || !trips) {
    console.error('[trip-notifications] Error fetching trips:', error);
    return [];
  }

  const dueNotifications: { tripId: string; notification: TripNotification }[] = [];

  for (const trip of trips) {
    const metadata = trip.metadata as { scheduledNotifications?: TripNotification[] } | null;
    const notifications = metadata?.scheduledNotifications || [];
    
    for (const notif of notifications) {
      if (!notif.sent && notif.scheduledFor <= now) {
        dueNotifications.push({
          tripId: trip.id,
          notification: { ...notif, id: notif.id || crypto.randomUUID() }
        });
      }
    }
  }

  console.log(`[trip-notifications] Found ${dueNotifications.length} due notifications`);
  return dueNotifications;
}

// Mark notification as sent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markNotificationSent(
  supabase: any,
  tripId: string,
  notificationId: string
): Promise<void> {
  const { data: trip, error: fetchError } = await supabase
    .from('trips')
    .select('metadata')
    .eq('id', tripId)
    .single();

  if (fetchError || !trip) {
    console.error('[trip-notifications] Failed to fetch trip:', fetchError);
    return;
  }

  const metadata = trip.metadata as { scheduledNotifications?: TripNotification[] } | null;
  const notifications = metadata?.scheduledNotifications || [];
  
  const updatedNotifications = notifications.map((n: TripNotification) => 
    n.id === notificationId ? { ...n, sent: true } : n
  );

  await supabase
    .from('trips')
    .update({
      metadata: {
        ...(metadata || {}),
        scheduledNotifications: updatedNotifications
      }
    })
    .eq('id', tripId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[trip-notifications] Action: ${action}`);

    if (action === 'schedule') {
      const { tripId, userId } = params as ScheduleRequest;
      
      if (!tripId || !userId) {
        return new Response(
          JSON.stringify({ error: 'tripId and userId are required' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const notifications = await scheduleTripNotifications(supabase, tripId, userId);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          notifications,
          count: notifications.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'get-due') {
      const dueNotifications = await getDueNotifications(supabase);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          notifications: dueNotifications
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'process-due') {
      // Fetch due notifications, send push for each, mark as sent
      const dueNotifications = await getDueNotifications(supabase);
      console.log(`[trip-notifications] Processing ${dueNotifications.length} due notifications`);

      const results: Array<{ notificationId: string; pushResult: unknown }> = [];

      for (const { tripId, notification } of dueNotifications) {
        try {
          // Call send-push edge function
          const pushRes = await fetch(
            `${supabaseUrl}/functions/v1/send-push`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                userId: notification.userId,
                title: notification.title,
                body: notification.message,
                data: { tripId, activityId: notification.activityId, type: notification.type },
              }),
            }
          );

          const pushResult = await pushRes.json();
          results.push({ notificationId: notification.id, pushResult });

          // Mark as sent regardless of push outcome (notification was processed)
          await markNotificationSent(supabase, tripId, notification.id);
        } catch (err) {
          console.error(`[trip-notifications] Failed to process notification ${notification.id}:`, err);
          results.push({ notificationId: notification.id, pushResult: { error: String(err) } });
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'mark-sent') {
      const { tripId, notificationId } = params;
      
      if (!tripId || !notificationId) {
        return new Response(
          JSON.stringify({ error: 'tripId and notificationId are required' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await markNotificationSent(supabase, tripId, notificationId);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'get-user-notifications') {
      const { userId } = params;
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId is required' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get active trips for user - handle gracefully if none found
      const { data: trips, error } = await supabase
        .from('trips')
        .select('id, name, destination, metadata')
        .eq('user_id', userId)
        .in('status', ['active', 'planning', 'booked']);

      if (error) {
        console.error('[trip-notifications] Error fetching trips:', error);
        // Return empty notifications instead of error
        return new Response(
          JSON.stringify({ success: true, notifications: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allNotifications: Array<TripNotification & { tripName: string; destination: string }> = [];
      
      // Helper to create readable name from activity ID
      const humanizeActivityId = (id: string): string => {
        if (!id) return 'Activity';
        return id
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .replace(/\d+/g, '')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
          .trim() || 'Activity';
      };
      
      // Helper to sanitize text (clean up old buggy notifications)
      const sanitizeText = (text: string, activityId?: string): string => {
        if (!text) return activityId ? humanizeActivityId(activityId) : 'Activity';
        
        // If text contains "undefined", try to replace with activity name from ID
        const activityNameFromId = activityId ? humanizeActivityId(activityId) : 'Activity';
        
        return text
          .replace(/undefined/gi, activityNameFromId)
          .replace(/\[object Object\]/gi, '')
          .replace(/Coming up: Activity$/i, `Coming up: ${activityNameFromId}`)
          .replace(/How was Activity\?/i, `How was ${activityNameFromId}?`)
          .replace(/at\s*\.\s*Time/gi, 'Time')
          .replace(/at\s+Time/gi, 'Time')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      for (const trip of trips || []) {
        const metadata = trip.metadata as { scheduledNotifications?: TripNotification[] } | null;
        const notifications = metadata?.scheduledNotifications || [];
        
        for (const notif of notifications) {
          if (!notif.sent) {
            // Use stored activityName if available, or extract from activityId
            const activityNameDisplay = notif.activityName || (notif.activityId ? humanizeActivityId(notif.activityId) : undefined);
            
            allNotifications.push({
              ...notif,
              id: notif.id || crypto.randomUUID(),
              title: sanitizeText(notif.title, notif.activityId),
              message: sanitizeText(notif.message, notif.activityId),
              activityName: activityNameDisplay,
              tripName: trip.name,
              destination: trip.destination
            });
          }
        }
      }

      // Sort by scheduled time
      allNotifications.sort((a, b) => 
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          notifications: allNotifications.slice(0, 20) // Limit to 20
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[trip-notifications] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: "Notification processing failed", code: "NOTIFICATION_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
