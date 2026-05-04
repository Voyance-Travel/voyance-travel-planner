
Two related copy/UX bugs are showing up on the rendered itinerary:

1. **Malformed possessive: "the's historic mosque"**
   The Hammam description reads "A sensory retreat at the's historic mosque". Today `sanitizeText` already rewrites `\bthe's\b` → `${destination}'s` (sanitization.ts:1073), but it only fires when `destination` is truthy and the result ("Paris's historic mosque") still reads awkwardly. The user wants `the city's historic mosque`.

2. **Transit label points to a venue that isn't next**
   The card "Travel to Hammam à la Grande Mosquée de Paris" appears immediately before the 12:30 PM lunch at Le Petit Cler — but the Hammam doesn't start until 15:15. Either (a) the LLM emitted a transit card whose label/destination jumps over the lunch, and our repair pass never rewrites it because "Hammam…" isn't on our placeholder list, or (b) the transit's `startTime` is immediately post-prev-activity so it sorts before lunch even though its destination is the post-lunch slot.

## Fix 1 — copy artifact "the's" → "the city's"

File: `supabase/functions/generate-itinerary/sanitization.ts` (~line 1067-1098)

- Move the `\bthe's\b` rewrite **out of** the `if (destination)` block so it always fires.
- Change the replacement from `destination + "'s"` to the literal string `"the city's"`. This reads naturally regardless of destination, matches the user's exact requested wording, and avoids ugly forms like "Paris's".
- Add a sibling rewrite for the equally common artifact `\bthe' s\b` (with stray space) just in case.
- Keep all existing orphaned-article repairs in place.

Also apply the same client-side rule in `src/utils/textSanitizer.ts` so any legacy/persisted descriptions get cleaned at render time without waiting for regeneration.

## Fix 2 — transit label/order must match the immediate next non-transit activity

File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`

Currently the placeholder-destination sweep (Step 15a-bis, ~line 2834) only rewrites transit cards whose destination is a single letter / generic placeholder. It does not catch the case where the LLM picks a real venue name that happens to be **two activities away**.

Add a new pass — **Step 15a-ter: "Transit/next-venue coherence"** — that runs right after 15a-bis:

1. For each transport card `T` at index `i`, find the next non-transport activity `N` at index `j > i`.
2. Extract `T`'s claimed destination from `T.location?.name` or by stripping the verb prefix from `T.title` (`Travel to`, `Walk to`, `Taxi to`, etc.).
3. Normalize both names (lowercase, strip diacritics, drop common prefixes like "le/la/the/à la").
4. If neither name contains the other (no substring overlap and no token-set overlap ≥ 1 strong token):
   - **Case A — N is at the same/contained location as the previous real activity** (i.e. lunch is across the street from the prior stop): the transit card was inserted in the wrong slot. Move `T` to immediately precede the **real** activity it points to (find the next non-transport whose name actually matches `T`'s destination, then splice `T` directly before it and recompute its `startTime` from that activity's preceding `endTime`).
   - **Case B — no later activity matches `T`'s destination**: rewrite `T` to point at `N` using the existing `generateTransitLabel(N, method)` + `sanitizeTransitDestination`, the same way 15a-bis does. Update `title`, `name`, `location.name`, and `description`.
5. Log a `repairs.push({ code: LOGISTICS_SEQUENCE, action: 'transit_label_realign', before, after })` entry for observability.

Helpers already in file: `generateTransitLabel`, `sanitizeTransitDestination`, `isTransportFinal`, `parseTimeToMinutes`, `addMinutesToHHMM`, `isSameOrContainedLocation`. No new deps.

Also tighten the LLM prompt in `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (rule #12, ~line 1751): expand the existing "TRANSIT LABELS" line to add an explicit example: *"WRONG: lunch at 12:30, then 'Travel to Hammam' before lunch when Hammam is at 15:15. The transit card must always name the venue you reach NEXT in chronological order."*

## Out of scope

- Not changing the actual Hammam start time, lunch venue, or pricing.
- Not touching the airport-transfer breakout shipped previously.
- No DB migration required.

## Files touched

- `supabase/functions/generate-itinerary/sanitization.ts` — unconditional `the's` → `the city's` rewrite
- `src/utils/textSanitizer.ts` — same rewrite for already-rendered descriptions
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — new Step 15a-ter coherence pass
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — sharper TRANSIT LABELS rule with concrete counter-example

Approve to implement?
