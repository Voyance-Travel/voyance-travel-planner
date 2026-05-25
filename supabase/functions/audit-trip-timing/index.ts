// audit-trip-timing — read-time auditor.
//
// READ-ONLY. Re-runs `auditTimingViolations` against on-disk JSON +
// `itinerary_activities` table counts and writes the result to
// `trips.metadata.quality.read_time_audit`. Never mutates itinerary data.
// Never charges credits. Surfaces legacy bad trips without regeneration.
//
// Body: { tripId: string }
// Returns: { audit: AuditResult, tripId }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { auditTimingViolations, type AuditResult } from "../_shared/audit-timing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const tripId = typeof body?.tripId === "string" ? body.tripId : null;
  if (!tripId) {
    return json({ error: "tripId required" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing env" }, 500);

  // Verify caller is authenticated user with access to this trip. Use the
  // user JWT (anon-key-prefixed client) for the SELECT — RLS gates ownership.
  const authHeader = req.headers.get("Authorization") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
  if (!authHeader.startsWith("Bearer ") || !anonKey) {
    return json({ error: "unauthorized" }, 401);
  }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: tripRow, error: tripErr } = await userClient
    .from("trips")
    .select("id, itinerary_data, metadata, departure_time, arrival_time")
    .eq("id", tripId)
    .maybeSingle();
  if (tripErr) return json({ error: tripErr.message }, 403);
  if (!tripRow) return json({ error: "trip not found" }, 404);

  // Service client for writing audit result (read-only audit, single jsonb merge).
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Table activity counts per day.
  const tableCounts: Record<number, number> = {};
  try {
    const { data: rows } = await admin
      .from("itinerary_activities")
      .select("day_number")
      .eq("trip_id", tripId);
    for (const r of rows ?? []) {
      const dn = (r as any).day_number;
      if (typeof dn === "number") tableCounts[dn] = (tableCounts[dn] ?? 0) + 1;
    }
  } catch (e) {
    console.warn("[audit-trip-timing] table count read failed:", (e as Error).message);
  }

  const days = (tripRow as any)?.itinerary_data?.days ?? [];
  const arrivalTime24 = pickClock((tripRow as any)?.arrival_time) ??
    (tripRow as any)?.metadata?.savedArrivalTime24 ?? null;
  const departureTime24 = pickClock((tripRow as any)?.departure_time) ??
    (tripRow as any)?.metadata?.savedDepartureTime24 ?? null;

  let audit: AuditResult;
  try {
    audit = auditTimingViolations(days, {
      arrivalTime24, departureTime24,
      tableActivityCountsByDay: tableCounts,
      destination: (tripRow as any)?.metadata?.destination ?? null,
    });
  } catch (e) {
    console.error("[audit-trip-timing] auditor threw:", e);
    return json({ error: "audit failed" }, 500);
  }

  // Single jsonb merge — never overwrite quality.* or other metadata fields.
  try {
    const prior = ((tripRow as any).metadata ?? {}) as Record<string, any>;
    const priorQuality = (prior.quality && typeof prior.quality === "object") ? prior.quality : {};
    const merged = {
      ...prior,
      quality: {
        ...priorQuality,
        read_time_audit: {
          at: audit.ranAt,
          violations: audit.violations,
          counts_by_code: audit.countsByCode,
          json_day_count: audit.jsonDayCount,
          json_activity_count: audit.jsonActivityCount,
          table_day_count: audit.tableDayCount,
          table_activity_count: audit.tableActivityCount,
          parity_delta: audit.parityDelta,
        },
      },
    };
    await admin.from("trips").update({ metadata: merged }).eq("id", tripId);
  } catch (e) {
    console.warn("[audit-trip-timing] metadata write failed:", (e as Error).message);
  }

  console.log(
    `[AUDIT_TIMING] trip=${tripId} days=${audit.jsonDayCount} violations=${audit.violations.length} parity_delta=${audit.parityDelta}`,
  );

  return json({ tripId, audit });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function pickClock(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const m = v.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}
