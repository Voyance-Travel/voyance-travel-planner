import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate a short-lived APNs JWT using the same Apple .p8 key.
 */
async function getAPNsToken(): Promise<string> {
  const teamId = Deno.env.get("APPLE_TEAM_ID")!;
  const keyId = Deno.env.get("APPLE_APNS_KEY_ID") || Deno.env.get("APPLE_MAPKIT_KEY_ID")!;
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY")!;

  const pemContent = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  return await create(
    { alg: "ES256", kid: keyId },
    { iss: teamId, iat: getNumericDate(0) },
    key
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, title, body, data } = await req.json();

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: "userId and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the user's device token
    const { data: tokenRecord } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("platform", "ios")
      .single();

    if (!tokenRecord) {
      return new Response(
        JSON.stringify({ error: "No device token found", sent: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apnsToken = await getAPNsToken();
    const isProduction = Deno.env.get("APPLE_APNS_PRODUCTION") === "true";
    const apnsHost = isProduction
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

    const response = await fetch(
      `${apnsHost}/3/device/${tokenRecord.token}`,
      {
        method: "POST",
        headers: {
          authorization: `bearer ${apnsToken}`,
          "apns-topic": "com.voyancetravel.app",
          "apns-push-type": "alert",
          "apns-priority": "10",
        },
        body: JSON.stringify({
          aps: {
            alert: { title, body: body || "" },
            sound: "default",
            badge: 1,
          },
          ...(data || {}),
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[send-push] APNs error ${response.status}:`, err);
      return new Response(
        JSON.stringify({ error: `APNs error: ${response.status}`, details: err, sent: false }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-push] Push sent to user ${userId}`);
    return new Response(
      JSON.stringify({ success: true, sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-push] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, sent: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
