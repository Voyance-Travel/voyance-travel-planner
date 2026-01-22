import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 15;
const PARALLEL_SIZE = 4;
const AI_TIMEOUT_MS = 20000;
const SAFETY_MARGIN_MS = 50000;

// Known templated/placeholder descriptions that need cleanup
const TEMPLATED_DESCRIPTIONS = [
  "Local crafts, handmade goods, and street performers",
  "Scenic walk along the waterfront",
  "Traditional dishes and local specialties",
  "Historic architecture and cultural exhibits",
  "Natural beauty and outdoor activities",
  "Shopping and entertainment district",
  "Religious and cultural significance",
  "Adventure and outdoor recreation",
  "Family-friendly attractions and activities",
  "Nightlife and entertainment venues",
];

interface Activity {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  destination_id: string;
  coordinates: { lat: number; lng: number } | null;
  best_times: unknown;
  accessibility_info: unknown;
}

interface CleanupResult {
  id: string;
  name: string;
  status: "cleaned" | "skipped" | "error";
  changes?: string[];
  error?: string;
}

type ScanResult = {
  dirtyCount: number;
  batch: Activity[];
  scannedAll: boolean;
};

function isTemplatedDescription(desc: string | null): boolean {
  if (!desc) return true;
  const normalized = desc.trim();
  return TEMPLATED_DESCRIPTIONS.some(t => 
    normalized.toLowerCase().includes(t.toLowerCase()) || 
    normalized.length < 30
  );
}

function hasBadCoordinates(coords: { lat: number; lng: number } | null): boolean {
  if (!coords) return true;
  const lat = typeof coords.lat === 'number' ? coords.lat : parseFloat(String(coords.lat));
  const lng = typeof coords.lng === 'number' ? coords.lng : parseFloat(String(coords.lng));
  return (Math.abs(lat) < 1 && Math.abs(lng) < 1);
}

function isDirty(activity: Activity): boolean {
  return isTemplatedDescription(activity.description) || hasBadCoordinates(activity.coordinates);
}

async function scanDirtyActivities(
  // Keep loose typing here: the Deno/esm.sh Supabase types differ across environments.
  // Strict typing can fail during edge-runtime typecheck even though runtime works.
  supabase: any,
  effectiveOffset: number,
  limit: number
): Promise<ScanResult> {
  // Pull a minimal column set; keep paging deterministic.
  const selectCols =
    "id, name, description, category, destination_id, coordinates, best_times, accessibility_info";

  const pageSize = 750;
  const maxPages = 200; // safety (200 * 750 = 150k rows)

  let dirtyCount = 0;
  const batch: Activity[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data: pageData, error: pageError } = await supabase
      .from("activities")
      .select(selectCols)
      .range(from, to)
      .order("id");

    if (pageError) throw pageError;
    if (!pageData || pageData.length === 0) {
      return { dirtyCount, batch, scannedAll: true };
    }

    for (const row of pageData as unknown as Activity[]) {
      if (!isDirty(row)) continue;

      if (dirtyCount >= effectiveOffset && batch.length < limit) {
        batch.push(row);
      }

      dirtyCount++;
    }

    if (pageData.length < pageSize) {
      return { dirtyCount, batch, scannedAll: true };
    }
  }

  // If we hit maxPages, we can't confidently say we're complete.
  return { dirtyCount, batch, scannedAll: false };
}

