## Problem

In the "Just Tell Us" chat flow (`supabase/functions/chat-trip-planner/index.ts`), the assistant is heavily incentivized to **call `extract_trip_details` as soon as it can fill the required fields** (`destination`, `startDate`, `endDate`, `travelers`). The system prompt is full of warnings like "NEVER refuse to generate" and "extract immediately" — none of which contemplate the case where the user's request is **open-ended on destination** ("the best and most affordable Four Seasons" — but where?).

What happens today:
- User says: "best and most affordable Four Seasons."
- The assistant treats this as solved intent, picks (or echoes) a destination from thin air, gathers dates/travelers, and pushes the user to the confirm-and-pay screen.
- We never actually **discover** which Four Seasons fits, never present options, never let the user choose. The trip then generates against a destination the user never agreed to.

This is a trust-breaking bug: we asked "where to?" implicitly via the brand request, then skipped past the answer.

## Changes

### 1. Add a "Discovery Mode" rule to the system prompt — `supabase/functions/chat-trip-planner/index.ts`

Insert a new section near the top of `buildSystemPrompt()` (above the existing "CRITICAL RULES FOR CALLING THE TOOL" block) called **DESTINATION DISCOVERY — DO NOT SKIP**:

- If the user's message expresses a **brand / property / experience preference but no concrete destination** ("best Four Seasons", "nicest Aman", "any Michelin-3-star city", "somewhere warm in February", "a wine region we haven't been to"), the assistant MUST enter Discovery Mode.
- In Discovery Mode the assistant:
  1. **Does NOT call `extract_trip_details`** even if it could guess a destination.
  2. Proposes **2–4 specific candidate destinations** that match the stated criteria, with a one-line reason each. Bias toward affordability when "affordable" is mentioned (e.g., for Four Seasons: Marrakech, Bali, Mexico City, Buenos Aires often beat Paris/NYC on rate).
  3. Asks the user to pick one (or invites them to add criteria like region, climate, length, budget cap).
- Only after the user **explicitly picks a destination** does the flow proceed to dates/travelers and extraction.
- The assistant must never invent or assume a destination. "I'll pick one for you" is forbidden.

### 2. Tighten the extraction guard — same file, `extract_trip_details` description

Add an explicit precondition to the tool description:
> "Do NOT call this tool if the user's destination intent is brand/experience-only (e.g. 'best Four Seasons', 'somewhere warm') without a concrete city or region they have agreed to. In that case, propose candidates first and call this tool only after the user selects one."

### 3. Belt-and-braces guard in the system prompt's self-check (lines 126–132)

Add a new self-check item:
> "0. Did the user actually name a destination they agreed to, or did they only describe a brand/criteria? If only criteria, STOP — go to Discovery Mode. Do not call the tool."

### 4. Out of scope

- Building a real "Four Seasons inventory + price" lookup. Step 1 just makes the assistant **ask** instead of inventing. A future iteration can wire candidate suggestions to a real hotel/property API.
- Changing the post-confirm pay flow.
- Frontend changes — the chat UI already handles assistant-only turns where the tool isn't called; no client work needed.

## Files touched

- `supabase/functions/chat-trip-planner/index.ts` — system prompt edits and tool-description tightening (~25–35 added lines, no logic changes).