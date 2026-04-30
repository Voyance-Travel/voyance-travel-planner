/**
 * Google API wrapper — single ingress point for ALL Google billable calls.
 *
 * Why this exists:
 *   Edge functions were calling googleapis.com directly all over the codebase,
 *   and only ~half of those calls were being recorded in trip_cost_tracking.
 *   That's why our internal cost estimates have been ~2-3x lower than the
 *   actual Google invoice.
 *
 * The rule: NEVER call `fetch('https://...googleapis.com/...')` directly from
 * an edge function. Always go through one of the helpers below. The lint test
 * at `_shared/no-direct-google.test.ts` will fail CI if anyone bypasses it.
 *
 * Every wrapper:
 *   - Reads the API key internally (callers don't need to thread it through).
 *   - Increments the matching `recordGoogle*` counter on a CostTracker.
 *   - Records a per-call audit entry in metadata.google_call_log.
 *   - Lazily creates a tracker if one wasn't passed (with a console.warn so
 *     we can find the offender), so we never silently lose accounting.
 */

import { CostTracker, trackCost } from "./cost-tracker.ts";

// ============================================================================
// Types
// ============================================================================

export type GoogleSku =
  | "places_text_search"
  | "places_photo"
  | "geocoding"
  | "routes"
  | "distance_matrix";

export interface GoogleCallContext {
  /** An existing tracker to increment. If omitted, one is lazily created. */
  tracker?: CostTracker;
  /** Used only when lazily creating a tracker. */
  actionType?: string;
  /** Optional trip context for richer logging. */
  tripId?: string;
  userId?: string;
  /** Free-form reason for audit trail (e.g. "venue verification: Eiffel Tower"). */
  reason?: string;
}

interface InternalCallMeta {
  sku: GoogleSku;
  start: number;
  ctx: GoogleCallContext;
  ownsTracker: boolean;
  tracker: CostTracker;
}

// ============================================================================
// Internals
// ============================================================================

function resolveTracker(
  sku: GoogleSku,
  ctx: GoogleCallContext,
): { tracker: CostTracker; ownsTracker: boolean } {
  if (ctx.tracker) {
    return { tracker: ctx.tracker, ownsTracker: false };
  }
  // Lazy fallback — better to over-create trackers than to lose a call.
  const action = ctx.actionType ?? "google_api_uncategorized";
  console.warn(
    `[google-api] No tracker passed for ${sku} call (action=${action}). ` +
      `Lazily creating a tracker; pass one in for accurate per-action costing.`,
  );
  const tracker = trackCost(action);
  if (ctx.tripId) tracker.setTripId(ctx.tripId);
  if (ctx.userId) tracker.setUserId(ctx.userId);
  return { tracker, ownsTracker: true };
}

function recordSku(tracker: CostTracker, sku: GoogleSku, count = 1) {
  switch (sku) {
    case "places_text_search":
      tracker.recordGooglePlaces(count);
      break;
    case "places_photo":
      tracker.recordGooglePhotos(count);
      break;
    case "geocoding":
      tracker.recordGoogleGeocoding(count);
      break;
    case "routes":
    case "distance_matrix":
      tracker.recordGoogleRoutes(count);
      break;
  }
}

function logAudit(meta: InternalCallMeta, ok: boolean, extra?: Record<string, unknown>) {
  const entry = {
    sku: meta.sku,
    ok,
    durationMs: Date.now() - meta.start,
    reason: meta.ctx.reason,
    ts: new Date().toISOString(),
    ...extra,
  };
  // Append to a per-tracker rolling log (capped to last 100 entries).
  // Reading internal state via addMetadata since CostTracker only exposes setters.
  // We deliberately keep the array small to stay under metadata size limits.
  const existing = ((meta.tracker as unknown) as { entry?: { metadata?: Record<string, unknown> } })
    .entry?.metadata?.google_call_log as Array<unknown> | undefined;
  const next = Array.isArray(existing) ? existing.slice(-99) : [];
  next.push(entry);
  meta.tracker.addMetadata("google_call_log", next);
}

async function finalizeIfOwned(meta: InternalCallMeta) {
  if (meta.ownsTracker) {
    try {
      await meta.tracker.save();
    } catch (err) {
      console.error("[google-api] Failed to save lazy tracker:", err);
    }
  }
}

