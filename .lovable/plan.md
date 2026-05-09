## Goal

Delete the unreachable predictions branch from `mid-trip-dna/index.ts`. The only caller (`MidTripDNA.tsx:82`) always passes `mode: 'daily-briefing'`, so lines 133–321 (~190 lines) are dead code: they call the Lovable AI gateway, build a tool-call schema, and return a `predictions` payload that nothing consumes.

Path A keeps the live daily-briefing behavior identical and removes the dead AI call path. If predictions are wanted later, they can be re-introduced alongside a real UI surface.

## Changes

### 1. `supabase/functions/mid-trip-dna/index.ts`

- Make `daily-briefing` the only supported mode. Reject anything else with a clean 400 instead of silently falling through to the dead branch.
- Delete lines 133–321 (the entire "ORIGINAL PREDICTIONS MODE" block: trip+DNA load, prompt build, `fetch` to `ai.gateway.lovable.dev`, tool-call parse, predictions response).
- Keep the outer `try/catch`, CORS handling, auth check, and the existing daily-briefing block byte-for-byte.
- Remove the now-unused `LOVABLE_API_KEY` read (it lives inside the deleted block; daily-briefing has its own AI call earlier in the file that keeps its own key read).

Concretely, after the `if (mode === 'daily-briefing') { … return … }` block, replace the predictions section with:

```ts
return new Response(
  JSON.stringify({ error: "Unsupported mode. Only 'daily-briefing' is supported." }),
  { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

### 2. No client changes

`MidTripDNA.tsx` already passes `mode: 'daily-briefing'` and only reads `data.briefing`. No other file references this function (verified via `grep -rn "mid-trip-dna" src/ supabase/`).

### 3. No config changes

`supabase/config.toml` already has a `[functions.mid-trip-dna]` block — keep it.

## Verification

After the edit:

```
grep -n "predictions\|generate_trip_predictions\|ai.gateway.lovable.dev\|LOVABLE_API_KEY" supabase/functions/mid-trip-dna/index.ts
```

Expected: only matches inside the daily-briefing block (which has its own AI call). No `generate_trip_predictions` tool, no `predictions` response field.

Line count of `index.ts` should drop by ~190 lines.

## Risk

Near-zero. The deleted branch was unreachable. Daily-briefing behavior is unchanged. Anyone calling the function without `mode` (or with a different mode) used to get a silent AI prediction call; now they get a clear 400. That's a behavior change only for callers that don't exist.
