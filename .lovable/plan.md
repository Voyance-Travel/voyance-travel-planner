

## Fix: AI Chat Leaking Raw JSON Tool Calls in Message Text

### Problem

The AI model sometimes embeds tool-call JSON inside its regular text response — wrapped in markdown code fences like ` ```json { "action": "rewrite_day", "action_input": "..." } ``` ` — instead of using the structured `tool_calls` field. The current sanitization only catches responses that **start** with `{` or `[`, missing the common case where the AI writes a natural language paragraph **followed by** an embedded JSON block.

### Fix

Two layers of defense (edge function + frontend):

**File: `supabase/functions/itinerary-chat/index.ts` (~line 591)**

After the existing `startsWith` check, add a regex strip that removes:
1. Markdown fenced JSON blocks: ` ```json ... ``` `
2. Inline JSON objects matching tool-call patterns: `{ "action": "...", "action_input": "..." }`

```
// Pseudocode
textContent = textContent.replace(/```json[\s\S]*?```/g, '').trim();
textContent = textContent.replace(/\{\s*"action"\s*:[\s\S]*?"action_input"\s*:[\s\S]*?\}\s*$/g, '').trim();
```

If after stripping the text is empty, fall back to the existing "Here's what I'll change:" message.

**File: `src/components/itinerary/ItineraryAssistant.tsx` (~line 276)**

Add the same regex cleanup on `messageText` before the `isJsonLeak` check, so even if the edge function misses it, the frontend won't render raw JSON.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/itinerary-chat/index.ts` | Add regex to strip embedded JSON/code-fenced tool calls from text content |
| 2 | `src/components/itinerary/ItineraryAssistant.tsx` | Add same regex cleanup as frontend safety net |