// ============================================================================
// Key resolution
// ============================================================================

function getMapsKey(): string | undefined {
  return Deno.env.get("GOOGLE_MAPS_API_KEY") ?? undefined;
}

function getRoutesKey(): string | undefined {
  return Deno.env.get("GOOGLE_ROUTES_API_KEY") ?? Deno.env.get("GOOGLE_MAPS_API_KEY") ?? undefined;
}

// ============================================================================
// Places — Text Search (v1)
// ============================================================================

export interface PlacesTextSearchParams {
  textQuery: string;
  fieldMask: string;
  maxResultCount?: number;
  languageCode?: string;
  includedType?: string;
  locationBias?: Record<string, unknown>;
  /** Per-request abort signal (e.g. for timeouts). */
  signal?: AbortSignal;
}

export interface PlacesTextSearchResult {
  ok: boolean;
  status: number;
  data: any;
  errorText?: string;
}

export async function googlePlacesTextSearch(
  params: PlacesTextSearchParams,
  ctx: GoogleCallContext,
): Promise<PlacesTextSearchResult> {
  const apiKey = getMapsKey();
  if (!apiKey) {
    return { ok: false, status: 0, data: null, errorText: "GOOGLE_MAPS_API_KEY not configured" };
  }
  const { tracker, ownsTracker } = resolveTracker("places_text_search", ctx);
  const meta: InternalCallMeta = { sku: "places_text_search", start: Date.now(), ctx, ownsTracker, tracker };

  const body: Record<string, unknown> = { textQuery: params.textQuery };
  if (params.maxResultCount !== undefined) body.maxResultCount = params.maxResultCount;
  if (params.languageCode) body.languageCode = params.languageCode;
  if (params.includedType) body.includedType = params.includedType;
  if (params.locationBias) body.locationBias = params.locationBias;

  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": params.fieldMask,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    // ALWAYS count the call — Google bills on the request, not the success.
    recordSku(tracker, "places_text_search", 1);

    if (!resp.ok) {
      const errorText = await resp.text();
      logAudit(meta, false, { httpStatus: resp.status, query: params.textQuery });
      await finalizeIfOwned(meta);
      return { ok: false, status: resp.status, data: null, errorText };
    }

    const data = await resp.json();
    logAudit(meta, true, { query: params.textQuery, resultCount: data?.places?.length ?? 0 });
    await finalizeIfOwned(meta);
    return { ok: true, status: resp.status, data };
  } catch (err) {
    // Even on a network/abort error we charge ourselves for the attempt — Google
    // may still have processed it. Better to over-count internally than under-count.
    recordSku(tracker, "places_text_search", 1);
    logAudit(meta, false, { error: String(err), query: params.textQuery });
    await finalizeIfOwned(meta);
    return { ok: false, status: 0, data: null, errorText: String(err) };
  }
}

// ============================================================================
// Places — Photo media (downloads bytes; never returns key-bearing URL)
// ============================================================================

export interface PlacesPhotoParams {
  /** The `photos[i].name` returned by a places search (e.g. "places/X/photos/Y"). */
  photoResource: string;
  maxWidthPx?: number;
  maxHeightPx?: number;
}

export interface PlacesPhotoResult {
  ok: boolean;
  status: number;
  bytes?: Uint8Array;
  contentType?: string;
  errorText?: string;
}

/**
 * Download a Google Places photo as bytes. Use this ONLY when you need the
 * raw image data (e.g. uploading to our own storage). Never return a URL
 * containing the API key to a client — Google bills every fetch of that URL.
 */
