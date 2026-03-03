import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "site-images";

type MigrationRequest = {
  photoIds?: string[];
  dryRun?: boolean;
  includeDatabaseIds?: boolean;
};

type MappingResult = {
  photoId: string;
  originalUrl: string;
  fallbackUrl: string;
  storagePath: string;
  storageUrl: string;
  status: "uploaded" | "already_exists" | "failed" | "dry_run";
  error?: string;
};

function extractPhotoIds(input: string): string[] {
  return Array.from(new Set((input.match(/photo-[a-z0-9-]+/gi) ?? []).map((id) => id.toLowerCase())));
}

function normalizePhotoId(input: string): string | null {
  const match = input.match(/photo-[a-z0-9-]+/i)?.[0]?.toLowerCase();
  return match ?? null;
}

function buildSourceUrls(photoId: string) {
  return {
    originalUrl: `https://images.unsplash.com/${photoId}?w=1200&h=800&fit=crop&auto=format`,
    fallbackUrl: `https://images.unsplash.com/${photoId}?ixlib=rb-4.0.3&w=1200&h=800&fit=crop&auto=format&q=80`,
  };
}

async function fetchImage(primary: string, fallback: string) {
  const primaryResp = await fetch(primary, {
    headers: {
      "Accept": "image/*",
      "Referer": "https://voyance-travel-planner.lovable.app",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (primaryResp.ok) return primaryResp;

  const fallbackResp = await fetch(fallback, {
    headers: {
      "Accept": "image/*",
      "Referer": "https://voyance-travel-planner.lovable.app",
      "User-Agent": "Mozilla/5.0",
    },
  });

  return fallbackResp;
}

async function collectDatabasePhotoIds(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const ids = new Set<string>();

  const readers = await Promise.all([
    supabase.from("destinations").select("stock_image_url").ilike("stock_image_url", "%unsplash%"),
    supabase.from("trip_activities").select("photos").filter("photos", "not.is", null),
    supabase.from("guides").select("image_url").ilike("image_url", "%unsplash%"),
    supabase.from("destination_image_cache").select("original_url").ilike("original_url", "%unsplash%"),
    supabase.from("profiles").select("avatar_url").ilike("avatar_url", "%unsplash%"),
  ]);

  const [destinations, tripActivities, guides, cache, profiles] = readers;

  if (destinations.data) {
    for (const row of destinations.data) {
      extractPhotoIds(String(row.stock_image_url ?? "")).forEach((id) => ids.add(id));
    }
  }

  if (tripActivities.data) {
    for (const row of tripActivities.data) {
      extractPhotoIds(JSON.stringify(row.photos ?? {})).forEach((id) => ids.add(id));
    }
  }

  if (guides.data) {
    for (const row of guides.data) {
      extractPhotoIds(String(row.image_url ?? "")).forEach((id) => ids.add(id));
    }
  }

  if (cache.data) {
    for (const row of cache.data) {
      extractPhotoIds(String(row.original_url ?? "")).forEach((id) => ids.add(id));
    }
  }

  if (profiles.data) {
    for (const row of profiles.data) {
      extractPhotoIds(String(row.avatar_url ?? "")).forEach((id) => ids.add(id));
    }
  }

  return Array.from(ids).sort();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: MigrationRequest = req.method === "POST" ? await req.json() : {};
    const dryRun = Boolean(payload?.dryRun);
    const includeDatabaseIds = payload?.includeDatabaseIds !== false;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const explicitIds = (payload.photoIds ?? [])
      .map((id) => normalizePhotoId(id))
      .filter((id): id is string => Boolean(id));

    const databaseIds = includeDatabaseIds ? await collectDatabasePhotoIds(supabase) : [];

    const allIds = Array.from(new Set([...explicitIds, ...databaseIds])).sort();
    const results: MappingResult[] = [];

    for (const photoId of allIds) {
      const { originalUrl, fallbackUrl } = buildSourceUrls(photoId);
      const storagePath = photoId;
      const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

      if (dryRun) {
        results.push({ photoId, originalUrl, fallbackUrl, storagePath, storageUrl, status: "dry_run" });
        continue;
      }

      const existing = await fetch(storageUrl, { method: "HEAD" });
      if (existing.ok) {
        results.push({ photoId, originalUrl, fallbackUrl, storagePath, storageUrl, status: "already_exists" });
        await supabase.from("site_image_mappings").upsert({
          photo_id: photoId,
          original_url: originalUrl,
          storage_path: storagePath,
          storage_url: storageUrl,
          status: "already_exists",
          error_message: null,
          updated_at: new Date().toISOString(),
        });
        continue;
      }

      try {
        const imageResp = await fetchImage(originalUrl, fallbackUrl);
        if (!imageResp.ok) {
          const error = `fetch_failed_${imageResp.status}`;
          results.push({ photoId, originalUrl, fallbackUrl, storagePath, storageUrl, status: "failed", error });
          await supabase.from("site_image_mappings").upsert({
            photo_id: photoId,
            original_url: originalUrl,
            storage_path: storagePath,
            storage_url: storageUrl,
            status: "failed",
            error_message: error,
            updated_at: new Date().toISOString(),
          });
          continue;
        }

        const contentType = imageResp.headers.get("content-type") || "image/jpeg";
        const imageBlob = await imageResp.blob();

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, imageBlob, {
            upsert: true,
            contentType,
            cacheControl: "31536000",
          });

        if (uploadError) {
          const error = `upload_failed_${uploadError.message}`;
          results.push({ photoId, originalUrl, fallbackUrl, storagePath, storageUrl, status: "failed", error });
          await supabase.from("site_image_mappings").upsert({
            photo_id: photoId,
            original_url: originalUrl,
            storage_path: storagePath,
            storage_url: storageUrl,
            status: "failed",
            error_message: error,
            updated_at: new Date().toISOString(),
          });
          continue;
        }

        results.push({ photoId, originalUrl, fallbackUrl, storagePath, storageUrl, status: "uploaded" });
        await supabase.from("site_image_mappings").upsert({
          photo_id: photoId,
          original_url: originalUrl,
          storage_path: storagePath,
          storage_url: storageUrl,
          status: "uploaded",
          error_message: null,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : "unknown_error";
        results.push({ photoId, originalUrl, fallbackUrl, storagePath, storageUrl, status: "failed", error });
        await supabase.from("site_image_mappings").upsert({
          photo_id: photoId,
          original_url: originalUrl,
          storage_path: storagePath,
          storage_url: storageUrl,
          status: "failed",
          error_message: error,
          updated_at: new Date().toISOString(),
        });
      }
    }

    const uploaded = results.filter((r) => r.status === "uploaded").length;
    const alreadyExists = results.filter((r) => r.status === "already_exists").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return new Response(
      JSON.stringify({
        totalPhotoIds: allIds.length,
        uploaded,
        alreadyExists,
        failed,
        failedPhotoIds: results.filter((r) => r.status === "failed").map((r) => ({ photoId: r.photoId, error: r.error })),
        mappings: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Image migration failed", code: "MIGRATION_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
