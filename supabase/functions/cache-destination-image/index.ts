import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { parseAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Allowlist of trusted image source hosts. Add more here as needed.
const ALLOWED_IMAGE_HOSTS = new Set<string>([
  "images.unsplash.com",
  "plus.unsplash.com",
  "cdn.pixabay.com",
  "images.pexels.com",
  "lh3.googleusercontent.com",
  "maps.googleapis.com",
  "jsxplunjjvxuejeouwob.supabase.co",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
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

    if (typeof originalUrl !== "string" || !isAllowedImageUrl(originalUrl)) {
      return new Response(
        JSON.stringify({ error: "originalUrl host not allowed" }),
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