export async function googlePlacesPhoto(
  params: PlacesPhotoParams,
  ctx: GoogleCallContext,
): Promise<PlacesPhotoResult> {
  const apiKey = getMapsKey();
  if (!apiKey) {
    return { ok: false, status: 0, errorText: "GOOGLE_MAPS_API_KEY not configured" };
  }
  const { tracker, ownsTracker } = resolveTracker("places_photo", ctx);
  const meta: InternalCallMeta = { sku: "places_photo", start: Date.now(), ctx, ownsTracker, tracker };

  const qs: string[] = [`key=${apiKey}`];
  if (params.maxWidthPx) qs.push(`maxWidthPx=${params.maxWidthPx}`);
  if (params.maxHeightPx) qs.push(`maxHeightPx=${params.maxHeightPx}`);
  const url = `https://places.googleapis.com/v1/${params.photoResource}/media?${qs.join("&")}`;

  try {
    const resp = await fetch(url, { headers: { Accept: "image/*" }, redirect: "follow" });
    recordSku(tracker, "places_photo", 1);

    if (!resp.ok) {
      const errorText = await resp.text();
      logAudit(meta, false, { httpStatus: resp.status, photoResource: params.photoResource });
      await finalizeIfOwned(meta);
      return { ok: false, status: resp.status, errorText };
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    logAudit(meta, true, { photoResource: params.photoResource, bytes: buf.byteLength });
    await finalizeIfOwned(meta);
    return { ok: true, status: resp.status, bytes: buf, contentType: resp.headers.get("content-type") ?? undefined };
  } catch (err) {
    recordSku(tracker, "places_photo", 1);
    logAudit(meta, false, { error: String(err), photoResource: params.photoResource });
    await finalizeIfOwned(meta);
    return { ok: false, status: 0, errorText: String(err) };
  }
}

// ============================================================================
// Geocoding
// ============================================================================

export interface GeocodeParams {
  address: string;
  language?: string;
}

export interface GeocodeResult {
  ok: boolean;
  status: number;
  data: any;
  errorText?: string;
}

export async function googleGeocode(
  params: GeocodeParams,
  ctx: GoogleCallContext,
): Promise<GeocodeResult> {
  const apiKey = getMapsKey();
  if (!apiKey) {
    return { ok: false, status: 0, data: null, errorText: "GOOGLE_MAPS_API_KEY not configured" };
  }
  const { tracker, ownsTracker } = resolveTracker("geocoding", ctx);
  const meta: InternalCallMeta = { sku: "geocoding", start: Date.now(), ctx, ownsTracker, tracker };

  const qs = new URLSearchParams({ address: params.address, key: apiKey });
  if (params.language) qs.set("language", params.language);

  try {
    const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs.toString()}`);
    recordSku(tracker, "geocoding", 1);

    if (!resp.ok) {
      const errorText = await resp.text();
      logAudit(meta, false, { httpStatus: resp.status, address: params.address });
      await finalizeIfOwned(meta);
      return { ok: false, status: resp.status, data: null, errorText };
    }
    const data = await resp.json();
    logAudit(meta, data?.status === "OK", { address: params.address, googleStatus: data?.status });
    await finalizeIfOwned(meta);
    return { ok: true, status: resp.status, data };
  } catch (err) {
    recordSku(tracker, "geocoding", 1);
    logAudit(meta, false, { error: String(err), address: params.address });
    await finalizeIfOwned(meta);
    return { ok: false, status: 0, data: null, errorText: String(err) };
  }
}

// ============================================================================
// Routes API (computeRoutes)
// ============================================================================

export interface RoutesParams {
  body: Record<string, unknown>;
  fieldMask: string;
  signal?: AbortSignal;
}

export interface RoutesResult {
  ok: boolean;
  status: number;
  data: any;
  errorText?: string;
}

export async function googleRoutes(
  params: RoutesParams,
  ctx: GoogleCallContext,
): Promise<RoutesResult> {
  const apiKey = getRoutesKey();
  if (!apiKey) {
    return { ok: false, status: 0, data: null, errorText: "GOOGLE_ROUTES_API_KEY not configured" };
  }
  const { tracker, ownsTracker } = resolveTracker("routes", ctx);
  const meta: InternalCallMeta = { sku: "routes", start: Date.now(), ctx, ownsTracker, tracker };

  try {
    const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": params.fieldMask,
      },
      body: JSON.stringify(params.body),
      signal: params.signal,
    });
    recordSku(tracker, "routes", 1);

    if (!resp.ok) {
      const errorText = await resp.text();
      logAudit(meta, false, { httpStatus: resp.status });
      await finalizeIfOwned(meta);
      return { ok: false, status: resp.status, data: null, errorText };
    }
    const data = await resp.json();
    logAudit(meta, !data?.error, { googleError: data?.error?.message });
    await finalizeIfOwned(meta);
    return { ok: true, status: resp.status, data };
  } catch (err) {
    recordSku(tracker, "routes", 1);
    logAudit(meta, false, { error: String(err) });
    await finalizeIfOwned(meta);
    return { ok: false, status: 0, data: null, errorText: String(err) };
  }
}

// ============================================================================
// Distance Matrix (legacy endpoint)
// ============================================================================

export interface DistanceMatrixParams {
  origins: string;
  destinations: string;
  mode: "driving" | "transit" | "walking" | "bicycling";
  departureTime?: string | number; // 'now' or unix seconds string
}

export interface DistanceMatrixResult {
  ok: boolean;
  status: number;
  data: any;
  errorText?: string;
}

export async function googleDistanceMatrix(
  params: DistanceMatrixParams,
  ctx: GoogleCallContext,
): Promise<DistanceMatrixResult> {
  const apiKey = getMapsKey();
  if (!apiKey) {
    return { ok: false, status: 0, data: null, errorText: "GOOGLE_MAPS_API_KEY not configured" };
  }
  const { tracker, ownsTracker } = resolveTracker("distance_matrix", ctx);
  const meta: InternalCallMeta = { sku: "distance_matrix", start: Date.now(), ctx, ownsTracker, tracker };

  const qs = new URLSearchParams({
    origins: params.origins,
    destinations: params.destinations,
    mode: params.mode,
    key: apiKey,
  });
  if (params.departureTime !== undefined) qs.set("departure_time", String(params.departureTime));

  try {
    const resp = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${qs.toString()}`);
    recordSku(tracker, "distance_matrix", 1);

    if (!resp.ok) {
      const errorText = await resp.text();
      logAudit(meta, false, { httpStatus: resp.status, mode: params.mode });
      await finalizeIfOwned(meta);
      return { ok: false, status: resp.status, data: null, errorText };
    }
    const data = await resp.json();
    logAudit(meta, data?.status === "OK", { mode: params.mode, googleStatus: data?.status });
    await finalizeIfOwned(meta);
    return { ok: true, status: resp.status, data };
  } catch (err) {
    recordSku(tracker, "distance_matrix", 1);
    logAudit(meta, false, { error: String(err), mode: params.mode });
    await finalizeIfOwned(meta);
    return { ok: false, status: 0, data: null, errorText: String(err) };
  }
}

