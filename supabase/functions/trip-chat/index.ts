/**
 * Trip Chat Edge Function
 * Handles anonymous message posting for shared trip viewers.
 * Authenticated users post directly via Supabase client.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory rate limiting (per instance)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 messages per minute per IP

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// Sanitize display name: strip control chars, HTML tags, excessive whitespace
function sanitizeDisplayName(name: string): string {
  return name
    .replace(/[<>]/g, "") // strip HTML angle brackets
    .replace(/[\x00-\x1F\x7F]/g, "") // strip control characters
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

// Sanitize message: strip control chars (except newlines), HTML tags
function sanitizeMessage(msg: string): string {
  return msg
    .replace(/[<>]/g, "") // strip HTML angle brackets
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars (keep \n \r \t)
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit by IP
    const clientIP = getClientIP(req);
    if (isRateLimited(clientIP)) {
      return new Response(
        JSON.stringify({ error: "Too many messages. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tripId, shareToken, displayName, message } = await req.json();

    if (!tripId || !shareToken || !displayName || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize displayName
    const cleanName = sanitizeDisplayName(displayName);
    if (cleanName.length < 1 || cleanName.length > 50) {
      return new Response(
        JSON.stringify({ error: "Name must be 1-50 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize message
    const cleanMessage = sanitizeMessage(message);
    if (cleanMessage.length < 1 || cleanMessage.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message must be 1-2000 characters" }),
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
        display_name: cleanName,
        message: cleanMessage,
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
