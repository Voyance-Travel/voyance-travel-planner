/**
 * Pipeline: AI Call + Retry
 *
 * Encapsulates model selection, retry with backoff, fallback model
 * after 3 failures, error classification (429/402/5xx), and response
 * validation. Extracted from action-generate-day.ts (Phase 6).
 */

import { corsHeaders } from '../action-types.ts';

// =============================================================================
// Types
// =============================================================================

export interface AICallInput {
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  dayNumber: number;
  maxAttempts?: number;
  /** Optional flight-recorder trace; if provided, each attempt is logged
   *  to trip_generation_llm_calls (prompt, response, latency, tokens, error). */
  trace?: { llm: (args: any) => Promise<void> } | null;
  /** Purpose tag for the LLM call, e.g. "day-initial-generation". */
  tracePurpose?: string;
}

export interface AICallResult {
  /** The full parsed response from the AI gateway */
  data: any;
  /** Convenience parse for v2 callers that expect a day payload directly */
  success?: boolean;
  day?: any;
  /** Token usage from the response */
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  /** Model that actually served the response */
  model: string;
}

/** Typed error for non-retryable AI failures (429, 402) */
export class AICallError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = 'AICallError';
  }
}

function assertLovableApiKey(apiKey: string | undefined): string {
  const key = String(apiKey || '').trim();
  if (!key) {
    throw new AICallError(
      'OPENROUTER_API_KEY missing',
      500,
      'AI configuration is missing. Please try again in a moment.',
    );
  }
  if (key.startsWith('Bearer ') || key.startsWith('eyJ')) {
    throw new AICallError(
      'OPENROUTER_API_KEY malformed',
      500,
      'AI configuration is invalid. Please try again in a moment.',
    );
  }
  return key;
}

// =============================================================================
// Tool schema for create_day_itinerary
// =============================================================================

const DAY_ITINERARY_TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "create_day_itinerary",
    description: "Creates a structured day itinerary",
    parameters: {
      type: "object",
      properties: {
        dayNumber: { type: "number" },
        date: { type: "string" },
        theme: { type: "string" },
        title: { type: "string", description: "Day title like 'Arrival Day' or 'Historic Exploration'" },
        activities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string", description: "Activity display name (REQUIRED)" },
              name: { type: "string", description: "Alias for title" },
              description: { type: "string" },
              category: { type: "string", enum: ["sightseeing", "dining", "cultural", "shopping", "relaxation", "transport", "accommodation", "activity"] },
              startTime: { type: "string", description: "HH:MM format (24-hour)" },
              endTime: { type: "string", description: "HH:MM format (24-hour)" },
              duration: { type: "string" },
              location: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  address: { type: "string" }
                }
              },
              estimatedCost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" }, basis: { type: "string", enum: ["per_person", "flat", "per_room"], description: "per_person = price per traveler, flat = total price for the group/vehicle, per_room = per room per night" } } },
              cost: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" }, basis: { type: "string", enum: ["per_person", "flat", "per_room"] } } },
              bookingRequired: { type: "boolean" },
              tips: { type: "string", description: "Insider tip for this activity (must be specific, actionable, 30+ chars)" },
              coordinates: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } },
              type: { type: "string" },
              suggestedFor: { type: "string", description: "User ID of the traveler whose preferences most influenced this activity (group trips)" },
              isHiddenGem: { type: "boolean", description: "true if this is a hidden gem discovered through deep research. NOT for mainstream tourist attractions." },
              hasTimingHack: { type: "boolean", description: "true if scheduling at this specific time provides a meaningful advantage" },
              bestTime: { type: "string", description: "If hasTimingHack=true, explain why this time is optimal" },
              crowdLevel: { type: "string", enum: ["low", "moderate", "high"], description: "Expected crowd level at the scheduled time" },
              voyanceInsight: { type: "string", description: "A unique Voyance-only insight about this place" },
              personalization: {
                type: "object",
                properties: {
                  tags: { type: "array", items: { type: "string" } },
                  whyThisFits: { type: "string", description: "Why this fits THIS traveler's DNA" },
                  confidence: { type: "number" },
                  matchedInputs: { type: "array", items: { type: "string" } }
                },
                required: ["tags", "whyThisFits", "confidence"]
              }
            },
            required: ["title", "category", "startTime", "endTime", "location", "personalization", "tips", "crowdLevel", "isHiddenGem", "hasTimingHack"]
          }
        },
        accommodationNotes: { type: "array", items: { type: "string" }, description: "2-3 accommodation tips for this destination" },
        practicalTips: { type: "array", items: { type: "string" }, description: "3-4 practical travel tips for this destination" },
        narrative: { type: "object", properties: { theme: { type: "string" }, highlights: { type: "array", items: { type: "string" } } } }
      },
      required: ["dayNumber", "date", "theme", "activities"]
    }
  }
};

// =============================================================================
// Main function
// =============================================================================

/**
 * Call the AI gateway with retry logic and model fallback.
 *
 * Throws `AICallError` for non-retryable errors (429, 402).
 * Throws generic `Error` for exhausted retries.
 */
