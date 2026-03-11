import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsResponse,
  okResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  exceptionResponse,
} from "../_shared/edge-response.ts";

const SYSTEM_PROMPT = `You are a travel editorial writer for Voyance, an AI-powered travel platform. Your job is to transform a traveler's raw trip notes, ratings, and experiences into a polished editorial article that reads like Condé Nast Traveler meets a personal travel blog.

VOICE AND TONE:
- First-person narrative from the traveler's perspective
- Think "Sex and the City" walking through a city — vivid, opinionated, personal
- Use the traveler's own words as the backbone. Their experience text is the raw material — weave it into flowing prose, don't just copy-paste it
- Sensory language that makes the reader feel like they're there
- Honest — if the traveler gave something 2 stars, reflect that candidly. Don't sugarcoat.
- Not generic AI travel writing. Every paragraph should be specific to THIS trip and THIS traveler's experience.

STRUCTURE RULES:
- Organize by THEME, not by day. Group experiences into: Food & Drink, Culture & Sights, Must Do, Must See, The Vibe
- Only include sections that have relevant activities. If the traveler didn't do any nightlife, omit "The Vibe" entirely. No empty sections.
- Only include activities the traveler actually reviewed (has experience text, a rating, or a recommendation). Skip any activities with no user input.
- Each section gets a 1-2 sentence editorial intro that sets the tone, then the narrative prose weaving together the relevant experiences.
- Select one standout quote from the traveler's text per section as a "pull quote" — a short, vivid, opinionated line that works as a highlighted callout.

TRAVELER DNA ADAPTATION:
- Adjust the editorial emphasis based on the traveler's DNA type.
- A "Luxury Luminary" guide should emphasize ambiance, exclusivity, and refined details.
- A "Culinary Cartographer" guide should lead with food and make dining the centerpiece.
- An "Adrenaline Architect" guide should emphasize energy, physicality, and excitement.
- This doesn't mean ignoring other sections — it means the prose style and what gets highlighted shifts.

Call the write_editorial function with the structured editorial content.`;

const EDITORIAL_TOOL = {
  type: "function" as const,
  function: {
    name: "write_editorial",
    description: "Output the editorial travel article as structured JSON",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "An evocative editorial title (not just 'City Name Travel Guide')",
        },
        lede: {
          type: "string",
          description: "2-3 sentence opening paragraph that hooks the reader",
        },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              theme: {
                type: "string",
                enum: ["food_drink", "culture_sights", "must_do", "must_see", "the_vibe"],
              },
              heading: { type: "string", description: "Display heading like 'Food & Drink'" },
              intro: { type: "string", description: "1-2 sentence section intro" },
              narrative: {
                type: "string",
                description: "The flowing editorial prose. Multiple paragraphs. Weave in the traveler's experiences.",
              },
              pullQuote: {
                type: ["string", "null"],
                description: "A short, vivid quote from the traveler's text to highlight",
              },
              activityRefs: {
                type: "array",
                items: { type: "string" },
                description: "Activity names referenced in this section",
              },
              ratings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    rating: { type: "number" },
                  },
                  required: ["name", "rating"],
                },
              },
            },
            required: ["theme", "heading", "intro", "narrative", "activityRefs", "ratings"],
          },
        },
        signOff: {
          type: "string",
          description: "A closing paragraph in the traveler's voice. Personal, warm.",
        },
        quickReference: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: "string" },
              rating: { type: "number" },
              oneLiner: { type: "string" },
            },
            required: ["name", "category", "rating", "oneLiner"],
          },
        },
      },
      required: ["title", "lede", "sections", "signOff", "quickReference"],
    },
  },
};

