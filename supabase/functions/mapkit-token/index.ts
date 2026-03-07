import { corsHeaders, handleCorsPreflightRequest, jsonResponse, errorResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsResp = handleCorsPreflightRequest(req);
  if (corsResp) return corsResp;

  try {
    const teamId = Deno.env.get('APPLE_TEAM_ID');
    const keyId = Deno.env.get('APPLE_MAPKIT_KEY_ID');
    const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY');

    if (!teamId || !keyId || !privateKeyPem) {
      return errorResponse('MapKit credentials not configured', 500);
    }

    // Parse the PEM private key
    const pemContent = privateKeyPem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');

    const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    // Build JWT header and payload
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 3600, // 1 hour
      origin: [
        'https://travelwithvoyance.com',
        'https://voyance-travel-planner.lovable.app',
        'https://id-preview--bbef7015-a2df-45af-893d-7d36d59f8dcd.lovable.app',
      ],
    };

    // Base64url encode
    const b64url = (data: Uint8Array) =>
      btoa(String.fromCharCode(...data))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const enc = new TextEncoder();
    const headerB64 = b64url(enc.encode(JSON.stringify(header)));
    const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;

    // Sign with ECDSA P-256
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      enc.encode(signingInput)
    );

    // Convert DER signature to raw r||s format for JWT
    const sigBytes = new Uint8Array(signature);
    let sigB64: string;

    if (sigBytes.length === 64) {
      // Already raw format
      sigB64 = b64url(sigBytes);
    } else {
      // DER format — extract r and s
      const r = extractDERInt(sigBytes, 3);
      const s = extractDERInt(sigBytes, 3 + 1 + sigBytes[3] + 1);
      const raw = new Uint8Array(64);
      raw.set(padTo32(r), 0);
      raw.set(padTo32(s), 32);
      sigB64 = b64url(raw);
    }

    const token = `${signingInput}.${sigB64}`;

    return jsonResponse({ token });
  } catch (error) {
    console.error('[mapkit-token] Error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Internal error', 500);
  }
});

function extractDERInt(buf: Uint8Array, offset: number): Uint8Array {
  const len = buf[offset + 1];
  return buf.slice(offset + 2, offset + 2 + len);
}

function padTo32(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32) return bytes.slice(bytes.length - 32);
  const padded = new Uint8Array(32);
  padded.set(bytes, 32 - bytes.length);
  return padded;
}
