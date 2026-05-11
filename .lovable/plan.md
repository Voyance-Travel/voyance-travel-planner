## Fix: Restaurant cards still missing descriptions

### Root cause
`supabase/functions/generate-itinerary/sanitization.ts` line 1564 collapses `sanitizeAITextField(...)` to `undefined` when the sanitized result is empty/short. Dining cards therefore land in the UI with no description, and downstream `description-fill` doesn't always rescue them (8s timeout / silent failure).

### Change
Replace the single line at 1564 with a guarded block that:

1. Accepts the sanitized text only if it is ≥ 15 chars.
2. Otherwise, for dining-category cards (`dining` / `food` / `restaurant`), writes a deterministic template fallback derived from the meal type in the title + venue/address when available — so a restaurant card never renders with an empty description.
3. For non-dining cards, preserves existing behavior (sets `undefined`; `_shared/description-fill.ts` retains its role as the AI rescue path for non-dining flagged rows).

Logs `[SANITIZE] Day-walker: replaced empty dining description …` for telemetry.

### File touched
- `supabase/functions/generate-itinerary/sanitization.ts` — lines 1564 only.

No other file changes. No prompt changes. No DB or RLS changes.

### Verification
1. `grep -n "template fallback" supabase/functions/generate-itinerary/sanitization.ts` → 1 hit.
2. `grep -c "_mealLabel = " supabase/functions/generate-itinerary/sanitization.ts` → ≥ 4.
3. Generate a fresh Bruges trip → every restaurant card has a non-empty description.

### Memory
Append a sentinel note under `mem://constraints/itinerary/description-coverage` documenting the dining-card rescue path inside `sanitization.ts` day-walker, so future scrubber changes don't re-collapse it.
