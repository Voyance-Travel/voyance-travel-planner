## Context

`cache-destination-image` already has the `parseAuth` gate (lines 39-40) but `verify_jwt = false` in `supabase/config.toml` and the URL allowlist (lines 11-31) is too permissive in some ways and missing the requested hosts in others. No private-IP / DNS-rebinding guard exists, and rejection responses don't carry the `IMAGE_URL_NOT_ALLOWED` code or log caller identity.

Three precise changes — no other behavior touched.

## Change 1 — `supabase/config.toml` (line 31)

Flip `verify_jwt` to `true` for `cache-destination-image`:

```toml
[functions.cache-destination-image]
  verify_jwt = true
```

## Change 2 — `supabase/functions/cache-destination-image/index.ts` (auth response shape)

The existing `parseAuth` call already returns 401 with `code: "UNAUTHORIZED"` for missing bearer (and `AUTH_INVALID` for bad tokens). No code change needed — keep lines 39-40 as-is. The `verify_jwt = true` flip is now defense-in-depth at the platform edge.

## Change 3 — `supabase/functions/cache-destination-image/index.ts` (URL allowlist hardening)

Replace the current `ALLOWED_IMAGE_HOSTS` set + `isAllowedImageUrl` (lines 10-31) and the rejection branch (lines 53-58) with a stricter validator:

```ts
// Exact-match hosts (case-insensitive)
const ALLOWED_HOSTS_EXACT = new Set<string>([
  "images.unsplash.com",
  "plus.unsplash.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "maps.googleapis.com",
]);

// Wildcard suffixes — host must endsWith one of these (with leading dot)
const ALLOWED_HOST_SUFFIXES = [
  ".amazonaws.com",   // S3 image hosts
  ".cloudinary.com",
];

// Hard-deny literals + private/loopback/link-local/ULA ranges
const DENY_HOST_LITERALS = new Set<string>([
  "localhost",
  "metadata.google.internal",
  "::1",
]);

function isPrivateIp(host: string): boolean {
  // IPv4 dotted quad
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 127) return true;                  // 127.0.0.0/8 loopback
    if (a === 10) return true;                   // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;     // 192.168.0.0/16
    if (a === 169 && b === 254) return true;     // 169.254.0.0/16 link-local
    if (a === 0) return true;                    // 0.0.0.0/8
  }
  // IPv6 — strip brackets if URL gave us [::1] etc.
  const v6 = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (v6 === "::1") return true;
  if (v6.startsWith("fe8") || v6.startsWith("fe9") ||
      v6.startsWith("fea") || v6.startsWith("feb")) return true; // fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true; // fc00::/7 ULA
  return false;
}

function validateImageUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: "parse" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "protocol" };
  const host = u.hostname.toLowerCase();
  if (DENY_HOST_LITERALS.has(host)) return { ok: false, reason: "deny_literal" };
  if (isPrivateIp(host)) return { ok: false, reason: "private_ip" };
  if (ALLOWED_HOSTS_EXACT.has(host)) return { ok: true };
  if (ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return { ok: true };
  return { ok: false, reason: "host_not_allowed" };
}
```

Replace the rejection branch:

```ts
const verdict = validateImageUrl(typeof originalUrl === "string" ? originalUrl : "");
if (!verdict.ok) {
  console.warn(
    `[cache-destination-image] IMAGE_URL_NOT_ALLOWED reason=${verdict.reason} ` +
    `url=${String(originalUrl).slice(0, 200)} userId=${auth.userId}`,
  );
  return new Response(
    JSON.stringify({ error: "originalUrl host not allowed", code: "IMAGE_URL_NOT_ALLOWED" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
```

Note: dropping the previous allow-entries (`cdn.pixabay.com`, `images.pexels.com`, `jsxplunjjvxuejeouwob.supabase.co`) per the spec's exact host list. The Supabase storage host is unnecessary because already-cached images short-circuit at the cache check before any fetch.

Everything below the validator (cache check, fetch, content-type/size guards, upload, DB upsert) is untouched.

## Verification

```bash
grep -n "verify_jwt = true" supabase/config.toml | grep cache-destination-image   # 1 hit
grep -nE "ALLOWED_HOSTS|IMAGE_URL_NOT_ALLOWED|isPrivateIp" \
  supabase/functions/cache-destination-image/index.ts                              # ≥3 hits
```

Plus a manual `curl` (no Authorization) → expect 401 `UNAUTHORIZED`; with token + `originalUrl=http://169.254.169.254/latest/meta-data/` → expect 400 `IMAGE_URL_NOT_ALLOWED`.

After fix, mark the SSRF/storage-abuse finding fixed via `security--manage_security_finding` and append a memory entry: `[Cache-Destination-Image SSRF Lockdown]` under `mem://constraints/security/` documenting the auth gate + allowlist + private-IP guard.
