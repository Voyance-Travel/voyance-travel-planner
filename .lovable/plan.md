
This is actually 3 separate issues, not one shared failure.

## What I found

1. **Manual paste 500 (`parse-trip-input`)**
   - This is a real backend 500, not a browser/CORS problem.
   - `src/components/planner/ManualTripPasteEntry.tsx` currently shows only a generic toast when the function returns non-2xx.
   - `supabase/functions/parse-trip-input/index.ts` wraps most failures into a generic 500, so the client loses the real cause.
   - I could not confirm the exact parse-stage failure from recent logs, which means the next fix should focus on **making the failure diagnosable and user-visible**.

2. **“Multi city seems stuck”**
   - I confirmed the backend failure from logs on a recent failed trip:
     - `ReferenceError: isFirstDay is not defined`
     - file: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
   - Root cause: values like `isFirstDay`, `isLastDay`, `arrTime24`, and `depTime24` are defined inside the pipeline block, but referenced again later in the universal quality pass after that scope ends.
   - Result: day 1 can partially save, then the chain crashes and the trip is marked `failed`.

3. **`<circle> attribute cx/cy: Expected length, "undefined"`**
   - This looks like a separate frontend animation bug.
   - Most likely source: `src/components/planner/shared/GenerationAnimation.tsx`
   - That component animates SVG circles with Framer Motion; some circles do not start with fully stable numeric SVG attrs, which can produce the `cx/cy undefined` warnings during mount/animation.
   - This is noisy, but it does **not** appear to be the cause of the backend generation failure.

## Plan

### 1) Fix the confirmed multi-city generation crash
**File:** `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

- Hoist the day-context variables so they are available everywhere after generation:
  - first/last day flags
  - arrival/departure times
  - departure transport type
- Replace the out-of-scope references in the universal quality pass with the hoisted values.
- Check the rest of the file for any other post-block references using the inner-scoped names.

### 2) Surface the real backend failure instead of a generic “stuck” message
**File:** `src/hooks/useGenerationPoller.ts`

- When trip status is `failed`, use:
  - `metadata.generation_error` first
  - then `metadata.chain_error` as fallback
- This will expose the actual backend crash reason instead of collapsing into a vague failure state.

Optional follow-up if needed:
**File:** `src/components/itinerary/ItineraryGenerator.tsx`
- Keep the suppression behavior, but log/display the improved poller error text.

### 3) Make `parse-trip-input` failures understandable
**Files:**
- `supabase/functions/parse-trip-input/index.ts`
- `src/components/planner/ManualTripPasteEntry.tsx`

**Backend changes**
- Split the function into explicit failure stages:
  - request validation
  - AI gateway request
  - AI gateway response parse
  - tool-call extraction
  - `JSON.parse(toolCall.function.arguments)`
  - post-processing/sanitization
- Return structured JSON like:
  - `error`
  - `stage`
  - maybe a short `details` string
- Keep logs stage-specific so future 500s are traceable.

**Frontend changes**
- Parse the function error body from the returned function error instead of always showing “Failed to parse your input.”
- Show a more specific toast/message when possible.

### 4) Remove the SVG warning noise
**File:** `src/components/planner/shared/GenerationAnimation.tsx`

- Ensure every animated `<motion.circle>` has concrete numeric `cx` and `cy` values on first render.
- For the particle/orbit animation, prefer animating transforms or provide explicit initial attrs so the DOM never sees `undefined`.
- This should eliminate the repeated console spam.

## Files to update
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `src/hooks/useGenerationPoller.ts`
- `supabase/functions/parse-trip-input/index.ts`
- `src/components/planner/ManualTripPasteEntry.tsx`
- `src/components/planner/shared/GenerationAnimation.tsx`

## Expected outcome
- Multi-city generation stops failing on day 1 from the `isFirstDay` reference bug.
- Failed trips show the real backend reason.
- Manual paste 500s become diagnosable and much easier to fix.
- The SVG `cx/cy undefined` console errors go away.
