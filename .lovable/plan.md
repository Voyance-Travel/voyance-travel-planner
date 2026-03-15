

# Fix: "Just Tell Us" Chat Leaking Raw JSON Tool Calls

## Root Cause

The AI model (`google/gemini-3-flash-preview`) is sometimes emitting the `extract_trip_details` tool call as **plain text content** instead of using the structured `tool_calls` delta format. The frontend streaming parser in `TripChatPlanner.tsx` only detects tool calls via `choice.delta.tool_calls` (line 213) and displays everything from `choice.delta.content` as visible chat text. So when the model dumps `{ "action": "extract_trip_details", "action_input": "..." }` as content, the user sees the raw JSON.

## Fix (two layers)

### 1. Frontend: Detect tool-call-as-text and intercept it
In `src/components/planner/TripChatPlanner.tsx`, add a fallback detector in the content accumulation block (around line 224). If `assistantContent` matches a pattern like `{ "action": "extract_trip_details"` or contains `"action_input"` with a JSON payload, treat it as a tool call instead of displaying it.

- Strip the leaked JSON from the displayed message
- Parse the `action_input` JSON to extract `TripDetails`
- Set `isToolCall = true` and populate `toolCallArgs` so the existing tool-call handler (line 244) processes it normally

### 2. Sanitizer: Add fallback pattern to strip leaked tool syntax
In `src/utils/textSanitizer.ts`, add a regex to `sanitizeAIOutput` that strips `{ "action": "extract_trip_details"...}` blocks from text, as a safety net in case the detection above misses partial chunks.

### 3. Optional: Consider model change
The `gemini-3-flash-preview` model appears to have inconsistent tool-calling behavior. Could switch to `google/gemini-2.5-flash` which has more reliable structured tool use. This is a one-line change in `chat-trip-planner/index.ts` line 248.

## Files to Change

| File | Change |
|------|--------|
| `src/components/planner/TripChatPlanner.tsx` | Add text-based tool call detection fallback in streaming content handler |
| `src/utils/textSanitizer.ts` | Add regex to strip leaked `extract_trip_details` JSON from display text |
| `supabase/functions/chat-trip-planner/index.ts` | (Optional) Switch model to `google/gemini-2.5-flash` for more reliable tool calling |

## Priority
1. Frontend interception (fixes the bug)
2. Sanitizer fallback (safety net)
3. Model change (prevention)

