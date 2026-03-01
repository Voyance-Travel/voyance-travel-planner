import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destinationSlug, originalUrl, imageType = "hero" } =
      await req.json();

    if (!destinationSlug || !originalUrl) {
      return new Response(
        JSON.stringify({ error: "destinationSlug and originalUrl required" }),
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
    const imageBuffer = await imgResponse.arrayBuffer();

    // Reject tiny/blank images (< 1KB)
    if (imageBuffer.byteLength < 1024) {
      return new Response(
        JSON.stringify({ error: "Image too small, likely blank" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
