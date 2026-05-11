import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { parseAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Exact-match allowlist (case-insensitive on hostname).
const ALLOWED_HOSTS_EXACT = new Set<string>([
  "images.unsplash.com",
  "plus.unsplash.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "maps.googleapis.com",
]);

// Wildcard suffixes (must endsWith, with leading dot to prevent eviltarget-amazonaws.com).
const ALLOWED_HOST_SUFFIXES = [
  ".amazonaws.com", // S3 image hosts
  ".cloudinary.com",
];

// Hard-deny literals (cloud metadata + loopback names).
const DENY_HOST_LITERALS = new Set<string>([
  "localhost",
  "metadata.google.internal",
  "::1",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function isPrivateIp(host: string): boolean {
  // IPv4 dotted quad
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a === 127) return true;                       // 127.0.0.0/8 loopback
    if (a === 10) return true;                        // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;          // 192.168.0.0/16
    if (a === 169 && b === 254) return true;          // 169.254.0.0/16 link-local
    if (a === 0) return true;                         // 0.0.0.0/8
  }
  const v6 = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (v6 === "::1") return true;
  if (v6.startsWith("fe8") || v6.startsWith("fe9") ||
      v6.startsWith("fea") || v6.startsWith("feb")) return true; // fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true;     // fc00::/7 ULA
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate — block anonymous SSRF / storage-abuse attempts.
  const auth = await parseAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { destinationSlug, originalUrl, imageType = "hero" } =
      await req.json();

    if (!destinationSlug || !originalUrl) {
      return new Response(
        JSON.stringify({ error: "destinationSlug and originalUrl required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verdict = validateImageUrl(typeof originalUrl === "string" ? originalUrl : "");
    if (!verdict.ok) {
      console.warn(
        `[cache-destination-image] IMAGE_URL_NOT_ALLOWED reason=${verdict.reason} ` +
        `url=${String(originalUrl).slice(0, 200)} userId=${auth.userId}`,
      );
      return new Response(
        JSON.stringify({ error: "originalUrl host not allowed", code: "IMAGE_URL_NOT_ALLOWED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check if already cached
    const { data: cached } = await supabase
      .from("destination_image_cache")
      .select("storage_url, expires_at")
      .eq("destination_slug", destinationSlug)
      .eq("image_type", imageType)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify({ url: cached.storage_url, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Download external image
    console.log(`[cache-destination-image] Downloading: ${originalUrl}`);
    const imgResponse = await fetch(originalUrl, {
      headers: { "User-Agent": "Voyance/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!imgResponse.ok) {
      console.error(`[cache-destination-image] Failed to download: ${imgResponse.status}`);
      return new Response(
        JSON.stringify({ error: "Failed to download image", status: imgResponse.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response(
        JSON.stringify({ error: "Resource is not an image" }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const imageBuffer = await imgResponse.arrayBuffer();

    // Reject tiny/blank images (< 1KB) or oversized (> 5 MB).
    if (imageBuffer.byteLength < 1024) {
      return new Response(
        JSON.stringify({ error: "Image too small, likely blank" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({ error: "Image exceeds 5 MB size cap" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Determine file extension
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const storagePath = `${destinationSlug}/${imageType}.${ext}`;

    // 4. Upload to destination-images bucket
    const { error: uploadError } = await supabase.storage
      .from("destination-images")
      .upload(storagePath, imageBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[cache-destination-image] Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Upload failed", detail: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("destination-images")
      .getPublicUrl(storagePath);

    const storageUrl = publicUrlData.publicUrl;

    // 6. Upsert cache record
    await supabase.from("destination_image_cache").upsert(
      {
        destination_slug: destinationSlug,
        image_type: imageType,
        original_url: originalUrl,
        storage_path: storagePath,
        storage_url: storageUrl,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "destination_slug,image_type" }
    );

    console.log(`[cache-destination-image] Cached: ${storagePath}`);

    return new Response(
      JSON.stringify({ url: storageUrl, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[cache-destination-image] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
