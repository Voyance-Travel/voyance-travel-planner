/**
 * Trip Chat Edge Function
 * Handles anonymous message posting for shared trip viewers.
 * Authenticated users post directly via Supabase client.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tripId, shareToken, displayName, message } = await req.json();

    if (!tripId || !shareToken || !displayName || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message too long (max 2000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (displayName.length > 50) {
      return new Response(
        JSON.stringify({ error: "Name too long (max 50 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate share token matches the trip and sharing is enabled
    const { data: trip, error: tripError } = await supabase
      .from("agency_trips")
      .select("id, share_enabled, share_token")
      .eq("id", tripId)
      .eq("share_token", shareToken)
      .eq("share_enabled", true)
      .maybeSingle();

    if (tripError || !trip) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired share link" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert chat message (anonymous - no user_id)
    const { data: msg, error: insertError } = await supabase
      .from("trip_chat_messages")
      .insert({
        trip_id: tripId,
        trip_type: "agency",
        user_id: null,
        display_name: displayName.trim(),
        message: message.trim(),
      })
      .select("id, display_name, message, created_at")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to send message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Trip chat error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
