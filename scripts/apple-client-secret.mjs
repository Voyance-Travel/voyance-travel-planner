/**
 * apple-client-secret.mjs — Generate the "Sign in with Apple" client secret JWT.
 *
 * This is the value you paste into Supabase → Auth → Providers → Apple → "Secret Key".
 * It's an ES256 JWT signed with your Apple .p8 private key (valid up to 6 months,
 * then regenerate). Zero dependencies — uses Node's built-in crypto.
 *
 * You need 4 things from Apple Developer (developer.apple.com):
 *   1. .p8 file        — Keys → your Sign-in-with-Apple key → Download
 *   2. APPLE_KEY_ID    — the Key ID of that key (10 chars)
 *   3. APPLE_TEAM_ID   — top-right of the portal (10 chars)
 *   4. APPLE_SERVICES_ID — the Services ID identifier, e.g. com.voyance.web  (this is the Client ID)
 *
 * RUN (key stays on your machine):
 *   APPLE_TEAM_ID=XXXXXXXXXX \
 *   APPLE_KEY_ID=YYYYYYYYYY \
 *   APPLE_SERVICES_ID=com.voyance.web \
 *   APPLE_P8_PATH=./AuthKey_YYYYYYYYYY.p8 \
 *   node scripts/apple-client-secret.mjs
 *
 * It prints the JWT. Paste it into Supabase as the Apple "Secret Key", with the
 * Services ID as the "Client ID". Done.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const TEAM_ID     = process.env.APPLE_TEAM_ID;
const KEY_ID      = process.env.APPLE_KEY_ID;
const SERVICES_ID = process.env.APPLE_SERVICES_ID;       // = Supabase "Client ID"
const P8_PATH     = process.env.APPLE_P8_PATH;

const missing = [
  ['APPLE_TEAM_ID', TEAM_ID], ['APPLE_KEY_ID', KEY_ID],
  ['APPLE_SERVICES_ID', SERVICES_ID], ['APPLE_P8_PATH', P8_PATH],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('❌ Missing env vars: ' + missing.join(', '));
  console.error('   See the header of this file for what each one is.');
  process.exit(1);
}

let privateKey;
try {
  privateKey = fs.readFileSync(P8_PATH, 'utf8');
} catch (e) {
  console.error(`❌ Could not read .p8 at ${P8_PATH}: ${e.message}`);
  process.exit(1);
}
if (!/BEGIN PRIVATE KEY/.test(privateKey)) {
  console.error('❌ That file does not look like a PEM .p8 private key.');
  process.exit(1);
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

const now = Math.floor(Date.now() / 1000);
const SIX_MONTHS = 60 * 60 * 24 * 180; // Apple's max is 6 months

const header  = { alg: 'ES256', kid: KEY_ID };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + SIX_MONTHS,
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
};

const signingInput = `${b64url(header)}.${b64url(payload)}`;

let signature;
try {
  // ES256 needs the JOSE (IEEE P1363 r||s) signature, not DER.
  signature = crypto
    .sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
} catch (e) {
  console.error(`❌ Signing failed: ${e.message}`);
  process.exit(1);
}

const jwt = `${signingInput}.${signature}`;

console.error('✅ Apple client secret JWT generated (valid until ' + new Date((now + SIX_MONTHS) * 1000).toISOString().slice(0, 10) + '):\n');
console.log(jwt);
console.error('\n→ Supabase → Auth → Providers → Apple:');
console.error('   Client ID  = ' + SERVICES_ID);
console.error('   Secret Key = the JWT above');
console.error('   Regenerate before the expiry date above.');