async function enrichWithAI(
  activity: Activity,
  destinationName: string,
  apiKey: string,
  dryRun: boolean
): Promise<{ enriched: Partial<Activity>; changes: string[] }> {
  const changes: string[] = [];
  const enriched: Partial<Activity> = {};

  if (dryRun) {
    if (isTemplatedDescription(activity.description)) {
      changes.push("Would update description");
    }
    if (hasBadCoordinates(activity.coordinates)) {
      changes.push("Would update coordinates");
    }
    return { enriched, changes };
  }

  const prompt = `You are enriching activity data for "${activity.name}" in ${destinationName}.
Category: ${activity.category || 'General'}

Current data:
- Description: ${activity.description || 'None'}
- Coordinates: ${activity.coordinates ? `${activity.coordinates.lat}, ${activity.coordinates.lng}` : 'None'}

Return a JSON object with ONLY these fields that need updating:
{
  "description": "A unique, engaging 2-3 sentence description specific to this activity and location. Mention what makes it special.",
  "coordinates": { "lat": <real latitude>, "lng": <real longitude> },
  "best_times": { "morning": <boolean>, "afternoon": <boolean>, "evening": <boolean>, "notes": "<timing tips>" },
  "accessibility_info": { "wheelchair_accessible": <boolean>, "notes": "<accessibility details>" }
}

Only include fields that need fixing. Use real coordinates for ${destinationName}.
Return ONLY valid JSON, no markdown.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.description && isTemplatedDescription(activity.description)) {
      enriched.description = parsed.description;
      changes.push("Updated description");
    }

    if (parsed.coordinates && hasBadCoordinates(activity.coordinates)) {
      enriched.coordinates = parsed.coordinates;
      changes.push("Updated coordinates");
    }

    if (parsed.best_times) {
      enriched.best_times = parsed.best_times;
      changes.push("Updated best_times");
    }

    if (parsed.accessibility_info) {
      enriched.accessibility_info = parsed.accessibility_info;
      changes.push("Updated accessibility_info");
    }

    return { enriched, changes };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const dryRun = (body as any).dryRun ?? true;
    const offset = Number((body as any).offset ?? 0);
    // UI sends `batchSize`; older versions may send `limit`.
    const limit = Math.max(0, Number((body as any).limit ?? (body as any).batchSize ?? BATCH_SIZE));
    const countOnly = Boolean((body as any).countOnly ?? false);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey && !dryRun) {
      throw new Error("LOVABLE_API_KEY is required for live cleanup");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // PostgREST JSON-path filters for coordinates are unreliable in `.or(...)` queries.
    // We scan pages and apply `isDirty()` in-memory.
    const effectiveOffset = dryRun ? offset : 0;
    const { dirtyCount, batch, scannedAll } = await scanDirtyActivities(
      supabase,
      effectiveOffset,
      countOnly ? 0 : limit
    );

    if (countOnly) {
      const hasMore = dirtyCount > 0 || !scannedAll;
      const complete = scannedAll && dirtyCount === 0;
      return new Response(
        JSON.stringify({
          success: true,
          message: "Counted dirty activities",
          dryRun,
          processed: 0,
          offset: effectiveOffset,
          nextOffset: effectiveOffset,
          complete,
          hasMore,
          totalCount: dirtyCount,
          stats: { processed: 0, cleaned: 0, skipped: 0, errors: 0 },
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (batch.length === 0) {
      // Only mark complete when we have scanned everything and found *no* dirty records.
      const complete = scannedAll && dirtyCount === 0;
      const hasMore = !complete;

      return new Response(
        JSON.stringify({
          success: true,
          message: complete
            ? "No dirty activities to process"
            : "No dirty activities found in scanned window; try again",
          dryRun,
          processed: 0,
          offset: effectiveOffset,
          nextOffset: dryRun ? effectiveOffset : 0,
          complete,
          hasMore,
          totalCount: dirtyCount,
          stats: { processed: 0, cleaned: 0, skipped: 0, errors: 0 },
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get destination names for context
    const destIds = [...new Set(batch.map(a => a.destination_id))];
    const { data: destinations } = await supabase
      .from("destinations")
      .select("id, name")
      .in("id", destIds);

    const destMap = new Map((destinations || []).map(d => [d.id, d.name]));

    const results: CleanupResult[] = [];
    let cleaned = 0;
    let skipped = 0;
    let errors = 0;

    // Process in parallel chunks
    for (let i = 0; i < batch.length; i += PARALLEL_SIZE) {
      if (Date.now() - startTime > SAFETY_MARGIN_MS) {
        console.log("Approaching timeout, stopping batch");
        break;
      }

      const chunk = batch.slice(i, i + PARALLEL_SIZE);
      
      const chunkResults = await Promise.all(
        chunk.map(async (activity): Promise<CleanupResult> => {
          try {
            const destName = destMap.get(activity.destination_id) || "Unknown Location";
            
            const { enriched, changes } = await enrichWithAI(
              activity as Activity,
              destName,
              lovableApiKey!,
              dryRun
            );

            if (!dryRun && Object.keys(enriched).length > 0) {
              const { error: updateError } = await supabase
                .from("activities")
                .update({ ...enriched, updated_at: new Date().toISOString() })
                .eq("id", activity.id);

              if (updateError) throw updateError;
            }

            if (changes.length > 0) {
              return { id: activity.id, name: activity.name, status: "cleaned", changes };
            } else {
              return { id: activity.id, name: activity.name, status: "skipped" };
            }
          } catch (error) {
            console.error(`Error processing activity ${activity.id}:`, error);
            return {
              id: activity.id,
              name: activity.name,
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );

      for (const result of chunkResults) {
        results.push(result);
        if (result.status === "cleaned") cleaned++;
        else if (result.status === "skipped") skipped++;
        else errors++;
      }
    }

    // Completion rules:
    // - Dry run: paginate until offset reaches dirtyCount
    // - Live run: keep going until a subsequent scan finds 0 dirty records
    const hasMore = dryRun
      ? effectiveOffset + results.length < dirtyCount
      : dirtyCount > 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} activities`,
        dryRun,
        processed: results.length, // Top-level for UI compatibility
        offset: effectiveOffset,
        nextOffset: dryRun ? effectiveOffset + results.length : 0,
        complete: dryRun ? !hasMore : false,
        hasMore,
        totalCount: dirtyCount,
        stats: {
          processed: results.length,
          cleaned,
          skipped,
          errors,
        },
        results: results.map(r => ({
          ...r,
          status: r.status === 'cleaned' ? 'updated' : r.status === 'skipped' ? 'no_changes_needed' : r.status,
        })), // Map statuses to match UI expectations
        executionTimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
