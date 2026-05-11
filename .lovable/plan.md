# Restaurant Empty-Description Rescue

## Problem

`sanitizeAITextField` (sanitization.ts:1204) strips 100+ marketing phrases ("Hidden gem", "Popular with locals", "Recommended from our venue database", etc). Restaurant descriptions written largely from those phrases collapse to empty. The day-walker at line 1564 then writes `act.description = ... || undefined`, so the card renders blank.

## Changes

### 1. `sanitization.ts` — clarifying comment in `sanitizeAITextField`

Add a comment block at the final return documenting the explicit contract:
- Empty / sub-20-char output is intentional when input ≥ 40 chars (over-strip case).
- Caller MUST handle the empty-string sentinel (see day-walker at line 1564).

No behavior change — the function already returns the empty string; this just documents the contract so the day-walker's rescue path is the only place that decides what to do with it.

### 2. `sanitization.ts` — day-walker line 1564 dining rescue

Replace:
```ts
if (act.description) act.description = sanitizeAITextField(act.description, destination) || undefined;
```

With:
```ts
if (act.description) {
  const sanitized = sanitizeAITextField(act.description, destination);
  if (sanitized && sanitized.length >= 15) {
    act.description = sanitized;
  } else {
    const cat = String(act.category || '').toLowerCase();
    if (cat.includes('dining') || cat.includes('food') || cat.includes('restaurant')) {
      const venueName = act.location?.name || act.venue_name || extractRestaurantVenueName(act.title || '');
      const titleStr = String(act.title || '');
      const mealLabel = /breakfast|brunch/i.test(titleStr) ? 'Breakfast'
                      : /lunch/i.test(titleStr) ? 'Lunch'
                      : /dinner|supper/i.test(titleStr) ? 'Dinner'
                      : 'A meal';
      if (venueName) {
        act.description = `${mealLabel} at ${venueName}. ${act.location?.address ? `Located at ${act.location.address}.` : 'Check opening hours before heading over.'}`;
      } else {
        act.description = `${mealLabel} at a local spot. Check opening hours and reviews before you go.`;
      }
      console.log(`[SANITIZE] Day-walker: replaced empty dining description for "${act.title}" with template fallback`);
    } else {
      act.description = undefined;
    }
  }
}
```

Scope: only `dining`/`food`/`restaurant` categories get the template; everything else preserves the current `undefined` behavior. Threshold `length >= 15` matches the user spec (avoids 1-fragment leftovers like ".").

### 3. New test `__tests__/dining-description-rescue.test.ts`

Covers:
- Dining card, original = `"A local favorite. Popular with locals. Hidden gem with great food."` → after walker, `description` non-empty + contains venue/meal name (template fired).
- Dining card, original = real prose `"Wood-fired Roman pizza in Trastevere with..."` → description preserved verbatim, no template marker.
- Non-dining card (e.g. `museum`) with collapse-prone description → `description === undefined` (template NOT fired).

Mirrors style of `phantom-ref-clause-scrub.test.ts`.

## Interaction with existing description-fill pipeline

The Description Coverage memory documents that `_shared/description-fill.ts` runs post-`repairDay` (Gemini Flash, 8s timeout) for any restaurant with `description.length < 30` or missing imperative verb. The template fallback's output (e.g. `"Dinner at Da Ivo. Located at ..."`) is **≥ 30 chars and contains an actionable verb** ("Check opening hours…"), so description-fill will treat it as satisfactory and not re-run. This is intentional — template prevents the empty-state UI artifact even if Gemini-flash fill later times out or fails.

## Out of Scope

- No changes to `sanitizeAITextField`'s strip patterns.
- No changes to `_shared/description-fill.ts` (lower-priority Gemini path).
- No prompt or generator changes.
- No change to the `tips`/`voyanceInsight`/`personalization.whyThisFits` rescue — only `description`.

## Verification

- `grep -n "template fallback" supabase/functions/generate-itinerary/sanitization.ts` → 1 hit.
- New deno test: 3 cases pass.
- Existing `phantom-ref-clause-scrub.test.ts` still passes (no regression on rich-prose preservation).

## Memory

Update `mem://constraints/itinerary/description-coverage` to add a 4th defense layer: "Day-walker dining template fallback at sanitization.ts:1564 — restaurants whose description collapses to <15 chars get a meal+venue+hours sentence (≥30 chars, actionable verb so description-fill doesn't re-trigger)."
