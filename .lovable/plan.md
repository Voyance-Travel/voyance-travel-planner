## Goal

Close the remaining gap on the €206 nightcap leak — stop the LLM from copying the dinner price onto an evening drinks stop at the source, so `enforceBarNightcapPriceCap` becomes a backstop rather than the primary correction.

## What's already in place

- `enforceBarNightcapPriceCap` (sanitization.ts) caps drinks-framed activities at €35/pp and bypasses the Michelin exemption when `EXPLICIT_DRINKS_RE` matches (covers "Gran Caffè Quadri nightcap").
- `action-repair-costs.ts` mirrors the same skip + cap with `source='bar_cap_repair'`.
- `stripVenueIdentity` in ledger-check.ts now clears price fields + `metadata.cost_floor*` so vibe-clash swaps don't inherit dinner floors.
- Prompt EVENING block already says: *"Cap evening / nightcap / café / drinks-only stops at €30/person … NEVER inherit dinner-tier pricing for a drinks stop"*.

## What's still missing

The current prompt line is one-shot and abstract. The user's analysis pinpoints LLM token-probability bleed from the immediately preceding dinner cost — a behavior best countered by:

1. A **concrete numeric range** the model anchors on (€10–€35/pp), not just a ceiling.
2. An **explicit anti-copy instruction** that names the failure mode ("do not reuse the dinner price").
3. A **worked example** so the model has a literal pattern to imitate.

## Change

Single edit to `supabase/functions/generate-itinerary/prompt-library.ts`, EVENING/NIGHTLIFE block (around line 1326). Replace the single cap line with three lines:

```
- Evening drinks / nightcap / café / aperitivo / digestif cost = €10–€35 per person, FLAT, regardless of venue prestige (a Michelin-listed café still charges €15 for an espresso).
- DO NOT copy or echo the preceding dinner's price onto the nightcap card. The dinner price and the drinks price are independent — generate the drinks price from the drinks venue, not from the previous activity.
- Example: Dinner at Da Ivo (€200/pp) → Nightcap at Gran Caffè Quadri (€18/pp), not €200/pp. Show, ticketed performance, or formal tasting is the ONLY exception (then price as appropriate for the ticket).
```

This is a 3-line, prompt-only change. No code paths touched, no redeploy of other functions. The cap function and stripVenueIdentity stay as the safety nets they were designed to be.

## Files

- `supabase/functions/generate-itinerary/prompt-library.ts` (EVENING/NIGHTLIFE block)

## Verification

- Deploy `generate-itinerary`.
- No new tests needed — existing `michelin-floor.test.ts` already asserts the cap-side behavior; this change is upstream of the cap and reduces how often it has to fire.
- Track via existing `BAR_CAP_DRINKS_OVERRIDE` warn frequency in edge logs — it should drop after this lands.

## Memory update

Append to existing `mem://constraints/itinerary/strip-venue-identity-clears-label-and-price` (or `mem://constraints/itinerary/nightcap-michelin-exemption-bypass`) noting that the prompt now also blocks the dinner→nightcap price echo at the source.
