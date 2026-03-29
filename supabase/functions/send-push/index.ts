import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * send-push: Delivers push notifications to user devices via APNs.
 *
 * Request body:
 *   { userId, title, body, data? }
 *   OR { tokens: [{ token, platform }], title, body, data? }  (direct mode)
 *
 * Requires secrets: APPLE_APNS_KEY_ID, APPLE_PRIVATE_KEY, APPLE_TEAM_ID
 */

// ─── JWT for APNs ───────────────────────────────────────────────────────────

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlEncode(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function createApnsJwt(keyId: string, teamId: string, privateKeyPem: string): Promise<string> {
  const header = { alg: 'ES256', kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: teamId, iat: now };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const claimsB64 = base64urlEncode(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;

  // Parse PEM to raw key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
    .replace(/-----END EC PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  // Convert DER signature to raw r||s format for JWT
  const sigBytes = new Uint8Array(signature);
  const sigB64 = base64url(derToRaw(sigBytes));

  return `${signingInput}.${sigB64}`;
}

/** Convert DER-encoded ECDSA signature to raw 64-byte r||s */
function derToRaw(der: Uint8Array): Uint8Array {
  // If already 64 bytes, assume raw format
  if (der.length === 64) return der;

  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  let offset = 2; // skip 0x30 + total length
  if (der[1] & 0x80) offset += (der[1] & 0x7f); // long form length

  // Parse r
  offset++; // skip 0x02
  const rLen = der[offset++];
  const r = der.slice(offset, offset + rLen);
  offset += rLen;

  // Parse s
  offset++; // skip 0x02
  const sLen = der[offset++];
  const s = der.slice(offset, offset + sLen);

  // Pad/trim to 32 bytes each
  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

// ─── APNs send ──────────────────────────────────────────────────────────────

interface PushResult {
  token: string;
  platform: string;
  success: boolean;
  error?: string;
  apnsId?: string;
}

async function sendApns(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, unknown> | undefined,
  jwt: string,
  isProduction: boolean
): Promise<PushResult> {
  const host = isProduction
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';

  const bundleId = 'app.lovable.bbef7015a2df45af893d7d36d59f8dcd';

  const payload = {
    aps: {
      alert: { title, body },
      sound: 'default',
      badge: 1,
    },
    ...(data || {}),
  };

  try {
    const res = await fetch(`${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return {
        token: deviceToken,
        platform: 'ios',
        success: true,
        apnsId: res.headers.get('apns-id') || undefined,
      };
    }

    const errBody = await res.text();
    console.error(`[send-push] APNs error ${res.status}: ${errBody}`);
    return { token: deviceToken, platform: 'ios', success: false, error: `APNs ${res.status}: ${errBody}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[send-push] APNs request failed:`, msg);
    return { token: deviceToken, platform: 'ios', success: false, error: msg };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, tokens: directTokens, title, body: pushBody, data } = await req.json();

    if (!title || !pushBody) {
      return new Response(
        JSON.stringify({ success: false, error: 'title and body are required', code: 'MISSING_PARAMS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get APNs credentials
    const keyId = Deno.env.get('APPLE_APNS_KEY_ID');
    const teamId = Deno.env.get('APPLE_TEAM_ID');
    const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
    const isProduction = Deno.env.get('APPLE_APNS_PRODUCTION') === 'true';

    if (!keyId || !teamId || !privateKey) {
      console.error('[send-push] Missing APNs credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'Push not configured', code: 'NOT_CONFIGURED' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve tokens
    let tokens: Array<{ token: string; platform: string }> = [];

    if (directTokens && Array.isArray(directTokens)) {
      tokens = directTokens;
    } else if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: dbTokens, error } = await supabase
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', userId);

      if (error) {
        console.error('[send-push] Token lookup error:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Token lookup failed', code: 'DB_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tokens = dbTokens || [];
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped: true, reason: 'no_tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate APNs JWT (valid for ~1 hour, fine for single invocation)
    const jwt = await createApnsJwt(keyId, teamId, privateKey);

    // Send to all iOS tokens
    const results: PushResult[] = [];
    for (const { token, platform } of tokens) {
      if (platform === 'ios') {
        const result = await sendApns(token, title, pushBody, data, jwt, isProduction);
        results.push(result);
      } else {
        // Android/FCM not yet configured — log and skip
        console.log(`[send-push] Skipping ${platform} token (FCM not configured)`);
        results.push({ token, platform, success: false, error: 'Platform not supported yet (no FCM key)' });
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[send-push] Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-push] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Push delivery failed', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
