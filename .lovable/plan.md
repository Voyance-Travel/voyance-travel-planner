# Two-Mode Assistant: Advisory vs. Action

## Problem

Today the assistant has only **mutation tools** (`rewrite_day`, `suggest_activity_swap`, `adjust_day_pacing`, `regenerate_day`, `apply_filter`). The system prompt explicitly tells it `rewrite_day` is the "PREFERRED tool for conversational editing." So when you ask *"what's the best way to get from A to B?"* or *"is this dinner walkable?"*, its only hammer is to rewrite your day. It doesn't ask "want me to change something?" — it just announces the change.

There is no path for the AI to simply **answer**, **advise**, or **discuss** without proposing a structural edit.

## Fix: Intent Classifier + Advisory Mode

Two distinct modes, chosen per turn:

1. **Advisory mode** (default for questions, "what about…", "is X close to Y", "should I…", "tell me about…", "why did you pick…"). Free. No structural changes. The AI answers conversationally using itinerary context + day-brief + DNA.
2. **Action mode** (only when the user's intent is clearly an *edit*: "change", "replace", "remove", "add", "make Day 3…", "swap…", or after the AI proposed a change and the user confirmed). Burns credits.

### Mode selection rules (enforced in the prompt)

- Default to **Advisory**.
- Enter Action mode only if the user uses an **imperative edit verb** OR explicitly confirms a previously proposed change ("yes do it", "go ahead").
- For ambiguous turns ("Day 3 feels heavy"), the AI asks: *"Want me to lighten Day 3, or just talk through what's there?"* — never auto-rewrites.
- A stated wish ("I want ramen tonight") → call **`record_user_intent`** (free) and **answer advisorily** ("Got it — saved. Want me to slot it into tonight, or hold for the next regenerate?"). Do NOT auto-`rewrite_day`.

## Technical Changes

**File: `supabase/functions/itinerary-chat/index.ts`**

1. **Rewrite the system prompt** — replace the "CONVERSATIONAL EDITING PHILOSOPHY" section with an "ADVISORY-FIRST" section:
   - "Default mode is ADVISORY. Answer the user's question. Do NOT call mutation tools unless the user's message contains an explicit edit verb or confirms a prior proposal."
   - Add a "PROPOSE-BEFORE-ACTING" rule: when the user describes a problem ("transit is tight on Day 2"), the AI **describes** the issue and **offers** a fix, then waits.
   - Remove "rewrite_day is the PREFERRED tool for conversational editing." Replace with "rewrite_day is for confirmed structural edits only."

2. **Add a non-mutating tool `answer_question`** (optional but useful for telemetry):
   - Args: `topic` (transit | timing | venue_info | recommendation | clarification | other), `answer_summary`.
   - Does nothing server-side beyond logging. Lets us measure advisory vs. action ratio and ensures the model has a "do nothing structural" path it can pick.

3. **Add a `propose_change` tool** (advisory→action handshake):
   - Args: `target_day`, `summary`, `would_call` (one of the mutation tool names), `would_call_args`.
   - The UI renders this as a **"Apply this change"** button. Credits are only charged when the user clicks Apply, which then invokes the real mutation tool. This is the explicit consent gate the user is asking for.

4. **Tool-call gating on the server** (defense in depth):
   - If the user message contains no edit verbs AND is not a confirmation of a pending proposal, **strip mutation tool calls from the response** before executing them, and replace with the advisory text + a `propose_change` card. This prevents the model from "just doing it" even if the prompt drifts.
   - Edit-verb regex: `/\b(change|replace|swap|remove|delete|add|rewrite|regenerate|make .* (more|less)|move|push|shift|cancel)\b/i`.
   - Confirmation regex: `/\b(yes|yep|do it|go ahead|sounds good|apply|confirm|please do)\b/i` AND a pending proposal exists in the last assistant turn.

5. **Pending-proposal state** — store the last `propose_change` in `metadata.pendingProposal` (conversation-scoped, ephemeral). Cleared on apply, reject, or after 5 turns.

**File: `src/components/itinerary/AssistantChat*.tsx`** (whichever renders tool results)

6. Render `propose_change` as a card with **Apply** / **Not now** buttons. Apply triggers the corresponding mutation tool with the saved args. Not now clears the pending proposal.
7. Render `answer_question` as plain markdown (no card, no credit badge).

## Out of Scope

- No changes to the mutation tools themselves.
- No changes to the day-brief / ledger pipeline.
- No new credit costs — advisory is free; mutations stay at current pricing.

## Why This Solves It

- The AI **stops auto-replanning** because mutation tools are gated behind both a prompt rule and a server-side verb check.
- Users get a real **conversation** ("is this walkable?" → "yes, 9 min flat walk along Av. da Liberdade") without burning credits.
- When the AI *does* want to change something, it **proposes** it via a card and waits for the click — matching how a human concierge would behave.
- Aligns with the existing **charge-on-action** credit policy in core memory.