function buildUserPrompt(
  authorName: string,
  dnaType: string | null,
  destination: string,
  dates: string,
  duration: number,
  travelers: number | null,
  tripType: string | null,
  guideTitle: string,
  guideDescription: string | null,
  reviewedSections: any[],
): string {
  let prompt = `Here is the trip data to transform into an editorial:

TRAVELER: ${authorName}
TRAVEL DNA: ${dnaType || "Not specified"}
DESTINATION: ${destination}
DATES: ${dates}
TRAVELERS: ${travelers || 1}
TRIP TYPE: ${tripType || "Travel"}

GUIDE TITLE: ${guideTitle}
GUIDE DESCRIPTION: ${guideDescription || "Not provided"}

REVIEWED ACTIVITIES:
`;

  for (const s of reviewedSections) {
    const hasPhotos = s.photos && Array.isArray(s.photos) && s.photos.length > 0;
    prompt += `
---
Activity: ${s.title || s.activity_title || "Unnamed"}
Category: ${s.activity_category || "general"}
Day: ${s.linked_day_number || "unspecified"}
Rating: ${s.user_rating ? `${s.user_rating}/5` : "not rated"}
Recommended: ${s.recommended || "neutral"}
Experience: "${s.user_experience || ""}"
Has Photos: ${hasPhotos ? `yes (${s.photos.length} photos)` : "no"}
---`;
  }

  prompt += `

Transform these notes into a polished editorial travel article. Remember: organize by theme, not by day. Use the traveler's own words as your foundation.`;

  return prompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return unauthorizedResponse();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return unauthorizedResponse();
    }
    const userId = claimsData.claims.sub as string;

    // Parse body
    const { guideId } = await req.json();
    if (!guideId) return errorResponse("guideId is required", "MISSING_GUIDE_ID");

    // Fetch guide
    const { data: guide, error: guideErr } = await supabase
      .from("community_guides")
      .select("id, user_id, title, description, destination, trip_id, editorial_version, status")
      .eq("id", guideId)
      .single();

    if (guideErr || !guide) return errorResponse("Guide not found", "GUIDE_NOT_FOUND", 404);
    if (guide.user_id !== userId) return forbiddenResponse("You do not own this guide", "NOT_OWNER");

    // Fetch guide sections with reviews
    const { data: sections } = await supabase
      .from("guide_sections")
      .select("*")
      .eq("guide_id", guideId)
      .order("sort_order", { ascending: true });

    // Filter to reviewed sections (experience text 50+ chars, or user_rating, or recommended set)
    const reviewed = (sections || []).filter((s: any) => {
      const hasExperience = s.user_experience && s.user_experience.length >= 50;
      const hasRating = s.user_rating !== null && s.user_rating !== undefined;
      const hasRecommendation = s.recommended && s.recommended !== "neutral";
      return hasExperience || hasRating || hasRecommendation;
    });

    if (reviewed.length < 3) {
      return errorResponse(
        `Add your experience to at least 3 activities to generate an editorial. You've reviewed ${reviewed.length} so far.`,
        "INSUFFICIENT_REVIEWS",
        400,
      );
    }

    // Fetch trip metadata
    const { data: trip } = await supabase
      .from("trips")
      .select("destination, start_date, end_date, travelers, trip_type")
      .eq("id", guide.trip_id)
      .single();

    // Fetch author profile + DNA
    const [profileRes, dnaRes] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", userId).single(),
      supabase.from("travel_dna_profiles").select("primary_archetype_name").eq("user_id", userId).single(),
    ]);

    const authorName = profileRes.data?.display_name || "A traveler";
    const dnaType = dnaRes.data?.primary_archetype_name || null;

    // Build dates string
    const startDate = trip?.start_date ? new Date(trip.start_date) : null;
    const endDate = trip?.end_date ? new Date(trip.end_date) : null;
    const dates = startDate && endDate
      ? `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : "Recent trip";
    const duration = startDate && endDate
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 0;

    const destination = guide.destination || trip?.destination || "a destination";

    const userPrompt = buildUserPrompt(
      authorName,
      dnaType,
      destination,
      dates,
      duration,
      trip?.travelers,
      trip?.trip_type,
      guide.title,
      guide.description,
      reviewed,
    );

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return errorResponse("AI service not configured", "AI_NOT_CONFIGURED", 500);
    }

    const callAI = async (retry = false) => {
      const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ];
      if (retry) {
        messages.push({
          role: "user",
          content: "Please call the write_editorial function with the structured editorial content. Do not return plain text.",
        });
      }

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools: [EDITORIAL_TOOL],
          tool_choice: { type: "function", function: { name: "write_editorial" } },
          temperature: 0.8,
          max_tokens: 8000,
        }),
      });

      if (!resp.ok) {
        const status = resp.status;
        if (status === 429) return { error: "AI rate limited, please try again shortly", status: 429 };
        if (status === 402) return { error: "AI service payment required", status: 402 };
        const errText = await resp.text();
        console.error("[generate-guide-editorial] AI error:", status, errText);
        return { error: "AI generation failed", status: 500 };
      }

      const data = await resp.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        return { error: "no_tool_call" };
      }

      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        // Validate required fields
        if (!parsed.title || !parsed.lede || !Array.isArray(parsed.sections) || !parsed.signOff || !Array.isArray(parsed.quickReference)) {
          return { error: "invalid_structure" };
        }
        return { editorial: parsed };
      } catch {
        return { error: "parse_failed" };
      }
    };

    // First attempt
    let result = await callAI(false);

    // Retry once if parsing/structure failed
    if (result.error && !result.status) {
      console.warn("[generate-guide-editorial] First attempt failed:", result.error, "— retrying");
      result = await callAI(true);
    }

    if (result.error) {
      const status = result.status || 500;
      return errorResponse(
        result.error === "parse_failed" || result.error === "invalid_structure" || result.error === "no_tool_call"
          ? "Could not generate editorial. Please try again."
          : result.error,
        "EDITORIAL_GENERATION_FAILED",
        status,
      );
    }

    // Save editorial using admin client to bypass RLS
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const newVersion = (guide.editorial_version || 0) + 1;

    const { error: updateErr } = await adminClient
      .from("community_guides")
      .update({
        editorial_content: result.editorial,
        editorial_version: newVersion,
        editorial_generated_at: new Date().toISOString(),
      })
      .eq("id", guideId);

    if (updateErr) {
      console.error("[generate-guide-editorial] Save error:", updateErr);
      return errorResponse("Failed to save editorial", "SAVE_FAILED", 500);
    }

    return okResponse({
      editorial: result.editorial,
      version: newVersion,
    });
  } catch (err) {
    console.error("[generate-guide-editorial] Error:", err);
    return exceptionResponse(err);
  }
});
