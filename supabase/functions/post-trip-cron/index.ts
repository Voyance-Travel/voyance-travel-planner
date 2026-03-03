import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cron job to send post-trip follow-up emails
 * Runs daily, finds trips that ended 7 days ago
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find trips that ended 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const targetDate = sevenDaysAgo.toISOString().split('T')[0];

    // Also check for 6-8 day range to catch any missed
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    console.log(`[PostTripCron] Looking for trips ending between ${eightDaysAgo.toISOString().split('T')[0]} and ${sixDaysAgo.toISOString().split('T')[0]}`);

    // Get trips that ended in the target window
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id, user_id, name, destination, end_date')
      .gte('end_date', eightDaysAgo.toISOString().split('T')[0])
      .lte('end_date', sixDaysAgo.toISOString().split('T')[0]);

    if (tripsError) {
      throw tripsError;
    }

    if (!trips || trips.length === 0) {
      console.log("[PostTripCron] No trips found for follow-up");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No trips to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PostTripCron] Found ${trips.length} trips for follow-up`);

    // Filter out trips that already received follow-up
    const tripIds = trips.map(t => t.id);
    const { data: sentNotifications } = await supabase
      .from('trip_notifications')
      .select('trip_id')
      .in('trip_id', tripIds)
      .eq('notification_type', 'post_trip_followup')
      .eq('sent', true);

    const sentTripIds = new Set(sentNotifications?.map(n => n.trip_id) || []);
    const tripsToProcess = trips.filter(t => !sentTripIds.has(t.id));

    console.log(`[PostTripCron] ${tripsToProcess.length} trips need follow-up`);

    // Process each trip
    const results = [];
    for (const trip of tripsToProcess) {
      try {
        // Call the post-trip-email function
        const { data, error } = await supabase.functions.invoke('post-trip-email', {
          body: { tripId: trip.id, userId: trip.user_id }
        });

        results.push({
          tripId: trip.id,
          destination: trip.destination,
          success: !error,
          error: error?.message,
        });
      } catch (err) {
        results.push({
          tripId: trip.id,
          destination: trip.destination,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        successful: successCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("post-trip-cron error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Post-trip processing failed", code: "CRON_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
