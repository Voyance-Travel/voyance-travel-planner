/**
 * upload-trip-memory
 *
 * Server-side validated photo upload for the trip-memories bucket.
 *
 * Enforces (security boundary — frontend checks are UX only):
 *  - JWT auth + trip ownership/collaboration
 *  - Hard size cap (10 MB)
 *  - MIME allowlist (jpeg / png / webp)
 *  - Magic-byte sniff (claimed MIME must match real bytes)
 *  - Dimension sanity (16px ≤ side ≤ 12000px)
 *  - EXIF / GPS strip via decode + re-encode to JPEG
 *  - Service-role upload to locked-down bucket
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MIN_DIM = 16;
const MAX_DIM = 12000;

type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
const ALLOWED_MIMES: AllowedMime[] = ["image/jpeg", "image/png", "image/webp"];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Identify image type from leading bytes; returns canonical MIME or null. */
function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  // WEBP: "RIFF"...."WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Missing authorization" });
    }
    const token = authHeader.slice(7);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) return json(401, { error: "Invalid session" });

    // ---- Parse multipart ----
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json(400, { error: "Expected multipart/form-data" });
    }

    const file = form.get("file");
    const tripId = String(form.get("tripId") || "");
    if (!(file instanceof File)) return json(400, { error: "Missing file" });
    if (!tripId) return json(400, { error: "Missing tripId" });

    // ---- Trip access ----
    // RLS-scoped client: returns the trip only if user is owner/collaborator.
    const { data: trip, error: tripErr } = await userClient
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .maybeSingle();
    if (tripErr || !trip) return json(403, { error: "No access to this trip" });

    // ---- Size ----
    if (file.size <= 0) return json(400, { error: "Empty file", code: "EMPTY_FILE" });
    if (file.size > MAX_BYTES) {
      return json(400, {
        error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`,
        code: "FILE_TOO_LARGE",
      });
    }

    // ---- Bytes + magic-byte sniff ----
    const buf = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffMime(buf);
    if (!sniffed || !ALLOWED_MIMES.includes(sniffed)) {
      return json(400, {
        error: "Unsupported or invalid image type. Allowed: JPEG, PNG, WEBP.",
        code: "INVALID_FILE_TYPE",
      });
    }
    // Reject claim/byte mismatch (stops .exe-renamed-as-.jpg via DevTools).
    const claimedType = (file.type || "").toLowerCase();
    if (claimedType && claimedType !== sniffed) {
      return json(400, {
        error: "File contents do not match declared type.",
        code: "MIME_MISMATCH",
      });
    }

    // ---- Decode → strip EXIF → re-encode JPEG ----
    let decoded: Image;
    try {
      const result = await decode(buf);
      // imagescript decode may return an animated GIF (frames); we only allow stills here.
      if (!(result instanceof Image)) {
        return json(400, { error: "Animated images are not supported", code: "ANIMATED_NOT_SUPPORTED" });
      }
      decoded = result;
    } catch {
      return json(400, { error: "Could not decode image", code: "DECODE_FAILED" });
    }

    if (
      decoded.width < MIN_DIM || decoded.height < MIN_DIM ||
      decoded.width > MAX_DIM || decoded.height > MAX_DIM
    ) {
      return json(400, {
        error: `Image dimensions out of range (${MIN_DIM}-${MAX_DIM}px per side)`,
        code: "BAD_DIMENSIONS",
      });
    }

    // Re-encode as JPEG @ q=85 — this drops all EXIF/GPS metadata.
    const jpegBytes = await decoded.encodeJPEG(85);

    // ---- Upload (service role; bucket is locked down to service writes) ----
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const fileName = `${user.id}/${tripId}/${Date.now()}.jpg`;
    const { error: uploadErr } = await adminClient.storage
      .from("trip-memories")
      .upload(fileName, jpegBytes, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });
    if (uploadErr) {
      console.error("[upload-trip-memory] upload failed:", uploadErr.message);
      return json(500, { error: "Upload failed" });
    }

    // ---- Metadata row (RLS-scoped via user client so insert policy applies) ----
    const activityId = (form.get("activityId") as string) || null;
    const activityName = (form.get("activityName") as string) || null;
    const caption = (form.get("caption") as string) || null;
    const locationName = (form.get("locationName") as string) || null;
    const dayNumberRaw = form.get("dayNumber");
    const dayNumber = dayNumberRaw ? Number(dayNumberRaw) : null;

    const { data: memory, error: insertErr } = await userClient
      .from("trip_memories")
      .insert({
        user_id: user.id,
        trip_id: tripId,
        activity_id: activityId,
        activity_name: activityName,
        image_url: fileName, // storage path, signed-URL on read
        caption,
        location_name: locationName,
        day_number: Number.isFinite(dayNumber) ? dayNumber : null,
      })
      .select()
      .single();

    if (insertErr || !memory) {
      // Rollback the orphan storage object.
      await adminClient.storage.from("trip-memories").remove([fileName]).catch(() => {});
      console.error("[upload-trip-memory] insert failed:", insertErr?.message);
      return json(500, { error: "Could not save memory" });
    }

    // Return with a fresh signed URL so the client can render immediately.
    const { data: signed } = await adminClient.storage
      .from("trip-memories")
      .createSignedUrl(fileName, 3600);

    return json(200, { memory: { ...memory, image_url: signed?.signedUrl ?? fileName } });
  } catch (err) {
    console.error("[upload-trip-memory] unexpected error:", (err as Error).message);
    return json(500, { error: "Internal error" });
  }
});
