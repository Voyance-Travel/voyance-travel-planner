/**
 * Trip Suggestions Edge Function
 * Handles anonymous suggestion creation and voting for shared trip viewers.
 * Authenticated users interact directly via Supabase client.
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
    const body = await req.json();
    const { action, tripId, shareToken, displayName } = body;

    if (!tripId || !shareToken || !displayName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate share token
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

    if (action === "create_suggestion") {
      const { title, description, suggestionType } = body;
      if (!title || title.length > 200) {
        return new Response(
          JSON.stringify({ error: "Title required (max 200 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: suggestion, error: insertError } = await supabase
        .from("trip_suggestions")
        .insert({
          trip_id: tripId,
          trip_type: "agency",
          user_id: null,
          display_name: displayName.trim().slice(0, 50),
          suggestion_type: suggestionType || "general",
          title: title.trim(),
          description: description?.trim()?.slice(0, 1000) || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create suggestion" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, suggestion }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "vote") {
      const { suggestionId, voteType } = body;
      if (!suggestionId) {
        return new Response(
          JSON.stringify({ error: "Missing suggestionId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert vote (anon users identified by voter_name)
      const voterName = displayName.trim().slice(0, 50);

      // Delete existing vote first, then insert new one
      await supabase
        .from("trip_suggestion_votes")
        .delete()
        .eq("suggestion_id", suggestionId)
        .eq("voter_name", voterName)
        .is("user_id", null);

      if (voteType === "remove") {
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: voteError } = await supabase
        .from("trip_suggestion_votes")
        .insert({
          suggestion_id: suggestionId,
          user_id: null,
          voter_name: voterName,
          vote_type: voteType || "up",
        });

      if (voteError) {
        console.error("Vote error:", voteError);
        return new Response(
          JSON.stringify({ error: "Failed to vote" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Trip suggestions error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