// ============================================================================
// Directions (legacy endpoint — billed under Routes SKU)
// ============================================================================

export interface DirectionsParams {
  origin: string;
  destination: string;
  mode: "driving" | "transit" | "walking" | "bicycling";
  departureTime?: string | number;
}

export interface DirectionsResult {
  ok: boolean;
  status: number;
  data: any;
  errorText?: string;
}

export async function googleDirections(
  params: DirectionsParams,
  ctx: GoogleCallContext,
): Promise<DirectionsResult> {
  const apiKey = getMapsKey();
  if (!apiKey) {
    return { ok: false, status: 0, data: null, errorText: "GOOGLE_MAPS_API_KEY not configured" };
  }
  const { tracker, ownsTracker } = resolveTracker("routes", ctx);
  const meta: InternalCallMeta = { sku: "routes", start: Date.now(), ctx, ownsTracker, tracker };

  const qs = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    mode: params.mode,
    key: apiKey,
  });
  if (params.departureTime !== undefined) qs.set("departure_time", String(params.departureTime));

  try {
    const resp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${qs.toString()}`);
    recordSku(tracker, "routes", 1);

    if (!resp.ok) {
      const errorText = await resp.text();
      logAudit(meta, false, { httpStatus: resp.status, mode: params.mode });
      await finalizeIfOwned(meta);
      return { ok: false, status: resp.status, data: null, errorText };
    }
    const data = await resp.json();
    logAudit(meta, data?.status === "OK", { mode: params.mode, googleStatus: data?.status });
    await finalizeIfOwned(meta);
    return { ok: true, status: resp.status, data };
  } catch (err) {
    recordSku(tracker, "routes", 1);
    logAudit(meta, false, { error: String(err), mode: params.mode });
    await finalizeIfOwned(meta);
    return { ok: false, status: 0, data: null, errorText: String(err) };
  }
}

// ============================================================================
// Convenience: build a places photo URL for cases where the caller will
// download it themselves via the wrapper. Exposed so legacy code can compose
// the resource string without repeating the URL pattern.
// ============================================================================

export function buildPhotoResource(photoName: string): string {
  // photoName already starts with "places/X/photos/Y" — return as-is.
  return photoName;
}