export async function callAI(input: AICallInput): Promise<AICallResult> {
  const { systemPrompt, userPrompt, apiKey, dayNumber, maxAttempts = 5, trace, tracePurpose } = input;
  const lovableApiKey = assertLovableApiKey(apiKey);
  let data: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = attempt <= 3 ? "google/gemini-3-flash-preview" : "google/gemini-2.5-flash";
    if (attempt > 3) {
      console.log(`[ai-call] Falling back to ${model} after ${attempt - 1} failures`);
    }

    const t0 = Date.now();
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": lovableApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          tools: [DAY_ITINERARY_TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "create_day_itinerary" } },
        }),
      });
    } catch (netErr) {
      const msg = netErr instanceof Error ? netErr.message : String(netErr);
      if (trace) {
        trace.llm({
          dayNumber, purpose: tracePurpose ?? 'day-generation', model,
          prompt: `[system]\n${systemPrompt}\n\n[user]\n${userPrompt}`,
          response: null, latencyMs: Date.now() - t0, retryCount: attempt - 1, error: `network: ${msg}`,
        }).catch(() => {});
      }
      if (attempt < maxAttempts) {
        const backoff = Math.min(2000 * attempt, 8000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw netErr;
    }

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text().catch(() => '');
      if (trace) {
        trace.llm({
          dayNumber, purpose: tracePurpose ?? 'day-generation', model,
          prompt: `[system]\n${systemPrompt}\n\n[user]\n${userPrompt}`,
          response: errorText, latencyMs: Date.now() - t0, retryCount: attempt - 1, error: `http_${status}`,
        }).catch(() => {});
      }

      if (status === 429) {
        throw new AICallError('Rate limit exceeded', 429, 'Rate limit exceeded. Please try again in a moment.');
      }
      if (status === 402) {
        throw new AICallError('AI credits exhausted', 402, 'AI credits exhausted. Please add credits to continue.');
      }

      console.error(`[ai-call] AI gateway error (attempt ${attempt}): ${status}`, errorText);

      if (attempt < maxAttempts && status >= 500) {
        const backoff = Math.min(2000 * attempt, 8000);
        console.log(`[ai-call] Retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      throw new Error("AI generation failed");
    }

    data = await response.json();

    if ((data as any)?.error) {
      console.error(`[ai-call] AI Gateway error payload (attempt ${attempt}):`, (data as any).error);
      const raw = (data as any).error?.message || 'Internal Server Error';
      const errorCode = (data as any).error?.code;
      const isTransient = raw === 'Internal Server Error' || raw === 'Provider returned error' || errorCode === 500 || errorCode === 524;

      if (trace) {
        trace.llm({
          dayNumber, purpose: tracePurpose ?? 'day-generation', model,
          prompt: `[system]\n${systemPrompt}\n\n[user]\n${userPrompt}`,
          response: JSON.stringify((data as any).error), latencyMs: Date.now() - t0,
          retryCount: attempt - 1, error: `gateway: ${raw}`,
        }).catch(() => {});
      }

      if (attempt < maxAttempts && isTransient) {
        const backoff = Math.min(2000 * attempt, 8000);
        console.log(`[ai-call] Provider error (code ${errorCode}), retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        data = null;
        continue;
      }

      const msg = raw === 'Internal Server Error' || raw === 'Provider returned error'
        ? 'AI service temporarily unavailable. Please try again in a moment.'
        : raw;
      throw new Error(`AI service error: ${msg}`);
    }

    // Success
    const usage = data.usage || {};
    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];
    const responseSnapshot = toolCall?.function?.arguments ?? message?.content ?? JSON.stringify(data).slice(0, 50_000);
    let parsedDay: any = undefined;
    if (toolCall?.function?.arguments) {
      try {
        parsedDay = JSON.parse(toolCall.function.arguments);
      } catch (parseErr) {
        console.warn(`[ai-call] Day ${dayNumber}: tool_call arguments were not parseable for convenience payload:`, (parseErr as Error)?.message);
      }
    } else if (typeof message?.content === 'string' && message.content.trim()) {
      try {
        const cleaned = message.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsedDay = JSON.parse(cleaned);
      } catch (parseErr) {
        console.warn(`[ai-call] Day ${dayNumber}: content was not parseable for convenience payload:`, (parseErr as Error)?.message);
      }
    }
    if (trace) {
      trace.llm({
        dayNumber, purpose: tracePurpose ?? 'day-generation',
        model: data.model || model,
        prompt: `[system]\n${systemPrompt}\n\n[user]\n${userPrompt}`,
        response: typeof responseSnapshot === 'string' ? responseSnapshot : JSON.stringify(responseSnapshot),
        promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens,
        latencyMs: Date.now() - t0,
        finishReason: data.choices?.[0]?.finish_reason,
        retryCount: attempt - 1,
      }).catch(() => {});
    }
    console.log(`[ai-call] ✓ Day ${dayNumber}: model=${data.model || model}, tokens=${usage.prompt_tokens || 0}+${usage.completion_tokens || 0}, attempt=${attempt}`);
    return {
      data,
      success: !!parsedDay,
      day: parsedDay,
      usage,
      model: data.model || model,
    };
  }

  throw new Error('AI generation failed after all retry attempts');
}
