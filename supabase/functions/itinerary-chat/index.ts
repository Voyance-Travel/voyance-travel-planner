/**
 * Itinerary Assistant Chat
 * 
 * A constrained AI chatbot for itinerary customization that:
 * 1. Understands user requests for activity swaps, pacing, dietary, budget adjustments
 * 2. Returns structured actions for UI to render (not free-form edits)
 * 3. Captures preferences for profile improvement
 * 
 * Uses tool-calling to ensure structured, safe outputs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[ITINERARY-CHAT] ${step}`, details ? JSON.stringify(details) : '');
};

// System prompt that constrains the AI to safe, structured actions
const SYSTEM_PROMPT = `You are Voyance, a helpful travel assistant embedded in an itinerary page. Your role is to help users customize their trip itinerary.

## YOUR CAPABILITIES
You can help with:
1. **Activity Swaps** - Replace activities with alternatives that better match user preferences
2. **Pacing Adjustments** - Make days more relaxed or action-packed  
3. **Dietary/Accessibility** - Filter for dietary needs, mobility requirements, family-friendly options
4. **Budget Adjustments** - Find cheaper alternatives or premium upgrades

## RULES (CRITICAL)
- NEVER generate fake activities or prices - only suggest actions for the system to execute
- ALWAYS use the provided tools to propose changes - don't describe changes in text
- If you can't help with something, explain politely what you CAN help with
- Keep responses concise (2-3 sentences max before suggesting an action)
- Extract preferences from the conversation to help personalize future trips

## RESPONSE STYLE
- Be warm but efficient
- Ask clarifying questions if the request is ambiguous
- Confirm understanding before proposing major changes
- If suggesting multiple options, limit to 3 max

## CONTEXT
You have access to the current itinerary structure. When users mention "Day 2" or "the museum", match it to the provided context.`;

// Tools the AI can call - structured actions only
const TOOLS = [
  {
    type: "function",
    function: {
      name: "suggest_activity_swap",
      description: "Suggest replacing an activity with alternatives matching user criteria. Use when user wants to change a specific activity.",
      parameters: {
        type: "object",
        properties: {
          target_day: { type: "number", description: "Day number (1-indexed)" },
          target_activity_index: { type: "number", description: "Activity index within the day (0-indexed)" },
          target_activity_title: { type: "string", description: "Title of activity to replace" },
          search_criteria: { type: "string", description: "What kind of alternative they want (e.g., 'outdoor adventure', 'family-friendly museum')" },
          reason: { type: "string", description: "Brief explanation of why this swap fits their request" },
        },
        required: ["target_day", "target_activity_title", "search_criteria", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_day_pacing",
      description: "Suggest adjusting the pacing of a day (add more activities or make it more relaxed)",
      parameters: {
        type: "object",
        properties: {
          target_day: { type: "number", description: "Day number (1-indexed)" },
          adjustment: { 
            type: "string", 
            enum: ["more_relaxed", "more_packed", "add_downtime", "remove_downtime"],
            description: "Type of pacing adjustment" 
          },
          reason: { type: "string", description: "Brief explanation" },
        },
        required: ["target_day", "adjustment", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_filter",
      description: "Apply a filter across the itinerary (dietary, accessibility, budget, family-friendly)",
      parameters: {
        type: "object",
        properties: {
          filter_type: {
            type: "string",
            enum: ["dietary", "accessibility", "budget", "family_friendly", "romantic", "adventure"],
            description: "Type of filter to apply"
          },
          filter_value: { type: "string", description: "Specific filter value (e.g., 'vegetarian', 'wheelchair accessible', 'under $50')" },
          scope: {
            type: "string",
            enum: ["entire_trip", "specific_day", "dining_only", "activities_only"],
            description: "Where to apply the filter"
          },
          target_day: { type: "number", description: "If scope is specific_day, which day" },
        },
        required: ["filter_type", "filter_value", "scope"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_preference",
      description: "Capture a user preference for their travel profile. Call this whenever user expresses a preference.",
      parameters: {
        type: "object",
        properties: {
          preference_type: {
            type: "string",
            enum: ["dietary", "pace", "budget", "interests", "accessibility", "travel_style", "avoid"],
            description: "Category of preference"
          },
          preference_value: { type: "string", description: "The actual preference (e.g., 'vegetarian', 'prefers morning activities')" },
          confidence: { 
            type: "string", 
            enum: ["explicit", "inferred"],
            description: "Whether user stated this directly or you inferred it"
          },
        },
        required: ["preference_type", "preference_value", "confidence"],
      },
    },
  },
  {
    type: "function", 
    function: {
      name: "regenerate_day",
      description: "Suggest regenerating an entire day with new criteria",
      parameters: {
        type: "object",
        properties: {
          target_day: { type: "number", description: "Day number to regenerate" },
          new_focus: { type: "string", description: "New theme or focus for the day" },
          keep_locked: { type: "boolean", description: "Whether to preserve 'locked' activities" },
          reason: { type: "string", description: "Brief explanation" },
        },
        required: ["target_day", "new_focus", "reason"],
      },
    },
  },
];

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ItineraryContext {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: Array<{
    dayNumber: number;
    date: string;
    activities: Array<{
      index: number;
      title: string;
      category?: string;
      time: string;
      cost?: number;
      isLocked?: boolean;
    }>;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body = await req.json();
    const { 
      messages, 
      itineraryContext, 
      conversationId,
      stream = false 
    }: { 
      messages: ChatMessage[]; 
      itineraryContext: ItineraryContext;
      conversationId?: string;
      stream?: boolean;
    } = body;

    if (!messages || !itineraryContext) {
      throw new Error("Missing required fields: messages, itineraryContext");
    }

    log("Processing chat", { 
      messageCount: messages.length, 
      destination: itineraryContext.destination,
      userId,
    });

    // Build context string from itinerary
    const itineraryDescription = itineraryContext.days.map(day => {
      const activities = day.activities.map(a => 
        `  ${a.index + 1}. [${a.time}] ${a.title}${a.isLocked ? ' (locked)' : ''}${a.cost ? ` - $${a.cost}` : ''}`
      ).join('\n');
      return `Day ${day.dayNumber} (${day.date}):\n${activities}`;
    }).join('\n\n');

    const contextMessage = `## CURRENT ITINERARY
Trip to ${itineraryContext.destination}
Dates: ${itineraryContext.startDate} to ${itineraryContext.endDate}

${itineraryDescription}`;

    // Prepare messages for API
    const apiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextMessage },
      ...messages,
    ];

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        tools: TOOLS,
        tool_choice: "auto",
        stream,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      log("AI gateway error", { status, errorText });

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${status}`);
    }

    // Handle streaming vs non-streaming
    if (stream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming: parse and potentially save preferences
    const data = await response.json();
    const choice = data.choices?.[0];
    
    // Check for tool calls
    const toolCalls = choice?.message?.tool_calls || [];
    const textContent = choice?.message?.content || "";

    // Extract actions from tool calls
    const actions: Array<{
      type: string;
      // deno-lint-ignore no-explicit-any
      params: Record<string, any>;
    }> = [];

    const capturedPreferences: Array<{
      type: string;
      value: string;
      confidence: string;
    }> = [];

    for (const toolCall of toolCalls) {
      const fnName = toolCall.function?.name;
      const args = JSON.parse(toolCall.function?.arguments || "{}");

      if (fnName === "capture_preference") {
        capturedPreferences.push({
          type: args.preference_type,
          value: args.preference_value,
          confidence: args.confidence,
        });
      } else {
        actions.push({
          type: fnName,
          params: args,
        });
      }
    }

    // Save customization request if user is authenticated and there are actions
    if (userId && actions.length > 0) {
      const serviceSupabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
      
      await serviceSupabase.from("itinerary_customization_requests").insert({
        user_id: userId,
        trip_id: itineraryContext.tripId,
        request_type: actions[0]?.type || 'general',
        user_message: lastUserMessage,
        extracted_preferences: capturedPreferences.length > 0 ? capturedPreferences : null,
        action_taken: 'pending',
        conversation_id: conversationId || null,
      });

      log("Saved customization request", { userId, actionType: actions[0]?.type });
    }

    return new Response(
      JSON.stringify({
        message: textContent,
        actions,
        capturedPreferences,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    log("Error", { message: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
