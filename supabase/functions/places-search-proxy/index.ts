// C-COST-4: server proxy for the frontend "Search with Google" address lookup.
// Previously the browser called places.googleapis.com directly with an exposed
// key (untracked, bypassing the daily ceiling and the shared cache). This proxy
// routes the same search through cachedGooglePlacesTextSearch so it is:
//   - cached (60-day shared cache, reused across users)
//   - ceiling-gated (consume_google_budget breaker)
//   - cost-tracked
//   - key-protected (the Google key never reaches the browser)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { cachedGooglePlacesTextSearch } from "../_shared/google-api.ts";
import { parseAuth } from "../_shared/require-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface ProxyRequest {
  query?: string;
  near?: string;
  maxResultCount?: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require a logged-in user (address search only happens inside the trip builder).
    const auth = await parseAuth(req);
    if (auth instanceof Response) return auth;

    const { query, near, maxResultCount }: ProxyRequest = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textQuery = near ? `${query} in ${near}` : query;

    const result = await cachedGooglePlacesTextSearch(
      {
        textQuery,
        maxResultCount: Math.min(Math.max(maxResultCount ?? 5, 1), 10),
        fieldMask: "places.displayName,places.formattedAddress,places.location",
        languageCode: "en",
      },
      { actionType: "address_search", reason: textQuery },
    );

    if (!result.ok) {
      // Degrade gracefully — the client falls back to its Nominatim results.
      return new Response(JSON.stringify({ results: [], error: "search_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const places = (result.data?.places ?? []) as Array<{
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
    }>;

    const results = places.map((p) => ({
      name: p.displayName?.text || query,
      address: p.formattedAddress || "",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      source: "google" as const,
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ results: [], error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
