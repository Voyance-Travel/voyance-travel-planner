/**
 * commit-token — HMAC-bound proof that a `days` array passed
 * `resolveCommitGate`. The token is content-bound: editing the days
 * between mint and persist invalidates it.
 *
 * Format: base64url(`${tripId}.${gateVersion}.${issuedAtMs}.${contentHash}.${sig}`)
 * where sig = HMAC-SHA256(secret, `${tripId}|${contentHash}|${gateVersion}|${issuedAtMs}`).
 *
 * Secret resolution (first available):
 *   1. COMMIT_GATE_SECRET   (preferred, settable via secrets tool)
 *   2. SUPABASE_SERVICE_ROLE_KEY  (fallback, always present in edge runtime)
 *   3. 'dev-commit-gate'    (last-resort, only in local Deno tests)
 *
 * TTL: 5 minutes. Tokens older than TTL are treated as invalid.
 *
 * This module is intentionally tiny and dependency-free so it can be
 * imported from any edge function without pulling in supabase-js etc.
 */

export const COMMIT_GATE_VERSION = 1;
const TOKEN_TTL_MS = 5 * 60 * 1000;

function getSecret(): string {
  try {
    // @ts-ignore — Deno is the runtime, declared globally in edge functions.
    const env = (globalThis as any).Deno?.env;
    if (env) {
      return (
        env.get('COMMIT_GATE_SECRET') ||
        env.get('SUPABASE_SERVICE_ROLE_KEY') ||
        'dev-commit-gate'
      );
    }
  } catch {
    // fall through
  }
  return 'dev-commit-gate';
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return new Uint8Array(sig);
}

/**
 * Canonical content hash of a `days` array. Stable across key ordering
 * via JSON.stringify of the sorted-key serialization wouldn't be worth
 * the cost — JSON.stringify with insertion order is good enough because
 * the same code mints and verifies, and we re-serialize from the SAME
 * in-memory payload at the persist boundary.
 */
export async function contentHash(days: any[]): Promise<string> {
  const json = JSON.stringify(days || []);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return b64url(new Uint8Array(buf));
}

/** Mint a token for the given trip + days. Returns base64url string. */
export async function mintCommitToken(
  tripId: string,
  days: any[],
): Promise<string> {
  const ch = await contentHash(days);
  const issuedAt = Date.now();
  const msg = `${tripId}|${ch}|${COMMIT_GATE_VERSION}|${issuedAt}`;
  const sig = await hmac(getSecret(), msg);
  const payload = `${tripId}.${COMMIT_GATE_VERSION}.${issuedAt}.${ch}.${b64url(sig)}`;
  return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface VerifyResult {
  ok: boolean;
  reason?:
    | 'missing'
    | 'malformed'
    | 'trip-mismatch'
    | 'version-mismatch'
    | 'expired'
    | 'content-mismatch'
    | 'bad-signature';
  issuedAt?: number;
  ageMs?: number;
}

/**
 * Verify a token against the current trip + days payload. Re-computes
 * the content hash from `days` so a caller can't swap days between mint
 * and persist.
 */
export async function verifyCommitToken(
  token: string | null | undefined,
  tripId: string,
  days: any[],
): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'missing' };
  let payload: string;
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/') +
      '==='.slice((token.length + 3) % 4);
    payload = atob(padded);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const parts = payload.split('.');
  if (parts.length !== 5) return { ok: false, reason: 'malformed' };
  const [tokTripId, vStr, issuedAtStr, ch, sigB64] = parts;
  if (tokTripId !== tripId) return { ok: false, reason: 'trip-mismatch' };
  const ver = Number(vStr);
  if (ver !== COMMIT_GATE_VERSION) return { ok: false, reason: 'version-mismatch' };
  const issuedAt = Number(issuedAtStr);
  const ageMs = Date.now() - issuedAt;
  if (!Number.isFinite(issuedAt) || ageMs > TOKEN_TTL_MS || ageMs < -60_000) {
    return { ok: false, reason: 'expired', issuedAt, ageMs };
  }
  const actualHash = await contentHash(days);
  if (actualHash !== ch) {
    return { ok: false, reason: 'content-mismatch', issuedAt, ageMs };
  }
  const msg = `${tripId}|${ch}|${COMMIT_GATE_VERSION}|${issuedAt}`;
  const expected = await hmac(getSecret(), msg);
  let actual: Uint8Array;
  try {
    actual = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (expected.length !== actual.length) {
    return { ok: false, reason: 'bad-signature', issuedAt, ageMs };
  }
  // Constant-time compare.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  if (diff !== 0) return { ok: false, reason: 'bad-signature', issuedAt, ageMs };
  return { ok: true, issuedAt, ageMs };
}
