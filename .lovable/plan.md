## Problem

This session's "Personalized Wellness Treatment" ($391) is the same class of bug as last session's "Private Wellness Refresh" — a generic, unnamed wellness placeholder slipping past `isPlaceholderWellness`. The detector in `supabase/functions/generate-itinerary/fix-placeholders.ts` already catches "private/relaxing/rejuvenating/luxurious/quick/brief/short" wellness treatments, but the adjective list misses the AI's newest favorite leak words: **"personalized," "customized," "bespoke," "signature," "tailored," "curated," "exclusive,"** plus bare nouns like "personalised treatment" / "wellness experience" with no venue.

Secondary minor issue: "Nightcap at Le Bar" ($76, Day 1) shows in Payments without the hotel context that exists in All Costs ("Le Bar at Four Seasons George V"). Just a display normalization.

## Fix

### 1. Expand wellness placeholder detector — `fix-placeholders.ts`

In `GENERIC_WELLNESS_TITLE_PATTERNS` (line 297):

- Extend the adjective regex (line 300) to include: `personalized|personalised|customized|customised|bespoke|signature|tailored|curated|exclusive|premium|deluxe|indulgent|restorative|holistic`.
- Add a new pattern catching standalone "[adjective] (treatment|experience|ritual|session)" without a venue: e.g. `/^(personalized|bespoke|signature|tailored|curated|exclusive|premium|deluxe|indulgent|holistic|restorative)\s+(wellness|spa|massage|treatment|experience|ritual|session)\b/i`.
- Add: `/^(wellness|spa)\s+(experience|treatment|ritual|session)\s+(at|in)\s+(a|an|the|your)\s+/i` to catch "Wellness Treatment at the spa" style stubs that lack a proper noun.

The downstream replacer (`replaceWithFallbackWellness` around line 280) already swaps to a real fallback-DB venue with name/address/price — so widening detection automatically routes these to a real venue without further changes.

### 2. Belt-and-suspenders: high-cost wellness sanity check

In `supabase/functions/generate-itinerary/sanitization.ts`, in the existing high-cost guidance pass added last turn (`enforceHighCostBookingGuidance`):

- For wellness/spa category items ≥ $150 where the venue name is missing, equals "your hotel", equals the city, or matches `PLACEHOLDER_VENUE_PATTERNS`, mark `metadata.needs_venue_replacement = true` and log a warning. The next repair-day pass already calls `isPlaceholderWellness` — flagging here ensures that when the title slips through (because it contains a real-sounding word like "Personalized") we still catch it via the venue side.

### 3. Hotel-bar title normalization (display-side, small)

In `src/components/itinerary/PaymentsTab.tsx` (and any Activities-list helper that renders the title): when an activity title contains `"at Le Bar"`, `"at The Bar"`, `"at the Lobby Bar"`, `"at the Rooftop"`, etc., AND the activity has `metadata.hotel_name` (or an `accommodation` link for that day), append ` at {hotel_name}` if not already present. Keeps Payments and All Costs labels consistent.

## Files to change

- `supabase/functions/generate-itinerary/fix-placeholders.ts` — broaden `GENERIC_WELLNESS_TITLE_PATTERNS`.
- `supabase/functions/generate-itinerary/sanitization.ts` — flag high-cost wellness with placeholder venue inside `enforceHighCostBookingGuidance`.
- `src/components/itinerary/PaymentsTab.tsx` — append hotel name to generic bar titles for display.

No DB migration. No memory updates required (refines the existing `mem://constraints/itinerary/believable-human-pacing-principle` rule about generic stub names).

Approve to implement.