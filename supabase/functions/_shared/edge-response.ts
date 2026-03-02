/**
 * Standardized Edge Function Response Helpers
 * 
 * All edge functions should use these helpers for consistent response formats.
 * 
 * Success: { success: true, ...data }
 * Error:   { success: false, error: "Human-readable message", code: "MACHINE_CODE" }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/** Return a success response with optional extra data merged in. */
export function okResponse(data: Record<string, unknown> = {}, status = 200): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status, headers: jsonHeaders },
  );
}

/** Return a standardised error response. */
export function errorResponse(
  error: string,
  code: string,
  status = 400,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({ success: false, error, code, ...extra }),
    { status, headers: jsonHeaders },
  );
}

/** Shorthand for 401 Unauthorized */
export function unauthorizedResponse(error = 'Unauthorized', code = 'UNAUTHORIZED'): Response {
  return errorResponse(error, code, 401);
}

/** Shorthand for 403 Forbidden */
export function forbiddenResponse(error: string, code = 'FORBIDDEN'): Response {
  return errorResponse(error, code, 403);
}

/** CORS preflight response */
export function corsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

/** Build an error response from a caught exception */
export function exceptionResponse(err: unknown, defaultCode = 'INTERNAL_ERROR'): Response {
  const message = err instanceof Error ? err.message : String(err);
  return errorResponse(message, defaultCode, 500);
}
